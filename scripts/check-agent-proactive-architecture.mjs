import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const worker = readFileSync('src/worker.ts', 'utf8')
const registry = readFileSync('src/agentToolRegistry.ts', 'utf8')
const director = readFileSync('src/agentIntentDirector.ts', 'utf8')
const schema = readFileSync('db/schema.sql', 'utf8')
const migration = readFileSync('db/migrations/0031_agent_proactive_work.sql', 'utf8')

for (const marker of ['agent_proactive_items', 'signal_type', 'dedupe_key', 'priority', 'recommendation', 'suggested_prompt', 'resolution', 'handled_at']) {
  assert.ok(schema.includes(marker), `schema missing ${marker}`)
  assert.ok(migration.includes(marker), `migration missing ${marker}`)
}
for (const symbol of ['syncAgentProactiveTask', 'syncAgentProactiveWorkspace', 'agentQueryProactiveWorkTool', 'agentManageProactivePreviewTool', 'agentManageProactiveTool', 'agentProactiveSummary']) assert.ok(worker.includes(symbol), `Worker missing ${symbol}`)
assert.match(worker, /WHERE status IN \('open', 'snoozed'\)/)
assert.match(worker, /resolution = 'auto_resolved'/)
assert.match(worker, /CASE priority WHEN 'critical' THEN 4/)
assert.match(registry, /query_proactive_work/)
assert.match(registry, /manage_proactive_item_preview/)
assert.match(director, /proactive: \['query_proactive_work', 'manage_proactive_item_preview'\]/)
assert.match(worker, /resolutionRate: handledTotal/)
assert.match(registry, /manage_proactive_item_preview/)

console.log('Agent proactive work architecture guard passed.')
