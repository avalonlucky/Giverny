import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

try {
  const accounting = await server.ssrLoadModule('/src/lib/taskAccounting.ts')
  const task = (overrides = {}) => ({
    id: 1,
    date: '2026-06-01T09:00',
    estimatedDate: '2026-06-01T12:00',
    type: '测试',
    title: '结算对账测试',
    requirement: '',
    contact: '',
    reviewer: '',
    stage: '已验收',
    estimatedHours: 3,
    actualHours: 3,
    status: '已验收',
    progress: 100,
    billable: true,
    files: [],
    timeEntries: [],
    ...overrides,
  })
  const entry = (id, date, start, end, overrides = {}) => ({ id, date, start, end, ...overrides })

  const crossMonth = task({
    settlementMonth: '2026-07',
    actualHours: 5,
    timeEntries: [
      entry('june', '2026-06-30', '14:00', '16:00'),
      entry('july', '2026-07-01', '09:00', '11:30'),
    ],
  })
  assert.equal(accounting.taskHoursInMonth(crossMonth, '2026-06'), 2)
  assert.equal(accounting.taskHoursInMonth(crossMonth, '2026-07'), 3)
  assert.equal(
    accounting.taskHoursInMonth(crossMonth, '2026-06') + accounting.taskHoursInMonth(crossMonth, '2026-07'),
    crossMonth.actualHours,
    '跨月分摊不得改变保存的实际总工时',
  )

  const supplemental = task({
    isSupplemental: true,
    settlementMonth: '2026-06',
    actualHours: 2,
    timeEntries: [entry('recorded-later', '2026-07-23', '10:00', '12:00')],
  })
  assert.equal(accounting.taskHoursInMonth(supplemental, '2026-06'), 2)
  assert.deepEqual([...accounting.taskRelatedMonths(supplemental)], ['2026-06'])
  assert.equal(accounting.taskHasMonthActivity(supplemental, '2026-07'), false)

  const feedback = entry('feedback', '2026-06-11', '09:15', '10:15', { isClientFeedback: true })
  const uncounted = entry('uncounted', '2026-06-11', '10:15', '11:15', { isUncounted: true })
  assert.equal(accounting.minutesForTimeEntry(feedback), 0)
  assert.equal(accounting.minutesForTimeEntry(uncounted), 0)

  const juneTask = task({
    settlementMonth: '2026-06',
    actualHours: 1.5,
    timeEntries: [entry('work', '2026-06-10', '14:30', '16:00')],
  })
  assert.equal(accounting.taskHoursInMonth(juneTask, '2026-06'), accounting.taskHoursInDateRange(juneTask, '2026-06-01', '2026-06-30'))
  assert.equal(accounting.taskBillableHoursInMonth(juneTask, '2026-06'), accounting.taskBillableHoursInDateRange(juneTask, '2026-06-01', '2026-06-30'))

  assert.equal(accounting.billableTaskAmountInMonth(juneTask, '2026-06', 85), 127.5)
  assert.equal(accounting.sumBillableAmountForMonth([juneTask], '2026-06', 85, 0.25), 148.75)

  const nonBillable = task({ ...juneTask, id: 2, billable: false })
  assert.equal(accounting.taskBillableHoursInMonth(nonBillable, '2026-06'), 0)
  assert.equal(accounting.taskHoursInMonth(nonBillable, '2026-06'), 1.5)

  console.log('task accounting reconciliation: 16 assertions passed')
} finally {
  await server.close()
}
