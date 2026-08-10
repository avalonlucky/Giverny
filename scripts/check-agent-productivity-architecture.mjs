import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const runtime = readFileSync('agent-runtime/app/runtime.py', 'utf8')
const schemas = readFileSync('agent-runtime/app/schemas.py', 'utf8')
const worker = readFileSync('src/worker.ts', 'utf8')
const migration = readFileSync('db/migrations/0036_agent_productivity_metrics.sql', 'utf8')
const metrics = readFileSync('src/agentProductivityMetrics.ts', 'utf8')
const api = readFileSync('src/lib/api.ts', 'utf8')
const settings = readFileSync('src/views/SettingsView.tsx', 'utf8')

for (const marker of ['"engine": "google-adk-2"', '"status": "complete" if passed', '"cycles": 1', '"toolCalls": len(evidence.records)', '"reason":']) {
  assert.ok(runtime.includes(marker), `ADK 生产力指标缺少 ${marker}`)
}
assert.ok(schemas.includes('productivity: dict[str, Any]'), 'ADK 响应契约缺少 productivity')
assert.ok(worker.includes("engine: 'google-adk-2' | 'langgraph'"), 'Worker 未接收 ADK 生产力契约')

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

console.log('Agent 生产力架构守卫通过：ADK 闭环结果、证据工具计数与长期匿名指标已接通。')
