import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const files = {
  engine: readFileSync('src/agentExecutionEngine.ts', 'utf8'),
  worker: readFileSync('src/worker.ts', 'utf8'),
  registry: readFileSync('src/agentToolRegistry.ts', 'utf8'),
  schema: readFileSync('db/schema.sql', 'utf8'),
  migration: readFileSync('db/migrations/0030_agent_execution_engine.sql', 'utf8'),
  ui: readFileSync('src/components/ChatPanel.tsx', 'utf8'),
  workflow: readFileSync('src/agentWriteWorkflow.ts', 'utf8'),
}

for (const symbol of [
  'approveExecutionBatch',
  'assertAcyclicExecutionSteps',
  'failExecutionStep',
  'retryExecutionStep',
  'beginExecutionCompensation',
  'completeExecutionCompensation',
]) assert.ok(files.engine.includes(symbol), `execution engine missing ${symbol}`)

for (const column of ['execution_mode', 'failure_policy', 'revision', 'approved_at', 'failed_at', 'error_message']) {
  assert.ok(files.schema.includes(column), `schema missing ${column}`)
  assert.ok(files.migration.includes(column), `migration missing ${column}`)
}

assert.match(files.registry, /executionMode: z\.enum\(\['batch', 'guided'\]\)/)
assert.match(files.registry, /dependsOn: z\.array/)
assert.match(files.registry, /compensation: z\.object/)
assert.match(files.worker, /outcome === 'failed'/)
assert.match(files.worker, /revision = revision \+ 1/)
assert.match(files.worker, /计划已在其他会话更新/)
assert.match(files.ui, /确认整个批次/)
assert.match(files.ui, /补偿 \/ 回滚/)
assert.match(files.workflow, /waitForApproval/)
assert.ok(!files.worker.includes("status = 'active', paused_at = NULL, completed_at = NULL"), 'legacy resume must not erase execution result')

console.log('Agent execution engine architecture guard passed.')
