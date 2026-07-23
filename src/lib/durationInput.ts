import { formatDurationZh, toDateTimeInputValue } from './dateTime'

export const DURATION_STEP_MINUTES = 30
export const ESTIMATED_HOURS_STEP_MINUTES = 1

export type ScheduleAnchor = 'start' | 'hours' | 'end'

export function formatEstimatedDurationInputValue(minutes: number) {
  return formatDurationZh(Math.max(ESTIMATED_HOURS_STEP_MINUTES, Math.round(minutes)))
}

export function parseEstimatedDurationInputMinutes(value: string) {
  const normalized = value.trim().toLowerCase().replace(/,/g, '.').replace(/\s+/g, '')
  if (!normalized) return null
  if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    const hours = Number(normalized)
    return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : null
  }
  const clockMatch = normalized.match(/^(\d+):([0-5]?\d)$/)
  if (clockMatch) return Number(clockMatch[1]) * 60 + Number(clockMatch[2])
  const hourMatch = normalized.match(/(\d+(?:\.\d+)?)(?:小时|时|hours?|hrs?|h)/)
  const minuteMatch = normalized.match(/(\d+(?:\.\d+)?)(?:分钟|分|minutes?|mins?|m)/)
  if (!hourMatch && !minuteMatch) return null
  const hours = hourMatch ? Number(hourMatch[1]) : 0
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0
  const totalMinutes = Math.round(hours * 60 + minutes)
  return Number.isFinite(totalMinutes) && totalMinutes > 0 ? totalMinutes : null
}

export function normalizeEstimatedMinutes(value: number) {
  if (!Number.isFinite(value)) return ESTIMATED_HOURS_STEP_MINUTES
  return Math.max(ESTIMATED_HOURS_STEP_MINUTES, Math.round(value / ESTIMATED_HOURS_STEP_MINUTES) * ESTIMATED_HOURS_STEP_MINUTES)
}

export function exactDurationMinutesBetween(startValue: string, endValue: string) {
  const startTime = new Date(startValue).getTime()
  const endTime = new Date(endValue).getTime()
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0
  return Math.round((endTime - startTime) / 60000)
}

export function withDatePart(value: string, nextDate: string) {
  if (!value || !nextDate) return value
  const normalized = toDateTimeInputValue(value)
  return `${nextDate}T${normalized.slice(11, 16)}`
}
