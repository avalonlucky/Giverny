import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const worker = readFileSync('src/worker.ts', 'utf8')
const registry = readFileSync('src/agentToolRegistry.ts', 'utf8')
const alice = readFileSync('src/aliceAgent.ts', 'utf8')
const orchestrator = readFileSync('src/agentOrchestrator.ts', 'utf8')
const component = readFileSync('src/components/EnterpriseMemoryPanel.tsx', 'utf8')
const schema = readFileSync('db/schema.sql', 'utf8')
const migration = readFileSync('db/migrations/0032_agent_enterprise_memory.sql', 'utf8')

for (const marker of ['agent_enterprise_memories', 'scope_type', 'scope_key', 'source_label', 'expires_at', 'supersedes_id', 'agent_enterprise_memory_revisions']) {
  assert.ok(schema.includes(marker), `schema missing ${marker}`)
  assert.ok(migration.includes(marker), `migration missing ${marker}`)
}
for (const symbol of ['queryEnterpriseMemories', 'mutateEnterpriseMemory', 'agentQueryEnterpriseMemoryTool', 'agentManageEnterpriseMemoryPreviewTool', 'agentManageEnterpriseMemoryTool', 'enterpriseMemorySummary']) assert.ok(worker.includes(symbol), `Worker missing ${symbol}`)
assert.match(registry, /query_enterprise_memory/)
assert.match(registry, /manage_enterprise_memory_preview/)
assert.match(alice, /组织规则、合作伙伴长期偏好、项目约定/)
assert.match(orchestrator, /asksEnterpriseMemory/)
assert.match(component, /来源说明/)
assert.match(component, /显示已纠正、失效和删除记录/)
assert.match(component, /保存纠正/)

console.log('Agent enterprise memory architecture guard passed.')
