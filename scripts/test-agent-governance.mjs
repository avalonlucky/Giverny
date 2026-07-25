import assert from 'node:assert/strict'
import { classifyEmergencyFallbackReason, decideCanaryPromotion, evaluateAgentSlo, evaluateEmergencyFallback } from '../src/agentGovernance.ts'

const healthy = evaluateAgentSlo({
  totalRuns: 100, errorRuns: 0, fallbackRuns: 1, p95DurationMs: 30_000,
  verifiedTurns: 100, totalTurns: 100, failedBackgroundJobs: 0, completedBackgroundJobs: 30,
})
assert.equal(healthy.status, 'healthy')
assert.equal(healthy.releaseGate, 'pass')
assert.equal(healthy.objectives.find((item) => item.key === 'primary-model')?.value, 99)

const breached = evaluateAgentSlo({
  totalRuns: 100, errorRuns: 4, fallbackRuns: 8, p95DurationMs: 80_000,
  verifiedTurns: 94, totalTurns: 100, failedBackgroundJobs: 3, completedBackgroundJobs: 20,
})
assert.equal(breached.status, 'breached')
assert.equal(breached.releaseGate, 'block')
assert.ok(breached.errorBudget.consumedPercent >= 100)

assert.equal(classifyEmergencyFallbackReason('HTTP 429 quota exceeded'), 'rate-limit')
assert.equal(classifyEmergencyFallbackReason('simulated selected provider outage'), 'provider-outage')
assert.equal(evaluateEmergencyFallback('主模型响应超时', 1).allowed, false)
assert.equal(evaluateEmergencyFallback('主模型响应超时', 2).allowed, true)
assert.equal(evaluateEmergencyFallback('用户取消', 2).allowed, false)
assert.equal(evaluateEmergencyFallback('当前模型不支持图片', 1).allowed, true)
assert.equal(evaluateEmergencyFallback('模型 API Key 未配置', 1).allowed, true)

assert.equal(decideCanaryPromotion({ healthOk: true, factProtocolOk: true, assetParityOk: true, expectedVersion: '1.2.3', observedVersion: '1.2.3' }).action, 'promote')
assert.equal(decideCanaryPromotion({ healthOk: true, factProtocolOk: false, assetParityOk: true, expectedVersion: '1.2.3', observedVersion: '1.2.3' }).action, 'rollback')

console.log('Agent governance deterministic tests passed.')
