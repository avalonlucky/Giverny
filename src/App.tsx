import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlarmClock,
  AlertTriangle,
  Archive,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileArchive,
  FileImage,
  FileText,
  FolderKanban,
  GripVertical,
  KeyRound,
  LayoutDashboard,
  List,
  ListChecks,
  LoaderCircle,
  Lock,
  LogOut,
  Mail,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Share2,
  Sparkles,
  Info,
  Tag,
  Trash2,
  UploadCloud,
  UserCircle,
  X,
} from 'lucide-react'
import {
  appReleaseDate,
  appVersion,
  defaultDesignTypeGroups,
  defaultDesignTypes,
  defaultHourlyRate,
  defaultPdfTitle,
  defaultServiceCompanyName,
  importedHoursMonth,
  importedMonthlyHours,
  type DesignTypeGroup,
} from './config/appConfig'
import {
  api,
  ApiError,
  authedPreviewUrl,
  clearStoredAuth,
  getStoredAuth,
  setStoredAuth,
  type AccessToken,
  type ActivityItem,
  type AiModelConfig,
  type AiModelEndpointConfig,
  type AiModelRouteKey,
  type AuthRole,
  type HourEstimateSuggestion,
  type ReportRecord,
  type StoredAuth,
  type TaskAssistantSuggestion,
  type TextAssistantSuggestion,
} from './lib/api'
import { formatFileSize, toChineseAmount } from './lib/format'
import { createPsdPreviewFile } from './lib/psdPreview'
import type { AppView, AttachmentAnalysis, FileAsset, InsightDiagnosis, InsightHistoryItem, InsightPeriodType, Task, TaskFilter, TaskStatus, TaskUpdate, TaskViewMode, TaxMode, TimeEntry } from './types/domain'
import './App.css'

const navItems = [
  { label: '工作台', icon: LayoutDashboard },
  { label: '任务', icon: FolderKanban },
  { label: '文件库', icon: Archive },
  { label: '洞察', icon: Sparkles },
  { label: '结算', icon: FileText },
  { label: '收入', icon: BarChart3 },
]

const viewRoutes: Record<AppView, string> = {
  工作台: '/dashboard',
  任务: '/tasks',
  文件库: '/files',
  洞察: '/insights',
  收入: '/income',
  结算: '/reports',
  甲方查看: '/client-preview',
  设置: '/settings',
}

const routeViews = Object.fromEntries(Object.entries(viewRoutes).map(([view, path]) => [path, view])) as Record<string, AppView>

function viewFromPath(pathname: string): AppView {
  if (pathname === '/updates') {
    return '任务'
  }
  return routeViews[pathname] ?? '工作台'
}

function taskViewModeFromSearch(search = window.location.search): TaskViewMode {
  const value = new URLSearchParams(search).get('taskView')
  return value === 'calendar' || value === '日历' ? '日历' : '列表'
}

function taskViewRoute(view: AppView, mode: TaskViewMode) {
  if (view !== '任务' || mode !== '日历') {
    return viewRoutes[view]
  }
  return `${viewRoutes[view]}?taskView=calendar`
}

function isTaskListBlankContextTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false
  }
  return !target.closest('.task-row, .task-context-menu, button, a, input, textarea, select, [role="button"]')
}

const pad = (value: number) => String(value).padStart(2, '0')

function isoDate(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function isoDateTime(offsetMinutes = 0) {
  const date = new Date()
  date.setMinutes(date.getMinutes() + offsetMinutes)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function datePart(value: string) {
  return value.slice(0, 10)
}

function monthPart(value: string) {
  return datePart(value).slice(0, 7)
}

function toDateTimeInputValue(value: string) {
  if (!value) {
    return ''
  }
  return value.includes('T') ? value.slice(0, 16) : `${datePart(value)}T09:00`
}

function formatPlanDateTime(value: string) {
  if (!value) {
    return ''
  }
  const date = datePart(value).replaceAll('-', '/')
  return value.includes('T') ? `${date} ${value.slice(11, 16)}` : date
}

function formatTimelineDate(value: string) {
  if (!value) {
    return ''
  }
  const date = datePart(value)
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  return `${year}年${month}月${day}日`
}

function formatMonthDayTime(value: string) {
  if (!value) {
    return ''
  }
  const date = datePart(value)
  const monthDay = `${date.slice(5, 7)}/${date.slice(8, 10)}`
  return value.includes('T') ? `${monthDay} ${value.slice(11, 16)}` : monthDay
}

function formatMonthDay(value: string) {
  if (!value) {
    return ''
  }
  const date = datePart(value)
  return `${date.slice(5, 7)}/${date.slice(8, 10)}`
}

function formatDueDateCompact(value: string) {
  if (!value) {
    return ''
  }
  const date = datePart(value)
  const time = formatTimePart(value)
  return date === isoDate() ? ['今日', time].filter(Boolean).join(' ') : formatMonthDay(value)
}

function formatTimePart(value: string) {
  return value.includes('T') ? value.slice(11, 16) : ''
}

function formatTaskRowDateTime(value: string) {
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

function formatTaskScheduleSignal(task: Task) {
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

function addMinutesToPlanDateTime(value: string, minutes: number) {
  const normalized = toDateTimeInputValue(value)
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  date.setMinutes(date.getMinutes() + minutes)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

type ScheduleAnchor = 'start' | 'end'

async function createOptionalPsdPreviewFile(file: File) {
  try {
    return await createPsdPreviewFile(file)
  } catch (error) {
    console.warn('PSD preview generation failed', error)
    return undefined
  }
}

function stringifyCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (value instanceof Date) {
    return value.toLocaleString('zh-CN')
  }
  if (typeof value === 'object') {
    const maybeFormula = value as { result?: unknown; text?: string; richText?: { text?: string }[]; hyperlink?: string }
    if (maybeFormula.result !== undefined) {
      return stringifyCellValue(maybeFormula.result)
    }
    if (maybeFormula.text) {
      return maybeFormula.text
    }
    if (Array.isArray(maybeFormula.richText)) {
      return maybeFormula.richText.map((item) => item.text ?? '').join('')
    }
    if (maybeFormula.hyperlink) {
      return maybeFormula.hyperlink
    }
    return JSON.stringify(value)
  }
  return String(value)
}

function appendQueryParam(url: string | undefined, key: string, value: string) {
  if (!url) {
    return undefined
  }
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
}

const inlineImageFileTypes = new Set(['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'])
const inlineDocumentFileTypes = new Set(['PDF', 'AI'])
const officeFileTypes = new Set(['DOCX', 'XLSX', 'PPTX', 'DOC', 'XLS', 'PPT'])

function isInlineImageFileType(fileType: string) {
  return inlineImageFileTypes.has(fileType.toUpperCase())
}

function isInlineDocumentFileType(fileType: string) {
  return inlineDocumentFileTypes.has(fileType.toUpperCase())
}

function isOfficeFileType(fileType: string) {
  return officeFileTypes.has(fileType.toUpperCase())
}

function fileDocumentPreviewSource(file: FileAsset | undefined) {
  if (!file) {
    return undefined
  }
  const fileType = file.type.toUpperCase()
  return authedPreviewUrl(fileType === 'AI' ? appendQueryParam(file.sourceUrl, 'as', 'pdf') : file.sourceUrl)
}

function parseFileTags(tag: string | undefined) {
  return (tag ?? '')
    .split(/[、,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function serializeFileTags(tags: string[]) {
  return Array.from(new Set(tags.map((item) => item.trim()).filter(Boolean))).join('、')
}

function nowStamp() {
  const now = new Date()
  return `${isoDate()} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

// Cloudflare Workers Free/Pro 计划单次请求体上限 100MB，留出 multipart 开销后取 95MB 作为硬上限。
const UPLOAD_HARD_LIMIT = 95 * 1024 * 1024
const UPLOAD_SOFT_LIMIT = 50 * 1024 * 1024

type AcceptancePayload = {
  actualHours: number
  acceptanceNote: string
  timeEntries: TimeEntry[]
  acceptanceFiles?: string[]
  taskChanges?: Partial<Pick<Task, 'title' | 'type' | 'contact' | 'requester' | 'reviewer' | 'requirement' | 'date' | 'estimatedDate' | 'progress'>>
}

function validateUploadFile(file: File) {
  if (file.size > UPLOAD_HARD_LIMIT) {
    throw new Error(`「${file.name}」超过 ${(UPLOAD_HARD_LIMIT / 1024 / 1024).toFixed(0)}MB，无法上传`)
  }
  if (file.size > UPLOAD_SOFT_LIMIT) {
    return true
  }
  return false
}

const donutPalette = ['#2f6f6d', '#6f8f72', '#b08a3c', '#66a182', '#b86b5f', '#7c8b46', '#8a7a55', '#a36b7a']

type DonutItem = { label: string; value: number; color: string }

type TaskContextInsight = {
  tone: 'warning' | 'info'
  label: string
  detail: string
  evidence: string
}

type InsightPeriod = InsightPeriodType
type InsightTab = 'period' | 'deliverable' | 'capability' | 'advisor'

const insightPeriods: { value: InsightPeriod; label: string }[] = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'quarter', label: '季度' },
  { value: 'half', label: '半年' },
  { value: 'year', label: '年度' },
]

const insightTabs: { value: InsightTab; label: string; icon: ReactNode }[] = [
  { value: 'period', label: '周期复盘', icon: <BarChart3 size={16} /> },
  { value: 'deliverable', label: '交付件理解', icon: <Archive size={16} /> },
  { value: 'capability', label: '异常诊断', icon: <AlertTriangle size={16} /> },
  { value: 'advisor', label: '数据结论', icon: <Sparkles size={16} /> },
]

const taskFilters: TaskFilter[] = ['全部', '计划中', '进行中', '挂起', '待验收', '已验收', '终止']

const statusDotColors: Record<TaskStatus, string> = {
  计划中: 'var(--color-status-planning)',
  进行中: 'var(--color-status-active)',
  挂起: 'var(--color-status-hold)',
  待验收: 'var(--color-status-pending)',
  已验收: 'var(--color-status-accepted)',
  终止: 'var(--color-status-stopped)',
  不计费: 'var(--color-status-disabled)',
}

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

function isoDateFromLocalDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function localDateFromIsoDate(value: string) {
  const [year, month, day] = datePart(value || isoDate()).split('-').map(Number)
  return new Date(year, month - 1, day)
}

function calendarDaysForMonth(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const start = new Date(year, month - 1, 1 - startOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      value: isoDateFromLocalDate(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month - 1,
    }
  })
}

function monthLabelOf(value: string) {
  return `${Number(value.slice(0, 4))} 年 ${Number(value.slice(5, 7))} 月`
}

function monthSelectOptions(anchorValue: string, extraValue?: string) {
  const anchor = localDateFromIsoDate(`${anchorValue || isoDate().slice(0, 7)}-01`)
  const values = new Set<string>()
  for (let offset = -12; offset <= 6; offset += 1) {
    const date = new Date(anchor)
    date.setMonth(anchor.getMonth() + offset)
    values.add(`${date.getFullYear()}-${pad(date.getMonth() + 1)}`)
  }
  if (extraValue) {
    values.add(extraValue)
  }
  return [...values].sort((a, b) => b.localeCompare(a))
}

function shiftMonthValue(value: string, offset: number) {
  const base = localDateFromIsoDate(`${value || isoDate().slice(0, 7)}-01`)
  base.setMonth(base.getMonth() + offset)
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}`
}

function taskAnalysisMonth(task: Task) {
  return task.settlementMonth || monthPart(task.date)
}

function taskSettlementMonth(task: Task) {
  return task.settlementMonth || ''
}

function isSupplementalTask(task: Task) {
  return Boolean(task.settlementMonth) && task.settlementMonth !== monthPart(task.date)
}

function dateFromValue(value: string | undefined) {
  if (!value) {
    return null
  }
  const date = new Date(toDateTimeInputValue(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function isDateInRange(value: string | undefined, range: { start: Date; end: Date }) {
  const date = dateFromValue(value)
  if (!date) {
    return false
  }
  return date >= range.start && date <= range.end
}

function isTaskInAnalysisRange(task: Task, range: { start: Date; end: Date }) {
  const analysisMonth = dateFromValue(`${taskAnalysisMonth(task)}-01`)
  const inAnalysisMonth = analysisMonth ? analysisMonth >= range.start && analysisMonth <= range.end : false
  return inAnalysisMonth || isDateInRange(task.date, range) || isDateInRange(task.estimatedDate, range)
}

function averageNumber(values: number[]) {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function buildTaskContextInsights(tasks: Task[], updates: TaskUpdate[]) {
  const updatesByTask = new Map<number, TaskUpdate[]>()
  updates.forEach((update) => {
    updatesByTask.set(update.taskId, [...(updatesByTask.get(update.taskId) ?? []), update])
  })
  const activeTasks = tasks.filter((task) => !task.voidedAt && task.status !== '不计费')
  const byType = new Map<string, Task[]>()
  activeTasks.forEach((task) => {
    const type = task.type || '未分类'
    byType.set(type, [...(byType.get(type) ?? []), task])
  })
  const insights = new Map<number, TaskContextInsight>()

  activeTasks.forEach((task) => {
    if (['已验收', '终止', '不计费'].includes(task.status)) {
      return
    }
    const type = task.type || '未分类'
    const samples = (byType.get(type) ?? []).filter((item) => item.id !== task.id && item.actualHours > 0)
    if (samples.length < 2) {
      return
    }
    const estimateSamples = samples.filter((item) => item.estimatedHours > 0)
    const avgActualHours = averageNumber(samples.map((item) => item.actualHours))
    const avgEstimateVariance = estimateSamples.length >= 2
      ? averageNumber(estimateSamples.map((item) => (item.actualHours - item.estimatedHours) / item.estimatedHours))
      : 0
    const revisionSignals = samples.reduce(
      (sum, item) => sum + (updatesByTask.get(item.id) ?? []).filter((update) => /修改|调整|改稿|反馈|返工|revision/i.test(`${update.title} ${update.body}`)).length,
      0,
    )
    const revisionSignalsPerTask = revisionSignals / samples.length
    const candidates: Array<TaskContextInsight & { priority: number }> = []

    if (avgEstimateVariance >= 0.15) {
      const percent = Math.round(avgEstimateVariance * 100)
      candidates.push({
        tone: 'warning',
        label: `同类历史平均超时 ${percent}%`,
        detail: `这个任务类型过去 ${samples.length} 个样本平均实际工时高于预估 ${percent}%，建议今天预留缓冲时间。`,
        evidence: `${type} · ${samples.length} 个历史样本 · 平均实际 ${avgActualHours.toFixed(1)}h`,
        priority: 90 + percent,
      })
    }
    if (task.estimatedHours > 0 && avgActualHours > task.estimatedHours * 1.25) {
      const gap = Number((avgActualHours - task.estimatedHours).toFixed(1))
      candidates.push({
        tone: 'warning',
        label: `预估低于同类均值 ${gap.toFixed(1)}h`,
        detail: `同类历史平均实际 ${avgActualHours.toFixed(1)}h，当前预估 ${task.estimatedHours.toFixed(1)}h，建议提前确认范围或补缓冲。`,
        evidence: `${type} · ${samples.length} 个历史样本`,
        priority: 85 + gap,
      })
    }
    if (revisionSignalsPerTask >= 1.5) {
      candidates.push({
        tone: 'info',
        label: '同类修改信号偏高',
        detail: `同类历史平均每个任务出现 ${revisionSignalsPerTask.toFixed(1)} 次修改信号，建议先锁定尺寸、文案和色板。`,
        evidence: `${type} · ${revisionSignals} 次修改信号 / ${samples.length} 个样本`,
        priority: 70 + revisionSignalsPerTask,
      })
    }
    const strongest = candidates.sort((left, right) => right.priority - left.priority)[0]
    if (strongest) {
      insights.set(task.id, {
        tone: strongest.tone,
        label: strongest.label,
        detail: strongest.detail,
        evidence: strongest.evidence,
      })
    }
  })

  return insights
}

function insightPeriodRange(period: InsightPeriod, monthValue: string) {
  const today = localDateFromIsoDate(isoDate())
  const [anchorYear, anchorMonth] = monthValue.split('-').map(Number)
  const anchor = new Date(anchorYear, anchorMonth - 1, 1)
  let start: Date
  let end: Date

  if (period === 'day') {
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)
  } else if (period === 'week') {
    const mondayOffset = (today.getDay() + 6) % 7
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset)
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999)
  } else if (period === 'month') {
    start = new Date(anchorYear, anchorMonth - 1, 1)
    end = new Date(anchorYear, anchorMonth, 0, 23, 59, 59, 999)
  } else if (period === 'quarter') {
    const quarterStartMonth = Math.floor(anchor.getMonth() / 3) * 3
    start = new Date(anchorYear, quarterStartMonth, 1)
    end = new Date(anchorYear, quarterStartMonth + 3, 0, 23, 59, 59, 999)
  } else if (period === 'half') {
    const halfStartMonth = anchor.getMonth() < 6 ? 0 : 6
    start = new Date(anchorYear, halfStartMonth, 1)
    end = new Date(anchorYear, halfStartMonth + 6, 0, 23, 59, 59, 999)
  } else {
    start = new Date(anchorYear, 0, 1)
    end = new Date(anchorYear, 11, 31, 23, 59, 59, 999)
  }

  return { start, end }
}

function formatInsightRange(range: { start: Date; end: Date }) {
  const start = isoDateFromLocalDate(range.start).replaceAll('-', '/')
  const end = isoDateFromLocalDate(range.end).replaceAll('-', '/')
  return start === end ? start : `${start} - ${end}`
}

function isVisualReviewReady(file: FileAsset) {
  const type = file.type.toUpperCase()
  return Boolean(file.previewUrl) || isInlineImageFileType(type) || isInlineDocumentFileType(type) || isOfficeFileType(type)
}

const flattenDesignTypeGroups = (groups: DesignTypeGroup[]) => groups.flatMap((group) => group.items.map((item) => `${group.name} / ${item}`))

const durationMinuteOptions = Array.from({ length: 6 }, (_, index) => index * 10)
const durationHourOptions = Array.from({ length: 11 }, (_, index) => index)

function formatDuration(minutes: number) {
  const safeMinutes = Math.max(0, minutes)
  const hours = Math.floor(safeMinutes / 60)
  const restMinutes = safeMinutes % 60
  if (hours === 0) {
    return `${restMinutes} min`
  }
  if (restMinutes === 0) {
    return `${hours} h`
  }
  return `${hours} h ${restMinutes} min`
}

function minutesBetween(start: string, end: string) {
  if (!start || !end) {
    return 0
  }
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  if ([startHour, startMinute, endHour, endMinute].some((value) => !Number.isFinite(value))) {
    return 0
  }
  return Math.max(0, endHour * 60 + endMinute - (startHour * 60 + startMinute))
}

function normalizeClockInput(value: string) {
  const raw = value.trim()
  const colonMatch = raw.match(/^(\d{1,2})(?::(\d{1,2}))?$/)
  const compactMatch = raw.match(/^(\d{1,2})(\d{2})$/)
  const hour = colonMatch ? Number(colonMatch[1]) : compactMatch ? Number(compactMatch[1]) : Number.NaN
  const minute = colonMatch ? Number(colonMatch[2] ?? '0') : compactMatch ? Number(compactMatch[2]) : Number.NaN
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return ''
  }
  return `${pad(hour)}:${pad(minute)}`
}

function sumTimeEntries(entries: TimeEntry[]) {
  return entries.reduce((sum, entry) => sum + minutesBetween(entry.start, entry.end), 0)
}

function hoursFromTimeEntries(entries: TimeEntry[]) {
  return Math.round((sumTimeEntries(entries) / 60) * 100) / 100
}

function defaultTimeEntryDraft() {
  const now = new Date()
  const startHour = Math.min(22, now.getHours())
  const endHour = Math.min(23, startHour + 1)
  return {
    start: `${pad(startHour)}:00`,
    end: `${pad(endHour)}:00`,
    note: '',
  }
}

const cumulativeTaxBrackets = [
  { limit: 36000, rate: 0.03, quick: 0 },
  { limit: 144000, rate: 0.1, quick: 2520 },
  { limit: 300000, rate: 0.2, quick: 16920 },
  { limit: 420000, rate: 0.25, quick: 31920 },
  { limit: 660000, rate: 0.3, quick: 52920 },
  { limit: 960000, rate: 0.35, quick: 85920 },
  { limit: Number.POSITIVE_INFINITY, rate: 0.45, quick: 181920 },
]

const laborTaxBrackets = [
  { limit: 20000, rate: 0.2, quick: 0 },
  { limit: 50000, rate: 0.3, quick: 2000 },
  { limit: Number.POSITIVE_INFINITY, rate: 0.4, quick: 7000 },
]

type AnnualIncomeRow = {
  month: string
  hours: number
  amount: number
  locked: boolean
}

function resolveCumulativeTaxBracket(taxableIncome: number) {
  return cumulativeTaxBrackets.find((bracket) => taxableIncome <= bracket.limit) ?? cumulativeTaxBrackets[0]
}

function resolveLaborTaxBracket(taxableIncome: number) {
  return laborTaxBrackets.find((bracket) => taxableIncome <= bracket.limit) ?? laborTaxBrackets[0]
}

function calculateCumulativeWithholding(
  rows: AnnualIncomeRow[],
  monthlySpecialDeduction: number,
  monthlyAdditionalDeduction: number,
  monthlyOtherDeduction: number,
) {
  let cumulativeIncome = 0
  let cumulativePaidTax = 0
  const monthlyDeduction = 5000 + monthlySpecialDeduction + monthlyAdditionalDeduction + monthlyOtherDeduction

  return rows.map((row, index) => {
    cumulativeIncome += row.amount
    const cumulativeDeduction = monthlyDeduction * (index + 1)
    const taxableIncome = Math.max(0, cumulativeIncome - cumulativeDeduction)
    const bracket = resolveCumulativeTaxBracket(taxableIncome)
    const cumulativeTax = Math.max(0, taxableIncome * bracket.rate - bracket.quick)
    const tax = Math.max(0, Math.round(cumulativeTax - cumulativePaidTax))
    cumulativePaidTax += tax

    return {
      ...row,
      taxableIncome,
      tax,
      netIncome: Math.max(0, row.amount - tax),
      cumulativeIncome,
      cumulativeTax: Math.round(cumulativePaidTax),
      rate: bracket.rate,
      quick: bracket.quick,
    }
  })
}

function calculateLaborWithholding(rows: AnnualIncomeRow[]) {
  let cumulativeIncome = 0
  let cumulativeTax = 0
  return rows.map((row) => {
    cumulativeIncome += row.amount
    const taxableIncome = row.amount <= 800 ? 0 : row.amount <= 4000 ? Math.max(0, row.amount - 800) : row.amount * 0.8
    const bracket = resolveLaborTaxBracket(taxableIncome)
    const tax = Math.max(0, Math.round(taxableIncome * bracket.rate - bracket.quick))
    cumulativeTax += tax
    return {
      ...row,
      taxableIncome,
      tax,
      netIncome: Math.max(0, row.amount - tax),
      cumulativeIncome,
      cumulativeTax,
      rate: bracket.rate,
      quick: bracket.quick,
    }
  })
}

const normalizeDesignTypeGroups = (groups: DesignTypeGroup[]) => {
  const normalized = groups
    .map((group) => ({
      name: group.name.trim(),
      items: [...new Set(group.items.map((item) => item.trim()).filter(Boolean))],
    }))
    .filter((group) => group.name)

  return normalized.length > 0 ? normalized : defaultDesignTypeGroups
}

function MonthPicker({
  value,
  taskMonthValues,
  onChange,
}: {
  value: string
  taskMonthValues: Set<string>
  onChange: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [displayYear, setDisplayYear] = useState(() => Number(value.slice(0, 4)))
  const selectedYear = Number(value.slice(0, 4))
  const selectedMonth = Number(value.slice(5, 7))

  const chooseMonth = (month: number) => {
    onChange(`${displayYear}-${pad(month)}`)
    setIsOpen(false)
  }

  return (
    <div
      className="month-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false)
        }
      }}
    >
      <button
        type="button"
        className={`select-button month-trigger ${isOpen ? 'active' : ''}`}
        aria-label="选择年份和月份"
        aria-expanded={isOpen}
        onClick={() => {
          if (!isOpen) {
            setDisplayYear(selectedYear)
          }
          setIsOpen((open) => !open)
        }}
      >
        <CalendarDays size={17} />
        <span>{monthLabelOf(value)}</span>
        <ChevronDown size={16} />
      </button>

      {isOpen && (
        <div className="month-popover" role="dialog" aria-label="选择年份和月份">
          <div className="month-popover-header">
            <button type="button" className="icon-button compact-button" aria-label="上一年" onClick={() => setDisplayYear((year) => year - 1)}>
              <ChevronLeft size={16} />
            </button>
            <strong>{displayYear} 年</strong>
            <button type="button" className="icon-button compact-button" aria-label="下一年" onClick={() => setDisplayYear((year) => year + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="month-grid">
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
              const isSelected = displayYear === selectedYear && month === selectedMonth
              const monthValue = `${displayYear}-${pad(month)}`
              const hasTasks = taskMonthValues.has(monthValue)
              return (
                <button
                  type="button"
                  className={`${isSelected ? 'selected' : ''} ${hasTasks ? 'has-tasks' : ''}`.trim()}
                  key={month}
                  aria-label={`${displayYear} 年 ${month} 月${hasTasks ? '，有任务' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => chooseMonth(month)}
                >
                  <span>{month} 月</span>
                  {hasTasks && <i aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function CompactMonthSelector({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const currentYear = Number(value.slice(0, 4)) || new Date().getFullYear()
  const selectedYear = Number(value.slice(0, 4))
  const selectedMonth = Number(value.slice(5, 7))
  const [displayYear, setDisplayYear] = useState(currentYear)

  return (
    <div className="compact-month-selector" role="group" aria-label="选择结算月份">
      <div className="compact-month-header">
        <button type="button" className="icon-button compact-button" aria-label="上一年" onClick={() => setDisplayYear((year) => year - 1)}>
          <ChevronLeft size={15} />
        </button>
        <strong>{displayYear} 年</strong>
        <button type="button" className="icon-button compact-button" aria-label="下一年" onClick={() => setDisplayYear((year) => year + 1)}>
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="month-grid compact-month-grid">
        {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
          const isSelected = displayYear === selectedYear && month === selectedMonth
          return (
            <button
              type="button"
              className={isSelected ? 'selected' : ''}
              key={month}
              aria-pressed={isSelected}
              onClick={() => onChange(`${displayYear}-${pad(month)}`)}
            >
              <span>{month} 月</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SettlementMonthField({
  label,
  value,
  onChange,
  saved = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  saved?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <label
      className={`field settlement-month-field ${saved ? 'field-saved' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false)
        }
      }}
    >
      <span>{label}</span>
      <button
        type="button"
        className={`month-field-trigger ${isOpen ? 'active' : ''}`}
        aria-label={`选择${label}`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{monthLabelOf(value)}</span>
        <CalendarDays size={16} />
      </button>
      {isOpen && (
        <div className="settlement-month-popover">
          <CompactMonthSelector
            value={value}
            onChange={(nextValue) => {
              onChange(nextValue)
              setIsOpen(false)
            }}
          />
        </div>
      )}
    </label>
  )
}

function TimeTextInput({
  value,
  ariaLabel,
  onChange,
}: {
  value: string
  ariaLabel: string
  onChange: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [syncedValue, setSyncedValue] = useState(value)

  if (value !== syncedValue) {
    setSyncedValue(value)
    setDraft(value)
  }

  const commit = () => {
    const normalized = normalizeClockInput(draft)
    if (!normalized) {
      setDraft(value)
      return
    }
    onChange(normalized)
    setDraft(normalized)
  }

  return (
    <input
      className="time-text-input"
      type="text"
      inputMode="numeric"
      value={draft}
      placeholder="HH:mm"
      aria-label={ariaLabel}
      onChange={(event) => setDraft(event.target.value.replace(/[^\d:]/g, '').slice(0, 5))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        }
      }}
    />
  )
}

function PlanDateTimeField({
  label,
  value,
  onChange,
  isActive = false,
  readOnly = false,
  saved = false,
  control,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  isActive?: boolean
  readOnly?: boolean
  saved?: boolean
  control?: ReactNode
}) {
  const [draft, setDraft] = useState(() => formatPlanDateTime(value))
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => monthPart(value || isoDate()))

  const normalizeDateTimeInput = (input: string) => {
    const match = input.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?$/)
    if (!match) {
      return ''
    }
    const [, year, month, day, hour = '9', minute = '0'] = match
    const monthNumber = Number(month)
    const dayNumber = Number(day)
    const hourNumber = Number(hour)
    const minuteNumber = Number(minute)
    if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31 || hourNumber < 0 || hourNumber > 23 || minuteNumber < 0 || minuteNumber > 59) {
      return ''
    }
    const normalized = `${year}-${pad(monthNumber)}-${pad(dayNumber)}T${pad(hourNumber)}:${pad(minuteNumber)}`
    const date = new Date(normalized)
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== Number(year) || date.getMonth() + 1 !== monthNumber || date.getDate() !== dayNumber) {
      return ''
    }
    return normalized
  }

  const commitDraft = () => {
    if (readOnly) {
      setDraft(formatPlanDateTime(value))
      return
    }
    const normalized = normalizeDateTimeInput(draft)
    if (normalized) {
      onChange(normalized)
      setDraft(formatPlanDateTime(normalized))
      return
    }
    setDraft(formatPlanDateTime(value))
  }

  const selectedValue = toDateTimeInputValue(value || isoDateTime())
  const selectedDate = datePart(selectedValue)
  const selectedHour = selectedValue.slice(11, 13)
  const selectedMinute = selectedValue.slice(14, 16)
  const calendarDays = calendarDaysForMonth(calendarMonth)

  const shiftMonth = (offset: number) => {
    const current = localDateFromIsoDate(`${calendarMonth}-01`)
    current.setMonth(current.getMonth() + offset)
    setCalendarMonth(`${current.getFullYear()}-${pad(current.getMonth() + 1)}`)
  }

  const applyDatePart = (dateValue: string) => {
    if (readOnly) {
      return
    }
    const next = `${dateValue}T${selectedHour}:${selectedMinute}`
    onChange(next)
    setDraft(formatPlanDateTime(next))
    setCalendarMonth(monthPart(next))
  }

  const applyTimePart = (part: 'hour' | 'minute', rawValue: string) => {
    if (readOnly) {
      return
    }
    const digits = rawValue.replace(/\D/g, '')
    if (!digits) {
      return
    }
    const max = part === 'hour' ? 23 : 59
    const nextValue = pad(Math.max(0, Math.min(max, Number(digits))))
    const next = part === 'hour' ? `${selectedDate}T${nextValue}:${selectedMinute}` : `${selectedDate}T${selectedHour}:${nextValue}`
    onChange(next)
    setDraft(formatPlanDateTime(next))
  }

  const applyToday = () => {
    if (readOnly) {
      return
    }
    const now = isoDateTime()
    onChange(now)
    setDraft(formatPlanDateTime(now))
    setCalendarMonth(monthPart(now))
  }

  return (
    <label className={`field date-field ${isActive ? 'active' : ''} ${readOnly ? 'readonly' : ''} ${saved ? 'field-saved' : ''}`}>
      <span className="field-label-row">
        <span>{label}</span>
        {control}
      </span>
      <div className="date-input-wrap">
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          placeholder="YYYY/MM/DD HH:mm"
          readOnly={readOnly}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
        />
        <button
          type="button"
          aria-label={`选择${label}`}
          title={readOnly ? '打开右侧开关后可编辑' : `选择${label}`}
          disabled={readOnly}
          onClick={() => {
            if (!readOnly) {
              setIsPickerOpen((current) => !current)
            }
          }}
        >
          <CalendarDays size={16} />
        </button>
        {isPickerOpen && (
          <div className="date-time-popover" role="dialog" aria-label={`${label}选择器`}>
            <div className="date-time-popover-header">
              <button type="button" aria-label="上个月" title="上个月" onClick={() => shiftMonth(-1)}>
                <ChevronLeft size={15} />
              </button>
              <strong>{monthLabelOf(calendarMonth)}</strong>
              <button type="button" aria-label="下个月" title="下个月" onClick={() => shiftMonth(1)}>
                <ChevronRight size={15} />
              </button>
            </div>
            <div className="date-time-weekdays">
              {weekdayLabels.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="date-time-days">
              {calendarDays.map((day) => (
                <button
                  type="button"
                  key={day.value}
                  className={`${day.inMonth ? '' : 'muted'} ${day.value === selectedDate ? 'active' : ''}`}
                  onClick={() => applyDatePart(day.value)}
                >
                  {day.day}
                </button>
              ))}
            </div>
            <div className="date-time-clock">
              <span>时间</span>
              <input
                value={selectedHour}
                inputMode="numeric"
                maxLength={2}
                aria-label="小时"
                onChange={(event) => applyTimePart('hour', event.target.value)}
              />
              <b>:</b>
              <input
                value={selectedMinute}
                inputMode="numeric"
                maxLength={2}
                aria-label="分钟"
                onChange={(event) => applyTimePart('minute', event.target.value)}
              />
            </div>
            <div className="date-time-popover-actions">
              <button type="button" onClick={applyToday}>今天</button>
              <button type="button" onClick={() => setIsPickerOpen(false)}>完成</button>
            </div>
          </div>
        )}
      </div>
    </label>
  )
}

function ScheduleAnchorSwitch({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`switch-control schedule-anchor-switch ${active ? 'active' : ''}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
    >
      <i />
    </button>
  )
}

function DurationPicker({
  valueMinutes,
  onChange,
}: {
  valueMinutes: number
  onChange: (valueMinutes: number) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedHours = Math.floor(valueMinutes / 60)
  const selectedMinutes = valueMinutes % 60
  const manualHours = Number.isInteger(valueMinutes / 60) ? String(valueMinutes / 60) : (valueMinutes / 60).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')

  const choose = (hours: number, minutes: number) => {
    onChange(hours * 60 + minutes)
  }

  const setManualHours = (value: string) => {
    const hours = Number.parseFloat(value)
    if (!Number.isFinite(hours) || hours < 0) {
      return
    }
    onChange(Math.round(hours * 60))
  }

  return (
    <div
      className="duration-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false)
        }
      }}
    >
      <button
        type="button"
        className={`duration-trigger ${isOpen ? 'active' : ''}`}
        aria-label="选择预估工时"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{formatDuration(valueMinutes)}</span>
        <ChevronDown size={16} />
      </button>
      {isOpen && (
        <div className="duration-menu" aria-label="预估工时选择器">
          <div className="duration-column">
            <strong>h</strong>
            <div className="duration-options">
              {durationHourOptions.map((hour) => (
                <button
                  type="button"
                  className={hour === selectedHours ? 'selected' : ''}
                  key={hour}
                  onClick={() => choose(hour, selectedMinutes)}
                >
                  {hour} h
                </button>
              ))}
            </div>
            <label className="duration-manual">
              <span>手动输入 h</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={manualHours}
                onChange={(event) => setManualHours(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
          </div>
          <div className="duration-column">
            <strong>min</strong>
            <div className="duration-options">
              {durationMinuteOptions.map((minutes) => (
                <button
                  type="button"
                  className={minutes === selectedMinutes ? 'selected' : ''}
                  key={minutes}
                  onClick={() => {
                    choose(selectedHours, minutes)
                    setIsOpen(false)
                  }}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CascadingDesignTypePicker({
  groups,
  value,
  onChange,
}: {
  groups: DesignTypeGroup[]
  value: string
  onChange: (value: string) => void
}) {
  const availableGroups = normalizeDesignTypeGroups(groups)
  const initialGroup = availableGroups.find((group) => group.items.some((item) => `${group.name} / ${item}` === value)) ?? availableGroups[0]
  const [isOpen, setIsOpen] = useState(false)
  const [activeGroupName, setActiveGroupName] = useState(initialGroup.name)
  const activeGroup = availableGroups.find((group) => group.name === activeGroupName) ?? availableGroups[0]

  const choose = (groupName: string, item: string) => {
    onChange(`${groupName} / ${item}`)
    setIsOpen(false)
  }

  return (
    <div
      className="cascade-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false)
        }
      }}
    >
      <button
        type="button"
        className={`cascade-trigger ${isOpen ? 'active' : ''}`}
        aria-label="选择设计类型"
        aria-expanded={isOpen}
        onClick={() => {
          if (!isOpen) {
            setActiveGroupName(initialGroup.name)
          }
          setIsOpen((open) => !open)
        }}
      >
        <span>{value}</span>
        <ChevronDown size={16} />
      </button>
      {isOpen && (
        <div className="cascade-menu" role="listbox" aria-label="设计类型二级选择器">
          <div className="cascade-column">
            {availableGroups.map((group) => (
              <button
                type="button"
                className={group.name === activeGroup.name ? 'active' : ''}
                key={group.name}
                onMouseEnter={() => setActiveGroupName(group.name)}
                onFocus={() => setActiveGroupName(group.name)}
              >
                <span>{group.name}</span>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
          <div className="cascade-column child-column">
            {activeGroup.items.map((item) => {
              const optionValue = `${activeGroup.name} / ${item}`
              return (
                <button
                  type="button"
                  className={optionValue === value ? 'selected' : ''}
                  key={item}
                  aria-selected={optionValue === value}
                  onClick={() => choose(activeGroup.name, item)}
                >
                  {item}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

type DueState = 'overdue' | 'soon' | null

/** 未完成任务的交付提醒状态：已过预计交付日 → 逾期；3 天内到期 → 临期 */
function taskDueState(task: Task, today: string, soonDate: string): DueState {
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

const taskFieldLabels: Record<string, string> = {
  title: '任务名称',
  type: '设计类型',
  date: '预计开始时间',
  estimatedDate: '预计交付时间',
  requester: '需求人',
  contact: '对接人',
  reviewer: '验收人',
  requirement: '需求描述',
}

/** 把审计日志条目翻译成时间轴文案 */
function describeActivity(item: ActivityItem): string {
  const payload = item.payload ?? {}
  if (item.entityType === 'task') {
    if (item.action === 'create') {
      return '接受任务'
    }
    if (item.action === 'void') {
      const reason = typeof payload.reason === 'string' ? payload.reason.trim() : ''
      return reason ? `作废任务；原因：${reason}` : '作废任务'
    }
    if (item.action === 'delete') {
      return '删除任务'
    }
    if (payload.status === '已验收') {
      const acceptanceNote = typeof payload.acceptanceNote === 'string' ? payload.acceptanceNote.trim() : ''
      const actualHours = Number(payload.actualHours)
      const timeEntries = Array.isArray(payload.timeEntries) ? payload.timeEntries : []
      const acceptanceFiles = Array.isArray(payload.acceptanceFiles) ? payload.acceptanceFiles.map(String).filter(Boolean) : []
      const details: string[] = ['确认验收']
      if (Number.isFinite(actualHours)) {
        details.push(`系统计算工时 ${actualHours.toFixed(2)}h`)
      }
      if (acceptanceNote) {
        details.push(`验收备注：${acceptanceNote}`)
      } else if (timeEntries.length > 0) {
        details.push(`包含 ${timeEntries.length} 段时间记录`)
      }
      if (acceptanceFiles.length > 0) {
        details.push(`验收文件：${acceptanceFiles.slice(0, 3).join('、')}${acceptanceFiles.length > 3 ? ` 等 ${acceptanceFiles.length} 个` : ''}`)
      }
      return details.join('；')
    }
    const parts: string[] = []
    if (typeof payload.status === 'string') {
      parts.push(`状态更新为「${payload.status}」`)
    }
    if (payload.progress !== undefined) {
      parts.push(`进度更新为 ${payload.progress}%`)
    }
    if (payload.actualHours !== undefined) {
      parts.push(`实际工时改为 ${payload.actualHours}h`)
    }
    if (Array.isArray(payload.timeEntries)) {
      parts.push(`记录了 ${payload.timeEntries.length} 段时间`)
    }
    if (typeof payload.estimatedDate === 'string') {
      parts.push(`预计交付改为 ${formatPlanDateTime(payload.estimatedDate)}`)
    }
    Object.keys(taskFieldLabels).forEach((key) => {
      if (payload[key] !== undefined) {
        parts.push(`修改了${taskFieldLabels[key]}`)
      }
    })
    return parts.length > 0 ? parts.join('；') : '更新了任务信息'
  }
  if (item.entityType === 'attachment') {
    if (item.action === 'create') {
      return '上传了文件'
    }
    if (item.action === 'delete') {
      return `删除了文件「${String(payload.fileName ?? '')}」`
    }
  }
  if (item.entityType === 'update') {
    if (item.action === 'create') {
      const hours = Number(payload.hours)
      const title = String(payload.title ?? '').trim()
      const body = String(payload.body ?? '').trim()
      if (body) {
        return body.startsWith('上传过程附件') ? '上传过程附件' : body
      }
      return `添加进展「${title}」${hours > 0 ? `（${hours}h）` : ''}`
    }
    if (item.action === 'update') {
      return '修改了进展记录'
    }
    if (item.action === 'delete') {
      return `删除了进展「${String(payload.title ?? '')}」`
    }
  }
  return '其他操作'
}

function getActivityFileNames(item: ActivityItem) {
  const payload = item.payload ?? {}
  const entries: Array<{ id?: number; name: string }> = []
  if (item.entityType === 'attachment' && item.action === 'create' && typeof payload.fileName === 'string') {
    entries.push({ id: Number(item.entityId) || undefined, name: payload.fileName })
  }
  if (item.entityType === 'task' && Array.isArray(payload.acceptanceFiles)) {
    entries.push(...payload.acceptanceFiles.map((name) => ({ name: String(name) })))
  }
  if (item.entityType === 'update' && item.action === 'create') {
    if (Array.isArray(payload.files)) {
      entries.push(...payload.files.map((name) => ({ name: String(name) })))
    }
    const body = typeof payload.body === 'string' ? payload.body.trim() : ''
    const attachmentText = body.match(/^上传过程附件[:：](.+)$/)?.[1]
    if (attachmentText) {
      entries.push(...attachmentText.split(/[、,，\n]/).map((name) => ({ name: name.trim() })).filter((entry) => entry.name))
    }
  }
  const seen = new Set<string>()
  return entries.filter((entry) => {
    const key = `${entry.id ?? ''}:${entry.name}`
    if (!entry.name || seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function fileTypeFromName(name: string) {
  const extension = name.split('.').pop()?.trim().toUpperCase() ?? ''
  return extension === 'JPEG' ? 'JPG' : extension
}

function getActivityFileTypeTags(item: ActivityItem) {
  const tags = getActivityFileNames(item)
    .map((entry) => fileTypeFromName(entry.name))
    .filter(Boolean)
  return Array.from(new Set(tags)).slice(0, 3)
}

function taskAssistantFiles(task: Task, files: FileAsset[], uploadedFiles: Array<FileAsset | string> = []) {
  const taskFileNames = new Set([...(task.files ?? []), ...(task.acceptanceFiles ?? [])].map((name) => name.trim()).filter(Boolean))
  const uploadedNames = uploadedFiles
    .map((file) => (typeof file === 'string' ? file : file.name))
    .map((name) => name.trim())
    .filter(Boolean)
  uploadedNames.forEach((name) => taskFileNames.add(name))

  const relatedFiles = files.filter((file) => file.taskId === task.id || taskFileNames.has(file.name))
  const fallbackFiles = [...taskFileNames].map((name) => ({
    name,
    type: '',
    tag: task.acceptanceFiles?.includes(name) ? '验收文件' : '',
    final: task.acceptanceFiles?.includes(name) ?? false,
    visible: true,
    uploadedAt: '',
  }))

  const seen = new Set<string>()
  return [...relatedFiles, ...fallbackFiles]
    .filter((file) => {
      if (!file.name || seen.has(file.name)) {
        return false
      }
      seen.add(file.name)
      return true
    })
    .slice(0, 40)
    .map((file) => ({
      name: file.name,
      type: file.type,
      tag: file.tag,
      final: file.final,
      visible: file.visible,
      uploadedAt: file.uploadedAt,
    }))
}

function taskAssistantActivity(activity: ActivityItem[]) {
  return activity.slice(0, 12).map((item) => ({
    createdAt: item.createdAt,
    summary: describeActivity(item),
  }))
}

function renderTextAssistantBody(text: string) {
  return text.split('\n').map((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) {
      return null
    }
    return <span className="ai-suggestion-line" key={index}>{trimmed}</span>
  })
}

const readDraftCache = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') {
    return fallback
  }
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<T>) } : fallback
  } catch {
    return fallback
  }
}

const writeDraftCache = (key: string, value: unknown) => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(key, JSON.stringify(value))
}

const clearDraftCache = (key: string) => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(key)
}

function ActivityFileChips({
  item,
  files = [],
  onPreviewFile,
}: {
  item: ActivityItem
  files?: FileAsset[]
  onPreviewFile?: (file: FileAsset) => void
}) {
  const fileEntries = getActivityFileNames(item)
  if (fileEntries.length === 0) {
    return null
  }
  return (
    <div className="activity-file-row">
      {fileEntries.map((entry) => {
        const file = files.find((candidate) => candidate.id === entry.id) ?? files.find((candidate) => candidate.name === entry.name)
        const fileType = (file?.type || fileTypeFromName(entry.name) || 'FILE').toUpperCase()
        const isImage = isInlineImageFileType(fileType)
        const isDesignFile = ['PSD', 'PSB', 'AI'].includes(fileType)
        const thumbUrl = file ? authedPreviewUrl(file.previewUrl ?? (isImage ? file.sourceUrl : undefined)) : undefined
        const documentPreviewUrl = file && isInlineDocumentFileType(fileType) ? fileDocumentPreviewSource(file) : undefined
        const isOfficePreview = isOfficeFileType(fileType)
        const previewCard = (
          <>
            <span className={`activity-file-preview-badge type-${fileType.toLowerCase()}`}>{fileType}</span>
            {thumbUrl ? (
              <img src={thumbUrl} alt={entry.name} loading="lazy" />
            ) : documentPreviewUrl ? (
              <iframe className="activity-file-preview-frame" src={documentPreviewUrl} title={entry.name} loading="lazy" />
            ) : (
              <div className="activity-file-preview-placeholder">
                {isImage || isDesignFile ? <FileImage size={24} /> : isOfficePreview || fileType === 'PDF' ? <FileText size={24} /> : <FileArchive size={24} />}
                <strong>{fileType}</strong>
                <span>{isOfficePreview ? '可预览' : '文件'}</span>
              </div>
            )}
          </>
        )
        if (file && onPreviewFile) {
          return (
            <button type="button" className="activity-file-preview-card clickable" key={`${entry.id ?? ''}-${entry.name}`} onClick={() => onPreviewFile(file)} title="点击预览附件">
              <span className={`activity-file-preview-thumb ${thumbUrl || documentPreviewUrl ? 'visual-preview' : ''}`}>
                {previewCard}
              </span>
              <span className="activity-file-preview-name">{entry.name}</span>
            </button>
          )
        }
        return (
          <span className="activity-file-preview-card" key={`${entry.id ?? ''}-${entry.name}`}>
            <span className={`activity-file-preview-thumb ${thumbUrl || documentPreviewUrl ? 'visual-preview' : ''}`}>
              {previewCard}
            </span>
            <span className="activity-file-preview-name">{entry.name}</span>
          </span>
        )
      })}
    </div>
  )
}

function timelineTimePart(value: string) {
  if (value.length <= 10) {
    return ''
  }
  if (value.includes('T')) {
    return value.slice(11, 16)
  }
  return value.slice(11, 16).trim()
}

function TimelineStamp({ value, audience }: { value: string; audience: 'admin' | 'public' }) {
  const privateTime = audience === 'admin' ? timelineTimePart(value) : ''
  return (
    <time>
      {datePart(value)}
      {privateTime && <span className="admin-only-data"> {privateTime}</span>}
    </time>
  )
}

function TimelineDateLabel({ value }: { value: string }) {
  const privateTime = timelineTimePart(value)
  return (
    <strong>
      {formatTimelineDate(value)}
      {privateTime && <span className="admin-only-data"> {privateTime}</span>}
    </strong>
  )
}

function snapProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value / 10) * 10))
}

type ConfirmDialogState = {
  eyebrow: string
  title: string
  body: string
  confirmText: string
  cancelText?: string
  tone?: 'danger' | 'default'
  details?: string[]
  onConfirm: () => void | Promise<void>
}

type StatusReasonTarget = {
  task: Task
  status: Extract<TaskStatus, '挂起' | '终止'>
} | null

type ToastTone = 'success' | 'error' | 'info'

type ToastState = {
  id: number
  message: string
  tone: ToastTone
}

const inferToastTone = (message: string): ToastTone => {
  if (/(失败|异常|不正确|失效|错误|不可用|无效)/.test(message)) {
    return 'error'
  }
  if (/(正在|上传中|加载)/.test(message)) {
    return 'info'
  }
  return 'success'
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'error') {
    return <AlertTriangle size={17} />
  }
  if (tone === 'info') {
    return <Info size={17} />
  }
  return <CheckCircle2 size={17} />
}

function App() {
  const [activeView, setActiveView] = useState<AppView>(() => viewFromPath(window.location.pathname))
  const [taskViewMode, setTaskViewMode] = useState<TaskViewMode>(() => taskViewModeFromSearch())
  const [auth, setAuth] = useState<StoredAuth | null>(getStoredAuth)
  const [role, setRole] = useState<AuthRole>('member')
  const [accessTokens, setAccessTokens] = useState<AccessToken[]>([])
  const [newTokenId, setNewTokenId] = useState('')
  const [authError, setAuthError] = useState('')
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [monthValue, setMonthValue] = useState(() => isoDate().slice(0, 7))
  const [taskItems, setTaskItems] = useState<Task[]>([])
  const [updateItems, setUpdateItems] = useState<TaskUpdate[]>([])
  const [fileItems, setFileItems] = useState<FileAsset[]>([])
  const [attachmentAnalyses, setAttachmentAnalyses] = useState<AttachmentAnalysis[]>([])
  const [reports, setReports] = useState<ReportRecord[]>([])
  const [hourlyRate, setHourlyRate] = useState(defaultHourlyRate)
  const [pdfTitle, setPdfTitle] = useState(defaultPdfTitle)
  const [serviceCompanyName, setServiceCompanyName] = useState(defaultServiceCompanyName)
  const [taxMode, setTaxMode] = useState<TaxMode>('salary')
  const [designTypeGroups, setDesignTypeGroups] = useState(defaultDesignTypeGroups)
  const [aiModelConfig, setAiModelConfig] = useState<AiModelConfig | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState(0)
  const [detailTaskId, setDetailTaskId] = useState(0)
  const [editTaskId, setEditTaskId] = useState(0)
  const [progressModalTaskId, setProgressModalTaskId] = useState(0)
  const [acceptanceModalTaskId, setAcceptanceModalTaskId] = useState(0)
  const [taskActivity, setTaskActivity] = useState<ActivityItem[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileAsset | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [isConfirmDialogBusy, setIsConfirmDialogBusy] = useState(false)
  const [voidTaskTarget, setVoidTaskTarget] = useState<Task | null>(null)
  const [isVoidTaskBusy, setIsVoidTaskBusy] = useState(false)
  const [statusReasonTarget, setStatusReasonTarget] = useState<StatusReasonTarget>(null)
  const [showVoidedTasks, setShowVoidedTasks] = useState(false)
  const [dashboardContextMenu, setDashboardContextMenu] = useState<{ x: number; y: number; task: Task } | null>(null)
  const [dashboardCreateMenu, setDashboardCreateMenu] = useState<{ x: number; y: number } | null>(null)
  const [showFireworks, setShowFireworks] = useState(false)
  const [toastQueue, setToastQueue] = useState<ToastState[]>([])
  const toastTimersRef = useRef<number[]>([])
  const updatingTaskIdsRef = useRef<Set<number>>(new Set())
  const pendingTaskChangesRef = useRef<Map<number, Partial<Task>>>(new Map())
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)
  const [backendStatus, setBackendStatus] = useState<'连接中' | '已接入 D1/R2' | '后端异常'>('连接中')
  const [taskQuery, setTaskQuery] = useState('')
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('全部')
  const currentMonth = useMemo(() => ({ value: monthValue, label: monthLabelOf(monthValue) }), [monthValue])
  const taskMonthValues = useMemo(
    () => new Set(taskItems.map(taskSettlementMonth).filter((value) => /^\d{4}-\d{2}$/.test(value))),
    [taskItems],
  )
  const monthTasks = useMemo(() => taskItems.filter((task) => taskSettlementMonth(task) === currentMonth.value), [currentMonth.value, taskItems])
  const activeMonthTasks = useMemo(() => monthTasks.filter((task) => !task.voidedAt), [monthTasks])
  const taskPageSourceTasks = useMemo(() => (showVoidedTasks ? monthTasks : activeMonthTasks), [activeMonthTasks, monthTasks, showVoidedTasks])
  const monthUpdates = useMemo(
    () =>
      updateItems.filter((update) => {
        const task = taskItems.find((item) => item.id === update.taskId)
        if (task?.voidedAt) {
          return false
        }
        return update.date.startsWith(currentMonth.value) || (task ? taskSettlementMonth(task) === currentMonth.value : false)
      }),
    [currentMonth.value, taskItems, updateItems],
  )
  const monthFiles = useMemo(
    () =>
      fileItems.filter((file) => {
        const task = taskItems.find((item) => item.id === file.taskId)
        if (task?.voidedAt) {
          return false
        }
        return file.uploadedAt.startsWith(currentMonth.value) || (task ? taskSettlementMonth(task) === currentMonth.value : false)
      }),
    [currentMonth.value, fileItems, taskItems],
  )
  const importedHours = currentMonth.value === importedHoursMonth ? importedMonthlyHours : 0
  const selectedTaskSource = activeView === '任务' ? taskPageSourceTasks : activeMonthTasks
  const selectedTask = selectedTaskSource.find((task) => task.id === selectedTaskId) ?? selectedTaskSource.at(0)
  const viewTitle = activeView === '工作台' ? `${currentMonth.label}工作台` : activeView

  const notify = (message: string, tone: ToastTone = inferToastTone(message)) => {
    const id = Date.now() + Math.random()
    const nextToast: ToastState = { id, message, tone }
    const duration = tone === 'error' ? 4200 : 2400
    setToastQueue((current) => [...current, nextToast].slice(-3))
    const timer = window.setTimeout(() => {
      setToastQueue((current) => current.filter((item) => item !== nextToast))
      toastTimersRef.current = toastTimersRef.current.filter((value) => value !== timer)
    }, duration)
    toastTimersRef.current = [...toastTimersRef.current, timer]
  }

  const handleConfirmDialogConfirm = async () => {
    if (!confirmDialog || isConfirmDialogBusy) {
      return
    }
    setIsConfirmDialogBusy(true)
    try {
      await confirmDialog.onConfirm()
      setConfirmDialog(null)
    } catch (error) {
      notify(error instanceof Error ? error.message : '操作失败，请重试')
    } finally {
      setIsConfirmDialogBusy(false)
    }
  }

  const navigateView = (view: AppView) => {
    setIsAccountMenuOpen(false)
    setActiveView(view)
    const nextPath = taskViewRoute(view, taskViewMode)
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.pushState({ view, taskViewMode }, '', nextPath)
    }
  }

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return undefined
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (accountMenuRef.current?.contains(event.target as Node)) {
        return
      }
      setIsAccountMenuOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAccountMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isAccountMenuOpen])

  useEffect(() => () => {
    toastTimersRef.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  useEffect(() => {
    if (window.location.pathname === '/') {
      window.history.replaceState({ view: activeView, taskViewMode }, '', taskViewRoute(activeView, taskViewMode))
    }
    const handlePopState = () => {
      setActiveView(viewFromPath(window.location.pathname))
      setTaskViewMode(taskViewModeFromSearch(window.location.search))
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const nextPath = taskViewRoute(activeView, taskViewMode)
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.replaceState({ view: activeView, taskViewMode }, '', nextPath)
    }
  }, [activeView, taskViewMode])

  const refreshState = async () => {
    const state = await api.getState()
    setTaskItems(state.tasks)
    setUpdateItems(state.updates)
    setFileItems(state.files)
    setAttachmentAnalyses(state.attachmentAnalyses ?? [])
    setReports(state.reports ?? [])
    setRole(state.role)
    setAccessTokens(state.accessTokens ?? [])
    setHourlyRate(state.settings.hourlyRate)
    setPdfTitle(state.settings.pdfTitle || defaultPdfTitle)
    setServiceCompanyName(state.settings.serviceCompanyName || defaultServiceCompanyName)
    setTaxMode(state.settings.taxMode ?? 'salary')
    setDesignTypeGroups(normalizeDesignTypeGroups(state.settings.designTypeGroups ?? [{ name: '常用类型', items: state.settings.designTypes ?? defaultDesignTypes }]))
    setAiModelConfig(state.settings.aiModel ?? null)
    setSelectedTaskId((currentId) => {
      const activeTasks = state.tasks.filter((task) => !task.voidedAt)
      return activeTasks.some((task) => task.id === currentId) ? currentId : activeTasks[0]?.id ?? state.tasks[0]?.id ?? 0
    })
    setBackendStatus('已接入 D1/R2')
    setIsLoaded(true)
  }

  useEffect(() => {
    // Initial and credential-change state hydration is the intended effect here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshState().catch((error) => {
      if (error instanceof ApiError && error.status === 401) {
        clearStoredAuth()
        setAuth(null)
        setRole('member')
        setAuthError('登录已失效（口令可能被停用或已过期），已切换为游客只读')
        void refreshState().catch((publicError) => {
          setBackendStatus('后端异常')
          setIsLoaded(true)
          notify(publicError instanceof Error ? `后端连接失败：${publicError.message}` : '后端连接失败')
        })
        return
      }
      setBackendStatus('后端异常')
      setIsLoaded(true)
      notify(error instanceof Error ? `后端连接失败：${error.message}` : '后端连接失败')
    })
  }, [auth])

  const filterTasks = (tasks: Task[]) =>
    tasks.filter((task) => {
      const matchesFilter = taskFilter === '全部' || (!task.voidedAt && task.status === taskFilter)
      const query = taskQuery.trim().toLowerCase()
      const matchesQuery =
        !query ||
        [task.title, task.requirement, task.type, task.requester ?? '', task.contact, task.reviewer, task.voidReason ?? ''].some((value) =>
          value.toLowerCase().includes(query),
        )

      return matchesFilter && matchesQuery
    })

  const visibleTasks = filterTasks(activeMonthTasks)
  const taskPageTasks = filterTasks(taskPageSourceTasks)

  const voidedMonthTaskCount = useMemo(() => monthTasks.filter((task) => task.voidedAt).length, [monthTasks])

  const taskContextOptions = useMemo(
    () => ({
      reports,
    }),
    [reports],
  )

  const activeTaskItems = useMemo(() => taskItems.filter((task) => !task.voidedAt), [taskItems])
  const taskContextInsights = useMemo(
    () => buildTaskContextInsights(activeTaskItems, updateItems),
    [activeTaskItems, updateItems],
  )
  const taskById = useMemo(() => new Map(taskItems.map((task) => [task.id, task])), [taskItems])

  const stats = useMemo(() => {
    const totalHours = activeMonthTasks.reduce((sum, task) => sum + task.actualHours, importedHours)
    const billableHours = activeMonthTasks
      .filter((task) => task.status !== '不计费')
      .reduce((sum, task) => sum + task.actualHours, importedHours)
    const accepted = activeMonthTasks.filter((task) => task.status === '已验收').length
    const pending = activeMonthTasks.filter((task) => task.status === '待验收').length

    return {
      totalHours,
      billableHours,
      amount: Math.round(billableHours * hourlyRate),
      accepted,
      pending,
    }
  }, [activeMonthTasks, hourlyRate, importedHours])

  const donutData = useMemo(() => {
    // 本月洞察只统计实际投入；预计工时只作为排期参考，不参与分析。
    const hoursByType = new Map<string, number>()
    activeMonthTasks.forEach((task) => {
      const hours = task.actualHours
      if (hours > 0) {
        hoursByType.set(task.type, Number(((hoursByType.get(task.type) ?? 0) + hours).toFixed(1)))
      }
    })
    const items: DonutItem[] = [...hoursByType.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], index) => ({ label, value, color: donutPalette[index % donutPalette.length] }))

    return { items, total: Number(items.reduce((sum, item) => sum + item.value, 0).toFixed(1)) }
  }, [activeMonthTasks])

  const today = isoDate()
  const dueSoonDate = isoDate(3)
  const dueTasks = useMemo(() => {
    const overdue = activeTaskItems.filter((task) => taskDueState(task, today, dueSoonDate) === 'overdue')
    const soon = activeTaskItems.filter((task) => taskDueState(task, today, dueSoonDate) === 'soon')
    return { overdue, soon }
  }, [activeTaskItems, dueSoonDate, today])

  const annualData = useMemo(() => {
    const year = currentMonth.value.slice(0, 4)
    const lockedByMonth = new Map(reports.filter((report) => report.month.startsWith(year)).map((report) => [report.month, report]))
    const months = Array.from({ length: 12 }, (_, index) => `${year}-${pad(index + 1)}`)
    const rows = months.map((month) => {
      const tasks = activeTaskItems.filter((task) => taskSettlementMonth(task) === month && task.status !== '不计费')
      const imported = month === importedHoursMonth ? importedMonthlyHours : 0
      const hours = Number(tasks.reduce((sum, task) => sum + task.actualHours, imported).toFixed(1))
      const locked = lockedByMonth.get(month)
      const amount = locked ? locked.totalAmount : Math.round(hours * hourlyRate)
      return { month, hours, amount, locked: Boolean(locked) }
    })
    return {
      year,
      rows,
      totalHours: Number(rows.reduce((sum, row) => sum + row.hours, 0).toFixed(1)),
      totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
    }
  }, [activeTaskItems, currentMonth.value, hourlyRate, reports])

  const weeklyTrendData = useMemo(() => {
    const [year, month] = currentMonth.value.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const weeks: { label: string; value: number }[] = []
    for (let start = 1; start <= daysInMonth; start += 7) {
      const end = Math.min(start + 6, daysInMonth)
      weeks.push({ label: `${month}/${start}-${month}/${end}`, value: 0 })
    }
    monthUpdates.forEach((update) => {
      const hours = Number(update.hours) || 0
      const task = taskById.get(update.taskId)
      const belongsToCurrentMonth = update.date.startsWith(currentMonth.value) || (task ? taskSettlementMonth(task) === currentMonth.value : false)
      if (hours <= 0 || !belongsToCurrentMonth) {
        return
      }
      const day = Number(datePart(update.date).slice(8, 10))
      const weekIndex = Math.min(Math.floor((day - 1) / 7), weeks.length - 1)
      weeks[weekIndex].value += hours
    })
    return weeks.map((week) => ({ ...week, value: Number(week.value.toFixed(1)) }))
  }, [currentMonth.value, monthUpdates, taskById])

  const handleCreateTask = async (task: Task) => {
    try {
      const savedTask = await api.createTask(task)
      await refreshState()
      setSelectedTaskId(savedTask.id)
      if (taskSettlementMonth(savedTask).length >= 7) {
        setMonthValue(taskSettlementMonth(savedTask))
      }
      clearNewTaskDraftCache()
      setIsModalOpen(false)
      setBackendStatus('已接入 D1/R2')
      notify('任务已写入 D1，最新进展已同步')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `任务保存失败：${error.message}` : '任务保存失败')
    }
  }

  const handleBackfillAttachmentAnalyses = async () => {
    const result = await api.backfillAttachmentAnalyses()
    notify(result.created > 0 ? `已为 ${result.created} 个历史附件创建分析任务` : '历史附件都已进入分析链路')
    await refreshState()
  }

  const handleRetryAttachmentAnalysis = async (attachmentId: number) => {
    await api.retryAttachmentAnalysis(attachmentId)
    notify('已重新创建附件分析任务')
    await refreshState()
  }

  const handleCreateTaskUpdate = async (taskId: number, update: { title: string; body: string; hours: number; visible: boolean }) => {
    try {
      const savedUpdate = await api.createUpdate({
        id: 0,
        taskId,
        date: isoDateTime(),
        title: update.title,
        body: update.body,
        hours: update.hours,
        visible: update.visible,
        files: [],
      })
      setUpdateItems((currentUpdates) => [savedUpdate, ...currentUpdates])
      await refreshState()
      await loadTaskActivity(taskId)
      notify('进展记录已保存')
    } catch (error) {
      notify(error instanceof Error ? `进展保存失败：${error.message}` : '进展保存失败')
    }
  }

  const handleRequestDeleteActivity = (item: ActivityItem, task: Task) => {
    setConfirmDialog({
      eyebrow: '删除任务动态',
      title: '确定删除这条任务动态吗？',
      body: '删除后只会从当前任务时间轴移除这条记录，不会回滚任务字段、文件或工时数据。',
      confirmText: '确认删除',
      tone: 'danger',
      details: [task.title, describeActivity(item)],
      onConfirm: async () => {
        try {
          await api.deleteActivity(item.id)
          setTaskActivity((currentItems) => currentItems.filter((activityItem) => activityItem.id !== item.id))
          await loadTaskActivity(task.id)
          notify('任务动态已删除')
        } catch (error) {
          setBackendStatus('后端异常')
          notify(error instanceof Error ? `动态删除失败：${error.message}` : '动态删除失败')
          throw error
        }
      },
    })
  }

  const loadTaskActivity = async (taskId: number) => {
    try {
      const result = await api.getTaskActivity(taskId)
      setTaskActivity(result.items)
    } catch {
      setTaskActivity([])
    }
  }

  const handleOpenTaskDetail = (taskId: number) => {
    setSelectedTaskId(taskId)
    setDetailTaskId(taskId)
    void loadTaskActivity(taskId)
  }

  const handleOpenTaskEdit = (taskId: number) => {
    setSelectedTaskId(taskId)
    setEditTaskId(taskId)
  }

  const handleOpenTaskProgress = (taskId: number) => {
    setSelectedTaskId(taskId)
    setProgressModalTaskId(taskId)
    void loadTaskActivity(taskId)
  }

  const handleOpenTaskAcceptance = (taskId: number) => {
    setSelectedTaskId(taskId)
    setAcceptanceModalTaskId(taskId)
  }

  const handleSaveTaskEdit = (taskId: number, changes: Partial<Task>) => {
    if (isAdmin) {
      void handleUpdateTask(taskId, changes)
    } else {
      requireAdmin()
    }
    setEditTaskId(0)
  }

  const handleConfirmTaskAcceptance = (
    task: Task,
    payload: AcceptancePayload,
  ) => {
    if (isAdmin) {
      void handleUpdateTask(task.id, {
        ...payload.taskChanges,
        status: '已验收',
        reviewer: payload.taskChanges?.reviewer || task.reviewer || payload.taskChanges?.requester || task.requester || '待确认',
        actualHours: payload.actualHours,
        acceptanceNote: payload.acceptanceNote,
        timeEntries: payload.timeEntries,
        acceptanceFiles: payload.acceptanceFiles,
        progress: 100,
        // 非补录任务：结算月份自动跟随验收时间（当前年月）
        settlementMonth: isSupplementalTask(task) ? taskSettlementMonth(task) : monthPart(isoDate()),
      })
    } else {
      requireAdmin()
    }
    setAcceptanceModalTaskId(0)
  }

  useEffect(() => {
    if (!dashboardContextMenu && !dashboardCreateMenu) {
      return
    }
    const closeMenu = () => {
      setDashboardContextMenu(null)
      setDashboardCreateMenu(null)
    }
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }
    window.addEventListener('click', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [dashboardContextMenu, dashboardCreateMenu])

  const openDashboardContextMenu = (event: React.MouseEvent, task: Task) => {
    event.preventDefault()
    setDashboardCreateMenu(null)
    setSelectedTaskId(task.id)
    setDashboardContextMenu({ x: event.clientX, y: event.clientY, task })
  }

  const openDashboardCreateMenu = (event: React.MouseEvent) => {
    if (!isTaskListBlankContextTarget(event.target)) {
      return
    }
    event.preventDefault()
    setDashboardContextMenu(null)
    setDashboardCreateMenu({ x: event.clientX, y: event.clientY })
  }

  const openNewTaskFromDashboardMenu = () => {
    setDashboardCreateMenu(null)
    if (isAdmin) {
      setIsModalOpen(true)
    } else {
      requireAdmin()
    }
  }

  // 选中任务变化时自动加载它的动态时间轴（工作台右侧明细卡用）
  useEffect(() => {
    if (selectedTask) {
      void loadTaskActivity(selectedTask.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTask?.id])

  const handleQuickUploadImage = async (taskId: number, file: File, onProgress?: (ratio: number) => void) => {
    try {
      validateUploadFile(file)
      const extension = file.name.split('.').pop()?.toUpperCase() || 'FILE'
      const preview = await createOptionalPsdPreviewFile(file)
      await api.uploadFile({
        taskId,
        file,
        preview,
        type: extension,
        size: formatFileSize(file.size),
        final: false,
        visible: true,
      }, onProgress)
      await refreshState()
      await loadTaskActivity(taskId)
      notify('图片已上传')
    } catch (error) {
      notify(error instanceof Error ? `上传失败：${error.message}` : '上传失败')
      throw error
    }
  }

  const handleAcceptanceFileUpload = async (taskId: number, file: File, onProgress?: (ratio: number) => void) => {
    const extension = file.name.split('.').pop()?.toUpperCase() || 'FILE'
    const preview = await createOptionalPsdPreviewFile(file)
    const savedFile = await api.uploadFile(
      {
        taskId,
        file,
        preview,
        type: extension,
        size: formatFileSize(file.size),
        final: false,
        visible: true,
        tag: '验收文件',
      },
      onProgress,
    )
    setFileItems((currentFiles) => [savedFile, ...currentFiles])
    setTaskItems((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? { ...task, files: Array.from(new Set([savedFile.name, ...task.files])) } : task)),
    )
    await loadTaskActivity(taskId)
    return savedFile
  }

  const handleUpdateTask = async (taskId: number, changes: Partial<Task>) => {
    if (updatingTaskIdsRef.current.has(taskId)) {
      pendingTaskChangesRef.current.set(taskId, { ...(pendingTaskChangesRef.current.get(taskId) ?? {}), ...changes })
      return
    }
    const currentTask = taskItems.find((task) => task.id === taskId)
    if (!currentTask) {
      return
    }
    if (currentTask.status === '已验收') {
      if (changes.status && changes.status !== '已验收') {
        notify('已验收任务状态已锁定，如需调整请先走验收修正流程')
        return
      }
      if ('actualHours' in changes || 'timeEntries' in changes) {
        notify('已验收任务的工时已锁定，不能再修改实际工时')
        return
      }
    }
    const normalizedChanges = { ...changes }
    if (changes.status) {
      normalizedChanges.stage = changes.status === '已验收' ? '完成' : changes.status
      normalizedChanges.progress = changes.status === '已验收' ? 100 : changes.status === '待验收' ? Math.max(currentTask.progress, 88) : currentTask.progress
      notify('正在保存…', 'info')
    }

    updatingTaskIdsRef.current.add(taskId)
    try {
      const savedTask = await api.updateTask(taskId, normalizedChanges)
      setTaskItems((currentTasks) => currentTasks.map((task) => (task.id === taskId ? { ...task, ...savedTask } : task)))
      setBackendStatus('已接入 D1/R2')
      if (detailTaskId === taskId) {
        void loadTaskActivity(taskId)
      }
      if (selectedTask?.id === taskId) {
        void loadTaskActivity(taskId)
      }
      if (changes.status === '已验收') {
        setShowFireworks(true)
        window.setTimeout(() => setShowFireworks(false), 3000)
      }
      if (changes.status) {
        notify('任务已同步到 D1')
      }
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `任务更新失败：${error.message}` : '任务更新失败')
    } finally {
      updatingTaskIdsRef.current.delete(taskId)
      const pendingChanges = pendingTaskChangesRef.current.get(taskId)
      if (pendingChanges) {
        pendingTaskChangesRef.current.delete(taskId)
        void handleUpdateTask(taskId, pendingChanges)
      }
    }
  }

  const handleVoidTask = (taskId: number) => {
    const task = taskItems.find((item) => item.id === taskId)
    if (!task || task.voidedAt) {
      return
    }
    setVoidTaskTarget(task)
  }

  const handleRequestTaskStatus = (taskId: number, status: TaskStatus) => {
    const task = taskItems.find((item) => item.id === taskId)
    if (!task || task.voidedAt) {
      return
    }
    if (status === '挂起' || status === '终止') {
      setStatusReasonTarget({ task, status })
      return
    }
    const changes: Partial<Task> = status === '待验收' ? { status, progress: Math.max(task.progress, 88) } : { status }
    void handleUpdateTask(taskId, changes)
  }

  const confirmStatusReason = async (reason: string) => {
    if (!statusReasonTarget) {
      return
    }
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      return
    }
    const changes: Partial<Task> =
      statusReasonTarget.status === '挂起'
        ? { status: '挂起', suspendReason: trimmedReason, progress: statusReasonTarget.task.progress }
        : { status: '终止', terminateReason: trimmedReason, progress: statusReasonTarget.task.progress }
    await handleUpdateTask(statusReasonTarget.task.id, changes)
    setStatusReasonTarget(null)
  }

  const confirmVoidTask = async (reason: string) => {
    if (!voidTaskTarget || isVoidTaskBusy) {
      return
    }
    setIsVoidTaskBusy(true)
    try {
      await api.voidTask(voidTaskTarget.id, reason.trim())
      await refreshState()
      setVoidTaskTarget(null)
      notify('任务已作废，不再计入工时和结算')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `作废失败：${error.message}` : '作废失败')
    } finally {
      setIsVoidTaskBusy(false)
    }
  }

  const handleRestoreTask = async (taskId: number) => {
    try {
      await api.restoreTask(taskId)
      await refreshState()
      notify('任务已恢复')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `恢复失败：${error.message}` : '恢复失败')
    }
  }

  const handleDeleteTask = (taskId: number) => {
    const task = taskItems.find((item) => item.id === taskId)
    if (!task?.voidedAt) {
      notify('只有已作废任务才能永久删除', 'error')
      return
    }
    setConfirmDialog({
      eyebrow: '永久删除',
      title: `确定永久删除「${task.title}」吗？`,
      body: '永久删除只允许用于已作废任务。删除后任务不会再出现在后台列表中，关联文件仍会保留在文件库记录里。',
      confirmText: '永久删除',
      tone: 'danger',
      details: [task.type, `作废原因：${task.voidReason || '未记录'}`],
      onConfirm: async () => {
        try {
          await api.deleteTask(taskId)
          await refreshState()
          notify('已作废任务已永久删除')
        } catch (error) {
          setBackendStatus('后端异常')
          notify(error instanceof Error ? `删除失败：${error.message}` : '删除失败')
        }
      },
    })
  }

  const handleCopyShareLink = async (token: string) => {
    const link = `${window.location.origin}/share/${token}`
    try {
      await window.navigator.clipboard.writeText(link)
      notify('甲方分享链接已复制')
    } catch {
      notify(link)
    }
  }

  const handleRotateReportToken = (report: ReportRecord) => {
    setConfirmDialog({
      eyebrow: '重置甲方链接',
      title: `确定重置 ${monthLabelOf(report.month)} 的甲方链接吗？`,
      body: '确认后会生成一个新的只读链接，旧链接将立即失效。结算金额、工时和任务快照不会变化。',
      confirmText: '重置链接',
      details: [`当前结算：${report.billableHours.toFixed(1)}h · ¥${report.totalAmount.toLocaleString()}`, '旧链接失效后，需要把新链接重新发给甲方。'],
      onConfirm: async () => {
        const result = await api.rotateMonthlyReportToken(report.id)
        setReports((current) => current.map((item) => (item.id === result.report.id ? result.report : item)))
        const link = `${window.location.origin}/share/${result.report.publicToken}`
        try {
          await window.navigator.clipboard.writeText(link)
          notify('甲方链接已重置，新链接已复制')
        } catch {
          notify(`甲方链接已重置：${link}`)
        }
      },
    })
  }

  const handleDownloadFile = (file: FileAsset) => {
    const sourceUrl = authedPreviewUrl(file.sourceUrl)
    if (!sourceUrl) {
      notify('源文件链接不可用', 'error')
      return
    }
    const link = document.createElement('a')
    link.href = sourceUrl
    link.download = file.name
    link.rel = 'noreferrer'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const handleDeleteFile = async (fileId: number) => {
    const file = fileItems.find((item) => item.id === fileId)
    setConfirmDialog({
      eyebrow: '删除文件',
      title: `确定删除「${file?.name ?? '该文件'}」吗？`,
      body: '删除后会同时移除 D1 文件记录、R2 源文件和预览图。请只删除误传文件，已验收或已发给甲方的文件建议保留。',
      confirmText: '确认删除',
      tone: 'danger',
      details: [file?.task, file?.type, file?.size].filter(Boolean) as string[],
      onConfirm: async () => {
        try {
          await api.deleteFile(fileId)
          if (previewFile?.id === fileId) {
            setPreviewFile(null)
          }
          await refreshState()
          notify('文件已删除')
        } catch (error) {
          setBackendStatus('后端异常')
          notify(error instanceof Error ? `文件删除失败：${error.message}` : '文件删除失败')
        }
      },
    })
  }

  const handleUpdateFile = async (fileId: number, changes: { name?: string; tag?: string }) => {
    try {
      const updatedFile = await api.updateFile(fileId, changes)
      setFileItems((currentFiles) => currentFiles.map((file) => (file.id === fileId ? { ...file, ...updatedFile } : file)))
      setTaskItems((currentTasks) =>
        currentTasks.map((task) =>
          task.id === updatedFile.taskId
            ? { ...task, files: Array.from(new Set([updatedFile.name, ...task.files.filter((fileName) => fileName !== updatedFile.name)])) }
            : task,
        ),
      )
      notify('文件信息已更新')
      return updatedFile
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `文件更新失败：${error.message}` : '文件更新失败')
      throw error
    }
  }

  const handleExportBackup = () => {
    const payload = {
      exportedAt: nowStamp(),
      settings: { hourlyRate, pdfTitle, serviceCompanyName, taxMode },
      tasks: taskItems,
      updates: updateItems,
      files: fileItems,
      reports,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `worklog-backup-${isoDate()}.json`
    link.click()
    URL.revokeObjectURL(url)
    notify('备份已导出到下载目录')
  }

  const handleUnlock = async (email: string, key: string) => {
    try {
      const result = await api.login(email, key)
      const credentials = { email, key }
      setStoredAuth(credentials)
      setAuthError('')
      setBackendStatus('连接中')
      setRole(result.role)
      setAuth(credentials)
      setIsLoginModalOpen(false)
      notify(result.role === 'admin' ? '管理员已登录' : '访问口令已登录')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAuthError('账号或密码不正确')
      } else {
        setAuthError(error instanceof Error ? `登录失败：${error.message}` : '登录失败，请重试')
      }
    }
  }

  const handleSignOut = () => {
    clearStoredAuth()
    setAuth(null)
    setRole('member')
    setAccessTokens([])
    setAuthError('')
    setIsAccountMenuOpen(false)
    setIsLoginModalOpen(false)
    notify('已退出管理员身份，当前为游客只读')
  }

  const handleChangeAdminPassword = async (currentPassword: string, newPassword: string) => {
    try {
      await api.changeAdminPassword({ currentPassword, newPassword })
      setAuth((current) => {
        if (!current) {
          return current
        }
        const next = { ...current, key: newPassword }
        setStoredAuth(next)
        return next
      })
      notify('管理员密码已更新')
    } catch (error) {
      notify(error instanceof Error ? `密码更新失败：${error.message}` : '密码更新失败')
      throw error
    }
  }

  const handleCreateAccessToken = async (label: string, expiresInDays: number | null) => {
    try {
      const created = await api.createAccessToken({ label, expiresInDays })
      setAccessTokens((current) => [created, ...current])
      setNewTokenId(created.id)
      try {
        await window.navigator.clipboard.writeText(created.token)
        notify('口令已生成并复制到剪贴板')
      } catch {
        notify('口令已生成，请在列表中复制')
      }
    } catch (error) {
      notify(error instanceof Error ? `口令生成失败：${error.message}` : '口令生成失败')
    }
  }

  const handleToggleAccessToken = async (tokenId: string, disabled: boolean) => {
    try {
      const saved = await api.setAccessTokenDisabled(tokenId, disabled)
      setAccessTokens((current) => current.map((token) => (token.id === tokenId ? saved : token)))
      notify(disabled ? '口令已停用' : '口令已恢复')
    } catch (error) {
      notify(error instanceof Error ? `操作失败：${error.message}` : '操作失败')
    }
  }

  const handleDeleteAccessToken = async (tokenId: string) => {
    const token = accessTokens.find((item) => item.id === tokenId)
    setConfirmDialog({
      eyebrow: '删除口令',
      title: `确定删除「${token?.label || '该口令'}」吗？`,
      body: '正在使用这个口令登录的设备会立即失效，删除后无法恢复。',
      confirmText: '确认删除',
      tone: 'danger',
      details: [token?.expiresAt ? `有效期：${token.expiresAt}` : '永久有效', token?.lastUsedAt ? `最后使用：${token.lastUsedAt}` : '尚未使用'],
      onConfirm: async () => {
        try {
          await api.deleteAccessToken(tokenId)
          setAccessTokens((current) => current.filter((token) => token.id !== tokenId))
          notify('口令已删除')
        } catch (error) {
          notify(error instanceof Error ? `删除失败：${error.message}` : '删除失败')
        }
      },
    })
  }

  const handleCopyAccessToken = async (token: string) => {
    try {
      await window.navigator.clipboard.writeText(token)
      notify('口令已复制')
    } catch {
      notify(token)
    }
  }

  const handleRateChange = async (rate: number) => {
    setHourlyRate(rate)
    try {
      const result = await api.setHourlyRate(rate)
      setHourlyRate(result.hourlyRate)
      setBackendStatus('已接入 D1/R2')
      notify('小时单价已写入 D1')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `单价保存失败：${error.message}` : '单价保存失败')
    }
  }

  const handlePdfTitleChange = async (title: string) => {
    const nextTitle = title.trim() || defaultPdfTitle
    setPdfTitle(nextTitle)
    try {
      const saved = await api.setPdfTitle(nextTitle)
      setPdfTitle(saved.pdfTitle)
      notify('PDF 抬头已保存')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `PDF 抬头保存失败：${error.message}` : 'PDF 抬头保存失败')
    }
  }

  const handleServiceCompanyNameChange = async (name: string) => {
    const nextName = name.trim() || defaultServiceCompanyName
    setServiceCompanyName(nextName)
    try {
      const saved = await api.setServiceCompanyName(nextName)
      setServiceCompanyName(saved.serviceCompanyName)
      notify('服务公司名称已保存')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `服务公司名称保存失败：${error.message}` : '服务公司名称保存失败')
    }
  }

  const handleTaxModeChange = async (mode: TaxMode) => {
    setTaxMode(mode)
    try {
      const saved = await api.setTaxMode(mode)
      setTaxMode(saved.taxMode)
      setBackendStatus('已接入 D1/R2')
      notify('计税方式已保存')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `计税方式保存失败：${error.message}` : '计税方式保存失败')
    }
  }

  const handleDesignTypeGroupsChange = async (nextGroups: DesignTypeGroup[]) => {
    const safeGroups = normalizeDesignTypeGroups(nextGroups)
    setDesignTypeGroups(safeGroups)
    try {
      const result = await api.setDesignTypeGroups(safeGroups)
      setDesignTypeGroups(result.designTypeGroups)
      setBackendStatus('已接入 D1/R2')
      notify('设计类型已写入 D1')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `设计类型保存失败：${error.message}` : '设计类型保存失败')
    }
  }

  const handleAiModelConfigChange = async (
    payload: Partial<Pick<AiModelConfig, 'mode' | 'provider' | 'baseUrl' | 'model' | 'runtimeUrl'>> & {
      apiKey?: string
      clearApiKey?: boolean
      routes?: Partial<Record<AiModelRouteKey, Partial<Pick<AiModelEndpointConfig, 'provider' | 'baseUrl' | 'model'>>>>
      routeApiKeys?: Partial<Record<AiModelRouteKey, string>>
      clearRouteApiKeys?: AiModelRouteKey[]
    },
  ) => {
    try {
      const saved = await api.setAiModelConfig(payload)
      setAiModelConfig(saved)
      setBackendStatus('已接入 D1/R2')
      notify(saved.mode === 'baml-runtime' ? 'BAML Runtime 模型配置已保存' : 'AI 模型配置已保存')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `AI 模型配置保存失败：${error.message}` : 'AI 模型配置保存失败')
    }
  }

  const handleLockMonthlyReport = async () => {
    try {
      const report = await api.lockMonthlyReport({ month: currentMonth.value, hourlyRate, importedHours })
      await refreshState()
      const link = `${window.location.origin}/share/${report.publicToken}`
      try {
        await window.navigator.clipboard.writeText(link)
        notify(`结算已锁定 ¥${report.totalAmount.toLocaleString()}，甲方链接已复制`)
      } catch {
        notify(`结算已锁定 ¥${report.totalAmount.toLocaleString()}：${link}`)
      }
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `结算锁定失败：${error.message}` : '结算锁定失败')
    }
  }

  const isAdmin = role === 'admin' && Boolean(auth)
  const requireAdmin = () => {
    notify('请先登录管理员身份再编辑')
    setIsLoginModalOpen(true)
  }
  const readOnlyUpdateTask = () => requireAdmin()
  const readOnlyUploadFile = async (): Promise<FileAsset> => {
    requireAdmin()
    throw new Error('需要管理员权限')
  }
  const readOnlyUploadImage = async () => {
    requireAdmin()
    throw new Error('需要管理员权限')
  }
  const readOnlyCreateUpdate = async () => {
    requireAdmin()
    throw new Error('需要管理员权限')
  }
  const visibleNavItems = isAdmin ? navItems : navItems.filter((item) => !['结算', '收入', '洞察'].includes(item.label))
  const adminOnlyPanel = (
    <section className="panel read-only-settings-panel">
      <div className="panel-header compact">
        <div>
          <h2>管理员可见</h2>
          <p>这里包含洞察、结算、收入或系统配置，只对管理员开放。游客和甲方成员可以继续查看公开任务、进展和甲方可见文件。</p>
        </div>
      </div>
      <button className="primary-button" onClick={() => setIsLoginModalOpen(true)}>
        <KeyRound size={17} />
        登录管理员
      </button>
    </section>
  )

  if (!isLoaded) {
    return (
      <main className="boot-screen">
        <div className="boot-card">
          <div className="brand-mark">
            <img className="brand-logo" src="/giverny-logo.png" alt="" />
          </div>
          <strong>正在连接工作台</strong>
          <p>正在读取任务、文件和结算数据</p>
          <span className="loading-indicator">
            <LoaderCircle size={15} />
            Cloudflare D1 / R2
          </span>
        </div>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <img className="brand-logo" src="/giverny-logo.png" alt="" />
          </div>
          <div>
            <strong>Giverny</strong>
            <span className={`brand-status ${backendStatus === '后端异常' ? 'error' : backendStatus === '已接入 D1/R2' ? 'ok' : 'pending'}`} title={backendStatus}>
              <i aria-hidden="true" />
              让创作在自己的花园里生长
            </span>
          </div>
        </div>

        <nav className="nav-list" aria-label="主导航">
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label}>
                <button
                  className={`nav-item ${activeView === item.label ? 'active' : ''}`}
                  aria-label={`切换到${item.label}`}
                  onClick={() => navigateView(item.label as AppView)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              </div>
            )
          })}
        </nav>

        <div className="sidebar-account" ref={accountMenuRef}>
          {isAccountMenuOpen && (
            <div className="sidebar-account-menu" role="menu" aria-label="管理员菜单">
              <div className="account-menu-identity">
                <UserCircle size={18} />
                <div>
                  <strong>{auth?.email || '游客访问'}</strong>
                  <span>{isAdmin ? '最终管理员' : auth ? '访问成员（只读）' : '游客只读'}</span>
                </div>
              </div>
              {isAdmin ? (
                <>
                  <button className="account-menu-item" type="button" role="menuitem" onClick={() => navigateView('设置')}>
                    <Settings size={17} />
                    <span>全站设置</span>
                  </button>
                  <div className="account-menu-storage" title="Cloudflare R2 文件空间">
                    <Archive size={17} />
                    <div>
                      <span>R2 文件空间</span>
                      <strong>18.6 GB</strong>
                    </div>
                  </div>
                  <button className="account-menu-item danger" type="button" role="menuitem" onClick={handleSignOut}>
                    <LogOut size={17} />
                    <span>退出登录</span>
                  </button>
                </>
              ) : (
                <>
                  <p className="account-menu-note">当前只能查看公开任务、进展和甲方可见文件；编辑、上传、验收和结算需要管理员身份。</p>
                  <button className="account-menu-item" type="button" role="menuitem" onClick={() => { setIsAccountMenuOpen(false); setIsLoginModalOpen(true) }}>
                    <KeyRound size={17} />
                    <span>登录管理员</span>
                  </button>
                  {auth && (
                    <button className="account-menu-item danger" type="button" role="menuitem" onClick={handleSignOut}>
                      <LogOut size={17} />
                      <span>退出访问口令</span>
                    </button>
                  )}
                </>
              )}
              <div className="account-menu-version" title={`发布于 ${appReleaseDate}`}>v{appVersion}</div>
            </div>
          )}
          <button className={`sidebar-account-trigger ${isAccountMenuOpen || activeView === '设置' ? 'active' : ''}`} type="button" onClick={() => setIsAccountMenuOpen((value) => !value)}>
            <Settings size={18} />
            <span>设置</span>
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>{viewTitle}</h1>
          </div>
          <div className="topbar-actions">
            <MonthPicker value={currentMonth.value} taskMonthValues={taskMonthValues} onChange={setMonthValue} />
            <button className="primary-button" onClick={() => (isAdmin ? setIsModalOpen(true) : requireAdmin())}>
              <Plus size={18} />
              新建任务
            </button>
          </div>
        </header>

        {activeView === '工作台' && (
          <div className="dashboard-context-surface" onContextMenu={openDashboardCreateMenu}>
        <section className="stats-grid" aria-label="本月统计">
          <StatCard
            label="本月总工时"
            value={`${stats.totalHours.toFixed(1)}h`}
            trend={importedHours > 0 ? `含导入工时 ${importedHours.toFixed(1)}h` : '本月任务实际投入'}
            icon={<Clock3 size={20} />}
          />
          <StatCard label="计费工时" value={`${stats.billableHours.toFixed(1)}h`} trend="已排除不计费项" icon={<CheckCircle2 size={20} />} />
          <StatCard
            label="预计收入"
            value={isAdmin ? `¥${stats.amount.toLocaleString()}` : '仅管理员'}
            trend={isAdmin ? `按 ¥${hourlyRate} / 小时` : '游客与甲方不可见'}
            icon={<BarChart3 size={20} />}
          />
          <StatCard label="验收情况" value={`${stats.accepted} / ${activeMonthTasks.length}`} trend={`${stats.pending} 个待验收`} icon={<ListChecks size={20} />} />
        </section>

        {(dueTasks.overdue.length > 0 || dueTasks.soon.length > 0) && (
          <button className="due-strip" onClick={() => navigateView('任务')}>
            <AlarmClock size={17} />
            <span>
              {dueTasks.overdue.length > 0 && <strong className="due-tag overdue">{dueTasks.overdue.length} 个任务已逾期</strong>}
              {dueTasks.overdue.length > 0 && dueTasks.soon.length > 0 && ' · '}
              {dueTasks.soon.length > 0 && <strong className="due-tag soon">{dueTasks.soon.length} 个任务 3 天内交付</strong>}
            </span>
            <em>{[...dueTasks.overdue, ...dueTasks.soon].slice(0, 3).map((task) => task.title).join('、')}</em>
            <ChevronDown size={15} className="due-arrow" />
          </button>
        )}

        <section className="content-grid">
          <div className="main-column">
            <section className="panel task-panel">
              <div className="panel-header">
                <div>
                  <h2>任务明细</h2>
                  <p>按月份汇总工作内容、工时和验收状态</p>
                </div>
                <div className="panel-tools">
                  <label className="search-box">
                    <Search size={16} />
                    <input value={taskQuery} onChange={(event) => setTaskQuery(event.target.value)} placeholder="搜索本月任务、需求、对接人" />
                  </label>
                </div>
              </div>

              <div className="segment-tabs">
                {taskFilters.map((filter) => (
                  <button className={taskFilter === filter ? 'active' : ''} key={filter} onClick={() => setTaskFilter(filter)}>
                    {filter}
                  </button>
                ))}
              </div>

              <div className="task-list" onContextMenu={openDashboardCreateMenu}>
                {visibleTasks.length === 0 && (
                  <div className="empty-state">
                    <strong>{activeMonthTasks.length === 0 ? '这个月还没有任务' : '没有找到匹配任务'}</strong>
                    <p>{activeMonthTasks.length === 0 ? '先建一条真实任务，工时、文件和月报都会从这里串起来。' : '换一个关键词或状态筛选试试。'}</p>
                    {activeMonthTasks.length === 0 && (
                      <button className="ghost-button compact-button empty-state-action" onClick={() => setIsModalOpen(true)}>
                        <Plus size={15} />
                        新建任务
                      </button>
                    )}
                  </div>
                )}
                {visibleTasks.map((task) => {
                  const dueState = taskDueState(task, today, dueSoonDate)
                  const canAcceptTask = task.status === '待验收'
                  const contextInsight = taskContextInsights.get(task.id)
                  return (
                  <article
                    className={`task-row ${selectedTask?.id === task.id ? 'selected' : ''} ${isSupplementalTask(task) ? 'supplemental' : ''}`}
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTaskId(task.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedTaskId(task.id)
                      }
                    }}
                    onContextMenu={(event) => openDashboardContextMenu(event, task)}
                  >
                    <div className="task-date">
                      <b>{formatMonthDay(task.date)}</b>
                      <span className="task-date-meta">
                        <span>{[formatTimePart(task.date), task.type].filter(Boolean).join(' · ')}</span>
                        {isSupplementalTask(task) && (
                          <em className="task-inline-supplement" title={`补录至 ${monthLabelOf(taskSettlementMonth(task))}`}>
                            补录
                          </em>
                        )}
                      </span>
                    </div>
                    <div className="task-main">
                      <strong>{task.title}</strong>
                      <p>{task.requirement}</p>
                      <TaskContextInsightBadge insight={contextInsight} />
                    </div>
                    <div className="task-meta">
                      <b>{task.contact}</b>
                      <span>
                        实际 <strong>{task.actualHours.toFixed(1)}h</strong>
                      </span>
                    </div>
                    <div className="task-row-end">
                      <div className="task-state">
                        <div className="task-state-badges">
                          {dueState && <span className={`due-tag ${dueState}`}>{dueState === 'overdue' ? '已逾期' : '临期'}</span>}
                          <StatusBadge status={task.status} />
                        </div>
                        <div className="progress-cell">
                          <div className="mini-meter">
                            <span style={{ width: `${task.progress}%` }} />
                          </div>
                          <small>{task.progress}%</small>
                        </div>
                      </div>
                      <div className="task-row-actions" aria-label="任务快捷操作">
                        <button type="button" className="icon-button" title="编辑任务" aria-label="编辑任务" onClick={(event) => { event.stopPropagation(); handleOpenTaskEdit(task.id) }}>
                          <Pencil size={15} />
                        </button>
                        <button type="button" className="icon-button" title="记录进展" aria-label="记录进展" onClick={(event) => { event.stopPropagation(); handleOpenTaskProgress(task.id) }}>
                          <BarChart3 size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          title={canAcceptTask ? '去验收' : '当前不是待验收'}
                          aria-label={canAcceptTask ? '去验收' : '当前不是待验收'}
                          disabled={!canAcceptTask}
                          onClick={(event) => { event.stopPropagation(); handleOpenTaskAcceptance(task.id) }}
                        >
                          <ClipboardCheck size={15} />
                        </button>
                      </div>
                    </div>
                  </article>
                  )
                })}
                {dashboardContextMenu && (
                  <TaskContextMenu
                    menu={dashboardContextMenu}
                    onClose={() => setDashboardContextMenu(null)}
                    onOpenTask={handleOpenTaskDetail}
                    onOpenEditTask={handleOpenTaskEdit}
                    onOpenAcceptance={(task) => handleOpenTaskAcceptance(task.id)}
                    onOpenProgress={(task) => handleOpenTaskProgress(task.id)}
                    onRequestStatus={isAdmin ? handleRequestTaskStatus : readOnlyUpdateTask}
                    onUpdateTask={isAdmin ? handleUpdateTask : readOnlyUpdateTask}
                    onVoidTask={isAdmin ? handleVoidTask : readOnlyUpdateTask}
                    onRestoreTask={isAdmin ? handleRestoreTask : readOnlyUpdateTask}
                    onDeleteTask={isAdmin ? handleDeleteTask : readOnlyUpdateTask}
                    onCopyShareLink={handleCopyShareLink}
                    reports={taskContextOptions.reports}
                  />
                )}
                {dashboardCreateMenu && (
                  <CreateTaskContextMenu
                    menu={dashboardCreateMenu}
                    onCreate={openNewTaskFromDashboardMenu}
                  />
                )}
              </div>
            </section>

            <details className="insight-shell">
              <summary className="insight-summary">
                <div>
                  <h2>本月洞察</h2>
                  <p>设计类型、周趋势和年度统计</p>
                </div>
                <span className="insight-summary-action">
                  <ChevronDown size={16} />
                  <em className="show-closed">展开</em>
                  <em className="show-open">收起</em>
                </span>
              </summary>

              <div className="insight-body">
                <section className="bottom-grid">
                  <section className="panel distribution-panel">
                    <div className="panel-header compact">
                      <div>
                        <h2>设计类型工时分布</h2>
                        <p>本月工作类型分布</p>
                      </div>
                    </div>
                    <DonutChart items={donutData.items} total={donutData.total} />
                  </section>

                  <section className="panel trend-panel">
                    <div className="panel-header compact">
                      <div>
                        <h2>工时趋势 <span>小时</span></h2>
                        <p>按周查看本月投入变化</p>
                      </div>
                    </div>
                    <TrendChart data={weeklyTrendData} />
                  </section>
                </section>

                <section className="panel annual-panel">
                  <div className="panel-header compact">
                    <div>
                      <h2>{annualData.year} 年度统计</h2>
                      <p>全年计费工时与收入（已锁定月份按结算快照计）</p>
                    </div>
                    <div className="annual-totals">
                      <span>
                        累计工时 <strong>{annualData.totalHours.toFixed(1)}h</strong>
                      </span>
                      <span>
                        累计收入 <strong>¥{annualData.totalAmount.toLocaleString()}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="annual-bars">
                    {annualData.rows.map((row) => {
                      const maxHours = Math.max(...annualData.rows.map((item) => item.hours), 1)
                      return (
                        <div
                          className={`annual-bar ${row.month === currentMonth.value ? 'current' : ''}`}
                          key={row.month}
                          title={`${monthLabelOf(row.month)}：${row.hours.toFixed(1)}h · ¥${row.amount.toLocaleString()}${row.locked ? '（已锁定）' : ''}`}
                        >
                          <span className="annual-bar-amount">{row.hours > 0 ? `${row.hours.toFixed(1)}h` : ''}</span>
                          <div className="annual-bar-track">
                            <span style={{ height: `${Math.max(row.hours > 0 ? 6 : 0, (row.hours / maxHours) * 100)}%` }} />
                          </div>
                          <small>
                            {Number(row.month.slice(5, 7))}月{row.locked ? ' 🔒' : ''}
                          </small>
                        </div>
                      )
                    })}
                  </div>
                </section>
              </div>
            </details>
          </div>
        </section>
          </div>
        )}

        {activeView === '任务' && (
          <TasksView
            viewMode={taskViewMode}
            onViewModeChange={setTaskViewMode}
            monthValue={currentMonth.value}
            taskMonthValues={taskMonthValues}
            onMonthChange={setMonthValue}
            activeMonthTasks={activeMonthTasks}
            selectedTask={selectedTask}
            tasks={taskPageTasks}
            contextInsights={taskContextInsights}
            taskFilter={taskFilter}
            taskQuery={taskQuery}
            showVoidedTasks={showVoidedTasks}
            voidedTaskCount={voidedMonthTaskCount}
            onUploadAcceptanceFile={isAdmin ? handleAcceptanceFileUpload : readOnlyUploadFile}
            onFilterChange={setTaskFilter}
            onQueryChange={setTaskQuery}
            onShowVoidedChange={setShowVoidedTasks}
            onSelectTask={setSelectedTaskId}
            onUpdateTask={isAdmin ? handleUpdateTask : readOnlyUpdateTask}
            onRequestStatus={isAdmin ? handleRequestTaskStatus : readOnlyUpdateTask}
            onVoidTask={isAdmin ? handleVoidTask : readOnlyUpdateTask}
            onRestoreTask={isAdmin ? handleRestoreTask : readOnlyUpdateTask}
            onDeleteTask={isAdmin ? handleDeleteTask : readOnlyUpdateTask}
            onCopyShareLink={handleCopyShareLink}
            onOpenTask={handleOpenTaskDetail}
            onOpenEditTask={handleOpenTaskEdit}
            reports={reports}
            files={fileItems}
            activity={taskActivity}
            onUploadImage={isAdmin ? handleQuickUploadImage : readOnlyUploadImage}
            onCreateTaskUpdate={isAdmin ? handleCreateTaskUpdate : readOnlyCreateUpdate}
            onPreviewFile={setPreviewFile}
            onCreateTask={() => (isAdmin ? setIsModalOpen(true) : requireAdmin())}
            onRequestDeleteActivity={isAdmin ? handleRequestDeleteActivity : undefined}
          />
        )}

        {activeView === '文件库' && (
          <FilesView
            files={fileItems}
            tasks={taskItems}
            currentMonthValue={currentMonth.value}
            onPreviewFile={setPreviewFile}
            onDeleteFile={isAdmin ? handleDeleteFile : readOnlyUpdateTask}
            onDownloadFile={handleDownloadFile}
            onUpdateFile={isAdmin ? handleUpdateFile : async () => { requireAdmin(); throw new Error('需要管理员权限') }}
          />
        )}

        {activeView === '洞察' && (
          isAdmin ? (
            <InsightsView
              tasks={activeTaskItems}
              updates={updateItems}
              files={fileItems}
              attachmentAnalyses={attachmentAnalyses}
              reports={reports}
              currentMonth={currentMonth}
              hourlyRate={hourlyRate}
              onBackfillAnalyses={handleBackfillAttachmentAnalyses}
              onRetryAnalysis={handleRetryAttachmentAnalysis}
            />
          ) : (
            adminOnlyPanel
          )
        )}

        {activeView === '收入' && (
          isAdmin ? (
            <IncomeView
              annualData={annualData}
              currentMonth={currentMonth}
              taxMode={taxMode}
              onMonthChange={setMonthValue}
            />
          ) : (
            adminOnlyPanel
          )
        )}

        {activeView === '结算' && (
          isAdmin ? (
            <ReportsView
              stats={stats}
              tasks={activeMonthTasks}
              updates={monthUpdates}
              hourlyRate={hourlyRate}
              importedHours={importedHours}
              currentMonth={currentMonth}
              pdfTitle={pdfTitle}
              serviceCompanyName={serviceCompanyName}
              reports={reports}
              onClientPreview={() => navigateView('甲方查看')}
              onCopyShareLink={handleCopyShareLink}
              onRotateReportToken={handleRotateReportToken}
              onLockReport={handleLockMonthlyReport}
            />
          ) : (
            adminOnlyPanel
          )
        )}

        {activeView === '甲方查看' && (
          <ClientReportView
            stats={stats}
            tasks={activeMonthTasks}
            updates={monthUpdates}
            files={monthFiles}
            currentMonth={currentMonth}
            pdfTitle={pdfTitle}
            serviceCompanyName={serviceCompanyName}
            onBack={() => navigateView('结算')}
            onPreviewFile={setPreviewFile}
          />
        )}

        {activeView === '设置' && (
          isAdmin ? (
            <SettingsView
              hourlyRate={hourlyRate}
              pdfTitle={pdfTitle}
              serviceCompanyName={serviceCompanyName}
              taxMode={taxMode}
              designTypeGroups={designTypeGroups}
              aiModelConfig={aiModelConfig}
              role={role}
              accessTokens={accessTokens}
              newTokenId={newTokenId}
              onRateChange={handleRateChange}
              onPdfTitleChange={handlePdfTitleChange}
              onServiceCompanyNameChange={handleServiceCompanyNameChange}
              onTaxModeChange={handleTaxModeChange}
              onDesignTypeGroupsChange={handleDesignTypeGroupsChange}
              onAiModelConfigChange={handleAiModelConfigChange}
              onExportBackup={handleExportBackup}
              onSignOut={handleSignOut}
              onChangePassword={handleChangeAdminPassword}
              onCreateToken={handleCreateAccessToken}
              onToggleToken={handleToggleAccessToken}
              onDeleteToken={handleDeleteAccessToken}
              onCopyToken={handleCopyAccessToken}
            />
          ) : (
            <section className="panel read-only-settings-panel">
              <div className="panel-header compact">
                <div>
                  <h2>只读访问</h2>
                  <p>游客可以查看任务和公开文件，编辑、上传、验收和结算需要管理员身份。</p>
                </div>
              </div>
              <button className="primary-button" onClick={() => setIsLoginModalOpen(true)}>
                <KeyRound size={17} />
                登录管理员
              </button>
            </section>
          )
        )}
      </section>

      {isModalOpen && (
        <NewTaskModal
          designTypeGroups={designTypeGroups}
          currentMonthValue={currentMonth.value}
          onClose={() => setIsModalOpen(false)}
          onCreate={isAdmin ? handleCreateTask : async () => requireAdmin()}
          onDesignTypeGroupsChange={isAdmin ? handleDesignTypeGroupsChange : () => requireAdmin()}
        />
      )}
      {detailTaskId > 0 && (() => {
        const detailTask = taskItems.find((task) => task.id === detailTaskId)
        return detailTask ? (
          <TaskDetailModal
            key={detailTask.id}
            task={detailTask}
            role={role}
            activity={taskActivity}
            files={fileItems}
            onClose={() => setDetailTaskId(0)}
            onPreviewFile={setPreviewFile}
            onOpenAcceptance={handleOpenTaskAcceptance}
            onOpenEdit={(taskId) => {
              setDetailTaskId(0)
              handleOpenTaskEdit(taskId)
            }}
            onOpenProgress={(taskId) => {
              setDetailTaskId(0)
              handleOpenTaskProgress(taskId)
            }}
          />
        ) : null
      })()}
      {editTaskId > 0 && (() => {
        const editTask = taskItems.find((task) => task.id === editTaskId)
        return editTask ? (
          <TaskEditModal
            key={editTask.id}
            task={editTask}
            onClose={() => setEditTaskId(0)}
            onSave={(changes) => handleSaveTaskEdit(editTask.id, changes)}
          />
        ) : null
      })()}
      {progressModalTaskId > 0 && (() => {
        const progressTask = taskItems.find((task) => task.id === progressModalTaskId)
        return progressTask ? (
          <TaskProgressModal
            task={progressTask}
            activity={taskActivity}
            files={fileItems}
            onClose={() => setProgressModalTaskId(0)}
            onPreviewFile={setPreviewFile}
            onUpdateTask={isAdmin ? handleUpdateTask : readOnlyUpdateTask}
            onCreateTaskUpdate={isAdmin ? handleCreateTaskUpdate : readOnlyCreateUpdate}
            onUploadImage={isAdmin ? handleQuickUploadImage : readOnlyUploadImage}
            onRequestDeleteActivity={isAdmin ? handleRequestDeleteActivity : undefined}
          />
        ) : null
      })()}
      {acceptanceModalTaskId > 0 && (() => {
        const acceptanceTask = taskItems.find((task) => task.id === acceptanceModalTaskId)
        return acceptanceTask ? (
          <AcceptanceModal
            task={acceptanceTask}
            initialNote={acceptanceTask.acceptanceNote ?? ''}
            files={fileItems}
            onClose={() => setAcceptanceModalTaskId(0)}
            onConfirm={(payload) => handleConfirmTaskAcceptance(acceptanceTask, payload)}
            onUploadFile={isAdmin ? handleAcceptanceFileUpload : readOnlyUploadFile}
          />
        ) : null
      })()}
      {confirmDialog && (
        <ConfirmDialogModal
          dialog={confirmDialog}
          isBusy={isConfirmDialogBusy}
          onClose={() => setConfirmDialog(null)}
          onConfirm={() => void handleConfirmDialogConfirm()}
        />
      )}
      {voidTaskTarget && (
        <VoidTaskModal
          task={voidTaskTarget}
          isBusy={isVoidTaskBusy}
          onClose={() => setVoidTaskTarget(null)}
          onConfirm={(reason) => void confirmVoidTask(reason)}
        />
      )}
      {statusReasonTarget && (
        <StatusReasonModal
          target={statusReasonTarget}
          onClose={() => setStatusReasonTarget(null)}
          onConfirm={(reason) => void confirmStatusReason(reason)}
        />
      )}
      {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      {isLoginModalOpen && (
        <AdminLoginModal
          error={authError}
          onClose={() => {
            setIsLoginModalOpen(false)
            setAuthError('')
          }}
          onSubmit={handleUnlock}
        />
      )}
      {showFireworks && <Fireworks />}
      {toastQueue.length > 0 && (
        <div className="toast-stack" role="region" aria-label="操作提示">
          {toastQueue.map((item) => (
            <div className={`toast toast-${item.tone}`} key={item.id} role={item.tone === 'error' ? 'alert' : 'status'}>
              <ToastIcon tone={item.tone} />
              <span>{item.message}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

function DonutChart({
  items,
  total,
}: {
  items: DonutItem[]
  total: number
}) {
  if (total <= 0) {
    return (
      <div className="empty-state">
        <strong>暂无工时数据</strong>
        <p>记录任务工时后，这里会按设计类型自动汇总。</p>
      </div>
    )
  }

  const gradient = items
    .reduce(
      (result, item) => {
        const start = result.cursor
        const end = start + (item.value / total) * 100

        return {
          cursor: end,
          segments: [...result.segments, `${item.color} ${start}% ${end}%`],
        }
      },
      { cursor: 0, segments: [] as string[] },
    )
    .segments.join(', ')

  return (
    <div className="donut-layout">
      <div className="donut-chart" style={{ '--donut-gradient': gradient } as CSSProperties}>
        <div>
          <strong>{total.toFixed(1)}h</strong>
          <span>总计</span>
        </div>
      </div>
      <div className="donut-legend">
        {items.map((item) => {
          const percent = Math.round((item.value / total) * 100)
          return (
            <div className="legend-row" key={item.label}>
              <i style={{ background: item.color }} />
              <span>{item.label}</span>
              <strong>
                {item.value.toFixed(1)}h ({percent}%)
              </strong>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TrendChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="empty-state trend-empty">
        <strong>暂无趋势数据</strong>
        <p>记录任务工时后，这里会按周显示本月投入变化。</p>
      </div>
    )
  }

  const width = 560
  const height = 230
  const padding = { top: 24, right: 24, bottom: 36, left: 38 }
  const maxValue = Math.max(4, Math.ceil(Math.max(...data.map((item) => item.value)) / 4) * 4)
  const ticks = [0, maxValue / 4, maxValue / 2, (maxValue / 4) * 3, maxValue]
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const points = data.map((item, index) => {
    const x = data.length === 1 ? padding.left + innerWidth / 2 : padding.left + (innerWidth / (data.length - 1)) * index
    const y = padding.top + innerHeight - (item.value / maxValue) * innerHeight
    return { ...item, x, y }
  })
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="本月每周工时趋势">
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2f8f89" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2f8f89" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => {
          const y = padding.top + innerHeight - (tick / maxValue) * innerHeight
          return (
            <g key={tick}>
              <line className="grid-line" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
              <text className="axis-label y-label" x={10} y={y + 5}>
                {tick}
              </text>
            </g>
          )
        })}
        <path className="trend-area" d={areaPath} />
        <path className="trend-line" d={linePath} />
        {points.map((point) => (
          <g key={point.label}>
            <circle className="trend-point" cx={point.x} cy={point.y} r="5.5" />
            <text className="point-label" x={point.x} y={point.y - 14}>
              {point.value.toFixed(1)}
            </text>
            <text className="axis-label x-label" x={point.x} y={height - 9}>
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function StatCard({
  label,
  value,
  trend,
  icon,
}: {
  label: string
  value: string
  trend: string
  icon: React.ReactNode
}) {
  return (
    <article className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-text">
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{trend}</span>
      </div>
    </article>
  )
}

function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`status-badge status-${status}`}>{status}</span>
}

function StatusDotLabel({ status }: { status: TaskStatus }) {
  return (
    <span className={`status-dot-label status-dot-${status}`}>
      <StatusDot status={status} />
      {status}
    </span>
  )
}

function StatusDot({ status }: { status: TaskStatus }) {
  return <i className={`status-dot status-dot-${status}`} aria-hidden="true" />
}

function TaskStateBadge({ task }: { task: Task }) {
  if (task.voidedAt) {
    return <span className="status-badge status-voided">已作废</span>
  }
  return <StatusBadge status={task.status} />
}

function TaskContextInsightBadge({ insight }: { insight?: TaskContextInsight }) {
  if (!insight) {
    return null
  }
  return (
    <span className={`task-context-insight admin-only-data ${insight.tone}`} title={`${insight.detail}｜依据：${insight.evidence}`}>
      <Info size={12} />
      {insight.label}
    </span>
  )
}

function Fireworks() {
  return (
    <div className="fireworks" aria-hidden="true">
      {Array.from({ length: 32 }, (_, index) => (
        <span key={index} style={{ '--i': index } as CSSProperties} />
      ))}
    </div>
  )
}

function AdminLoginModal({
  error,
  onClose,
  onSubmit,
}: {
  error: string
  onClose: () => void
  onSubmit: (email: string, key: string) => void
}) {
  const [email, setEmail] = useState('')
  const [key, setKey] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async () => {
    if (!key.trim() || isSubmitting) {
      return
    }
    setIsSubmitting(true)
    try {
      await onSubmit(email.trim(), key.trim())
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ModalShell className="admin-login-modal" labelledBy="admin-login-title" onClose={onClose}>
      <header className="modal-header">
        <div>
          <p className="eyebrow">管理员登录</p>
          <h2 id="admin-login-title">登录后才能编辑</h2>
          <small>游客可直接浏览；新建、修改、上传、验收和结算需要管理员身份。</small>
        </div>
        <button className="icon-button modal-close-button" aria-label="关闭" title="关闭" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="admin-login-body">
        <label className="lock-input">
          <Mail size={17} />
          <input value={email} placeholder="管理员邮箱（访问口令登录可留空）" onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="lock-input">
          <Lock size={17} />
          <input
            type="password"
            value={key}
            placeholder="管理密码或访问口令"
            onChange={(event) => setKey(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void submit()
              }
            }}
          />
        </label>
        {error && <p className="lock-error">{error}</p>}
      </div>
      <footer className="modal-footer">
        <button className="ghost-button" onClick={onClose}>取消</button>
        <button className="primary-button" onClick={() => void submit()} disabled={!key.trim() || isSubmitting}>
          {isSubmitting ? '登录中…' : '登录管理员'}
        </button>
      </footer>
    </ModalShell>
  )
}

function CreateTaskContextMenu({
  menu,
  onCreate,
}: {
  menu: { x: number; y: number }
  onCreate: () => void
}) {
  return (
    <div className="task-context-menu create-task-context-menu" style={{ left: menu.x, top: menu.y }} role="menu">
      <button type="button" onClick={onCreate}>
        <Plus size={15} />
        新建任务
      </button>
    </div>
  )
}

function TaskContextMenu({
  menu,
  onClose,
  onOpenTask,
  onOpenEditTask,
  onOpenAcceptance,
  onOpenProgress,
  onRequestStatus,
  onUpdateTask,
  onVoidTask,
  onRestoreTask,
  onDeleteTask,
  onCopyShareLink,
  reports,
}: {
  menu: { x: number; y: number; task: Task }
  onClose: () => void
  onOpenTask: (taskId: number) => void
  onOpenEditTask: (taskId: number) => void
  onOpenAcceptance: (task: Task) => void
  onOpenProgress: (task: Task) => void
  onRequestStatus: (taskId: number, status: TaskStatus) => void
  onUpdateTask: (taskId: number, changes: Partial<Task>) => void
  onVoidTask: (taskId: number) => void
  onRestoreTask: (taskId: number) => void
  onDeleteTask: (taskId: number) => void
  onCopyShareLink: (token: string) => void
  reports: ReportRecord[]
}) {
  const run = (action: () => void) => {
    action()
    onClose()
  }

  const taskMonth = taskSettlementMonth(menu.task)
  const report = reports.find((item) => item.month === taskMonth)
  const isVoided = Boolean(menu.task.voidedAt)
  const progressOptions = [0, 20, 40, 60, 80, 100]

  return (
    <div className="task-context-menu" style={{ left: menu.x, top: menu.y }} role="menu">
      <button type="button" onClick={() => run(() => onOpenTask(menu.task.id))}>
        <Eye size={15} />
        查看任务详情
      </button>
      {!isVoided && (
        <>
          <button type="button" onClick={() => run(() => onOpenEditTask(menu.task.id))}>
            <Pencil size={15} />
            编辑任务
          </button>
          <button type="button" onClick={() => run(() => onOpenProgress(menu.task))}>
            <BarChart3 size={15} />
            记录进展
          </button>
          <button type="button" disabled={menu.task.status !== '待验收'} onClick={() => run(() => onOpenAcceptance(menu.task))}>
            <ClipboardCheck size={15} />
            {menu.task.status === '待验收' ? '去验收' : '去验收（非待验收）'}
          </button>
        </>
      )}
      {!isVoided && (
        <div className="context-submenu">
          <button type="button" className="context-menu-parent" aria-haspopup="menu">
            <BarChart3 size={15} />
            快速改进度
            <span>{menu.task.progress}%</span>
            <ChevronRight size={14} />
          </button>
          <div className="context-submenu-panel progress-submenu-panel" role="menu">
            {progressOptions.map((progress) => {
              const active = menu.task.progress === progress
              return (
              <button type="button" key={progress} className={active ? 'selected' : ''} onClick={() => run(() => onUpdateTask(menu.task.id, { progress }))}>
                {active ? <CheckCircle2 size={15} /> : <BarChart3 size={15} />}
                {progress}%
              </button>
              )
            })}
          </div>
        </div>
      )}
      {!isVoided && (
        <div className="context-submenu">
          <button type="button" className="context-menu-parent" aria-haspopup="menu">
            <ListChecks size={15} />
            改任务状态
            <span>{menu.task.status}</span>
            <ChevronRight size={14} />
          </button>
          <div className="context-submenu-panel" role="menu">
            {(['计划中', '进行中', '待验收', '挂起', '终止'] as TaskStatus[]).map((status) => (
              <button type="button" key={status} onClick={() => run(() => onRequestStatus(menu.task.id, status))}>
                {status === '计划中' ? <ListChecks size={15} /> : status === '进行中' ? <Clock3 size={15} /> : status === '待验收' ? <CheckCircle2 size={15} /> : status === '挂起' ? <Archive size={15} /> : <AlertTriangle size={15} />}
                {status}
              </button>
            ))}
          </div>
        </div>
      )}
      {!isVoided && (
        <div className="context-submenu">
          <button type="button" className="context-menu-parent" aria-haspopup="menu">
            <MoreHorizontal size={15} />
            更多操作
            <ChevronRight size={14} />
          </button>
          <div className="context-submenu-panel" role="menu">
            {report && (
              <button type="button" onClick={() => run(() => onCopyShareLink(report.publicToken))}>
                <Share2 size={15} />
                复制甲方分享链接
              </button>
            )}
          </div>
        </div>
      )}
      {isVoided && (
        <button type="button" onClick={() => run(() => onRestoreTask(menu.task.id))}>
          <RotateCcw size={15} />
          恢复任务
        </button>
      )}
      <div className="context-menu-separator" />
      {isVoided ? (
        <button type="button" className="danger" onClick={() => run(() => onDeleteTask(menu.task.id))}>
          <Trash2 size={15} />
          永久删除
        </button>
      ) : (
        <button type="button" className="danger" onClick={() => run(() => onVoidTask(menu.task.id))}>
          <Trash2 size={15} />
          作废任务
        </button>
      )}
    </div>
  )
}

function FileContextMenu({
  menu,
  onClose,
  onPreview,
  onOpen,
  onDownload,
  onFocusName,
  onFocusTag,
  onDelete,
}: {
  menu: { x: number; y: number; file: FileAsset }
  onClose: () => void
  onPreview: (file: FileAsset) => void
  onOpen: (file: FileAsset) => void
  onDownload: (file: FileAsset) => void
  onFocusName: (file: FileAsset) => void
  onFocusTag: (file: FileAsset) => void
  onDelete: (fileId: number) => void
}) {
  const run = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <div className="task-context-menu file-context-menu" style={{ left: menu.x, top: menu.y }} role="menu">
      <button type="button" onClick={() => run(() => onPreview(menu.file))}>
        <Eye size={15} />
        预览
      </button>
      <button type="button" onClick={() => run(() => onOpen(menu.file))}>
        <ExternalLink size={15} />
        打开原文件
      </button>
      <button type="button" onClick={() => run(() => onFocusName(menu.file))}>
        <Pencil size={15} />
        重命名
      </button>
      <button type="button" onClick={() => run(() => onFocusTag(menu.file))}>
        <Tag size={15} />
        添加标签
      </button>
      <button type="button" onClick={() => run(() => onDownload(menu.file))}>
        <Download size={15} />
        下载源文件
      </button>
      <div className="context-menu-separator" />
      <button type="button" className="danger" onClick={() => run(() => onDelete(menu.file.id))}>
        <Trash2 size={15} />
        删除
      </button>
    </div>
  )
}

function TasksView({
  viewMode,
  onViewModeChange,
  monthValue,
  taskMonthValues,
  onMonthChange,
  activeMonthTasks,
  selectedTask,
  tasks,
  contextInsights,
  taskFilter,
  taskQuery,
  showVoidedTasks,
  voidedTaskCount,
  onUploadAcceptanceFile,
  onFilterChange,
  onQueryChange,
  onShowVoidedChange,
  onSelectTask,
  onUpdateTask,
  onRequestStatus,
  onVoidTask,
  onRestoreTask,
  onDeleteTask,
  onCopyShareLink,
  onOpenTask,
  onOpenEditTask,
  reports,
  files,
  activity,
  onUploadImage,
  onCreateTaskUpdate,
  onPreviewFile,
  onCreateTask,
  onRequestDeleteActivity,
}: {
  viewMode: TaskViewMode
  onViewModeChange: (mode: TaskViewMode) => void
  monthValue: string
  taskMonthValues: Set<string>
  onMonthChange: (month: string) => void
  activeMonthTasks: Task[]
  selectedTask: Task | undefined
  tasks: Task[]
  contextInsights: Map<number, TaskContextInsight>
  taskFilter: TaskFilter
  taskQuery: string
  showVoidedTasks: boolean
  voidedTaskCount: number
  onUploadAcceptanceFile: (taskId: number, file: File, onProgress?: (ratio: number) => void) => Promise<FileAsset>
  onFilterChange: (filter: TaskFilter) => void
  onQueryChange: (query: string) => void
  onShowVoidedChange: (value: boolean) => void
  onSelectTask: (id: number) => void
  onUpdateTask: (taskId: number, changes: Partial<Task>) => void
  onRequestStatus: (taskId: number, status: TaskStatus) => void
  onVoidTask: (taskId: number) => void
  onRestoreTask: (taskId: number) => void
  onDeleteTask: (taskId: number) => void
  onCopyShareLink: (token: string) => void
  onOpenTask: (taskId: number) => void
  onOpenEditTask: (taskId: number) => void
  reports: ReportRecord[]
  files: FileAsset[]
  activity: ActivityItem[]
  onUploadImage: (taskId: number, file: File, onProgress?: (ratio: number) => void) => Promise<void>
  onCreateTaskUpdate: (taskId: number, update: { title: string; body: string; hours: number; visible: boolean }) => Promise<void>
  onPreviewFile: (file: FileAsset) => void
  onCreateTask: () => void
  onRequestDeleteActivity?: (item: ActivityItem, task: Task) => void
}) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: Task } | null>(null)
  const [createMenu, setCreateMenu] = useState<{ x: number; y: number } | null>(null)
  const [acceptanceTask, setAcceptanceTask] = useState<Task | null>(null)
  const [progressTask, setProgressTask] = useState<Task | null>(null)
  const viewTabs = (
    <div className="view-mode-tabs" aria-label="任务视图切换">
      <button className={viewMode === '列表' ? 'active' : ''} onClick={() => onViewModeChange('列表')}>
        <List size={15} />
        列表视图
      </button>
      <button className={viewMode === '日历' ? 'active' : ''} onClick={() => onViewModeChange('日历')}>
        <CalendarDays size={15} />
        日历视图
      </button>
    </div>
  )

  useEffect(() => {
    if (!contextMenu && !createMenu) {
      return
    }
    const closeMenu = () => {
      setContextMenu(null)
      setCreateMenu(null)
    }
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }
    window.addEventListener('click', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [contextMenu, createMenu])

  const openContextMenu = (event: React.MouseEvent, task: Task) => {
    event.preventDefault()
    setCreateMenu(null)
    onSelectTask(task.id)
    setContextMenu({ x: event.clientX, y: event.clientY, task })
  }

  const openCreateMenu = (event: React.MouseEvent) => {
    if (!isTaskListBlankContextTarget(event.target)) {
      return
    }
    event.preventDefault()
    setContextMenu(null)
    setCreateMenu({ x: event.clientX, y: event.clientY })
  }

  const createTaskFromMenu = () => {
    setCreateMenu(null)
    onCreateTask()
  }

  const openAcceptance = (task: Task) => {
    onSelectTask(task.id)
    setAcceptanceTask(task)
  }

  const openProgress = (task: Task) => {
    onSelectTask(task.id)
    setProgressTask(task)
  }

  const confirmListAcceptance = (payload: AcceptancePayload) => {
    if (!acceptanceTask) {
      return
    }
    onUpdateTask(acceptanceTask.id, {
      ...payload.taskChanges,
      status: '已验收',
      reviewer: payload.taskChanges?.reviewer || acceptanceTask.reviewer || payload.taskChanges?.requester || acceptanceTask.requester || '待确认',
      actualHours: payload.actualHours,
      acceptanceNote: payload.acceptanceNote,
      timeEntries: payload.timeEntries,
      acceptanceFiles: payload.acceptanceFiles,
      progress: 100,
      // 非补录任务：结算月份自动跟随验收时间（当前年月）
      settlementMonth: isSupplementalTask(acceptanceTask) ? taskSettlementMonth(acceptanceTask) : monthPart(isoDate()),
    })
    setAcceptanceTask(null)
  }

  if (viewMode === '日历') {
    return (
      <section className="view-stack">
        <section className="panel view-toolbar">
          <div className="panel-header compact">
            <div>
              <h2>任务日历</h2>
              <p>按日期查看已完成与待完成任务，点击日期查看当天安排</p>
            </div>
            <div className="panel-tools calendar-toolbar-actions">
              <MonthPicker value={monthValue} taskMonthValues={taskMonthValues} onChange={onMonthChange} />
              {viewTabs}
            </div>
          </div>
        </section>
        <CalendarView key={monthValue} monthValue={monthValue} tasks={activeMonthTasks} onOpenTask={onOpenTask} onMonthChange={onMonthChange} />
      </section>
    )
  }

  return (
    <section className="view-stack task-create-context-surface" onContextMenu={openCreateMenu}>
      <section className="panel view-toolbar">
        <div className="panel-header compact task-panel-header">
          <div>
            <h2>任务管理</h2>
            <p>集中维护任务字段、验收状态、工时与交付文件</p>
          </div>
          <label className="search-box task-search-inline">
            <Search size={16} />
            <input value={taskQuery} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索任务、需求、对接人" />
          </label>
          {viewTabs}
        </div>
        <div className="task-toolbar-row">
          <div className="segment-tabs">
            {taskFilters.map((filter) => (
              <button className={taskFilter === filter ? 'active' : ''} key={filter} onClick={() => onFilterChange(filter)}>
                {filter === '全部' ? '全部任务' : filter}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`voided-toggle ${showVoidedTasks ? 'active' : ''}`}
            onClick={() => {
              const nextValue = !showVoidedTasks
              onShowVoidedChange(nextValue)
              if (nextValue) {
                onFilterChange('全部')
              }
            }}
            title="作废任务默认隐藏，不参与统计、月报和工时"
          >
            <Archive size={15} />
            {showVoidedTasks ? '隐藏作废' : `显示作废${voidedTaskCount ? ` ${voidedTaskCount}` : ''}`}
          </button>
        </div>
      </section>

      <section className="management-grid">
        <div className="panel task-management-list">
          <div className="management-list-toolbar">
            <span>共 {tasks.length} 条</span>
            <small>悬停显示快捷操作，右键可打开完整菜单</small>
          </div>
          <div className="table-head">
            <span>日期</span>
            <span>任务 · 预计时间</span>
            <span>对接 · 工时</span>
            <span>状态 · 交付</span>
          </div>
          {tasks.map((task) => {
            const dueState = taskDueState(task, isoDate(), isoDate(3))
            const dueDateLabel = formatDueDateCompact(task.estimatedDate || task.date)
            const scheduleSignal = formatTaskScheduleSignal(task)
            const canAcceptTask = task.status === '待验收'
            const contextInsight = contextInsights.get(task.id)
            return (
            <article
              className={`task-row management-row ${selectedTask?.id === task.id ? 'selected' : ''} ${task.voidedAt ? 'voided' : ''} ${isSupplementalTask(task) ? 'supplemental' : ''}`}
              key={task.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                onSelectTask(task.id)
                onOpenTask(task.id)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectTask(task.id)
                  onOpenTask(task.id)
                }
              }}
              onContextMenu={(event) => openContextMenu(event, task)}
            >
              <div className="task-date">
                <b>{formatMonthDay(task.date)}</b>
                <span className="task-date-meta">
                  {formatTimePart(task.date) && <span>{formatTimePart(task.date)}</span>}
                  <em>{task.type || '未分类'}</em>
                  {isSupplementalTask(task) && (
                    <em className="task-inline-supplement" title={`补录至 ${monthLabelOf(taskSettlementMonth(task))}`}>
                      补录
                    </em>
                  )}
                </span>
              </div>
              <div className="task-main">
                <strong>{task.title}</strong>
                <p>{task.requirement}{task.voidedAt ? ` · 已作废${task.voidReason ? `：${task.voidReason}` : ''}` : ''}</p>
                <div className={`task-schedule-row ${task.status === '已验收' ? 'done' : ''}`}>
                  <span className="time-chip">
                    <span>开始</span>
                    <strong>{formatTaskRowDateTime(task.date)}</strong>
                  </span>
                  <span className="time-chip">
                    <span>交付</span>
                    <strong>{formatTaskRowDateTime(task.estimatedDate || task.date)}</strong>
                  </span>
                  <span className={`schedule-countdown ${scheduleSignal.tone}`}>{scheduleSignal.label}</span>
                  <TaskContextInsightBadge insight={contextInsight} />
                </div>
              </div>
              <div className="task-meta">
                <b>{task.contact || '待确认'}</b>
                <span>
                  实际 <strong>{task.actualHours.toFixed(1)}h</strong>
                </span>
              </div>
              <div className="task-row-end">
                <div className="task-state">
                  <div className="task-state-badges">
                    {dueState && <span className={`due-tag ${dueState}`}>{dueState === 'overdue' ? '已逾期' : '临期'}</span>}
                    <StatusBadge status={task.status} />
                  </div>
                  <div className="progress-cell">
                    <div className="mini-meter">
                      <span style={{ width: `${task.progress}%` }} />
                    </div>
                    <small>{task.progress}%</small>
                  </div>
                </div>
                <div className="task-row-actions" aria-label="任务快捷操作">
                  <span className="task-row-due">{dueDateLabel}</span>
                  <button type="button" className="icon-button" title="编辑任务" aria-label="编辑任务" onClick={(event) => { event.stopPropagation(); onOpenEditTask(task.id) }}>
                    <Pencil size={15} />
                  </button>
                  <button type="button" className="icon-button" title="记录进展" aria-label="记录进展" onClick={(event) => { event.stopPropagation(); openProgress(task) }}>
                    <BarChart3 size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    title={canAcceptTask ? '去验收' : '当前不是待验收'}
                    aria-label={canAcceptTask ? '去验收' : '当前不是待验收'}
                    disabled={!canAcceptTask}
                    onClick={(event) => { event.stopPropagation(); openAcceptance(task) }}
                  >
                    <ClipboardCheck size={15} />
                  </button>
                </div>
              </div>
            </article>
            )
          })}
          {tasks.length === 0 && (
            <div className="empty-state">
              <strong>{activeMonthTasks.length === 0 ? '这个月还没有任务' : '没有找到匹配任务'}</strong>
              <p>{activeMonthTasks.length === 0 ? '新建任务后，可以通过双击、快捷图标或右键菜单管理任务。' : '换一个关键词或状态筛选试试。'}</p>
              {activeMonthTasks.length === 0 && (
                <button className="ghost-button compact-button empty-state-action" onClick={onCreateTask}>
                  <Plus size={15} />
                  新建任务
                </button>
              )}
            </div>
          )}
          <div className="task-schedule-legend" aria-label="排期状态说明">
            <span><i className="imminent" />临期：今日 / 明日到期</span>
            <span><i className="overdue" />逾期：超过交付日</span>
            <span><i className="started" />进行中：距交付倒计时</span>
            <span><i className="normal" />正常 / 已验收：灰显</span>
          </div>
          {contextMenu && (
            <TaskContextMenu
              menu={contextMenu}
              onClose={() => setContextMenu(null)}
              onOpenTask={onOpenTask}
              onOpenEditTask={onOpenEditTask}
              onOpenAcceptance={openAcceptance}
              onOpenProgress={openProgress}
              onRequestStatus={onRequestStatus}
              onUpdateTask={onUpdateTask}
              onVoidTask={onVoidTask}
              onRestoreTask={onRestoreTask}
              onDeleteTask={onDeleteTask}
              onCopyShareLink={onCopyShareLink}
              reports={reports}
            />
          )}
          {createMenu && (
            <CreateTaskContextMenu
              menu={createMenu}
              onCreate={createTaskFromMenu}
            />
          )}
        </div>
      </section>
      {acceptanceTask && (
        <AcceptanceModal
          task={acceptanceTask}
          initialNote={acceptanceTask.acceptanceNote ?? ''}
          files={files}
          onClose={() => setAcceptanceTask(null)}
          onConfirm={confirmListAcceptance}
          onUploadFile={onUploadAcceptanceFile}
        />
      )}
      {progressTask && (
        <TaskProgressModal
          task={tasks.find((task) => task.id === progressTask.id) ?? progressTask}
          activity={activity}
          files={files}
          onClose={() => setProgressTask(null)}
          onPreviewFile={onPreviewFile}
          onUpdateTask={onUpdateTask}
          onCreateTaskUpdate={onCreateTaskUpdate}
          onUploadImage={onUploadImage}
          onRequestDeleteActivity={onRequestDeleteActivity}
        />
      )}
    </section>
  )
}

function TaskProgressModal({
  task,
  activity,
  files,
  onClose,
  onPreviewFile,
  onUpdateTask,
  onCreateTaskUpdate,
  onUploadImage,
  onRequestDeleteActivity,
}: {
  task: Task
  activity: ActivityItem[]
  files: FileAsset[]
  onClose: () => void
  onPreviewFile: (file: FileAsset) => void
  onUpdateTask: (taskId: number, changes: Partial<Task>) => void
  onCreateTaskUpdate: (taskId: number, update: { title: string; body: string; hours: number; visible: boolean }) => Promise<void>
  onUploadImage: (taskId: number, file: File, onProgress?: (ratio: number) => void) => Promise<void>
  onRequestDeleteActivity?: (item: ActivityItem, task: Task) => void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const progressDraftKey = `giverny:task-progress-draft:${task.id}:v1`
  const initialProgressDraft = useMemo(
    () => readDraftCache(progressDraftKey, { draftProgress: task.progress, note: '' }),
    [progressDraftKey, task.progress],
  )
  const [draftProgress, setDraftProgress] = useState(initialProgressDraft.draftProgress)
  const [note, setNote] = useState(initialProgressDraft.note)
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedNames, setUploadedNames] = useState<string[]>([])
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [progressAiSuggestion, setProgressAiSuggestion] = useState<TextAssistantSuggestion | null>(null)
  const [progressAiError, setProgressAiError] = useState('')
  const [isProgressAiLoading, setIsProgressAiLoading] = useState(false)
  const [activityExpansion, setActivityExpansion] = useState({ taskId: task.id, showAll: false })
  const savedProgress = task.progress
  const progressDirty = draftProgress !== savedProgress
  const taskActivity = activity
  const canDeleteActivity = Boolean(onRequestDeleteActivity)
  const showAllActivity = activityExpansion.taskId === task.id ? activityExpansion.showAll : false
  const hiddenTaskActivity = taskActivity.slice(5)
  const visibleTaskActivity = showAllActivity ? taskActivity : taskActivity.slice(0, 5)
  const hiddenActivityCount = Math.max(0, taskActivity.length - 5)
  const hiddenActivityHasFiles = hiddenTaskActivity.some((item) => getActivityFileNames(item).length > 0)

  useEffect(() => {
    writeDraftCache(progressDraftKey, { draftProgress, note })
  }, [draftProgress, note, progressDraftKey])

  const uploadFiles = async (fileList: FileList | null) => {
    const selectedFiles = Array.from(fileList ?? [])
    if (selectedFiles.length === 0 || uploading) {
      return
    }
    setUploading(true)
    setUploadErrors([])
    try {
      for (const file of selectedFiles) {
        try {
          await onUploadImage(task.id, file)
          setUploadedNames((currentNames) => [...currentNames, file.name])
        } catch (error) {
          const reason = error instanceof Error ? error.message : '上传失败'
          setUploadErrors((currentErrors) => [...currentErrors, `${file.name}：${reason}`])
        }
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const confirmProgress = () => {
    if (!progressDirty) {
      return
    }
    onUpdateTask(task.id, { progress: draftProgress })
  }

  const saveProgress = async () => {
    if (isSaving) {
      return
    }
    setIsSaving(true)
    try {
      if (progressDirty) {
        confirmProgress()
      }
      const body = note.trim()
      if (body || uploadedNames.length > 0) {
        await onCreateTaskUpdate(task.id, {
          title: '进展更新',
          body: body || `上传过程附件：${uploadedNames.join('、')}`,
          hours: 0,
          visible: false,
        })
      }
      clearDraftCache(progressDraftKey)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const requestProgressAiSuggestion = async () => {
    setProgressAiError('')
    setProgressAiSuggestion(null)
    setIsProgressAiLoading(true)
    try {
      const suggestion = await api.optimizeTaskTextAssistant({
        mode: 'progress',
        text: note,
        task,
        files: taskAssistantFiles(task, files, uploadedNames),
        activity: taskAssistantActivity(taskActivity),
        uploadedFileNames: uploadedNames,
      })
      setProgressAiSuggestion(suggestion)
    } catch (error) {
      setProgressAiError(error instanceof Error ? error.message : 'AI 助手暂时不可用')
    } finally {
      setIsProgressAiLoading(false)
    }
  }

  return (
    <ModalShell className="task-action-modal task-progress-modal" labelledBy="task-progress-title" onClose={onClose}>
      <header className="modal-header">
        <div>
          <p className="eyebrow">进展记录</p>
          <h2 id="task-progress-title">记录进展</h2>
          <small>{task.title} · {task.type} · 对接 {task.contact || '待确认'}</small>
        </div>
        <button className="icon-button modal-close-button" aria-label="关闭" title="关闭" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="task-action-body">
        <section className="action-section">
          <div className="action-section-title">
            <h3>整体进度</h3>
            <span className={progressDirty ? 'admin-only-data' : ''}>{progressDirty ? `● 未保存（${draftProgress}%）` : '已保存'}</span>
          </div>
          <div className="task-progress-control progress-slider-row">
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={draftProgress}
              style={{ '--progress-value': `${draftProgress}%` } as CSSProperties}
              onChange={(event) => setDraftProgress(snapProgress(Number(event.target.value)))}
            />
            <strong>{draftProgress}%</strong>
          </div>
          <div className="task-progress-presets">
            {[0, 20, 40, 60, 80, 100].map((value) => (
              <button type="button" className={draftProgress === value ? 'active' : ''} key={value} onClick={() => setDraftProgress(value)}>
                {value}
              </button>
            ))}
          </div>
          {progressDirty && (
            <div className="progress-draft-actions">
              <button type="button" className="ghost-button compact-button" onClick={() => setDraftProgress(savedProgress)}>撤销</button>
              <button type="button" className="primary-button compact-button" onClick={confirmProgress}>确认进度</button>
            </div>
          )}
        </section>
        <section className="action-section">
          <div className="action-section-title">
            <h3>新增进展</h3>
            <div className="action-section-title-actions">
              <span>确认后写入时间轴</span>
              <button
                type="button"
                className="icon-button ai-assist-button"
                aria-label="AI 优化进展内容"
                title="AI 优化进展内容"
                onClick={() => void requestProgressAiSuggestion()}
                disabled={isProgressAiLoading || (!note.trim() && uploadedNames.length === 0 && taskAssistantFiles(task, files).length === 0)}
              >
                <Sparkles size={16} />
              </button>
            </div>
          </div>
          <textarea className="task-progress-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="写一下目前的进度到哪了，例如：与对接人确认了尺寸，正在出草图。" />
          {(progressAiSuggestion || progressAiError || isProgressAiLoading) && (
            <div className="ai-suggestion-panel task-text-ai-panel">
              <div className="ai-suggestion-head">
                <span>{isProgressAiLoading ? 'AI 正在整理进展' : 'AI 建议'}</span>
              </div>
              {isProgressAiLoading && <p>正在结合当前输入、任务附件和最近进展优化文案...</p>}
              {progressAiError && <p className="ai-suggestion-error">{progressAiError}</p>}
              {progressAiSuggestion && (
                <>
                  <div className="ai-suggestion-body">
                    {renderTextAssistantBody(progressAiSuggestion.optimizedText)}
                  </div>
                  {progressAiSuggestion.summary && <small>{progressAiSuggestion.summary}</small>}
                  <div className="ai-suggestion-actions">
                    <button type="button" className="ghost-button compact-button" onClick={() => setNote(progressAiSuggestion.optimizedText)}>
                      采用建议
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {uploadedNames.length > 0 && (
            <div className="uploaded-chip-row">
              {uploadedNames.map((name) => <span className="file-chip" key={name}><Paperclip size={13} />{name}</span>)}
            </div>
          )}
          {uploadErrors.length > 0 && (
            <div className="upload-error-list" role="alert">
              {uploadErrors.map((message) => <span key={message}>{message}</span>)}
            </div>
          )}
          <button type="button" className="text-button file-add-button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Plus size={15} />
            {uploading ? '上传中…' : '添加过程附件'}
          </button>
          <input
            ref={fileInputRef}
            className="task-row-upload-input"
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.psd,.ai,.eps,.fig,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z"
            onChange={(event) => void uploadFiles(event.target.files)}
          />
        </section>
        <section className="action-section">
          <div className="action-section-title">
            <h3>进展时间轴</h3>
            <div className="progress-timeline-title-actions">
              {hiddenActivityHasFiles && <span className="progress-timeline-attachment-badge">附件</span>}
              <span>{taskActivity.length} 条记录</span>
            </div>
          </div>
          <div className="progress-modal-timeline">
            {taskActivity.length === 0 ? (
              <p>还没有进展记录。</p>
            ) : (
              visibleTaskActivity.map((item) => {
                const fileTypeTags = getActivityFileTypeTags(item)
                return (
                  <article
                    className={`progress-modal-timeline-item ${canDeleteActivity ? 'can-delete' : ''}`}
                    key={item.id}
                    onContextMenu={(event) => {
                      if (!onRequestDeleteActivity) {
                        return
                      }
                      event.preventDefault()
                      onRequestDeleteActivity(item, task)
                    }}
                  >
                    <span className="dot" />
                    <div>
                      <TimelineDateLabel value={item.createdAt} />
                      <span className="progress-modal-timeline-meta">
                        {fileTypeTags.map((tag) => (
                          <span className="progress-modal-file-type" key={`${item.id}-${tag}`}>{tag}</span>
                        ))}
                        {onRequestDeleteActivity && (
                          <button type="button" aria-label="删除任务动态" title="删除任务动态" onClick={() => onRequestDeleteActivity(item, task)}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </span>
                      <p>{describeActivity(item)}</p>
                      <ActivityFileChips item={item} files={files} onPreviewFile={onPreviewFile} />
                    </div>
                  </article>
                )
              })
            )}
            {hiddenActivityCount > 0 && (
              <div className="progress-timeline-more">
                <button
                  type="button"
                  className="progress-timeline-toggle"
                  onClick={() => setActivityExpansion({ taskId: task.id, showAll: !showAllActivity })}
                  aria-expanded={showAllActivity}
                >
                  <ChevronDown size={14} />
                  {showAllActivity ? '收起' : `展开 ${hiddenActivityCount} 条`}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
      <footer className="modal-footer">
        <button className="ghost-button" onClick={onClose}>取消</button>
        <button className="primary-button" disabled={isSaving || (!progressDirty && !note.trim() && uploadedNames.length === 0)} onClick={() => void saveProgress()}>
          {isSaving ? '保存中…' : '保存进展'}
        </button>
      </footer>
    </ModalShell>
  )
}

export function TaskEditor({
  task,
  role,
  activity,
  files = [],
  onUpdateTask,
  onCreateTaskUpdate,
  onRequestDeleteActivity,
  onUploadAcceptanceFile,
  onUploadImage,
  onCollapse,
}: {
  task: Task
  role: AuthRole
  activity: ActivityItem[]
  files?: FileAsset[]
  onUpdateTask: (taskId: number, changes: Partial<Task>) => void
  onCreateTaskUpdate: (taskId: number, update: { title: string; body: string; hours: number; visible: boolean }) => Promise<void>
  onRequestDeleteActivity: (item: ActivityItem, task: Task) => void
  onUploadAcceptanceFile: (taskId: number, file: File, onProgress?: (ratio: number) => void) => Promise<FileAsset>
  onUploadImage: (taskId: number, file: File, onProgress?: (ratio: number) => void) => Promise<void>
  onCollapse?: () => void
}) {
  const [activeTab, setActiveTab] = useState<'信息' | '进展'>(() => (task.status === '待验收' ? '进展' : '信息'))
  const [draft, setDraft] = useState({
    title: task.title,
    type: task.type,
    date: task.date,
    estimatedDate: task.estimatedDate,
    settlementMonth: taskSettlementMonth(task),
    requester: task.requester ?? '',
    contact: task.contact,
    reviewer: task.reviewer,
    requirement: task.requirement,
  })
  const [acceptanceOpen, setAcceptanceOpen] = useState(false)
  const [reasonDraft, setReasonDraft] = useState<{ status: '挂起' | '终止'; reason: string } | null>(null)
  const [timeDraft, setTimeDraft] = useState(defaultTimeEntryDraft)
  const [scheduleAnchor, setScheduleAnchor] = useState<ScheduleAnchor>('start')
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [pickProgress, setPickProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [timeEntryToDelete, setTimeEntryToDelete] = useState<TimeEntry | null>(null)
  const [acceptancePanelOpen, setAcceptancePanelOpen] = useState(false)
  const [progressNote, setProgressNote] = useState('')
  const [isSavingProgressNote, setIsSavingProgressNote] = useState(false)
  const [progressDraftState, setProgressDraftState] = useState<{ taskId: number; value: number } | null>(null)
  const [progressSavedOverride, setProgressSavedOverride] = useState<{ taskId: number; value: number } | null>(null)
  const [activityCollapsed, setActivityCollapsed] = useState(false)
  const [savedFields, setSavedFields] = useState<Set<string>>(() => new Set())
  const savedFieldTimersRef = useRef<Record<string, number>>({})

  useEffect(() => () => {
    Object.values(savedFieldTimersRef.current).forEach((timer) => window.clearTimeout(timer))
  }, [])

  const setField = (field: keyof typeof draft) => (value: string) => setDraft((current) => ({ ...current, [field]: value }))
  const markFieldSaved = (field: string) => {
    setSavedFields((current) => {
      const next = new Set(current)
      next.add(field)
      return next
    })
    window.clearTimeout(savedFieldTimersRef.current[field])
    savedFieldTimersRef.current[field] = window.setTimeout(() => {
      setSavedFields((current) => {
        const next = new Set(current)
        next.delete(field)
        return next
      })
      delete savedFieldTimersRef.current[field]
    }, 900)
  }
  const timeEntries = task.timeEntries ?? []
  const trackedMinutes = sumTimeEntries(timeEntries)
  const reviewHours = timeEntries.length > 0 ? hoursFromTimeEntries(timeEntries) : task.actualHours
  const updateActivity = activity.filter((item) => item.entityType === 'update')
  const editorDueState = taskDueState(task, isoDate(), isoDate(3))
  const savedProgressFromTask = task.progress
  const savedProgress = progressSavedOverride?.taskId === task.id && progressSavedOverride.value !== savedProgressFromTask
    ? progressSavedOverride.value
    : savedProgressFromTask
  const progressDraftValue = progressDraftState?.taskId === task.id ? progressDraftState.value : null
  const displayedProgress = progressDraftValue ?? savedProgress
  const progressDirty = progressDraftValue !== null && progressDraftValue !== savedProgress
  const progressOptions = [0, 20, 40, 60, 80, 100]
  const canManageActivity = role === 'admin'

  const saveTimeEntries = (entries: TimeEntry[]) => {
    const actualHours = hoursFromTimeEntries(entries)
    onUpdateTask(task.id, {
      timeEntries: entries,
      actualHours,
      status: task.status === '计划中' ? '进行中' : task.status,
    })
  }

  const addTimeEntry = () => {
    const start = timeDraft.start.trim()
    const end = timeDraft.end.trim()
    const note = timeDraft.note.trim()
    if (!start || !end || minutesBetween(start, end) <= 0) {
      return
    }
    saveTimeEntries([...timeEntries, { id: crypto.randomUUID(), start, end, note }])
    setTimeDraft(defaultTimeEntryDraft())
  }

  const deleteTimeEntry = (entryId: string) => {
    saveTimeEntries(timeEntries.filter((entry) => entry.id !== entryId))
  }

  const requestDeleteTimeEntry = (entry: TimeEntry) => {
    setTimeEntryToDelete(entry)
  }

  const commitText = (field: 'title' | 'type' | 'date' | 'estimatedDate' | 'settlementMonth' | 'requester' | 'contact' | 'reviewer' | 'requirement') => {
    const value = draft[field].trim()
    const originalValue = field === 'settlementMonth' ? taskSettlementMonth(task) : String(task[field] ?? '')
    if (value && value !== originalValue) {
      const changes: Partial<Task> = { [field]: value }
      if (field === 'requester' && (!task.reviewer || task.reviewer === '待确认' || task.reviewer === originalValue)) {
        changes.reviewer = value
        setDraft((current) => ({ ...current, reviewer: value }))
        markFieldSaved('reviewer')
      }
      onUpdateTask(task.id, changes)
      markFieldSaved(field)
    } else if (!value) {
      setDraft((current) => ({ ...current, [field]: originalValue }))
    }
  }

  const taskEstimatedMinutes = Math.round((Number(task.estimatedHours) || 0) * 60)

  const updatePlannedStartTime = (value: string) => {
    const estimatedDate = addMinutesToPlanDateTime(value, taskEstimatedMinutes)
    const changes: Partial<Task> = { date: value, estimatedDate }
    setDraft((current) => ({ ...current, date: value, estimatedDate }))
    onUpdateTask(task.id, changes)
    markFieldSaved('date')
    markFieldSaved('estimatedDate')
  }

  const updatePlannedEndTime = (value: string) => {
    const date = addMinutesToPlanDateTime(value, -taskEstimatedMinutes)
    const changes: Partial<Task> = { date, estimatedDate: value }
    setDraft((current) => ({ ...current, date, estimatedDate: value }))
    onUpdateTask(task.id, changes)
    markFieldSaved('date')
    markFieldSaved('estimatedDate')
  }

  const updateEstimatedHours = (valueMinutes: number) => {
    const estimatedHours = Math.round((valueMinutes / 60) * 100) / 100
    if (scheduleAnchor === 'end') {
      const date = addMinutesToPlanDateTime(draft.estimatedDate || task.estimatedDate || task.date, -valueMinutes)
      const changes: Partial<Task> = { estimatedHours, date }
      setDraft((current) => ({ ...current, date }))
      onUpdateTask(task.id, changes)
      markFieldSaved('estimatedHours')
      markFieldSaved('date')
      return
    }
    const estimatedDate = addMinutesToPlanDateTime(draft.date || task.date, valueMinutes)
    setDraft((current) => ({ ...current, estimatedDate }))
    onUpdateTask(task.id, { estimatedHours, estimatedDate })
    markFieldSaved('estimatedHours')
    markFieldSaved('estimatedDate')
  }

  const updateSettlementMonth = (value: string) => {
    const nextValue = monthPart(value)
    setDraft((current) => ({ ...current, settlementMonth: nextValue }))
    if (nextValue !== taskSettlementMonth(task)) {
      onUpdateTask(task.id, { settlementMonth: nextValue })
      markFieldSaved('settlementMonth')
    }
  }

  const setProgressDraft = (nextValue: number) => {
    const value = snapProgress(nextValue)
    setProgressDraftState({ taskId: task.id, value })
  }

  const resetProgressDraft = () => {
    setProgressDraftState(null)
  }

  const confirmProgress = () => {
    if (progressDraftValue === null || progressDraftValue === savedProgress) {
      resetProgressDraft()
      return
    }
    onUpdateTask(task.id, { progress: progressDraftValue })
    setProgressSavedOverride({ taskId: task.id, value: progressDraftValue })
    setProgressDraftState(null)
  }

  const requestDeleteActivity = (item: ActivityItem) => {
    if (!canManageActivity) {
      return
    }
    onRequestDeleteActivity(item, task)
  }

  const commitProgressNote = async () => {
    const body = progressNote.trim()
    if (!body || isSavingProgressNote) {
      return
    }
    setIsSavingProgressNote(true)
    try {
      await onCreateTaskUpdate(task.id, {
        title: '进展更新',
        body,
        hours: 0,
        visible: false,
      })
      setProgressNote('')
    } finally {
      setIsSavingProgressNote(false)
    }
  }

  const changeStatus = (status: TaskStatus) => {
    if (status === '挂起') {
      setAcceptanceOpen(false)
      setReasonDraft({ status, reason: task.suspendReason || '' })
      return
    }
    if (status === '终止') {
      setAcceptanceOpen(false)
      setReasonDraft({ status, reason: task.terminateReason || '' })
      return
    }
    if (status === '已验收') {
      setReasonDraft(null)
      setAcceptanceOpen(true)
      return
    }
    setReasonDraft(null)
    onUpdateTask(task.id, { status })
  }

  const confirmReasonStatus = () => {
    if (!reasonDraft?.reason.trim()) {
      return
    }
    if (reasonDraft.status === '挂起') {
      onUpdateTask(task.id, { status: '挂起', suspendReason: reasonDraft.reason.trim(), progress: task.progress })
    } else {
      onUpdateTask(task.id, { status: '终止', terminateReason: reasonDraft.reason.trim(), progress: task.progress })
    }
    setReasonDraft(null)
  }

  const confirmAcceptance = (payload: AcceptancePayload) => {
    onUpdateTask(task.id, {
      ...payload.taskChanges,
      status: '已验收',
      reviewer: payload.taskChanges?.reviewer || draft.reviewer.trim() || payload.taskChanges?.requester || draft.requester.trim() || task.reviewer,
      actualHours: payload.actualHours,
      acceptanceNote: payload.acceptanceNote,
      timeEntries: payload.timeEntries,
      acceptanceFiles: payload.acceptanceFiles,
      progress: 100,
    })
    setAcceptanceOpen(false)
    setAcceptancePanelOpen(false)
  }

  const handlePickImage = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) {
      return
    }
    setUploadError('')
    try {
      validateUploadFile(file)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '文件过大，无法上传')
      return
    }
    setIsUploadingImage(true)
    setPickProgress(0)
    try {
      await onUploadImage(task.id, file, (ratio) => setPickProgress(Math.round(ratio * 100)))
      if (task.status === '计划中') {
        onUpdateTask(task.id, { status: '进行中' })
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '上传失败，请重试')
    } finally {
      setIsUploadingImage(false)
      setPickProgress(0)
    }
  }

  return (
    <aside className="panel task-editor-preview">
      <div className="task-editor-hero">
        <div>
          <p>任务详情</p>
          <h2>{task.title}</h2>
          <small>
            {datePart(task.date).replaceAll('-', '/')} · {task.type} · 对接 {task.contact}
          </small>
        </div>
        <div className="task-editor-hero-actions">
          <TaskStateBadge task={task} />
          {onCollapse && (
            <button className="icon-button" type="button" aria-label="收起任务详情" title="收起任务详情" onClick={onCollapse}>
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="task-editor-tabs" aria-label="任务详情页签">
        <button className={activeTab === '信息' ? 'active' : ''} onClick={() => setActiveTab('信息')}>
          信息
        </button>
        <button className={activeTab === '进展' ? 'active' : ''} onClick={() => setActiveTab('进展')}>
          进展 <span />
        </button>
      </div>

      {activeTab === '信息' ? (
        <section className="task-editor-pane">
          <div className="editor-section-title">
            <div>
              <h3>核心信息</h3>
              <p>任务名称、需求和对接关系，修改后离开输入框自动保存。</p>
            </div>
          </div>
          <div className="editor-fields">
            <label className={`field wide ${savedFields.has('title') ? 'field-saved' : ''}`}>
              <span>任务名称</span>
              <input value={draft.title} onChange={(event) => setField('title')(event.target.value)} onBlur={() => commitText('title')} />
            </label>
            <label className={`field ${savedFields.has('type') ? 'field-saved' : ''}`}>
              <span>设计类型</span>
              <input value={draft.type} onChange={(event) => setField('type')(event.target.value)} onBlur={() => commitText('type')} />
            </label>
            <label className={`field ${savedFields.has('contact') ? 'field-saved' : ''}`}>
              <span>对接人</span>
              <input value={draft.contact} onChange={(event) => setField('contact')(event.target.value)} onBlur={() => commitText('contact')} />
            </label>
            <label className={`field ${savedFields.has('requester') ? 'field-saved' : ''}`}>
              <span>需求人</span>
              <input value={draft.requester} onChange={(event) => setField('requester')(event.target.value)} onBlur={() => commitText('requester')} />
            </label>
            <label className={`field ${savedFields.has('reviewer') ? 'field-saved' : ''}`}>
              <span>验收人</span>
              <input value={draft.reviewer} onChange={(event) => setField('reviewer')(event.target.value)} onBlur={() => commitText('reviewer')} />
            </label>
            <label className={`field wide ${savedFields.has('requirement') ? 'field-saved' : ''}`}>
              <span>任务需求</span>
              <textarea
                value={draft.requirement}
                onChange={(event) => setField('requirement')(event.target.value)}
                onBlur={() => commitText('requirement')}
              />
            </label>
          </div>

          <div className="editor-section-title">
            <div>
              <h3>排期与结算</h3>
              <p>预计开始、预计交付、预估工时和结算月份。</p>
            </div>
          </div>
          <div className="editor-fields">
            <PlanDateTimeField
              label="预计开始时间"
              value={draft.date}
              onChange={updatePlannedStartTime}
              isActive={scheduleAnchor === 'start'}
              readOnly={scheduleAnchor !== 'start'}
              saved={savedFields.has('date')}
              control={<ScheduleAnchorSwitch active={scheduleAnchor === 'start'} label="用预计开始时间推算交付时间" onClick={() => setScheduleAnchor('start')} />}
            />
            <PlanDateTimeField
              label="预计交付时间"
              value={draft.estimatedDate}
              onChange={updatePlannedEndTime}
              isActive={scheduleAnchor === 'end'}
              readOnly={scheduleAnchor !== 'end'}
              saved={savedFields.has('estimatedDate')}
              control={<ScheduleAnchorSwitch active={scheduleAnchor === 'end'} label="用预计交付时间倒推开始时间" onClick={() => setScheduleAnchor('end')} />}
            />
            <label className={`field ${savedFields.has('estimatedHours') ? 'field-saved' : ''}`}>
              <span>预估工时</span>
              <DurationPicker valueMinutes={taskEstimatedMinutes} onChange={updateEstimatedHours} />
            </label>
            {isSupplementalTask(task) ? (
              <SettlementMonthField label="结算月份（补录）" value={draft.settlementMonth} onChange={updateSettlementMonth} saved={savedFields.has('settlementMonth')} />
            ) : (
              <label className="field field-locked">
                <span>结算月份 <small>验收时自动归属</small></span>
                <div className="field-locked-value">{monthLabelOf(taskSettlementMonth(task)) || '待验收时确定'}</div>
              </label>
            )}
          </div>
        </section>
      ) : (
        <section className="task-editor-pane progress-editor-pane">
          <section className="progress-log-panel">
            <div className="workflow-section-title">
              <h3>进展记录</h3>
              <span>进行中随时更新</span>
            </div>
            <div className="progress-note-box">
              <div className="progress-note-box-head">
                <strong>进展时间轴</strong>
                <div>
                  <span>{activity.length} 条记录</span>
                  {activity.length > 0 && (
                    <button type="button" onClick={() => setActivityCollapsed((current) => !current)}>
                      {activityCollapsed ? '展开' : '折叠'}
                    </button>
                  )}
                </div>
              </div>
              <div className="progress-note-list">
                {activity.length === 0 && <p className="calendar-empty-hint">还没有动态记录。可以写下当前做到哪一步，或先上传过程附件。</p>}
                {activity.length > 0 && activityCollapsed && (
                  <p className="progress-collapsed-hint">已折叠 {activity.length} 条任务动态。</p>
                )}
                {!activityCollapsed && activity.slice(0, 8).map((item) => (
                  <article
                    className="progress-note-card"
                    key={item.id}
                    onContextMenu={(event) => {
                      if (!canManageActivity) {
                        return
                      }
                      event.preventDefault()
                      requestDeleteActivity(item)
                    }}
                  >
                    <div>
                      <strong>{item.entityType === 'update' ? String(item.payload?.title ?? '进展更新') : '任务动态'}</strong>
                      <span>
                        <TimelineStamp value={item.createdAt} audience={role === 'admin' ? 'admin' : 'public'} />
                        {canManageActivity && (
                          <button type="button" aria-label="删除任务动态" title="删除任务动态" onClick={() => requestDeleteActivity(item)}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </span>
                    </div>
                    <p>{item.entityType === 'update' ? String(item.payload?.body ?? describeActivity(item)) : describeActivity(item)}</p>
                  </article>
                ))}
              </div>
              <div className="progress-note-create">
                <textarea
                  value={progressNote}
                  placeholder="写一下目前的进度到哪了，例如：与对接人确认了尺寸，正在出草图。"
                  onChange={(event) => setProgressNote(event.target.value)}
                />
                <div className="progress-note-actions">
                  <label className="ghost-link-button progress-attach-button">
                    <Plus size={14} />
                    {isUploadingImage ? `上传中 ${pickProgress}%` : '添加过程附件'}
                    <input type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.psd,.ai,.eps,.fig,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z" disabled={isUploadingImage} onChange={(event) => void handlePickImage(event.target.files)} />
                  </label>
                  <button className="primary-button compact-button" disabled={!progressNote.trim() || isSavingProgressNote} onClick={() => void commitProgressNote()}>
                    {isSavingProgressNote ? '发布中…' : '发布进展'}
                  </button>
                </div>
              </div>
              <div className="progress-record-controls">
                <section className="progress-slider-panel">
                  <div className="workflow-section-title">
                    <h3>整体进展</h3>
                    <span className={progressDirty ? 'progress-unsaved-label' : ''}>
                      {progressDirty ? `● 未保存（${displayedProgress}%）` : '已保存'}
                    </span>
                  </div>
                  <div className="progress-slider-row">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={10}
                      value={displayedProgress}
                      style={{ '--progress-value': `${displayedProgress}%` } as CSSProperties}
                      onChange={(event) => setProgressDraft(Number.parseInt(event.target.value, 10))}
                    />
                    <strong>{displayedProgress}%</strong>
                  </div>
                  <div className="progress-draft-row">
                    <div className="progress-quick-options" aria-label="进度档位快选">
                      {progressOptions.map((value) => (
                        <button
                          type="button"
                          className={displayedProgress === value ? 'active' : ''}
                          key={value}
                          onClick={() => setProgressDraft(value)}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                    {progressDirty && (
                      <div className="progress-draft-actions">
                        <button type="button" className="ghost-button compact-button" onClick={resetProgressDraft}>
                          撤销
                        </button>
                        <button type="button" className="primary-button compact-button" onClick={confirmProgress}>
                          确认
                        </button>
                      </div>
                    )}
                  </div>
                </section>

                <section className="progress-status-panel">
                  <div className="workflow-section-title">
                    <h3>任务状态</h3>
                    <span>{editorDueState === 'overdue' ? '已逾期' : editorDueState === 'soon' ? '临期' : '内部维护'}</span>
                  </div>
                  <div className="editor-fields">
                    <label className="field">
                      <span>任务状态</span>
                      <select value={task.status} onChange={(event) => changeStatus(event.target.value as TaskStatus)}>
                        <option>计划中</option>
                        <option>进行中</option>
                        <option>挂起</option>
                        <option>待验收</option>
                        <option>已验收</option>
                        <option>终止</option>
                        <option>不计费</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>实际工时（系统计算）</span>
                      <input value={`${task.actualHours.toFixed(2)} h`} readOnly />
                    </label>
                    {task.status === '挂起' && (
                      <label className="field wide">
                        <span>挂起原因</span>
                        <textarea value={task.suspendReason ?? ''} onChange={(event) => onUpdateTask(task.id, { suspendReason: event.target.value })} />
                      </label>
                    )}
                    {task.status === '终止' && (
                      <label className="field wide">
                        <span>终止原因</span>
                        <textarea value={task.terminateReason ?? ''} onChange={(event) => onUpdateTask(task.id, { terminateReason: event.target.value })} />
                      </label>
                    )}
                  </div>
                  {reasonDraft && (
                    <section className="status-reason-panel">
                      <div className="section-heading">
                        <h3>{reasonDraft.status === '挂起' ? '填写挂起原因' : '填写终止原因'}</h3>
                        <StatusBadge status={reasonDraft.status} />
                      </div>
                      <label className="field wide">
                        <span>{reasonDraft.status === '挂起' ? '挂起原因' : '终止原因'}</span>
                        <textarea
                          autoFocus
                          value={reasonDraft.reason}
                          onChange={(event) => setReasonDraft((current) => (current ? { ...current, reason: event.target.value } : current))}
                          placeholder={reasonDraft.status === '挂起' ? '例如：等待甲方补充资料或确认方向。' : '例如：需求方要求暂时不进行。'}
                        />
                      </label>
                      <div className="status-reason-actions">
                        <button className="ghost-button compact-button" onClick={() => setReasonDraft(null)}>
                          取消
                        </button>
                        <button className="primary-button compact-button" disabled={!reasonDraft.reason.trim()} onClick={confirmReasonStatus}>
                          确认{reasonDraft.status}
                        </button>
                      </div>
                    </section>
                  )}
                </section>
              </div>
            </div>
            {uploadError && <p className="upload-inline-error">{uploadError}</p>}
            {task.files.length > 0 && (
              <div className="file-list progress-file-list">
                {task.files.slice(0, 5).map((file) => (
                  <span key={file}>
                    {file.endsWith('.psd') || file.endsWith('.ai') ? <FileArchive size={15} /> : <FileText size={15} />}
                    {file}
                  </span>
                ))}
                {task.files.length > 5 && <span>+{task.files.length - 5}</span>}
              </div>
            )}
          </section>

          <section className="task-time-panel">
            <div className="workflow-section-title">
              <h3>时间记录</h3>
              <span>{timeEntries.length} 段 · {formatDuration(trackedMinutes)}</span>
            </div>
            <div className="task-time-list">
              {timeEntries.length === 0 && <p className="calendar-empty-hint">还没有记录时间段。</p>}
              {timeEntries.map((entry) => (
                <div className="task-time-row" key={entry.id}>
                  <div>
                    <strong>{entry.start} - {entry.end}</strong>
                    <span>{entry.note || '未填写具体内容'}</span>
                  </div>
                  <em>{formatDuration(minutesBetween(entry.start, entry.end))}</em>
                  <button className="icon-button danger-icon" aria-label="删除时间段" title="删除时间段" onClick={() => requestDeleteTimeEntry(entry)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="time-entry-create">
              <TimeTextInput value={timeDraft.start} ariaLabel="开始时间" onChange={(value) => setTimeDraft((current) => ({ ...current, start: value }))} />
              <span>至</span>
              <TimeTextInput value={timeDraft.end} ariaLabel="结束时间" onChange={(value) => setTimeDraft((current) => ({ ...current, end: value }))} />
              <input
                value={timeDraft.note}
                placeholder="这段时间具体做了什么"
                onChange={(event) => setTimeDraft((current) => ({ ...current, note: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    addTimeEntry()
                  }
                }}
              />
              <button className="primary-button compact-button" disabled={minutesBetween(timeDraft.start, timeDraft.end) <= 0} onClick={addTimeEntry}>
                <Plus size={15} />
                添加
              </button>
            </div>
          </section>

          <section className="acceptance-collapse-panel">
            <div className="workflow-section-title acceptance-workflow-title">
              <h3>交付验收</h3>
              <span>项目收尾时进行</span>
            </div>
            <button
              type="button"
              className={`acceptance-collapse-trigger ${task.status === '已验收' ? 'done' : ''}`}
              aria-expanded={task.status !== '已验收' && acceptancePanelOpen}
              onClick={() => task.status !== '已验收' && setAcceptancePanelOpen((open) => !open)}
            >
              <span>{task.status === '已验收' ? <CheckCircle2 size={16} /> : <ClipboardCheck size={16} />}</span>
              <div>
                <strong>{task.status === '已验收' ? '已验收' : '交付验收'}</strong>
                <small>{task.status === '已验收' ? '本任务已完成验收，工时已锁定。' : task.status === '待验收' ? '项目已完成，展开后进入终审确认。' : `当前为${task.status}，项目收尾时再展开验收。`}</small>
              </div>
              {task.status !== '已验收' && (
                <span className="acceptance-collapse-action">
                  {acceptancePanelOpen ? '收起' : '展开'}
                  <ChevronDown size={15} />
                </span>
              )}
            </button>
            {acceptancePanelOpen && task.status !== '已验收' && (
              <div className="acceptance-inline-card">
                <div className="acceptance-inline-head">
                  <h4>
                    <CheckCircle2 size={15} />
                    验收前请确认所有内容
                  </h4>
                  <button type="button" className="ghost-link-button" onClick={() => setAcceptancePanelOpen(false)}>
                    收起
                  </button>
                </div>
                <div className="acceptance-review-grid">
                  <div>
                    <span>实际工时</span>
                    <strong>{reviewHours.toFixed(2)} h</strong>
                    <small>{timeEntries.length > 0 ? `来自 ${timeEntries.length} 段时间记录` : '终审弹窗内可补充分段时间'}</small>
                  </div>
                  <label>
                    <span>验收人</span>
                    <input value={draft.reviewer} onChange={(event) => setField('reviewer')(event.target.value)} onBlur={() => commitText('reviewer')} />
                  </label>
                  <div>
                    <span>结算月份</span>
                    <strong>{taskSettlementMonth(task) ? monthLabelOf(taskSettlementMonth(task)) : '未设置'}</strong>
                    <small>{isSupplementalTask(task) ? '补录结算任务' : '按当前归属月份计入'}</small>
                  </div>
                  <div>
                    <span>当前进度</span>
                    <strong>{task.progress}%</strong>
                    <small>确认验收后自动设为 100%</small>
                  </div>
                </div>
                <div className="acceptance-review-meta">
                  <span>{updateActivity.length} 条进展记录</span>
                  <span>{(task.files ?? []).length} 个任务附件</span>
                  <span>{trackedMinutes > 0 ? formatDuration(trackedMinutes) : '未记录分段工时'}</span>
                </div>
                <p>点击“去验收”打开终审弹窗，核对基础信息、进度、分段工时、验收附件和备注；确认后状态变为已验收，工时锁定计入结算，本次项目结束。</p>
                <button type="button" className="primary-button acceptance-go-button" onClick={() => setAcceptanceOpen(true)}>
                  去验收
                </button>
              </div>
            )}
          </section>
        </section>
      )}
      {acceptanceOpen && (
        <AcceptanceModal
          task={task}
          initialNote={task.acceptanceNote ?? ''}
          files={files}
          onClose={() => setAcceptanceOpen(false)}
          onConfirm={confirmAcceptance}
          onUploadFile={onUploadAcceptanceFile}
        />
      )}
      {timeEntryToDelete && (
        <ConfirmDialogModal
          dialog={{
            eyebrow: '删除时间段',
            title: `确定删除 ${timeEntryToDelete.start} - ${timeEntryToDelete.end} 吗？`,
            body: '删除后系统会重新计算这个任务的实际工时。若这段时间已经用于验收或结算，请确认后再删除。',
            confirmText: '确认删除',
            tone: 'danger',
            details: [timeEntryToDelete.note || '未填写具体内容', formatDuration(minutesBetween(timeEntryToDelete.start, timeEntryToDelete.end))],
            onConfirm: () => {
              deleteTimeEntry(timeEntryToDelete.id)
              setTimeEntryToDelete(null)
            },
          }}
          isBusy={false}
          onClose={() => setTimeEntryToDelete(null)}
          onConfirm={() => {
            deleteTimeEntry(timeEntryToDelete.id)
            setTimeEntryToDelete(null)
          }}
        />
      )}
    </aside>
  )
}

function AcceptanceModal({
  task,
  initialNote,
  files = [],
  onClose,
  onConfirm,
  onUploadFile,
}: {
  task: Task
  initialNote: string
  files?: FileAsset[]
  onClose: () => void
  onConfirm: (payload: AcceptancePayload) => void
  onUploadFile: (taskId: number, file: File, onProgress?: (ratio: number) => void) => Promise<FileAsset>
}) {
  const acceptanceDraftKey = `giverny:acceptance-draft:${task.id}:v1`
  const fallbackBasicDraft = {
    title: task.title,
    type: task.type,
    contact: task.contact,
    requester: task.requester ?? '',
    reviewer: task.reviewer ?? '',
    requirement: task.requirement ?? '',
    date: task.date,
    estimatedDate: task.estimatedDate || '',
  }
  const fallbackTimeEntries = task.timeEntries && task.timeEntries.length > 0 ? task.timeEntries : [{ id: crypto.randomUUID(), start: '09:00', end: '10:00' }]
  const [initialAcceptanceDraft] = useState(() =>
    readDraftCache(acceptanceDraftKey, {
      acceptanceNote: initialNote,
      basicDraft: fallbackBasicDraft,
      timeEntries: fallbackTimeEntries,
      progressDraft: task.progress,
      uploadedFiles: [] as FileAsset[],
    }),
  )
  const [acceptanceNote, setAcceptanceNote] = useState(initialAcceptanceDraft.acceptanceNote)
  const [basicEditing, setBasicEditing] = useState(false)
  const [basicDraft, setBasicDraft] = useState(initialAcceptanceDraft.basicDraft)
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(initialAcceptanceDraft.timeEntries)
  const [uploadedFiles, setUploadedFiles] = useState<FileAsset[]>(initialAcceptanceDraft.uploadedFiles)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [progressEditing, setProgressEditing] = useState(false)
  const [progressDraft, setProgressDraft] = useState(initialAcceptanceDraft.progressDraft)
  const [timeEntryToDelete, setTimeEntryToDelete] = useState<TimeEntry | null>(null)
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const [acceptanceAiSuggestion, setAcceptanceAiSuggestion] = useState<TextAssistantSuggestion | null>(null)
  const [acceptanceAiError, setAcceptanceAiError] = useState('')
  const [isAcceptanceAiLoading, setIsAcceptanceAiLoading] = useState(false)
  const isSupplemental = isSupplementalTask(task)
  const initialBasicSignature = useMemo(
    () => JSON.stringify({
      title: task.title,
      type: task.type,
      contact: task.contact,
      requester: task.requester ?? '',
      reviewer: task.reviewer ?? '',
      requirement: task.requirement ?? '',
      date: task.date,
      estimatedDate: task.estimatedDate || '',
    }),
    [task.contact, task.date, task.estimatedDate, task.requirement, task.requester, task.reviewer, task.title, task.type],
  )
  const basicChanged = JSON.stringify(basicDraft) !== initialBasicSignature

  useEffect(() => {
    writeDraftCache(acceptanceDraftKey, {
      acceptanceNote,
      basicDraft,
      timeEntries,
      progressDraft,
      uploadedFiles,
    })
  }, [acceptanceDraftKey, acceptanceNote, basicDraft, progressDraft, timeEntries, uploadedFiles])

  const updateEntry = (entryId: string, field: 'start' | 'end' | 'note', value: string) => {
    setTimeEntries((current) => current.map((entry) => (entry.id === entryId ? { ...entry, [field]: value } : entry)))
  }

  const updateBasicDraft = (field: keyof typeof basicDraft, value: string) => {
    setBasicDraft((current) => ({ ...current, [field]: value }))
  }

  const deleteTimeEntry = (entryId: string) => {
    setTimeEntries((current) => current.filter((item) => item.id !== entryId))
    setTimeEntryToDelete(null)
  }

  const computedMinutes = sumTimeEntries(timeEntries)
  const computedHours = Math.round((computedMinutes / 60) * 100) / 100
  const canConfirmAcceptance = computedMinutes > 0 && !isUploading
  const dueState = taskDueState(task, isoDate(), isoDate(3))
  const trimmedTaskChanges =
    basicChanged || progressDraft !== task.progress
      ? {
        title: basicDraft.title.trim() || task.title,
        type: basicDraft.type.trim() || task.type,
        contact: basicDraft.contact.trim() || task.contact,
        requester: basicDraft.requester.trim() || task.requester,
        reviewer: basicDraft.reviewer.trim() || task.reviewer,
        requirement: basicDraft.requirement.trim(),
        date: basicDraft.date.trim() || task.date,
        estimatedDate: basicDraft.estimatedDate.trim(),
        progress: progressDraft,
      }
      : undefined

  const uploadAcceptanceFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? [])
    if (files.length === 0 || isUploading) {
      return
    }
    setUploadError('')
    const oversized = files.find((file) => file.size > UPLOAD_HARD_LIMIT)
    if (oversized) {
      setUploadError(`「${oversized.name}」超过 ${(UPLOAD_HARD_LIMIT / 1024 / 1024).toFixed(0)}MB，无法上传`)
      return
    }
    setIsUploading(true)
    setUploadProgress(0)
    const failedFiles: string[] = []
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        try {
          const saved = await onUploadFile(task.id, file, (ratio) => {
            const overall = (index + ratio) / files.length
            setUploadProgress(Math.round(overall * 100))
          })
          setUploadedFiles((current) => [saved, ...current])
        } catch (error) {
          failedFiles.push(`${file.name}：${error instanceof Error ? error.message : '上传失败'}`)
          setUploadProgress(Math.round(((index + 1) / files.length) * 100))
        }
      }
      if (failedFiles.length > 0) {
        setUploadError(`以下文件未上传成功：${failedFiles.join('；')}`)
      }
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const requestClose = () => {
    if (isUploading) {
      setCloseConfirmOpen(true)
      return
    }
    onClose()
  }

  const requestAcceptanceAiSuggestion = async () => {
    setAcceptanceAiError('')
    setAcceptanceAiSuggestion(null)
    setIsAcceptanceAiLoading(true)
    try {
      const suggestion = await api.optimizeTaskTextAssistant({
        mode: 'acceptance',
        text: acceptanceNote,
        task,
        files: taskAssistantFiles(task, files, uploadedFiles),
        activity: [],
        uploadedFileNames: uploadedFiles.map((file) => file.name),
      })
      setAcceptanceAiSuggestion(suggestion)
    } catch (error) {
      setAcceptanceAiError(error instanceof Error ? error.message : 'AI 助手暂时不可用')
    } finally {
      setIsAcceptanceAiLoading(false)
    }
  }

  return (
    <ModalShell
      className="acceptance-modal"
      labelledBy="acceptance-title"
      onClose={requestClose}
    >
      <header className="modal-header acceptance-final-header">
        <div>
          <p className="eyebrow">任务验收 · 终审</p>
          <h2 id="acceptance-title">确认验收「{task.title}」</h2>
          <span>请逐项核对全部信息，确认无误后锁定工时进入结算</span>
        </div>
        <button className="icon-button modal-close-button" aria-label="关闭" title="关闭" onClick={requestClose}>
          <X size={18} />
        </button>
      </header>

      <div className="acceptance-modal-body">
        <section className="acceptance-final-section">
          <div className="acceptance-section-title">
            <span className="acceptance-section-index">1</span>
            <h3>基础信息</h3>
            <button type="button" className="acceptance-edit-button" onClick={() => setBasicEditing((current) => !current)}>
              <Pencil size={13} />
              {basicEditing ? '收起' : '修改'}
            </button>
          </div>
          <div className="acceptance-basic-grid">
            <div className="wide acceptance-basic-task-title">
              <span>任务名称</span>
              {basicEditing ? (
                <input value={basicDraft.title} onChange={(event) => updateBasicDraft('title', event.target.value)} />
              ) : (
                <strong>{basicDraft.title}</strong>
              )}
            </div>
            <div>
              <span>设计类型</span>
              {basicEditing ? (
                <input value={basicDraft.type} onChange={(event) => updateBasicDraft('type', event.target.value)} />
              ) : (
                <strong>{basicDraft.type || '未分类'}</strong>
              )}
            </div>
            <div>
              <span>对接人</span>
              {basicEditing ? (
                <input value={basicDraft.contact} onChange={(event) => updateBasicDraft('contact', event.target.value)} />
              ) : (
                <strong>{basicDraft.contact || '待确认'}</strong>
              )}
            </div>
            <div>
              <span>需求人</span>
              {basicEditing ? (
                <input value={basicDraft.requester} onChange={(event) => updateBasicDraft('requester', event.target.value)} />
              ) : (
                <strong>{basicDraft.requester || '待确认'}</strong>
              )}
            </div>
            <div>
              <span>验收人</span>
              {basicEditing ? (
                <input value={basicDraft.reviewer} onChange={(event) => updateBasicDraft('reviewer', event.target.value)} />
              ) : (
                <strong>{basicDraft.reviewer || '待确认'}</strong>
              )}
            </div>
            <div>
              <span>预计开始</span>
              {basicEditing ? (
                <input value={basicDraft.date} onChange={(event) => updateBasicDraft('date', event.target.value)} />
              ) : (
                <strong>{formatPlanDateTime(basicDraft.date)}</strong>
              )}
            </div>
            <div>
              <span>预计交付</span>
              {basicEditing ? (
                <input value={basicDraft.estimatedDate} onChange={(event) => updateBasicDraft('estimatedDate', event.target.value)} />
              ) : (
                <strong className="acceptance-due-value">
                  {formatPlanDateTime(basicDraft.estimatedDate || basicDraft.date)}
                  {dueState ? <span className={`due-tag ${dueState}`}>{dueState === 'overdue' ? '已逾期' : '临期'}</span> : null}
                </strong>
              )}
            </div>
            {isSupplemental && (
              <div>
                <span>补录结算</span>
                <strong>{monthLabelOf(taskSettlementMonth(task))}</strong>
              </div>
            )}
            <div className="wide acceptance-basic-requirement">
              <span>任务需求</span>
              {basicEditing ? (
                <textarea value={basicDraft.requirement} onChange={(event) => updateBasicDraft('requirement', event.target.value)} />
              ) : (
                <strong>{basicDraft.requirement || '未填写任务需求'}</strong>
              )}
            </div>
          </div>
        </section>

        <section className="acceptance-final-section">
          <div className="acceptance-section-title">
            <span className="acceptance-section-index">2</span>
            <h3>进度</h3>
            <button type="button" className="acceptance-edit-button" onClick={() => setProgressEditing((current) => !current)}>
              <Pencil size={13} />
              {progressEditing ? '收起' : '修改'}
            </button>
          </div>
          <div className="acceptance-final-progress">
            <div className="acceptance-progress-track" aria-label={`当前进度 ${progressDraft}%`}>
              <span style={{ width: `${progressDraft}%` }} />
            </div>
            <strong>{progressDraft}%</strong>
          </div>
          {progressEditing && (
            <div className="acceptance-progress-editor">
              <div className="progress-slider-row">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={progressDraft}
                  style={{ '--progress-value': `${progressDraft}%` } as CSSProperties}
                  onChange={(event) => setProgressDraft(snapProgress(Number(event.target.value)))}
                  aria-label="调整验收前进度"
                />
                <strong>{progressDraft}%</strong>
              </div>
              <div className="progress-quick-options" role="group" aria-label="进度档位快选">
                {[0, 20, 40, 60, 80, 100].map((value) => (
                  <button
                    type="button"
                    className={progressDraft === value ? 'active' : ''}
                    key={value}
                    aria-pressed={progressDraft === value}
                    onClick={() => setProgressDraft(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="acceptance-muted-hint">验收通过后，进度将自动设为 100%</p>
        </section>

        <section className="acceptance-final-section">
          <div className="acceptance-section-title">
            <span className="acceptance-section-index">3</span>
            <h3>分段计时</h3>
            <button type="button" className="acceptance-edit-button" onClick={() => document.querySelector<HTMLInputElement>('.acceptance-time-row input')?.focus()}>
              <Pencil size={13} />
              修改
            </button>
          </div>
          <div className="acceptance-time-list">
            {timeEntries.map((entry) => (
              <div className="acceptance-time-row" key={entry.id}>
                <div className="acceptance-time-range">
                  <TimeTextInput value={entry.start} ariaLabel="开始时间" onChange={(value) => updateEntry(entry.id, 'start', value)} />
                  <span>至</span>
                  <TimeTextInput value={entry.end} ariaLabel="结束时间" onChange={(value) => updateEntry(entry.id, 'end', value)} />
                </div>
                <input value={entry.note ?? ''} aria-label="分段说明" placeholder="例如：初稿 / 终稿 / 修改" onChange={(event) => updateEntry(entry.id, 'note', event.target.value)} />
                <strong>{formatDuration(minutesBetween(entry.start, entry.end))}</strong>
                <button className="icon-button danger-icon" aria-label="删除验收时间段" title="删除时间段" onClick={() => setTimeEntryToDelete(entry)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button className="ghost-button compact-button" onClick={() => setTimeEntries((current) => [...current, { id: crypto.randomUUID(), start: '14:00', end: '15:00', note: '新记录' }])}>
            <Plus size={15} />
            添加一段时间
          </button>
          <div className="acceptance-hours-total">
            <span>实际工时合计</span>
            <strong>{computedHours.toFixed(2)} h</strong>
          </div>
        </section>

        <section className="acceptance-final-section">
          <div className="acceptance-section-title">
            <span className="acceptance-section-index">4</span>
            <h3>验收附件</h3>
            <span className="file-tag-chip">验收文件</span>
          </div>
          <label className="acceptance-upload-box">
            <UploadCloud size={18} />
            <strong>{isUploading ? `上传中 ${uploadProgress}%` : '上传验收附件'}</strong>
            <em>支持 PNG / PDF / PSD / ZIP · 进入文件库并自动打标签</em>
            <input type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.psd,.ai,.eps,.fig,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z" multiple disabled={isUploading} onChange={(event) => void uploadAcceptanceFiles(event.target.files)} />
          </label>
          {uploadError && <p className="upload-inline-error">{uploadError}</p>}
          {uploadedFiles.length > 0 && (
            <div className="acceptance-file-list">
              {uploadedFiles.map((file) => (
                <span key={file.id}>
                  <Paperclip size={14} />
                  {file.name}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="acceptance-final-section">
          <div className="acceptance-section-title">
            <span className="acceptance-section-index">5</span>
            <h3>验收备注</h3>
            <div className="action-section-title-actions">
              <small>可选</small>
              <button
                type="button"
                className="icon-button ai-assist-button"
                aria-label="AI 优化验收备注"
                title="AI 优化验收备注"
                onClick={() => void requestAcceptanceAiSuggestion()}
                disabled={isAcceptanceAiLoading || (!acceptanceNote.trim() && uploadedFiles.length === 0 && taskAssistantFiles(task, files).length === 0)}
              >
                <Sparkles size={16} />
              </button>
            </div>
          </div>
          <label className="acceptance-note-field">
            <textarea
              value={acceptanceNote}
              onChange={(event) => setAcceptanceNote(event.target.value)}
              placeholder={isSupplemental ? '例如：该任务已于 5 月完成，本次补录到 6 月结算；验收文件已补充上传。' : '例如：完成 3 项主视觉修改，输出 PNG / PDF / 源文件，附件已上传。'}
            />
          </label>
          {(acceptanceAiSuggestion || acceptanceAiError || isAcceptanceAiLoading) && (
            <div className="ai-suggestion-panel task-text-ai-panel">
              <div className="ai-suggestion-head">
                <span>{isAcceptanceAiLoading ? 'AI 正在整理验收备注' : 'AI 建议'}</span>
              </div>
              {isAcceptanceAiLoading && <p>正在结合任务需求、已上传文件和当前备注优化文案...</p>}
              {acceptanceAiError && <p className="ai-suggestion-error">{acceptanceAiError}</p>}
              {acceptanceAiSuggestion && (
                <>
                  <div className="ai-suggestion-body">
                    {renderTextAssistantBody(acceptanceAiSuggestion.optimizedText)}
                  </div>
                  {acceptanceAiSuggestion.summary && <small>{acceptanceAiSuggestion.summary}</small>}
                  <div className="ai-suggestion-actions">
                    <button type="button" className="ghost-button compact-button" onClick={() => setAcceptanceNote(acceptanceAiSuggestion.optimizedText)}>
                      采用建议
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      <footer className="modal-footer acceptance-final-footer">
        <p>
          <AlertTriangle size={15} />
          <span>
            <b>确认验收后：</b>状态变为「已验收」、工时 <b>{computedHours.toFixed(2)} h</b> 锁定并计入结算，进度设为 <b>100%</b>，<em>本次项目结束。</em>
          </span>
        </p>
        <button className="ghost-button" onClick={requestClose}>
          取消
        </button>
        <button
          className="primary-button"
          disabled={!canConfirmAcceptance}
          onClick={() => {
            clearDraftCache(acceptanceDraftKey)
            onConfirm({ actualHours: computedHours, acceptanceNote: acceptanceNote.trim(), timeEntries, acceptanceFiles: uploadedFiles.map((file) => file.name), taskChanges: trimmedTaskChanges })
          }}
        >
          {isUploading ? '上传中…' : '确认验收'}
        </button>
      </footer>
      {closeConfirmOpen && (
        <ConfirmDialogModal
          dialog={{
            eyebrow: '未完成验收',
            title: isUploading ? '附件还在上传，确定关闭吗？' : '关闭后将放弃本次验收填写',
            body: isUploading
              ? '当前验收附件仍在上传中，关闭弹窗可能让你失去本次验收上下文。建议等上传完成后再确认验收。'
              : '你已经修改了验收备注、时间段或上传了验收文件，但还没有点击确认验收。关闭后这些验收填写不会写入任务。',
            confirmText: '放弃并关闭',
            cancelText: '继续填写',
            tone: 'danger',
            details: [`系统计算工时：${computedHours.toFixed(2)} h`, uploadedFiles.length > 0 ? `已上传 ${uploadedFiles.length} 个验收附件` : '尚未确认验收'],
            onConfirm: onClose,
          }}
          isBusy={false}
          onClose={() => setCloseConfirmOpen(false)}
          onConfirm={onClose}
        />
      )}
      {timeEntryToDelete && (
        <ConfirmDialogModal
          dialog={{
            eyebrow: '删除验收时间段',
            title: `确定删除 ${timeEntryToDelete.start} - ${timeEntryToDelete.end} 吗？`,
            body: '删除后会立即影响本次验收弹窗中系统计算的实际工时。请确认这段时间确实不需要纳入验收。',
            confirmText: '确认删除',
            tone: 'danger',
            details: [formatDuration(minutesBetween(timeEntryToDelete.start, timeEntryToDelete.end))],
            onConfirm: () => deleteTimeEntry(timeEntryToDelete.id),
          }}
          isBusy={false}
          onClose={() => setTimeEntryToDelete(null)}
          onConfirm={() => deleteTimeEntry(timeEntryToDelete.id)}
        />
      )}
    </ModalShell>
  )
}

function TaskDetailModal({
  task,
  role,
  activity,
  files,
  onClose,
  onPreviewFile,
  onOpenAcceptance,
  onOpenEdit,
  onOpenProgress,
}: {
  task: Task
  role: AuthRole
  activity: ActivityItem[]
  files: FileAsset[]
  onClose: () => void
  onPreviewFile: (file: FileAsset) => void
  onOpenAcceptance: (taskId: number) => void
  onOpenEdit: (taskId: number) => void
  onOpenProgress: (taskId: number) => void
}) {
  const dueState = taskDueState(task, isoDate(), isoDate(3))
  const actualMinutes = sumTimeEntries(task.timeEntries ?? [])
  const actualHoursText = actualMinutes > 0 ? `${(actualMinutes / 60).toFixed(2)} h（共 ${(task.timeEntries ?? []).length} 段）` : `${task.actualHours.toFixed(2)} h`
  const recentActivity = activity.slice(0, 4)

  return (
    <ModalShell className="task-detail-modal" labelledBy="task-detail-title" onClose={onClose}>
      <header className="modal-header">
        <div>
          <p className="eyebrow">{task.type} · {task.contact || '待确认'}</p>
          <h2 id="task-detail-title">{task.title}</h2>
        </div>
        <div className="modal-header-actions">
          {task.status === '待验收' ? (
            <button
              type="button"
              className="status-badge status-待验收 detail-acceptance-status-button"
              aria-label="去验收"
              title="去验收"
              onClick={() => onOpenAcceptance(task.id)}
            >
              <span className="status-label-default">待验收</span>
              <span className="status-label-hover">去验收</span>
            </button>
          ) : (
            <StatusBadge status={task.status} />
          )}
          <button className="icon-button modal-close-button" aria-label="关闭" title="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="task-detail-body task-detail-summary-body">
        <section className="task-detail-summary">
          <dl>
            <div className="wide">
              <dt>任务名称</dt>
              <dd>{task.title}</dd>
            </div>
            <div>
              <dt>设计类型</dt>
              <dd>{task.type || '未填写'}</dd>
            </div>
            <div>
              <dt>对接人</dt>
              <dd>{task.contact || '待确认'}</dd>
            </div>
            <div>
              <dt>需求人</dt>
              <dd>{task.requester || '未填写'}</dd>
            </div>
            <div>
              <dt>验收人</dt>
              <dd>{task.reviewer || '未填写'}</dd>
            </div>
            <div className="wide">
              <dt>任务需求</dt>
              <dd>{task.requirement || '未填写'}</dd>
            </div>
            <div>
              <dt>预计开始</dt>
              <dd>{task.date ? formatPlanDateTime(task.date) : '未设置'}</dd>
            </div>
            <div>
              <dt>预计交付</dt>
              <dd>
                {task.estimatedDate ? formatPlanDateTime(task.estimatedDate) : '未设置'}
                {dueState ? <span className={`due-tag ${dueState}`}>{dueState === 'overdue' ? '已逾期' : '临期'}</span> : null}
              </dd>
            </div>
            <div>
              <dt>任务状态</dt>
              <dd><StatusDotLabel status={task.status} /></dd>
            </div>
            <div>
              <dt>当前进度</dt>
              <dd>{task.progress}%</dd>
            </div>
            <div>
              <dt>实际工时</dt>
              <dd>{actualHoursText}</dd>
            </div>
            <div>
              <dt>结算月份</dt>
              <dd>
                {monthLabelOf(taskSettlementMonth(task))}
                {isSupplementalTask(task) ? <span className="supplement-inline">补录</span> : null}
              </dd>
            </div>
          </dl>
          <div className="task-detail-progress">
            <div className="large-meter">
              <span style={{ width: `${task.progress}%` }} />
            </div>
            <strong>{task.progress}%</strong>
          </div>
        </section>

        <section className="task-detail-log">
          <div className="section-heading">
            <h3>最近进展</h3>
            <Clock3 size={15} />
          </div>
          {recentActivity.length === 0 && <p className="calendar-empty-hint">暂无操作记录。</p>}
          {recentActivity.length > 0 && (
            <div className="timeline activity-timeline">
              {recentActivity.map((item) => (
                <article className="timeline-item" key={item.id}>
                  <span className="dot" />
                  <TimelineStamp value={item.createdAt} audience={role === 'admin' ? 'admin' : 'public'} />
                  <p>{describeActivity(item)}</p>
                  <ActivityFileChips item={item} files={files} onPreviewFile={onPreviewFile} />
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="modal-footer">
        <button className="ghost-button" onClick={() => onOpenProgress(task.id)}>
          <BarChart3 size={15} />
          进展
        </button>
        <button className="primary-button" onClick={() => onOpenEdit(task.id)}>
          <Pencil size={15} />
          去编辑
        </button>
      </footer>
    </ModalShell>
  )
}

function TaskEditModal({
  task,
  onClose,
  onSave,
}: {
  task: Task
  onClose: () => void
  onSave: (changes: Partial<Task>) => void
}) {
  const initialDraft = useMemo(() => ({
    title: task.title,
    type: task.type,
    contact: task.contact,
    requester: task.requester ?? '',
    reviewer: task.reviewer,
    requirement: task.requirement,
    status: task.status,
    date: task.date,
    estimatedDate: task.estimatedDate,
    estimatedHours: task.estimatedHours,
    settlementMonth: taskSettlementMonth(task),
  }), [task])
  const [draft, setDraft] = useState(initialDraft)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [scheduleAnchor, setScheduleAnchor] = useState<ScheduleAnchor>('start')
  const taskEstimatedMinutes = Math.round((Number(draft.estimatedHours) || 0) * 60)
  const hasUnsavedChanges = JSON.stringify(draft) !== JSON.stringify(initialDraft)

  const setField = <Key extends keyof typeof draft>(field: Key, value: (typeof draft)[Key]) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const updatePlannedStartTime = (value: string) => {
    setDraft((current) => ({ ...current, date: value, estimatedDate: addMinutesToPlanDateTime(value, taskEstimatedMinutes) }))
  }

  const updatePlannedEndTime = (value: string) => {
    setDraft((current) => ({ ...current, date: addMinutesToPlanDateTime(value, -taskEstimatedMinutes), estimatedDate: value }))
  }

  const updateEstimatedHours = (valueMinutes: number) => {
    const estimatedHours = Math.round((valueMinutes / 60) * 100) / 100
    setDraft((current) => {
      if (scheduleAnchor === 'end') {
        return { ...current, estimatedHours, date: addMinutesToPlanDateTime(current.estimatedDate || current.date, -valueMinutes) }
      }
      return { ...current, estimatedHours, estimatedDate: addMinutesToPlanDateTime(current.date, valueMinutes) }
    })
  }

  const save = () => {
    onSave({
      title: draft.title.trim() || task.title,
      type: draft.type.trim() || task.type,
      contact: draft.contact.trim() || '待确认',
      requester: draft.requester.trim(),
      reviewer: draft.reviewer.trim() || draft.requester.trim() || '待确认',
      requirement: draft.requirement.trim(),
      status: draft.status,
      date: draft.date,
      estimatedDate: draft.estimatedDate,
      estimatedHours: draft.estimatedHours,
      settlementMonth: draft.settlementMonth,
    })
  }

  const requestClose = () => {
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true)
      return
    }
    onClose()
  }

  return (
    <ModalShell className="task-detail-modal task-edit-modal" labelledBy="task-edit-title" onClose={requestClose}>
      <header className="modal-header">
        <div>
          <p className="eyebrow">任务信息</p>
          <h2 id="task-edit-title">编辑任务</h2>
        </div>
        <button className="icon-button modal-close-button" aria-label="关闭" title="关闭" onClick={requestClose}>
          <X size={18} />
        </button>
      </header>

      <div className="task-detail-body">
        <section className="task-detail-section plain-section">
          <div className="form-grid task-detail-fields">
            <label className="field wide">
              <span>任务名称</span>
              <input value={draft.title} onChange={(event) => setField('title', event.target.value)} />
            </label>
            <label className="field">
              <span>设计类型</span>
              <input value={draft.type} onChange={(event) => setField('type', event.target.value)} />
            </label>
            <label className="field">
              <span>对接人</span>
              <input value={draft.contact} onChange={(event) => setField('contact', event.target.value)} />
            </label>
            <label className="field">
              <span>需求人</span>
              <input value={draft.requester} onChange={(event) => setField('requester', event.target.value)} />
            </label>
            <label className="field">
              <span>验收人</span>
              <input value={draft.reviewer} onChange={(event) => setField('reviewer', event.target.value)} />
            </label>
            <label className="field">
              <span>任务状态</span>
              <select value={draft.status} onChange={(event) => setField('status', event.target.value as TaskStatus)}>
                <option>计划中</option>
                <option>进行中</option>
                <option>挂起</option>
                <option>待验收</option>
                <option>已验收</option>
                <option>终止</option>
                <option>不计费</option>
              </select>
            </label>
            <label className="field wide">
              <span>任务需求</span>
              <textarea className="task-detail-requirement" value={draft.requirement} onChange={(event) => setField('requirement', event.target.value)} />
            </label>
          </div>
        </section>

        <section className="task-detail-section plain-section">
          <div className="form-grid task-detail-fields">
            <PlanDateTimeField
              label="预计开始时间"
              value={draft.date}
              onChange={updatePlannedStartTime}
              isActive={scheduleAnchor === 'start'}
              readOnly={scheduleAnchor !== 'start'}
              control={<ScheduleAnchorSwitch active={scheduleAnchor === 'start'} label="用预计开始时间推算交付时间" onClick={() => setScheduleAnchor('start')} />}
            />
            <PlanDateTimeField
              label="预计交付时间"
              value={draft.estimatedDate}
              onChange={updatePlannedEndTime}
              isActive={scheduleAnchor === 'end'}
              readOnly={scheduleAnchor !== 'end'}
              control={<ScheduleAnchorSwitch active={scheduleAnchor === 'end'} label="用预计交付时间倒推开始时间" onClick={() => setScheduleAnchor('end')} />}
            />
            <label className="field">
              <span>预估工时</span>
              <DurationPicker valueMinutes={taskEstimatedMinutes} onChange={updateEstimatedHours} />
            </label>
            <SettlementMonthField label="结算月份" value={draft.settlementMonth} onChange={(value) => setField('settlementMonth', value)} />
            <label className="field">
              <span>实际工时（系统计算）</span>
              <input value={`${task.actualHours.toFixed(2)} h`} readOnly />
            </label>
            <div className="field">
              <span>当前进度</span>
              <div className="progress-block inline-progress readonly-progress">
                <div className="large-meter">
                  <span style={{ width: `${task.progress}%` }} />
                </div>
                <strong>{task.progress}%</strong>
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="modal-footer">
        {showDiscardConfirm && (
          <div className="discard-inline" role="alert">
            <span>有未保存的修改，确定放弃吗？</span>
            <button type="button" className="ghost-button compact-button" onClick={() => setShowDiscardConfirm(false)}>继续编辑</button>
            <button type="button" className="danger-button compact-button" onClick={onClose}>放弃修改</button>
          </div>
        )}
        <button className="ghost-button" onClick={requestClose}>取消</button>
        <button className="primary-button" onClick={save}>保存</button>
      </footer>
    </ModalShell>
  )
}

function CalendarView({
  monthValue,
  tasks,
  onOpenTask,
  onMonthChange,
}: {
  monthValue: string
  tasks: Task[]
  onOpenTask: (taskId: number) => void
  onMonthChange: (value: string) => void
}) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = isoDate()
    return today.startsWith(monthValue) ? today : `${monthValue}-01`
  })

  const [year, month] = monthValue.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const leadingBlanks = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const today = isoDate()

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    tasks.forEach((task) => {
      const key = datePart(task.date)
      map.set(key, [...(map.get(key) ?? []), task])
    })
    return map
  }, [tasks])

  const dayTasks = tasksByDate.get(selectedDate) ?? []
  const doneTasks = dayTasks.filter((task) => task.status === '已验收' || task.status === '不计费')
  const ongoingTasks = dayTasks.filter((task) => task.status === '进行中' || task.status === '待验收')
  const plannedTasks = dayTasks.filter((task) => task.status === '计划中')
  const upcomingTasks = tasks
    .filter((task) => datePart(task.date) > selectedDate && (task.status === '计划中' || task.status === '进行中'))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6)

  const renderTaskRows = (list: Task[]) =>
    list.map((task) => (
      <button className="calendar-task-row" key={task.id} onClick={() => onOpenTask(task.id)}>
        <i style={{ background: statusDotColors[task.status] }} />
        <div>
          <strong>{task.title}</strong>
          <small>
            {task.type} · {task.actualHours > 0 ? `${task.actualHours.toFixed(1)}h` : `预估 ${task.estimatedHours.toFixed(1)}h`}
          </small>
        </div>
        <StatusBadge status={task.status} />
      </button>
    ))

  return (
    <section className="calendar-layout">
      <section className="panel calendar-panel">
        <div className="calendar-month-toolbar">
          <button type="button" className="icon-button" aria-label="上个月" title="上个月" onClick={() => onMonthChange(shiftMonthValue(monthValue, -1))}>
            <ChevronLeft size={17} />
          </button>
          <strong>{monthLabelOf(monthValue)}</strong>
          <button type="button" className="icon-button" aria-label="下个月" title="下个月" onClick={() => onMonthChange(shiftMonthValue(monthValue, 1))}>
            <ChevronRight size={17} />
          </button>
        </div>
        <div className="calendar-weekdays">
          {weekdayLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {Array.from({ length: leadingBlanks }).map((_, index) => (
            <div className="calendar-cell blank" key={`blank-${index}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1
            const dateValue = `${monthValue}-${pad(day)}`
            const cellTasks = tasksByDate.get(dateValue) ?? []
            const cellClass = [
              'calendar-cell',
              selectedDate === dateValue ? 'selected' : '',
              today === dateValue ? 'today' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <button className={cellClass} key={dateValue} onClick={() => setSelectedDate(dateValue)}>
                <span className="calendar-day-number">{day}</span>
                <span className="calendar-dots">
                  {cellTasks.slice(0, 4).map((task) => (
                    <i key={task.id} style={{ background: statusDotColors[task.status] }} />
                  ))}
                </span>
                {cellTasks.slice(0, 2).map((task) => (
                  <span className="calendar-chip" key={task.id} style={{ '--chip-color': statusDotColors[task.status] } as CSSProperties}>
                    {task.title}
                  </span>
                ))}
                {cellTasks.length > 2 && <span className="calendar-more">+{cellTasks.length - 2} 项</span>}
              </button>
            )
          })}
        </div>
        <div className="calendar-legend">
          {(Object.keys(statusDotColors) as TaskStatus[]).map((status) => (
            <span key={status}>
              <i style={{ background: statusDotColors[status] }} />
              {status}
            </span>
          ))}
        </div>
      </section>

      <aside className="panel calendar-day-panel">
        <div className="panel-header compact">
          <div>
            <h2>
              {month} 月 {Number(selectedDate.slice(8, 10))} 日{today === selectedDate ? ' · 今天' : ''}
            </h2>
            <p>{dayTasks.length > 0 ? `共 ${dayTasks.length} 个任务` : '当天没有安排任务'}</p>
          </div>
        </div>

        {ongoingTasks.length > 0 && (
          <div className="calendar-day-group">
            <h3>进行中 / 待验收</h3>
            {renderTaskRows(ongoingTasks)}
          </div>
        )}
        {plannedTasks.length > 0 && (
          <div className="calendar-day-group">
            <h3>计划中</h3>
            {renderTaskRows(plannedTasks)}
          </div>
        )}
        {doneTasks.length > 0 && (
          <div className="calendar-day-group">
            <h3>已完成</h3>
            {renderTaskRows(doneTasks)}
          </div>
        )}

        <div className="calendar-day-group upcoming">
          <h3>接下来待完成</h3>
          {upcomingTasks.length === 0 && <p className="calendar-empty-hint">本月之后暂无待办任务。</p>}
          {upcomingTasks.map((task) => (
            <button className="calendar-task-row" key={task.id} onClick={() => onOpenTask(task.id)}>
              <i style={{ background: statusDotColors[task.status] }} />
              <div>
                <strong>{task.title}</strong>
                <small>
                  {formatMonthDayTime(task.date)} · {task.type}
                </small>
              </div>
              <StatusBadge status={task.status} />
            </button>
          ))}
        </div>
      </aside>
    </section>
  )
}

function FilesView({
  files,
  tasks,
  currentMonthValue,
  onPreviewFile,
  onDeleteFile,
  onDownloadFile,
  onUpdateFile,
}: {
  files: FileAsset[]
  tasks: Task[]
  currentMonthValue: string
  onPreviewFile: (file: FileAsset) => void
  onDeleteFile: (fileId: number) => void
  onDownloadFile: (file: FileAsset) => void
  onUpdateFile: (fileId: number, changes: { name?: string; tag?: string }) => Promise<FileAsset>
}) {
  const [monthFilter, setMonthFilter] = useState(currentMonthValue)
  const [fileQuery, setFileQuery] = useState('')
  const [fileContextMenu, setFileContextMenu] = useState<{ x: number; y: number; file: FileAsset } | null>(null)
  const [focusFileField, setFocusFileField] = useState<'name' | 'tag' | null>(null)
  const monthOptions = useMemo(
    () =>
      [...new Set([
        currentMonthValue,
        ...files.map((file) => file.uploadedAt.slice(0, 7)).filter((value) => /^\d{4}-\d{2}$/.test(value)),
        ...tasks.map(taskSettlementMonth).filter((value) => /^\d{4}-\d{2}$/.test(value)),
      ])].sort((a, b) => b.localeCompare(a)),
    [currentMonthValue, files, tasks],
  )
  const filteredFiles = useMemo(() => {
    const query = fileQuery.trim().toLowerCase()
    return files.filter((file) => {
      const task = tasks.find((item) => item.id === file.taskId)
      const matchesMonth = monthFilter === 'all' || file.uploadedAt.startsWith(monthFilter) || (task ? taskSettlementMonth(task) === monthFilter : false)
      const matchesQuery =
        !query ||
        [file.name, file.task, file.type, file.tag ?? ''].some((value) => value.toLowerCase().includes(query))
      return matchesMonth && matchesQuery
    })
  }, [fileQuery, files, monthFilter, tasks])
  const groupedTasks = useMemo(() => {
    const taskMap = new Map(tasks.map((task) => [task.id, task]))
    const fileTaskIds = [...new Set(filteredFiles.map((file) => file.taskId))]
    return fileTaskIds
      .map((taskId) => taskMap.get(taskId) ?? {
        id: taskId,
        title: filteredFiles.find((file) => file.taskId === taskId)?.task ?? '未关联任务',
        type: '未分类',
        actualHours: 0,
        status: '计划中' as TaskStatus,
      })
      .filter((task) => filteredFiles.some((file) => file.taskId === task.id))
      .sort((a, b) => {
        const latestA = filteredFiles.filter((file) => file.taskId === a.id).map((file) => file.uploadedAt).sort().at(-1) ?? ''
        const latestB = filteredFiles.filter((file) => file.taskId === b.id).map((file) => file.uploadedAt).sort().at(-1) ?? ''
        return latestB.localeCompare(latestA)
      })
  }, [filteredFiles, tasks])
  const [selectedProjectId, setSelectedProjectId] = useState(() => groupedTasks[0]?.id ?? 0)
  const selectedProject = groupedTasks.find((task) => task.id === selectedProjectId) ?? groupedTasks[0]
  const selectedFiles = selectedProject
    ? filteredFiles.filter((file) => file.taskId === selectedProject.id).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    : []
  const [selectedFileId, setSelectedFileId] = useState(0)
  const selectedFile = selectedFiles.find((file) => file.id === selectedFileId)
  const openFileSource = (file: FileAsset) => {
    const sourceUrl = authedPreviewUrl(file.sourceUrl)
    if (sourceUrl) {
      window.open(sourceUrl, '_blank', 'noreferrer')
    }
  }
  const focusInspectorField = (file: FileAsset, field: 'name' | 'tag') => {
    setSelectedFileId(file.id)
    setFocusFileField(field)
  }
  const openFileContextMenu = (event: React.MouseEvent, file: FileAsset) => {
    event.preventDefault()
    setSelectedFileId(file.id)
    setFileContextMenu({ x: event.clientX, y: event.clientY, file })
  }

  useEffect(() => {
    if (!fileContextMenu) {
      return
    }
    const closeMenu = () => setFileContextMenu(null)
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }
    window.addEventListener('click', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [fileContextMenu])

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT' || target?.isContentEditable
      if (event.code === 'Space' && selectedFile && !isTyping) {
        event.preventDefault()
        onPreviewFile(selectedFile)
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [onPreviewFile, selectedFile])

  return (
    <section className="view-stack">
      <section className="panel view-toolbar">
        <div className="panel-header compact">
          <div>
            <h2>文件库</h2>
            <p>自动汇总任务生命周期中的过程文件、最终稿和验收文件</p>
          </div>
        </div>
      </section>

      <section className={`file-library-layout ${selectedFile ? 'inspector-open' : ''}`}>
        <aside className="panel file-project-list">
          <div className="panel-header compact">
            <div>
              <h2>项目 / 任务</h2>
              <p>{groupedTasks.length} 个条目 · 最近上传优先</p>
            </div>
          </div>
          <div className="file-library-filters">
            <label className="search-box file-search-box">
              <Search size={16} />
              <input value={fileQuery} onChange={(event) => setFileQuery(event.target.value)} placeholder="搜索项目或文件" />
            </label>
            <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
              <option value="all">全部月份</option>
              {monthOptions.map((month) => (
                <option value={month} key={month}>{monthLabelOf(month)}</option>
              ))}
            </select>
          </div>
          {groupedTasks.length === 0 && <p className="calendar-empty-hint">当前筛选下还没有文件。</p>}
          {groupedTasks.map((task) => {
            const taskFiles = filteredFiles.filter((file) => file.taskId === task.id)
            const latestUploadedAt = taskFiles.map((file) => file.uploadedAt).sort().at(-1)
            return (
              <button
                className={`file-project-row ${selectedProject?.id === task.id ? 'active' : ''}`}
                key={task.id}
                onClick={() => {
                  setSelectedProjectId(task.id)
                  setSelectedFileId(0)
                }}
              >
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.type}{latestUploadedAt ? ` · ${latestUploadedAt.slice(0, 10)}` : ''}</span>
                </div>
                <em>{taskFiles.length} 个文件</em>
              </button>
            )
          })}
        </aside>

        <section className="file-project-detail">
          <div className="panel-header compact">
            <div>
              <h2>{selectedProject?.title ?? '选择一个项目'}</h2>
              <p>{selectedProject ? `${selectedFiles.length} 个关联文件 · 点击文件查看信息，双击或空格预览` : '点击左侧条目查看文件'}</p>
            </div>
          </div>
          <div className="grouped-file-grid">
            {selectedFiles.map((file) => {
              const fileType = file.type.toUpperCase()
              const isImage = isInlineImageFileType(fileType)
              const isDocumentPreview = isInlineDocumentFileType(fileType)
              const isOfficePreview = isOfficeFileType(fileType)
              const hasVisualPreview = Boolean(file.previewUrl) || isImage || isDocumentPreview || isOfficePreview
              const thumbUrl = authedPreviewUrl(file.previewUrl ?? (isImage ? file.sourceUrl : undefined))
              const documentPreviewUrl = isDocumentPreview ? fileDocumentPreviewSource(file) : undefined
              return (
                <article
                  className={`file-thumb-card ${selectedFile?.id === file.id ? 'selected' : ''}`}
                  key={file.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedFileId(file.id)}
                  onDoubleClick={() => onPreviewFile(file)}
                  onContextMenu={(event) => openFileContextMenu(event, file)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onPreviewFile(file)
                    }
                  }}
                >
                  <div className={`file-thumb-preview ${hasVisualPreview ? 'visual-preview' : ''}`}>
                    <span className={`file-format-badge type-${fileType.toLowerCase()}`}>{fileType}</span>
                    {thumbUrl ? (
                      <img src={thumbUrl} alt={file.name} loading="lazy" />
                    ) : documentPreviewUrl ? (
                      <iframe className="file-thumb-frame" src={documentPreviewUrl} title={file.name} loading="lazy" />
                    ) : isOfficePreview ? (
                      <div className="file-thumb-document">
                        <FileText size={42} />
                        <strong>{fileType}</strong>
                        <span>可预览</span>
                      </div>
                    ) : (
                      <div className="file-thumb-placeholder">
                        {fileType === 'PDF' ? <FileText size={42} /> : <FileArchive size={42} />}
                        <strong>{fileType}</strong>
                      </div>
                    )}
                  </div>
                  <div className="file-thumb-info">
                    <h2>{file.name}</h2>
                    <p>{file.size} · {file.uploadedAt}</p>
                  </div>
                </article>
              )
            })}
            {selectedProject && selectedFiles.length === 0 && <p className="calendar-empty-hint">这个项目下还没有文件。</p>}
          </div>
        </section>
        {selectedFile && (
          <FileInspector
            key={selectedFile.id}
            file={selectedFile}
            onPreview={onPreviewFile}
            onDelete={onDeleteFile}
            onUpdateFile={onUpdateFile}
            focusField={focusFileField}
            onFocusHandled={() => setFocusFileField(null)}
          />
        )}
      </section>
      {fileContextMenu && (
        <FileContextMenu
          menu={fileContextMenu}
          onClose={() => setFileContextMenu(null)}
          onPreview={onPreviewFile}
          onOpen={openFileSource}
          onDownload={onDownloadFile}
          onFocusName={(file) => focusInspectorField(file, 'name')}
          onFocusTag={(file) => focusInspectorField(file, 'tag')}
          onDelete={onDeleteFile}
        />
      )}
    </section>
  )
}

function FileInspector({
  file,
  onPreview,
  onDelete,
  onUpdateFile,
  focusField,
  onFocusHandled,
}: {
  file: FileAsset | undefined
  onPreview: (file: FileAsset) => void
  onDelete: (fileId: number) => void
  onUpdateFile: (fileId: number, changes: { name?: string; tag?: string }) => Promise<FileAsset>
  focusField?: 'name' | 'tag' | null
  onFocusHandled?: () => void
}) {
  const nameInputRef = useRef<HTMLInputElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const [draftName, setDraftName] = useState(file?.name ?? '')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState(() => parseFileTags(file?.tag))
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    // File metadata is editable draft state; reset it when the selected file changes to avoid cross-file overwrites.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftName(file?.name ?? '')
    setTagInput('')
    setTags(parseFileTags(file?.tag))
  }, [file?.id, file?.name, file?.tag])

  useEffect(() => {
    if (!focusField || !file) {
      return
    }
    const input = focusField === 'name' ? nameInputRef.current : tagInputRef.current
    input?.focus()
    input?.select()
    onFocusHandled?.()
  }, [file, focusField, onFocusHandled])

  if (!file) {
    return (
      <aside className="panel file-inspector">
        <div className="file-inspector-empty">
          <FileImage size={28} />
          <strong>选择一个文件</strong>
          <span>右侧会显示预览、重命名、标签和基础信息。</span>
        </div>
      </aside>
    )
  }

  const fileType = file.type.toUpperCase()
  const isImage = isInlineImageFileType(fileType)
  const isDocumentPreview = isInlineDocumentFileType(fileType)
  const isOfficePreview = isOfficeFileType(fileType)
  const inspectorPreviewUrl = authedPreviewUrl(file.previewUrl ?? (isImage ? file.sourceUrl : undefined))
  const inspectorDocumentUrl = isDocumentPreview ? fileDocumentPreviewSource(file) : undefined
  const sourceUrl = authedPreviewUrl(file.sourceUrl)
  const saveMetadata = async (nextTags = tags) => {
    setIsSaving(true)
    try {
      const updatedFile = await onUpdateFile(file.id, { name: draftName, tag: serializeFileTags(nextTags) })
      setTags(parseFileTags(updatedFile.tag))
    } finally {
      setIsSaving(false)
    }
  }
  const addTag = async () => {
    const nextTag = tagInput.trim()
    if (!nextTag) {
      return
    }
    const nextTags = Array.from(new Set([...tags, nextTag]))
    setTags(nextTags)
    setTagInput('')
    await saveMetadata(nextTags)
  }
  const removeTag = async (tag: string) => {
    const nextTags = tags.filter((item) => item !== tag)
    setTags(nextTags)
    await saveMetadata(nextTags)
  }

  return (
    <aside className="panel file-inspector">
      <button className="file-inspector-preview" type="button" onClick={() => onPreview(file)}>
        <span className={`file-format-badge type-${fileType.toLowerCase()}`}>{fileType}</span>
        {inspectorPreviewUrl ? (
          <img src={inspectorPreviewUrl} alt={file.name} loading="lazy" />
        ) : inspectorDocumentUrl ? (
          <iframe className="file-inspector-frame" src={inspectorDocumentUrl} title={file.name} loading="lazy" />
        ) : isOfficePreview ? (
          <div className="file-thumb-document file-thumb-document-large">
            <FileText size={42} />
            <strong>{fileType}</strong>
            <span>双击或空格预览内容</span>
          </div>
        ) : (
          <div className="file-thumb-placeholder">
            {fileType === 'PDF' ? <FileText size={42} /> : <FileArchive size={42} />}
            <strong>{fileType}</strong>
          </div>
        )}
      </button>
      <div className="inspector-color-dots" aria-hidden="true">
        {['#f7f5ed', '#d8c3a5', '#9b6d52', '#c9c2ba', '#425f72', '#67c6c0', '#5aa3ce', '#526f48', '#8b7189', '#d8d158'].map((color) => (
          <span key={color} style={{ backgroundColor: color }} />
        ))}
      </div>
      <label className="inspector-field">
        <span>文件名</span>
        <input ref={nameInputRef} value={draftName} onChange={(event) => setDraftName(event.target.value)} onBlur={() => void saveMetadata()} />
      </label>
      <label className="inspector-field">
        <span>标签</span>
        <input
          ref={tagInputRef}
          value={tagInput}
          onChange={(event) => setTagInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void addTag()
            }
          }}
          placeholder={isSaving ? '保存中…' : '输入标签后按回车'}
        />
      </label>
      <label className="inspector-field">
        <span>链接</span>
        <input value={sourceUrl ?? ''} readOnly placeholder="源文件链接" />
      </label>
      <div className="inspector-tags">
        <strong>标签</strong>
        {tags.length === 0 && <em>暂无标签</em>}
        {tags.map((tag) => (
          <span key={tag}>
            {tag}
            <button type="button" aria-label={`移除标签 ${tag}`} onClick={() => void removeTag(tag)}>
              <Trash2 size={12} />
            </button>
          </span>
        ))}
      </div>
      <dl className="inspector-meta">
        <div>
          <dt>关联任务</dt>
          <dd>{file.task}</dd>
        </div>
        <div>
          <dt>尺寸 / 大小</dt>
          <dd>{file.size}</dd>
        </div>
        <div>
          <dt>格式</dt>
          <dd>{file.type}</dd>
        </div>
        <div>
          <dt>上传日期</dt>
          <dd>{file.uploadedAt}</dd>
        </div>
        <div>
          <dt>版本状态</dt>
          <dd>{file.final ? '最终稿' : '过程文件'}</dd>
        </div>
      </dl>
      <div className="inspector-actions">
        <button className="inspector-action-button" type="button" title="预览" aria-label="预览" onClick={() => onPreview(file)}>
          <Eye size={16} />
        </button>
        <button className="inspector-action-button" type="button" title="打开" aria-label="打开" onClick={() => sourceUrl && window.open(sourceUrl, '_blank', 'noreferrer')}>
          <ExternalLink size={16} />
        </button>
        <button className="inspector-action-button danger-action" type="button" title="删除" aria-label="删除" onClick={() => onDelete(file.id)}>
          <Trash2 size={16} />
        </button>
      </div>
    </aside>
  )
}

function AnalysisList({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <section>
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul>
          {items.slice(0, 5).map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </section>
  )
}

function InsightsView({
  tasks,
  updates,
  files,
  attachmentAnalyses,
  reports,
  currentMonth,
  hourlyRate,
  onBackfillAnalyses,
  onRetryAnalysis,
}: {
  tasks: Task[]
  updates: TaskUpdate[]
  files: FileAsset[]
  attachmentAnalyses: AttachmentAnalysis[]
  reports: ReportRecord[]
  currentMonth: { label: string; value: string }
  hourlyRate: number
  onBackfillAnalyses: () => Promise<void>
  onRetryAnalysis: (attachmentId: number) => Promise<void>
}) {
  const [period, setPeriod] = useState<InsightPeriod>('month')
  const [activeTab, setActiveTab] = useState<InsightTab>('period')
  const [analysisActionId, setAnalysisActionId] = useState<number | 'backfill' | null>(null)
  const [diagnosis, setDiagnosis] = useState<InsightDiagnosis | null>(null)
  const [isDiagnosisLoading, setIsDiagnosisLoading] = useState(false)
  const [diagnosisError, setDiagnosisError] = useState('')
  const [insightHistory, setInsightHistory] = useState<InsightHistoryItem[]>([])
  const [historyError, setHistoryError] = useState('')
  const range = useMemo(() => insightPeriodRange(period, currentMonth.value), [currentMonth.value, period])
  const rangeLabel = formatInsightRange(range)

  const periodTasks = useMemo(
    () =>
      tasks.filter((task) => isTaskInAnalysisRange(task, range)),
    [range, tasks],
  )
  const periodTaskIds = useMemo(() => new Set(periodTasks.map((task) => task.id)), [periodTasks])
  const periodUpdates = useMemo(
    () => updates.filter((update) => periodTaskIds.has(update.taskId) || isDateInRange(update.date, range)),
    [periodTaskIds, range, updates],
  )
  const periodFiles = useMemo(
    () => files.filter((file) => periodTaskIds.has(file.taskId) || isDateInRange(file.uploadedAt, range)),
    [files, periodTaskIds, range],
  )
  const analysisByAttachment = useMemo(
    () => new Map(attachmentAnalyses.map((analysis) => [analysis.attachmentId, analysis])),
    [attachmentAnalyses],
  )
  const periodAnalyses = useMemo(
    () => periodFiles.map((file) => analysisByAttachment.get(file.id)).filter((analysis): analysis is AttachmentAnalysis => Boolean(analysis)),
    [analysisByAttachment, periodFiles],
  )
  const completedAnalyses = periodAnalyses.filter((analysis) => analysis.status === 'completed')
  const pendingAnalyses = periodAnalyses.filter((analysis) => analysis.status === 'pending' || analysis.status === 'processing')
  const problemAnalyses = periodAnalyses.filter((analysis) => analysis.status === 'failed' || analysis.status === 'unsupported')
  const unanalyzedCount = Math.max(0, periodFiles.length - periodAnalyses.length)
  const filesByTask = useMemo(() => {
    const map = new Map<number, FileAsset[]>()
    periodFiles.forEach((file) => {
      map.set(file.taskId, [...(map.get(file.taskId) ?? []), file])
    })
    return map
  }, [periodFiles])
  const updatesByTask = useMemo(() => {
    const map = new Map<number, TaskUpdate[]>()
    periodUpdates
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((update) => {
        map.set(update.taskId, [...(map.get(update.taskId) ?? []), update])
      })
    return map
  }, [periodUpdates])

  const acceptedTasks = periodTasks.filter((task) => task.status === '已验收')
  const billableTasks = periodTasks.filter((task) => task.status !== '不计费')
  const totalHours = Number(billableTasks.reduce((sum, task) => sum + task.actualHours, 0).toFixed(1))
  const estimatedHours = Number(billableTasks.reduce((sum, task) => sum + task.estimatedHours, 0).toFixed(1))
  const acceptedRate = periodTasks.length > 0 ? Math.round((acceptedTasks.length / periodTasks.length) * 100) : 0
  const visualReadyCount = periodFiles.filter(isVisualReviewReady).length
  const lockedReports = reports.filter((report) => {
    const reportDate = dateFromValue(`${report.month}-01`)
    return reportDate ? reportDate >= range.start && reportDate <= range.end : false
  }).length

  const typeDistribution = useMemo(() => {
    const hoursByType = new Map<string, number>()
    billableTasks.forEach((task) => {
      if (task.actualHours <= 0) {
        return
      }
      hoursByType.set(task.type, Number(((hoursByType.get(task.type) ?? 0) + task.actualHours).toFixed(1)))
    })
    const items: DonutItem[] = [...hoursByType.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], index) => ({ label, value, color: donutPalette[index % donutPalette.length] }))
    return { items, total: Number(items.reduce((sum, item) => sum + item.value, 0).toFixed(1)) }
  }, [billableTasks])

  const trendData = useMemo(() => {
    const bucketCount = period === 'year' ? 12 : period === 'half' ? 6 : period === 'quarter' ? 3 : period === 'month' ? 4 : period === 'week' ? 7 : 6
    const buckets = Array.from({ length: bucketCount }, () => ({ label: '', value: 0 }))
    if (period === 'year' || period === 'half' || period === 'quarter') {
      const startMonth = range.start.getMonth()
      buckets.forEach((bucket, index) => {
        bucket.label = `${startMonth + index + 1}月`
      })
      periodUpdates.forEach((update) => {
        const date = dateFromValue(update.date)
        if (!date) {
          return
        }
        const index = date.getMonth() - startMonth
        if (buckets[index]) {
          buckets[index].value += Number(update.hours) || 0
        }
      })
    } else if (period === 'month') {
      buckets.forEach((bucket, index) => {
        const startDay = index * 7 + 1
        const endDay = Math.min(startDay + 6, range.end.getDate())
        bucket.label = `${startDay}-${endDay}`
      })
      periodUpdates.forEach((update) => {
        const date = dateFromValue(update.date)
        if (!date) {
          return
        }
        const index = Math.min(Math.floor((date.getDate() - 1) / 7), buckets.length - 1)
        buckets[index].value += Number(update.hours) || 0
      })
    } else if (period === 'week') {
      buckets.forEach((bucket, index) => {
        bucket.label = `周${weekdayLabels[index]}`
      })
      periodUpdates.forEach((update) => {
        const date = dateFromValue(update.date)
        if (!date) {
          return
        }
        const index = (date.getDay() + 6) % 7
        buckets[index].value += Number(update.hours) || 0
      })
    } else {
      buckets.forEach((bucket, index) => {
        bucket.label = `${index * 4}:00`
      })
      periodUpdates.forEach((update) => {
        const date = dateFromValue(update.date)
        if (!date) {
          return
        }
        const index = Math.min(Math.floor(date.getHours() / 4), buckets.length - 1)
        buckets[index].value += Number(update.hours) || 0
      })
    }
    return buckets.map((bucket) => ({ ...bucket, value: Number(bucket.value.toFixed(1)) }))
  }, [period, periodUpdates, range])

  const hourAccuracySamples = billableTasks.filter((task) => task.actualHours > 0 && task.estimatedHours > 0)
  const hourAccuracy =
    hourAccuracySamples.length > 0
      ? Math.max(
          0,
          Math.round(
            hourAccuracySamples.reduce((sum, task) => sum + Math.max(0, 100 - (Math.abs(task.actualHours - task.estimatedHours) / task.estimatedHours) * 100), 0) /
              hourAccuracySamples.length,
          ),
        )
      : 0
  const contactRows = [...periodTasks.reduce((map, task) => {
    const name = task.contact || '未填写'
    map.set(name, (map.get(name) ?? 0) + 1)
    return map
  }, new Map<string, number>()).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      pct: periodTasks.length > 0 ? Math.round((count / periodTasks.length) * 100) : 0,
    }))
  const riskRows = useMemo(() => {
    const todayValue = isoDate()
    return periodTasks.flatMap((task) => {
      const taskFiles = filesByTask.get(task.id) ?? []
      const taskUpdates = updatesByTask.get(task.id) ?? []
      const risks: { task: Task; tone: 'danger' | 'warning' | 'info'; label: string; detail: string }[] = []
      if (task.estimatedHours > 0 && task.actualHours > task.estimatedHours * 1.3) {
        risks.push({
          task,
          tone: 'danger',
          label: '工时超预估',
          detail: `实际 ${task.actualHours.toFixed(1)}h，预估 ${task.estimatedHours.toFixed(1)}h，超出 ${Math.round((task.actualHours / task.estimatedHours - 1) * 100)}%。`,
        })
      }
      if (!['已验收', '终止', '不计费'].includes(task.status) && datePart(task.estimatedDate || task.date) < todayValue) {
        risks.push({
          task,
          tone: 'danger',
          label: '交付逾期',
          detail: `预计交付 ${formatPlanDateTime(task.estimatedDate || task.date)}，当前状态为 ${task.status}。`,
        })
      }
      if (['进行中', '待验收'].includes(task.status) && taskUpdates.length === 0) {
        risks.push({
          task,
          tone: 'warning',
          label: '缺少进展记录',
          detail: '当前周期内没有进展记录，后续复盘会缺少过程依据。',
        })
      }
      if (['待验收', '已验收'].includes(task.status) && taskFiles.length === 0 && (task.acceptanceFiles?.length ?? 0) === 0) {
        risks.push({
          task,
          tone: 'warning',
          label: '缺少交付附件',
          detail: '任务已到验收阶段，但没有关联交付件，后续无法做文件级复盘。',
        })
      }
      return risks
    }).slice(0, 10)
  }, [filesByTask, periodTasks, updatesByTask])
  const runDiagnosis = async () => {
    if (isDiagnosisLoading) {
      return
    }
    setIsDiagnosisLoading(true)
    setDiagnosisError('')
    try {
      setDiagnosis(await api.diagnoseInsights({ month: currentMonth.value, period }))
      setInsightHistory(await api.getInsightHistory())
    } catch (error) {
      setDiagnosisError(error instanceof Error ? error.message : '洞察诊断失败，请稍后重试')
    } finally {
      setIsDiagnosisLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab !== 'advisor') {
      return
    }
    let ignore = false
    api.getInsightHistory()
      .then((items) => {
        if (!ignore) {
          setInsightHistory(items)
          setHistoryError('')
        }
      })
      .catch((error) => {
        if (!ignore) {
          setHistoryError(error instanceof Error ? error.message : '洞察追踪记录读取失败')
        }
      })
    return () => {
      ignore = true
    }
  }, [activeTab])

  return (
    <section className="insights-view">
      <section className="panel insights-hero">
        <div>
          <p className="eyebrow">数据洞察</p>
          <h2>周期复盘与交付链路分析</h2>
          <span>{rangeLabel} · 基于历史任务、当前周期、进展、验收和附件完整度自动复盘</span>
        </div>
        <span className="admin-only-data insights-admin-badge">设计师专属</span>
      </section>

      <div className="segment-tabs insights-tabs" role="tablist" aria-label="洞察模块">
        {insightTabs.map((tab) => (
          <button className={activeTab === tab.value ? 'active' : ''} key={tab.value} role="tab" aria-selected={activeTab === tab.value} onClick={() => setActiveTab(tab.value)}>
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'period' && (
        <>
          <div className="segment-tabs insights-period-tabs" aria-label="洞察周期">
            {insightPeriods.map((item) => (
              <button className={period === item.value ? 'active' : ''} key={item.value} onClick={() => setPeriod(item.value)}>
                {item.label}
              </button>
            ))}
          </div>

          <section className="stats-grid" aria-label="洞察统计">
            <StatCard label="周期任务" value={`${periodTasks.length} 个`} trend={`${acceptedTasks.length} 个已验收 · ${lockedReports} 期已锁定`} icon={<ListChecks size={20} />} />
            <StatCard label="验收率" value={`${acceptedRate}%`} trend={periodTasks.length > 0 ? `${acceptedTasks.length}/${periodTasks.length} 个完成闭环` : '暂无可统计任务'} icon={<ClipboardCheck size={20} />} />
            <StatCard label="实际工时" value={`${totalHours.toFixed(1)}h`} trend={`预估 ${estimatedHours.toFixed(1)}h · ¥${Math.round(totalHours * hourlyRate).toLocaleString()}`} icon={<Clock3 size={20} />} />
            <StatCard label="交付件" value={`${periodFiles.length} 个`} trend={`${visualReadyCount} 个可预览 / 基础检查`} icon={<Archive size={20} />} />
          </section>

          <section className="insights-grid">
            <section className="panel distribution-panel">
              <div className="panel-header compact">
                <div>
                  <h2>类型工时结构</h2>
                  <p>按实际工时查看当前周期最主要的任务类型</p>
                </div>
              </div>
              <DonutChart items={typeDistribution.items} total={typeDistribution.total} />
            </section>

            <section className="panel trend-panel">
              <div className="panel-header compact">
                <div>
                  <h2>进展投入趋势 <span>小时</span></h2>
                  <p>来自进展记录中的工时变化，用于观察节奏和峰值</p>
                </div>
              </div>
              <TrendChart data={trendData} />
            </section>
          </section>
        </>
      )}

      {activeTab === 'deliverable' && (
        <section className="panel insights-chain-panel attachment-analysis-panel">
          <div className="panel-header compact">
            <div>
              <h2>交付件内容理解</h2>
              <p>读取 R2 附件，经 PDF / Office / 图片解析后由视觉模型分析，结果保存到 D1</p>
            </div>
            <button
              type="button"
              className="ghost-button compact-button"
              disabled={analysisActionId !== null}
              onClick={() => {
                setAnalysisActionId('backfill')
                void onBackfillAnalyses().finally(() => setAnalysisActionId(null))
              }}
            >
              <RotateCcw size={14} />
              {analysisActionId === 'backfill' ? '正在创建任务' : '补分析历史附件'}
            </button>
          </div>
          <div className="attachment-analysis-stats" aria-label="附件分析状态">
            <div><strong>{completedAnalyses.length}</strong><span>已读懂</span></div>
            <div><strong>{pendingAnalyses.length}</strong><span>分析中</span></div>
            <div><strong>{problemAnalyses.length}</strong><span>需处理</span></div>
            <div><strong>{unanalyzedCount}</strong><span>待建任务</span></div>
          </div>
          <div className="attachment-analysis-list">
            {periodFiles.length === 0 && (
              <div className="empty-state">
                <strong>当前周期暂无附件</strong>
                <p>上传 PDF、PPTX、DOCX、XLSX 或图片后，系统会自动创建分析任务。</p>
              </div>
            )}
            {periodFiles.map((file) => {
              const analysis = analysisByAttachment.get(file.id)
              const task = tasks.find((item) => item.id === file.taskId)
              const isProblem = analysis?.status === 'failed' || analysis?.status === 'unsupported'
              return (
                <article className="attachment-analysis-row" key={file.id}>
                  <header>
                    <div>
                      <strong>{file.name}</strong>
                      <span>{task?.title || file.task} · {file.type} · {file.uploadedAt}</span>
                    </div>
                    <span className={`analysis-status status-${analysis?.status || 'pending'}`}>
                      {!analysis ? '待建任务' : analysis.status === 'completed' ? '已分析' : analysis.status === 'processing' ? '分析中' : analysis.status === 'pending' ? '排队中' : analysis.status === 'unsupported' ? '需预览图' : '分析失败'}
                    </span>
                  </header>
                  {analysis?.status === 'completed' && (
                    <>
                      <p className="attachment-analysis-summary">{analysis.summary}</p>
                      <div className="attachment-analysis-meta">
                        <span>{analysis.contentType || file.type}</span>
                        <span>{analysis.parserKind}</span>
                        <span>{analysis.provider} / {analysis.model}</span>
                        <span>置信度 {analysis.confidence || '中'}</span>
                      </div>
                      <div className="attachment-analysis-columns">
                        <AnalysisList title="需求匹配" items={analysis.requirementMatches} emptyText="暂无明确匹配结论" />
                        <AnalysisList title="质量问题" items={analysis.qualityIssues} emptyText="未发现明确质量问题" />
                        <AnalysisList title="风险与建议" items={[...analysis.risks, ...analysis.suggestions]} emptyText="暂无额外风险或建议" />
                      </div>
                    </>
                  )}
                  {(analysis?.status === 'pending' || analysis?.status === 'processing') && (
                    <p className="attachment-analysis-message">后台正在解析文件并调用视觉模型，完成后结果会自动写回 D1。</p>
                  )}
                  {isProblem && (
                    <div className="attachment-analysis-error">
                      <p>{analysis.errorMessage || '附件分析未完成'}</p>
                      <button
                        type="button"
                        className="ghost-button compact-button"
                        disabled={analysisActionId !== null}
                        onClick={() => {
                          setAnalysisActionId(file.id)
                          void onRetryAnalysis(file.id).finally(() => setAnalysisActionId(null))
                        }}
                      >
                        <RotateCcw size={14} />
                        {analysisActionId === file.id ? '重试中' : '重新分析'}
                      </button>
                    </div>
                  )}
                  {!analysis && <p className="attachment-analysis-message">点击“补分析历史附件”后会为该文件创建后台任务。</p>}
                </article>
              )
            })}
          </div>
        </section>
      )}

      {activeTab === 'capability' && (
        <section className="insights-grid wide">
          <section className="panel insights-capability-panel">
            <div className="panel-header compact">
              <div>
                <h2>异常任务诊断</h2>
                <p>只基于当前周期字段判断，不做文件内容识别</p>
              </div>
            </div>
            <div className="insights-risk-list">
              {riskRows.length === 0 && (
                <div className="empty-state">
                  <strong>当前没有明显异常</strong>
                  <p>没有发现工时超预估、交付逾期、缺少进展或缺少附件的任务。</p>
                </div>
              )}
              {riskRows.map((risk, index) => (
                <article className={`insights-risk-row ${risk.tone}`} key={`${risk.task.id}-${risk.label}-${index}`}>
                  <div>
                    <strong>{risk.task.title}</strong>
                    <span>{risk.task.type} · {risk.task.contact} · {risk.task.status}</span>
                  </div>
                  <em>{risk.label}</em>
                  <p>{risk.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <aside className="panel insights-advisor-panel">
            <div className="panel-header compact">
              <div>
                <h2>基础健康度</h2>
                <p>用于判断当前周期复盘质量</p>
              </div>
            </div>
            <div className="insights-capability-grid single">
              <div className="insights-score-card">
                <strong>{hourAccuracy > 0 ? `${hourAccuracy}%` : '待积累'}</strong>
                <span>工时估算准确率</span>
              </div>
              <div className="insights-score-card">
                <strong>{periodFiles.length > 0 ? `${Math.round((visualReadyCount / periodFiles.length) * 100)}%` : '待积累'}</strong>
                <span>附件可预览率</span>
              </div>
            </div>
          </aside>
        </section>
      )}

      {activeTab === 'advisor' && (
        <section className="insights-grid wide">
          <section className="panel insights-advisor-panel">
            <div className="panel-header compact">
              <div>
                <h2>异常侦查</h2>
                <p>当前周期、上一对照周期、同类历史基线与上次建议共同参与判断</p>
              </div>
              <button className="primary-button compact-button" type="button" disabled={isDiagnosisLoading} onClick={() => void runDiagnosis()}>
                <Sparkles size={15} />
                {isDiagnosisLoading ? '正在查找异常' : '运行 AI 诊断'}
              </button>
            </div>
            {!diagnosis && !diagnosisError && <div className="empty-state"><strong>尚未运行本期诊断</strong><p>系统会优先寻找变化、矛盾、交付风险和持续未解决的问题，不输出静态成绩单。</p></div>}
            {diagnosisError && <p className="insight-diagnosis-error">{diagnosisError}</p>}
            {diagnosis?.status === 'clear' && <div className="insight-clear-state"><CheckCircle2 size={18} /><div><strong>本期无明显异常</strong><p>当前数据未出现足以形成可执行诊断的变化信号。</p></div></div>}
            {diagnosis && diagnosis.insights.length > 0 && (
              <div className="insight-diagnosis-list">
                {diagnosis.insights.map((item) => (
                  <article className={`insight-diagnosis-row ${item.state}`} key={`${item.key}-${item.evidence}`}>
                    <header>
                      <strong>{item.signal}</strong>
                      <span>{item.state === 'persisting' ? '持续问题' : item.state === 'improved' ? '已有改善' : '新发现'}</span>
                    </header>
                    <p><b>证据</b>{item.evidence}</p>
                    <p><b>动作</b>{item.action}</p>
                  </article>
                ))}
              </div>
            )}
            {diagnosis?.dataNotes && diagnosis.dataNotes.length > 0 && <div className="insight-data-notes">{diagnosis.dataNotes.map((note) => <span key={note}>{note}</span>)}</div>}
          </section>

          <aside className="panel insights-chat-preview">
            <div className="panel-header compact">
              <div>
                <h2>对接人集中度</h2>
                <p>观察工作量是否过度集中</p>
              </div>
            </div>
            <div className="insights-concentration-list">
              {contactRows.length === 0 && <p className="calendar-empty-hint">暂无对接人数据。</p>}
              {contactRows.map((row) => (
                <div className="insights-concentration-row" key={row.name}>
                  <span>{row.name}</span>
                  <div><i style={{ width: `${row.pct}%` }} /></div>
                  <strong>{row.pct}%</strong>
                </div>
              ))}
            </div>
            <div className="insights-ai-note">
              <Eye size={16} />
              <span>已完成 {completedAnalyses.length} 个交付件内容分析。诊断会读取附件质量问题与风险，并记住上次建议，避免反复说同一句话。</span>
            </div>
            <div className="insight-history-panel">
              <header>
                <strong>追踪中的洞察</strong>
                <span>{insightHistory.filter((item) => item.status === 'open' || item.status === 'improved').length} 条</span>
              </header>
              {historyError && <p className="insight-diagnosis-error">{historyError}</p>}
              {!historyError && insightHistory.length === 0 && <p className="calendar-empty-hint">暂无历史洞察。运行诊断或后台命中异常后会自动生成。</p>}
              {insightHistory.slice(0, 6).map((item) => (
                <article className={`insight-history-row ${item.status}`} key={item.id}>
                  <div>
                    <strong>{item.finding}</strong>
                    <span>
                      {item.insightType === 'efficiency' ? '效率' : item.insightType === 'pricing' ? '报价' : item.insightType === 'gap' ? '空缺' : '客户'}
                      {' · '}
                      {item.status === 'open' ? '追踪中' : item.status === 'improved' ? '已有改善' : item.status === 'resolved' ? '已解决' : '已忽略'}
                    </span>
                  </div>
                  <p>{item.recommendation}</p>
                  <em>{item.generatedAt}</em>
                </article>
              ))}
            </div>
          </aside>
        </section>
      )}
    </section>
  )
}

function IncomeView({
  annualData,
  currentMonth,
  taxMode,
  onMonthChange,
}: {
  annualData: {
    year: string
    rows: AnnualIncomeRow[]
    totalHours: number
    totalAmount: number
  }
  currentMonth: { label: string; value: string }
  taxMode: TaxMode
  onMonthChange: (month: string) => void
}) {
  const [monthlySpecialDeduction, setMonthlySpecialDeduction] = useState(0)
  const [monthlyAdditionalDeduction, setMonthlyAdditionalDeduction] = useState(0)
  const [monthlyOtherDeduction, setMonthlyOtherDeduction] = useState(0)
  const taxRows = useMemo(
    () =>
      taxMode === 'labor'
        ? calculateLaborWithholding(annualData.rows)
        : calculateCumulativeWithholding(annualData.rows, monthlySpecialDeduction, monthlyAdditionalDeduction, monthlyOtherDeduction),
    [annualData.rows, monthlyAdditionalDeduction, monthlyOtherDeduction, monthlySpecialDeduction, taxMode],
  )
  const currentRow = taxRows.find((row) => row.month === currentMonth.value) ?? taxRows[0]
  const totalTax = taxRows.reduce((sum, row) => sum + row.tax, 0)
  const totalNet = taxRows.reduce((sum, row) => sum + row.netIncome, 0)
  const maxAmount = Math.max(...taxRows.map((row) => row.amount), 1)

  return (
    <section className="income-view view-stack">
      <section className="stats-grid" aria-label="年度收入统计">
        <StatCard label="年度税前收入" value={`¥${annualData.totalAmount.toLocaleString()}`} trend={`${annualData.totalHours.toFixed(1)}h 已记录工时`} icon={<BarChart3 size={20} />} />
        <StatCard label="估算已预扣税" value={`¥${totalTax.toLocaleString()}`} trend={taxMode === 'labor' ? '按劳务报酬预扣预缴' : '按工资薪金累计预扣法'} icon={<CalculatorIcon />} />
        <StatCard label="估算税后收入" value={`¥${totalNet.toLocaleString()}`} trend="未含社保外其他真实申报差异" icon={<CheckCircle2 size={20} />} />
        <StatCard label="本月税后" value={`¥${(currentRow?.netIncome ?? 0).toLocaleString()}`} trend={`${currentMonth.label}估算`} icon={<Clock3 size={20} />} />
      </section>

      <section className="income-grid">
        <section className="panel income-chart-panel">
          <div className="panel-header compact">
            <div>
              <h2>{annualData.year} 收入趋势</h2>
              <p>按每月结算金额估算税前、预扣税和税后收入</p>
            </div>
            <span className="income-method-pill">{taxMode === 'labor' ? '劳务报酬估算' : '累计预扣法估算'}</span>
          </div>
          <div className="income-bars">
            {taxRows.map((row) => {
              const grossHeight = Math.max(4, (row.amount / maxAmount) * 100)
              const netHeight = row.amount > 0 ? Math.max(4, (row.netIncome / maxAmount) * 100) : 0
              return (
                <button
                  className={`income-bar ${row.month === currentMonth.value ? 'current' : ''}`}
                  key={row.month}
                  onClick={() => onMonthChange(row.month)}
                >
                  <span className="income-bar-value">¥{Math.round(row.netIncome).toLocaleString()}</span>
                  <span className="income-bar-track">
                    <i className="gross" style={{ height: `${grossHeight}%` }} />
                    <i className="net" style={{ height: `${netHeight}%` }} />
                  </span>
                  <small>{Number(row.month.slice(5, 7))}月</small>
                </button>
              )
            })}
          </div>
          <div className="income-legend">
            <span><i className="gross" />税前收入</span>
            <span><i className="net" />税后收入</span>
          </div>
        </section>

        <details className="panel income-tax-panel">
          <summary className="income-tax-summary">
            <div>
              <h2>税务估算参数</h2>
              <p>公司最终申报可能包含更多扣除，以实际个税 App 为准</p>
            </div>
            <span>展开参数</span>
          </summary>
          <div className="income-form">
            <label className="field">
              <span>每月专项扣除</span>
              <input type="number" min="0" step="100" value={monthlySpecialDeduction} disabled={taxMode === 'labor'} onChange={(event) => setMonthlySpecialDeduction(Math.max(0, Number(event.target.value) || 0))} />
            </label>
            <label className="field">
              <span>每月专项附加扣除</span>
              <input type="number" min="0" step="100" value={monthlyAdditionalDeduction} disabled={taxMode === 'labor'} onChange={(event) => setMonthlyAdditionalDeduction(Math.max(0, Number(event.target.value) || 0))} />
            </label>
            <label className="field">
              <span>每月其他扣除</span>
              <input type="number" min="0" step="100" value={monthlyOtherDeduction} disabled={taxMode === 'labor'} onChange={(event) => setMonthlyOtherDeduction(Math.max(0, Number(event.target.value) || 0))} />
            </label>
          </div>
          <div className="tax-note">
            <strong>当前计算口径</strong>
            <p>
              {taxMode === 'labor'
                ? '劳务报酬按次或按月预扣预缴：收入不超过 4000 元减除 800 元，超过 4000 元减除 20%，再按 20% / 30% / 40% 预扣率计算。'
                : '累计应纳税所得额 = 累计收入 - 5000 × 月份数 - 累计专项扣除 - 累计专项附加扣除 - 累计其他扣除。'}
            </p>
          </div>
        </details>
      </section>

      <section className="panel income-table-panel">
        <div className="panel-header compact">
          <div>
            <h2>月度收入明细</h2>
            <p>点击趋势柱可切换当前月份；税额为系统估算，不替代财务确认</p>
          </div>
        </div>
        <div className="income-table-wrap">
          <table className="income-table">
            <thead>
              <tr>
                <th>月份</th>
                <th className="num">工时</th>
                <th className="num">税前收入</th>
                <th className="num">{taxMode === 'labor' ? '预扣应纳税所得额' : '累计应纳税所得额'}</th>
                <th className="num">预扣率</th>
                <th className="num">本月预扣税</th>
                <th className="num">税后收入</th>
              </tr>
            </thead>
            <tbody>
              {taxRows.map((row) => (
                <tr className={row.month === currentMonth.value ? 'current' : ''} key={row.month}>
                  <td>{monthLabelOf(row.month)}</td>
                  <td className="num">{row.hours.toFixed(1)}h</td>
                  <td className="num">¥{row.amount.toLocaleString()}</td>
                  <td className="num">¥{Math.round(row.taxableIncome).toLocaleString()}</td>
                  <td className="num">{Math.round(row.rate * 100)}%</td>
                  <td className="num">¥{row.tax.toLocaleString()}</td>
                  <td className="num">¥{row.netIncome.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}

function CalculatorIcon() {
  return <BarChart3 size={20} />
}

function ReportsView({
  stats,
  tasks,
  updates,
  hourlyRate,
  importedHours,
  currentMonth,
  pdfTitle,
  serviceCompanyName,
  reports,
  onClientPreview,
  onCopyShareLink,
  onRotateReportToken,
  onLockReport,
}: {
  stats: {
    totalHours: number
    billableHours: number
    amount: number
    accepted: number
    pending: number
  }
  tasks: Task[]
  updates: TaskUpdate[]
  hourlyRate: number
  importedHours: number
  currentMonth: { label: string; value: string }
  pdfTitle: string
  serviceCompanyName: string
  reports: ReportRecord[]
  onClientPreview: () => void
  onCopyShareLink: (token: string) => void
  onRotateReportToken: (report: ReportRecord) => void
  onLockReport: () => void
}) {
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false)
  const billableTasks = tasks.filter((task) => task.status !== '不计费' && task.status !== '计划中')
  const receiptDetailTasks = tasks.filter((task) => task.status !== '不计费')
  const plannedCount = tasks.filter((task) => task.status === '计划中').length
  const freeTasks = tasks.filter((task) => task.status === '不计费')
  const visibleReports = isHistoryExpanded ? reports : reports.slice(0, 1)
  const receiptNo = `AK-${currentMonth.value.replace('-', '')}-${String(billableTasks.length + 1).padStart(3, '0')}`
  const latestUpdatesByTask = useMemo(() => {
    const result = new Map<number, TaskUpdate>()
    updates
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((update) => {
        if (!result.has(update.taskId)) {
          result.set(update.taskId, update)
        }
      })
    return result
  }, [updates])

  const formatReceiptDate = (value: string) => (value ? datePart(value).replaceAll('-', '/') : '—')
  const formatReceiptHours = (value: number) => (Number.isFinite(value) ? Number(value.toFixed(2)).toString() : '0')
  const getActualDeliveryDate = (task: Task) => {
    if (task.status === '已验收') {
      return formatReceiptDate(latestUpdatesByTask.get(task.id)?.date ?? '')
    }
    return '—'
  }
  const getTaskStage = (task: Task) => task.stage || (task.status === '已验收' ? '完成' : task.status)
  const getTaskRisk = (task: Task) => {
    if (task.status === '挂起') {
      return task.suspendReason || '挂起，原因未记录'
    }
    if (task.status === '终止') {
      return task.terminateReason || '终止，原因未记录'
    }
    return '无'
  }
  const getTaskProgressText = (task: Task) => {
    const latestUpdate = latestUpdatesByTask.get(task.id)
    const parts: string[] = []
    if (task.acceptanceNote?.trim()) {
      parts.push(task.acceptanceNote.trim())
    }
    if (latestUpdate) {
      parts.push(`${latestUpdate.title}${latestUpdate.body ? `：${latestUpdate.body}` : ''}`)
    }
    if (task.acceptanceFiles && task.acceptanceFiles.length > 0) {
      parts.push(`验收文件：${task.acceptanceFiles.slice(0, 3).join('、')}${task.acceptanceFiles.length > 3 ? ` 等 ${task.acceptanceFiles.length} 个` : ''}`)
    }
    if (parts.length === 0) {
      parts.push(`${task.status}，进度 ${task.progress}%`)
    }
    return parts.join('；')
  }

  const handleExportPdf = () => {
    const previousTitle = document.title
    document.title = `${pdfTitle}_${currentMonth.value}`
    window.print()
    document.title = previousTitle
  }

  return (
    <section className="report-workspace">
      <section className="panel report-control-bar">
        <div className="report-summary-chips">
          <div>
            <span>总工时</span>
            <strong>{stats.totalHours.toFixed(1)}h</strong>
          </div>
          <div>
            <span>计费工时</span>
            <strong>{stats.billableHours.toFixed(1)}h</strong>
          </div>
          <div>
            <span>结算金额</span>
            <strong>¥{stats.amount.toLocaleString()}</strong>
          </div>
          <div>
            <span>已验收</span>
            <strong>{stats.accepted} 个</strong>
          </div>
        </div>
        <p className="report-flow-hint">
          核对下方结算单 → 「锁定结算」生成甲方分享链接（金额快照不再变动）→ 把链接发给甲方，或「导出 PDF」另存发送。
        </p>
        <div className="report-bar-actions">
          <button className="primary-button" onClick={onLockReport}>
            <CheckCircle2 size={18} />
            锁定结算并生成甲方链接
          </button>
          <button className="ghost-button" onClick={handleExportPdf}>
            <Download size={18} />
            导出 PDF
          </button>
          <button className="ghost-button" onClick={onClientPreview}>
            <Share2 size={18} />
            预览甲方页面
          </button>
        </div>

        {reports.length > 0 && (
          <div className="report-history">
            <div className="report-history-header">
              <h3>结算历史</h3>
              {reports.length > 1 && (
                <button type="button" onClick={() => setIsHistoryExpanded((expanded) => !expanded)}>
                  {isHistoryExpanded ? '收起' : `展开全部 ${reports.length} 条`}
                </button>
              )}
            </div>
            {visibleReports.map((report) => (
              <div className="report-history-row" key={report.id}>
                <strong>{monthLabelOf(report.month)}</strong>
                <span>
                  {report.billableHours.toFixed(1)}h · ¥{report.totalAmount.toLocaleString()}
                </span>
                <small>
                  锁定于 {report.generatedAt || '—'}
                  {report.viewCount > 0 ? ` · 甲方已查看 ${report.viewCount} 次（最近 ${report.viewedAt}）` : ' · 甲方尚未查看'}
                </small>
                <div className="report-history-actions">
                  <button className="icon-button" aria-label={`复制 ${report.month} 甲方链接`} onClick={() => onCopyShareLink(report.publicToken)}>
                    <Copy size={15} />
                  </button>
                  <button className="icon-button" aria-label={`重置 ${report.month} 甲方链接`} onClick={() => onRotateReportToken(report)}>
                    <RotateCcw size={15} />
                  </button>
                  <a className="icon-button" aria-label={`打开 ${report.month} 甲方页面`} href={`/share/${report.publicToken}`} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="receipt" aria-label="月度结算回单" data-company={serviceCompanyName}>
        <header className="receipt-header">
          <div className="receipt-brand">
            <span className="receipt-mark">
              <Sparkles size={16} />
            </span>
            <div>
              <strong>{serviceCompanyName}</strong>
              <small>ANKKI TECHNOLOGY</small>
            </div>
          </div>
          <div className="receipt-title">
            <h2>{pdfTitle}</h2>
            <span>MONTHLY SETTLEMENT RECEIPT</span>
          </div>
          <div className="receipt-no">
            <span>回单编号：{receiptNo}</span>
            <span>出单时间：{nowStamp()}</span>
          </div>
        </header>

        <div className="receipt-rule" />

        <dl className="receipt-info">
          <div>
            <dt>客户名称</dt>
            <dd>{serviceCompanyName}</dd>
          </div>
          <div>
            <dt>服务内容</dt>
            <dd>平面设计兼职</dd>
          </div>
          <div>
            <dt>结算月份</dt>
            <dd>{currentMonth.label}</dd>
          </div>
          <div>
            <dt>结算单价</dt>
            <dd>¥{hourlyRate} / 小时</dd>
          </div>
        </dl>

        <table className="receipt-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>结算月份</th>
              <th>项目名称</th>
              <th>类型</th>
              <th className="num">工时</th>
              <th className="num">金额（元）</th>
            </tr>
          </thead>
          <tbody>
            {billableTasks.map((task, index) => (
              <tr key={task.id}>
                <td>{String(index + 1).padStart(2, '0')}</td>
                <td>{monthLabelOf(taskSettlementMonth(task))}{isSupplementalTask(task) ? '（补录）' : ''}</td>
                <td className="receipt-task-name">{task.title}</td>
                <td>{task.type}</td>
                <td className="num">{task.actualHours.toFixed(1)}</td>
                <td className="num">{Math.round(task.actualHours * hourlyRate).toLocaleString()}</td>
              </tr>
            ))}
            {importedHours > 0 && (
              <tr>
                <td>{String(billableTasks.length + 1).padStart(2, '0')}</td>
                <td>—</td>
                <td className="receipt-task-name">月初导入工时（线下记录补录）</td>
                <td>导入</td>
                <td className="num">{importedHours.toFixed(1)}</td>
                <td className="num">{Math.round(importedHours * hourlyRate).toLocaleString()}</td>
              </tr>
            )}
            {billableTasks.length === 0 && importedHours === 0 && (
              <tr>
                <td colSpan={6} className="receipt-empty">
                  本月暂无计费任务
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>合计</td>
              <td className="num">{stats.billableHours.toFixed(1)}</td>
              <td className="num">¥{stats.amount.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <section className="receipt-detail-section" aria-label="工时明细附表">
          <div className="receipt-detail-title">
            <h3>工时明细附表</h3>
            <span>字段对应 Excel「6月」工时明细表，由平台任务、验收和进展记录自动生成。</span>
          </div>
          <div className="receipt-detail-table-wrap">
            <table className="receipt-table receipt-detail-table">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>参考开始日期</th>
                  <th>设计类型</th>
                  <th>项目/任务名称</th>
                  <th>具体任务需求</th>
                  <th>对接人</th>
                  <th>工作阶段</th>
                  <th className="num">参考预估工时</th>
                  <th className="num">实际工时</th>
                  <th>参考交付日期</th>
                  <th>实际交付日期</th>
                  <th>修改轮次上限</th>
                  <th>状态</th>
                  <th>验收人/确认</th>
                  <th>风险/阻塞</th>
                  <th>进展</th>
                </tr>
              </thead>
              <tbody>
                {receiptDetailTasks.map((task, index) => (
                  <tr key={task.id}>
                    <td>{String(index + 1).padStart(2, '0')}</td>
                    <td>{formatReceiptDate(task.date)}{isSupplementalTask(task) ? '（补录）' : ''}</td>
                    <td>{task.type}</td>
                    <td>{task.title}</td>
                    <td>{task.requirement || '—'}</td>
                    <td>{task.contact || '—'}</td>
                    <td>{getTaskStage(task)}</td>
                    <td className="num">{formatReceiptHours(task.estimatedHours)}</td>
                    <td className="num">{formatReceiptHours(task.actualHours)}</td>
                    <td>{formatReceiptDate(task.estimatedDate)}</td>
                    <td>{getActualDeliveryDate(task)}</td>
                    <td>—</td>
                    <td>{task.status}</td>
                    <td>{task.reviewer || task.requester || '—'}</td>
                    <td>{getTaskRisk(task)}</td>
                    <td>{getTaskProgressText(task)}</td>
                  </tr>
                ))}
                {receiptDetailTasks.length === 0 && (
                  <tr>
                    <td colSpan={16} className="receipt-empty">
                      本月暂无可纳入结算明细的任务
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={7}>合计</td>
                  <td className="num">—</td>
                  <td className="num">{receiptDetailTasks.reduce((sum, task) => sum + task.actualHours, 0).toFixed(1)}</td>
                  <td colSpan={7}>计费金额以已验收/计费任务摘要为准</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <div className="receipt-amount">
          <span>人民币（大写）</span>
          <strong>{toChineseAmount(stats.amount)}</strong>
        </div>

        <div className="receipt-remarks">
          <p>
            备注：本月共 {tasks.length} 项任务，已验收 {stats.accepted} 项，待验收 {stats.pending} 项
            {plannedCount > 0 ? `，计划中 ${plannedCount} 项（未计费）` : ''}
            {freeTasks.length > 0 ? `，另含 ${freeTasks.length} 项不计费协助` : ''}。
          </p>
          <p>本回单由系统根据任务与工时记录自动生成，验收状态以甲方确认为准。</p>
          <div className="receipt-stamp" aria-hidden="true">
            <span>{serviceCompanyName}</span>
            <em>★</em>
            <span>工时结算确认</span>
          </div>
        </div>

        <div className="receipt-cutline">
          <span>✂</span>
        </div>
      </section>
    </section>
  )
}

function ClientReportView({
  stats,
  tasks,
  updates,
  files,
  currentMonth,
  pdfTitle,
  serviceCompanyName,
  onBack,
  onPreviewFile,
}: {
  stats: {
    totalHours: number
    billableHours: number
    amount: number
    accepted: number
    pending: number
  }
  tasks: Task[]
  updates: TaskUpdate[]
  files: FileAsset[]
  currentMonth: { label: string; value: string }
  pdfTitle: string
  serviceCompanyName: string
  onBack: () => void
  onPreviewFile: (file: FileAsset) => void
}) {
  const visibleUpdates = updates.filter((update) => update.visible)
  const visibleFiles = files.filter((file) => file.visible)

  return (
    <section className="client-view">
      <section className="client-hero panel">
        <div>
          <p className="eyebrow">查看页 · {serviceCompanyName}</p>
          <h2>{currentMonth.label}{pdfTitle}</h2>
          <p>包含本月任务明细、进展记录、计费工时和可下载交付文件。</p>
        </div>
        <div className="client-hero-actions">
          <button className="ghost-button" onClick={onBack}>
            <ChevronLeft size={17} />
            返回结算
          </button>
          <button className="primary-button" onClick={() => window.print()}>
            <Download size={18} />
            下载 PDF
          </button>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="总工时" value={`${stats.totalHours.toFixed(1)}h`} trend="本月投入" icon={<Clock3 size={20} />} />
        <StatCard label="预计结算" value={`¥${stats.amount.toLocaleString()}`} trend="按当前单价" icon={<BarChart3 size={20} />} />
        <StatCard label="已验收" value={`${stats.accepted}`} trend={`${stats.pending} 个待验收`} icon={<CheckCircle2 size={20} />} />
        <StatCard label="可下载文件" value={`${visibleFiles.length}`} trend="交付资料" icon={<Archive size={20} />} />
      </section>

      <section className="client-grid">
        <div className="panel">
          <div className="panel-header compact">
            <div>
              <h2>任务明细</h2>
              <p>仅展示本月计费或交付相关任务</p>
            </div>
          </div>
          {tasks
            .filter((task) => task.status !== '不计费')
            .map((task) => (
              <div className="client-task-row" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <span>
                    {formatPlanDateTime(task.date)}
                    {isSupplementalTask(task) ? ` · 补录至 ${monthLabelOf(taskSettlementMonth(task))}` : ''}
                    {' · '}
                    {task.requirement}
                  </span>
                </div>
                <em>{task.actualHours.toFixed(1)}h</em>
                <StatusBadge status={task.status} />
              </div>
            ))}
        </div>

        <aside className="panel">
          <div className="panel-header compact">
            <div>
              <h2>交付文件</h2>
              <p>点击文件即可在线预览，无需下载</p>
            </div>
          </div>
          <div className="client-files">
            {visibleFiles.length === 0 && <p className="calendar-empty-hint">本月暂无交付文件。</p>}
            {visibleFiles.map((file) => (
              <button className="client-file-row" key={file.id} onClick={() => onPreviewFile(file)}>
                <Paperclip size={15} />
                <span>{file.name}</span>
                <Eye size={15} />
              </button>
            ))}
          </div>
        </aside>
      </section>

      <section className="panel">
        <div className="panel-header compact">
          <div>
            <h2>进展记录</h2>
            <p>项目动态</p>
          </div>
        </div>
        <div className="timeline">
          {visibleUpdates.map((update) => (
            <article className="timeline-item" key={update.id}>
              <span className="dot" />
              <TimelineStamp value={update.date} audience="public" />
              <h3>{update.title}</h3>
              <p>{update.body}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}

const aiRouteMeta: Array<{ key: AiModelRouteKey; title: string; description: string; capability: 'text' | 'vision' }> = [
  { key: 'textPrimary', title: '文字主模型', description: '任务文案、进展、验收和工时建议优先使用', capability: 'text' },
  { key: 'textFallback', title: '文字备用模型', description: 'DeepSeek 不可用或返回无效时自动兜底', capability: 'text' },
  { key: 'visionPrimary', title: '识图主模型', description: '交付件图片、PDF 页面和 PPT 预览优先识别', capability: 'vision' },
  { key: 'visionFallback', title: '识图备用模型', description: 'Gemini 额度不足或识别失败时自动兜底', capability: 'vision' },
]

const aiRouteDefaults: Record<AiModelRouteKey, Pick<AiModelEndpointConfig, 'provider' | 'baseUrl' | 'model'>> = {
  textPrimary: { provider: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  textFallback: { provider: 'kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2.6' },
  visionPrimary: { provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-3-flash-preview' },
  visionFallback: { provider: 'kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2.6' },
}

function aiRoutesFromConfig(config: AiModelConfig | null): Record<AiModelRouteKey, Pick<AiModelEndpointConfig, 'provider' | 'baseUrl' | 'model'>> {
  return aiRouteMeta.reduce((map, route) => {
    const item = config?.[route.key] ?? aiRouteDefaults[route.key]
    return {
      ...map,
      [route.key]: {
        provider: item.provider,
        baseUrl: item.baseUrl,
        model: item.model,
      },
    }
  }, {} as Record<AiModelRouteKey, Pick<AiModelEndpointConfig, 'provider' | 'baseUrl' | 'model'>>)
}

function SettingsView({
  hourlyRate,
  pdfTitle,
  serviceCompanyName,
  taxMode,
  designTypeGroups,
  aiModelConfig,
  role,
  accessTokens,
  newTokenId,
  onRateChange,
  onPdfTitleChange,
  onServiceCompanyNameChange,
  onTaxModeChange,
  onDesignTypeGroupsChange,
  onAiModelConfigChange,
  onExportBackup,
  onSignOut,
  onChangePassword,
  onCreateToken,
  onToggleToken,
  onDeleteToken,
  onCopyToken,
}: {
  hourlyRate: number
  pdfTitle: string
  serviceCompanyName: string
  taxMode: TaxMode
  designTypeGroups: DesignTypeGroup[]
  aiModelConfig: AiModelConfig | null
  role: AuthRole
  accessTokens: AccessToken[]
  newTokenId: string
  onRateChange: (rate: number) => void
  onPdfTitleChange: (title: string) => void
  onServiceCompanyNameChange: (name: string) => void
  onTaxModeChange: (mode: TaxMode) => void
  onDesignTypeGroupsChange: (groups: DesignTypeGroup[]) => void | Promise<void>
  onAiModelConfigChange: (
    payload: Partial<Pick<AiModelConfig, 'mode' | 'provider' | 'baseUrl' | 'model' | 'runtimeUrl'>> & {
      apiKey?: string
      clearApiKey?: boolean
      routes?: Partial<Record<AiModelRouteKey, Partial<Pick<AiModelEndpointConfig, 'provider' | 'baseUrl' | 'model'>>>>
      routeApiKeys?: Partial<Record<AiModelRouteKey, string>>
      clearRouteApiKeys?: AiModelRouteKey[]
    },
  ) => void | Promise<void>
  onExportBackup: () => void
  onSignOut: () => void
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>
  onCreateToken: (label: string, expiresInDays: number | null) => void
  onToggleToken: (tokenId: string, disabled: boolean) => void
  onDeleteToken: (tokenId: string) => void
  onCopyToken: (token: string) => void
}) {
  const [tokenLabel, setTokenLabel] = useState('')
  const [tokenExpiry, setTokenExpiry] = useState('permanent')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupItems, setNewGroupItems] = useState<Record<string, string>>({})
  const [groupNameDrafts, setGroupNameDrafts] = useState<Record<string, string>>({})
  const [serviceCompanyDraft, setServiceCompanyDraft] = useState(serviceCompanyName)
  const [pdfTitleDraft, setPdfTitleDraft] = useState(pdfTitle)
  const [aiModeDraft, setAiModeDraft] = useState<AiModelConfig['mode']>(aiModelConfig?.mode ?? 'deepseek-direct')
  const [aiProviderDraft, setAiProviderDraft] = useState<AiModelConfig['provider']>(aiModelConfig?.provider ?? 'deepseek')
  const [aiBaseUrlDraft, setAiBaseUrlDraft] = useState(aiModelConfig?.baseUrl ?? 'https://api.deepseek.com')
  const [aiModelDraft, setAiModelDraft] = useState(aiModelConfig?.model ?? 'deepseek-chat')
  const [aiRuntimeUrlDraft, setAiRuntimeUrlDraft] = useState(aiModelConfig?.runtimeUrl ?? '')
  const [aiApiKeyDraft, setAiApiKeyDraft] = useState('')
  const [aiRouteDrafts, setAiRouteDrafts] = useState(aiRoutesFromConfig(aiModelConfig))
  const [aiRouteKeyDrafts, setAiRouteKeyDrafts] = useState<Partial<Record<AiModelRouteKey, string>>>({})
  const [testingAiRoute, setTestingAiRoute] = useState<AiModelRouteKey | null>(null)
  const [aiRouteTestResults, setAiRouteTestResults] = useState<Partial<Record<AiModelRouteKey, { ok: boolean; message: string }>>>({})
  const [isAiModelSaving, setIsAiModelSaving] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [draggingGroupName, setDraggingGroupName] = useState('')
  const [draggingItem, setDraggingItem] = useState<{ groupName: string; item: string } | null>(null)
  const [settingsConfirmDialog, setSettingsConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [isSettingsConfirmDialogBusy, setIsSettingsConfirmDialogBusy] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isPasswordSaving, setIsPasswordSaving] = useState(false)

  const tokenStatus = (token: AccessToken) => {
    if (token.disabled) {
      return { label: '已停用', className: 'status-不计费' }
    }
    if (token.expired) {
      return { label: '已过期', className: 'status-待验收' }
    }
    return { label: '有效', className: 'status-已验收' }
  }

  const handleCreate = () => {
    const expiresInDays = tokenExpiry === 'permanent' ? null : Number(tokenExpiry)
    onCreateToken(tokenLabel.trim() || '未命名口令', expiresInDays)
    setTokenLabel('')
  }

  const savePdfTitle = () => {
    const value = pdfTitleDraft.trim()
    if (value && value !== pdfTitle) {
      onPdfTitleChange(value)
    }
    if (!value) {
      setPdfTitleDraft(defaultPdfTitle)
      onPdfTitleChange(defaultPdfTitle)
    }
  }

  const saveServiceCompanyName = () => {
    const value = serviceCompanyDraft.trim()
    if (value && value !== serviceCompanyName) {
      onServiceCompanyNameChange(value)
    }
    if (!value) {
      setServiceCompanyDraft(defaultServiceCompanyName)
      onServiceCompanyNameChange(defaultServiceCompanyName)
    }
  }

  const addDesignTypeGroup = () => {
    const value = newGroupName.trim()
    if (!value || designTypeGroups.some((group) => group.name === value)) {
      return
    }
    onDesignTypeGroupsChange([...designTypeGroups, { name: value, items: [] }])
    setNewGroupName('')
  }

  const performDeleteDesignTypeGroup = async (name: string) => {
    if (designTypeGroups.length <= 1) {
      return
    }
    await onDesignTypeGroupsChange(designTypeGroups.filter((group) => group.name !== name))
    setGroupNameDrafts((current) => {
      const next = { ...current }
      delete next[name]
      return next
    })
    setNewGroupItems((current) => {
      const next = { ...current }
      delete next[name]
      return next
    })
    setCollapsedGroups((current) => {
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  const requestDeleteDesignTypeGroup = (name: string) => {
    const group = designTypeGroups.find((item) => item.name === name)
    if (!group || designTypeGroups.length <= 1) {
      return
    }
    setSettingsConfirmDialog({
      eyebrow: '删除设计类型大类',
      title: `确定删除「${name}」吗？`,
      body: '删除大类后，这个大类下的子类会一起从新建任务的选择器中移除。已创建任务的历史记录不会被删除，但后续新建任务不能再选择这些类型。',
      confirmText: '确认删除',
      tone: 'danger',
      details: [`${group.items.length} 个子类`, '影响后续新建任务选项'],
      onConfirm: () => performDeleteDesignTypeGroup(name),
    })
  }

  const renameDesignTypeGroup = (oldName: string) => {
    const nextName = (groupNameDrafts[oldName] ?? oldName).trim()
    if (!nextName || nextName === oldName || designTypeGroups.some((group) => group.name === nextName && group.name !== oldName)) {
      setGroupNameDrafts((current) => ({ ...current, [oldName]: oldName }))
      return
    }
    onDesignTypeGroupsChange(designTypeGroups.map((group) => (group.name === oldName ? { ...group, name: nextName } : group)))
    setGroupNameDrafts((current) => {
      const next = { ...current }
      delete next[oldName]
      return { ...next, [nextName]: nextName }
    })
    setNewGroupItems((current) => {
      const { [oldName]: oldDraft, ...rest } = current
      return oldDraft === undefined ? rest : { ...rest, [nextName]: oldDraft }
    })
    setCollapsedGroups((current) => {
      const { [oldName]: oldCollapsed, ...rest } = current
      return oldCollapsed === undefined ? rest : { ...rest, [nextName]: oldCollapsed }
    })
    setDraggingGroupName((current) => (current === oldName ? nextName : current))
    setDraggingItem((current) => (current?.groupName === oldName ? { ...current, groupName: nextName } : current))
  }

  const addDesignTypeItem = (groupName: string) => {
    const value = (newGroupItems[groupName] ?? '').trim()
    if (!value) {
      return
    }
    onDesignTypeGroupsChange(
      designTypeGroups.map((group) => (group.name === groupName ? { ...group, items: [...group.items, value] } : group)),
    )
    setNewGroupItems((current) => ({ ...current, [groupName]: '' }))
  }

  const performDeleteDesignTypeItem = async (groupName: string, item: string) => {
    await onDesignTypeGroupsChange(
      designTypeGroups.map((group) => (group.name === groupName ? { ...group, items: group.items.filter((value) => value !== item) } : group)),
    )
  }

  const requestDeleteDesignTypeItem = (groupName: string, item: string) => {
    setSettingsConfirmDialog({
      eyebrow: '删除设计类型子类',
      title: `确定删除「${item}」吗？`,
      body: '删除后，这个子类会从新建任务的设计类型选择器中移除。已创建任务不会被删除，历史任务仍会保留原来的类型文字。',
      confirmText: '确认删除',
      tone: 'danger',
      details: [`所属大类：${groupName}`, '影响后续新建任务选项'],
      onConfirm: () => performDeleteDesignTypeItem(groupName, item),
    })
  }

  const handleSettingsConfirm = async () => {
    if (!settingsConfirmDialog || isSettingsConfirmDialogBusy) {
      return
    }
    setIsSettingsConfirmDialogBusy(true)
    try {
      await settingsConfirmDialog.onConfirm()
      setSettingsConfirmDialog(null)
    } finally {
      setIsSettingsConfirmDialogBusy(false)
    }
  }

  useEffect(() => {
    setAiModeDraft(aiModelConfig?.mode ?? 'deepseek-direct')
    setAiProviderDraft(aiModelConfig?.provider ?? 'deepseek')
    setAiBaseUrlDraft(aiModelConfig?.baseUrl ?? 'https://api.deepseek.com')
    setAiModelDraft(aiModelConfig?.model ?? 'deepseek-chat')
    setAiRuntimeUrlDraft(aiModelConfig?.runtimeUrl ?? '')
    setAiApiKeyDraft('')
    setAiRouteDrafts(aiRoutesFromConfig(aiModelConfig))
    setAiRouteKeyDrafts({})
  }, [aiModelConfig])

  const updateAiRouteDraft = (route: AiModelRouteKey, changes: Partial<Pick<AiModelEndpointConfig, 'provider' | 'baseUrl' | 'model'>>) => {
    setAiRouteDrafts((current) => ({
      ...current,
      [route]: {
        ...current[route],
        ...changes,
      },
    }))
  }

  const saveAiModelConfig = async (clearApiKey = false, clearRouteApiKey?: AiModelRouteKey) => {
    if (isAiModelSaving) {
      return
    }
    setIsAiModelSaving(true)
    try {
      await onAiModelConfigChange({
        mode: aiModeDraft,
        provider: aiProviderDraft,
        baseUrl: aiBaseUrlDraft.trim(),
        model: aiModelDraft.trim(),
        runtimeUrl: aiRuntimeUrlDraft.trim(),
        apiKey: clearApiKey ? undefined : aiApiKeyDraft.trim() || undefined,
        clearApiKey,
        routes: aiRouteDrafts,
        routeApiKeys: Object.fromEntries(Object.entries(aiRouteKeyDrafts).filter(([, value]) => value?.trim())) as Partial<Record<AiModelRouteKey, string>>,
        clearRouteApiKeys: clearRouteApiKey ? [clearRouteApiKey] : undefined,
      })
      setAiApiKeyDraft('')
      setAiRouteKeyDrafts({})
    } finally {
      setIsAiModelSaving(false)
    }
  }

  const testAiRoute = async (route: AiModelRouteKey, capability: 'text' | 'vision') => {
    if (testingAiRoute) {
      return
    }
    setTestingAiRoute(route)
    setAiRouteTestResults((current) => ({ ...current, [route]: { ok: false, message: '测试中…' } }))
    try {
      const result = await api.testAiModelRoute({ route, capability })
      setAiRouteTestResults((current) => ({
        ...current,
        [route]: { ok: true, message: `${result.provider} / ${result.model} 可用：${result.output}` },
      }))
    } catch (error) {
      setAiRouteTestResults((current) => ({
        ...current,
        [route]: { ok: false, message: error instanceof Error ? error.message : '模型测试失败' },
      }))
    } finally {
      setTestingAiRoute(null)
    }
  }

  const submitPasswordChange = async () => {
    if (isPasswordSaving) {
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('新密码至少需要 8 位')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致')
      return
    }
    setIsPasswordSaving(true)
    setPasswordError('')
    try {
      await onChangePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : '密码更新失败')
    } finally {
      setIsPasswordSaving(false)
    }
  }

  const moveDesignTypeGroup = (targetName: string) => {
    if (!draggingGroupName || draggingGroupName === targetName) {
      return
    }
    const fromIndex = designTypeGroups.findIndex((group) => group.name === draggingGroupName)
    const toIndex = designTypeGroups.findIndex((group) => group.name === targetName)
    if (fromIndex < 0 || toIndex < 0) {
      return
    }
    const nextGroups = [...designTypeGroups]
    const [moved] = nextGroups.splice(fromIndex, 1)
    nextGroups.splice(toIndex, 0, moved)
    onDesignTypeGroupsChange(nextGroups)
  }

  const moveDesignTypeItem = (targetGroupName: string, targetItem: string) => {
    if (!draggingItem || draggingItem.groupName !== targetGroupName || draggingItem.item === targetItem) {
      return
    }
    const nextGroups = designTypeGroups.map((group) => {
      if (group.name !== targetGroupName) {
        return group
      }
      const items = [...group.items]
      const fromIndex = items.indexOf(draggingItem.item)
      const toIndex = items.indexOf(targetItem)
      if (fromIndex < 0 || toIndex < 0) {
        return group
      }
      const [moved] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, moved)
      return { ...group, items }
    })
    onDesignTypeGroupsChange(nextGroups)
  }

  return (
    <section className="settings-grid">
      <details className="settings-group-panel settings-business-group" open>
        <summary className="settings-group-summary">
          <div>
            <h2>业务设置</h2>
            <p>结算口径、服务公司和设计类型</p>
          </div>
          <ChevronDown size={18} />
        </summary>
        <div className="settings-group-body">
          <section className="panel settings-settlement-panel">
            <div className="panel-header compact">
              <div>
                <h2>结算设置</h2>
                <p>用于自动计算月度费用，已锁定的结算单不受影响</p>
              </div>
            </div>
            <div className="form-grid settings-form">
              <label className="field">
                <span>小时单价（元 / 小时）</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={hourlyRate}
                  onChange={(event) => onRateChange(Math.max(0, Number.parseFloat(event.target.value) || 0))}
                />
              </label>
              <label className="field">
                <span>服务公司名称</span>
                <input
                  value={serviceCompanyDraft}
                  placeholder="例如：昂楷科技"
                  onChange={(event) => setServiceCompanyDraft(event.target.value)}
                  onBlur={saveServiceCompanyName}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur()
                    }
                  }}
                />
              </label>
              <label className="field">
                <span>计税方式</span>
                <select value={taxMode} onChange={(event) => onTaxModeChange(event.target.value as TaxMode)}>
                  <option value="salary">工资薪金</option>
                  <option value="labor">劳务报酬</option>
                </select>
              </label>
              <label className="field wide">
                <span>PDF 抬头</span>
                <input
                  value={pdfTitleDraft}
                  placeholder="例如：设计服务工时结算回单"
                  onChange={(event) => setPdfTitleDraft(event.target.value)}
                  onBlur={savePdfTitle}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur()
                    }
                  }}
                />
              </label>
            </div>
          </section>
          {role === 'admin' && (
            <section className="panel settings-ai-panel">
              <div className="panel-header compact">
                <div>
                  <h2>AI 模型设置</h2>
                  <p>文字和识图都保留主模型与备用模型，后续多租户可自行替换 Key</p>
                </div>
              </div>
              <div className="form-grid settings-form settings-ai-form">
                <label className="field">
                  <span>运行模式</span>
                  <select value={aiModeDraft} onChange={(event) => setAiModeDraft(event.target.value as AiModelConfig['mode'])}>
                    <option value="deepseek-direct">DeepSeek 直连</option>
                    <option value="baml-runtime">BAML Runtime</option>
                  </select>
                </label>
                <label className="field">
                  <span>模型供应商</span>
                  <select value={aiProviderDraft} onChange={(event) => setAiProviderDraft(event.target.value as AiModelConfig['provider'])}>
                    <option value="deepseek">DeepSeek</option>
                    <option value="gemini">Gemini</option>
                    <option value="kimi">Kimi</option>
                    <option value="openai">OpenAI</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="custom-openai">OpenAI 兼容网关</option>
                  </select>
                </label>
                <label className="field">
                  <span>Base URL</span>
                  <input
                    value={aiBaseUrlDraft}
                    placeholder="https://api.deepseek.com"
                    onChange={(event) => setAiBaseUrlDraft(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>模型名称</span>
                  <input value={aiModelDraft} placeholder="deepseek-chat" onChange={(event) => setAiModelDraft(event.target.value)} />
                </label>
                <label className="field wide">
                  <span>BAML Runtime URL</span>
                  <input
                    value={aiRuntimeUrlDraft}
                    placeholder="例如：https://ai-runtime.example.com"
                    onChange={(event) => setAiRuntimeUrlDraft(event.target.value)}
                  />
                </label>
                <label className="field wide">
                  <span>BAML Runtime 模型 Key</span>
                  <input
                    type="password"
                    value={aiApiKeyDraft}
                    placeholder={aiModelConfig?.hasApiKey ? `已保存：${aiModelConfig.apiKeyPreview ?? '已保存'}` : '可选，输入后加密保存'}
                    onChange={(event) => setAiApiKeyDraft(event.target.value)}
                  />
                </label>
              </div>
              <div className="settings-ai-routes">
                {aiRouteMeta.map((route) => {
                  const draft = aiRouteDrafts[route.key]
                  const saved = aiModelConfig?.[route.key]
                  const testResult = aiRouteTestResults[route.key]
                  return (
                    <article className="settings-ai-route-card" key={route.key}>
                      <div className="settings-ai-route-head">
                        <div>
                          <strong>{route.title}</strong>
                          <span>{route.description}</span>
                        </div>
                        <em className={saved?.hasApiKey ? 'ready' : ''}>
                          {saved?.hasApiKey ? (saved.keySource === 'environment' ? '环境 Key' : '已保存 Key') : '未配置 Key'}
                        </em>
                      </div>
                      <div className="form-grid settings-form settings-ai-route-form">
                        <label className="field">
                          <span>供应商</span>
                          <select value={draft.provider} onChange={(event) => updateAiRouteDraft(route.key, { provider: event.target.value as AiModelConfig['provider'] })}>
                            <option value="deepseek">DeepSeek</option>
                            <option value="gemini">Gemini</option>
                            <option value="kimi">Kimi</option>
                            <option value="openai">OpenAI</option>
                            <option value="openrouter">OpenRouter</option>
                            <option value="anthropic">Anthropic Claude</option>
                            <option value="custom-openai">OpenAI 兼容网关</option>
                          </select>
                        </label>
                        <label className="field">
                          <span>Base URL</span>
                          <input value={draft.baseUrl} onChange={(event) => updateAiRouteDraft(route.key, { baseUrl: event.target.value })} />
                        </label>
                        <label className="field">
                          <span>模型</span>
                          <input value={draft.model} onChange={(event) => updateAiRouteDraft(route.key, { model: event.target.value })} />
                        </label>
                        <label className="field">
                          <span>API Key</span>
                          <input
                            type="password"
                            value={aiRouteKeyDrafts[route.key] ?? ''}
                            placeholder={saved?.hasApiKey ? `已配置：${saved.apiKeyPreview ?? '已保存'}` : '输入后加密保存'}
                            onChange={(event) => setAiRouteKeyDrafts((current) => ({ ...current, [route.key]: event.target.value }))}
                          />
                        </label>
                      </div>
                      <div className="settings-ai-route-actions">
                        {testResult && <p className={testResult.ok ? 'settings-test-ok' : 'settings-inline-error'}>{testResult.message}</p>}
                        <div>
                          {saved?.keySource === 'setting' && (
                            <button className="ghost-button compact-button" type="button" onClick={() => void saveAiModelConfig(false, route.key)} disabled={isAiModelSaving}>
                              清除 Key
                            </button>
                          )}
                          <button className="ghost-button compact-button" type="button" onClick={() => void testAiRoute(route.key, route.capability)} disabled={testingAiRoute === route.key}>
                            {testingAiRoute === route.key ? '测试中…' : '测试'}
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
              <div className="settings-ai-meta">
                <p className="settings-tool-note">
                  {aiModelConfig?.encryptionReady
                    ? '设置页填写的 API Key 会加密保存在 D1；平台默认 Key 优先放在 Cloudflare Secret，前端只显示保存状态。'
                    : '生产环境还没有配置 AI_SETTINGS_SECRET，暂不能安全保存租户自带 API Key。'}
                </p>
                {aiModeDraft === 'baml-runtime' && !aiModelConfig?.runtimeConfigured && (
                  <p className="settings-inline-error">启用 BAML Runtime 前，需要配置 Runtime URL 或部署环境变量 AI_RUNTIME_URL。</p>
                )}
                <div className="settings-ai-actions">
                  {aiModelConfig?.hasApiKey && (
                    <button className="ghost-button compact-button" type="button" onClick={() => void saveAiModelConfig(true)} disabled={isAiModelSaving}>
                      清除 Key
                    </button>
                  )}
                  <button className="primary-button" type="button" onClick={() => void saveAiModelConfig()} disabled={isAiModelSaving || !aiModelDraft.trim()}>
                    <Sparkles size={17} />
                    {isAiModelSaving ? '保存中…' : '保存 AI 设置'}
                  </button>
                </div>
              </div>
            </section>
          )}
          {role === 'admin' && (
            <section className="panel settings-design-panel">
              <div className="panel-header compact">
                <div>
                  <h2>设计类型</h2>
                  <p>新建任务时使用二级选择器：大类 / 子类，管理员可自定义增删</p>
                </div>
              </div>
              <div className="design-type-create">
                <input
                  value={newGroupName}
                  placeholder="新增大类，例如：展会类"
                  onChange={(event) => setNewGroupName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      addDesignTypeGroup()
                    }
                  }}
                />
                <button className="primary-button" onClick={addDesignTypeGroup}>
                  <Plus size={17} />
                  添加大类
                </button>
              </div>
              <div className="design-type-groups">
                {designTypeGroups.map((group) => (
                  <div
                    className={`design-type-group-row ${draggingGroupName === group.name ? 'dragging' : ''}`}
                    key={group.name}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => moveDesignTypeGroup(group.name)}
                  >
                    <button
                      type="button"
                      className="design-type-drag-handle"
                      draggable
                      aria-label={`拖动排序 ${group.name}`}
                      onDragStart={() => setDraggingGroupName(group.name)}
                      onDragEnd={() => setDraggingGroupName('')}
                    >
                      <GripVertical size={18} />
                    </button>
                    <div className="design-type-group">
                      <div className="design-type-group-header">
                        <div className="design-type-group-title">
                          <button
                            type="button"
                            className="design-type-collapse-trigger"
                            aria-label={`${collapsedGroups[group.name] ? '展开' : '折叠'}设计类型大类 ${group.name}`}
                            onClick={() => setCollapsedGroups((current) => ({ ...current, [group.name]: !current[group.name] }))}
                          >
                            {collapsedGroups[group.name] ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                          </button>
                          <input
                            className="design-type-group-name-input"
                            aria-label={`设计类型大类名称：${group.name}`}
                            value={groupNameDrafts[group.name] ?? group.name}
                            onChange={(event) => setGroupNameDrafts((current) => ({ ...current, [group.name]: event.target.value }))}
                            onBlur={() => renameDesignTypeGroup(group.name)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.currentTarget.blur()
                              }
                              if (event.key === 'Escape') {
                                setGroupNameDrafts((current) => ({ ...current, [group.name]: group.name }))
                                event.currentTarget.blur()
                              }
                            }}
                          />
                          <small>{group.items.length} 个子类</small>
                        </div>
                        <div className="design-type-group-actions">
                          <button
                            className="icon-button danger-icon"
                            aria-label={`删除设计类型大类 ${group.name}`}
                            disabled={designTypeGroups.length <= 1}
                            onClick={() => requestDeleteDesignTypeGroup(group.name)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {!collapsedGroups[group.name] && (
                        <>
                          <div className="design-type-create nested">
                            <input
                              value={newGroupItems[group.name] ?? ''}
                              placeholder="新增子类，例如：邀请函长图"
                              onChange={(event) => setNewGroupItems((current) => ({ ...current, [group.name]: event.target.value }))}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  addDesignTypeItem(group.name)
                                }
                              }}
                            />
                            <button className="ghost-button compact-button" onClick={() => addDesignTypeItem(group.name)}>
                              <Plus size={15} />
                              添加
                            </button>
                          </div>
                          <div className="design-type-list">
                            {group.items.map((item) => (
                              <span
                                className={`design-type-chip ${draggingItem?.groupName === group.name && draggingItem.item === item ? 'dragging' : ''}`}
                                draggable
                                key={item}
                                onDragStart={() => setDraggingItem({ groupName: group.name, item })}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={() => moveDesignTypeItem(group.name, item)}
                                onDragEnd={() => setDraggingItem(null)}
                              >
                                {item}
                                <button aria-label={`删除设计类型 ${group.name} / ${item}`} onClick={() => requestDeleteDesignTypeItem(group.name, item)}>
                                  <Trash2 size={13} />
                                </button>
                              </span>
                            ))}
                            {group.items.length === 0 && <p className="calendar-empty-hint">这个大类还没有子类。</p>}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </details>

      <details className="settings-group-panel settings-security-group">
        <summary className="settings-group-summary">
          <div>
            <h2>权限安全</h2>
            <p>访问口令、账号状态和退出登录</p>
          </div>
          <ChevronDown size={18} />
        </summary>
        <div className="settings-group-body settings-security-body">
          {role === 'admin' && (
            <section className="settings-subsection settings-permission-panel">
              <div className="panel-header compact">
                <div>
                  <h2>口令管理</h2>
                  <p>生成或停用后台访问口令</p>
                </div>
              </div>
              <div className="token-create">
                <label className="field">
                  <span>备注</span>
                  <input value={tokenLabel} placeholder="例如：手机 / iPad / 协作设计师" onChange={(event) => setTokenLabel(event.target.value)} />
                </label>
                <label className="field">
                  <span>有效期</span>
                  <select value={tokenExpiry} onChange={(event) => setTokenExpiry(event.target.value)}>
                    <option value="permanent">永久有效</option>
                    <option value="7">7 天</option>
                    <option value="30">30 天</option>
                    <option value="90">90 天</option>
                  </select>
                </label>
                <button className="primary-button" onClick={handleCreate}>
                  <KeyRound size={17} />
                  申请口令
                </button>
              </div>
              <div className="token-list">
                {accessTokens.length === 0 && <p className="calendar-empty-hint">还没有生成过口令。</p>}
                {accessTokens.map((token) => {
                  const status = tokenStatus(token)
                  return (
                    <div className={`token-row ${token.id === newTokenId ? 'fresh' : ''}`} key={token.id}>
                      <div className="token-row-main">
                        <strong>{token.label}</strong>
                        <code>{token.token}</code>
                        <small>
                          创建于 {token.createdAt} · {token.expiresAt ? `${token.expiresAt} 到期` : '永久有效'}
                          {token.lastUsedAt ? ` · 最近使用 ${token.lastUsedAt}` : ' · 未使用过'}
                        </small>
                      </div>
                      <span className={`status-badge ${status.className}`}>{status.label}</span>
                      <div className="token-row-actions">
                        <button className="icon-button" aria-label="复制口令" onClick={() => onCopyToken(token.token)}>
                          <Copy size={15} />
                        </button>
                        <button
                          className="ghost-button compact-button"
                          onClick={() => onToggleToken(token.id, !token.disabled)}
                        >
                          {token.disabled ? '启用' : '停用'}
                        </button>
                        <button className="icon-button danger-icon" aria-label="删除口令" onClick={() => onDeleteToken(token.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
          <section className="settings-subsection settings-security-panel">
            <div className="panel-header compact">
              <div>
                <h2>账号安全</h2>
                <p>当前登录身份和退出操作</p>
              </div>
            </div>
            <p className="settings-tool-note">当前身份：{role === 'admin' ? '管理员（最高权限）' : '访问口令用户'}；公共电脑用完请退出。</p>
            {role === 'admin' && (
              <div className="password-change-form">
                <label className="field">
                  <span>当前密码</span>
                  <input
                    type="password"
                    value={currentPassword}
                    placeholder="输入当前密码"
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>新密码</span>
                  <input
                    type="password"
                    value={newPassword}
                    placeholder="至少 8 位"
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>确认新密码</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    placeholder="再次输入新密码"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </label>
                {passwordError && <p className="settings-inline-error">{passwordError}</p>}
                <button className="ghost-button" onClick={() => void submitPasswordChange()} disabled={!currentPassword || !newPassword || !confirmPassword || isPasswordSaving}>
                  <KeyRound size={16} />
                  {isPasswordSaving ? '保存中…' : '修改密码'}
                </button>
              </div>
            )}
            <button className="danger-button" onClick={onSignOut}>
              <LogOut size={17} />
              退出登录
            </button>
          </section>
        </div>
      </details>

      <details className="settings-group-panel settings-system-group">
        <summary className="settings-group-summary">
          <div>
            <h2>系统信息</h2>
            <p>备份、版本和 Cloudflare 资源</p>
          </div>
          <ChevronDown size={18} />
        </summary>
        <div className="settings-group-body settings-system-body">
          <section className="settings-subsection settings-backup-panel">
            <div className="panel-header compact">
              <div>
                <h2>数据备份</h2>
                <p>导出当前数据快照</p>
              </div>
            </div>
            <button className="ghost-button" onClick={onExportBackup}>
              <Download size={17} />
              导出备份 JSON
            </button>
          </section>
          <section className="settings-subsection settings-version-panel">
            <div className="panel-header compact">
              <div>
                <h2>产品版本</h2>
                <p>用于确认当前上线批次</p>
              </div>
            </div>
            <dl className="version-meta">
              <div>
                <dt>当前版本</dt>
                <dd>v{appVersion}</dd>
              </div>
              <div>
                <dt>发布时间</dt>
                <dd>{appReleaseDate}</dd>
              </div>
            </dl>
          </section>
          <section className="settings-subsection settings-cloudflare-panel cloudflare-details">
            <div className="panel-header compact">
              <div>
                <h2>系统资源</h2>
                <p>当前正式环境绑定信息</p>
              </div>
            </div>
            <div className="cloudflare-list">
              <span>Worker：designer-worklog（mayeai.com）</span>
              <span>D1：designer-worklog-db</span>
              <span>R2：designer-worklog-uploads · 18.6 GB</span>
              <span>登录体系：管理员邮箱 + 管理密码，或后台生成的访问口令</span>
            </div>
          </section>
        </div>
      </details>
      {settingsConfirmDialog && (
        <ConfirmDialogModal
          dialog={settingsConfirmDialog}
          isBusy={isSettingsConfirmDialogBusy}
          onClose={() => setSettingsConfirmDialog(null)}
          onConfirm={() => void handleSettingsConfirm()}
        />
      )}
    </section>
  )
}

function ConfirmDialogModal({
  dialog,
  isBusy,
  onClose,
  onConfirm,
}: {
  dialog: ConfirmDialogState
  isBusy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const isDanger = dialog.tone === 'danger'

  return (
    <ModalShell className={`delete-confirm-modal confirm-dialog-modal ${isDanger ? 'danger-confirm' : ''}`} labelledBy="confirm-dialog-title" onClose={onClose}>
      <div className="delete-confirm-icon">
        {isDanger ? <Trash2 size={24} /> : <CheckCircle2 size={24} />}
      </div>
      <div className="delete-confirm-copy">
        <p className="eyebrow">{dialog.eyebrow}</p>
        <h2 id="confirm-dialog-title">{dialog.title}</h2>
        <p>{dialog.body}</p>
      </div>
      {dialog.details && dialog.details.length > 0 && (
        <div className="delete-confirm-meta">
          {dialog.details.map((detail) => (
            <span key={detail}>{detail}</span>
          ))}
        </div>
      )}
      <div className="delete-confirm-actions">
        <button className="ghost-button" disabled={isBusy} onClick={onClose}>
          {dialog.cancelText ?? '取消'}
        </button>
        <button className={isDanger ? 'danger-button solid-danger-button' : 'primary-button'} disabled={isBusy} onClick={onConfirm}>
          {isBusy ? '处理中…' : dialog.confirmText}
        </button>
      </div>
    </ModalShell>
  )
}

function VoidTaskModal({
  task,
  isBusy,
  onClose,
  onConfirm,
}: {
  task: Task
  isBusy: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  const submit = () => {
    if (isBusy) {
      return
    }
    onConfirm(reason.trim())
  }

  return (
    <ModalShell className="delete-confirm-modal void-task-modal danger-confirm" labelledBy="void-task-title" onClose={onClose}>
      <div className="delete-confirm-icon">
        <Trash2 size={24} />
      </div>
      <div className="delete-confirm-copy">
        <p className="eyebrow">作废任务</p>
        <h2 id="void-task-title">确定作废「{task.title}」吗？</h2>
        <p>作废后，这个任务不会计入工时、收入和结算；管理员仍可在数据中保留记录，避免误删真实历史。</p>
      </div>
      <label className="void-reason-field">
        <span>作废原因（选填）</span>
        <textarea
          value={reason}
          autoFocus
          onChange={(event) => setReason(event.target.value)}
          placeholder="例如：测试任务、不计入工时、需求取消或录入错误。"
        />
      </label>
      <div className="delete-confirm-meta">
        <span>{task.type}</span>
        <span>{monthLabelOf(taskSettlementMonth(task))}</span>
      </div>
      <div className="delete-confirm-actions">
        <button className="ghost-button" disabled={isBusy} onClick={onClose}>
          取消
        </button>
        <button className="danger-button solid-danger-button" disabled={isBusy} onClick={submit}>
          {isBusy ? '处理中…' : '确认作废'}
        </button>
      </div>
    </ModalShell>
  )
}

function StatusReasonModal({
  target,
  onClose,
  onConfirm,
}: {
  target: NonNullable<StatusReasonTarget>
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const initialReason = target.status === '挂起' ? target.task.suspendReason ?? '' : target.task.terminateReason ?? ''
  const [reason, setReason] = useState(initialReason)
  const isSuspend = target.status === '挂起'
  const submit = () => {
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      return
    }
    onConfirm(trimmedReason)
  }

  return (
    <ModalShell className="delete-confirm-modal status-reason-modal danger-confirm" labelledBy="status-reason-title" onClose={onClose}>
      <div className="delete-confirm-icon">
        {isSuspend ? <Archive size={24} /> : <AlertTriangle size={24} />}
      </div>
      <div className="delete-confirm-copy">
        <p className="eyebrow">{target.status}</p>
        <h2 id="status-reason-title">
          {isSuspend ? '填写挂起原因' : '填写终止原因'}
        </h2>
        <p>{isSuspend ? '挂起任务会暂时从计费统计中排除，请记录等待什么条件恢复。' : '终止任务会从后续计费中排除，请记录取消或停止的原因。'}</p>
      </div>
      <label className="void-reason-field">
        <span>{isSuspend ? '挂起原因' : '终止原因'}</span>
        <textarea
          value={reason}
          autoFocus
          onChange={(event) => setReason(event.target.value)}
          placeholder={isSuspend ? '例如：等待甲方补充资料或确认方向。' : '例如：需求取消，本次不再继续制作。'}
        />
      </label>
      <div className="delete-confirm-meta">
        <span>{target.task.title}</span>
        <StatusBadge status={target.status} />
      </div>
      <div className="delete-confirm-actions">
        <button className="ghost-button" onClick={onClose}>
          取消
        </button>
        <button className="danger-button solid-danger-button" disabled={!reason.trim()} onClick={submit}>
          确认{target.status}
        </button>
      </div>
    </ModalShell>
  )
}

function ModalShell({
  className,
  labelledBy,
  onClose,
  closeOnBackdrop = false,
  closeOnEscape = false,
  children,
}: {
  className?: string
  labelledBy: string
  onClose: () => void
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  children: React.ReactNode
}) {
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [closeOnEscape, onClose])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section className={`task-modal ${className ?? ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </section>
    </div>
  )
}

function FilePreviewModal({ file, onClose }: { file: FileAsset; onClose: () => void }) {
  const fileType = file.type.toUpperCase()
  const sourceUrl = fileDocumentPreviewSource(file)
  const previewUrl = authedPreviewUrl(file.previewUrl ?? file.sourceUrl)
  const isImage = isInlineImageFileType(fileType)
  const isRasterPreview = Boolean(file.previewUrl) && ['PSD', 'AI'].includes(fileType)
  const isPdfLike = isInlineDocumentFileType(fileType)
  const isVideo = ['MP4', 'WEBM', 'MOV'].includes(fileType)
  const isOffice = isOfficeFileType(fileType)

  return (
    <ModalShell className="file-preview-modal" labelledBy="file-preview-title" onClose={onClose}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">文件预览</p>
            <h2 id="file-preview-title">{file.name}</h2>
          </div>
          <button className="icon-button modal-close-button" aria-label="关闭" title="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="file-preview-body">
          {(isImage || isRasterPreview) && previewUrl ? (
            <img src={previewUrl} alt={file.name} loading="lazy" />
          ) : isVideo && sourceUrl ? (
            <video className="file-preview-video" src={sourceUrl} controls preload="metadata" />
          ) : isPdfLike && sourceUrl ? (
            <iframe className="file-preview-frame" src={sourceUrl} title={file.name} />
          ) : isOffice && sourceUrl ? (
            <OfficePreview fileType={fileType} sourceUrl={sourceUrl} />
          ) : (
            <div className="file-preview-placeholder">
              {fileType === 'PDF' ? <FileText size={42} /> : <FileArchive size={42} />}
              <strong>{file.type}</strong>
              <span>该格式无法在浏览器中稳定直接预览，可以在新窗口打开源文件查看或下载。</span>
              {sourceUrl && (
                <a className="primary-button compact-button" href={sourceUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={15} />
                  打开源文件
                </a>
              )}
            </div>
          )}
        </div>
    </ModalShell>
  )
}

type SpreadsheetPreview = {
  name: string
  rows: string[][]
}[]

function OfficePreview({ fileType, sourceUrl }: { fileType: string; sourceUrl: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState('正在加载预览…')
  const [error, setError] = useState('')
  const [workbookPreview, setWorkbookPreview] = useState<SpreadsheetPreview>([])
  const isLegacyOffice = ['DOC', 'XLS', 'PPT'].includes(fileType)

  useEffect(() => {
    let cancelled = false

    const renderPreview = async () => {
      setError('')
      setStatus('正在加载预览…')
      setWorkbookPreview([])
      if (!containerRef.current) {
        return
      }
      containerRef.current.replaceChildren()

      if (isLegacyOffice) {
        setStatus('')
        setError('旧版 Office 二进制格式暂不支持稳定浏览器直读，请转为 DOCX / XLSX / PPTX 后可直接预览。')
        return
      }

      try {
        const response = await fetch(sourceUrl)
        if (!response.ok) {
          throw new Error('文件读取失败')
        }
        const buffer = await response.arrayBuffer()
        if (cancelled) {
          return
        }

        if (fileType === 'DOCX') {
          const { renderAsync } = await import('docx-preview')
          await renderAsync(buffer, containerRef.current, undefined, {
            className: 'docx-preview-document',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            breakPages: true,
            useBase64URL: true,
          })
          if (!cancelled) {
            setStatus('')
          }
          return
        }

        if (fileType === 'PPTX') {
          const { init } = await import('pptx-preview')
          const previewer = init(containerRef.current, { width: 960, height: 540 })
          await previewer.preview(buffer)
          if (!cancelled) {
            setStatus('')
          }
          return
        }

        if (fileType === 'XLSX') {
          const ExcelJS = await import('exceljs')
          const workbook = new ExcelJS.Workbook()
          await workbook.xlsx.load(buffer)
          const sheets = workbook.worksheets.slice(0, 5).map((sheet) => {
            const rows: string[][] = []
            sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
              if (rowNumber > 60) {
                return
              }
              const values = Array.isArray(row.values) ? row.values.slice(1, 16) : []
              rows.push(values.map(stringifyCellValue))
            })
            return { name: sheet.name, rows }
          })
          if (!cancelled) {
            setWorkbookPreview(sheets)
            setStatus('')
          }
          return
        }
      } catch (caughtError) {
        if (!cancelled) {
          setStatus('')
          setError(caughtError instanceof Error ? caughtError.message : '预览失败，请打开源文件查看。')
        }
      }
    }

    void renderPreview()

    return () => {
      cancelled = true
    }
  }, [fileType, isLegacyOffice, sourceUrl])

  return (
    <div className={`office-preview office-preview-${fileType.toLowerCase()}`}>
      {status && <div className="office-preview-status">{status}</div>}
      {error && (
        <div className="file-preview-placeholder">
          <FileText size={42} />
          <strong>{fileType}</strong>
          <span>{error}</span>
          <a className="primary-button compact-button" href={sourceUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={15} />
            打开源文件
          </a>
        </div>
      )}
      {fileType === 'XLSX' && workbookPreview.length > 0 && (
        <div className="spreadsheet-preview">
          {workbookPreview.map((sheet) => (
            <section key={sheet.name}>
              <h3>{sheet.name}</h3>
              <div className="spreadsheet-table-wrap">
                <table>
                  <tbody>
                    {sheet.rows.map((row, rowIndex) => (
                      <tr key={`${sheet.name}-${rowIndex}`}>
                        {row.map((cell, cellIndex) => (
                          <td key={`${sheet.name}-${rowIndex}-${cellIndex}`}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
      <div ref={containerRef} className="office-render-root" />
    </div>
  )
}

type NewTaskDraftCache = {
  title: string
  requirement: string
  type: string
  startDate: string
  estimatedMinutes: number
  estimatedDate: string
  scheduleAnchor: ScheduleAnchor
  isSupplemental: boolean
  settlementMonth: string
  requester: string
  contact: string
  supplementalNote: string
}

const newTaskDraftStorageKey = 'giverny:new-task-draft:v1'

const readNewTaskDraftCache = (fallbackStartDate: string, fallbackType: string, fallbackSettlementMonth = monthPart(fallbackStartDate)): NewTaskDraftCache => {
  const fallbackMinutes = 120
  const fallbackDraft: NewTaskDraftCache = {
    title: '',
    requirement: '',
    type: fallbackType,
    startDate: fallbackStartDate,
    estimatedMinutes: fallbackMinutes,
    estimatedDate: addMinutesToPlanDateTime(fallbackStartDate, fallbackMinutes),
    scheduleAnchor: 'start',
    isSupplemental: false,
    settlementMonth: fallbackSettlementMonth,
    requester: '',
    contact: '黄媚',
    supplementalNote: '',
  }
  if (typeof window === 'undefined') {
    return fallbackDraft
  }
  try {
    const raw = window.localStorage.getItem(newTaskDraftStorageKey)
    if (!raw) {
      return fallbackDraft
    }
    const parsed = JSON.parse(raw) as Partial<NewTaskDraftCache>
    const startDate = parsed.startDate || fallbackDraft.startDate
    const estimatedMinutes = Number.isFinite(parsed.estimatedMinutes) && Number(parsed.estimatedMinutes) > 0 ? Number(parsed.estimatedMinutes) : fallbackMinutes
    return {
      title: parsed.title ?? '',
      requirement: parsed.requirement ?? '',
      type: parsed.type || fallbackType,
      startDate,
      estimatedMinutes,
      estimatedDate: parsed.estimatedDate || addMinutesToPlanDateTime(startDate, estimatedMinutes),
      scheduleAnchor: parsed.scheduleAnchor === 'end' ? 'end' : 'start',
      isSupplemental: Boolean(parsed.isSupplemental),
      settlementMonth: parsed.settlementMonth || fallbackSettlementMonth,
      requester: parsed.requester ?? '',
      contact: parsed.contact || '黄媚',
      supplementalNote: parsed.supplementalNote ?? '',
    }
  } catch {
    return fallbackDraft
  }
}

const writeNewTaskDraftCache = (draft: NewTaskDraftCache) => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(newTaskDraftStorageKey, JSON.stringify(draft))
}

const clearNewTaskDraftCache = () => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(newTaskDraftStorageKey)
}

function NewTaskModal({
  designTypeGroups,
  currentMonthValue,
  onClose,
  onCreate,
  onDesignTypeGroupsChange,
}: {
  designTypeGroups: DesignTypeGroup[]
  currentMonthValue: string
  onClose: () => void
  onCreate: (task: Task) => void
  onDesignTypeGroupsChange: (nextGroups: DesignTypeGroup[]) => void | Promise<void>
}) {
  const availableDesignTypeGroups = normalizeDesignTypeGroups(designTypeGroups)
  const fallbackType = flattenDesignTypeGroups(availableDesignTypeGroups)[0] ?? defaultDesignTypes[0]
  const defaultStartDateTime = useMemo(() => isoDateTime(), [])
  const initialDraft = useMemo(() => readNewTaskDraftCache(defaultStartDateTime, fallbackType, currentMonthValue), [currentMonthValue, defaultStartDateTime, fallbackType])
  const [title, setTitle] = useState(initialDraft.title)
  const [requirement, setRequirement] = useState(initialDraft.requirement)
  const [type, setType] = useState(initialDraft.type)
  const [startDate, setStartDate] = useState(initialDraft.startDate)
  const [estimatedMinutes, setEstimatedMinutes] = useState(initialDraft.estimatedMinutes)
  const [estimatedDate, setEstimatedDate] = useState(initialDraft.estimatedDate)
  const [scheduleAnchor, setScheduleAnchor] = useState<ScheduleAnchor>(initialDraft.scheduleAnchor)
  const [isSupplemental, setIsSupplemental] = useState(initialDraft.isSupplemental)
  const [settlementMonth, setSettlementMonth] = useState(initialDraft.settlementMonth)
  const [requester, setRequester] = useState(initialDraft.requester)
  const [contact, setContact] = useState(initialDraft.contact)
  const [supplementalNote, setSupplementalNote] = useState(initialDraft.supplementalNote)
  const [aiSuggestion, setAiSuggestion] = useState<TaskAssistantSuggestion | null>(null)
  const [aiError, setAiError] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [hourSuggestion, setHourSuggestion] = useState<HourEstimateSuggestion | null>(null)
  const [hourSuggestionError, setHourSuggestionError] = useState('')
  const [isHourSuggestionLoading, setIsHourSuggestionLoading] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const supplementalMonthOptions = useMemo(() => monthSelectOptions(currentMonthValue, settlementMonth), [currentMonthValue, settlementMonth])

  useEffect(() => {
    writeNewTaskDraftCache({
      title,
      requirement,
      type,
      startDate,
      estimatedMinutes,
      estimatedDate,
      scheduleAnchor,
      isSupplemental,
      settlementMonth,
      requester,
      contact,
      supplementalNote,
    })
  }, [contact, estimatedDate, estimatedMinutes, isSupplemental, requirement, requester, scheduleAnchor, settlementMonth, startDate, supplementalNote, title, type])

  const updateStartDate = (value: string) => {
    setScheduleAnchor('start')
    setStartDate(value)
    setEstimatedDate(addMinutesToPlanDateTime(value, estimatedMinutes))
  }

  const updateEstimatedDate = (value: string) => {
    setScheduleAnchor('end')
    setEstimatedDate(value)
    setStartDate(addMinutesToPlanDateTime(value, -estimatedMinutes))
  }

  const updateEstimatedMinutes = (value: number) => {
    setEstimatedMinutes(value)
    if (scheduleAnchor === 'end') {
      setStartDate(addMinutesToPlanDateTime(estimatedDate, -value))
      return
    }
    setEstimatedDate(addMinutesToPlanDateTime(startDate, value))
  }

  const clearFieldError = (field: string) => {
    setFormErrors((current) => {
      if (!current[field]) {
        return current
      }
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!type.trim()) {
      nextErrors.type = '请选择设计类型'
    }
    if (!title.trim()) {
      nextErrors.title = '请填写任务名称'
    }
    if (!requirement.trim()) {
      nextErrors.requirement = '请填写任务具体需求'
    }
    if (!contact.trim()) {
      nextErrors.contact = '请填写对接人'
    }
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }
    const estimated = Math.round((estimatedMinutes / 60) * 100) / 100
    const status: TaskStatus = '计划中'

    onCreate({
      id: Date.now(),
      date: startDate,
      estimatedDate,
      settlementMonth: isSupplemental ? settlementMonth : '',
      type: type.trim(),
      title: title.trim(),
      requirement: requirement.trim(),
      requester: requester.trim(),
      contact: contact.trim(),
      reviewer: requester.trim() || '待确认',
      stage: status,
      estimatedHours: estimated,
      actualHours: 0,
      status,
      progress: 0,
      acceptanceNote: isSupplemental ? supplementalNote.trim() : '',
      files: [],
    })
  }

  const toggleSupplemental = () => {
    const next = !isSupplemental
    setIsSupplemental(next)
    if (next && !settlementMonth) {
      setSettlementMonth(currentMonthValue)
    }
    if (!next) {
      setSupplementalNote('')
    }
  }

  const requestAiSuggestion = async () => {
    setAiError('')
    setAiSuggestion(null)
    setIsAiLoading(true)
    try {
      const suggestion = await api.suggestTaskAssistant({
        title,
        requirement,
        selectedType: type,
        designTypeGroups: availableDesignTypeGroups,
      })
      setAiSuggestion(suggestion)
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI 助手暂时不可用')
    } finally {
      setIsAiLoading(false)
    }
  }

  const applyAiSuggestion = () => {
    if (!aiSuggestion) {
      return
    }
    setRequirement(aiSuggestion.optimizedRequirement)
    if (aiSuggestion.categoryExists) {
      setType(aiSuggestion.suggestedType)
    }
  }

  const addSuggestedCategoryAndApply = async () => {
    if (!aiSuggestion) {
      return
    }
    const parent = aiSuggestion.suggestedParentType.trim()
    const child = aiSuggestion.suggestedChildType.trim()
    if (!parent || !child) {
      return
    }
    const nextGroups = [...availableDesignTypeGroups]
    const index = nextGroups.findIndex((group) => group.name === parent)
    if (index >= 0) {
      const current = nextGroups[index]
      nextGroups[index] = { ...current, items: current.items.includes(child) ? current.items : [...current.items, child] }
    } else {
      nextGroups.push({ name: parent, items: [child] })
    }
    await onDesignTypeGroupsChange(nextGroups)
    setType(`${parent} / ${child}`)
    setRequirement(aiSuggestion.optimizedRequirement)
    setAiSuggestion({ ...aiSuggestion, categoryExists: true, missingCategory: undefined })
  }

  const requestHourSuggestion = async () => {
    setHourSuggestionError('')
    setHourSuggestion(null)
    setIsHourSuggestionLoading(true)
    try {
      const suggestion = await api.suggestHourEstimate({
        title,
        requirement,
        selectedType: type,
        startDate,
        estimatedDate,
      })
      setHourSuggestion(suggestion)
    } catch (error) {
      setHourSuggestionError(error instanceof Error ? error.message : 'AI 工时建议暂时不可用')
    } finally {
      setIsHourSuggestionLoading(false)
    }
  }

  const applyHourSuggestion = () => {
    if (!hourSuggestion) {
      return
    }
    updateEstimatedMinutes(Math.max(30, Math.round(hourSuggestion.suggestedHours * 60)))
  }

  return (
    <ModalShell className="new-task-modal" labelledBy="new-task-title" onClose={onClose} closeOnBackdrop={false} closeOnEscape={false}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">任务管理</p>
            <h2 id="new-task-title">新建设计任务</h2>
          </div>
          <div className="modal-header-actions">
            <div className="supplemental-switch-wrap">
              <span className="supplemental-label">补录</span>
              <button
                type="button"
                className={`switch-control ${isSupplemental ? 'active' : ''}`}
                aria-label="补录任务"
                aria-pressed={isSupplemental}
                title={isSupplemental ? `补录至 ${monthLabelOf(settlementMonth)}` : '标记为补录任务'}
                onClick={toggleSupplemental}
              >
                <i />
              </button>
              {isSupplemental && (
                <label className="supplemental-month-select">
                  <span>计入月份</span>
                  <select value={settlementMonth} onChange={(event) => setSettlementMonth(event.target.value)} aria-label="计入结算月份">
                    {supplementalMonthOptions.map((monthValue) => (
                      <option key={monthValue} value={monthValue}>
                        {monthLabelOf(monthValue)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <button className="icon-button modal-close-button" aria-label="关闭" title="关闭" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="form-grid new-task-form">
          <label className={`field wide new-task-type-field ${formErrors.type ? 'field-invalid' : ''}`}>
            <span>设计类型 <em className="required-mark" aria-label="必填">*</em></span>
            <CascadingDesignTypePicker groups={availableDesignTypeGroups} value={type} onChange={(value) => { setType(value); clearFieldError('type') }} />
            {formErrors.type && <small className="field-error">{formErrors.type}</small>}
          </label>
          <label className={`field wide ${formErrors.title ? 'field-invalid' : ''}`}>
            <span>项目 / 任务名称 <em className="required-mark" aria-label="必填">*</em></span>
            <input value={title} onChange={(event) => { setTitle(event.target.value); clearFieldError('title') }} placeholder="例如：金博会邀请函长图设计" aria-required="true" />
            {formErrors.title && <small className="field-error">{formErrors.title}</small>}
          </label>
          <div className={`field wide ${formErrors.requirement ? 'field-invalid' : ''}`}>
            <span className="field-label-row">
              <span>任务具体需求 <em className="required-mark" aria-label="必填">*</em></span>
              <button
                type="button"
                className="icon-button ai-assist-button"
                aria-label="AI 优化任务需求"
                title="AI 优化任务需求"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void requestAiSuggestion()
                }}
                disabled={isAiLoading || (!title.trim() && !requirement.trim())}
              >
                <Sparkles size={16} />
              </button>
            </span>
            <textarea
              aria-label="任务具体需求"
              value={requirement}
              onChange={(event) => { setRequirement(event.target.value); clearFieldError('requirement') }}
              placeholder="记录甲方需求、修改范围、交付规格等"
              aria-required="true"
            />
            {formErrors.requirement && <small className="field-error">{formErrors.requirement}</small>}
          </div>
          {(aiSuggestion || aiError || isAiLoading) && (
            <div className="ai-suggestion-panel wide">
              <div className="ai-suggestion-head">
                <span>{isAiLoading ? 'AI 正在整理需求' : 'AI 建议'}</span>
                {aiSuggestion && <em>{aiSuggestion.suggestedType}</em>}
              </div>
              {isAiLoading && <p>正在优化文案并匹配设计类型...</p>}
              {aiError && <p className="ai-suggestion-error">{aiError}</p>}
              {aiSuggestion && (
                <>
                  <div className="ai-suggestion-body">
                    {aiSuggestion.optimizedRequirement.split('\n').map((line, index) => {
                      const trimmed = line.trim()
                      if (!trimmed) {
                        return null
                      }
                      const isHeading = /^【.+】/.test(trimmed)
                      const isItem = trimmed.startsWith('·') || trimmed.startsWith('•')
                      if (isHeading) {
                        return <strong className="ai-suggestion-heading" key={index}>{trimmed}</strong>
                      }
                      if (isItem) {
                        return <span className="ai-suggestion-item" key={index}>{trimmed}</span>
                      }
                      return <span className="ai-suggestion-line" key={index}>{trimmed}</span>
                    })}
                  </div>
                  {aiSuggestion.reason && <small>{aiSuggestion.reason}</small>}
                  <div className="ai-suggestion-actions">
                    <button type="button" className="ghost-button compact-button" onClick={applyAiSuggestion}>
                      采用文案{aiSuggestion.categoryExists ? '和分类' : ''}
                    </button>
                    {!aiSuggestion.categoryExists && (
                      <button type="button" className="primary-button compact-button" onClick={() => void addSuggestedCategoryAndApply()}>
                        新增分类并采用
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <label className="field">
            <span>需求人</span>
            <input value={requester} onChange={(event) => setRequester(event.target.value)} placeholder="提出需求的人" />
          </label>
          <label className={`field ${formErrors.contact ? 'field-invalid' : ''}`}>
            <span>对接人 <em className="required-mark" aria-label="必填">*</em></span>
            <input value={contact} onChange={(event) => { setContact(event.target.value); clearFieldError('contact') }} placeholder="黄媚" aria-required="true" />
            {formErrors.contact && <small className="field-error">{formErrors.contact}</small>}
          </label>
          <div className="new-task-schedule-row">
            <PlanDateTimeField
              key={`start-${startDate}`}
              label="预计开始时间"
              value={startDate}
              onChange={updateStartDate}
              isActive={scheduleAnchor === 'start'}
              readOnly={scheduleAnchor !== 'start'}
              control={<ScheduleAnchorSwitch active={scheduleAnchor === 'start'} label="用预计开始时间推算交付时间" onClick={() => setScheduleAnchor('start')} />}
            />
            <label className="field">
              <span>预估工时</span>
              <DurationPicker valueMinutes={estimatedMinutes} onChange={updateEstimatedMinutes} />
            </label>
            <PlanDateTimeField
              key={`end-${estimatedDate}`}
              label="预计交付时间"
              value={estimatedDate}
              onChange={updateEstimatedDate}
              isActive={scheduleAnchor === 'end'}
              readOnly={scheduleAnchor !== 'end'}
              control={<ScheduleAnchorSwitch active={scheduleAnchor === 'end'} label="用预计交付时间倒推开始时间" onClick={() => setScheduleAnchor('end')} />}
            />
          </div>
          <div className="hour-estimate-panel wide">
            <div className="hour-estimate-head">
              <div>
                <strong>工时建议</strong>
                <span>基于同类型历史任务、实际工时和验收备注分析</span>
              </div>
              <button
                type="button"
                className="ghost-button compact-button"
                onClick={() => void requestHourSuggestion()}
                disabled={isHourSuggestionLoading || (!type.trim() && !title.trim() && !requirement.trim())}
              >
                <Sparkles size={14} />
                {isHourSuggestionLoading ? '分析中' : 'AI 分析'}
              </button>
            </div>
            {isHourSuggestionLoading && <p>正在读取历史任务并生成工时建议...</p>}
            {hourSuggestionError && <p className="ai-suggestion-error">{hourSuggestionError}</p>}
            {!isHourSuggestionLoading && !hourSuggestion && !hourSuggestionError && (
              <p>填写任务类型和需求后，可以让 AI 参考过往同类任务，给出更稳的预估工时。</p>
            )}
            {hourSuggestion && (
              <div className="hour-estimate-result">
                <div className="hour-estimate-main">
                  <span>建议预估</span>
                  <strong>{hourSuggestion.suggestedHours.toFixed(1)} h</strong>
                  <em className={`hour-confidence confidence-${hourSuggestion.confidence}`}>{hourSuggestion.confidence}置信度</em>
                </div>
                <div className="hour-estimate-stats">
                  <span>{hourSuggestion.sampleCount} 条样本</span>
                  <span>平均 {hourSuggestion.averageHours.toFixed(1)} h</span>
                  <span>中位 {hourSuggestion.medianHours.toFixed(1)} h</span>
                  {hourSuggestion.averageDeliveryDays > 0 && <span>平均周期 {hourSuggestion.averageDeliveryDays.toFixed(1)} 天</span>}
                </div>
                <p>{hourSuggestion.historicalSummary}</p>
                {hourSuggestion.basis.length > 0 && (
                  <ul>
                    {hourSuggestion.basis.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                )}
                <div className="hour-estimate-actions">
                  {hourSuggestion.usedFallback && <small>同类型样本不足，已参考相近类型任务。</small>}
                  <button type="button" className="primary-button compact-button" onClick={applyHourSuggestion}>
                    采用建议
                  </button>
                </div>
              </div>
            )}
          </div>
          {isSupplemental && (
            <label className="field wide">
              <span>补录说明</span>
              <textarea
                value={supplementalNote}
                onChange={(event) => setSupplementalNote(event.target.value)}
                placeholder="例如：该任务已于 5 月完成，本次补录到 6 月结算单。验收、实际工时和交付文件请在任务详情中确认。"
              />
            </label>
          )}
        </div>

        <footer className="modal-footer">
          <button className="primary-button" onClick={handleSubmit}>
            <Plus size={18} />
            创建任务
          </button>
        </footer>
    </ModalShell>
  )
}

export default App
