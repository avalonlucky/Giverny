import type { TimeEntry } from '../types/domain'
import { datePart, isoDateTime, pad, planDateTimeFromMinuteStamp, toDateTimeInputValue } from './dateTime'
import { dateTimeMinuteStamp, normalizeClockInput } from './taskAccounting'

const TIME_STEP_MINUTES = 5

export function addMinutesToPlanDateTime(value: string, minutes: number) {
  const normalized = toDateTimeInputValue(value)
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  date.setMinutes(date.getMinutes() + minutes)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function snapPlanDateTime(value: string, direction: 'nearest' | 'up' | 'down' = 'nearest') {
  const normalized = toDateTimeInputValue(value)
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  const quotient = (date.getHours() * 60 + date.getMinutes()) / TIME_STEP_MINUTES
  const snappedTotal = direction === 'up'
    ? Math.ceil(quotient) * TIME_STEP_MINUTES
    : direction === 'down'
      ? Math.floor(quotient) * TIME_STEP_MINUTES
      : Math.round(quotient) * TIME_STEP_MINUTES
  date.setHours(0, snappedTotal, 0, 0)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function timeEntryBounds(entry: Pick<TimeEntry, 'date' | 'endDate' | 'start' | 'end'>) {
  const startDate = entry.date || ''
  const endDate = entry.endDate || startDate
  const start = dateTimeMinuteStamp(startDate, entry.start)
  const end = dateTimeMinuteStamp(endDate, entry.end)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return { start, end }
}

export function timeEntriesOverlap(
  current: Pick<TimeEntry, 'date' | 'endDate' | 'start' | 'end'>,
  existing: Pick<TimeEntry, 'date' | 'endDate' | 'start' | 'end'>,
) {
  const currentBounds = timeEntryBounds(current)
  const existingBounds = timeEntryBounds(existing)
  if (!currentBounds || !existingBounds) return false
  return currentBounds.start < existingBounds.end && currentBounds.end > existingBounds.start
}

export function findNearestAvailableTimeSlot<T extends Pick<TimeEntry, 'date' | 'endDate' | 'start' | 'end'>>(
  current: Pick<TimeEntry, 'date' | 'endDate' | 'start' | 'end'>,
  existingEntries: T[],
) {
  const currentBounds = timeEntryBounds(current)
  if (!currentBounds) return null
  const duration = currentBounds.end - currentBounds.start
  if (duration <= 0) return null
  const existingBounds = existingEntries
    .map(timeEntryBounds)
    .filter((bounds): bounds is { start: number; end: number } => Boolean(bounds))
    .sort((left, right) => left.start - right.start)
  const conflictBounds = existingBounds.find((bounds) => currentBounds.start < bounds.end && currentBounds.end > bounds.start)
  if (!conflictBounds) return null
  const availableCandidate = [
    { start: conflictBounds.end, end: conflictBounds.end + duration },
    { start: conflictBounds.start - duration, end: conflictBounds.start },
  ]
    .filter((candidate) => candidate.start >= 0)
    .filter((candidate) => !existingBounds.some((bounds) => candidate.start < bounds.end && candidate.end > bounds.start))
    .sort((left, right) => Math.abs(left.start - currentBounds.start) - Math.abs(right.start - currentBounds.start))[0]
  if (!availableCandidate) return null
  const start = planDateTimeFromMinuteStamp(availableCandidate.start)
  const end = planDateTimeFromMinuteStamp(availableCandidate.end)
  return start && end ? { start, end } : null
}

export function defaultTimeEntryDraft() {
  const start = snapPlanDateTime(isoDateTime(), 'up')
  const end = addMinutesToPlanDateTime(start, 60)
  return { date: datePart(start), endDate: datePart(end), start: start.slice(11, 16), end: end.slice(11, 16), note: '' }
}

export type TimeEntryDraft = ReturnType<typeof defaultTimeEntryDraft>

export function fillTimeDraftFromDuration(draft: TimeEntryDraft, minutes: number) {
  const safeMinutes = Math.max(1, Math.round(minutes))
  const start = normalizeClockInput(draft.start)
  const end = normalizeClockInput(draft.end)
  if (!end && start && draft.date) {
    const computed = addMinutesToPlanDateTime(`${draft.date}T${start}`, safeMinutes)
    return { ...draft, start, endDate: computed.slice(0, 10), end: computed.slice(11, 16) }
  }
  if (!start && end && (draft.endDate || draft.date)) {
    const computed = addMinutesToPlanDateTime(`${draft.endDate || draft.date}T${end}`, -safeMinutes)
    return { ...draft, date: computed.slice(0, 10), start: computed.slice(11, 16), endDate: draft.endDate || draft.date, end }
  }
  return { ...draft, start: start || draft.start, end: end || draft.end }
}
