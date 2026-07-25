import { readFileSync } from 'node:fs'
import process from 'node:process'

const failures = []
const runtime = readFileSync('src/aliceAgent.ts', 'utf8')
const worker = readFileSync('src/worker.ts', 'utf8')
const guard = readFileSync('src/agentFactGuard.ts', 'utf8')
const tests = readFileSync('scripts/test-agent-fact-guard.mjs', 'utf8')
const productionCheck = readFileSync('scripts/check-production-agent-facts.mjs', 'utf8')

for (const marker of ['buildAgentFactSnapshot', 'verifyAgentFactClaims', 'shouldGroundAnswer', '结构化事实协议生成答案', 'factVerificationSummary']) {
  if (!runtime.includes(marker)) failures.push(`AliceAgent 缺少最终事实验真契约：${marker}`)
}
for (const marker of ['renderFinance', 'renderTaskDetail', 'renderProfile', 'renderAttachments', 'renderProductHelp', 'renderSettlement', 'renderTaskMemory', 'renderTaskPlan', 'AgentFactClaim', 'AgentFactSection', 'runAgentFactProtocolSelfTest', 'numericClaims', 'chineseNumber', 'chineseClaims', 'taskStatuses']) {
  if (!guard.includes(marker)) failures.push(`Agent 事实保护层缺少契约：${marker}`)
}
for (const marker of ['buildAgentFactSnapshot(finalEvidence)', 'verifyAgentFactClaims(finalContent, factSnapshot)', 'legacyFactVerification', 'factVerification: runtimeResult.factVerification', 'runAgentFactProtocolSelfTest()', '结构化事实协议生成答案']) {
  if (!worker.includes(marker)) failures.push(`Worker 兼容 Agent 链路缺少统一事实协议：${marker}`)
}
for (const marker of ['实际投入3小时', '实际投入三小时', '结算金额1200元', '结算金额一千二百元', '任务#99', '目前进行中', '2026年6月23日', '有4个附件', '有四个附件', '验收通过率80%']) {
  if (!tests.includes(marker)) failures.push(`Agent 事实保护测试缺少错误场景：${marker}`)
}
for (const marker of ['agentFactProtocol', 'rejectedInvalidAnswer', 'checkedClaims', 'coveredSources']) {
  if (!productionCheck.includes(marker)) failures.push(`生产事实协议验收缺少契约：${marker}`)
}

if (failures.length) {
  console.error(`Agent 事实保护架构守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('Agent 事实保护架构守卫通过：AliceAgent、Worker 兼容链路和全部业务读取工具共用结构化事实协议。')
