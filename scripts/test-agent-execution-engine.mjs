import assert from 'node:assert/strict'
import {
  approveExecutionBatch,
  beginExecutionCompensation,
  buildExecutionSteps,
  completeExecutionCompensation,
  completeExecutionStep,
  executionPlanStatus,
  failExecutionStep,
  nextExecutionStepIndex,
  normalizeExecutionSteps,
  retryExecutionStep,
  startExecutionCompensation,
  startExecutionStep,
} from '../src/agentExecutionEngine.ts'

let assertions = 0
function equal(actual, expected, message) {
  assert.equal(actual, expected, message)
  assertions += 1
}
function deepEqual(actual, expected, message) {
  assert.deepEqual(actual, expected, message)
  assertions += 1
}
function throws(callback, pattern, message) {
  assert.throws(callback, pattern, message)
  assertions += 1
}

const drafts = [
  { key: 'create', label: '创建任务', action: 'create_task', compensation: { label: '恢复任务字段', action: 'update_task_fields' } },
  { key: 'progress', label: '记录进展', action: 'append_progress', dependsOn: ['create'], compensation: { label: '撤回进展', action: 'manage_record' } },
  { key: 'review', label: '核对附件', action: 'mark_acceptance_files', dependsOn: ['create'] },
  { key: 'accept', label: '完成验收', action: 'complete_acceptance', dependsOn: ['progress', 'review'] },
]

const pending = buildExecutionSteps('plan-1', drafts)
equal(pending.length, 4, 'creates all steps')
deepEqual(pending.map((step) => step.status), ['pending', 'pending', 'pending', 'pending'], 'batch starts unapproved')
deepEqual(pending[3].dependsOn, ['plan-1:progress', 'plan-1:review'], 'dependency keys resolve to stable ids')
equal(pending[0].attempts, 0, 'attempt count starts at zero')

let steps = approveExecutionBatch(pending)
deepEqual(steps.map((step) => step.status), ['ready', 'blocked', 'blocked', 'blocked'], 'approval unlocks roots only')
equal(nextExecutionStepIndex(steps), 0, 'current step selects first ready step')
steps = startExecutionStep(steps, 'plan-1:create', '2026-07-25T01:00:00.000Z')
equal(steps[0].status, 'running', 'ready step starts')
equal(steps[0].attempts, 1, 'starting increments attempts')
throws(() => startExecutionStep(steps, 'plan-1:progress'), /依赖已经满足/, 'blocked step cannot start')
steps = completeExecutionStep(steps, 'plan-1:create', '2026-07-25T01:01:00.000Z')
deepEqual(steps.map((step) => step.status), ['completed', 'ready', 'ready', 'blocked'], 'parallel dependents unlock together')

steps = startExecutionStep(steps, 'plan-1:progress')
steps = failExecutionStep(steps, 'plan-1:progress', '模拟写入失败')
equal(executionPlanStatus(steps), 'failed', 'one failed step stops the plan')
equal(steps[1].error, '模拟写入失败', 'failure reason is retained')
equal(steps[2].status, 'blocked', 'other ready branches stop after failure')
steps = retryExecutionStep(steps, 'plan-1:progress')
equal(steps[1].status, 'ready', 'failed step can retry after dependencies remain complete')
equal(steps[2].status, 'ready', 'paused parallel branch unlocks on retry')
steps = completeExecutionStep(steps, 'plan-1:progress')
steps = completeExecutionStep(steps, 'plan-1:review')
equal(steps[3].status, 'ready', 'join step waits for every dependency')
steps = completeExecutionStep(steps, 'plan-1:accept')
equal(executionPlanStatus(steps), 'completed', 'all terminal steps complete the plan')

let compensation = beginExecutionCompensation(steps)
equal(executionPlanStatus(compensation), 'compensating', 'completed plan can enter compensation')
equal(compensation[1].status, 'compensation_pending', 'leaf compensation runs first')
equal(compensation[0].status, 'blocked', 'dependency compensation waits for dependent rollback')
compensation = startExecutionCompensation(compensation, 'plan-1:progress')
equal(compensation[1].status, 'compensating', 'compensation records running state')
compensation = completeExecutionCompensation(compensation, 'plan-1:progress')
equal(compensation[0].status, 'compensation_pending', 'parent compensation unlocks in reverse order')
compensation = completeExecutionCompensation(compensation, 'plan-1:create')
equal(executionPlanStatus(compensation), 'compensated', 'all reversible steps can be compensated')

const restored = normalizeExecutionSteps('plan-1', JSON.parse(JSON.stringify(compensation)))
deepEqual(restored.map((step) => ({
  id: step.id,
  status: step.status,
  dependsOn: step.dependsOn,
  attempts: step.attempts,
  completedAt: step.completedAt,
  compensatedAt: step.compensatedAt,
})), compensation.map((step) => ({
  id: step.id,
  status: step.status,
  dependsOn: step.dependsOn,
  attempts: step.attempts,
  completedAt: step.completedAt,
  compensatedAt: step.compensatedAt,
})), 'serialized execution state restores across sessions')
throws(() => buildExecutionSteps('bad', [
  { key: 'one', label: '一', action: 'one', dependsOn: ['two'] },
  { key: 'two', label: '二', action: 'two', dependsOn: ['one'] },
]), /循环依赖/, 'cycles are rejected')
throws(() => buildExecutionSteps('bad', [
  { key: 'one', label: '一', action: 'one', dependsOn: ['missing'] },
]), /不存在/, 'missing dependencies are rejected')
throws(() => buildExecutionSteps('bad', [
  { key: 'same', label: '一', action: 'one' },
  { key: 'same', label: '二', action: 'two' },
]), /不能重复/, 'duplicate keys are rejected')

const legacy = normalizeExecutionSteps('legacy', [
  { id: 'legacy:1', label: '第一步', action: 'one', status: 'completed' },
  { id: 'legacy:2', label: '第二步', action: 'two', status: 'pending' },
])
deepEqual(legacy[1].dependsOn, ['legacy:1'], 'legacy plans gain sequential dependencies')
equal(approveExecutionBatch(legacy)[1].status, 'ready', 'legacy completed dependency unlocks next step')

console.log(`Agent execution engine deterministic tests: ${assertions} assertions passed`)
