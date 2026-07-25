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
    traits: ['验收通过率高'],
    advice: ['保持当前记录粒度。'],
  },
})])

assert.ok(profile.fallbackAnswer.includes('累计工时 12.5 小时'))
assert.equal(verifyAgentFactClaims('累计12.5小时，验收通过率100%。', profile).passed, false)
assert.equal(verifyAgentFactClaims(`画像已经核对。\n\n${profile.fallbackAnswer}`, profile).passed, true)
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

assert.equal(runAgentFactProtocolSelfTest().ok, true)

console.log('Agent fact guard deterministic tests: 45 assertions passed')
