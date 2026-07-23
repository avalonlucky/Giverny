import type { FileAsset, Task, TimeEntry, WaitingEntry } from '../types/domain'
import { datePart, formatMonthDay, planDateTimeFromMinuteStamp } from './dateTime'
import { parseFileTags } from './fileMetadata'
import { dateTimeMinuteStamp, nextWorkStartForWaiting } from './taskAccounting'

export function formatMonthDayDash(value: string) {
  if (!value) return ''
  const date = datePart(value)
  return `${date.slice(5, 7)}-${date.slice(8, 10)}`
}

export function isAcceptanceFileAsset(file: FileAsset, acceptanceFileNames?: Set<string>) {
  const fileTags = parseFileTags(file.tag)
  return file.scope === 'acceptance'
    || fileTags.includes('验收文件')
    || fileTags.includes('验收附件')
    || Boolean(acceptanceFileNames?.has(file.name.trim()))
}

export function formatSignedHours(minutes: number) {
  const safeMinutes = Math.max(0, minutes)
  const hours = safeMinutes / 60
  return `+${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`
}

export function formatEntryDateTimeRange(task: Task, entry: TimeEntry) {
  const startDate = entry.date || datePart(task.date)
  const endDate = entry.endDate || startDate
  const startLabel = `${formatMonthDay(startDate)} ${entry.start}`
  return startDate === endDate ? `${startLabel}-${entry.end}` : `${startLabel} - ${formatMonthDay(endDate)} ${entry.end}`
}

export function formatWaitingElapsed(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes))
  const days = Math.floor(safeMinutes / 1440)
  const hours = Math.floor((safeMinutes % 1440) / 60)
  const restMinutes = safeMinutes % 60
  return [days > 0 ? `${days} 天` : '', hours > 0 ? `${hours} 小时` : '', `${restMinutes} 分钟`].filter(Boolean).join(' ')
}

export function formatWaitingEntryDateTimeRange(task: Task, entry: WaitingEntry) {
  const startDate = entry.date || datePart(task.date)
  const startLabel = `${formatMonthDay(startDate)} ${entry.start}`
  const nextStart = nextWorkStartForWaiting(task, entry)
  if (!Number.isFinite(nextStart)) return `${startLabel} 起 · 等待中`
  const endValue = planDateTimeFromMinuteStamp(nextStart)
  const endDate = datePart(endValue)
  const endTime = endValue.slice(11, 16)
  return startDate === endDate ? `${startLabel}-${endTime}` : `${startLabel} - ${formatMonthDay(endDate)} ${endTime}`
}

export function sortTimeEntriesDesc<T extends Pick<TimeEntry, 'date' | 'endDate' | 'start' | 'end'>>(entries: T[]) {
  return [...entries].sort((a, b) => {
    const aStart = dateTimeMinuteStamp(a.date || '', a.start)
    const bStart = dateTimeMinuteStamp(b.date || '', b.start)
    return (Number.isFinite(bStart) ? bStart : 0) - (Number.isFinite(aStart) ? aStart : 0)
  })
}

export const partnerFacingText = (value: string | undefined, fallback = '合作伙伴') =>
  (value?.trim() || fallback).replaceAll('甲方', '合作伙伴')

export const feedbackEntryLabel = (entry: Pick<TimeEntry, 'feedbackSource' | 'isRevision'>) =>
  `${partnerFacingText(entry.feedbackSource)}反馈${entry.isRevision ? ' · 计入改稿轮次' : ''}`
