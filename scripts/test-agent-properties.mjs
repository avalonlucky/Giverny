import assert from 'node:assert/strict'
import fc from 'fast-check'
import {
  approveExecutionBatch,
  buildExecutionSteps,
  completeExecutionStep,
  executionPlanStatus,
  failExecutionStep,
  normalizeExecutionSteps,
  retryExecutionStep,
  startExecutionStep,
} from '../src/agentExecutionEngine.ts'

const invariant = (steps) => {
  const byId = new Map(steps.map((step) => [step.id, step]))
  assert.equal(byId.size, steps.length, 'step ids must remain unique')
  assert.ok(steps.filter((step) => step.status === 'running').length <= 1, 'only one sequential step may run')
  for (const step of steps) {
    for (const dependency of step.dependsOn) assert.ok(byId.has(dependency), 'dependencies must exist')
    if (['ready', 'running', 'completed'].includes(step.status)) {
      assert.ok(step.dependsOn.every((dependency) => ['completed', 'skipped', 'compensated'].includes(byId.get(dependency)?.status)), 'an executable step cannot bypass dependencies')
    }
    assert.ok(step.attempts >= 0, 'attempts cannot become negative')
  }
}

const dagArbitrary = fc.array(fc.array(fc.nat(100), { maxLength: 8 }), { minLength: 1, maxLength: 8 })

fc.assert(fc.property(dagArbitrary, (rows) => {
  const drafts = rows.map((values, index) => ({
    key: `step-${index}`,
    label: `步骤 ${index}`,
    action: 'append_progress',
    dependsOn: index === 0 ? [] : [...new Set(values.map((value) => `step-${value % index}`))],
  }))
  let steps = approveExecutionBatch(buildExecutionSteps('property-dag', drafts))
  invariant(steps)
  while (steps.some((step) => step.status === 'ready')) {
    const ready = steps.find((step) => step.status === 'ready')
    steps = completeExecutionStep(steps, ready.id, '2026-07-26T00:00:00.000Z')
    invariant(steps)
  }
  assert.equal(executionPlanStatus(steps), 'completed', 'every finite DAG must complete in topological order')
  const restored = normalizeExecutionSteps('property-dag', JSON.parse(JSON.stringify(steps)))
  assert.deepEqual(
    JSON.parse(JSON.stringify(restored)),
    JSON.parse(JSON.stringify(steps)),
    'serialized graph state must restore without mutation',
  )
}), { numRuns: 300 })

class StartCommand {
  check(model) { return model.phase === 'ready' }
  run(model, real) {
    real.steps = startExecutionStep(real.steps, real.steps[model.index].id, '2026-07-26T00:00:00.000Z')
    model.phase = 'running'
    invariant(real.steps)
  }
  toString() { return 'start-ready-step' }
}

class CompleteCommand {
  check(model) { return model.phase === 'ready' || model.phase === 'running' }
  run(model, real) {
    real.steps = completeExecutionStep(real.steps, real.steps[model.index].id, '2026-07-26T00:01:00.000Z')
    model.index += 1
    model.phase = model.index >= real.steps.length ? 'done' : 'ready'
    invariant(real.steps)
  }
  toString() { return 'complete-current-step' }
}

class FailCommand {
  check(model) { return model.phase === 'ready' || model.phase === 'running' }
  run(model, real) {
    real.steps = failExecutionStep(real.steps, real.steps[model.index].id, 'property failure', '2026-07-26T00:02:00.000Z')
    model.phase = 'failed'
    assert.equal(executionPlanStatus(real.steps), 'failed', 'failure must stop the plan')
    invariant(real.steps)
  }
  toString() { return 'fail-current-step' }
}

class RetryCommand {
  check(model) { return model.phase === 'failed' }
  run(model, real) {
    real.steps = retryExecutionStep(real.steps, real.steps[model.index].id)
    model.phase = 'ready'
    invariant(real.steps)
  }
  toString() { return 'retry-failed-step' }
}

const commandArbitrary = fc.commands([
  fc.constant(new StartCommand()),
  fc.constant(new CompleteCommand()),
  fc.constant(new FailCommand()),
  fc.constant(new RetryCommand()),
], { maxCommands: 60 })

fc.assert(fc.property(fc.integer({ min: 1, max: 8 }), commandArbitrary, (count, commands) => {
  const drafts = Array.from({ length: count }, (_, index) => ({
    key: `linear-${index}`,
    label: `线性步骤 ${index}`,
    action: 'append_progress',
  }))
  fc.modelRun(() => ({
    model: { index: 0, phase: 'ready' },
    real: { steps: approveExecutionBatch(buildExecutionSteps('property-model', drafts)) },
  }), commands)
}), { numRuns: 300 })

console.log('Agent property and model-based tests passed: 600 generated runs')
