import type { DesignTypeGroup } from '../config/appConfig'
import type { Task } from '../types/domain'
import { designTypeColorForIndex, validDesignTypeColor } from './designTypes'
import { datePart, formatMonthDay, isoDate, toDateTimeInputValue } from './dateTime'
import { latestTaskActivityValue } from './taskAccounting'

export type TaskDueState = 'overdue' | 'soon' | null

export function isTaskListBlankContextTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false
  }
  return !target.closest('.task-row, .task-context-menu, button, a, input, textarea, select, [role="button"]')
}

function formatTimePart(value: string) {
  const match = value.match(/(?:T|\s)(\d{2}:\d{2})/)
  return match?.[1] ?? ''
}

export function formatDueDateCompact(value: string) {
  if (!value) {
    return ''
  }
  const date = datePart(value)
  const time = formatTimePart(value)
  return date === isoDate() ? ['今日', time].filter(Boolean).join(' ') : formatMonthDay(value)
}

export function formatTaskRowDateTime(value: string) {
  if (!value) {
    return '未设置'
  }
  const date = datePart(value)
  const monthDay = `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
  const time = formatTimePart(value)
  return time ? `${monthDay} ${time}` : monthDay
}

function parsePlanDateTime(value: string) {
  const normalized = toDateTimeInputValue(value)
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatRemainingTime(minutes: number) {
  const safeMinutes = Math.max(0, minutes)
  const days = Math.floor(safeMinutes / 1440)
  const hours = Math.floor((safeMinutes % 1440) / 60)
  if (days > 0 && hours > 0) {
    return `${days} 天 ${hours} 小时`
  }
  if (days > 0) {
    return `${days} 天`
  }
  if (hours > 0) {
    return `${hours} 小时`
  }
  return '1 小时内'
}

export function formatTaskScheduleSignal(task: Task) {
  if (task.status === '已验收') {
    return { tone: 'done', label: '已验收' }
  }
  if (task.status === '终止' || task.status === '不计费') {
    return { tone: 'normal', label: task.status }
  }

  const now = new Date()
  const start = parsePlanDateTime(task.date)
  const due = parsePlanDateTime(task.estimatedDate || task.date)
  if (!start || !due) {
    return { tone: 'normal', label: '时间待确认' }
  }
  if (now < start) {
    const minutes = Math.ceil((start.getTime() - now.getTime()) / 60000)
    return { tone: 'normal', label: `距开始还剩 ${formatRemainingTime(minutes)}` }
  }
  if (now > due) {
    const days = Math.max(1, Math.floor((now.getTime() - due.getTime()) / 86400000))
    return { tone: 'overdue', label: `已逾期 ${days} 天` }
  }

  const minutesToDue = Math.ceil((due.getTime() - now.getTime()) / 60000)
  const today = isoDate()
  const tomorrow = isoDate(1)
  const dueDate = datePart(task.estimatedDate || task.date)
  const dueTime = formatTimePart(task.estimatedDate || task.date)
  if (dueDate === today) {
    return { tone: 'imminent', label: `今日${dueTime ? ` ${dueTime}` : ''} 到期` }
  }
  if (dueDate === tomorrow) {
    return { tone: 'imminent', label: `明日${dueTime ? ` ${dueTime}` : ''} 到期` }
  }
  return { tone: 'started', label: `距交付还剩 ${formatRemainingTime(minutesToDue)}` }
}

export function formatTaskActivityDateRange(task: Task) {
  const start = datePart(task.date || '')
  const latest = datePart(latestTaskActivityValue(task))
  if (!latest || latest === start) return formatMonthDay(start || task.date)
  return `${formatMonthDay(latest)}—${formatMonthDay(start)}`
}

export function formatTaskActivityTime(task: Task) {
  const latest = latestTaskActivityValue(task)
  return formatTimePart(latest || task.date)
}

export function designTypeColorForTask(type: string, groups: DesignTypeGroup[]) {
  const normalizedType = type.trim()
  const explicitGroupName = normalizedType.includes(' / ') ? normalizedType.split(' / ')[0].trim() : ''
  const group = explicitGroupName
    ? groups.find((item) => item.name === explicitGroupName)
    : groups.find((item) => item.items.includes(normalizedType))
  return validDesignTypeColor(group?.color) || designTypeColorForIndex(0)
}

/** 未完成任务的交付提醒状态：已过预计交付日 → 逾期；3 天内到期 → 临期。 */
export function taskDueState(task: Task, today: string, soonDate: string): TaskDueState {
  if (!task.estimatedDate || task.status === '已验收' || task.status === '终止' || task.status === '不计费') {
    return null
  }
  const estimatedDate = datePart(task.estimatedDate)
  if (estimatedDate < today) {
    return 'overdue'
  }
  if (estimatedDate <= soonDate) {
    return 'soon'
  }
  return null
}
