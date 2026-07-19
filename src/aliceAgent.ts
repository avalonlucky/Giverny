import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { Agent, type AgentContext } from 'agents'
import { generateText, stepCountIs, tool, type ModelMessage } from 'ai'
import { z } from 'zod'
import { agentReadToolRegistry } from './agentToolRegistry'
import type { AgentWriteWorkflowParams } from './agentWriteWorkflow'
import type { AgentApproval, AgentApprovalStatus, AgentBackgroundTask, AgentConversationMessage, AgentResultAttachment, AgentTaskSelection } from './types/agent'

type AliceAgentEnv = Record<string, unknown> & {
  DEEPSEEK_API_KEY?: string
  DEEPSEEK_BASE_URL?: string
  DEEPSEEK_MODEL?: string
  AGENT_TOOL_TOKEN?: string
  GIVERNY_API_BASE_URL?: string
  AGENT_WRITE_WORKFLOW?: unknown
}

type PendingActionSummary = {
  action: string
  label: string
  draft: Record<string, unknown>
  warnings: string[]
  createdAt: number
}

type AliceAgentState = {
  messageCount: number
  lastActiveAt: number | null
  pendingAction: PendingActionSummary | null
}

type StoredMessage = {
  id?: string
  role: 'user' | 'assistant'
  content: string
  metadata_json?: string
  created_at?: number
}

type StoredPendingAction = PendingActionSummary & {
  endpoint: string
  confirmationToken: string
  workflowId: string
  workflowApproved: boolean
}

type AgentToolResponse = Record<string, unknown> & {
  mode?: string
  ready?: boolean
  draft?: Record<string, unknown>
  confirmationToken?: string
  error?: string
}

export type AliceAgentChatRequest = {
  message: string
  currentMonth?: string
  conversationId?: string
  history?: StoredMessage[]
  context?: string
}

export type AliceAgentTraceItem = {
  type: 'plan' | 'tool' | 'result' | 'error'
  label: string
  detail?: string
}

export type AliceAgentChatResult = {
  answer: string
  trace: AliceAgentTraceItem[]
  model: string
  approval?: AgentApproval
  selection?: AgentTaskSelection
  backgroundTask?: AgentBackgroundTask
  attachments?: AgentResultAttachment[]
}

const SYSTEM_PROMPT = `你是爱丽丝，也是 Giverny 的长期工作智能体。

工作规则：
- 用户询问 Giverny 的快捷键、入口、功能、设置、操作方法、模型路由或权限边界时，必须调用 search_product_help，以产品能力注册表为准。
- 任务、收入、金额、工时、结算、验收、附件和进展问题必须调用工具，以工具数据为准。
- 用户要查看、打开、预览或下载附件时，必须调用 search_attachments；答案只做简要概括，不要把内部文件 URL 写进正文，界面会另行显示可操作附件卡。
- 用户要求月度复盘、整月工作分析或月度总结时，调用 start_monthly_review 启动后台任务；不要在当前请求里自己串行读完所有数据。
- 用户要求周报、风险扫描、跨任务比较、批量附件总结或趋势分析时，调用 start_deep_analysis 启动后台任务。
- 不得根据标题关键词臆测任务数量、状态、金额或工时。
- 创建任务、记录反馈、修改字段、修改状态、追加进展、记录等待、维护已有记录、标记验收文件和完整验收只能调用对应的 preview 工具。
- 用户要求验收时优先调用 complete_acceptance_preview，把验收备注、最终进展、工时和已有附件放进同一张确认卡；不要拆成修改状态和普通进展两次写入。
- 用户要求你持续推进一个目标、从创建跟到验收或安排后续步骤时，调用 create_task_plan，保存 2-8 个可核对步骤；不要只在正文里写一次性清单。
- 讨论某个任务的历史脉络、未解决问题、甲方偏好或下一步前，优先调用 get_task_memory；任务记忆只压缩事实，不替代任务详情权威数据。
- 附件工具只能选择网站里已经存在的 attachmentId；用户电脑上的新文件必须先上传，不能伪造文件或文件地址。
- 工具返回多个候选任务时必须让用户选择，不得自行猜测；用户选择“任务 #ID”后，后续工具必须传 taskId。
- preview 返回后，清楚展示草稿、缺失项和风险；不要声称已经执行。
- 真正写入由运行时在用户明确确认后完成，你无法也不应自行执行写操作。
- 工具没有返回的数据必须说明缺失，不得编造。
- 需要对比多条同类数据时可以输出标准 Markdown 表格，但不要把 Markdown 语法当作普通文字解释。
- 先给结论，再给必要依据；语言自然、直接，不输出原始思维链或 <think> 标签。`

const PREVIEW_ACTIONS: Record<string, { previewEndpoint: string; executeEndpoint: string; label: string }> = {
  create_task_preview: { previewEndpoint: 'create-task-preview', executeEndpoint: 'create-task', label: '创建任务' },
  record_feedback_preview: { previewEndpoint: 'record-feedback-preview', executeEndpoint: 'record-feedback', label: '记录反馈' },
  update_task_status_preview: { previewEndpoint: 'update-task-status-preview', executeEndpoint: 'update-task-status', label: '修改任务状态' },
  update_task_fields_preview: { previewEndpoint: 'update-task-fields-preview', executeEndpoint: 'update-task-fields', label: '修改任务字段' },
  append_progress_preview: { previewEndpoint: 'append-progress-preview', executeEndpoint: 'append-progress', label: '追加任务进展' },
  append_waiting_preview: { previewEndpoint: 'append-waiting-preview', executeEndpoint: 'append-waiting', label: '记录等待' },
  manage_record_preview: { previewEndpoint: 'manage-record-preview', executeEndpoint: 'manage-record', label: '维护任务记录' },
  mark_acceptance_files_preview: { previewEndpoint: 'mark-acceptance-files-preview', executeEndpoint: 'mark-acceptance-files', label: '标记验收文件' },
  complete_acceptance_preview: { previewEndpoint: 'complete-acceptance-preview', executeEndpoint: 'complete-acceptance', label: '完成任务验收' },
}

const AGENT_TOOL_TRACE_LABELS: Record<string, { running: string; completed: string }> = {
  query_month_finance: { running: '核对月份工时与收入', completed: '月份统计已返回' },
  search_tasks: { running: '检索相关任务', completed: '任务检索已完成' },
  search_attachments: { running: '查找相关附件', completed: '附件检索已完成' },
  get_task_detail: { running: '读取任务详情', completed: '任务详情已返回' },
  get_giverny_context: { running: '确认平台能力边界', completed: '能力范围已确认' },
  search_product_help: { running: '查询产品使用说明', completed: '产品说明已返回' },
  create_task_preview: { running: '整理新任务草稿', completed: '任务草稿已生成' },
  record_feedback_preview: { running: '整理反馈记录', completed: '反馈草稿已生成' },
  update_task_status_preview: { running: '核对状态变更', completed: '状态变更草稿已生成' },
  update_task_fields_preview: { running: '核对任务字段', completed: '字段修改草稿已生成' },
  append_progress_preview: { running: '整理进展记录', completed: '进展草稿已生成' },
  append_waiting_preview: { running: '整理等待记录', completed: '等待草稿已生成' },
  manage_record_preview: { running: '核对已有记录', completed: '记录维护草稿已生成' },
  mark_acceptance_files_preview: { running: '核对验收文件', completed: '验收文件草稿已生成' },
  complete_acceptance_preview: { running: '整理完整验收包', completed: '验收草稿已生成' },
  start_monthly_review: { running: '创建月度复盘任务', completed: '月度复盘已进入后台执行' },
  start_deep_analysis: { running: '创建深度分析任务', completed: '深度分析已进入后台执行' },
}

function agentToolTraceLabel(toolName: string, phase: 'running' | 'completed') {
  const label = AGENT_TOOL_TRACE_LABELS[toolName]?.[phase]
    || (phase === 'running' ? '调用业务工具' : '业务工具已返回')
  return `${label} [tool:${toolName}]`
}

const CONFIRM_RE = /^(?:好的?|没问题)?(?:确认(?:执行|创建|记录|修改)?|执行吧|可以(?:执行|创建|记录|修改)|同意(?:执行|创建|记录|修改)|就这样(?:执行|创建|记录)?)$/
const REJECT_RE = /^(?:好的?)?(?:取消|不要(?:执行|创建|记录|修改)?|撤销|拒绝|先不(?:执行|创建|记录|修改)?)$/

function cleanBaseUrl(value: string | undefined, fallback: string) {
  return String(value || fallback).trim().replace(/\/+$/, '')
}

function cleanAnswer(value: string) {
  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim()
}

function normalizedDecision(value: string) {
  return value.replace(/[。！!，,、；;：:\s]/g, '').slice(0, 40)
}

function wantsAttachmentResults(value: string) {
  return /附件|(?:找|找到|打开|预览|下载).*(?:文件|交付件)|(?:文件|交付件).*(?:找|打开|预览|下载)/.test(value)
}

function toJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function parseJsonObject(value: string) {
  try { return toJsonObject(JSON.parse(value || '{}')) } catch { return {} }
}

export class AliceAgent extends Agent<AliceAgentEnv, AliceAgentState> {
  private activeConversationId = ''
  private readonly aliceEnv: AliceAgentEnv

  constructor(ctx: AgentContext, env: AliceAgentEnv) {
    super(ctx, env)
    this.aliceEnv = env
  }

  initialState: AliceAgentState = {
    messageCount: 0,
    lastActiveAt: null,
    pendingAction: null,
  }

  async onStart() {
    void this.sql`
      CREATE TABLE IF NOT EXISTS alice_messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      )
    `
    const messageColumns = this.sql<{ name: string }>`PRAGMA table_info(alice_messages)`
    if (!messageColumns.some((column) => column.name === 'metadata_json')) {
      void this.sql`ALTER TABLE alice_messages ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}'`
    }
    void this.sql`
      CREATE TABLE IF NOT EXISTS alice_pending_actions (
        singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
        action TEXT NOT NULL,
        label TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        confirmation_token TEXT NOT NULL,
        draft_json TEXT NOT NULL,
        warnings_json TEXT NOT NULL DEFAULT '[]',
        workflow_id TEXT NOT NULL DEFAULT '',
        workflow_approved INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `
    const columns = this.sql<{ name: string }>`PRAGMA table_info(alice_pending_actions)`
    if (!columns.some((column) => column.name === 'warnings_json')) {
      void this.sql`ALTER TABLE alice_pending_actions ADD COLUMN warnings_json TEXT NOT NULL DEFAULT '[]'`
    }
    if (!columns.some((column) => column.name === 'workflow_id')) {
      void this.sql`ALTER TABLE alice_pending_actions ADD COLUMN workflow_id TEXT NOT NULL DEFAULT ''`
    }
    if (!columns.some((column) => column.name === 'workflow_approved')) {
      void this.sql`ALTER TABLE alice_pending_actions ADD COLUMN workflow_approved INTEGER NOT NULL DEFAULT 0`
    }
  }

  private saveMessage(role: StoredMessage['role'], content: string, metadata: Record<string, unknown> = {}) {
    void this.sql`
      INSERT INTO alice_messages (id, role, content, metadata_json, created_at)
      VALUES (${crypto.randomUUID()}, ${role}, ${content}, ${JSON.stringify(metadata)}, ${Date.now()})
    `
    this.setState({
      ...this.state,
      messageCount: this.state.messageCount + 1,
      lastActiveAt: Date.now(),
    })
  }

  async conversationSnapshot(): Promise<{ messages: AgentConversationMessage[] }> {
    const rows = this.sql<Required<Pick<StoredMessage, 'id' | 'role' | 'content' | 'metadata_json' | 'created_at'>>>`
      SELECT id, role, content, metadata_json, created_at
      FROM alice_messages
      ORDER BY created_at ASC
      LIMIT 100
    `
    return {
      messages: rows.map((row) => {
        const metadata = parseJsonObject(row.metadata_json)
        return {
          id: row.id,
          role: row.role,
          content: row.content,
          ...(metadata.approval ? { approval: metadata.approval as AgentApproval } : {}),
          ...(metadata.selection ? { selection: metadata.selection as AgentTaskSelection } : {}),
          ...(metadata.backgroundTask ? { backgroundTask: metadata.backgroundTask as AgentBackgroundTask } : {}),
          ...(Array.isArray(metadata.attachments) ? { attachments: metadata.attachments as AgentResultAttachment[] } : {}),
          ...(Array.isArray(metadata.trace) ? { trace: metadata.trace.map(String).filter(Boolean) } : {}),
          createdAt: row.created_at,
        }
      }),
    }
  }

  async importConversation(request: { messages?: AgentConversationMessage[] }) {
    const [{ count }] = this.sql<{ count: number }>`SELECT COUNT(*) AS count FROM alice_messages`
    if (Number(count) > 0) return { imported: 0, skipped: true }
    const messages = Array.isArray(request.messages) ? request.messages.slice(-40) : []
    let imported = 0
    for (const item of messages) {
      if ((item.role !== 'user' && item.role !== 'assistant') || !String(item.content || '').trim()) continue
      const createdAt = Number(item.createdAt) || Date.now() + imported
      void this.sql`
        INSERT OR IGNORE INTO alice_messages (id, role, content, metadata_json, created_at)
        VALUES (${String(item.id || crypto.randomUUID())}, ${item.role}, ${String(item.content).trim()}, ${JSON.stringify({
          approval: item.approval,
          selection: item.selection,
          backgroundTask: item.backgroundTask,
          attachments: item.attachments,
          trace: item.trace,
        })}, ${createdAt})
      `
      imported += 1
    }
    this.setState({ ...this.state, messageCount: imported, lastActiveAt: imported ? Date.now() : null })
    return { imported, skipped: false }
  }

  async clearConversation() {
    void this.sql`DELETE FROM alice_messages`
    void this.sql`DELETE FROM alice_pending_actions`
    this.setState({ ...this.initialState })
    return { cleared: true }
  }

  private recentMessages(limit = 20): ModelMessage[] {
    const rows = this.sql<StoredMessage>`
      SELECT role, content
      FROM alice_messages
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
    return rows.reverse().map((row) => ({ role: row.role, content: row.content }))
  }

  private getPendingAction(): StoredPendingAction | null {
    const [row] = this.sql<{
      action: string
      label: string
      endpoint: string
      confirmation_token: string
      draft_json: string
      warnings_json: string
      workflow_id: string
      workflow_approved: number
      created_at: number
    }>`
      SELECT action, label, endpoint, confirmation_token, draft_json, warnings_json,
        workflow_id, workflow_approved, created_at
      FROM alice_pending_actions
      WHERE singleton = 1
    `
    if (!row) return null
    let draft: Record<string, unknown>
    let warnings: string[]
    try {
      draft = toJsonObject(JSON.parse(row.draft_json))
    } catch {
      draft = {}
    }
    try {
      const parsed = JSON.parse(row.warnings_json)
      warnings = Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : []
    } catch {
      warnings = []
    }
    return {
      action: row.action,
      label: row.label,
      endpoint: row.endpoint,
      confirmationToken: row.confirmation_token,
      draft,
      warnings,
      workflowId: String(row.workflow_id || ''),
      workflowApproved: Boolean(row.workflow_approved),
      createdAt: Number(row.created_at) || Date.now(),
    }
  }

  private setPendingAction(action: StoredPendingAction) {
    void this.sql`
      INSERT INTO alice_pending_actions (
        singleton, action, label, endpoint, confirmation_token, draft_json, warnings_json,
        workflow_id, workflow_approved, created_at
      ) VALUES (
        1, ${action.action}, ${action.label}, ${action.endpoint}, ${action.confirmationToken},
        ${JSON.stringify(action.draft)}, ${JSON.stringify(action.warnings)}, ${action.workflowId},
        ${action.workflowApproved ? 1 : 0}, ${action.createdAt}
      )
      ON CONFLICT(singleton) DO UPDATE SET
        action = excluded.action,
        label = excluded.label,
        endpoint = excluded.endpoint,
        confirmation_token = excluded.confirmation_token,
        draft_json = excluded.draft_json,
        warnings_json = excluded.warnings_json,
        workflow_id = excluded.workflow_id,
        workflow_approved = excluded.workflow_approved,
        created_at = excluded.created_at
    `
    this.setState({
      ...this.state,
      pendingAction: {
        action: action.action,
        label: action.label,
        draft: action.draft,
        warnings: action.warnings,
        createdAt: action.createdAt,
      },
    })
  }

  private clearPendingAction() {
    void this.sql`DELETE FROM alice_pending_actions WHERE singleton = 1`
    this.setState({ ...this.state, pendingAction: null })
  }

  private async callTool(endpoint: string, input: Record<string, unknown>, method: 'GET' | 'POST' = 'POST') {
    const baseUrl = cleanBaseUrl(this.aliceEnv.GIVERNY_API_BASE_URL, 'https://mayeai.com')
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    const token = String(this.aliceEnv.AGENT_TOOL_TOKEN || '').trim()
    if (!token) throw new Error('AGENT_TOOL_TOKEN 未配置，Agent 无法访问业务工具。')
    headers.authorization = `Bearer ${token}`

    const url = new URL(`${baseUrl}/api/agent/tools/${endpoint}`)
    if (method === 'GET') {
      Object.entries(input).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
      })
    }
    const response = await fetch(url, {
      method,
      headers,
      ...(method === 'POST' ? { body: JSON.stringify(input) } : {}),
    })
    const data = (await response.json().catch(() => null)) as AgentToolResponse | null
    if (!response.ok || !data) {
      throw new Error(data?.error || `工具 ${endpoint} 调用失败：HTTP ${response.status}`)
    }
    if (data.error) throw new Error(data.error)
    return data
  }

  private async previewTool(action: string, endpoint: string, input: Record<string, unknown>) {
    const data = await this.callTool(endpoint, input)
    const config = PREVIEW_ACTIONS[action]
    const confirmationToken = String(data.confirmationToken || '')
    if (config && data.ready === true && confirmationToken) {
      const previous = this.getPendingAction()
      if (previous?.workflowId && !previous.workflowApproved) {
        await this.rejectWorkflow(previous.workflowId, { reason: '草稿已被新预览替换' }).catch(() => undefined)
      }
      const createdAt = Date.now()
      let workflowId = ''
      if (this.aliceEnv.AGENT_WRITE_WORKFLOW) {
        const startWorkflow = this.runWorkflow as unknown as (
          name: string,
          params: AgentWriteWorkflowParams,
          options: { id: string; metadata: Record<string, unknown>; agentBinding: string },
        ) => Promise<string>
        workflowId = await startWorkflow.call(this, 'AGENT_WRITE_WORKFLOW', {
          action: action.replace(/_preview$/, ''),
          label: config.label,
          endpoint: config.executeEndpoint,
          confirmationToken,
          createdAt,
        }, {
          id: `agent-write-${crypto.randomUUID()}`,
          metadata: { action: action.replace(/_preview$/, ''), createdAt },
          agentBinding: 'ALICE_AGENT',
        })
      }
      this.setPendingAction({
        action: action.replace(/_preview$/, ''),
        label: config.label,
        endpoint: config.executeEndpoint,
        confirmationToken,
        workflowId,
        workflowApproved: false,
        draft: toJsonObject(data.draft),
        warnings: Array.isArray(data.warnings) ? data.warnings.map((item) => String(item)).filter(Boolean) : [],
        createdAt,
      })
    }
    const safeData = { ...data }
    delete safeData.confirmationToken
    return safeData
  }

  private approvalResult(pending: StoredPendingAction, status: AgentApprovalStatus, error?: string): AgentApproval {
    return {
      id: `${pending.action}:${pending.createdAt}`,
      action: pending.action,
      label: pending.label,
      draft: pending.draft,
      warnings: pending.warnings,
      status,
      createdAt: pending.createdAt,
      expiresAt: pending.createdAt + 10 * 60 * 1000,
      ...(error ? { error } : {}),
    }
  }

  private taskSelection(value: unknown): AgentTaskSelection | undefined {
    const record = toJsonObject(value)
    const rawSelection = toJsonObject(record.selection)
    const candidates = Array.isArray(rawSelection.candidates)
      ? rawSelection.candidates.map((item) => toJsonObject(item)).map((item) => ({
          id: Number(item.id) || 0,
          title: String(item.title || ''),
          type: String(item.type || ''),
          status: String(item.status || ''),
          startDate: String(item.startDate || ''),
          settlementMonth: String(item.settlementMonth || ''),
        })).filter((item) => item.id > 0 && item.title)
      : []
    if (record.needsDisambiguation !== true || candidates.length < 2) return undefined
    return {
      id: String(rawSelection.id || `task-selection:${Date.now()}`),
      kind: 'task',
      prompt: String(rawSelection.prompt || '请选择要操作的任务。'),
      candidates,
    }
  }

  private resultAttachments(value: unknown): AgentResultAttachment[] {
    const record = toJsonObject(value)
    const files = Array.isArray(record.files) ? record.files : []
    return files.map((item) => toJsonObject(item)).map((file) => ({
      id: Number(file.id) || 0,
      taskId: Number(file.taskId) || 0,
      taskTitle: String(file.taskTitle || file.task || ''),
      name: String(file.name || ''),
      type: String(file.type || 'FILE'),
      mimeType: String(file.mimeType || ''),
      size: String(file.size || ''),
      scope: file.scope === 'acceptance' ? 'acceptance' as const : 'progress' as const,
      tag: String(file.tag || ''),
      uploadedAt: String(file.uploadedAt || ''),
      previewUrl: file.previewUrl ? String(file.previewUrl) : undefined,
      sourceUrl: String(file.sourceUrl || ''),
    })).filter((file) => file.id > 0 && file.name && file.sourceUrl)
  }

  private buildTools(currentMonth: string | undefined, conversationId: string | undefined) {
    const readTools = agentReadToolRegistry
    return {
      query_month_finance: tool({
        description: readTools.query_month_finance.description,
        inputSchema: readTools.query_month_finance.inputSchema,
        execute: (input) => this.callTool('month-finance', {
          question: input.question,
          currentMonth: input.currentMonth || currentMonth,
          months: input.months,
        }, 'GET'),
      }),
      search_tasks: tool({
        description: readTools.search_tasks.description,
        inputSchema: readTools.search_tasks.inputSchema,
        execute: (input) => this.callTool('search-tasks', input, 'GET'),
      }),
      get_task_detail: tool({
        description: readTools.get_task_detail.description,
        inputSchema: readTools.get_task_detail.inputSchema,
        execute: (input) => this.callTool('task-detail', input, 'GET'),
      }),
      search_attachments: tool({
        description: readTools.search_attachments.description,
        inputSchema: readTools.search_attachments.inputSchema,
        execute: (input) => this.callTool('search-attachments', input, 'GET'),
      }),
      get_giverny_context: tool({
        description: readTools.get_giverny_context.description,
        inputSchema: readTools.get_giverny_context.inputSchema,
        execute: () => this.callTool('context', {}, 'GET'),
      }),
      search_product_help: tool({
        description: readTools.search_product_help.description,
        inputSchema: readTools.search_product_help.inputSchema,
        execute: (input) => this.callTool('product-help', input, 'GET'),
      }),
      create_task_plan: tool({
        description: '保存一个可跨会话持续推进的任务计划。适用于“从新建跟到验收”“持续提醒我完成这个项目”等目标。',
        inputSchema: z.object({
          goal: z.string().min(2).max(500),
          taskId: z.number().int().positive().optional(),
          nextActionAt: z.string().optional(),
          steps: z.array(z.object({ label: z.string().min(1).max(120), action: z.string().min(1).max(60) })).min(2).max(8),
        }),
        execute: (input) => this.callTool('create-task-plan', { ...input, conversationId }),
      }),
      get_task_memory: tool({
        description: '读取并刷新某个任务的长期记忆，包括需求摘要、近期记录、甲方反馈偏好和未解决事项。',
        inputSchema: z.object({ taskId: z.number().int().positive() }),
        execute: (input) => this.callTool('get-task-memory', input, 'GET'),
      }),
      start_monthly_review: tool({
        description: '启动指定月份的持久化后台工作复盘。用于“复盘本月”、“整体分析 7 月工作”等耗时请求，不要用于单个数字查询。',
        inputSchema: z.object({
          month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
        }),
        execute: (input) => this.callTool('monthly-review-start', {
          month: input.month || currentMonth,
          conversationId,
        }),
      }),
      start_deep_analysis: tool({
        description: '启动持久化深度分析。支持周报、风险扫描、跨任务比较、批量附件总结和多月趋势分析。',
        inputSchema: z.object({
          type: z.enum(['weekly_digest', 'risk_digest', 'cross_task_analysis', 'batch_attachment_analysis', 'trend_analysis']),
          month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
          query: z.string().max(1000).optional(),
          taskIds: z.array(z.number().int().positive()).max(30).optional(),
        }),
        execute: (input) => this.callTool('analysis-job-start', {
          ...input,
          month: input.month || currentMonth,
          conversationId,
        }),
      }),
      create_task_preview: tool({
        description: '生成新任务草稿。只预览，不直接创建。',
        inputSchema: z.object({
          title: z.string().optional(),
          requirement: z.string().optional(),
          type: z.string().optional(),
          startDate: z.string().optional(),
          estimatedDate: z.string().optional(),
          settlementMonth: z.string().optional(),
          estimatedHours: z.number().optional(),
          requester: z.string().optional(),
          contact: z.string().optional(),
          reviewer: z.string().optional(),
          billable: z.boolean().optional(),
          isSupplemental: z.boolean().optional(),
        }),
        execute: (input) => this.previewTool('create_task_preview', 'create-task-preview', {
          ...input,
          currentMonth,
        }),
      }),
      record_feedback_preview: tool({
        description: '生成记录甲方反馈或修改建议的预览。',
        inputSchema: z.object({
          taskId: z.number().int().positive().optional(),
          taskTitle: z.string().optional(),
          note: z.string(),
          feedbackVersion: z.string().optional(),
          feedbackSource: z.string().optional(),
          dateTime: z.string().optional(),
        }),
        execute: (input) => this.previewTool('record_feedback_preview', 'record-feedback-preview', input),
      }),
      update_task_status_preview: tool({
        description: '生成任务状态与进度修改预览。',
        inputSchema: z.object({
          taskId: z.number().int().positive().optional(),
          taskTitle: z.string().optional(),
          status: z.enum(['计划中', '进行中', '挂起', '待验收', '已验收', '终止', '不计费']),
          progress: z.number().min(0).max(100).optional(),
          reason: z.string().optional(),
        }),
        execute: (input) => this.previewTool('update_task_status_preview', 'update-task-status-preview', input),
      }),
      update_task_fields_preview: tool({
        description: '生成任务字段修改预览。fields 只包含需要变更的字段。',
        inputSchema: z.object({
          taskId: z.number().int().positive().optional(),
          taskTitle: z.string().optional(),
          fields: z.record(z.string(), z.unknown()),
        }),
        execute: (input) => this.previewTool('update_task_fields_preview', 'update-task-fields-preview', input),
      }),
      append_progress_preview: tool({
        description: '生成任务进展和分段计时记录预览。',
        inputSchema: z.object({
          taskId: z.number().int().positive().optional(),
          taskTitle: z.string().optional(),
          note: z.string(),
          startDateTime: z.string().optional(),
          endDateTime: z.string().optional(),
          isUncounted: z.boolean().optional(),
          isRevision: z.boolean().optional(),
          isAcceptanceProgress: z.boolean().optional(),
        }),
        execute: (input) => this.previewTool('append_progress_preview', 'append-progress-preview', input),
      }),
      append_waiting_preview: tool({
        description: '生成等待记录预览。等待时长不计入实际工时或结算。',
        inputSchema: z.object({
          taskId: z.number().int().positive().optional(),
          taskTitle: z.string().optional(),
          note: z.string(),
          reason: z.enum(['等待甲方意见', '等待补充资料', '等待排期', '其他']).optional(),
          startDateTime: z.string().optional(),
          endDateTime: z.string().optional(),
        }),
        execute: (input) => this.previewTool('append_waiting_preview', 'append-waiting-preview', input),
      }),
      manage_record_preview: tool({
        description: '生成编辑或删除已有进展、反馈、等待记录的预览。必须先读取任务详情取得 recordId。',
        inputSchema: z.object({
          taskId: z.number().int().positive().optional(),
          taskTitle: z.string().optional(),
          recordType: z.enum(['progress', 'feedback', 'waiting']),
          action: z.enum(['edit', 'delete']),
          recordId: z.string(),
          changes: z.record(z.string(), z.unknown()).optional(),
        }),
        execute: (input) => this.previewTool('manage_record_preview', 'manage-record-preview', input),
      }),
      mark_acceptance_files_preview: tool({
        description: '把任务已有附件标记为验收文件。必须先通过任务详情或附件搜索获得 attachmentId。',
        inputSchema: z.object({
          taskId: z.number().int().positive().optional(),
          taskTitle: z.string().optional(),
          attachmentIds: z.array(z.number().int().positive()).min(1).max(30),
        }),
        execute: (input) => this.previewTool('mark_acceptance_files_preview', 'mark-acceptance-files-preview', input),
      }),
      complete_acceptance_preview: tool({
        description: '生成完整验收包预览，一次确认验收备注、最终进展、实际工时和已有验收附件。',
        inputSchema: z.object({
          taskId: z.number().int().positive().optional(),
          taskTitle: z.string().optional(),
          acceptanceNote: z.string(),
          progressNote: z.string(),
          startDateTime: z.string().optional(),
          endDateTime: z.string().optional(),
          countTime: z.boolean().optional(),
          isRevision: z.boolean().optional(),
          attachmentIds: z.array(z.number().int().positive()).max(30).optional(),
        }),
        execute: (input) => this.previewTool('complete_acceptance_preview', 'complete-acceptance-preview', input),
      }),
    }
  }

  private async completedActionResult(pending: StoredPendingAction, result: AgentToolResponse): Promise<AliceAgentChatResult> {
    const answer = `${pending.label}已完成。\n\n${this.executionSummary(result)}`
    const task = toJsonObject(result.task)
    await this.callTool('progress-task-plan', {
      conversationId: this.activeConversationId,
      action: pending.action,
      taskId: Number(task.id) || Number(pending.draft.taskId) || undefined,
    }).catch(() => undefined)
    return {
      answer,
      model: pending.workflowId ? 'cloudflare-workflow:durable-write' : 'cloudflare-agent:deterministic-write',
      approval: {
        ...this.approvalResult(pending, 'executed'),
        result: {
          taskId: Number(task.id) || undefined,
          taskTitle: String(task.title || pending.draft.taskTitle || pending.draft.title || ''),
        },
      },
      trace: [
        { type: 'plan', label: '确认操作', detail: `读取已持久保存的${pending.label}预览。` },
        {
          type: 'tool',
          label: `执行${pending.label}`,
          detail: pending.workflowId ? 'Cloudflare Workflow 已完成持久化写入步骤。' : '使用签名确认凭证写入业务数据。',
        },
        { type: 'result', label: '写入完成', detail: '业务接口已返回成功结果。' },
      ],
    }
  }

  private async executePendingActionDirect(pending: StoredPendingAction): Promise<AliceAgentChatResult> {
    try {
      const result = await this.callTool(pending.endpoint, { confirmationToken: pending.confirmationToken })
      this.clearPendingAction()
      return await this.completedActionResult(pending, result)
    } catch (error) {
      const message = error instanceof Error ? error.message : '写入失败'
      const expired = /过期|校验失败|已失效|已使用/.test(message)
      if (expired) this.clearPendingAction()
      return {
        answer: `这次${pending.label}没有执行成功：${message}`,
        model: 'cloudflare-agent:deterministic-write',
        approval: this.approvalResult(pending, expired ? 'expired' : 'failed', message),
        trace: [{ type: 'error', label: `${pending.label}失败`, detail: message }],
      }
    }
  }

  private async executePendingAction(pending: StoredPendingAction): Promise<AliceAgentChatResult> {
    if (!pending.workflowId) return this.executePendingActionDirect(pending)
    try {
      const workflowStatus = this.getWorkflowStatus as unknown as (
        name: string,
        workflowId: string,
      ) => Promise<{ status: string; output?: unknown; error?: { message?: string } }>
      let status = await workflowStatus.call(this, 'AGENT_WRITE_WORKFLOW', pending.workflowId)
      if (status.status === 'complete') {
        this.clearPendingAction()
        return await this.completedActionResult(pending, toJsonObject(status.output))
      }
      if (status.status === 'errored' || status.status === 'terminated') {
        throw new Error(status.error?.message || '持久化写入流程未能完成')
      }
      if (!pending.workflowApproved) {
        await this.approveWorkflow(pending.workflowId, {
          reason: '用户已在 Giverny 确认卡明确确认',
          metadata: { approvedAt: Date.now() },
        })
        pending.workflowApproved = true
        this.setPendingAction(pending)
      }
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 200))
        status = await workflowStatus.call(this, 'AGENT_WRITE_WORKFLOW', pending.workflowId)
        if (status.status === 'complete') {
          this.clearPendingAction()
          return await this.completedActionResult(pending, toJsonObject(status.output))
        }
        if (status.status === 'errored' || status.status === 'terminated') {
          throw new Error(status.error?.message || '持久化写入流程未能完成')
        }
      }
      return {
        answer: `${pending.label}已经进入后台执行。Workflow 会继续完成这次操作，你可以稍后回复“确认”查看最终结果。`,
        model: 'cloudflare-workflow:durable-write',
        approval: this.approvalResult(pending, 'processing'),
        trace: [
          { type: 'plan', label: '确认操作', detail: `已确认${pending.label}。` },
          { type: 'tool', label: '启动持久化 Workflow', detail: '写入将在后台继续，并保留步骤状态。' },
        ],
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '持久化写入失败'
      const expired = /过期|校验失败|已失效|已使用/.test(message)
      if (expired) this.clearPendingAction()
      return {
        answer: `这次${pending.label}没有执行成功：${message}`,
        model: 'cloudflare-workflow:durable-write',
        approval: this.approvalResult(pending, expired ? 'expired' : 'failed', message),
        trace: [{ type: 'error', label: `${pending.label} Workflow 失败`, detail: message }],
      }
    }
  }

  private executionSummary(result: AgentToolResponse) {
    const task = toJsonObject(result.task)
    const title = String(task.title || '')
    if (title) return `任务：${title}`
    return '系统已保存本次操作，并返回成功状态。'
  }

  async reviseApproval(request: { approvalId: string; draft: Record<string, unknown> }): Promise<AliceAgentChatResult> {
    const pending = this.getPendingAction()
    if (!pending || `${pending.action}:${pending.createdAt}` !== String(request.approvalId || '')) {
      throw new Error('待确认草稿已变化或不存在，请重新生成。')
    }
    const previewName = `${pending.action}_preview`
    const config = PREVIEW_ACTIONS[previewName]
    if (!config) throw new Error('找不到对应的草稿校验工具。')
    const safeDraft = toJsonObject(request.draft)
    const data = await this.previewTool(previewName, config.previewEndpoint, {
      ...pending.draft,
      ...safeDraft,
    })
    if (data.ready !== true) {
      const missing = Array.isArray(data.missing) ? data.missing.map(String).join('、') : '必填字段'
      throw new Error(`草稿仍缺少：${missing}`)
    }
    const nextPending = this.getPendingAction()
    if (!nextPending) throw new Error('草稿更新后未生成确认状态。')
    return {
      answer: '操作草稿已更新，请再次核对后确认。',
      model: 'cloudflare-agent:approval-revision',
      approval: this.approvalResult(nextPending, 'pending'),
      trace: [
        { type: 'tool', label: `重新校验${pending.label}草稿` },
        { type: 'result', label: '草稿与确认凭证已更新' },
      ],
    }
  }

  async chat(request: AliceAgentChatRequest): Promise<AliceAgentChatResult> {
    const message = String(request.message || '').trim()
    if (!message) throw new Error('消息不能为空。')
    this.activeConversationId = String(request.conversationId || '')

    if (this.state.messageCount === 0 && Array.isArray(request.history)) {
      request.history.slice(-12).forEach((item) => {
        if ((item.role === 'user' || item.role === 'assistant') && String(item.content || '').trim()) {
          this.saveMessage(item.role, String(item.content).trim())
        }
      })
    }

    const pending = this.getPendingAction()
    this.saveMessage('user', message)

    const decision = normalizedDecision(message)
    if (pending && CONFIRM_RE.test(decision)) {
      const result = await this.executePendingAction(pending)
      this.saveMessage('assistant', result.answer, { approval: result.approval })
      return result
    }
    if (pending && REJECT_RE.test(decision)) {
      if (pending.workflowId && pending.workflowApproved) {
        const answer = `${pending.label}已经进入持久化执行阶段，当前不能再取消。请稍后回复“确认”查看结果。`
        this.saveMessage('assistant', answer, { approval: this.approvalResult(pending, 'processing') })
        return {
          answer,
          model: 'cloudflare-workflow:durable-write',
          approval: this.approvalResult(pending, 'processing'),
          trace: [{ type: 'result', label: 'Workflow 正在执行', detail: pending.label }],
        }
      }
      if (pending.workflowId) {
        await this.rejectWorkflow(pending.workflowId, { reason: '用户取消待确认操作' }).catch(() => undefined)
      }
      this.clearPendingAction()
      const answer = `已取消${pending.label}，没有写入任何数据。`
      this.saveMessage('assistant', answer, { approval: this.approvalResult(pending, 'cancelled') })
      return {
        answer,
        model: 'cloudflare-agent:approval',
        approval: this.approvalResult(pending, 'cancelled'),
        trace: [{ type: 'result', label: '已取消待确认操作', detail: pending.label }],
      }
    }

    const apiKey = String(this.aliceEnv.DEEPSEEK_API_KEY || '').trim()
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY 未配置。')
    const configuredModel = String(this.aliceEnv.DEEPSEEK_MODEL || '').trim()
    const modelName = !configuredModel || configuredModel === 'deepseek-chat' || configuredModel === 'deepseek-reasoner'
      ? 'deepseek-v4-flash'
      : configuredModel
    const provider = createOpenAICompatible({
      name: 'deepseek',
      apiKey,
      baseURL: cleanBaseUrl(this.aliceEnv.DEEPSEEK_BASE_URL, 'https://api.deepseek.com'),
      includeUsage: true,
    })

    const messages = this.recentMessages(20)
    const result = await generateText({
      model: provider(modelName),
      system: `${SYSTEM_PROMPT}\n\n当前月份：${request.currentMonth || '未知'}${pending ? `\n当前仍有一项待确认操作：${pending.label}。除非用户明确确认或取消，否则不要执行。` : ''}${request.context ? `\n\n本轮参考上下文：\n${request.context.slice(0, 10000)}` : ''}`,
      messages,
      tools: this.buildTools(request.currentMonth, request.conversationId),
      toolChoice: 'auto',
      stopWhen: stepCountIs(8),
      temperature: 0.2,
    })

    const answer = cleanAnswer(result.text) || '我已经处理了这次请求，但没有生成有效回答。'
    const trace: AliceAgentTraceItem[] = [
      { type: 'plan', label: '理解问题', detail: '结合持久会话判断是否需要读取或修改 Giverny 数据。' },
    ]
    let selection: AgentTaskSelection | undefined
    let backgroundTask: AgentBackgroundTask | undefined
    const attachmentsById = new Map<number, AgentResultAttachment>()
    for (const step of result.steps) {
      for (const call of step.toolCalls) {
        trace.push({ type: 'tool', label: agentToolTraceLabel(call.toolName, 'running') })
      }
      for (const toolResult of step.toolResults) {
        trace.push({ type: 'result', label: agentToolTraceLabel(toolResult.toolName, 'completed') })
        selection = this.taskSelection(toolResult.output) || selection
        const output = toJsonObject(toolResult.output)
        if (toolResult.toolName === 'search_attachments' || wantsAttachmentResults(message)) {
          this.resultAttachments(output).forEach((file) => attachmentsById.set(file.id, file))
        }
        const rawTask = toJsonObject(output.backgroundTask)
        if (rawTask.id && rawTask.type) {
          backgroundTask = rawTask as unknown as AgentBackgroundTask
        }
      }
    }
    const nextPending = this.getPendingAction()
    const approval = nextPending && (!pending || nextPending.createdAt !== pending.createdAt)
      ? this.approvalResult(nextPending, 'pending')
      : undefined
    const response: AliceAgentChatResult = {
      answer,
      trace: [...trace, { type: 'result' as const, label: '整理回答', detail: '将工具结果组织为可核对的结论。' }].slice(0, 10),
      model: `deepseek:${modelName}`,
      ...(approval ? { approval } : {}),
      ...(selection ? { selection } : {}),
      ...(backgroundTask ? { backgroundTask } : {}),
      ...(attachmentsById.size ? { attachments: [...attachmentsById.values()].slice(0, 30) } : {}),
    }
    this.saveMessage('assistant', answer, {
      approval,
      selection,
      backgroundTask,
      attachments: response.attachments,
      trace: response.trace.map((item) => item.detail ? `${item.label}：${item.detail}` : item.label),
    })
    return response
  }
}
