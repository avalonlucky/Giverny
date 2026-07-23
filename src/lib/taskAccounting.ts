import type { Task, TimeEntry, WaitingEntry } from '../types/domain'
import { datePart, pad, planDateTimeFromMinuteStamp } from './dateTime'
import { roundCents } from './money'
import { taskSettlementMonth } from './taskSettlement'

function timePart(value: string) {
  const match = value.match(/(?:T|\s)(\d{2}:\d{2})/)
  return match?.[1] ?? ''
}

export function isSupplementalTask(task: Pick<Task, 'isSupplemental'>) {
  return Boolean(task.isSupplemental)
}

export function minutesBetween(start: string, end: string) {
  if (!start || !end) return 0
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  if ([startHour, startMinute, endHour, endMinute].some((value) => !Number.isFinite(value))) return 0
  return Math.max(0, endHour * 60 + endMinute - (startHour * 60 + startMinute))
}

export function normalizeClockInput(value: string) {
  const raw = value.trim()
  const colonMatch = raw.match(/^(\d{1,2})(?::(\d{1,2}))?$/)
  const compactMatch = raw.match(/^(\d{1,2})(\d{2})$/)
  const hour = colonMatch ? Number(colonMatch[1]) : compactMatch ? Number(compactMatch[1]) : Number.NaN
  const minute = colonMatch ? Number(colonMatch[2] ?? '0') : compactMatch ? Number(compactMatch[2]) : Number.NaN
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return ''
  return `${pad(hour)}:${pad(minute)}`
}

export function dateTimeMinuteStamp(date: string, time: string) {
  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const normalizedTime = normalizeClockInput(time)
  if (!dateMatch || !normalizedTime) return Number.NaN
  const [, year, month, day] = dateMatch.map(Number)
  const [hour, minute] = normalizedTime.split(':').map(Number)
  const value = new Date(year, month - 1, day, hour, minute)
  if (
    value.getFullYear() !== year
    || value.getMonth() + 1 !== month
    || value.getDate() !== day
    || value.getHours() !== hour
    || value.getMinutes() !== minute
  ) return Number.NaN
  return Math.round(value.getTime() / 60000)
}

export function acceptanceProgressEndDateTime(task: Pick<Task, 'date' | 'timeEntries'>) {
  const acceptanceEntries = (task.timeEntries ?? [])
    .filter((entry) => entry.isAcceptanceProgress)
    .map((entry) => {
      const endDate = entry.endDate || entry.date || datePart(task.date)
      const end = normalizeClockInput(entry.end)
      const stamp = dateTimeMinuteStamp(endDate, end || '')
      return Number.isFinite(stamp) ? { stamp, value: planDateTimeFromMinuteStamp(stamp) } : null
    })
    .filter((item): item is { stamp: number; value: string } => Boolean(item))
    .sort((a, b) => b.stamp - a.stamp)
  return acceptanceEntries[0]?.value ?? ''
}

export function taskLifecycleDate(task: Task) {
  const entries = task.timeEntries ?? []
  if (entries.length > 0) {
    const withBounds = entries
      .map((entry) => {
        const start = dateTimeMinuteStamp(entry.date || datePart(task.date), entry.start)
        const end = dateTimeMinuteStamp(entry.endDate || entry.date || datePart(task.date), entry.end)
        return Number.isFinite(start) && Number.isFinite(end) ? { entry, start, end } : null
      })
      .filter((item): item is { entry: TimeEntry; start: number; end: number } => Boolean(item))
    const acceptanceBounds = withBounds.filter(({ entry }) => entry.isAcceptanceProgress)
    const targetBounds = acceptanceBounds.length > 0 ? acceptanceBounds : withBounds
    const endStamp = targetBounds.reduce((latest, item) => Math.max(latest, item.end), 0)
    if (endStamp > 0) return planDateTimeFromMinuteStamp(endStamp)
  }
  return task.actualDeliveryDate || task.date || (task.settlementMonth ? `${task.settlementMonth}-01` : '')
}

export function minutesForTimeEntry(
  entry: Pick<TimeEntry, 'date' | 'endDate' | 'start' | 'end'> & Partial<Pick<TimeEntry, 'isUncounted' | 'isClientFeedback'>>,
) {
  if (entry.isUncounted || entry.isClientFeedback) return 0
  const startDate = entry.date
  const endDate = entry.endDate || startDate
  if (!startDate || !endDate) return minutesBetween(entry.start, entry.end)
  const startStamp = dateTimeMinuteStamp(startDate, entry.start)
  const endStamp = dateTimeMinuteStamp(endDate, entry.end)
  if (!Number.isFinite(startStamp) || !Number.isFinite(endStamp)) return 0
  return Math.max(0, endStamp - startStamp)
}

export function sumTimeEntries(entries: TimeEntry[]) {
  return entries.reduce((sum, entry) => sum + minutesForTimeEntry(entry), 0)
}

export function timeEntryStartStamp(entry: Pick<TimeEntry, 'date' | 'start'>) {
  return dateTimeMinuteStamp(entry.date || '', entry.start)
}

export function nextWorkStartForWaiting(task: Task, waitingEntry: WaitingEntry) {
  const waitingStart = timeEntryStartStamp(waitingEntry)
  if (!Number.isFinite(waitingStart)) return Number.NaN
  const nextStart = (task.timeEntries ?? [])
    .filter((entry) => !entry.isClientFeedback)
    .map(timeEntryStartStamp)
    .filter((stamp) => Number.isFinite(stamp) && stamp > waitingStart)
    .sort((a, b) => a - b)[0]
  return nextStart ?? Number.NaN
}

export function minutesForWaitingEntry(task: Task, entry: WaitingEntry, ongoingUntilStamp?: number) {
  const waitingStart = timeEntryStartStamp(entry)
  const nextStart = nextWorkStartForWaiting(task, entry)
  const waitingEnd = Number.isFinite(nextStart) ? nextStart : ongoingUntilStamp
  if (!Number.isFinite(waitingStart) || !Number.isFinite(waitingEnd) || Number(waitingEnd) <= waitingStart) return 0
  return Number(waitingEnd) - waitingStart
}

export function sumWaitingEntries(task: Task, ongoingUntilStamp?: number) {
  return (task.waitingEntries ?? []).reduce((sum, entry) => sum + minutesForWaitingEntry(task, entry, ongoingUntilStamp), 0)
}

export function isWaitingEntryActive(task: Task, entry: WaitingEntry) {
  return !Number.isFinite(nextWorkStartForWaiting(task, entry))
}

export function isTaskBillable(task: Pick<Task, 'status' | 'billable'>) {
  return task.billable !== false && task.status !== '不计费'
}

export function safeMonthPart(value?: string) {
  const valueDate = value ? datePart(value) : ''
  return /^\d{4}-\d{2}-\d{2}$/.test(valueDate) ? valueDate.slice(0, 7) : ''
}

export function timeEntryActivityValue(entry: TimeEntry, task?: Pick<Task, 'date'>) {
  const endDate = entry.endDate || entry.date || datePart(task?.date ?? '')
  const end = normalizeClockInput(entry.end)
  if (endDate && end) return `${endDate}T${end}`
  const startDate = entry.date || datePart(task?.date ?? '')
  const start = normalizeClockInput(entry.start)
  return startDate && start ? `${startDate}T${start}` : startDate
}

export function timeEntryMonth(entry: TimeEntry, task?: Pick<Task, 'date'>) {
  return safeMonthPart(entry.endDate || entry.date || task?.date)
}

export function waitingEntryActivityValue(task: Task, entry: WaitingEntry) {
  const nextStart = nextWorkStartForWaiting(task, entry)
  if (Number.isFinite(nextStart)) return planDateTimeFromMinuteStamp(nextStart)
  const startDate = entry.date || datePart(task.date)
  const start = normalizeClockInput(entry.start)
  return startDate && start ? `${startDate}T${start}` : startDate
}

export function waitingEntryMonth(task: Task, entry: WaitingEntry) {
  return safeMonthPart(waitingEntryActivityValue(task, entry))
}

export function latestTaskActivityValue(task: Task) {
  const acceptanceValue = acceptanceProgressEndDateTime(task)
  const acceptanceStamp = dateTimeMinuteStamp(datePart(acceptanceValue), timePart(acceptanceValue))
  const candidates = [
    acceptanceValue || task.actualDeliveryDate,
    task.date,
    ...(task.timeEntries ?? []).map((entry) => timeEntryActivityValue(entry, task)),
    ...(task.waitingEntries ?? [])
      .map((entry) => waitingEntryActivityValue(task, entry))
      .filter((value) => {
        if (!acceptanceValue || !Number.isFinite(acceptanceStamp)) return true
        const stamp = dateTimeMinuteStamp(datePart(value), timePart(value))
        return Number.isFinite(stamp) && stamp <= acceptanceStamp
      }),
  ].filter(Boolean)
  return candidates.sort().at(-1) ?? ''
}

export function sortTasksByLatestActivity(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    const byActivity = latestTaskActivityValue(b).localeCompare(latestTaskActivityValue(a))
    return byActivity !== 0 ? byActivity : b.id - a.id
  })
}

export function billableTimeEntries(task: Pick<Task, 'timeEntries'>) {
  return (task.timeEntries ?? []).filter((entry) => minutesForTimeEntry(entry) > 0)
}

export function taskTimeEntriesInMonth(task: Task, month: string) {
  if (isSupplementalTask(task) && taskSettlementMonth(task) === month) return billableTimeEntries(task)
  return billableTimeEntries(task).filter((entry) => timeEntryMonth(entry, task) === month)
}

export function taskRelatedMonths(task: Task) {
  const months = new Set<string>()
  const settlement = taskSettlementMonth(task)
  if (isSupplementalTask(task) && /^\d{4}-\d{2}$/.test(settlement)) {
    months.add(settlement)
    return months
  }
  const acceptanceValue = acceptanceProgressEndDateTime(task)
  const acceptanceMonth = safeMonthPart(acceptanceValue)
  const acceptanceStamp = dateTimeMinuteStamp(datePart(acceptanceValue), timePart(acceptanceValue))
  ;(task.timeEntries ?? []).forEach((entry) => {
    const value = timeEntryMonth(entry, task)
    if (value) months.add(value)
  })
  ;(task.waitingEntries ?? []).forEach((entry) => {
    if (acceptanceValue && Number.isFinite(acceptanceStamp)) {
      const activityValue = waitingEntryActivityValue(task, entry)
      const stamp = dateTimeMinuteStamp(datePart(activityValue), timePart(activityValue))
      if (!Number.isFinite(stamp) || stamp > acceptanceStamp) return
    }
    const value = waitingEntryMonth(task, entry)
    if (value) months.add(value)
  })
  const deliveryMonth = acceptanceMonth || safeMonthPart(task.actualDeliveryDate)
  if (deliveryMonth) months.add(deliveryMonth)
  if (months.size === 0) {
    if (/^\d{4}-\d{2}$/.test(settlement)) months.add(settlement)
    const created = safeMonthPart(task.date)
    if (created) months.add(created)
  }
  return months
}

export function taskHasMonthActivity(task: Task, month: string) {
  return taskRelatedMonths(task).has(month)
}

export function taskMinutesInMonth(task: Task, month: string) {
  const minutes = taskTimeEntriesInMonth(task, month).reduce((sum, entry) => sum + minutesForTimeEntry(entry), 0)
  if (minutes > 0) return minutes
  if (billableTimeEntries(task).length === 0 && taskSettlementMonth(task) === month) return Math.round(task.actualHours * 60)
  return 0
}

export function taskHoursInMonth(task: Task, month: string) {
  const roundedEntryHours = Number((taskMinutesInMonth(task, month) / 60).toFixed(2))
  const settlement = taskSettlementMonth(task)
  const totalHours = roundCents(Number(task.actualHours) || 0)
  if (!isSupplementalTask(task) && settlement === month && billableTimeEntries(task).length > 0 && totalHours > 0) {
    const otherHours = Array.from(taskRelatedMonths(task))
      .filter((relatedMonth) => relatedMonth !== month)
      .reduce((sum, relatedMonth) => sum + Number((taskMinutesInMonth(task, relatedMonth) / 60).toFixed(2)), 0)
    return Math.max(0, roundCents(totalHours - otherHours))
  }
  return roundedEntryHours
}

export function taskBillableHoursInMonth(task: Task, month: string) {
  return isTaskBillable(task) ? taskHoursInMonth(task, month) : 0
}

export function billableTaskAmountInMonth(task: Task, month: string, hourlyRate: number) {
  return roundCents(taskBillableHoursInMonth(task, month) * hourlyRate)
}

export function sumBillableAmountForMonth(tasks: Task[], month: string, hourlyRate: number, importedHours = 0) {
  const taskAmount = tasks.reduce((sum, task) => sum + billableTaskAmountInMonth(task, month, hourlyRate), 0)
  const importedAmount = importedHours > 0 ? roundCents(importedHours * hourlyRate) : 0
  return roundCents(taskAmount + importedAmount)
}

export function isDateValueInRange(value: string, startDate: string, endDate: string) {
  const day = datePart(value || '')
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= startDate && day <= endDate
}

export function taskTimeEntriesInDateRange(task: Task, startDate: string, endDate: string) {
  return billableTimeEntries(task).filter((entry) => isDateValueInRange(timeEntryActivityValue(entry, task), startDate, endDate))
}

export function taskBillableHoursInDateRange(task: Task, startDate: string, endDate: string) {
  if (!isTaskBillable(task)) return 0
  const minutes = taskTimeEntriesInDateRange(task, startDate, endDate).reduce((sum, entry) => sum + minutesForTimeEntry(entry), 0)
  if (minutes > 0) return Number((minutes / 60).toFixed(2))
  if (billableTimeEntries(task).length === 0 && isDateValueInRange(task.actualDeliveryDate || task.date, startDate, endDate)) {
    return roundCents(Number(task.actualHours) || 0)
  }
  return 0
}

export function taskHoursInDateRange(task: Task, startDate: string, endDate: string) {
  const minutes = taskTimeEntriesInDateRange(task, startDate, endDate).reduce((sum, entry) => sum + minutesForTimeEntry(entry), 0)
  if (minutes > 0) return Number((minutes / 60).toFixed(2))
  if (billableTimeEntries(task).length === 0 && isDateValueInRange(task.actualDeliveryDate || task.date, startDate, endDate)) {
    return roundCents(Number(task.actualHours) || 0)
  }
  return 0
}
