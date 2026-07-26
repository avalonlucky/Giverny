import { readFileSync } from 'node:fs'
import process from 'node:process'
import { agentRegressionCatalog } from '../src/agentRegressionCatalog.ts'

const failures = []
const worker = readFileSync('src/worker.ts', 'utf8')
const schema = readFileSync('db/schema.sql', 'utf8')
const api = readFileSync('src/lib/api.ts', 'utf8')
const panel = readFileSync('src/components/AiOperationsCenterPanel.tsx', 'utf8')
const suite = JSON.parse(readFileSync('agent-evals/multiturn-cases.json', 'utf8'))

for (const marker of [
  'agent_effect_events',
  'agent_effect_snapshots',
  'approval_revised',
  'estimatedAgentMinutesSaved(',
  'calculateAgentEffectiveness(',
  "path === '/api/ai/agent-effectiveness'",
  'snapshotAgentEffectiveness(env)',
]) if (!worker.includes(marker)) failures.push(`Worker 缺少长期效果契约：${marker}`)

for (const marker of ['agent_effect_events', 'agent_effect_snapshots', 'regression_case_id', 'last_verified_version', 'app_version']) {
  if (!schema.includes(marker)) failures.push(`数据库缺少 Agent 质量字段：${marker}`)
}

if (!api.includes('effectiveness: AgentEffectiveness')) failures.push('前端 API 类型缺少长期效果对象')
if (!panel.includes('operations.effectiveness')) failures.push('运行与质量中心未消费长期效果对象')
for (const marker of ['taskCompletionRate', 'humanCorrectionRate', 'executionQualityRate', 'estimatedMinutesSaved']) {
  if (!api.includes(marker)) failures.push(`前端 API 类型缺少长期效果指标：${marker}`)
  if (!panel.includes(marker)) failures.push(`运行与质量中心缺少长期效果展示：${marker}`)
}

const cases = Array.isArray(suite.cases) ? suite.cases : []
const caseIds = new Set(cases.map((item) => item.id))
const regressionIds = new Set(cases.flatMap((item) => item.regressionCaseIds || []))
for (const regression of agentRegressionCatalog) {
  if (!caseIds.has(regression.conversationCaseId)) failures.push(`${regression.id} 指向不存在的对话回归`)
  if (!regressionIds.has(regression.id)) failures.push(`${regression.id} 未被对话回归声明覆盖`)
}
if (agentRegressionCatalog.length < 8) failures.push(`失败指纹目录仅 ${agentRegressionCatalog.length} 项，低于 8 项基线`)

if (failures.length) {
  console.error(`Agent 长期效果架构守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log(`Agent 长期效果架构守卫通过：${agentRegressionCatalog.length} 类失败指纹、4 项长期指标、每日版本快照均已接入。`)
