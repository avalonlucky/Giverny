import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const graph = readFileSync('src/agentRuntimeGraph.ts', 'utf8')
const productivityGraph = readFileSync('src/agentProductivityGraph.ts', 'utf8')
const worker = readFileSync('src/worker.ts', 'utf8')
const alice = readFileSync('src/aliceAgent.ts', 'utf8')
const director = readFileSync('src/agentIntentDirector.ts', 'utf8')
const evaluation = readFileSync('agent-evals/run.mjs', 'utf8')
const migration = readFileSync('db/migrations/0036_agent_productivity_metrics.sql', 'utf8')
const metrics = readFileSync('src/agentProductivityMetrics.ts', 'utf8')
const api = readFileSync('src/lib/api.ts', 'utf8')
const settings = readFileSync('src/views/SettingsView.tsx', 'utf8')

for (const marker of [
  'StateGraph',
  "addNode('understand'",
  "addNode('direct_authorize'",
  "addNode('plan_node'",
  "state.calls.length > 0 ? 'finish' : 'plan_node'",
  'modelCalls',
]) {
  assert.ok(graph.includes(marker), `LangGraph 主链缺少 ${marker}`)
}
for (const marker of ['runAgentRuntimeGraph(', 'directAgentOperationCatalog', "engine: 'langgraph'", 'orchestration.modelCalls']) {
  assert.ok(worker.includes(marker), `Worker 未接入生产力编排契约：${marker}`)
}
for (const marker of ['StateGraph', "addNode('execute_batch'", "addNode('observe_results'", "addNode('replan_node'", 'maxCycles', 'maxToolCalls']) {
  assert.ok(productivityGraph.includes(marker), `LangGraph 生产力闭环缺少 ${marker}`)
}
for (const marker of ['runAgentProductivityGraph(', 'productivity.cycles', 'productivity.toolCalls', "engine: 'langgraph'"]) {
  assert.ok(alice.includes(marker), `Alice 未接入生产力闭环：${marker}`)
}
assert.ok(!alice.includes('for (let attempt = 2; attempt <= 3'), 'Alice 仍保留旧的手写三轮补查循环')
assert.ok(director.includes("complexity: 'simple' | 'complex'"), 'Director 没有区分简单与复杂请求')
assert.ok(director.includes('proposedCalls'), 'Director 不能在一次模型调用中提出简单动作')
assert.ok(evaluation.includes('orchestration?.modelCalls'), '评测没有检查模型调用预算')
assert.ok(evaluation.includes('irrelevantRetrieval'), '评测没有检查无关检索')
assert.ok(evaluation.includes('productivity?.status'), '评测没有检查生产力闭环终止状态')

for (const marker of ['productivity_status', 'productivity_cycles', 'productivity_tool_calls', 'productivity_reason_code', 'conversation_hash']) {
  assert.ok(migration.includes(marker), `生产力指标迁移缺少 ${marker}`)
  assert.ok(worker.includes(marker), `Worker 未持久化生产力指标 ${marker}`)
}
assert.ok(metrics.includes('summarizeAgentProductivity'), '生产力指标缺少统一确定性聚合入口')
for (const marker of ['goalCompletionRate', 'firstPassCompletionRate', 'recoveryRate', 'followUpResolutionRate']) {
  assert.ok(metrics.includes(marker), `生产力指标聚合缺少 ${marker}`)
  assert.ok(api.includes(marker), `前端 API 契约缺少 ${marker}`)
}
for (const marker of ['目标完成率', '首轮完成率', '补查恢复率', '待补充后解决率']) {
  assert.ok(settings.includes(marker), `模型设置页缺少生产力指标：${marker}`)
}
assert.ok(worker.includes("crypto.subtle.digest('SHA-256'"), '会话关联没有使用匿名 SHA-256 哈希')
assert.ok(!/question|answer|prompt|response/i.test(migration), '生产力指标迁移禁止保存问题、回答、提示词或响应正文')
assert.ok(!/question|answer|prompt|response/i.test(metrics), '生产力指标聚合禁止依赖问题、回答、提示词或响应正文')

const bundle = await build({
  entryPoints: ['src/agentRuntimeGraph.ts'], bundle: true, platform: 'browser', format: 'esm', target: 'es2022',
  conditions: ['browser', 'worker', 'import', 'default'], write: false, logLevel: 'silent', minify: true,
})
const graphBundleBytes = bundle.outputFiles[0]?.contents.byteLength || 0
assert.ok(graphBundleBytes < 1_300_000, 'LangGraph Worker 子图体积超过 1.3MB，需要重新裁剪依赖')

console.log(`Agent 生产力架构守卫通过：LangGraph 条件路径、单模型快速路径、复杂重规划与评测预算已接入；子图 ${graphBundleBytes} bytes。`)
