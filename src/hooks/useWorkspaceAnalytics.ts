import { useEffect, useMemo, useState } from 'react'
import type { DonutChartItem } from '../components/DonutChart'
import { importedHoursMonth, importedMonthlyHours } from '../config/appConfig'
import type { ReportRecord } from '../lib/api'
import type { AgentBackgroundTask } from '../types/agent'
import type { IncomeDailyGroup, Task } from '../types/domain'
import { datePart, isoDate, localDateFromIsoDate, pad } from '../lib/dateTime'
import { monthLabelOf } from '../lib/month'
import {
  isSupplementalTask,
  isTaskBillable,
  minutesForTimeEntry,
  sumBillableAmountForMonth,
  taskBillableHoursInMonth,
  taskHasMonthActivity,
  taskHoursInMonth,
  timeEntryMonth,
} from '../lib/taskAccounting'
import { taskDueState } from '../lib/taskListPresentation'

type WorkspaceMonth = { value: string; label: string }

export type DashboardStats = {
  totalHours: number
  billableHours: number
  amount: number
  accepted: number
  pending: number
}

export type DashboardReminder = {
  key: string
  title: string
  body: string
  jobId?: string
}

export type DashboardAnnualData = {
  year: string
  rows: Array<{ month: string; hours: number; amount: number; locked: boolean }>
  totalHours: number
  totalAmount: number
}

export function useWorkspaceAnalytics({
  activeMonthTasks,
  activeTaskItems,
  currentMonth,
  hourlyRate,
  importedHours,
  reports,
  topAnalysisJobs,
  isAdmin,
  donutPalette,
}: {
  activeMonthTasks: Task[]
  activeTaskItems: Task[]
  currentMonth: WorkspaceMonth
  hourlyRate: number
  importedHours: number
  reports: ReportRecord[]
  topAnalysisJobs: AgentBackgroundTask[]
  isAdmin: boolean
  donutPalette: string[]
}) {
  const stats = useMemo<DashboardStats>(() => {
    const totalHours = activeMonthTasks.reduce((sum, task) => sum + taskHoursInMonth(task, currentMonth.value), importedHours)
    const billableHours = activeMonthTasks
      .filter(isTaskBillable)
      .reduce((sum, task) => sum + taskBillableHoursInMonth(task, currentMonth.value), importedHours)

    return {
      totalHours,
      billableHours,
      amount: sumBillableAmountForMonth(activeMonthTasks, currentMonth.value, hourlyRate, importedHours),
      accepted: activeMonthTasks.filter((task) => task.status === '已验收').length,
      pending: activeMonthTasks.filter((task) => task.status === '待验收').length,
    }
  }, [activeMonthTasks, currentMonth.value, hourlyRate, importedHours])

  const donutData = useMemo(() => {
    const hoursByType = new Map<string, number>()
    activeMonthTasks.forEach((task) => {
      const hours = taskHoursInMonth(task, currentMonth.value)
      if (hours > 0) {
        hoursByType.set(task.type, Number(((hoursByType.get(task.type) ?? 0) + hours).toFixed(1)))
      }
    })
    const items: DonutChartItem[] = [...hoursByType.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], index) => ({ label, value, color: donutPalette[index % donutPalette.length] }))

    return { items, total: Number(items.reduce((sum, item) => sum + item.value, 0).toFixed(1)) }
  }, [activeMonthTasks, currentMonth.value, donutPalette])

  const topReminderItems = useMemo<DashboardReminder[]>(() => {
    const today = isoDate()
    const dueSoonDate = isoDate(3)
    const actionableTasks = activeMonthTasks.filter((task) => !['已验收', '终止', '不计费'].includes(task.status))
    const byEstimateAsc = (a: Task, b: Task) => datePart(a.estimatedDate || a.date).localeCompare(datePart(b.estimatedDate || b.date))
    const byNearestPlan = (a: Task, b: Task) => {
      const aDate = datePart(a.estimatedDate || a.date)
      const bDate = datePart(b.estimatedDate || b.date)
      const aFutureRank = aDate >= today ? 0 : 1
      const bFutureRank = bDate >= today ? 0 : 1
      if (aFutureRank !== bFutureRank) return aFutureRank - bFutureRank
      return aFutureRank === 0 ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate)
    }
    const overdue = actionableTasks.filter((task) => taskDueState(task, today, dueSoonDate) === 'overdue').sort(byEstimateAsc)
    const soon = actionableTasks.filter((task) => taskDueState(task, today, dueSoonDate) === 'soon').sort(byEstimateAsc)
    const primary = overdue[0] ?? [...actionableTasks].sort(byNearestPlan)[0] ?? null
    const soonHighlights = soon.filter((task) => task.id !== primary?.id).slice(0, 2)
    const reminderTasks = [primary, ...soonHighlights].filter((task): task is Task => Boolean(task))
    const items: DashboardReminder[] = []

    if (reminderTasks.length > 0) {
      const bodyParts = reminderTasks.map((task) => task.title)
      if (soonHighlights.length > 0) {
        bodyParts.push(`${soonHighlights.length} 个任务 3 天内交付`)
      }
      items.push({
        key: 'due-current',
        title: overdue.length > 0 ? `${overdue.length} 个任务已逾期` : '最近任务',
        body: bodyParts.join(' · '),
      })
    }

    const todayDate = localDateFromIsoDate(today)
    const currentViewingMonth = today.slice(0, 7)
    const [year, month] = currentMonth.value.split('-').map(Number)
    const lastDay = `${currentMonth.value}-${pad(new Date(year, month, 0).getDate())}`
    const previousDate = localDateFromIsoDate(today)
    previousDate.setDate(1)
    previousDate.setMonth(previousDate.getMonth() - 1)
    const previousMonthValue = `${previousDate.getFullYear()}-${pad(previousDate.getMonth() + 1)}`
    if (today === lastDay && currentMonth.value === currentViewingMonth) {
      items.push({ key: 'review-current', title: '本月工作复盘', body: `${currentMonth.label}快结束了，可以整理本月任务、收入和交付问题。` })
    }
    if (todayDate.getDate() === 1 && currentMonth.value === previousMonthValue) {
      items.push({ key: 'review-previous', title: `上个月（${monthLabelOf(previousMonthValue)}）工作复盘`, body: '可以回看上个月任务、收入和交付问题。' })
    }

    const completedScheduledJobs = (isAdmin ? topAnalysisJobs : []).filter((job) => {
      if (!job.unread || job.status !== 'completed' || job.source !== 'scheduled') return false
      return datePart(job.completedAt || job.updatedAt || job.createdAt) === today
    })
    completedScheduledJobs.filter((job) => job.type === 'risk_digest').slice(0, 1).forEach((job) => {
      items.push({
        key: `risk-job-${job.id}`,
        title: '今日任务风险提示已完成',
        body: job.title.replace(/^\d{4}-\d{2}-\d{2}\s*/, '') || '查看今日需要关注的任务风险。',
        jobId: job.id,
      })
    })
    completedScheduledJobs
      .filter((job) => job.type === 'monthly_review' && (today === lastDay || todayDate.getDate() === 1))
      .slice(0, 1)
      .forEach((job) => {
        items.push({ key: `review-job-${job.id}`, title: '工作复盘已完成', body: job.title || '可以查看本次复盘结果。', jobId: job.id })
      })
    return items
  }, [activeMonthTasks, currentMonth.label, currentMonth.value, isAdmin, topAnalysisJobs])

  const [topReminderIndex, setTopReminderIndex] = useState(0)
  useEffect(() => {
    if (topReminderItems.length <= 1) return
    const timer = window.setInterval(() => setTopReminderIndex((current) => (current + 1) % topReminderItems.length), 60_000)
    return () => window.clearInterval(timer)
  }, [topReminderItems.length])
  const activeTopReminderItem = topReminderItems.length > 0
    ? topReminderItems[topReminderIndex % topReminderItems.length]
    : undefined

  const annualData = useMemo<DashboardAnnualData>(() => {
    const year = currentMonth.value.slice(0, 4)
    const lockedByMonth = new Map(reports.filter((report) => report.month.startsWith(year)).map((report) => [report.month, report]))
    const months = Array.from({ length: 12 }, (_, index) => `${year}-${pad(index + 1)}`)
    const rows = months.map((month) => {
      const tasks = activeTaskItems.filter((task) => taskHasMonthActivity(task, month) && isTaskBillable(task))
      const imported = month === importedHoursMonth ? importedMonthlyHours : 0
      const hours = Number(tasks.reduce((sum, task) => sum + taskBillableHoursInMonth(task, month), imported).toFixed(1))
      const locked = lockedByMonth.get(month)
      const amount = locked ? locked.totalAmount : sumBillableAmountForMonth(tasks, month, hourlyRate, imported)
      return { month, hours, amount, locked: Boolean(locked) }
    })
    return {
      year,
      rows,
      totalHours: Number(rows.reduce((sum, row) => sum + row.hours, 0).toFixed(1)),
      totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
    }
  }, [activeTaskItems, currentMonth.value, hourlyRate, reports])

  const incomeToday = datePart(isoDate())
  const incomeDailyGroups = useMemo<IncomeDailyGroup[]>(() => {
    const dayMap = new Map<string, Map<number, { title: string; hours: number; isSupplemental: boolean }>>()
    activeMonthTasks.forEach((task) => {
      const isSupplemental = isSupplementalTask(task)
      ;(task.timeEntries ?? []).forEach((entry) => {
        const minutes = minutesForTimeEntry(entry)
        if (minutes <= 0) return
        const entryDay = datePart(entry.date || task.date || '')
        const day = isSupplemental && !entryDay.startsWith(currentMonth.value) ? `${currentMonth.value}-01` : entryDay
        if (!day.startsWith(currentMonth.value)) return
        if (!dayMap.has(day)) dayMap.set(day, new Map())
        const taskMap = dayMap.get(day)!
        const existing = taskMap.get(task.id) ?? { title: task.title || '未命名', hours: 0, isSupplemental }
        existing.hours = Number((existing.hours + minutes / 60).toFixed(2))
        taskMap.set(task.id, existing)
      })
    })
    return Array.from(dayMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([day, taskMap]) => {
        const entries = Array.from(taskMap.entries()).map(([id, data]) => ({
          id,
          title: data.title,
          hours: data.hours,
          income: Math.round(data.hours * hourlyRate),
          isSupplemental: data.isSupplemental,
        }))
        const totalHours = Number(entries.reduce((sum, entry) => sum + entry.hours, 0).toFixed(1))
        return { day, totalHours, totalIncome: Math.round(totalHours * hourlyRate), entries }
      })
  }, [activeMonthTasks, currentMonth.value, hourlyRate])

  const dailyTrendData = useMemo(() => {
    const [year, month] = currentMonth.value.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const days = Array.from({ length: daysInMonth }, (_, index) => ({ label: `${month}/${index + 1}`, value: 0 }))
    activeMonthTasks.forEach((task) => {
      ;(task.timeEntries ?? []).forEach((entry) => {
        const minutes = minutesForTimeEntry(entry)
        if (minutes <= 0 || timeEntryMonth(entry, task) !== currentMonth.value) return
        const day = Number(datePart(entry.date || '').slice(8, 10)) || 1
        days[Math.min(Math.max(day - 1, 0), daysInMonth - 1)].value += minutes / 60
      })
    })
    return days.map((day) => ({ ...day, value: Number(day.value.toFixed(1)) }))
  }, [activeMonthTasks, currentMonth.value])

  return { stats, donutData, activeTopReminderItem, annualData, incomeToday, incomeDailyGroups, dailyTrendData }
}
