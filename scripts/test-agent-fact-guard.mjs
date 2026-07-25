import assert from 'node:assert/strict'
import { buildAgentFactSnapshot, runAgentFactProtocolSelfTest, verifyAgentFactClaims } from '../src/agentFactGuard.ts'

const evidence = (toolName, payload) => ({
  id: `evidence-${toolName}`,
  toolCallId: `call-${toolName}`,
  toolName,
  source: 'd1',
  deterministic: true,
  payload,
})

const finance = buildAgentFactSnapshot([evidence('query_month_finance', {
  tool: 'query_month_finance',
  hourlyRate: 300,
  months: ['2026-06'],
  totalBillableHours: 5,
  totalAmount: 1500,
  stats: [{ month: '2026-06', billableHours: 5, totalHours: 5, amount: 1500, taskCount: 2 }],
})])

assert.ok(finance.fallbackAnswer.includes('合计计费工时：5 小时'))
assert.ok(finance.fallbackAnswer.includes('合计结算金额：¥1,500'))
assert.deepEqual(finance.numbers.hours, [5])
assert.ok(finance.numbers.money.includes(300))
assert.ok(finance.numbers.money.includes(1500))
assert.ok(finance.claims.length > 0)
assert.equal(finance.sections.length, 1)
assert.equal(verifyAgentFactClaims('2026年6月共计费5小时，金额1500元。', finance).passed, false)
assert.equal(verifyAgentFactClaims(`结论已核对。\n\n${finance.fallbackAnswer}`, finance).passed, true)
assert.equal(verifyAgentFactClaims(finance.fallbackAnswer, finance).passed, true)
assert.equal(verifyAgentFactClaims('实际投入3小时。', finance).passed, false)
assert.equal(verifyAgentFactClaims('实际投入三小时。', finance).passed, false)
assert.equal(verifyAgentFactClaims('实际投入五小时。', finance).passed, false)
assert.equal(verifyAgentFactClaims('结算金额1200元。', finance).passed, false)
assert.equal(verifyAgentFactClaims('结算金额一千二百元。', finance).passed, false)
assert.equal(verifyAgentFactClaims('这是2026年7月的数据。', finance).passed, false)

const task = buildAgentFactSnapshot([evidence('get_task_detail', {
  tool: 'get_task_detail',
  task: {
    id: 12,
    title: '官网首页轮播图',
    status: '已验收',
    progress: 100,
    estimatedHours: 4,
    actualHours: 5,
    date: '2026-06-01',
    estimatedDate: '2026-06-03',
    actualDeliveryDate: '2026-06-03',
  },
  waitingRecords: [],
  files: [{ id: 88, taskId: 12, name: '轮播图终稿.pdf' }],
})])

assert.ok(task.fallbackAnswer.includes('任务 #12'))
assert.ok(task.fallbackAnswer.includes('状态：已验收'))
assert.equal(verifyAgentFactClaims(task.fallbackAnswer, task).passed, true)
assert.equal(verifyAgentFactClaims('任务#12已经验收，实际5小时，2026年6月3日完成。', task).passed, false)
assert.equal(verifyAgentFactClaims(`任务已经完成。\n\n${task.fallbackAnswer}`, task).passed, true)
assert.equal(verifyAgentFactClaims('任务#99已经验收。', task).passed, false)
assert.equal(verifyAgentFactClaims('任务#12目前进行中。', task).passed, false)
assert.equal(verifyAgentFactClaims('任务#12实际3小时。', task).passed, false)
assert.equal(verifyAgentFactClaims('任务#12在2026年6月23日完成。', task).passed, false)
assert.equal(verifyAgentFactClaims('任务#12有4个附件。', task).passed, false)
assert.equal(verifyAgentFactClaims('任务#12有四个附件。', task).passed, false)

const profile = buildAgentFactSnapshot([evidence('get_requester_profile', {
  tool: 'get_requester_profile',
  found: true,
  profile: {
    name: '陈义君',
    projects: 3,
    hours: 12.5,
    acceptanceRate: 100,
    onTimeRate: 100,
    hourDeviationRate: 0,
    avgRevisionCount: 0.3,
    waitingHours: 2,
    traits: ['单项目平均 4.17h，高于全站需求人均值 2.01h'],
    advice: ['保持当前记录粒度。'],
  },
})])

assert.ok(profile.fallbackAnswer.includes('累计工时 12.5 小时'))
assert.equal(verifyAgentFactClaims('累计12.5小时，验收通过率100%。', profile).passed, false)
assert.equal(verifyAgentFactClaims(`画像已经核对。\n\n${profile.fallbackAnswer}`, profile).passed, true)
assert.ok(profile.numbers.hours.includes(4.17) && profile.numbers.hours.includes(2.01))
assert.equal(verifyAgentFactClaims(profile.fallbackAnswer.replace('2.01h', '9.9h'), profile).passed, false)
assert.equal(verifyAgentFactClaims('累计10小时，验收通过率80%。', profile).passed, false)
assert.equal(verifyAgentFactClaims('累计十小时，验收通过率八十%。', profile).passed, false)

const product = buildAgentFactSnapshot([evidence('search_product_help', {
  tool: 'search_product_help',
  matches: [{ title: '模型设置', content: '在设置页选择首选文字模型。' }],
})])
assert.ok(product.fallbackAnswer.includes('模型设置'))
assert.equal(verifyAgentFactClaims(product.fallbackAnswer, product).passed, true)

const legacyFinance = buildAgentFactSnapshot([evidence('query_month_finance', {
  hourlyRate: 300,
  stats: [{ month: '2026-06', billableHours: 5, totalHours: 5, amount: 1500, taskCount: 2 }],
})])
assert.ok(legacyFinance.fallbackAnswer.includes('合计结算金额：¥1,500'))
assert.equal(verifyAgentFactClaims(legacyFinance.fallbackAnswer, legacyFinance).passed, true)

const legacyTask = buildAgentFactSnapshot([evidence('get_task_detail', {
  count: 1,
  results: [{ task: { id: 12, title: '官网首页轮播图', status: '已验收', progress: 100, estimatedHours: 4, actualHours: 5, date: '2026-06-01', actualDeliveryDate: '2026-06-03' }, waitingRecords: [] }],
})])
assert.ok(legacyTask.fallbackAnswer.includes('任务 #12'))
assert.equal(verifyAgentFactClaims(legacyTask.fallbackAnswer, legacyTask).passed, true)

const settlement = buildAgentFactSnapshot([evidence('export_settlement_receipt', {
  record: { startDate: '2026-06-01', endDate: '2026-06-30' },
  receipt: { taskCount: 2, totalHours: 5, totalAmount: 1500 },
})])
assert.ok(settlement.fallbackAnswer.includes('金额：¥1,500'))
assert.equal(verifyAgentFactClaims(settlement.fallbackAnswer, settlement).passed, true)

const memory = buildAgentFactSnapshot([evidence('get_task_memory', {
  memory: { taskId: 77, taskTitle: '产品封套修改', summary: '等待确认封面方向', openItems: ['确认颜色'], preferences: ['简洁排版'] },
})])
assert.ok(memory.fallbackAnswer.includes('任务 #77 产品封套修改'))
assert.equal(verifyAgentFactClaims(memory.fallbackAnswer, memory).passed, true)

const plan = buildAgentFactSnapshot([evidence('create_task_plan', {
  plan: { goal: '完成官网改版', steps: [{ label: '完成初稿', status: 'pending' }, { label: '提交验收', status: 'pending' }] },
})])
assert.ok(plan.fallbackAnswer.includes('持续计划：完成官网改版'))
assert.equal(verifyAgentFactClaims(plan.fallbackAnswer, plan).passed, true)

const settlementExports = buildAgentFactSnapshot([evidence('query_settlement_exports', {
  count: 1,
  records: [{ startDate: '2026-06-01', endDate: '2026-07-22', locked: true, totalAmount: 4200, disabled: false, expiresAt: '2026-08-01T00:00:00+08:00' }],
})])
assert.ok(settlementExports.fallbackAnswer.includes('2026-06-01 至 2026-07-22'))
assert.ok(settlementExports.fallbackAnswer.includes('已锁定'))
assert.ok(settlementExports.fallbackAnswer.includes('¥4,200'))
assert.equal(verifyAgentFactClaims(settlementExports.fallbackAnswer, settlementExports).passed, true)

const schedule = buildAgentFactSnapshot([evidence('check_schedule_conflicts', {
  startDate: '2026-07-25T14:30:00+08:00', endDate: '2026-07-25T16:30:00+08:00', conflictCount: 1, scheduledHours: 2,
  conflicts: [{ taskId: 12, title: '官网首页轮播图', startDate: '2026-07-25T14:00:00+08:00', endDate: '2026-07-25T15:00:00+08:00' }],
})])
assert.ok(schedule.fallbackAnswer.includes('重叠任务：1 项'))
assert.ok(schedule.fallbackAnswer.includes('任务 #12'))
assert.equal(verifyAgentFactClaims(schedule.fallbackAnswer, schedule).passed, true)

const upload = buildAgentFactSnapshot([evidence('prepare_attachment_upload', {
  handoff: { taskId: 12, taskTitle: '官网首页轮播图', scope: 'acceptance', files: [{ name: '验收通过截图.png' }], apiKeyExposed: false },
})])
assert.ok(upload.fallbackAnswer.includes('验收通过截图.png'))
assert.ok(upload.fallbackAnswer.includes('直接上传 R2'))
assert.equal(verifyAgentFactClaims(upload.fallbackAnswer, upload).passed, true)

const aiSettings = buildAgentFactSnapshot([evidence('inspect_ai_settings', {
  activeChoice: 'provider:deepseek',
  routes: { textPrimary: { provider: 'deepseek', model: 'deepseek-reasoner', hasApiKey: true } },
  secretsExposed: false,
})])
assert.ok(aiSettings.fallbackAnswer.includes('deepseek-reasoner'))
assert.ok(aiSettings.fallbackAnswer.includes('API Key 未进入 Agent 上下文'))
assert.ok(!aiSettings.fallbackAnswer.includes('sk-'))
assert.equal(verifyAgentFactClaims(aiSettings.fallbackAnswer, aiSettings).passed, true)

const aiRouteTest = buildAgentFactSnapshot([evidence('test_ai_route', {
  route: 'textPrimary', provider: 'deepseek', model: 'deepseek-reasoner', ok: true, apiKeyExposed: false,
})])
assert.ok(aiRouteTest.fallbackAnswer.includes('状态：可用'))
assert.ok(aiRouteTest.fallbackAnswer.includes('API Key 未显示'))
assert.equal(verifyAgentFactClaims(aiRouteTest.fallbackAnswer, aiRouteTest).passed, true)

const attachmentEvidence = buildAgentFactSnapshot([evidence('inspect_attachment_evidence', {
  count: 1,
  evidence: [{
    evidenceRef: '[attachment:101]', analysisRef: '[attachment:101:analysis]', extractedTextRef: '[attachment:101:extracted-text]',
    file: { id: 101, taskId: 13, taskTitle: '直播设计', name: '直播封面V1.0B01.jpg' },
    task: { id: 13, title: '直播设计' },
    analysis: { status: 'completed', parserKind: 'image-direct', summary: '直播封面包含活动标题与时间。', extractedText: '安全直播 6月29日', qualityIssues: [], requirementMatches: ['活动主题与需求一致'] },
  }],
})])
assert.ok(attachmentEvidence.fallbackAnswer.includes('[attachment:101]'))
assert.ok(attachmentEvidence.fallbackAnswer.includes('[attachment:101:analysis]'))
assert.ok(attachmentEvidence.fallbackAnswer.includes('安全直播 6月29日'))
assert.equal(verifyAgentFactClaims(attachmentEvidence.fallbackAnswer, attachmentEvidence).passed, true)

const attachmentQueue = buildAgentFactSnapshot([evidence('query_attachment_analysis', {
  count: 1,
  items: [{ evidenceRef: '[attachment:102:analysis]', file: { id: 102, taskId: 13, name: '直播封面.pdf' }, status: 'failed', attemptCount: 2, errorMessage: '模型暂时不可用' }],
})])
assert.ok(attachmentQueue.fallbackAnswer.includes('failed'))
assert.ok(attachmentQueue.fallbackAnswer.includes('模型暂时不可用'))
assert.equal(verifyAgentFactClaims(attachmentQueue.fallbackAnswer, attachmentQueue).passed, true)

const proactive = buildAgentFactSnapshot([evidence('query_proactive_work', {
  summary: { open: 2, critical: 1, high: 1, handledTotal: 5, resolutionRate: 80, dismissalRate: 20, averageResponseMinutes: 35 },
  items: [{ taskId: 12, priority: 'critical', title: '官网首页轮播图已逾期 3 天', evidence: ['预计交付日期：2026-07-22', '当前进度：60%'], recommendation: '核对延期原因并更新进展。' }],
})])
assert.ok(proactive.fallbackAnswer.includes('待处理：2 项'))
assert.ok(proactive.fallbackAnswer.includes('解决率 80%'))
assert.ok(proactive.fallbackAnswer.includes('任务 #12'))
assert.ok(proactive.fallbackAnswer.includes('预计交付日期：2026-07-22'))
assert.equal(verifyAgentFactClaims(proactive.fallbackAnswer, proactive).passed, true)

const enterpriseMemory = buildAgentFactSnapshot([evidence('query_enterprise_memory', {
  summary: { active: 2, organization: 1, partner: 1, project: 0 },
  memories: [{ id: 'memory-1', scopeType: 'partner', scopeKey: '昂楷', title: '验收文件偏好', content: '验收时优先提供 PDF。', sourceLabel: '2026-07-25 与刘总确认', version: 2, expiresAt: '2027-07-25T00:00:00.000Z' }],
})])
assert.ok(enterpriseMemory.fallbackAnswer.includes('当前有效：2 条'))
assert.ok(enterpriseMemory.fallbackAnswer.includes('合作伙伴：昂楷'))
assert.ok(enterpriseMemory.fallbackAnswer.includes('2026-07-25 与刘总确认'))
assert.ok(enterpriseMemory.fallbackAnswer.includes('v2'))
assert.equal(verifyAgentFactClaims(enterpriseMemory.fallbackAnswer, enterpriseMemory).passed, true)

assert.equal(runAgentFactProtocolSelfTest().ok, true)

console.log('Agent fact guard deterministic tests passed')
