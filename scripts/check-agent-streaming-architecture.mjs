import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const worker = readFileSync('src/worker.ts', 'utf8')
const streamStart = worker.indexOf('function streamChatWithAiInstrumented')
const streamSource = worker.slice(streamStart)
const tokenEstimateIndex = streamSource.indexOf('const promptTokensPromise = estimateAgentRequestTokens')
const localRouteIndex = streamSource.indexOf('const localDecision: LocalCliChatDecision')

// 思考链只允许显示真实推理步骤。预设开场句会被后续 send 整条覆盖
// （前端是 trace: event.trace 全量赋值），结果只剩一句静止的假进度。
assert.ok(
  !streamSource.includes('正在理解问题并确认需要的证据'),
  '流式思考链不得使用预设开场句冒充推理过程',
)
assert.ok(streamSource.includes('const routingTrace: string[] = []'), '可见步骤必须由真实事件填充，不得预置文案')
assert.ok(tokenEstimateIndex >= 0, 'Token 统计必须异步化')
assert.ok(streamSource.includes('await promptTokensPromise'), 'Token 统计只能在收尾处兑现，不能阻塞流')
assert.ok(tokenEstimateIndex < localRouteIndex, 'Token 统计必须在路由判断前就并行发起')
assert.ok(streamSource.includes('const emitCloudTrace'), '编排步骤必须实时转发给客户端')
assert.match(streamSource, /x-accel-buffering['"]:\s*['"]no['"]|['"]x-accel-buffering['"]\s*:\s*['"]no['"]/) 
assert.match(streamSource, /env\.ADK_AGENT_URL[\s\S]*Google ADK 语义编排与证据审核主链/)
assert.match(worker, /连接中，读取可用的工具/)

console.log('Agent streaming feedback architecture guard passed.')
