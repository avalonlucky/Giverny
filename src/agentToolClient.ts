// Tool calling infrastructure with timeout and circuit breaker
import { agentCapabilityRegistry, agentReadToolRegistry, type AgentCapabilityDefinition, type AgentCapabilityName, type AgentReadToolName } from './agentToolRegistry'
import { createAgentScopeHeaders, type AgentPrincipalContext } from './agentScope'
import { requesterNameFromQuestion, scopedQuestionForAgentTool, taskTitleFromQuestion } from './agentEntityResolver'
import { cleanBaseUrl, toJsonObject } from './agentUtils'
import { agentLog } from './agentLogger'

export type AgentToolResponse = Record<string, unknown> & {
  mode?: string
  ready?: boolean
  draft?: Record<string, unknown>
  confirmationToken?: string
  error?: string
}

type CircuitState = { failures: number; lastFailureAt: number; open: boolean }

const TOOL_TIMEOUT_MS = 15_000
const CIRCUIT_THRESHOLD = 3
const CIRCUIT_RESET_MS = 30_000
const circuitBreakers = new Map<string, CircuitState>()

function checkCircuit(endpoint: string): void {
  const state = circuitBreakers.get(endpoint)
  if (!state?.open) return
  if (Date.now() - state.lastFailureAt > CIRCUIT_RESET_MS) {
    state.open = false
    state.failures = 0
    return
  }
  throw new Error(`工具 ${endpoint} 熔断中（连续 ${state.failures} 次失败），${Math.ceil((CIRCUIT_RESET_MS - (Date.now() - state.lastFailureAt)) / 1000)}s 后重试。`)
}

function recordSuccess(endpoint: string): void {
  const state = circuitBreakers.get(endpoint)
  if (state) { state.failures = 0; state.open = false }
}

function recordFailure(endpoint: string): void {
  const state = circuitBreakers.get(endpoint) || { failures: 0, lastFailureAt: 0, open: false }
  state.failures += 1
  state.lastFailureAt = Date.now()
  if (state.failures >= CIRCUIT_THRESHOLD) state.open = true
  circuitBreakers.set(endpoint, state)
}

export type AgentToolClientConfig = {
  baseUrl: string | undefined
  token: string | undefined
  principal: AgentPrincipalContext
}

/** 最大序列化输入长度（防止超大 payload 攻击） */
const MAX_INPUT_BYTES = 64 * 1024

/** 检测输入中潜在的注入模式 */
function assertSafeInput(input: Record<string, unknown>): void {
  const serialized = JSON.stringify(input)
  if (serialized.length > MAX_INPUT_BYTES) {
    throw new Error(`工具输入超过 ${MAX_INPUT_BYTES / 1024}KB 限制，已拒绝。`)
  }
}

export async function callAgentTool(
  config: AgentToolClientConfig,
  endpoint: string,
  input: Record<string, unknown>,
  method: 'GET' | 'POST' = 'POST',
): Promise<AgentToolResponse> {
  checkCircuit(endpoint)
  assertSafeInput(input)
  const startedAt = Date.now()
  const baseUrl = cleanBaseUrl(config.baseUrl, 'https://mayeai.com')
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  const token = String(config.token || '').trim()
  if (!token) throw new Error('AGENT_TOOL_TOKEN 未配置，Agent 无法访问业务工具。')
  headers.authorization = `Bearer ${token}`
  Object.assign(headers, await createAgentScopeHeaders(token, config.principal))

  const url = new URL(`${baseUrl}/api/agent/tools/${endpoint}`)
  if (method === 'GET') {
    Object.entries(input).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
    })
  }
  try {
    const response = await fetch(url, {
      method,
      headers,
      signal: AbortSignal.timeout(TOOL_TIMEOUT_MS),
      ...(method === 'POST' ? { body: JSON.stringify(input) } : {}),
    })
    const data = (await response.json().catch(() => null)) as AgentToolResponse | null
    if (!response.ok || !data) {
      recordFailure(endpoint)
      agentLog.error('tool.call.http_error', { endpoint, error: data?.error || `HTTP ${response.status}` })
      throw new Error(data?.error || `工具 ${endpoint} 调用失败：HTTP ${response.status}`)
    }
    if (data.error) { recordFailure(endpoint); throw new Error(data.error) }
    recordSuccess(endpoint)
    agentLog.info('tool.call.success', { endpoint, durationMs: Date.now() - startedAt })
    return data
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      recordFailure(endpoint)
      agentLog.error('tool.call.timeout', { endpoint, durationMs: TOOL_TIMEOUT_MS })
      throw new Error(`工具 ${endpoint} 超时（${TOOL_TIMEOUT_MS / 1000}s）`, { cause: error })
    }
    if (!(error instanceof Error && error.message.includes('熔断'))) recordFailure(endpoint)
    throw error instanceof Error ? error : new Error(String(error), { cause: error })
  }
}

export function repairToolInput(
  toolName: AgentReadToolName,
  message: string,
  currentMonth: string | undefined,
  taskReference: { id: number; title: string } | null,
  referencesCurrentTask: (msg: string) => boolean,
): Record<string, unknown> | null {
  const scopedQuestion = scopedQuestionForAgentTool(message, toolName)
  if (toolName === 'query_month_finance') return { question: scopedQuestion, currentMonth }
  if (toolName === 'search_product_help') return { query: scopedQuestion, limit: 5 }
  if (toolName === 'search_workspace') return { query: scopedQuestion, month: currentMonth, limit: 20 }
  if (toolName === 'audit_workspace_consistency') return { trigger: 'manual', includeR2: true, limit: 200 }
  if (toolName === 'query_formal_deliverables') return { limit: 20 }
  if (toolName === 'query_high_risk_actions') return { status: 'all', limit: 30 }
  if (toolName === 'get_requester_profile') {
    const name = requesterNameFromQuestion(message)
    return name ? { name } : null
  }
  if (toolName === 'query_task_portfolio') {
    const scope = /(?:逾期|延期|过期)/.test(scopedQuestion) ? 'overdue'
      : /等待/.test(scopedQuestion) ? 'waiting'
      : /(?:未完成|没完成|没闭环)/.test(scopedQuestion) ? 'unfinished'
      : /(?:已验收|验收了)/.test(scopedQuestion) ? 'accepted'
      : 'all'
    return { scope, month: currentMonth, limit: 100 }
  }
  if (toolName === 'get_task_detail') {
    const explicitId = Number(message.match(/任务\s*#(\d+)/)?.[1])
    if (Number.isInteger(explicitId) && explicitId > 0) return { taskId: explicitId }
    if (taskReference && referencesCurrentTask(message)) return { taskId: taskReference.id, title: taskReference.title }
    return { title: taskTitleFromQuestion(message) || scopedQuestion }
  }
  if (toolName === 'search_tasks') return { query: scopedQuestion, month: currentMonth, limit: 30 }
  if (toolName === 'search_attachments') return { query: scopedQuestion, month: currentMonth, limit: 30 }
  if (toolName === 'query_plan_continuation') {
    return taskReference && referencesCurrentTask(message) ? { taskId: taskReference.id, limit: 10 } : { limit: 10 }
  }
  if (toolName === 'get_giverny_context') return {}
  return null
}

export async function executeRepairTool(
  config: AgentToolClientConfig,
  toolName: AgentReadToolName,
  input: Record<string, unknown>,
): Promise<AgentToolResponse> {
  const toolConfig = agentReadToolRegistry[toolName]
  return callAgentTool(config, toolConfig.endpoint, input)
}

export async function executeDirectedCapability(
  config: AgentToolClientConfig,
  name: AgentCapabilityName,
  args: Record<string, unknown>,
  options: { currentMonth?: string; conversationId?: string; taskReference: { id: number; title: string } | null; referencesCurrentTask: (msg: string) => boolean; message: string },
): Promise<AgentToolResponse> {
  const capability = agentCapabilityRegistry[name] as AgentCapabilityDefinition
  const parsed = capability.inputSchema.safeParse(args)
  if (!parsed.success) throw new Error(`${capability.title}的参数未通过校验`)
  let input = toJsonObject(parsed.data)
  if (capability.taskScoped) {
    const reference = options.taskReference
    const hasExplicitReference = /(?:选择)?任务\s*#\d+/.test(options.message)
    if (reference && (hasExplicitReference || options.referencesCurrentTask(options.message))) {
      input = { ...input, taskId: reference.id, taskTitle: reference.title }
    }
  }
  if (name === 'query_month_finance') input = { ...input, question: input.question || options.message, currentMonth: input.currentMonth || options.currentMonth }
  if (name === 'query_task_portfolio' && !input.month && !input.startDate && !input.endDate) input = { ...input, month: options.currentMonth }
  if (name === 'create_task_preview') input = { ...input, currentMonth: options.currentMonth }
  if (name === 'create_task_plan') input = { ...input, conversationId: options.conversationId }
  if (name === 'start_monthly_review' || name === 'start_deep_analysis') {
    input = { ...input, month: input.month || options.currentMonth, conversationId: options.conversationId }
  }
  if (capability.policy.confirmation === 'preview') return callAgentTool(config, capability.endpoint, input)
  const method = capability.methods.includes('POST') ? 'POST' : 'GET'
  return callAgentTool(config, capability.endpoint, input, method)
}
