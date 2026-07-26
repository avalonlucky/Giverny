import { readFileSync } from 'node:fs'
import process from 'node:process'
import { agentCapabilityRegistry } from '../src/agentToolRegistry.ts'

const failures = []
const runtime = readFileSync('src/aliceAgent.ts', 'utf8')
const orchestrator = readFileSync('src/agentOrchestrator.ts', 'utf8')
const worker = readFileSync('src/worker.ts', 'utf8')
const evaluator = readFileSync('agent-evals/run.mjs', 'utf8')
const suite = JSON.parse(readFileSync('agent-evals/multiturn-cases.json', 'utf8'))

for (const marker of [
  'taskReference: TaskReference | null',
  'selectedTaskReference(message',
  'withTaskReference(input',
  'taskEvidenceMismatch(',
  'deterministic: !mismatch',
  '当前会话已确认任务',
]) {
  if (!runtime.includes(marker)) failures.push(`AliceAgent 缺少会话引用契约：${marker}`)
}

if (!orchestrator.includes('taskId: Number(item.args.taskId)')) failures.push('Agent 审计记录未保留非敏感 taskId 供验真')
if (!agentCapabilityRegistry.query_task_portfolio.exposure.includes('mcp') || !worker.includes('Object.entries(agentReadToolRegistry)')) failures.push('跨任务工具未通过统一注册表接入 MCP')
if (!worker.includes("method: 'POST'") || !worker.includes('body: JSON.stringify(input)')) failures.push('MCP 工具未保留数组与结构化参数')
if (!evaluator.includes('multiTurnCases') || !evaluator.includes('taskId=')) failures.push('Agent 评测器未执行多轮 taskId 继承校验')

const cases = Array.isArray(suite.cases) ? suite.cases : []
if (cases.length < 14) failures.push(`多轮对话用例仅 ${cases.length} 组，低于 14 组基线`)
const turns = cases.reduce((sum, item) => sum + (Array.isArray(item.turns) ? item.turns.length : 0), 0)
if (turns < 28) failures.push(`多轮对话仅 ${turns} 轮，低于 28 轮基线`)

if (failures.length) {
  console.error(`Agent 会话引用架构守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log(`Agent 会话引用架构守卫通过：${cases.length} 组会话、${turns} 轮引用、工作流与失败恢复覆盖。`)
