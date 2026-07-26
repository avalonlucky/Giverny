import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const graph = readFileSync('src/agentRuntimeGraph.ts', 'utf8')
const worker = readFileSync('src/worker.ts', 'utf8')
const director = readFileSync('src/agentIntentDirector.ts', 'utf8')
const evaluation = readFileSync('agent-evals/run.mjs', 'utf8')

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
assert.ok(director.includes("complexity: 'simple' | 'complex'"), 'Director 没有区分简单与复杂请求')
assert.ok(director.includes('proposedCalls'), 'Director 不能在一次模型调用中提出简单动作')
assert.ok(evaluation.includes('orchestration?.modelCalls'), '评测没有检查模型调用预算')
assert.ok(evaluation.includes('irrelevantRetrieval'), '评测没有检查无关检索')

const bundle = await build({
  entryPoints: ['src/agentRuntimeGraph.ts'], bundle: true, platform: 'browser', format: 'esm', target: 'es2022',
  conditions: ['browser', 'worker', 'import', 'default'], write: false, logLevel: 'silent', minify: true,
})
const graphBundleBytes = bundle.outputFiles[0]?.contents.byteLength || 0
assert.ok(graphBundleBytes < 1_300_000, 'LangGraph Worker 子图体积超过 1.3MB，需要重新裁剪依赖')

console.log(`Agent 生产力架构守卫通过：LangGraph 条件路径、单模型快速路径、复杂重规划与评测预算已接入；子图 ${graphBundleBytes} bytes。`)
