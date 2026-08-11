import { readFileSync } from 'node:fs'
import process from 'node:process'

const failures = []
const agents = readFileSync('agent-runtime/app/agents.py', 'utf8')
const runtime = readFileSync('agent-runtime/app/runtime.py', 'utf8')
const tooling = readFileSync('agent-runtime/app/tooling.py', 'utf8')
const worker = readFileSync('src/worker.ts', 'utf8')
const suite = JSON.parse(readFileSync('agent-runtime/evals/semantic-cases.json', 'utf8'))
const chatEntry = worker.slice(worker.indexOf('async function callAgentRuntime('), worker.indexOf('async function reviseAgentApproval('))
const streamEntry = worker.slice(worker.indexOf('function streamChatWithAiInstrumented'), worker.indexOf('function parseAgentMetricTools'))

for (const marker of [
  'Root Coordinator',
  '不得根据单个关键词判断意图',
  '不得将“版本”默认理解为 Giverny 产品版本',
  'workspace_analyst',
  'product_support',
  'web_researcher',
  'transaction_specialist',
]) if (!agents.includes(marker)) failures.push(`ADK 语义编排缺少：${marker}`)

for (const marker of ['response_synthesizer', 'evidence_auditor', 'Evidence Auditor', 'deterministic_verify', 'semantic_audit']) {
  if (!`${agents}\n${runtime}`.includes(marker)) failures.push(`回答合成或独立校验缺少：${marker}`)
}

for (const marker of ['OpenAPIToolset', 'select_operation_ids', 'confirmation in {"signed-execute", "system-only"}', 'include_preview']) {
  if (!tooling.includes(marker)) failures.push(`ADK 工具权限边界缺少：${marker}`)
}

if (!chatEntry.includes('callAdkAgentRuntime')) failures.push('Worker 主聊天未调用 ADK Runtime')
for (const forbidden of ['ALICE_AGENT', 'runAgentRuntimeGraph(', 'applyAgentGroundingPolicy', 'directAgentRequest(']) {
  if (chatEntry.includes(forbidden)) failures.push(`ADK 主链仍受旧框架干扰：${forbidden}`)
}
if (!streamEntry.includes('env.ADK_AGENT_URL') || !streamEntry.includes("{ route: null, cloudReason: '已交由 Google ADK")) {
  failures.push('已配置 ADK 时流式入口仍可能被本机 CLI 抢占')
}
// 路由原因可以写进审计，但不能出现在用户看到的思考链里。
if (!streamEntry.includes('internalOnly: true') || !streamEntry.includes('!localDecision.internalOnly')) {
  failures.push('内部编排原因（框架名、主链名称）可能泄漏进用户可见思考链')
}

const cases = suite.cases || []
for (const id of ['publication-version-direct', 'publication-version-paraphrase', 'version-dimension-conflict', 'product-release-real', 'multiturn-reference', 'ambiguous-entity']) {
  if (!cases.some((item) => item.id === id)) failures.push(`缺少语义回归用例：${id}`)
}
const publication = cases.find((item) => item.id === 'publication-version-direct')
if (publication?.expected?.specialist !== 'workspace_analyst' || publication?.expected?.forbiddenSpecialist !== 'product_support') {
  failures.push('《昂楷之道》回归未显式隔离工作区与产品版本')
}

if (failures.length) {
  console.error(`Agent 语义编排守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log('Agent 语义编排守卫通过：Google ADK 总管、专家委派、证据双校验与旧链路隔离均已锁定。')
