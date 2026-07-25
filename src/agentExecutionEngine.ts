export type AgentExecutionStepStatus =
  | 'pending'
  | 'blocked'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'compensation_pending'
  | 'compensating'
  | 'compensated'

export type AgentExecutionPlanStatus =
  | 'awaiting_confirmation'
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'compensating'
  | 'compensated'
  | 'cancelled'

export type AgentExecutionStep = {
  id: string
  key: string
  label: string
  action: string
  status: AgentExecutionStepStatus
  dependsOn: string[]
  compensation?: {
    label: string
    action: string
  }
  attempts: number
  startedAt?: string
  completedAt?: string
  failedAt?: string
  compensatedAt?: string
  error?: string
}

export type AgentExecutionStepDraft = {
  key?: string
  label: string
  action: string
  dependsOn?: string[]
  compensation?: {
    label: string
    action: string
  }
}

const terminalStatuses = new Set<AgentExecutionStepStatus>(['completed', 'skipped', 'compensated'])

function cleanKey(value: unknown, fallback: string) {
  const key = String(value || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return key.slice(0, 60) || fallback
}

function stepId(planId: string, key: string) {
  return `${planId}:${key}`
}

export function buildExecutionSteps(planId: string, drafts: AgentExecutionStepDraft[]): AgentExecutionStep[] {
  const keys = drafts.map((draft, index) => cleanKey(draft.key, `step-${index + 1}`))
  if (new Set(keys).size !== keys.length) throw new Error('执行步骤 key 不能重复')
  const keySet = new Set(keys)
  const steps = drafts.map((draft, index): AgentExecutionStep => {
    const key = keys[index]
    const dependencies = draft.dependsOn === undefined
      ? (index > 0 ? [keys[index - 1]] : [])
      : [...new Set(draft.dependsOn.map((dependency) => cleanKey(dependency, '')).filter(Boolean))]
    for (const dependency of dependencies) {
      if (!keySet.has(dependency)) throw new Error(`步骤 ${key} 依赖了不存在的步骤 ${dependency}`)
      if (dependency === key) throw new Error(`步骤 ${key} 不能依赖自身`)
    }
    const compensation = draft.compensation?.label && draft.compensation.action
      ? { label: draft.compensation.label.trim().slice(0, 120), action: draft.compensation.action.trim().slice(0, 60) }
      : undefined
    return {
      id: stepId(planId, key),
      key,
      label: draft.label.trim().slice(0, 120),
      action: draft.action.trim().slice(0, 60) || 'follow_up',
      status: 'pending',
      dependsOn: dependencies.map((dependency) => stepId(planId, dependency)),
      compensation,
      attempts: 0,
    }
  })
  assertAcyclicExecutionSteps(steps)
  return steps
}

export function normalizeExecutionSteps(planId: string, value: unknown): AgentExecutionStep[] {
  if (!Array.isArray(value)) return []
  const legacy = value.map((item, index) => {
    const record = typeof item === 'object' && item ? item as Record<string, unknown> : {}
    const rawId = String(record.id || '')
    const rawKey = String(record.key || rawId.split(':').pop() || `step-${index + 1}`)
    const key = cleanKey(rawKey, `step-${index + 1}`)
    const rawDependencies = Array.isArray(record.dependsOn) ? record.dependsOn.map(String) : null
    const previousRecord = index > 0 && typeof value[index - 1] === 'object' && value[index - 1]
      ? value[index - 1] as Record<string, unknown>
      : null
    const previousId = previousRecord ? String(previousRecord.id || '') : ''
    const previousKey = cleanKey(String(previousRecord?.key || previousId.split(':').pop() || `step-${index}`), `step-${index}`)
    const dependsOn = rawDependencies === null
      ? (index > 0 ? [previousId || stepId(planId, previousKey)] : [])
      : rawDependencies.map((dependency) => dependency.includes(':') ? dependency : stepId(planId, cleanKey(dependency, ''))).filter(Boolean)
    const status = String(record.status || 'pending') as AgentExecutionStepStatus
    const compensationRecord = typeof record.compensation === 'object' && record.compensation
      ? record.compensation as Record<string, unknown>
      : null
    return {
      id: rawId || stepId(planId, key),
      key,
      label: String(record.label || '').slice(0, 120),
      action: String(record.action || 'follow_up').slice(0, 60),
      status: isExecutionStepStatus(status) ? status : 'pending',
      dependsOn,
      compensation: compensationRecord?.label && compensationRecord.action
        ? { label: String(compensationRecord.label).slice(0, 120), action: String(compensationRecord.action).slice(0, 60) }
        : undefined,
      attempts: Math.max(0, Number(record.attempts) || 0),
      startedAt: record.startedAt ? String(record.startedAt) : undefined,
      completedAt: record.completedAt ? String(record.completedAt) : undefined,
      failedAt: record.failedAt ? String(record.failedAt) : undefined,
      compensatedAt: record.compensatedAt ? String(record.compensatedAt) : undefined,
      error: record.error ? String(record.error).slice(0, 500) : undefined,
    }
  })
  assertAcyclicExecutionSteps(legacy)
  return legacy
}

function isExecutionStepStatus(value: string): value is AgentExecutionStepStatus {
  return ['pending', 'blocked', 'ready', 'running', 'completed', 'failed', 'skipped', 'compensation_pending', 'compensating', 'compensated'].includes(value)
}

export function assertAcyclicExecutionSteps(steps: AgentExecutionStep[]) {
  const ids = new Set(steps.map((step) => step.id))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const byId = new Map(steps.map((step) => [step.id, step]))
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error('执行步骤不能形成循环依赖')
    if (visited.has(id)) return
    const step = byId.get(id)
    if (!step) throw new Error(`执行步骤依赖不存在：${id}`)
    visiting.add(id)
    for (const dependency of step.dependsOn) {
      if (!ids.has(dependency)) throw new Error(`执行步骤依赖不存在：${dependency}`)
      visit(dependency)
    }
    visiting.delete(id)
    visited.add(id)
  }
  for (const step of steps) visit(step.id)
}

export function unlockExecutionSteps(steps: AgentExecutionStep[]) {
  const completed = new Set(steps.filter((step) => terminalStatuses.has(step.status)).map((step) => step.id))
  return steps.map((step): AgentExecutionStep => {
    if (!['pending', 'blocked', 'ready'].includes(step.status)) return step
    const ready = step.dependsOn.every((dependency) => completed.has(dependency))
    return { ...step, status: ready ? 'ready' : 'blocked' }
  })
}

export function approveExecutionBatch(steps: AgentExecutionStep[]) {
  return unlockExecutionSteps(steps)
}

export function startExecutionStep(steps: AgentExecutionStep[], id: string, at = new Date().toISOString()) {
  return steps.map((step): AgentExecutionStep => {
    if (step.id !== id) return step
    if (step.status !== 'ready') throw new Error('只有依赖已经满足的步骤才能执行')
    return { ...step, status: 'running', attempts: step.attempts + 1, startedAt: at, error: undefined, failedAt: undefined }
  })
}

export function completeExecutionStep(steps: AgentExecutionStep[], id: string, at = new Date().toISOString()) {
  const updated = steps.map((step): AgentExecutionStep => {
    if (step.id !== id) return step
    if (!['ready', 'running'].includes(step.status)) throw new Error('当前步骤不能标记为完成')
    return { ...step, status: 'completed', completedAt: at, error: undefined, failedAt: undefined }
  })
  return unlockExecutionSteps(updated)
}

export function failExecutionStep(steps: AgentExecutionStep[], id: string, error: string, at = new Date().toISOString()) {
  return steps.map((step): AgentExecutionStep => {
    if (step.id === id) {
      if (!['ready', 'running'].includes(step.status)) throw new Error('当前步骤不能标记为失败')
      return { ...step, status: 'failed', failedAt: at, error: error.trim().slice(0, 500) || '执行失败' }
    }
    return step.status === 'ready' ? { ...step, status: 'blocked' } : step
  })
}

export function retryExecutionStep(steps: AgentExecutionStep[], id: string) {
  if (!steps.some((step) => step.id === id && step.status === 'failed')) throw new Error('只有失败步骤可以重试')
  const reset = steps.map((step): AgentExecutionStep => step.id === id
    ? { ...step, status: 'pending', error: undefined, failedAt: undefined }
    : step)
  return unlockExecutionSteps(reset)
}

export function beginExecutionCompensation(steps: AgentExecutionStep[]) {
  const compensatable = steps.filter((step) => step.status === 'completed' && step.compensation)
  if (compensatable.length === 0) throw new Error('当前批次没有可补偿步骤')
  const compensatableIds = new Set(compensatable.map((step) => step.id))
  const dependentIds = new Set<string>()
  for (const step of compensatable) {
    if (steps.some((candidate) => candidate.dependsOn.includes(step.id) && compensatableIds.has(candidate.id))) dependentIds.add(step.id)
  }
  return steps.map((step): AgentExecutionStep => {
    if (!compensatableIds.has(step.id)) return step
    return { ...step, status: dependentIds.has(step.id) ? 'blocked' : 'compensation_pending' }
  })
}

export function startExecutionCompensation(steps: AgentExecutionStep[], id: string, at = new Date().toISOString()) {
  return steps.map((step): AgentExecutionStep => {
    if (step.id !== id) return step
    if (step.status !== 'compensation_pending') throw new Error('当前步骤尚不能执行补偿')
    return { ...step, status: 'compensating', startedAt: at, attempts: step.attempts + 1 }
  })
}

export function completeExecutionCompensation(steps: AgentExecutionStep[], id: string, at = new Date().toISOString()) {
  const updated = steps.map((step): AgentExecutionStep => {
    if (step.id !== id) return step
    if (!['compensation_pending', 'compensating'].includes(step.status)) throw new Error('当前步骤不能标记为已补偿')
    return { ...step, status: 'compensated', compensatedAt: at, error: undefined }
  })
  const compensated = new Set(updated.filter((step) => step.status === 'compensated').map((step) => step.id))
  return updated.map((step): AgentExecutionStep => {
    if (step.status !== 'blocked' || !step.compensation) return step
    const dependents = updated.filter((candidate) => candidate.dependsOn.includes(step.id) && candidate.compensation)
    return dependents.every((candidate) => compensated.has(candidate.id))
      ? { ...step, status: 'compensation_pending' }
      : step
  })
}

export function executionPlanStatus(steps: AgentExecutionStep[]): AgentExecutionPlanStatus {
  if (steps.some((step) => step.status === 'failed')) return 'failed'
  if (steps.some((step) => ['compensation_pending', 'compensating'].includes(step.status))) return 'compensating'
  if (steps.some((step) => step.status === 'compensated') && !steps.some((step) => step.status === 'completed' && step.compensation)) return 'compensated'
  if (steps.length > 0 && steps.every((step) => terminalStatuses.has(step.status))) return 'completed'
  return 'active'
}

export function nextExecutionStepIndex(steps: AgentExecutionStep[]) {
  const index = steps.findIndex((step) => ['ready', 'running', 'failed', 'compensation_pending', 'compensating'].includes(step.status))
  return index < 0 ? steps.length : index
}
