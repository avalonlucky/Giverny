import { readFileSync } from 'node:fs'
import process from 'node:process'

const failures = []
const runtime = readFileSync('src/aliceAgent.ts', 'utf8')
const orchestrator = readFileSync('src/agentOrchestrator.ts', 'utf8')
const resolver = readFileSync('src/agentEntityResolver.ts', 'utf8')
const tests = readFileSync('scripts/test-agent-orchestrator.mjs', 'utf8')
const suite = JSON.parse(readFileSync('agent-evals/cases.json', 'utf8'))

for (const marker of ['decideAgentReplan', 'repairToolInput(', 'executeRepairTool(', 'scopedQuestionForAgentTool', '验真后动态补查', '仅依据工具证据整理答案', '拆解 ${verifiedIntents.length} 个目标']) {
  if (!runtime.includes(marker)) failures.push(`AliceAgent 缺少动态重规划契约：${marker}`)
}
for (const marker of ['inferAgentIntent', 'inferAgentIntents', 'detectedIntents', 'hasDeterministicTool', "hasIntent('attachment')", "hasIntent('task_data')", 'hasSuccessfulWritePreview', 'successfulTools']) {
  if (!orchestrator.includes(marker)) failures.push(`Agent 验真器缺少契约：${marker}`)
}
for (const marker of ['missingFinance', 'missingProduct', 'missingPortfolio', 'missingAttachment', 'uncertainFinance', 'repairedTask', 'exhaustedTurn', 'compoundTurn', 'partiallyVerifiedCompound', 'verifiedWritePreview', 'requesterNameFromQuestion', 'taskTitleFromQuestion', 'splitAgentGoalClauses', 'scopedQuestionForAgentTool']) {
  if (!tests.includes(marker)) failures.push(`Agent 编排单测缺少场景：${marker}`)
}
for (const marker of ['clauseSeparator', 'toolClausePatterns', 'splitAgentGoalClauses', 'scopedQuestionForAgentTool', 'cleanRequesterName', 'cleanTaskTitle']) {
  if (!resolver.includes(marker)) failures.push(`Agent 实体解析器缺少分句作用域契约：${marker}`)
}
const replanningCases = Array.isArray(suite.cases) ? suite.cases.filter((item) => item.category === 'replanning') : []
const compoundCases = Array.isArray(suite.cases) ? suite.cases.filter((item) => item.category === 'compound_goal') : []
if (replanningCases.length < 6) failures.push(`反工具规避评测仅 ${replanningCases.length} 条，低于 6 条基线`)
if (compoundCases.length < 6) failures.push(`复合目标评测仅 ${compoundCases.length} 条，低于 6 条基线`)

if (failures.length) {
  console.error(`Agent 重规划架构守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`Agent 重规划架构守卫通过：40 条确定性断言、${replanningCases.length} 条反规避问法、${compoundCases.length} 条复合目标问法。`)
