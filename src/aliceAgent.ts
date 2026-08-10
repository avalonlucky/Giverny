import { Agent, type AgentContext } from 'agents'
import { agentCapabilityRegistry, agentCapabilityTraceLabel, agentModelCapabilityAllows, agentWritePreviewConfig, type AgentCapabilityDefinition, type AgentCapabilityName } from './agentToolRegistry'
import { type AgentDirectorDecision, type AgentDirectorPlanCall } from './agentIntentDirector'
import { runAgentProductivityGraph, type AgentProductivityCall } from './agentProductivityGraph'
import { buildAgentFactSnapshot, verifyAgentFactClaims, type AgentFactSnapshot } from './agentFactGuard'
import { completeAgentTurn, createAgentTurn, decideAgentReplan, directorDecisionToIntents, sanitizeAgentTurnAudit, type AgentEvidence, type AgentPlannedToolCall } from './agentOrchestrator'
import { normalizeAgentPrincipalContext, type AgentPrincipalContext } from './agentScope'
import type { AgentWriteWorkflowParams } from './agentWriteWorkflow'
import type { AgentApproval, AgentApprovalStatus, AgentBackgroundTask, AgentConversationMessage, AgentResultAttachment, AgentTaskSelection, AgentUploadHandoff } from './types/agent'
import { cleanAnswer, isAgentReadToolName, normalizedDecision, parseJsonObject, toJsonObject } from './agentUtils'
import { phoneticEditDistance } from './chineseFuzzy'
import { callAgentTool, executeRepairTool, repairToolInput, type AgentToolClientConfig, type AgentToolResponse } from './agentToolClient'
import { buildApprovalResult, buildExecutionSummary, CONFIRM_RE, REJECT_RE, isPendingActionExpired, pollWorkflowWithBackoff, type PendingActionSummary, type StoredPendingAction } from './agentApprovalFlow'
import { detectTaskEvidenceMismatch, extractResultAttachments, extractTaskReference, extractTaskReferences, extractTaskSelection, isTaskScopedTool, referencesCurrentTask, resolveTaskInput, type TaskReference } from './agentTaskContext'

/** 类型安全的能力注册表查找——消除重复的 as AgentCapabilityName 断言 */
function lookupCapability(name: string): AgentCapabilityDefinition | undefined {
  return agentCapabilityRegistry[name as AgentCapabilityName]
}

type AliceAgentEnv = Record<string, unknown> & {
  AGENT_TOOL_TOKEN?: string
  GIVERNY_API_BASE_URL?: string
  AGENT_WRITE_WORKFLOW?: unknown
}

type AliceAgentState = {
  messageCount: number
  lastActiveAt: number | null
  pendingAction: PendingActionSummary | null
  taskReference: TaskReference | null
}

type StoredMessage = {
  id?: string
  role: 'user' | 'assistant'
  content: string
  metadata_json?: string
  created_at?: number
}

export type AliceAgentChatRequest = {
  message: string
  currentMonth?: string
  conversationId?: string
  history?: StoredMessage[]
  context?: string
  principal?: AgentPrincipalContext
  orchestration: {
    decision: AgentDirectorDecision
    calls: AgentDirectorPlanCall[]
    allowedCapabilities: AgentCapabilityName[]
    directAnswer?: string
    modelLabel: string
    graph: {
      path: string[]
      modelCalls: number
      deniedCount: number
    }
  }
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
  uploadHandoff?: AgentUploadHandoff
  agentTurn?: ReturnType<typeof sanitizeAgentTurnAudit> & { evidenceCount?: number }
  factVerification?: {
    passed: boolean
    checkedClaims: number
    sourceTools: string[]
    fallbackUsed: boolean
  }
  grounding?: AgentFactSnapshot
  productivity?: {
    engine: 'langgraph'
    status: 'complete' | 'needs_input' | 'failed'
    path: string[]
    cycles: number
    toolCalls: number
    reason: string
  }
}









function agentToolTraceLabel(toolName: string, phase: 'running' | 'completed') {
  return `${agentCapabilityTraceLabel(toolName, phase)} [tool:${toolName}]`
}

export class AliceAgent extends Agent<AliceAgentEnv, AliceAgentState> {
  private activeConversationId = ''
  private activePrincipal = normalizeAgentPrincipalContext({ role: 'system' })
  private activeTaskReference: TaskReference | null = null
  private readonly aliceEnv: AliceAgentEnv

  constructor(ctx: AgentContext, env: AliceAgentEnv) {
    super(ctx, env)
    this.aliceEnv = env
  }

  initialState: AliceAgentState = {
    messageCount: 0,
    lastActiveAt: null,
    pendingAction: null,
    taskReference: null,
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
    void this.sql`
      CREATE TABLE IF NOT EXISTS alice_graph_checkpoints (
        id TEXT PRIMARY KEY,
        turn_id TEXT NOT NULL,
        phase TEXT NOT NULL CHECK(phase IN ('planned', 'completed')),
        state_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `
    void this.sql`
      CREATE INDEX IF NOT EXISTS idx_alice_graph_checkpoints_turn
      ON alice_graph_checkpoints(turn_id, created_at DESC)
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

  private saveGraphCheckpoint(turnId: string, phase: 'planned' | 'completed', state: Record<string, unknown>) {
    const checkpoint = {
      schemaVersion: 1,
      phase,
      ...state,
    }
    void this.sql`
      INSERT OR REPLACE INTO alice_graph_checkpoints (id, turn_id, phase, state_json, created_at)
      VALUES (${`${turnId}:${phase}`}, ${turnId}, ${phase}, ${JSON.stringify(checkpoint)}, ${Date.now()})
    `
    void this.sql`
      DELETE FROM alice_graph_checkpoints
      WHERE id NOT IN (SELECT id FROM alice_graph_checkpoints ORDER BY created_at DESC LIMIT 200)
    `
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
    void this.sql`DELETE FROM alice_graph_checkpoints`
    this.setState({ ...this.initialState })
    this.activeTaskReference = null
    return { cleared: true }
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

  private get toolClientConfig(): AgentToolClientConfig {
    return { baseUrl: this.aliceEnv.GIVERNY_API_BASE_URL, token: this.aliceEnv.AGENT_TOOL_TOKEN, principal: this.activePrincipal }
  }

  private async callTool(endpoint: string, input: Record<string, unknown>, method: 'GET' | 'POST' = 'POST') {
    return callAgentTool(this.toolClientConfig, endpoint, input, method)
  }

  private async previewTool(action: string, endpoint: string, input: Record<string, unknown>) {
    const data = await this.callTool(endpoint, input)
    const config = agentWritePreviewConfig(action)
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
          principal: this.activePrincipal,
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
    return buildApprovalResult(pending, status, error)
  }

  private taskSelection(value: unknown): AgentTaskSelection | undefined {
    return extractTaskSelection(value)
  }

  private selectedTaskReference(message: string): TaskReference | null {
    return extractTaskReference(message)
  }

  private setTaskReference(reference: TaskReference | null) {
    this.activeTaskReference = reference
    this.setState({ ...this.state, taskReference: reference })
  }

  private withTaskReference(input: Record<string, unknown>, message: string) {
    return resolveTaskInput(input, message, this.activeTaskReference || this.state.taskReference)
  }

  private taskReferencesFromResult(value: unknown) {
    return extractTaskReferences(value)
  }

  private taskEvidenceMismatch(toolName: string, input: Record<string, unknown>, output: unknown) {
    return detectTaskEvidenceMismatch(toolName, input, output)
  }

  private isTaskScopedTool(toolName: string) {
    return isTaskScopedTool(toolName)
  }

  private repairToolInput(toolName: Parameters<typeof repairToolInput>[0], message: string, currentMonth?: string): Record<string, unknown> | null {
    return repairToolInput(toolName, message, currentMonth, this.activeTaskReference || this.state.taskReference, (msg) => referencesCurrentTask(msg))
  }

  private async executeRepairTool(toolName: Parameters<typeof executeRepairTool>[1], input: Record<string, unknown>) {
    return executeRepairTool(this.toolClientConfig, toolName, input)
  }

  private resultAttachments(value: unknown): AgentResultAttachment[] {
    return extractResultAttachments(value)
  }

  private async completedActionResult(pending: StoredPendingAction, result: AgentToolResponse): Promise<AliceAgentChatResult> {
    const task = toJsonObject(result.task)
    const attachments = this.resultAttachments(result)
    const postcondition = toJsonObject(result.postcondition)
    const independentlyVerified = postcondition.passed === true
    if (pending.workflowId && !independentlyVerified) {
      const failedChecks = Array.isArray(postcondition.checks)
        ? postcondition.checks
            .map((item) => toJsonObject(item))
            .filter((item) => item.passed !== true)
            .map((item) => String(item.name || '').trim())
            .filter(Boolean)
        : []
      const detail = failedChecks.length ? `未通过项：${failedChecks.join('、')}` : '未获得可核对的独立验收结果。'
      await this.callTool('progress-task-plan', {
        conversationId: this.activeConversationId,
        action: pending.action,
        taskId: Number(task.id) || Number(pending.draft.taskId) || undefined,
        outcome: 'failed',
        error: `写入后独立验收未通过：${failedChecks.join('、') || 'missing-verification'}`,
      }).catch(() => undefined)
      return {
        answer: `写入接口已返回，但独立验收未通过，暂不标记为完成。\n\n${detail}\n\n我已停止后续计划推进，请在复核业务数据后再继续。`,
        model: 'cloudflare-workflow:durable-write',
        approval: this.approvalResult(pending, 'failed', detail),
        ...(attachments.length ? { attachments } : {}),
        trace: [
          { type: 'plan', label: '确认操作', detail: `读取已持久保存的${pending.label}预览。` },
          { type: 'tool', label: `执行${pending.label}`, detail: 'Cloudflare Workflow 已完成业务写入步骤。' },
          { type: 'error', label: '独立验收失败', detail },
        ],
      }
    }
    const answer = `${pending.label}已完成。\n\n${this.executionSummary(result)}`
    await this.callTool('progress-task-plan', {
      conversationId: this.activeConversationId,
      action: pending.action,
      taskId: Number(task.id) || Number(pending.draft.taskId) || undefined,
      outcome: 'completed',
    }).catch(() => undefined)
    return {
      answer,
      model: pending.workflowId ? 'cloudflare-workflow:durable-write' : 'cloudflare-agent:deterministic-write',
      approval: {
        ...this.approvalResult(pending, 'executed'),
        result: {
          taskId: Number(task.id) || undefined,
          taskTitle: String(task.title || pending.draft.taskTitle || pending.draft.title || ''),
          verification: {
            passed: pending.workflowId ? independentlyVerified : true,
            checks: Array.isArray(postcondition.checks) ? postcondition.checks.length : 0,
          },
        },
      },
      ...(attachments.length ? { attachments } : {}),
      trace: [
        { type: 'plan', label: '确认操作', detail: `读取已持久保存的${pending.label}预览。` },
        {
          type: 'tool',
          label: `执行${pending.label}`,
          detail: pending.workflowId ? '已按确认内容完成业务写入。' : '已通过确认校验并写入业务数据。',
        },
        {
          type: 'result',
          label: pending.workflowId ? '独立验收通过' : '写入完成',
          detail: pending.workflowId ? '已重新读取业务数据，写入结果与确认内容一致。' : '业务接口已返回成功结果。',
        },
      ],
    }
  }

  private async executePendingActionDirect(pending: StoredPendingAction): Promise<AliceAgentChatResult> {
    try {
      await this.callTool('progress-task-plan', {
        conversationId: this.activeConversationId,
        action: pending.action,
        taskId: Number(pending.draft.taskId) || undefined,
        outcome: 'started',
      }).catch(() => undefined)
      const result = await this.callTool(pending.endpoint, { confirmationToken: pending.confirmationToken })
      this.clearPendingAction()
      return await this.completedActionResult(pending, result)
    } catch (error) {
      const message = error instanceof Error ? error.message : '写入失败'
      await this.callTool('progress-task-plan', {
        conversationId: this.activeConversationId,
        action: pending.action,
        taskId: Number(pending.draft.taskId) || undefined,
        outcome: 'failed',
        error: message,
      }).catch(() => undefined)
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
    const highRisk = toJsonObject(pending.draft.highRisk)
    if (highRisk.caseId && pending.draft.__highRiskAcknowledged !== true) {
      await this.callTool('acknowledge-high-risk-action', { caseId: highRisk.caseId, evidenceChecksum: highRisk.evidenceChecksum })
      pending.draft.__highRiskAcknowledged = true
      this.setPendingAction(pending)
      return {
        answer: `已记录第一重风险确认。${String(highRisk.reason || '这是高风险操作')} 请再次回复“确认”后才会真正执行；在此之前仍可取消。`,
        model: 'cloudflare-agent:risk-approval',
        approval: this.approvalResult(pending, 'pending'),
        trace: [
          { type: 'plan', label: '高风险第一重确认', detail: `证据案件 ${String(highRisk.caseId)} 已锁定。` },
          { type: 'result', label: '等待第二重确认', detail: '尚未写入业务数据，可取消。' },
        ],
      }
    }
    if (!pending.workflowId) return this.executePendingActionDirect(pending)
    try {
      const workflowStatus = this.getWorkflowStatus as unknown as (
        name: string,
        workflowId: string,
      ) => Promise<{ status: string; output?: unknown; error?: { message?: string } }>
      const status = await workflowStatus.call(this, 'AGENT_WRITE_WORKFLOW', pending.workflowId)
      if (status.status === 'complete') {
        this.clearPendingAction()
        return await this.completedActionResult(pending, toJsonObject(status.output))
      }
      if (status.status === 'errored' || status.status === 'terminated') {
        throw new Error(status.error?.message || '持久化写入流程未能完成')
      }
      if (!pending.workflowApproved) {
        await this.callTool('progress-task-plan', {
          conversationId: this.activeConversationId,
          action: pending.action,
          taskId: Number(pending.draft.taskId) || undefined,
          outcome: 'started',
        }).catch(() => undefined)
        await this.approveWorkflow(pending.workflowId, {
          reason: '用户已在 Giverny 确认卡明确确认',
          metadata: { approvedAt: Date.now() },
        })
        pending.workflowApproved = true
        this.setPendingAction(pending)
      }
      const pollResult = await pollWorkflowWithBackoff(pending.workflowId, {
        getStatus: (id) => workflowStatus.call(this, 'AGENT_WRITE_WORKFLOW', id),
        maxAttempts: 30,
        initialDelayMs: 200,
        maxDelayMs: 2000,
      })
      if (pollResult.status === 'complete') {
        this.clearPendingAction()
        return await this.completedActionResult(pending, toJsonObject(pollResult.output))
      }
      if (pollResult.status === 'errored' || pollResult.status === 'terminated') {
        throw new Error(pollResult.error?.message || '持久化写入流程未能完成')
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
      await this.callTool('progress-task-plan', {
        conversationId: this.activeConversationId,
        action: pending.action,
        taskId: Number(pending.draft.taskId) || undefined,
        outcome: 'failed',
        error: message,
      }).catch(() => undefined)
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
    return buildExecutionSummary(result)
  }

  async reviseApproval(request: { approvalId: string; draft: Record<string, unknown> }): Promise<AliceAgentChatResult> {
    const pending = this.getPendingAction()
    if (!pending || `${pending.action}:${pending.createdAt}` !== String(request.approvalId || '')) {
      throw new Error('待确认草稿已变化或不存在，请重新生成。')
    }
    const previewName = `${pending.action}_preview`
    const config = agentWritePreviewConfig(previewName)
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

  private async executeDirectedCapability(
    name: AgentCapabilityName,
    args: Record<string, unknown>,
    request: AliceAgentChatRequest,
    message: string,
  ) {
    const capability = lookupCapability(name)
    if (!capability) throw new Error(`未注册的能力：${name}`)
    const parsed = capability.inputSchema.safeParse(args)
    if (!parsed.success) throw new Error(`${capability.title}的参数未通过校验`)
    let input = toJsonObject(parsed.data)
    if (capability.taskScoped) input = this.withTaskReference(input, message)
    if (name === 'query_month_finance') input = { ...input, question: input.question || message, currentMonth: input.currentMonth || request.currentMonth }
    if (name === 'query_task_portfolio' && !input.month && !input.startDate && !input.endDate) input = { ...input, month: request.currentMonth }
    if (name === 'create_task_preview') input = { ...input, currentMonth: request.currentMonth }
    if (name === 'create_task_plan') input = { ...input, conversationId: request.conversationId }
    if (name === 'start_monthly_review' || name === 'start_deep_analysis') {
      input = { ...input, month: input.month || request.currentMonth, conversationId: request.conversationId }
    }
    if (capability.policy.confirmation === 'preview') return this.previewTool(name, capability.endpoint, input)
    const method = capability.methods.includes('POST') ? 'POST' : 'GET'
    return this.callTool(capability.endpoint, input, method)
  }

  async chat(request: AliceAgentChatRequest): Promise<AliceAgentChatResult> {
    const message = String(request.message || '').trim()
    if (!message) throw new Error('消息不能为空。')
    this.activeConversationId = String(request.conversationId || '')
    this.activePrincipal = normalizeAgentPrincipalContext(request.principal)
    let agentTurn = createAgentTurn({ principal: this.activePrincipal, question: message })

    if (this.state.messageCount === 0 && Array.isArray(request.history)) {
      request.history.slice(-12).forEach((item) => {
        if ((item.role === 'user' || item.role === 'assistant') && String(item.content || '').trim()) {
          this.saveMessage(item.role, String(item.content).trim())
        }
      })
    }

    let pending = this.getPendingAction()
    if (pending && isPendingActionExpired(pending)) {
      this.clearPendingAction()
      pending = null
    }
    this.saveMessage('user', message)
    this.saveGraphCheckpoint(agentTurn.id, 'planned', {
      path: request.orchestration.graph.path,
      modelCalls: request.orchestration.graph.modelCalls,
      operationNames: request.orchestration.calls.map((call) => call.name),
      deniedCount: request.orchestration.graph.deniedCount,
    })
    const selectedReference = this.selectedTaskReference(message)
    this.activeTaskReference = selectedReference || this.state.taskReference || null
    if (selectedReference) this.setTaskReference(selectedReference)

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

    const allowed = new Set(request.orchestration.allowedCapabilities)
    const calls = request.orchestration.calls.filter((call) => {
      const name = call.name as AgentCapabilityName
      if (!allowed.has(name) || !agentModelCapabilityAllows(name, this.activePrincipal.role)) return false
      if ((name === 'search_product_help' || name === 'get_giverny_context') && !request.orchestration.decision.requiresProductKnowledge) return false
      if (name === 'search_workspace' && !request.orchestration.decision.domains.includes('workspace_search')) return false
      return true
    })
    const initialCalls: AgentProductivityCall[] = calls.map((call) => ({ ...call, attempt: 1 }))
    const productivity = await runAgentProductivityGraph({
      execute: async (call, context) => {
        const startedAt = Date.now()
        const name = call.name as AgentCapabilityName
        let effectiveArgs = call.args
        const capability = agentCapabilityRegistry[name] as AgentCapabilityDefinition
        if (capability.taskScoped && !Number(effectiveArgs.taskId) && !String(effectiveArgs.taskTitle || effectiveArgs.title || '').trim()) {
          const previousOutput = context.observations.at(-1)?.output
          const references = this.taskReferencesFromResult(previousOutput)
          if (references.length === 1 || (references.length > 1 && /(?:最近|最新|第一个|第一条)/.test(message))) {
            effectiveArgs = { ...effectiveArgs, taskId: references[0].id }
          }
        }
        if (name === 'reconcile_settlement_export' && !String(effectiveArgs.exportId || '').trim() && !String(effectiveArgs.startDate || '').trim()) {
          const exportObservation = [...context.observations].reverse().find((item) => item.deterministic && item.call.name === 'query_settlement_exports')
          const exportPayload = toJsonObject(exportObservation?.output)
          const recentExport = toJsonObject(Array.isArray(exportPayload.records) ? exportPayload.records[0] : null)
          if (recentExport.id) effectiveArgs = { exportId: String(recentExport.id) }
        }
        try {
          const output = call.attempt && call.attempt > 1 && isAgentReadToolName(name)
            ? await this.executeRepairTool(name, effectiveArgs)
            : await this.executeDirectedCapability(name, effectiveArgs, request, message)
          const record = toJsonObject(output)
          const mismatch = this.taskEvidenceMismatch(name, effectiveArgs, record)
          const halt = record.needsDisambiguation === true
            ? 'selection' as const
            : record.ready === false && Array.isArray(record.missing)
              ? 'needs_input' as const
              : undefined
          return {
            call: { ...call, args: effectiveArgs },
            output,
            deterministic: !mismatch,
            ...(mismatch ? { error: mismatch } : {}),
            ...(halt ? { halt } : {}),
            durationMs: Date.now() - startedAt,
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          return {
            call: { ...call, args: effectiveArgs },
            output: { error: errorMessage, toolFailed: true },
            deterministic: false,
            error: errorMessage,
            durationMs: Date.now() - startedAt,
          }
        }
      },
      observe: (observations, cycle) => {
        const latest = observations.at(-1)
        if (latest?.halt === 'selection') return { status: 'needs_input', requiredTools: [], reason: '需要用户选择明确任务。' }
        if (latest?.halt === 'needs_input') return { status: 'needs_input', requiredTools: [], reason: '写入草稿需要用户补充必填字段。' }
        const observedTools = new Set(observations.map((item) => item.call.name))
        const toolIntent = observedTools.has('query_month_finance') || observedTools.has('generate_settlement_receipt')
          ? 'finance' : observedTools.has('get_requester_profile') ? 'person_profile'
          : observedTools.has('search_attachments') ? 'attachment'
          : [...observedTools].some((n) => n.endsWith('_preview')) ? 'write'
          : observedTools.has('get_task_detail') || observedTools.has('search_tasks') || observedTools.has('resolve_workspace_subject') || observedTools.has('query_task_portfolio') || observedTools.has('query_plan_continuation') ? 'task_data'
          : observedTools.has('search_product_help') ? 'product_help' : 'general'
        const directorIntents = [...new Set([...directorDecisionToIntents(request.orchestration.decision), toolIntent as import('./agentOrchestrator').AgentIntent])]
        const observedPlan: AgentPlannedToolCall[] = observations.map((item, index) => ({
          id: `${agentTurn.id}:graph:${index + 1}`,
          name: item.call.name,
          args: item.call.args,
          reason: item.call.reason,
          risk: lookupCapability(item.call.name)?.policy.risk || 'read',
          confirmation: lookupCapability(item.call.name)?.policy.confirmation || 'none',
          status: item.error ? 'failed' : 'success',
          attempt: item.call.attempt || cycle,
          error: item.error,
          durationMs: item.durationMs,
        }))
        const observedEvidence: AgentEvidence[] = observations.map((item, index) => ({
          id: `${agentTurn.id}:graph-evidence:${index + 1}`,
          toolCallId: observedPlan[index].id,
          toolName: item.call.name,
          source: lookupCapability(item.call.name)?.policy.source === 'product_registry'
            ? 'product_registry'
            : lookupCapability(item.call.name)?.policy.source === 'web'
              ? 'web'
              : lookupCapability(item.call.name)?.policy.source === 'r2' ? 'r2' : 'd1',
          deterministic: item.deterministic,
          payload: item.output,
        }))
        const checked = completeAgentTurn({
          ...agentTurn,
          intent: directorIntents[0],
          phase: 'analyze',
          plan: observedPlan,
          evidence: observedEvidence,
          attempts: cycle,
        }, '', directorIntents)
        const replan = decideAgentReplan(checked)
        // Reflexion 触发：工具返回找不到但有候选项时，触发 replan 自动纠错
        const hasNotFoundWithCandidates = observations.some((obs) => {
          if (obs.error) return false
          const out = obs.output && typeof obs.output === 'object' ? obs.output as Record<string, unknown> : {}
          const candidates = Array.isArray(out.closeCandidates) ? out.closeCandidates : []
          return out.found === false && candidates.length > 0
        })
        if (hasNotFoundWithCandidates) {
          const failedTools = observations.filter((obs) => {
            const out = obs.output && typeof obs.output === 'object' ? obs.output as Record<string, unknown> : {}
            return out.found === false && Array.isArray(out.closeCandidates) && (out.closeCandidates as unknown[]).length > 0
          }).map((obs) => obs.call.name)
          return { status: 'replan', requiredTools: [...new Set(failedTools)], reason: '工具未找到匹配结果，但有音近候选项，尝试自动纠错。' }
        }
        if (checked.verification.passed) return { status: 'complete', requiredTools: [], reason: '目标所需的确定性证据已齐全。' }
        if (replan.shouldReplan) return { status: 'replan', requiredTools: replan.requiredTools, reason: replan.reason }
        const failed = observations.some((item) => item.error)
        return { status: failed ? 'failed' : 'needs_input', requiredTools: replan.requiredTools, reason: replan.reason || '需要用户补充信息。' }
      },
      replan: async (decision, observations, cycle) => {
        const replanned: AgentProductivityCall[] = []
        // === Reflexion：工具返回"找不到"但有候选项时，自动用音近匹配修正 ===
        for (const obs of observations) {
          if (obs.error) continue
          const output = obs.output && typeof obs.output === 'object' ? obs.output as Record<string, unknown> : {}
          const candidates = Array.isArray(output.closeCandidates) ? output.closeCandidates as string[] : []
          if (output.found === false && candidates.length > 0 && obs.call.args && typeof obs.call.args === 'object') {
            const args = obs.call.args as Record<string, unknown>
            const originalName = String(args.name || args.query || args.title || '').trim()
            if (originalName) {
              let bestCandidate = ''
              let bestDistance = Infinity
              for (const candidate of candidates) {
                const distance = phoneticEditDistance(originalName, String(candidate))
                if (distance < bestDistance) { bestDistance = distance; bestCandidate = String(candidate) }
              }
              const threshold = Math.max(1.5, originalName.length * 0.5)
              if (bestCandidate && bestDistance <= threshold && bestDistance > 0) {
                const correctedArgs = { ...args }
                if (args.name !== undefined) correctedArgs.name = bestCandidate
                if (args.query !== undefined) correctedArgs.query = bestCandidate
                if (args.title !== undefined) correctedArgs.title = bestCandidate
                replanned.push({ name: obs.call.name, args: correctedArgs, reason: `Reflexion 纠错："${originalName}"→"${bestCandidate}"（音近距离 ${bestDistance.toFixed(1)}）`, attempt: cycle + 1 })
                continue
              }
            }
          }
          // 搜索结果为空但有 closeCandidates 时也尝试修正
          const results = Array.isArray(output.results) ? output.results : []
          if (results.length === 0 && candidates.length > 0 && obs.call.args && typeof obs.call.args === 'object') {
            const args = obs.call.args as Record<string, unknown>
            const originalQuery = String(args.query || args.name || args.title || '').trim()
            if (originalQuery) {
              let bestCandidate = ''
              let bestDistance = Infinity
              for (const candidate of candidates) {
                const distance = phoneticEditDistance(originalQuery, String(candidate))
                if (distance < bestDistance) { bestDistance = distance; bestCandidate = String(candidate) }
              }
              const threshold = Math.max(1.5, originalQuery.length * 0.5)
              if (bestCandidate && bestDistance <= threshold && bestDistance > 0) {
                const correctedArgs = { ...args }
                if (args.query !== undefined) correctedArgs.query = bestCandidate
                if (args.name !== undefined) correctedArgs.name = bestCandidate
                if (args.title !== undefined) correctedArgs.title = bestCandidate
                replanned.push({ name: obs.call.name, args: correctedArgs, reason: `Reflexion 纠错："${originalQuery}"→"${bestCandidate}"`, attempt: cycle + 1 })
              }
            }
          }
        }
        if (replanned.length > 0) return replanned
        // === 原有 replan 逻辑 ===
        for (const toolName of decision.requiredTools.filter(isAgentReadToolName)) {
          if (!agentModelCapabilityAllows(toolName, this.activePrincipal.role)) continue
          let input = this.repairToolInput(toolName, message, request.currentMonth)
          if (!input) {
            const parsedDefaults = agentCapabilityRegistry[toolName].inputSchema.safeParse({})
            if (parsedDefaults.success) input = parsedDefaults.data as Record<string, unknown>
          }
          if (toolName === 'get_task_detail' && !input) {
            const searchObservation = [...observations].reverse().find((item) => item.deterministic && item.call.name === 'search_tasks')
            const searchResult = toJsonObject(searchObservation?.output)
            const results = Array.isArray(searchResult.results) ? searchResult.results : []
            const first = results[0]
            const taskId = Number(toJsonObject(first).id)
            if (results.length === 1 && Number.isInteger(taskId) && taskId > 0) input = { taskId }
          }
          if (!input && toolName === 'get_task_detail' && /(?:最近|最新|上一条|上一个)/.test(message)) {
            const searchObservation = [...observations].reverse().find((item) => item.deterministic && item.call.name === 'search_tasks')
            const searchResult = toJsonObject(searchObservation?.output)
            const taskId = Number(toJsonObject(Array.isArray(searchResult.results) ? searchResult.results[0] : null).id)
            if (Number.isInteger(taskId) && taskId > 0) input = { taskId }
          }
          if (input) replanned.push({ name: toolName, args: input, reason: decision.reason, attempt: cycle + 1 })
        }
        return replanned
      },
    }, initialCalls)
    const result = {
      steps: productivity.observations.map((observation) => ({
        toolCalls: [{ toolName: observation.call.name, input: observation.call.args, attempt: observation.call.attempt || 1, durationMs: observation.durationMs }],
        toolResults: [{ toolName: observation.call.name, output: observation.output }],
      })),
    }
    let answer = cleanAnswer(request.orchestration.directAnswer || '') || (calls.length ? '已完成必要的业务处理。' : '请再具体说明你希望我处理的事情。')
    const trace: AliceAgentTraceItem[] = request.orchestration.decision.rationale
      ? [{ type: 'plan' as const, label: '思考', detail: request.orchestration.decision.rationale }]
      : []
    let selection: AgentTaskSelection | undefined
    let backgroundTask: AgentBackgroundTask | undefined
    let uploadHandoff: AgentUploadHandoff | undefined
    let factVerificationSummary: AliceAgentChatResult['factVerification']
    const attachmentsById = new Map<number | string, AgentResultAttachment>()
    const usedTools = new Set<string>()
    const plannedCalls: AgentPlannedToolCall[] = []
    const evidence: AgentEvidence[] = []
    for (const step of result.steps) {
      for (const call of step.toolCalls) {
        const rawInput = toJsonObject(call.input)
        const effectiveInput = this.isTaskScopedTool(call.toolName) ? this.withTaskReference(rawInput, message) : rawInput
        plannedCalls.push({
          id: `${agentTurn.id}:tool:${plannedCalls.length + 1}`,
          name: call.toolName,
          args: effectiveInput,
          reason: '由主模型结合完整语义规划。',
          risk: lookupCapability(call.toolName)?.policy.risk || 'read',
          confirmation: lookupCapability(call.toolName)?.policy.confirmation || 'none',
          status: 'pending',
          attempt: call.attempt,
          durationMs: call.durationMs,
        })
        trace.push({ type: 'tool', label: agentToolTraceLabel(call.toolName, 'running') })
      }
      for (const toolResult of step.toolResults) {
        usedTools.add(toolResult.toolName)
        selection = this.taskSelection(toolResult.output) || selection
        const output = toJsonObject(toolResult.output)
        const rawHandoff = toJsonObject(output.handoff)
        if (toolResult.toolName === 'prepare_attachment_upload' && Number(rawHandoff.taskId) > 0) {
          uploadHandoff = rawHandoff as unknown as AgentUploadHandoff
        }
        if (toolResult.toolName === 'search_product_help') {
          const matches = Array.isArray(output.matches) ? output.matches.map(toJsonObject) : []
          const titles = matches.slice(0, 3).map((item) => String(item.title || '')).filter(Boolean)
          trace.push({
            type: 'result',
            label: '找到官方产品依据',
            detail: titles.length ? titles.map((title) => `《${title}》`).join('、') : '产品知识库没有找到足够明确的记录。',
          })
        } else if (output.ready === false && Array.isArray(output.missing)) {
          const missing = output.missing.map(String).filter(Boolean)
          trace.push({ type: 'result', label: '草稿信息不完整', detail: missing.length ? `还缺少 ${missing.join('、')}，暂不生成确认操作。` : '需要补充必要信息。' })
          const labels: Record<string, string> = { title: '任务名称', requirement: '具体需求', startDate: '预计开始时间', estimatedDate: '预计交付时间', estimatedHours: '预估工时' }
          const fields = missing.map((field) => labels[field] || field)
          answer = `可以，我已经进入${String(lookupCapability(toolResult.toolName)?.title || '操作')}流程。请补充${fields.length ? fields.join('、') : '必要信息'}，我会继续生成可确认的草稿。`
        } else {
          trace.push({ type: 'result', label: agentToolTraceLabel(toolResult.toolName, 'completed') })
        }
        const planned = [...plannedCalls].reverse().find((item) => item.name === toolResult.toolName && item.status === 'pending')
        const toolError = output.toolFailed === true ? String(output.error || '工具执行失败') : ''
        const mismatch = toolError || (planned ? this.taskEvidenceMismatch(toolResult.toolName, planned.args, output) : '')
        evidence.push({
          id: `${agentTurn.id}:evidence:${evidence.length + 1}`,
          toolCallId: planned?.id || `${agentTurn.id}:tool:unknown`,
          toolName: toolResult.toolName,
          source: lookupCapability(toolResult.toolName)?.policy.source === 'product_registry'
            ? 'product_registry'
            : lookupCapability(toolResult.toolName)?.policy.source === 'web'
              ? 'web'
              : lookupCapability(toolResult.toolName)?.policy.source === 'r2' ? 'r2' : 'd1',
          deterministic: !mismatch,
          payload: output,
        })
        if (planned) {
          planned.status = mismatch ? 'failed' : 'success'
          if (mismatch) planned.error = mismatch
        }
        if (mismatch) {
          answer = `这次工具返回的任务与当前选中任务不一致，我已停止采用该结果。${mismatch}。`
          trace.push({ type: 'error', label: toolError ? '工具执行未完成' : '任务证据不一致', detail: mismatch })
        } else {
          const references = this.taskReferencesFromResult(output)
          if (references.length === 1) this.setTaskReference(references[0])
        }
        this.resultAttachments(output).forEach((file) => attachmentsById.set(file.id, file))
        const rawTask = toJsonObject(output.backgroundTask)
        if (rawTask.id && rawTask.type) {
          backgroundTask = rawTask as unknown as AgentBackgroundTask
        }
      }
    }
    const finalToolIntent = usedTools.has('query_month_finance') || usedTools.has('generate_settlement_receipt')
      ? 'finance' : usedTools.has('get_requester_profile') ? 'person_profile'
      : usedTools.has('search_attachments') ? 'attachment'
      : [...usedTools].some((n) => n.endsWith('_preview')) ? 'write'
      : usedTools.has('get_task_detail') || usedTools.has('search_tasks') || usedTools.has('resolve_workspace_subject') || usedTools.has('query_task_portfolio') || usedTools.has('query_plan_continuation') ? 'task_data'
      : usedTools.has('search_product_help') ? 'product_help' : 'general'
    const verifiedIntents = [...new Set([...directorDecisionToIntents(request.orchestration.decision), finalToolIntent as import('./agentOrchestrator').AgentIntent])]
    const verifiedIntent = verifiedIntents[0]
    if (verifiedIntents.length > 1) {
      trace.push({ type: 'plan', label: `拆解 ${verifiedIntents.length} 个目标`, detail: verifiedIntents.join('、') })
    }
    let workingTurn = { ...agentTurn, intent: verifiedIntent, phase: 'analyze' as const, plan: plannedCalls, evidence, attempts: productivity.cycles, answer }
    if (productivity.path.includes('replan')) {
      trace.push({ type: 'plan', label: '验真后动态补查', detail: `${productivity.decision.reason}；执行 ${productivity.cycles} 轮、${productivity.toolCalls} 次工具。` })
    }
    if (productivity.decision.status === 'failed') {
      trace.push({ type: 'error', label: '生产力闭环未完成', detail: productivity.decision.reason })
    }
    const deterministicEvidence = evidence.filter((item) => item.deterministic)
    const factSnapshot = buildAgentFactSnapshot(deterministicEvidence)
    const shouldGroundAnswer = !selection && !backgroundTask && factSnapshot.sections.length > 0
    if (shouldGroundAnswer) {
      if (factSnapshot.fallbackAnswer) {
        answer = factSnapshot.fallbackAnswer
        const factVerification = verifyAgentFactClaims(answer, factSnapshot)
        trace.push(factVerification.passed
          ? { type: 'result', label: '结构化事实协议生成答案', detail: `核对 ${factVerification.checkedClaims} 条声明，覆盖 ${factVerification.coveredSources.join('、')}。` }
          : { type: 'error', label: '结构化事实协议校验失败', detail: factVerification.issues.slice(0, 3).join('；') })
        factVerificationSummary = {
          passed: factVerification.passed,
          checkedClaims: factVerification.checkedClaims,
          sourceTools: factVerification.coveredSources,
          fallbackUsed: !factVerification.passed,
        }
        if (!factVerification.passed) answer = '工具数据已返回，但最终答案未通过结构化事实校验。我已停止输出未验证内容，请重试。'
      } else {
        answer = '工具返回的数据尚未接入结构化事实协议，我已停止采用模型初稿。'
        factVerificationSummary = { passed: false, checkedClaims: 0, sourceTools: [], fallbackUsed: true }
        trace.push({ type: 'error', label: '结构化事实协议缺少工具渲染器' })
      }
      workingTurn = { ...workingTurn, plan: plannedCalls, evidence, answer }
    }
    if (/卡在|卡点|等待|为什么.*(?:没|未).*交付|延期/.test(message)) {
      const detailEvidence = [...evidence].reverse().find((item) => item.deterministic && item.toolName === 'get_task_detail')
      const detail = toJsonObject(detailEvidence?.payload)
      const task = toJsonObject(detail.task)
      const waitingRecords = Array.isArray(detail.waitingRecords) ? detail.waitingRecords.map(toJsonObject) : []
      const activeWait = waitingRecords.find((item) => item.active === true)
      const reason = String(activeWait?.note || activeWait?.reason || '').trim()
      if (task.title && reason && !answer.includes(reason)) {
        const elapsedMinutes = Math.max(0, Number(activeWait?.elapsedMinutes) || 0)
        const elapsed = elapsedMinutes >= 1440
          ? `${Math.floor(elapsedMinutes / 1440)} 天 ${Math.floor(elapsedMinutes % 1440 / 60)} 小时`
          : `${Math.floor(elapsedMinutes / 60)} 小时 ${elapsedMinutes % 60} 分钟`
        answer = `**${String(task.title)}** 目前卡在等待环节。\n\n- **具体原因**：${reason}\n- **开始等待**：${String(activeWait?.startAt || '未记录').replace('T', ' ')}\n- **已等待**：${elapsed}`
        trace.push({ type: 'result', label: '已用等待记录校正最终结论' })
      }
    }
    agentTurn = completeAgentTurn({ ...workingTurn, plan: plannedCalls, evidence, answer }, answer, verifiedIntents)
    const nextPending = this.getPendingAction()
    const approval = nextPending && (!pending || nextPending.createdAt !== pending.createdAt)
      ? this.approvalResult(nextPending, 'pending')
      : undefined
    const finalTrace: AliceAgentTraceItem = approval
      ? { type: 'result', label: '任务草稿可以确认', detail: '字段校验已通过，等待用户确认后写入。' }
      : selection
        ? { type: 'result', label: '等待选择具体任务', detail: '存在多个候选，编排层没有替用户猜测。' }
        : backgroundTask
          ? { type: 'result', label: '后台任务已经建立', detail: '后续进度会持续写入任务中心。' }
          : factVerificationSummary?.passed
            ? { type: 'result', label: '业务事实核验通过', detail: `已核对 ${factVerificationSummary.checkedClaims} 条声明。` }
            : { type: 'result', label: '本次处理完成', detail: usedTools.size ? `已完成 ${usedTools.size} 项必要工具操作。` : '已根据当前问题直接回答。' }
    const response: AliceAgentChatResult = {
      answer,
      trace: [...trace, finalTrace],
      model: request.orchestration.modelLabel,
      agentTurn: { ...sanitizeAgentTurnAudit(agentTurn), evidenceCount: agentTurn.evidence.length },
      productivity: {
        engine: 'langgraph',
        status: productivity.decision.status === 'replan' ? 'needs_input' : productivity.decision.status,
        path: productivity.path,
        cycles: productivity.cycles,
        toolCalls: productivity.toolCalls,
        reason: productivity.decision.reason,
      },
      ...(approval ? { approval } : {}),
      ...(selection ? { selection } : {}),
      ...(backgroundTask ? { backgroundTask } : {}),
      ...(attachmentsById.size ? { attachments: [...attachmentsById.values()].slice(0, 30) } : {}),
      ...(uploadHandoff ? { uploadHandoff } : {}),
      ...(factVerificationSummary ? { factVerification: factVerificationSummary } : {}),
      ...(shouldGroundAnswer ? { grounding: factSnapshot } : {}),
    }
    this.saveMessage('assistant', answer, {
      approval,
      selection,
      backgroundTask,
      attachments: response.attachments,
      uploadHandoff: response.uploadHandoff,
      trace: response.trace.map((item) => item.detail ? `${item.label}：${item.detail}` : item.label),
    })
    this.saveGraphCheckpoint(agentTurn.id, 'completed', {
      path: [...request.orchestration.graph.path, ...productivity.path],
      modelCalls: request.orchestration.graph.modelCalls,
      operationNames: [...usedTools],
      deniedCount: request.orchestration.graph.deniedCount,
      status: response.productivity?.status || 'failed',
      cycles: productivity.cycles,
      toolCalls: productivity.toolCalls,
      factVerified: factVerificationSummary?.passed === true,
    })
    return response
  }
}
