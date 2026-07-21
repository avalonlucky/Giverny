import type { AgentReadToolName } from './agentToolRegistry'
import type { AgentPrincipalContext } from './agentScope'

export type AgentTurnPhase = 'understand' | 'plan' | 'authorize' | 'execute' | 'analyze' | 'verify' | 'complete' | 'needs_input' | 'failed'
export type AgentIntent = 'finance' | 'task_data' | 'attachment' | 'product_help' | 'knowledge' | 'write' | 'general' | 'unknown'
export type AgentRiskLevel = 'read' | 'write' | 'sensitive'

export type AgentPlannedToolCall = {
  id: string
  name: AgentReadToolName | string
  args: Record<string, unknown>
  reason: string
  risk: AgentRiskLevel
}

export type AgentEvidence = {
  id: string
  toolCallId: string
  toolName: string
  source: 'd1' | 'r2' | 'product_registry' | 'knowledge' | 'web' | 'model'
  deterministic: boolean
  payload: unknown
}

export type AgentVerification = {
  passed: boolean
  issues: string[]
  requiredTools: string[]
  correctedAnswer?: string
}

export type AgentTurn = {
  id: string
  principal: AgentPrincipalContext
  question: string
  intent: AgentIntent
  phase: AgentTurnPhase
  plan: AgentPlannedToolCall[]
  evidence: AgentEvidence[]
  answer: string
  verification: AgentVerification
  attempts: number
  startedAt: string
  completedAt?: string
}

export function createAgentTurn(input: {
  principal: AgentPrincipalContext
  question: string
  intent?: AgentIntent
}): AgentTurn {
  return {
    id: input.principal.runId || crypto.randomUUID(),
    principal: input.principal,
    question: input.question.trim(),
    intent: input.intent || 'unknown',
    phase: 'understand',
    plan: [],
    evidence: [],
    answer: '',
    verification: { passed: false, issues: [], requiredTools: [] },
    attempts: 0,
    startedAt: new Date().toISOString(),
  }
}

export function normalizeAgentIntent(value: unknown): AgentIntent {
  const intent = String(value || '') as AgentIntent
  return ['finance', 'task_data', 'attachment', 'product_help', 'knowledge', 'write', 'general', 'unknown'].includes(intent)
    ? intent
    : 'unknown'
}

export function requiresBusinessEvidence(intent: AgentIntent) {
  return intent === 'finance' || intent === 'task_data' || intent === 'attachment' || intent === 'write'
}

export function verifyAgentAnswer(turn: AgentTurn): AgentVerification {
  const issues: string[] = []
  const requiredTools: string[] = []
  if (requiresBusinessEvidence(turn.intent) && !turn.evidence.some((item) => item.deterministic)) {
    issues.push('业务事实回答缺少确定性工具证据。')
  }
  if (turn.intent === 'finance' && !turn.evidence.some((item) => item.toolName === 'query_month_finance')) {
    requiredTools.push('query_month_finance')
    issues.push('金额或工时结论没有经过财务计算工具。')
  }
  if (/卡在|卡点|等待|为什么.*(?:没|未).*交付|延期/.test(turn.question)
    && !turn.evidence.some((item) => item.toolName === 'get_task_detail')) {
    requiredTools.push('get_task_detail')
    issues.push('任务阻塞问题没有读取任务详情和等待记录。')
  }
  if (turn.plan.some((item) => item.risk !== 'read') && !turn.answer.includes('确认')) {
    issues.push('写入动作没有进入人工确认流程。')
  }
  return { passed: issues.length === 0, issues, requiredTools: [...new Set(requiredTools)] }
}

export function completeAgentTurn(turn: AgentTurn, answer: string): AgentTurn {
  const next = { ...turn, answer: answer.trim(), phase: 'verify' as AgentTurnPhase }
  const verification = verifyAgentAnswer(next)
  return {
    ...next,
    verification,
    phase: verification.passed ? 'complete' : 'needs_input',
    completedAt: new Date().toISOString(),
  }
}
