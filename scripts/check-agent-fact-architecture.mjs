import { readFileSync } from 'node:fs'
import process from 'node:process'

const failures = []
const runtime = readFileSync('src/aliceAgent.ts', 'utf8')
const guard = readFileSync('src/agentFactGuard.ts', 'utf8')
const tests = readFileSync('scripts/test-agent-fact-guard.mjs', 'utf8')

for (const marker of ['buildAgentFactSnapshot', 'verifyAgentFactClaims', 'shouldGroundAnswer', '仅依据工具证据整理答案', '关键事实逐字段校验通过', '已改用权威事实摘要']) {
  if (!runtime.includes(marker)) failures.push(`AliceAgent 缺少最终事实验真契约：${marker}`)
}
for (const marker of ['renderFinance', 'renderTaskDetail', 'renderProfile', 'renderAttachments', 'renderProductHelp', 'numericClaims', 'chineseNumber', 'chineseClaims', 'taskStatuses']) {
  if (!guard.includes(marker)) failures.push(`Agent 事实保护层缺少契约：${marker}`)
}
for (const marker of ['实际投入3小时', '实际投入三小时', '结算金额1200元', '结算金额一千二百元', '任务#99', '目前进行中', '2026年6月23日', '有4个附件', '有四个附件', '验收通过率80%']) {
  if (!tests.includes(marker)) failures.push(`Agent 事实保护测试缺少错误场景：${marker}`)
}

if (failures.length) {
  console.error(`Agent 事实保护架构守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('Agent 事实保护架构守卫通过：金额、工时、日期、状态、任务 ID 与百分比均有确定性错误样本。')
