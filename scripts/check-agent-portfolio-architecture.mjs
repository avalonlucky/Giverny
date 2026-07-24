import { readFileSync } from 'node:fs'
import process from 'node:process'

const failures = []
const files = {
  registry: readFileSync('src/agentToolRegistry.ts', 'utf8'),
  orchestrator: readFileSync('src/agentOrchestrator.ts', 'utf8'),
  runtime: readFileSync('src/aliceAgent.ts', 'utf8'),
  worker: readFileSync('src/worker.ts', 'utf8'),
  evaluations: readFileSync('agent-evals/cases.json', 'utf8'),
}

for (const [name, source] of Object.entries(files)) {
  if (!source.includes('query_task_portfolio')) failures.push(`${name} 未接入 query_task_portfolio`)
}

for (const marker of [
  "scope: z.enum(['all', 'unfinished', 'overdue', 'waiting', 'accepted'])",
  "endpoint: 'task-portfolio'",
  "'/api/agent/tools/task-portfolio'",
  "activeWaiting",
  "latestProgress",
  "overdueDays",
]) {
  if (!`${files.registry}\n${files.worker}`.includes(marker)) failures.push(`跨任务工具缺少契约：${marker}`)
}

const suite = JSON.parse(files.evaluations)
const portfolioCases = Array.isArray(suite.cases)
  ? suite.cases.filter((item) => item.category === 'portfolio_query' && item.expect?.tools?.includes('query_task_portfolio'))
  : []
if (portfolioCases.length < 8) failures.push(`跨任务问法仅覆盖 ${portfolioCases.length} 条，低于 8 条基线`)

if (!files.orchestrator.includes('asksPortfolio')) failures.push('验真器未强制跨任务问题使用聚合工具')
if (!files.runtime.includes('不要用标题关键词搜索代替全量聚合')) failures.push('主 Agent 缺少跨任务查询路由规则')

if (failures.length) {
  console.error(`Agent 跨任务架构守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log(`Agent 跨任务架构守卫通过：${portfolioCases.length} 条问法共享确定性工作概况工具。`)
