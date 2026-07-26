import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const worker = readFileSync('src/worker.ts', 'utf8')
const registry = readFileSync('src/agentToolRegistry.ts', 'utf8')
const alice = readFileSync('src/aliceAgent.ts', 'utf8')
const schema = readFileSync('db/schema.sql', 'utf8')
const migration = readFileSync('db/migrations/0034_agent_assurance_suite.sql', 'utf8')

for (const table of ['agent_consistency_runs', 'agent_formal_deliverables', 'agent_high_risk_cases']) {
  assert.ok(schema.includes(table), `schema missing ${table}`)
  assert.ok(migration.includes(table), `migration missing ${table}`)
}
for (const capability of ['audit_workspace_consistency', 'query_formal_deliverables', 'generate_formal_deliverable_preview', 'query_high_risk_actions', 'cancel_high_risk_action_preview']) {
  assert.ok(registry.includes(capability), `registry missing ${capability}`)
  assert.ok(alice.includes(`capabilities.${capability}.inputSchema`), `Alice missing ${capability}`)
}
for (const marker of ['runWorkspaceConsistencyAudit', 'hours_snapshot_difference', 'settlement_snapshot_totals', 'sourceChecksum', 'snapshot_checksum', 'requiresSecondConfirmation', 'retentionUntil', 'acknowledge-high-risk-action', "status = 'cancelled'"]) {
  assert.ok(worker.includes(marker), `assurance runtime missing ${marker}`)
}
assert.match(alice, /第一重风险确认/)
assert.match(alice, /请再次回复“确认”/)
assert.match(worker, /7 \* 365 \* 24 \* 60 \* 60 \* 1000/)
assert.ok(!worker.includes("SET actual_hours = entryHours"), 'consistency audit must not rewrite saved hours')

console.log('Agent assurance architecture guard passed: consistency audit, formal deliverables, and high-risk governance are linked.')
