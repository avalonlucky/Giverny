export type AgentSloStatus = 'healthy' | 'at-risk' | 'breached' | 'observing'

export type AgentSloPolicy = {
  minimumSamples: number
  minimumSuccessRate: number
  minimumFactVerificationRate: number
  maximumP95DurationMs: number
  maximumFallbackRate: number
  maximumBackgroundFailureRate: number
}

export type AgentSloInput = {
  totalRuns: number
  errorRuns: number
  fallbackRuns: number
  p95DurationMs: number
  verifiedTurns: number
  totalTurns: number
  failedBackgroundJobs: number
  completedBackgroundJobs: number
}

export type AgentSloObjective = {
  key: 'availability' | 'fact-verification' | 'latency' | 'primary-model' | 'background-jobs'
  label: string
  value: number
  target: number
  unit: '%' | 'ms'
  direction: 'minimum' | 'maximum'
  status: Exclude<AgentSloStatus, 'observing'> | 'observing'
  summary: string
}

export const defaultAgentSloPolicy: AgentSloPolicy = {
  minimumSamples: 20,
  minimumSuccessRate: 99,
  minimumFactVerificationRate: 100,
  maximumP95DurationMs: 45_000,
  maximumFallbackRate: 1,
  maximumBackgroundFailureRate: 1,
}

function percentage(numerator: number, denominator: number, fallback = 0) {
  if (denominator <= 0) return fallback
  return Number((numerator / denominator * 100).toFixed(1))
}

function objectiveStatus(value: number, target: number, direction: 'minimum' | 'maximum', observing: boolean): AgentSloObjective['status'] {
  if (observing) return 'observing'
  const passed = direction === 'minimum' ? value >= target : value <= target
  if (passed) return 'healthy'
  const distance = direction === 'minimum' ? target - value : value - target
  const tolerance = direction === 'minimum' ? 2 : Math.max(target, 1)
  return distance <= tolerance ? 'at-risk' : 'breached'
}

export function evaluateAgentSlo(input: AgentSloInput, policy = defaultAgentSloPolicy) {
  const observingRuns = input.totalRuns < policy.minimumSamples
  const observingTurns = input.totalTurns < policy.minimumSamples
  const backgroundTotal = input.failedBackgroundJobs + input.completedBackgroundJobs
  const availability = percentage(input.totalRuns - input.errorRuns, input.totalRuns, 100)
  const factVerification = percentage(input.verifiedTurns, input.totalTurns, 100)
  const fallbackRate = percentage(input.fallbackRuns, input.totalRuns)
  const backgroundFailureRate = percentage(input.failedBackgroundJobs, backgroundTotal)
  const objectives: AgentSloObjective[] = [
    {
      key: 'availability', label: '回答成功率', value: availability, target: policy.minimumSuccessRate,
      unit: '%', direction: 'minimum', status: objectiveStatus(availability, policy.minimumSuccessRate, 'minimum', observingRuns),
      summary: `目标至少 ${policy.minimumSuccessRate}%，当前 ${availability}%`,
    },
    {
      key: 'fact-verification', label: '事实验真率', value: factVerification, target: policy.minimumFactVerificationRate,
      unit: '%', direction: 'minimum', status: objectiveStatus(factVerification, policy.minimumFactVerificationRate, 'minimum', observingTurns),
      summary: `目标 ${policy.minimumFactVerificationRate}%，当前 ${factVerification}%`,
    },
    {
      key: 'latency', label: 'P95 响应时间', value: input.p95DurationMs, target: policy.maximumP95DurationMs,
      unit: 'ms', direction: 'maximum', status: objectiveStatus(input.p95DurationMs, policy.maximumP95DurationMs, 'maximum', observingRuns),
      summary: `目标不超过 ${(policy.maximumP95DurationMs / 1000).toFixed(0)} 秒，当前 ${(input.p95DurationMs / 1000).toFixed(1)} 秒`,
    },
    {
      key: 'primary-model', label: '主模型完成率', value: Number((100 - fallbackRate).toFixed(1)), target: Number((100 - policy.maximumFallbackRate).toFixed(1)),
      unit: '%', direction: 'minimum', status: objectiveStatus(fallbackRate, policy.maximumFallbackRate, 'maximum', observingRuns),
      summary: `主模型目标至少 ${100 - policy.maximumFallbackRate}%，当前 ${Number((100 - fallbackRate).toFixed(1))}%`,
    },
    {
      key: 'background-jobs', label: '后台任务稳定性', value: backgroundFailureRate, target: policy.maximumBackgroundFailureRate,
      unit: '%', direction: 'maximum', status: objectiveStatus(backgroundFailureRate, policy.maximumBackgroundFailureRate, 'maximum', backgroundTotal < policy.minimumSamples),
      summary: `失败率目标不超过 ${policy.maximumBackgroundFailureRate}%，当前 ${backgroundFailureRate}%`,
    },
  ]
  const activeObjectives = objectives.filter((item) => item.status !== 'observing')
  const status: AgentSloStatus = objectives.every((item) => item.status === 'observing')
    ? 'observing'
    : activeObjectives.some((item) => item.status === 'breached')
      ? 'breached'
      : activeObjectives.some((item) => item.status === 'at-risk')
        ? 'at-risk'
        : 'healthy'
  const allowedErrors = Math.max(1, Math.floor(input.totalRuns * (100 - policy.minimumSuccessRate) / 100))
  const consumedErrorBudget = input.totalRuns < policy.minimumSamples ? 0 : Number((input.errorRuns / allowedErrors * 100).toFixed(1))
  return {
    status,
    policy,
    objectives,
    errorBudget: {
      allowedErrors,
      actualErrors: input.errorRuns,
      consumedPercent: consumedErrorBudget,
      remainingPercent: Math.max(0, Number((100 - consumedErrorBudget).toFixed(1))),
    },
    releaseGate: status === 'breached' ? 'block' as const : status === 'observing' ? 'observe' as const : 'pass' as const,
  }
}

export type EmergencyFallbackCategory = 'timeout' | 'rate-limit' | 'provider-outage' | 'authentication' | 'invalid-result' | 'capability-mismatch' | 'cancelled' | 'unknown'

export function classifyEmergencyFallbackReason(reason: string): EmergencyFallbackCategory {
  const value = String(reason || '').toLowerCase()
  if (/abort|cancel|取消|终止/.test(value)) return 'cancelled'
  if (/timeout|timed out|超时/.test(value)) return 'timeout'
  if (/429|rate.?limit|quota|额度|限流|too many/.test(value)) return 'rate-limit'
  if (/401|403|api key|未配置|unauthor|forbidden|鉴权|密钥/.test(value)) return 'authentication'
  if (/http\s*[45]\d\d|500|502|503|504|network|fetch failed|econn|provider|outage|service unavailable|服务异常|供应商/.test(value)) return 'provider-outage'
  if (/json|无法解析|无效|未返回内容|empty/.test(value)) return 'invalid-result'
  if (/不支持|能力|预览|格式/.test(value)) return 'capability-mismatch'
  return 'unknown'
}

export function evaluateEmergencyFallback(reason: string, attempts: number) {
  const category = classifyEmergencyFallbackReason(reason)
  const allowedCategory = category !== 'cancelled' && category !== 'unknown'
  const deterministicFailure = category === 'capability-mismatch' || category === 'authentication'
  const allowed = allowedCategory && (attempts >= 2 || deterministicFailure)
  return {
    allowed,
    category,
    attempts,
    reason: allowed
      ? category === 'capability-mismatch'
        ? '所选模型不具备当前能力，允许转入专用模型。'
        : category === 'authentication'
          ? '主模型缺少有效凭证，重复请求不会恢复，允许启动应急模型。'
          : '主模型已连续失败，允许启动应急备用模型。'
      : category === 'cancelled' ? '用户取消不能触发备用模型。' : attempts < 2 ? '主模型尚未完成同模型重试。' : '失败原因不明确，禁止自动切换备用模型。',
  }
}

export type CanaryProbe = {
  healthOk: boolean
  factProtocolOk: boolean
  assetParityOk: boolean
  expectedVersion: string
  observedVersion: string
}

export function decideCanaryPromotion(probe: CanaryProbe) {
  const failures: string[] = []
  if (!probe.healthOk) failures.push('健康接口未通过')
  if (!probe.factProtocolOk) failures.push('事实协议未通过')
  if (!probe.assetParityOk) failures.push('前端资源与候选版本不一致')
  if (!probe.expectedVersion || probe.expectedVersion !== probe.observedVersion) failures.push('候选版本号不一致')
  return failures.length
    ? { action: 'rollback' as const, failures }
    : { action: 'promote' as const, failures: [] }
}
