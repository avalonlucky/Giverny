import { readFileSync } from 'node:fs'
import process from 'node:process'

const failures = []
const runtime = readFileSync('src/aliceAgent.ts', 'utf8')
const orchestrator = readFileSync('src/agentOrchestrator.ts', 'utf8')
const tests = readFileSync('scripts/test-agent-orchestrator.mjs', 'utf8')
const suite = JSON.parse(readFileSync('agent-evals/cases.json', 'utf8'))

for (const marker of ['decideAgentReplan', 'repairToolInput(', 'executeRepairTool(', '验真后动态补查', '依据补齐后重新整理答案']) {
  if (!runtime.includes(marker)) failures.push(`AliceAgent 缺少动态重规划契约：${marker}`)
}
for (const marker of ['inferAgentIntent', 'hasDeterministicTool', "intent === 'attachment'", "intent === 'task_data'", 'successfulTools']) {
  if (!orchestrator.includes(marker)) failures.push(`Agent 验真器缺少契约：${marker}`)
}
for (const marker of ['missingFinance', 'missingProduct', 'missingPortfolio', 'missingAttachment', 'uncertainFinance', 'repairedTask', 'exhaustedTurn', 'requesterNameFromQuestion', 'taskTitleFromQuestion']) {
  if (!tests.includes(marker)) failures.push(`Agent 编排单测缺少场景：${marker}`)
}
const replanningCases = Array.isArray(suite.cases) ? suite.cases.filter((item) => item.category === 'replanning') : []
if (replanningCases.length < 6) failures.push(`反工具规避评测仅 ${replanningCases.length} 条，低于 6 条基线`)

if (failures.length) {
  console.error(`Agent 重规划架构守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`Agent 重规划架构守卫通过：21 条确定性断言、${replanningCases.length} 条反规避问法。`)
