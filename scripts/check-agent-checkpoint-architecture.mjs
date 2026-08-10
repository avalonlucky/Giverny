import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const alice = readFileSync('src/aliceAgent.ts', 'utf8')
const worker = readFileSync('src/worker.ts', 'utf8')

assert.match(alice, /CREATE TABLE IF NOT EXISTS alice_graph_checkpoints/)
assert.match(alice, /phase TEXT NOT NULL CHECK\(phase IN \('planned', 'completed'\)\)/)
assert.match(alice, /saveGraphCheckpoint\(agentTurn\.id, 'planned'/)
assert.match(alice, /saveGraphCheckpoint\(agentTurn\.id, 'completed'/)
assert.match(alice, /LIMIT 200/)
assert.match(alice, /DELETE FROM alice_graph_checkpoints/)
assert.match(worker, /CREATE TABLE IF NOT EXISTS agent_adk_pending_actions/)
const adkChatEntry = worker.slice(worker.indexOf('async function callAgentRuntime('), worker.indexOf('async function reviseAgentApproval('))
assert.doesNotMatch(adkChatEntry, /orchestration\.path|modelCalls: orchestration|ALICE_AGENT/)

const checkpointMethod = alice.slice(alice.indexOf('private saveGraphCheckpoint'), alice.indexOf('async conversationSnapshot'))
for (const sensitive of ['message', 'question', 'answer', 'title', 'amount', 'apiKey', 'token']) {
  assert.equal(checkpointMethod.includes(sensitive), false, `checkpoint must not persist sensitive field ${sensitive}`)
}

console.log('Agent 持久状态守卫通过：旧 checkpoint 可兼容，新 ADK 确认状态落 D1，主链不依赖旧图。')
