import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { Agent, type AgentContext } from 'agents'
import { generateText, stepCountIs, tool, type ModelMessage } from 'ai'
import { z } from 'zod'
import type { AgentApproval, AgentApprovalStatus } from './types/agent'

type AliceAgentEnv = Record<string, unknown> & {
  DEEPSEEK_API_KEY?: string
  DEEPSEEK_BASE_URL?: string
  DEEPSEEK_MODEL?: string
  AGENT_TOOL_TOKEN?: string
  GIVERNY_API_BASE_URL?: string
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
  role: 'user' | 'assistant'
  content: string
}

type StoredPendingAction = PendingActionSummary & {
  endpoint: string
  confirmationToken: string
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
}

const SYSTEM_PROMPT = `你是爱丽丝，也是 Giverny 的长期工作智能体。

工作规则：
- 任务、收入、金额、工时、结算、验收、附件和进展问题必须调用工具，以工具数据为准。
- 不得根据标题关键词臆测任务数量、状态、金额或工时。
- 创建任务、记录反馈、修改字段、修改状态和追加进展只能调用对应的 preview 工具。
- preview 返回后，清楚展示草稿、缺失项和风险；不要声称已经执行。
- 真正写入由运行时在用户明确确认后完成，你无法也不应自行执行写操作。
- 工具没有返回的数据必须说明缺失，不得编造。
- 先给结论，再给必要依据；语言自然、直接，不输出原始思维链或 <think> 标签。`

const PREVIEW_ACTIONS: Record<string, { executeEndpoint: string; label: string }> = {
  create_task_preview: { executeEndpoint: 'create-task', label: '创建任务' },
  record_feedback_preview: { executeEndpoint: 'record-feedback', label: '记录反馈' },
  update_task_status_preview: { executeEndpoint: 'update-task-status', label: '修改任务状态' },
  update_task_fields_preview: { executeEndpoint: 'update-task-fields', label: '修改任务字段' },
  append_progress_preview: { executeEndpoint: 'append-progress', label: '追加任务进展' },
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

function toJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export class AliceAgent extends Agent<AliceAgentEnv, AliceAgentState> {
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
        created_at INTEGER NOT NULL
      )
    `
    void this.sql`
      CREATE TABLE IF NOT EXISTS alice_pending_actions (
        singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
        action TEXT NOT NULL,
        label TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        confirmation_token TEXT NOT NULL,
        draft_json TEXT NOT NULL,
        warnings_json TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL
      )
    `
    const columns = this.sql<{ name: string }>`PRAGMA table_info(alice_pending_actions)`
    if (!columns.some((column) => column.name === 'warnings_json')) {
      void this.sql`ALTER TABLE alice_pending_actions ADD COLUMN warnings_json TEXT NOT NULL DEFAULT '[]'`
    }
  }

  private saveMessage(role: StoredMessage['role'], content: string) {
    void this.sql`
      INSERT INTO alice_messages (id, role, content, created_at)
      VALUES (${crypto.randomUUID()}, ${role}, ${content}, ${Date.now()})
    `
    this.setState({
      ...this.state,
      messageCount: this.state.messageCount + 1,
      lastActiveAt: Date.now(),
    })
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
      created_at: number
    }>`
      SELECT action, label, endpoint, confirmation_token, draft_json, warnings_json, created_at
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
      createdAt: Number(row.created_at) || Date.now(),
    }
  }

  private setPendingAction(action: StoredPendingAction) {
    void this.sql`
      INSERT INTO alice_pending_actions (
        singleton, action, label, endpoint, confirmation_token, draft_json, warnings_json, created_at
      ) VALUES (
        1, ${action.action}, ${action.label}, ${action.endpoint}, ${action.confirmationToken},
        ${JSON.stringify(action.draft)}, ${JSON.stringify(action.warnings)}, ${action.createdAt}
      )
      ON CONFLICT(singleton) DO UPDATE SET
        action = excluded.action,
        label = excluded.label,
        endpoint = excluded.endpoint,
        confirmation_token = excluded.confirmation_token,
        draft_json = excluded.draft_json,
        warnings_json = excluded.warnings_json,
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
      this.setPendingAction({
        action: action.replace(/_preview$/, ''),
        label: config.label,
        endpoint: config.executeEndpoint,
        confirmationToken,
        draft: toJsonObject(data.draft),
        warnings: Array.isArray(data.warnings) ? data.warnings.map((item) => String(item)).filter(Boolean) : [],
        createdAt: Date.now(),
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

  private buildTools(currentMonth: string | undefined) {
    return {
      query_month_finance: tool({
        description: '查询真实的月份收入、工时、计费与结算统计。',
        inputSchema: z.object({
          question: z.string(),
          currentMonth: z.string().optional(),
          months: z.string().optional(),
        }),
        execute: (input) => this.callTool('month-finance', {
          question: input.question,
          currentMonth: input.currentMonth || currentMonth,
          months: input.months,
        }, 'GET'),
      }),
      search_tasks: tool({
        description: '按月份、状态意图、任务名、需求或人员搜索任务。月份问题必须传 month。',
        inputSchema: z.object({
          query: z.string(),
          month: z.string().optional(),
          limit: z.number().int().min(1).max(50).default(30),
        }),
        execute: (input) => this.callTool('search-tasks', input, 'GET'),
      }),
      get_task_detail: tool({
        description: '按任务 ID 或近似标题读取任务详情、进展、附件与验收信息。',
        inputSchema: z.object({
          taskId: z.number().int().positive().optional(),
          title: z.string().optional(),
        }),
        execute: (input) => this.callTool('task-detail', input, 'GET'),
      }),
      get_giverny_context: tool({
        description: '读取当前 Giverny 工作台概览和能力边界。',
        inputSchema: z.object({}),
        execute: () => this.callTool('context', {}, 'GET'),
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
    }
  }

  private async executePendingAction(pending: StoredPendingAction): Promise<AliceAgentChatResult> {
    try {
      const result = await this.callTool(pending.endpoint, { confirmationToken: pending.confirmationToken })
      this.clearPendingAction()
      const answer = `${pending.label}已完成。\n\n${this.executionSummary(result)}`
      return {
        answer,
        model: 'cloudflare-agent:deterministic-write',
        approval: this.approvalResult(pending, 'executed'),
        trace: [
          { type: 'plan', label: '确认操作', detail: `读取已持久保存的${pending.label}预览。` },
          { type: 'tool', label: `执行${pending.label}`, detail: '使用签名确认凭证写入业务数据。' },
          { type: 'result', label: '写入完成', detail: '业务接口已返回成功结果。' },
        ],
      }
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

  private executionSummary(result: AgentToolResponse) {
    const task = toJsonObject(result.task)
    const title = String(task.title || '')
    if (title) return `任务：${title}`
    return '系统已保存本次操作，并返回成功状态。'
  }

  async chat(request: AliceAgentChatRequest): Promise<AliceAgentChatResult> {
    const message = String(request.message || '').trim()
    if (!message) throw new Error('消息不能为空。')

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
      this.saveMessage('assistant', result.answer)
      return result
    }
    if (pending && REJECT_RE.test(decision)) {
      this.clearPendingAction()
      const answer = `已取消${pending.label}，没有写入任何数据。`
      this.saveMessage('assistant', answer)
      return {
        answer,
        model: 'cloudflare-agent:approval',
        approval: this.approvalResult(pending, 'cancelled'),
        trace: [{ type: 'result', label: '已取消待确认操作', detail: pending.label }],
      }
    }

    const apiKey = String(this.aliceEnv.DEEPSEEK_API_KEY || '').trim()
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY 未配置。')
    const modelName = String(this.aliceEnv.DEEPSEEK_MODEL || 'deepseek-v4-flash').trim()
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
      tools: this.buildTools(request.currentMonth),
      toolChoice: 'auto',
      stopWhen: stepCountIs(8),
      temperature: 0.2,
    })

    const answer = cleanAnswer(result.text) || '我已经处理了这次请求，但没有生成有效回答。'
    const trace: AliceAgentTraceItem[] = [
      { type: 'plan', label: '理解问题', detail: '结合持久会话判断是否需要读取或修改 Giverny 数据。' },
    ]
    for (const step of result.steps) {
      for (const call of step.toolCalls) {
        trace.push({ type: 'tool', label: `调用工具：${call.toolName}` })
      }
      for (const toolResult of step.toolResults) {
        trace.push({ type: 'result', label: `工具已返回：${toolResult.toolName}` })
      }
    }
    this.saveMessage('assistant', answer)
    const nextPending = this.getPendingAction()
    const approval = nextPending && (!pending || nextPending.createdAt !== pending.createdAt)
      ? this.approvalResult(nextPending, 'pending')
      : undefined
    return {
      answer,
      trace: trace.slice(0, 10),
      model: `deepseek:${modelName}`,
      ...(approval ? { approval } : {}),
    }
  }
}
