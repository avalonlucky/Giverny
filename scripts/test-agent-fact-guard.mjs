import assert from 'node:assert/strict'
import { buildAgentFactSnapshot, verifyAgentFactClaims } from '../src/agentFactGuard.ts'

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
assert.equal(verifyAgentFactClaims('2026年6月共计费5小时，金额1500元。', finance).passed, true)
assert.equal(verifyAgentFactClaims(finance.fallbackAnswer, finance).passed, true)
assert.equal(verifyAgentFactClaims('实际投入3小时。', finance).passed, false)
assert.equal(verifyAgentFactClaims('实际投入三小时。', finance).passed, false)
assert.equal(verifyAgentFactClaims('实际投入五小时。', finance).passed, true)
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
assert.equal(verifyAgentFactClaims('任务#12已经验收，实际5小时，2026年6月3日完成。', task).passed, true)
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
assert.equal(verifyAgentFactClaims('累计12.5小时，验收通过率100%。', profile).passed, true)
assert.equal(verifyAgentFactClaims('累计10小时，验收通过率80%。', profile).passed, false)
assert.equal(verifyAgentFactClaims('累计十小时，验收通过率八十%。', profile).passed, false)

const product = buildAgentFactSnapshot([evidence('search_product_help', {
  tool: 'search_product_help',
  matches: [{ title: '模型设置', content: '在设置页选择首选文字模型。' }],
})])
assert.ok(product.fallbackAnswer.includes('模型设置'))
assert.equal(verifyAgentFactClaims(product.fallbackAnswer, product).passed, true)

console.log('Agent fact guard deterministic tests: 29 assertions passed')
