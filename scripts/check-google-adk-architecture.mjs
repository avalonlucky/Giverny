import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const worker = readFileSync('src/worker.ts', 'utf8')
const schema = readFileSync('db/schema.sql', 'utf8')
const requirements = readFileSync('agent-runtime/requirements.txt', 'utf8')
const runtimeDir = 'agent-runtime/app'
const runtimeSource = readdirSync(runtimeDir)
  .filter((name) => name.endsWith('.py'))
  .map((name) => readFileSync(join(runtimeDir, name), 'utf8'))
  .join('\n')
const chatEntry = worker.slice(worker.indexOf('async function callAgentRuntime('), worker.indexOf('async function reviseAgentApproval('))
const mainChat = worker.slice(worker.indexOf('async function chatWithAi('), worker.indexOf('async function chatWithAiInstrumented('))

assert.ok(runtimeSource.includes('from google.adk.agents import LlmAgent'), 'ADK coordinator must use Google ADK LlmAgent')
assert.ok(runtimeSource.includes('Evidence Auditor'), 'ADK runtime must include an independent evidence auditor')
assert.ok(runtimeSource.includes('confirmation in {"signed-execute", "system-only"}'), 'model toolset must reject execute/system operations')
assert.ok(runtimeSource.includes('key != "confirmationToken"'), 'confirmation token must be removed before model/auditor context')
assert.ok(!/^\s*(?:from|import)\s+.*langgraph/im.test(runtimeSource), 'independent ADK runtime must not import LangGraph')
assert.ok(requirements.includes('google-adk[db]'), 'ADK database session dependency must be explicit')
assert.ok(!requirements.includes('google-adk[extensions]'), 'broad ADK extensions must not pull LangGraph into the runtime image')
assert.ok(chatEntry.includes("if (!env.ADK_AGENT_URL) throw new Error('Google ADK Runtime 未启用')"), 'chat entry must fail closed without ADK')
assert.equal(
  (mainChat.match(/if \(runtimeFailureMustStop\)/g) || []).length,
  2,
  'configured ADK must fail closed for both empty output and runtime errors',
)
assert.ok(mainChat.includes("const runtimeFailureMustStop = Boolean(env.ADK_AGENT_URL) || (requiresRuntime && env.LOCAL_DEV !== '1')"), 'only an explicitly local unconfigured runtime may exercise legacy compatibility tests')
assert.ok(!chatEntry.includes('ALICE_AGENT'), 'legacy Alice/LangGraph runtime must not participate in the chat request path')
assert.ok(!chatEntry.includes('applyAgentGroundingPolicy'), 'legacy keyword grounding policy must not participate in the chat request path')
assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS agent_adk_pending_actions'), 'D1 must durably hold private confirmation state')

console.log('Google ADK 主链架构守卫通过：语义编排、证据审核、写入隔离与旧主链隔离均已锁定。')
