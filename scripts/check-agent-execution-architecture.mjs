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
  alice: readFileSync('src/aliceAgent.ts', 'utf8'),
  batchMigration: readFileSync('db/migrations/0033_agent_operation_batches.sql', 'utf8'),
  approval: readFileSync('src/components/AgentApprovalCard.tsx', 'utf8'),
}

for (const symbol of [
  'approveExecutionBatch',
  'assertAcyclicExecutionSteps',
  'failExecutionStep',
  'retryExecutionStep',
  'revisePendingExecutionSteps',
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
assert.match(files.registry, /action: z\.enum\(\['pause', 'resume', 'retry_step', 'revise_steps', 'cancel'\]\)/)
assert.match(files.registry, /query_plan_continuation/)
assert.match(files.registry, /search_workspace/)
assert.match(files.worker, /outcome === 'failed'/)
assert.match(files.worker, /revision = revision \+ 1/)
assert.match(files.worker, /计划已在其他会话更新/)
assert.match(files.ui, /确认整个批次/)
assert.match(files.ui, /补偿 \/ 回滚/)
assert.match(files.workflow, /waitForApproval/)
const signedWriteEndpoints = files.registry
  .split('\n')
  .filter((line) => line.includes("confirmation: 'signed-execute'"))
  .map((line) => line.match(/endpoint: '([^']+)'/)?.[1])
  .filter(Boolean)
const postconditionVerifier = files.worker.slice(
  files.worker.indexOf('const agentTaskPostconditionEndpoints'),
  files.worker.indexOf('async function agentWorkflowWriteTool'),
)
assert.equal(signedWriteEndpoints.length, 23, 'signed write endpoint inventory changed; update the postcondition guard deliberately')
for (const endpoint of signedWriteEndpoints) {
  assert.ok(postconditionVerifier.includes(`'${endpoint}'`), `signed write endpoint missing independent postcondition: ${endpoint}`)
}
assert.match(files.worker, /agent_postcondition_verified/)
assert.match(files.worker, /agent_postcondition_failed/)
assert.match(files.worker, /source: 'd1-independent-read'/)
assert.match(files.alice, /postcondition\.passed === true/)
assert.match(files.alice, /outcome: 'failed'/)
assert.match(files.alice, /独立验收未通过，暂不标记为完成/)
for (const marker of ['agent_operation_batches', 'operation_count', 'task_count', 'operations_json', 'preconditions_json']) {
  assert.ok(files.schema.includes(marker), `batch schema missing ${marker}`)
  assert.ok(files.batchMigration.includes(marker), `batch migration missing ${marker}`)
}
assert.match(files.registry, /batch_task_operations_preview/)
assert.match(files.registry, /batch_task_operations/)
assert.match(files.worker, /agentBatchPreconditionStatement/)
assert.match(files.worker, /env\.DB\.batch\(statements\)/)
assert.match(files.worker, /全部操作已回滚/)
assert.match(files.worker, /endpoint === 'batch-task-operations'/)
assert.match(files.alice, /batch_task_operations_preview/)
assert.match(files.approval, /approval\.action !== 'batch_task_operations'/)
assert.match(files.approval, /失败全部回滚/)
assert.match(files.approval, /修订后的未来步骤/)
assert.match(files.worker, /agentPlanConcurrencySnapshot/)
assert.match(files.worker, /planContinuationSuggestion/)
assert.match(files.worker, /workspaceConversationSearch/)
assert.match(files.worker, /workspaceSearchQueryVariants/)
assert.match(files.worker, /semantic-vector\+keyword\+structured/)
assert.match(files.alice, /用户明确要求“继续 \/ 接着推进 \/ 往下推进 \/ 执行下一步”时必须调用 query_plan_continuation/)
assert.match(files.alice, /必须调用 search_workspace/)
assert.ok(!files.worker.includes("status = 'active', paused_at = NULL, completed_at = NULL"), 'legacy resume must not erase execution result')

console.log('Agent execution engine architecture guard passed.')
