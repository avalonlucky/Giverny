import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const worker = readFileSync('src/worker.ts', 'utf8')
const streamStart = worker.indexOf('function streamChatWithAiInstrumented')
const streamSource = worker.slice(streamStart)
const initialTraceIndex = streamSource.indexOf("send({ type: 'trace', status: 'running', trace: ['正在理解问题并确认需要的证据'] })")
const tokenEstimateIndex = streamSource.indexOf('const promptTokensPromise = estimateAgentRequestTokens')
const localRouteIndex = streamSource.indexOf('const localDecision: LocalCliChatDecision')

assert.ok(initialTraceIndex >= 0, '流式请求必须立即发送首条可见反馈')
assert.ok(tokenEstimateIndex >= 0, 'Token 统计必须异步化')
assert.ok(initialTraceIndex < tokenEstimateIndex, '首条反馈不能等待 Token 统计')
assert.ok(initialTraceIndex < localRouteIndex, '首条反馈不能等待本机/云端路由判断')
assert.match(streamSource, /x-accel-buffering['"]:\s*['"]no['"]|['"]x-accel-buffering['"]\s*:\s*['"]no['"]/) 
assert.match(streamSource, /env\.ADK_AGENT_URL[\s\S]*Google ADK 语义编排与证据审核主链/)
assert.match(worker, /连接中，读取可用的工具/)

console.log('Agent streaming feedback architecture guard passed.')
