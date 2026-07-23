import { Fragment, useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { ModalShell } from '../components/ModalShell'
import { api, type HourEstimateMetrics, type ReportRecord } from '../lib/api'
import { datePart, formatMonthDay, formatMonthDayTime, isoDate, isoDateFromLocalDate, localDateFromIsoDate } from '../lib/dateTime'
import { formatYuan } from '../lib/money'
import { fileTypeForAsset, isInlineDocumentFileType, isInlineImageFileType, isOfficeFileType } from '../lib/fileTypes'
import { dateTimeMinuteStamp, isTaskBillable, sumWaitingEntries, taskLifecycleDate } from '../lib/taskAccounting'
import { isTaskStarted } from '../lib/taskProgress'
import type { AttachmentAnalysis, InsightHistoryItem, InsightPeriodType, Task, TaskFeedbackTag, TaskUpdate, TimeEntry, FileAsset } from '../types/domain'

type InsightPeriod = InsightPeriodType
type DonutItem = { label: string; value: number; color: string }

const insightPeriods: { value: InsightPeriod; label: string }[] = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'quarter', label: '季度' },
  { value: 'half', label: '半年' },
  { value: 'year', label: '年度' },
]

function toDateTimeInputValue(value: string) {
  if (!value) return ''
  return value.includes('T') ? value.slice(0, 16) : `${datePart(value)}T09:00`
}

function formatPlanDateTime(value: string) {
  if (!value) return ''
  const date = datePart(value).replaceAll('-', '/')
  return value.includes('T') ? `${date} ${value.slice(11, 16)}` : date
}

function formatTimePart(value: string) {
  const match = value.match(/(?:T|\\s)(\\d{2}:\\d{2})/)
  return match?.[1] ?? ''
}

function dateFromValue(value: string | undefined) {
  if (!value) return null
  const date = new Date(toDateTimeInputValue(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function isDateInRange(value: string | undefined, range: { start: Date; end: Date }) {
  const date = dateFromValue(value)
  return Boolean(date && date >= range.start && date <= range.end)
}

function isTaskInAnalysisRange(task: Task, range: { start: Date; end: Date }) {
  if (!isTaskStarted(task)) return false
  const lifecycleDate = taskLifecycleDate(task)
  return isDateInRange(lifecycleDate, range) || isDateInRange(task.date, range) || isDateInRange(task.estimatedDate, range)
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
  const type = fileTypeForAsset(file).type
  return Boolean(file.previewUrl) || isInlineImageFileType(type) || isInlineDocumentFileType(type) || isOfficeFileType(type)
}

function clockMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : Number.NaN
}

function lateNightScore(clock: string) {
  const minutes = clockMinutes(clock)
  if (!Number.isFinite(minutes)) return Number.NaN
  return minutes < 6 * 60 ? minutes + 24 * 60 : minutes
}

const hourOutcomeCorrectionReasons = ['需求中途追加', '改稿轮次增加', '素材延迟或缺失', '多尺寸 / 多版本', '专项制作增加', '沟通等待', '个人效率变化', '参考样本不准确']

function HourCalibrationTable({ title, rows }: { title: string; rows: HourEstimateMetrics['byType'] }) {
  return (
    <section className="hour-calibration-table">
      <h4>{title}</h4>
      {rows.length === 0 ? (
        <p>暂无可校准样本</p>
      ) : (
        <div className="hour-calibration-rows">
          <div className="hour-calibration-row header" aria-hidden="true">
            <span>对象</span><span>样本</span><span>命中</span><span>系数</span>
          </div>
          {rows.slice(0, 8).map((row) => (
            <div className="hour-calibration-row" key={row.name}>
              <span title={row.name}>{row.name}</span>
              <span>{row.samples}</span>
              <span>{row.within20Rate}%</span>
              <strong className={row.samples >= 3 ? '' : 'muted'}>{row.samples >= 3 ? row.calibrationRatio.toFixed(2) : '待积累'}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function InsightsView({
  tasks,
  updates,
  files,
  attachmentAnalyses,
  reports,
  currentMonth,
  hourlyRate,
  donutPalette,
}: {
  tasks: Task[]
  updates: TaskUpdate[]
  files: FileAsset[]
  attachmentAnalyses: AttachmentAnalysis[]
  reports: ReportRecord[]
  currentMonth: { label: string; value: string }
  hourlyRate: number
  donutPalette: string[]
}) {
  const [period, setPeriod] = useState<InsightPeriod>('month')
  const [insightHistory, setInsightHistory] = useState<InsightHistoryItem[]>([])
  const [historyError, setHistoryError] = useState('')
  const [hourMetrics, setHourMetrics] = useState<HourEstimateMetrics | null>(null)
  const [hourMetricsFailure, setHourMetricsFailure] = useState<{ month: string; message: string } | null>(null)
  const [hourCorrectionTarget, setHourCorrectionTarget] = useState<HourEstimateMetrics['recent'][number] | null>(null)
  const [hourCorrectionFactors, setHourCorrectionFactors] = useState<string[]>([])
  const [hourCorrectionNote, setHourCorrectionNote] = useState('')
  const [hourCorrectionSaving, setHourCorrectionSaving] = useState(false)
  const [hourCorrectionError, setHourCorrectionError] = useState('')
  const [hourQuoteTarget, setHourQuoteTarget] = useState<HourEstimateMetrics['recent'][number] | null>(null)
  const [hourQuotedAmount, setHourQuotedAmount] = useState('')
  const [hourSettledAmount, setHourSettledAmount] = useState('')
  const [hourQuoteStatus, setHourQuoteStatus] = useState('pending')
  const [hourQuoteNote, setHourQuoteNote] = useState('')
  const [hourQuoteSaving, setHourQuoteSaving] = useState(false)
  const [hourQuoteError, setHourQuoteError] = useState('')
  const [hourSampleQualitySaving, setHourSampleQualitySaving] = useState<number | null>(null)
  const [hourSampleQualityError, setHourSampleQualityError] = useState('')
  const [activeInsightKey, setActiveInsightKey] = useState<string>('rv:month')
  const range = useMemo(() => insightPeriodRange(period, currentMonth.value), [currentMonth.value, period])
  const rangeLabel = formatInsightRange(range)
  const hourMetricsError = hourMetricsFailure?.month === currentMonth.value ? hourMetricsFailure.message : ''
  const hourMetricsLoading = !hourMetricsError && hourMetrics?.month !== currentMonth.value

  const openHourCorrection = (item: HourEstimateMetrics['recent'][number]) => {
    setHourCorrectionTarget(item)
    setHourCorrectionFactors(item.correction?.factors ?? item.factors)
    setHourCorrectionNote(item.correction?.note ?? '')
    setHourCorrectionError('')
  }

  const saveHourCorrection = async () => {
    if (!hourCorrectionTarget || hourCorrectionSaving) return
    setHourCorrectionSaving(true)
    setHourCorrectionError('')
    try {
      const correction = await api.correctHourEstimateOutcome({
        taskId: hourCorrectionTarget.taskId,
        factors: hourCorrectionFactors,
        note: hourCorrectionNote,
      })
      setHourMetrics((current) => current ? {
        ...current,
        recent: current.recent.map((item) => item.taskId === correction.taskId
          ? { ...item, factors: correction.factors, correction }
          : item),
      } : current)
      setHourCorrectionTarget(null)
    } catch (error) {
      setHourCorrectionError(error instanceof Error ? error.message : '偏差原因保存失败')
    } finally {
      setHourCorrectionSaving(false)
    }
  }

  const openHourQuote = (item: HourEstimateMetrics['recent'][number]) => {
    setHourQuoteTarget(item)
    setHourQuotedAmount(item.quoteOutcome?.quotedAmount ? String(item.quoteOutcome.quotedAmount) : '')
    setHourSettledAmount(item.quoteOutcome?.settledAmount ? String(item.quoteOutcome.settledAmount) : '')
    setHourQuoteStatus(item.quoteOutcome?.status ?? 'pending')
    setHourQuoteNote(item.quoteOutcome?.note ?? '')
    setHourQuoteError('')
  }

  const saveHourQuote = async () => {
    if (!hourQuoteTarget || hourQuoteSaving) return
    setHourQuoteSaving(true)
    setHourQuoteError('')
    try {
      const quoteOutcome = await api.recordHourEstimateQuoteOutcome({
        taskId: hourQuoteTarget.taskId,
        quotedAmount: Number(hourQuotedAmount),
        settledAmount: Number(hourSettledAmount),
        status: hourQuoteStatus,
        note: hourQuoteNote,
      })
      setHourMetrics((current) => current ? {
        ...current,
        recent: current.recent.map((item) => item.taskId === quoteOutcome.taskId ? { ...item, quoteOutcome } : item),
      } : current)
      setHourMetrics(await api.getHourEstimateMetrics(currentMonth.value))
      setHourQuoteTarget(null)
    } catch (error) {
      setHourQuoteError(error instanceof Error ? error.message : '报价结果保存失败')
    } finally {
      setHourQuoteSaving(false)
    }
  }

  const toggleHourSampleQuality = async (item: HourEstimateMetrics['sampleQuality'][number]) => {
    if (hourSampleQualitySaving !== null) return
    setHourSampleQualitySaving(item.taskId)
    setHourSampleQualityError('')
    try {
      const result = await api.setHourEstimateSampleQuality({
        taskId: item.taskId,
        excluded: !item.excluded,
        reason: item.excluded ? '恢复为可用历史样本' : item.issues.join('、') || '管理员判断该样本不适合作为预测依据',
      })
      setHourMetrics((current) => current ? {
        ...current,
        sampleQuality: current.sampleQuality.map((sample) => sample.taskId === result.taskId
          ? { ...sample, excluded: result.excluded, reason: result.reason }
          : sample),
      } : current)
      setHourMetrics(await api.getHourEstimateMetrics(currentMonth.value))
    } catch (error) {
      setHourSampleQualityError(error instanceof Error ? error.message : '样本质量状态保存失败')
    } finally {
      setHourSampleQualitySaving(null)
    }
  }

  useEffect(() => {
    let active = true
    api.getHourEstimateMetrics(currentMonth.value)
      .then((result) => {
        if (active) {
          setHourMetrics(result)
          setHourMetricsFailure(null)
        }
      })
      .catch((error) => {
        if (active) setHourMetricsFailure({
          month: currentMonth.value,
          message: error instanceof Error ? error.message : 'AI 工时学习数据读取失败',
        })
      })
    return () => {
      active = false
    }
  }, [currentMonth.value])

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
  const billableTasks = periodTasks.filter((task) => isTaskBillable(task))
  const totalHours = Number(billableTasks.reduce((sum, task) => sum + task.actualHours, 0).toFixed(1))
  const estimatedHours = Number(billableTasks.reduce((sum, task) => sum + task.estimatedHours, 0).toFixed(1))
  const acceptedRate = periodTasks.length > 0 ? Math.round((acceptedTasks.length / periodTasks.length) * 100) : 0
  const visualReadyCount = periodFiles.filter(isVisualReviewReady).length
  const lockedReports = reports.filter((report) => {
    const reportDate = dateFromValue(`${report.month}-01`)
    return reportDate ? reportDate >= range.start && reportDate <= range.end : false
  }).length

  const hoursByType = new Map<string, number>()
  billableTasks.forEach((task) => {
    if (task.actualHours <= 0) {
      return
    }
    hoursByType.set(task.type, Number(((hoursByType.get(task.type) ?? 0) + task.actualHours).toFixed(1)))
  })
  const typeDistributionItems: DonutItem[] = [...hoursByType.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], index) => ({ label, value, color: donutPalette[index % donutPalette.length] }))
  const typeDistribution = { items: typeDistributionItems, total: Number(typeDistributionItems.reduce((sum, item) => sum + item.value, 0).toFixed(1)) }

  const waitingMinutes = periodTasks.reduce((sum, task) => sum + sumWaitingEntries(task), 0)
  const waitingHours = Number((waitingMinutes / 60).toFixed(1))
  const leadingType = typeDistribution.items[0]
  const selectedInsightKind = activeInsightKey.split(':')[0]
  const selectedInsightValue = activeInsightKey.split(':')[1]
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
  const periodReviewData = [
    ['周期范围', rangeLabel],
    ['计费工时', `${totalHours.toFixed(1)}h`],
    ['任务数', `${periodTasks.length} 个`],
    ['验收率', `${acceptedRate}%`],
    ['等待合计', `${waitingHours.toFixed(1)}h`],
    ['综合时薪', `¥${hourlyRate}/h`],
  ]
  const periodReviewDiagnostics = [
    estimatedHours > 0
      ? `预估 ${estimatedHours.toFixed(1)}h → 实际 ${totalHours.toFixed(1)}h，偏差 ${Math.round(((totalHours - estimatedHours) / estimatedHours) * 100)}%`
      : '暂无预估工时基线，后续可通过任务排期建立对照',
    leadingType ? `${leadingType.label} 是本周期主要工时类型，占 ${Math.round((leadingType.value / Math.max(typeDistribution.total, 1)) * 100)}%` : '暂无可形成类型结构的工时',
    riskRows.length > 0 ? `发现 ${riskRows.length} 个需要复核的链路信号` : '当前未发现明显逾期、超时或附件缺口',
  ]
  const periodReviewAdvice = [
    riskRows.length > 0 ? '优先处理异常任务，再锁定结算与验收附件' : '保持当前记录节奏，继续要求验收时留存确认凭证',
    waitingHours > 0 ? '把等待原因写入等待记录，避免复盘时误判为设计耗时' : '等待记录较少，可继续用分段计时沉淀真实工作链路',
    leadingType ? `沉淀「${leadingType.label}」的交付模板和报价基线` : '先积累 3 条以上同类任务后再判断报价结构',
  ]
  const summaryReportStats = [
    ['任务', `${periodTasks.length} 个`],
    ['计费工时', `${totalHours.toFixed(1)}h`],
    ['验收', `${acceptedTasks.length} / ${periodTasks.length}`],
    ['等待', `${waitingHours.toFixed(1)}h`],
    ['可预览附件', `${visualReadyCount} 个`],
    ['异常信号', `${riskRows.length} 条`],
  ]
  const summaryReportHighlights = [
    periodTasks.length > 0
      ? `${rangeLabel} 共纳入 ${periodTasks.length} 个任务，计费工时 ${totalHours.toFixed(1)}h，验收率 ${acceptedRate}%。`
      : `${rangeLabel} 暂无进入复盘范围的任务，可先从任务记录和附件完整度开始积累。`,
    leadingType
      ? `主要工作类型为「${leadingType.label}」，占本期计费工时 ${Math.round((leadingType.value / Math.max(typeDistribution.total, 1)) * 100)}%。`
      : '本期暂未形成稳定的设计类型结构。',
    riskRows.length > 0
      ? `发现 ${riskRows.length} 条需要复核的链路信号，建议先处理逾期、超时或交付附件缺口。`
      : '暂未发现明显逾期、超时或附件缺口，当前记录链路较稳定。',
  ]
  const summaryReportActions = [
    riskRows.length > 0 ? '先打开项目诊断逐条核对异常任务，修正进展、附件或验收状态。' : '继续保持分段计时和验收附件留存，方便后续结算复盘。',
    waitingHours > 0 ? '等待原因要写入等待记录，避免 AI 把合作伙伴反馈等待误判为设计执行时间。' : '若后续出现合作伙伴反馈停滞，及时补一条等待记录。',
    leadingType ? `把「${leadingType.label}」沉淀成报价和交付模板，下次同类任务直接复用。` : '先积累 3 条以上同类任务，再判断报价与排期模板。',
  ]
  const reportUnit = period === 'week' ? '本周' : period === 'month' ? '本月' : '本期'
  const periodTimeSegments = periodTasks.flatMap((task) => (task.timeEntries ?? [])
    .map((entry) => {
      const startDate = entry.date || datePart(task.date)
      const endDate = entry.endDate || startDate
      const startStamp = dateTimeMinuteStamp(startDate, entry.start)
      const endStamp = dateTimeMinuteStamp(endDate, entry.end)
      const score = lateNightScore(entry.end)
      if (!Number.isFinite(startStamp) || !Number.isFinite(endStamp) || !Number.isFinite(score)) {
        return null
      }
      return { task, entry, startDate, endDate, startStamp, endStamp, score }
    })
    .filter((item): item is {
      task: Task
      entry: TimeEntry
      startDate: string
      endDate: string
      startStamp: number
      endStamp: number
      score: number
    } => Boolean(item))
    .filter((item) => isDateInRange(`${item.endDate}T${item.entry.end}`, range)))
  const latestWorkMoment = periodTimeSegments
    .slice()
    .sort((a, b) => b.score - a.score || b.endStamp - a.endStamp)[0]
  const eventMoments = [
    ...periodTasks.map((task) => ({
      kind: '新建任务',
      label: task.title,
      value: task.date,
      detail: task.requester ? `需求人 ${task.requester}` : task.type,
    })),
    ...periodTimeSegments
      .filter(({ entry }) => entry.isAcceptanceProgress)
      .map(({ task, entry, endDate }) => ({
        kind: '验收进展',
        label: task.title,
        value: `${endDate}T${entry.end}`,
        detail: entry.note || '完成验收确认',
      })),
    ...periodFiles.map((file) => ({
      kind: file.scope === 'acceptance' ? '上传验收附件' : '上传过程附件',
      label: file.name,
      value: file.uploadedAt,
      detail: file.task,
    })),
  ]
    .map((item) => {
      const clock = formatTimePart(item.value)
      const score = lateNightScore(clock)
      return clock && Number.isFinite(score) && isDateInRange(item.value, range) ? { ...item, clock, score } : null
    })
    .filter((item): item is {
      kind: string
      label: string
      value: string
      detail: string
      clock: string
      score: number
    } => Boolean(item))
  const nightMoments = eventMoments
    .filter((item) => {
      const minutes = clockMinutes(item.clock)
      return Number.isFinite(minutes) && (minutes >= 22 * 60 || minutes < 6 * 60)
    })
    .sort((a, b) => b.score - a.score || b.value.localeCompare(a.value))
    .slice(0, 3)
  const busiestTask = periodTasks
    .slice()
    .sort((a, b) => b.actualHours - a.actualHours)[0]
  const reportStoryLines = [
    periodTasks.length > 0
      ? `${reportUnit}推进了 ${periodTasks.length} 个任务，完成 ${acceptedTasks.length} 个验收，沉淀 ${periodFiles.length} 个附件；计费工时 ${totalHours.toFixed(1)}h，预计收入 ¥${formatYuan(totalHours * hourlyRate)}。`
      : `${reportUnit}还没有进入复盘范围的任务，建议先从新建任务、记录进展和上传附件开始沉淀数据。`,
    leadingType
      ? `工作重心集中在「${leadingType.label}」，占计费工时 ${Math.round((leadingType.value / Math.max(typeDistribution.total, 1)) * 100)}%，可以作为下一轮报价和模板复用的重点。`
      : '当前还没有形成稳定的设计类型结构，先积累 3 条以上同类任务，再判断报价和排期基线。',
    latestWorkMoment
      ? `${reportUnit}最晚一次收工停在 ${formatMonthDay(latestWorkMoment.endDate)} ${latestWorkMoment.entry.end}，来自「${latestWorkMoment.task.title}」。`
      : `${reportUnit}暂未记录可用于判断最晚收工的分段计时。`,
  ]
  const recapMoments = [
    {
      label: '最晚奋斗时间',
      value: latestWorkMoment ? `${latestWorkMoment.entry.end}` : '暂无',
      detail: latestWorkMoment ? `${formatMonthDay(latestWorkMoment.endDate)} · ${latestWorkMoment.task.title}` : '记录分段计时后自动生成',
    },
    {
      label: '最吃工时任务',
      value: busiestTask ? `${busiestTask.actualHours.toFixed(1)}h` : '暂无',
      detail: busiestTask ? busiestTask.title : '暂无计费任务',
    },
    {
      label: '深夜仍在线',
      value: nightMoments.length > 0 ? `${nightMoments.length} 次` : '0 次',
      detail: nightMoments[0] ? `${formatMonthDayTime(nightMoments[0].value)} · ${nightMoments[0].kind}` : '本期没有 22:00 后或 06:00 前的关键动作',
    },
  ]
  const weeklyReportLines = [
    `${reportUnit}主要完成：${acceptedTasks.length > 0 ? acceptedTasks.slice(0, 3).map((task) => `「${task.title}」`).join('、') : '继续推进任务记录和交付准备'}。`,
    `投入情况：计费 ${totalHours.toFixed(1)}h，等待 ${waitingHours.toFixed(1)}h，${riskRows.length > 0 ? `有 ${riskRows.length} 条链路信号需要复核` : '暂无明显逾期、超时或附件缺口'}。`,
    `下步计划：${riskRows.length > 0 ? '先处理异常信号，再锁定结算与验收附件' : leadingType ? `沉淀「${leadingType.label}」模板，继续保持分段计时和验收附件留存` : '继续积累同类任务样本，补齐进展与附件记录'}。`,
  ]
  const projectDiagnosisRows = periodTasks
    .slice()
    .sort((a, b) => {
      const aDeviation = a.estimatedHours > 0 ? a.actualHours / a.estimatedHours : 0
      const bDeviation = b.estimatedHours > 0 ? b.actualHours / b.estimatedHours : 0
      return bDeviation - aDeviation || b.actualHours - a.actualHours
    })
    .slice(0, 8)
    .map((task) => {
      const taskFiles = filesByTask.get(task.id) ?? []
      const taskUpdates = updatesByTask.get(task.id) ?? []
      const deviation = task.estimatedHours > 0 ? Math.round(((task.actualHours - task.estimatedHours) / task.estimatedHours) * 100) : 0
      const hasRisk = riskRows.some((risk) => risk.task.id === task.id)
      return {
        task,
        files: taskFiles,
        updates: taskUpdates,
        deviation,
        hasRisk,
        deliveryText: task.status === '已验收'
          ? `已验收 · ${task.actualDeliveryDate ? formatPlanDateTime(task.actualDeliveryDate) : '交付时间未记录'}`
          : `计划 ${formatPlanDateTime(task.estimatedDate || task.date)}`,
      }
    })
  const requesterProfileRows = useMemo(() => {
    type RequesterProfile = {
      name: string
      projects: number
      hours: number
      accepted: number
      updates: number
      waiting: number
      devSum: number
      devCount: number
      overrun: number
      onTime: number
      late: number
      smooth: number
      fair: number
      problem: number
      tagCounts: Map<TaskFeedbackTag, number>
      revisionMentions: number
      acceptanceFiles: number
      feedbackShots: number
      qualityIssues: number
      risks: number
      issueSamples: Set<string>
      suggestionSamples: Set<string>
    }
    const map = new Map<string, RequesterProfile>()
    const requesterByTask = new Map<number, string>()
    const ensure = (name: string) => {
      let item = map.get(name)
      if (!item) {
        item = {
          name, projects: 0, hours: 0, accepted: 0, updates: 0, waiting: 0,
          devSum: 0, devCount: 0, overrun: 0, onTime: 0, late: 0,
          smooth: 0, fair: 0, problem: 0, tagCounts: new Map(), revisionMentions: 0,
          acceptanceFiles: 0, feedbackShots: 0, qualityIssues: 0, risks: 0,
          issueSamples: new Set(), suggestionSamples: new Set(),
        }
        map.set(name, item)
      }
      return item
    }
    periodTasks.forEach((task) => {
      const name = task.requester || '未填写'
      requesterByTask.set(task.id, name)
      const c = ensure(name)
      c.projects += 1
      c.hours += task.actualHours
      c.accepted += task.status === '已验收' ? 1 : 0
      c.updates += (task.timeEntries ?? []).length
      // 改稿轮次：只数显式勾选「本次为改稿轮次」的分段，避免把分阶段提交误判为改稿
      c.revisionMentions += (task.timeEntries ?? []).filter((entry) => entry.isRevision).length
      c.waiting += sumWaitingEntries(task) / 60
      if (task.estimatedHours > 0 && task.actualHours > 0) {
        const dev = (task.actualHours - task.estimatedHours) / task.estimatedHours
        c.devSum += dev
        c.devCount += 1
        if (dev > 0.25) c.overrun += 1
      }
      if (task.status === '已验收' && task.estimatedDate && task.actualDeliveryDate) {
        if (datePart(task.actualDeliveryDate) <= datePart(task.estimatedDate)) c.onTime += 1
        else c.late += 1
      }
      if (task.feedbackRating === '有问题') c.problem += 1
      else if (task.feedbackRating === '一般') c.fair += 1
      else if (task.feedbackRating === '顺利') c.smooth += 1
      ;(task.feedbackTags ?? []).forEach((tag) => c.tagCounts.set(tag, (c.tagCounts.get(tag) ?? 0) + 1))
    })
    periodFiles.forEach((file) => {
      const name = requesterByTask.get(file.taskId)
      if (!name) return
      const c = map.get(name)
      if (!c) return
      if (file.scope === 'acceptance') c.acceptanceFiles += 1
      if (/反馈|意见|批注|沟通|截图|确认/.test(`${file.name} ${file.tag ?? ''}`)) c.feedbackShots += 1
    })
    completedAnalyses.forEach((analysis) => {
      const name = requesterByTask.get(analysis.taskId)
      if (!name) return
      const c = map.get(name)
      if (!c) return
      c.qualityIssues += analysis.qualityIssues?.length ?? 0
      c.risks += analysis.risks?.length ?? 0
      ;(analysis.qualityIssues ?? []).forEach((issue) => issue && c.issueSamples.add(issue))
      ;(analysis.suggestions ?? []).forEach((tip) => tip && c.suggestionSamples.add(tip))
    })
    return [...map.values()].sort((a, b) => b.hours - a.hours).slice(0, 8)
  }, [periodTasks, periodFiles, completedAnalyses])
  const selectedProject = selectedInsightKind === 'pd' ? projectDiagnosisRows[Number(selectedInsightValue)] : undefined
  const selectedRequester = selectedInsightKind === 'cp' ? requesterProfileRows[Number(selectedInsightValue)] : undefined
  useEffect(() => {
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
  }, [])

  return (
    <section className="insights-view insights-redesign">
      <section className="panel insights-hero">
        <div>
          <p className="eyebrow">数据洞察</p>
          <h2>周期复盘与交付链路分析</h2>
          <span>{rangeLabel} · 基于历史任务、当前周期、进展、验收和附件完整度自动复盘</span>
        </div>
      </section>

      <div className="insight-reference-layout">
        <aside className="insight-tree" aria-label="洞察目录">
          <div className="insight-tree-group">
            <button type="button" className="insight-tree-head">
              <span>总结报告</span>
            </button>
            <button
              type="button"
              className={`insight-tree-item ${selectedInsightKind === 'sr' ? 'active' : ''}`}
              onClick={() => setActiveInsightKey(`sr:${period}`)}
            >
              <span>{insightPeriods.find((item) => item.value === period)?.label ?? '周期'}总结</span>
            </button>
          </div>
          <div className="insight-tree-group">
            <button type="button" className="insight-tree-head">
              <span>周期复盘</span>
            </button>
            {insightPeriods.map((item) => (
              <button
                type="button"
                className={`insight-tree-item ${activeInsightKey === `rv:${item.value}` ? 'active' : ''}`}
                key={item.value}
                onClick={() => {
                  setPeriod(item.value)
                  setActiveInsightKey(`rv:${item.value}`)
                }}
              >
                <span>{item.label}复盘</span>
              </button>
            ))}
          </div>
          <div className="insight-tree-group">
            <button type="button" className="insight-tree-head">
              <span>AI 工时学习</span>
            </button>
            <button
              type="button"
              className={`insight-tree-item ${selectedInsightKind === 'he' ? 'active' : ''}`}
              onClick={() => setActiveInsightKey(`he:${currentMonth.value}`)}
            >
              <span>准确率与校准</span>
            </button>
          </div>
          <div className="insight-tree-group">
            <button type="button" className="insight-tree-head">
              <span>项目诊断 · {currentMonth.label}</span>
            </button>
            {projectDiagnosisRows.map((item, index) => (
              <button
                type="button"
                className={`insight-tree-item ${activeInsightKey === `pd:${index}` ? 'active' : ''}`}
                key={item.task.id}
                onClick={() => setActiveInsightKey(`pd:${index}`)}
              >
                <span>{item.task.title}</span>
              </button>
            ))}
            {projectDiagnosisRows.length === 0 && (
              <p className="insight-tree-empty">本月暂无需要关注的异常任务</p>
            )}
          </div>
          <div className="insight-tree-group">
            <button type="button" className="insight-tree-head">
              <span>需求人画像</span>
            </button>
            {requesterProfileRows.map((item, index) => (
              <button
                type="button"
                className={`insight-tree-item ${activeInsightKey === `cp:${index}` ? 'active' : ''}`}
                key={item.name}
                onClick={() => setActiveInsightKey(`cp:${index}`)}
              >
                <span>{item.name}</span>
              </button>
            ))}
            {requesterProfileRows.length === 0 && (
              <p className="insight-tree-empty">周期内出现记录需求人的任务后生成画像</p>
            )}
          </div>
        </aside>

        <section className="insight-document">
          {selectedInsightKind === 'sr' && (
            <>
              <div className="sec-head">
                <h2>{insightPeriods.find((item) => item.value === period)?.label ?? '周期'}总结报告</h2>
                <p>{rangeLabel} · 面向结算、排期和下次协作的简要复盘</p>
              </div>
              <article className="summary-report" aria-label="洞察总结报告">
                <p className="summary-report-lead">
                  {reportStoryLines.join(' ')}
                </p>
                <section className="summary-report-weekly">
                  <h3>可直接放进周报</h3>
                  {weeklyReportLines.map((line, index) => (
                    <p key={line}><strong>{index === 0 ? '完成' : index === 1 ? '投入' : '下步'}</strong>{line}</p>
                  ))}
                </section>
                <dl className="summary-report-moments">
                  {recapMoments.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                      <small>{item.detail}</small>
                    </div>
                  ))}
                </dl>
                {nightMoments.length > 0 && (
                  <section className="summary-report-night">
                    <h3>夜间小传记</h3>
                    {nightMoments.map((item) => (
                      <p key={`${item.kind}-${item.value}-${item.label}`}>
                        <strong>{formatMonthDayTime(item.value)}</strong>
                        <span>{item.kind} · {item.label}</span>
                      </p>
                    ))}
                  </section>
                )}
                <dl className="summary-report-metrics">
                  {summaryReportStats.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="summary-report-grid">
                  <section>
                    <h3>本期结论</h3>
                    <ul>
                      {summaryReportHighlights.map((line) => <li key={line}>{line}</li>)}
                    </ul>
                  </section>
                  <section>
                    <h3>下一步动作</h3>
                    <ul>
                      {summaryReportActions.map((line) => <li key={line}>{line}</li>)}
                    </ul>
                  </section>
                </div>
                {riskRows.length > 0 && (
                  <section className="summary-report-risks">
                    <h3>优先复核</h3>
                    {riskRows.slice(0, 4).map((risk) => (
                      <div className="summary-risk-row" key={`${risk.task.id}-${risk.label}`}>
                        <span>{risk.label}</span>
                        <b>{risk.task.title}</b>
                        <p>{risk.detail}</p>
                      </div>
                    ))}
                  </section>
                )}
              </article>
            </>
          )}

          {selectedInsightKind === 'rv' && (
            <>
              <div className="sec-head">
                <h2>{insightPeriods.find((item) => item.value === period)?.label ?? '周期'}复盘</h2>
                <p>数据 · 诊断 · 建议（基于历史任务、进展、等待和验收附件完整度）</p>
              </div>
              <div className="review-grid">
                <div className="rv-col">
                  <span className="label">数据</span>
                  {periodReviewData.map(([label, value]) => (
                    <div className="rv-data" key={label}><span className="k">{label}</span><b>{value}</b></div>
                  ))}
                </div>
                <div className="rv-col">
                  <span className="label">诊断</span>
                  {periodReviewDiagnostics.map((item, index) => <div className={`rv-item ${index === 0 && item.includes('+') ? 'warn' : ''}`} key={item}>{item}</div>)}
                </div>
                <div className="rv-col">
                  <span className="label">建议</span>
                  {periodReviewAdvice.map((item) => <div className="rv-item adv" key={item}>{item}</div>)}
                </div>
              </div>
              <div className="rv-note">
                已完成 {completedAnalyses.length} 个交付件内容分析；{visualReadyCount} 个附件可预览；{lockedReports} 期结算已锁定；追踪中的历史洞察 {insightHistory.filter((item) => item.status === 'open' || item.status === 'improved').length} 条。
                {historyError ? ` ${historyError}` : ''}
              </div>
            </>
          )}

          {selectedInsightKind === 'he' && (
            <>
              <div className="sec-head">
                <h2>AI 工时准确率与学习复盘</h2>
                <p>{currentMonth.label} · 只统计已验收任务，对比 AI 建议、最终采用值与真实工时</p>
              </div>
              {hourMetricsLoading && <p className="hour-learning-empty">AI 正在整理工时复盘…</p>}
              {!hourMetricsLoading && hourMetricsError && <p className="hour-learning-empty error-text">{hourMetricsError}</p>}
              {!hourMetricsLoading && !hourMetricsError && hourMetrics && hourMetrics.summary.observedCount === 0 && hourMetrics.observationReadiness.observedCount === 0 && (
                <p className="hour-learning-empty">当月还没有“使用过 AI 工时建议且已验收”的任务。完成验收后，这里会自动生成偏差和校准结果。</p>
              )}
              {!hourMetricsLoading && !hourMetricsError && hourMetrics && (hourMetrics.summary.observedCount > 0 || hourMetrics.observationReadiness.observedCount > 0) && (
                <article className="hour-learning-report">
                  <dl className="hour-learning-metrics">
                    <div><dt>已复盘预测</dt><dd>{hourMetrics.summary.observedCount}</dd><small>已验收任务</small></div>
                    <div><dt>误差≤20%</dt><dd>{hourMetrics.summary.within20Rate}%</dd><small>历史命中率</small></div>
                    <div><dt>中位误差</dt><dd>{hourMetrics.summary.medianErrorRate}%</dd><small>避免被极端值带偏</small></div>
                    <div><dt>采用后改善</dt><dd>{hourMetrics.summary.selectionImprovement >= 0 ? '+' : ''}{hourMetrics.summary.selectionImprovement}%</dd><small>相对 AI 原建议</small></div>
                  </dl>

                  <section className={`hour-release-gate ${hourMetrics.releaseGate.status}`}>
                    <div>
                      <strong>预测发布门禁</strong>
                      <span>{hourMetrics.releaseGate.status === 'pass' ? '回放通过' : hourMetrics.releaseGate.status === 'fail' ? '应阻止发布' : '样本不足'}</span>
                    </div>
                    <p>{hourMetrics.releaseGate.summary}</p>
                    <small>{hourMetrics.releaseGate.samples} 条无未来数据回放 · 候选中位误差 {hourMetrics.releaseGate.candidateMedianErrorRate}% · 线上基线 {hourMetrics.releaseGate.baselineMedianErrorRate}%</small>
                  </section>

                  <section className={`hour-observation-readiness ${hourMetrics.observationReadiness.status}`}>
                    <div className="hour-observation-head">
                      <div><strong>真实数据观察期</strong><span>{hourMetrics.observationReadiness.status === 'ready' ? '首轮样本就绪' : hourMetrics.observationReadiness.status === 'calibrating' ? '进入校准期' : '持续采集'}</span></div>
                      <strong>{hourMetrics.observationReadiness.completeLifecycleCount} / {hourMetrics.observationReadiness.target}</strong>
                    </div>
                    <div className="hour-observation-track" aria-label={`完整生命周期样本进度 ${hourMetrics.observationReadiness.progress}%`}><span style={{ width: `${hourMetrics.observationReadiness.progress}%` }} /></div>
                    <p>{hourMetrics.observationReadiness.summary}</p>
                    <small>{hourMetrics.observationReadiness.healthyCount} 条健康验收样本 · {hourMetrics.observationReadiness.quotedCount} 条报价结果 · 覆盖 {hourMetrics.observationReadiness.activeDays} 个记录日</small>
                  </section>

                  <section className="hour-learning-section">
                    <div className="hour-learning-head">
                      <h3>报价结果闭环</h3>
                      <p>区分工时是否估准，以及报价是否被采用并接近最终结算</p>
                    </div>
                    <div className="hour-quote-summary">
                      <div><span>已记录</span><strong>{hourMetrics.quoteSummary.recordedCount} 项</strong></div>
                      <div><span>接受 / 调整后接受</span><strong>{hourMetrics.quoteSummary.acceptedRate}%</strong></div>
                      <div><span>报价与结算中位偏差</span><strong>{hourMetrics.quoteSummary.settlementMedianErrorRate}%</strong></div>
                    </div>
                  </section>

                  <section className="hour-learning-section">
                    <div className="hour-learning-head">
                      <h3>报价策略诊断</h3>
                      <p>把工时准确度、成交结果和最终结算放在同一条链路分析</p>
                    </div>
                    {hourMetrics.pricingStrategies.length ? <div className="hour-strategy-list">
                      {hourMetrics.pricingStrategies.map((item) => <div className="hour-strategy-row" key={`${item.dimension}-${item.name}`}>
                        <div><strong>{item.name}</strong><span>{item.dimension === 'all' ? '整体' : item.dimension === 'type' ? '设计类型' : '需求方'} · {item.samples} 条</span></div>
                        <span>接受 {item.acceptedRate}%</span>
                        <span>结算偏差 {item.medianSettlementErrorRate}%</span>
                        <p>{item.recommendation}</p>
                      </div>)}
                    </div> : <p className="hour-learning-empty">记录报价结果后，将自动生成成交与结算策略建议。</p>}
                  </section>

                  <section className="hour-learning-section">
                    <div className="hour-learning-head">
                      <h3>建议采用效果</h3>
                      <p>比较常规值、稳妥值与手工修改后的最终准确度</p>
                    </div>
                    <div className="hour-adoption-grid">
                      {hourMetrics.adoption.performance.map((item) => {
                        const label = item.mode === 'suggested' ? '常规值' : item.mode === 'safe' ? '稳妥值' : '手工修改'
                        return <div key={item.mode}><span>{label}</span><strong>{item.count} 次</strong><small>中位误差 {item.count ? `${item.medianErrorRate}%` : '—'}</small></div>
                      })}
                    </div>
                  </section>

                  <section className="hour-learning-section">
                    <div className="hour-learning-head">
                      <h3>分类误差诊断</h3>
                      <p>区分设计类型与从零 / 复用基础，定位误差集中在哪一层</p>
                    </div>
                    {hourMetrics.classificationDiagnostics.length ? <div className="hour-diagnostic-list">
                      {hourMetrics.classificationDiagnostics.map((item) => <div className="hour-diagnostic-row" key={`${item.dimension}-${item.name}`}>
                        <div><strong>{item.name}</strong><span>{item.dimension === 'type' ? '设计类型' : '设计基础'} · {item.samples} 条</span></div>
                        <span>中位误差 {item.medianErrorRate}%</span>
                        <span>低估 {item.underRate}% · 高估 {item.overRate}%</span>
                        <small>{item.topFactors.join('、') || '暂无集中偏差因素'}</small>
                      </div>)}
                    </div> : <p className="hour-learning-empty">健康样本不足，暂不生成分类结论。</p>}
                  </section>

                  <section className="hour-learning-section">
                    <div className="hour-learning-head">
                      <h3>预测漂移提醒</h3>
                      <p>同类型最近 3 条与此前 3 条真实工时相差 20% 以上时提醒复核</p>
                    </div>
                    {hourMetrics.driftAlerts.length ? <div className="hour-drift-list">
                      {hourMetrics.driftAlerts.map((item) => <div className={`hour-drift-row ${item.severity}`} key={item.designType}>
                        <div><strong>{item.designType}</strong><span>{item.previousAverageHours.toFixed(1)}h → {item.recentAverageHours.toFixed(1)}h</span></div>
                        <strong>{item.changeRate > 0 ? '+' : ''}{item.changeRate}%</strong>
                        <p>{item.summary}</p>
                      </div>)}
                    </div> : <p className="hour-learning-empty">当前没有达到提醒阈值的类型，或同类型样本尚不足 6 条。</p>}
                  </section>

                  <section className="hour-learning-section">
                    <div className="hour-learning-head">
                      <h3>跨月准确率趋势</h3>
                      <p>同时观察命中率、低估与高估，确认系统是否持续变准</p>
                    </div>
                    {hourMetrics.trends.length > 0 ? (
                      <div className="hour-trend-list">
                        {hourMetrics.trends.map((item) => (
                          <div className="hour-trend-row" key={item.month}>
                            <strong>{Number(item.month.slice(5))} 月</strong>
                            <div className="hour-trend-track" aria-label={`${item.month} 命中率 ${item.within20Rate}%`}>
                              <span style={{ width: `${item.within20Rate}%` }} />
                            </div>
                            <span>命中 {item.within20Rate}%</span>
                            <span>中位误差 {item.medianErrorRate}%</span>
                            <small>{item.samples} 条 · 低估 {item.underRate}% · 高估 {item.overRate}%</small>
                          </div>
                        ))}
                      </div>
                    ) : <p className="hour-learning-empty">跨月样本不足，验收任务积累后自动生成趋势。</p>}
                  </section>

                  <section className="hour-learning-section">
                    <div className="hour-learning-head">
                      <h3>预测版本对照</h3>
                      <p>算法、提示词和模型路由分开记录；新版需用真实验收结果证明改善</p>
                    </div>
                    <div className="hour-version-list">
                      {hourMetrics.versions.map((item) => (
                        <div className="hour-version-row" key={`${item.algorithm}-${item.prompt}-${item.provider}`}>
                          <div><strong>算法 {item.algorithm}</strong><span>{item.current ? '当前版本' : '历史版本'} · {item.provider}</span></div>
                          <span>提示词 {item.prompt}</span>
                          <span>{item.samples} 条样本</span>
                          <span>命中 {item.within20Rate}%</span>
                          <strong>中位误差 {item.medianErrorRate}%</strong>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="hour-learning-section">
                    <div className="hour-learning-head">
                      <h3>类型与需求方校准</h3>
                      <p>样本达到 3 条后才建议应用独立系数；系数高于 1 表示历史实际投入更高</p>
                    </div>
                    <div className="hour-calibration-grid">
                      <HourCalibrationTable title="按设计类型" rows={hourMetrics.byType} />
                      <HourCalibrationTable title="按需求方 / 客户" rows={hourMetrics.byRequester} />
                    </div>
                  </section>

                  <section className="hour-learning-section">
                    <div className="hour-learning-head">
                      <h3>个人效率画像</h3>
                      <p>同类型任务前后半段真实投入对照，同时标记模板复用占比</p>
                    </div>
                    {hourMetrics.efficiencyProfiles.length ? (
                      <div className="hour-efficiency-list">
                        {hourMetrics.efficiencyProfiles.map((item) => (
                          <div className="hour-efficiency-row" key={item.name}>
                            <div><strong>{item.name}</strong><span>{item.samples} 条样本 · 复用 {item.reuseRate}%</span></div>
                            <span>早期 {item.priorAverageHours.toFixed(1)}h</span>
                            <span>近期 {item.recentAverageHours.toFixed(1)}h</span>
                            <strong className={item.direction}>{item.direction === 'faster' ? `提速 ${Math.abs(item.changeRate)}%` : item.direction === 'slower' ? `增加 ${item.changeRate}%` : '基本稳定'}</strong>
                          </div>
                        ))}
                      </div>
                    ) : <p className="hour-learning-empty">同类型跨期样本不足，暂不生成效率结论。</p>}
                  </section>

                  <section className="hour-learning-section">
                    <div className="hour-learning-head">
                      <h3>历史样本质量</h3>
                      <p>异常工时、过短需求和范围变化不会静默污染后续预测</p>
                    </div>
                    {hourMetrics.sampleQuality.length ? (
                      <div className="hour-sample-quality-list">
                        {hourMetrics.sampleQuality.map((item) => (
                          <div className={item.excluded ? 'hour-sample-quality-row excluded' : 'hour-sample-quality-row'} key={item.taskId}>
                            <div><strong>{item.title}</strong><span>{item.designType || '未分类'} · 采用 {item.selectedHours.toFixed(1)}h / 实际 {item.actualHours.toFixed(1)}h</span></div>
                            <span>{item.issues.join('、') || item.reason}</span>
                            <button type="button" className="ghost-button compact-button" disabled={hourSampleQualitySaving === item.taskId} onClick={() => void toggleHourSampleQuality(item)}>
                              {item.excluded ? '恢复样本' : '排除样本'}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : <p className="hour-learning-empty">当前没有需要处理的异常样本。</p>}
                    {hourSampleQualityError && <p className="error-text">{hourSampleQualityError}</p>}
                  </section>

                  <section className="hour-learning-section">
                    <div className="hour-learning-head">
                      <h3>逐任务自动复盘</h3>
                      <p>验收时自动生成，偏差原因会进入后续同类任务的参考与校准</p>
                    </div>
                    <div className="hour-review-list">
                      {hourMetrics.recent.map((item) => (
                        <div className="hour-review-row" key={`${item.taskId}-${item.reviewedAt}`}>
                          <div className="hour-review-main">
                            <strong>{item.title}</strong>
                            <span>{item.designType || '未分类'} · {item.requester || '未填需求方'}</span>
                          </div>
                          <div className="hour-review-values">
                            <span>建议 {item.suggestedHours.toFixed(1)}h</span>
                            <span>采用 {item.selectedHours.toFixed(1)}h</span>
                            <strong>实际 {item.actualHours.toFixed(1)}h</strong>
                          </div>
                          <div className={`hour-review-state ${item.direction}`}>
                            <strong>{item.direction === 'accurate' ? '命中' : item.direction === 'under' ? '偏低' : '偏高'} {item.errorRate}%</strong>
                            <span>{item.factors.length ? item.factors.join('、') : '暂无明确偏差因素'}</span>
                            {item.requirementChange.changed && <small>{item.requirementChange.summary}</small>}
                            <details className="hour-requirement-timeline">
                              <summary>需求变化时间线</summary>
                              {item.requirementTimeline.map((entry) => <p key={entry.stage}><strong>{entry.label}</strong><span>{entry.requirement || '未记录'}</span></p>)}
                            </details>
                            <div className="hour-review-actions">
                              <button type="button" className="ghost-button compact-button" onClick={() => openHourCorrection(item)}>
                                {item.correction ? '修改偏差原因' : '校正偏差原因'}
                              </button>
                              <button type="button" className="ghost-button compact-button" onClick={() => openHourQuote(item)}>
                                {item.quoteOutcome ? '修改报价结果' : '记录报价结果'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </article>
              )}
            </>
          )}

          {selectedInsightKind === 'pd' && selectedProject && (
            <>
              <div className="sec-head">
                <h2>项目诊断 · {selectedProject.task.title}</h2>
                <p>接单 → 进行 → 交付 → 验收 · 工时偏差 / 沟通诊断 / 改进建议</p>
              </div>
              <div className="pdiag">
                <div className="pdiag-head">
                  <b>{selectedProject.task.title}</b>
                  <span>{selectedProject.task.requester || '未填写'}</span>
                  <span className={`pd-status st ${selectedProject.task.status === '已验收' ? 'done' : selectedProject.hasRisk ? 'pending' : 'active'}`}><i />{selectedProject.task.status}</span>
                </div>
                <div className="chain">
                  {[
                    ['接单', formatPlanDateTime(selectedProject.task.date)],
                    ['工时', `${selectedProject.task.actualHours.toFixed(1)}h · ${selectedProject.updates.length} 段`],
                    ['交付', `${selectedProject.files.length} 个交付件`],
                    ['验收', selectedProject.deliveryText],
                  ].map(([label, value], index, arr) => (
                    <Fragment key={label}>
                      <div className="chain-step"><span className="cs-t">{label}</span><span className="cs-v">{value}</span></div>
                      {index < arr.length - 1 && <span className="chain-arrow">→</span>}
                    </Fragment>
                  ))}
                </div>
                <div className="pd-gap">
                  <div className="pd-gap-h">
                    <span>工时偏差</span>
                    <b className={selectedProject.deviation > 15 ? 'warn' : selectedProject.deviation <= 0 ? 'good' : ''}>
                      预估 {selectedProject.task.estimatedHours.toFixed(1)}h → 实际 {selectedProject.task.actualHours.toFixed(1)}h（{selectedProject.deviation >= 0 ? '+' : ''}{selectedProject.deviation}%）
                    </b>
                  </div>
                  <div className="pd-gap-d">
                    <span className="ml">偏差原因</span>
                    {selectedProject.hasRisk ? '该项目命中异常信号，请优先核对进展备注、交付附件和验收状态。' : '当前项目链路相对顺畅，可作为同类任务的报价与排期参照。'}
                  </div>
                </div>
                <div className="pdiag-finds">
                  {(riskRows.filter((risk) => risk.task.id === selectedProject.task.id).length > 0
                    ? riskRows.filter((risk) => risk.task.id === selectedProject.task.id)
                    : [{ label: '链路完整', detail: '暂无明显逾期、超时或附件缺口。', tone: 'info' as const, task: selectedProject.task }]
                  ).map((risk) => (
                    <div className="pd-find" key={`${risk.label}-${risk.detail}`}>
                      <span className={`tag ${risk.tone === 'danger' ? 'risk' : risk.tone === 'warning' ? 'gap' : 'open'}`}>{risk.label}</span>
                      <span>{risk.detail}</span>
                    </div>
                  ))}
                </div>
                <div className="pd-advice"><span className="ml">改进建议</span>{selectedProject.hasRisk ? '下次接单前先锁定范围、交付物格式和验收凭证；超出预估时及时补一条进展说明。' : '沉淀为合格交付模板，后续同类任务可沿用当前排期与附件要求。'}</div>
              </div>
            </>
          )}

          {selectedInsightKind === 'cp' && selectedRequester && (() => {
            const c = selectedRequester
            const acceptRate = Math.round((c.accepted / Math.max(c.projects, 1)) * 100)
            const deliveredTotal = c.onTime + c.late
            const onTimeRate = deliveredTotal > 0 ? Math.round((c.onTime / deliveredTotal) * 100) : null
            const avgDev = c.devCount > 0 ? Math.round((c.devSum / c.devCount) * 100) : null
            const avgRevisions = c.projects > 0 ? c.revisionMentions / c.projects : 0
            const topTags = [...c.tagCounts.entries()].sort((a, b) => b[1] - a[1])
            const ratedTotal = c.smooth + c.fair + c.problem
            // 与「你其他需求人」对比，用于判断耗时偏长/偏短、需求难易
            const hpp = c.hours / Math.max(c.projects, 1)
            const cohortHpp = requesterProfileRows.length > 0
              ? requesterProfileRows.reduce((sum, row) => sum + row.hours / Math.max(row.projects, 1), 0) / requesterProfileRows.length
              : hpp
            // 该需求人的特征画像：把数据翻译成对「这个人」的判断
            const traits: { text: string; tone: 'good' | 'warn' | 'info' }[] = []
            if (acceptRate >= 90) traits.push({ tone: 'good', text: `验收通过率高（${acceptRate}%），交付多数一次过` })
            else if (acceptRate < 60) traits.push({ tone: 'warn', text: `验收通过率偏低（${acceptRate}%），返工概率较高` })
            else traits.push({ tone: 'info', text: `验收通过率一般（${acceptRate}%）` })
            const vagueReq = avgRevisions > 1.5 || (avgDev !== null && avgDev > 30) || c.tagCounts.has('需求不清晰')
            const clearReq = avgRevisions <= 1 && (avgDev === null || Math.abs(avgDev) <= 20) && !c.tagCounts.has('需求不清晰')
            if (clearReq) traits.push({ tone: 'good', text: '需求表达明确，改稿少、实际工时贴近预估' })
            else if (vagueReq) traits.push({ tone: 'warn', text: '需求偏模糊，常需多轮确认与改稿' })
            else traits.push({ tone: 'info', text: '需求明确度中等' })
            if (hpp > cohortHpp * 1.25) traits.push({ tone: 'info', text: `单项目耗时偏长（均 ${hpp.toFixed(1)}h，高于你的平均 ${cohortHpp.toFixed(1)}h）` })
            else if (hpp < cohortHpp * 0.75) traits.push({ tone: 'info', text: `单项目耗时较短（均 ${hpp.toFixed(1)}h），推进快` })
            else traits.push({ tone: 'info', text: `单项目耗时适中（均 ${hpp.toFixed(1)}h）` })
            if (hpp <= cohortHpp && acceptRate >= 80 && (avgDev === null || avgDev <= 15)) traits.push({ tone: 'good', text: '需求相对简单、好交付，较容易获得工时（性价比高）' })
            else if (hpp > cohortHpp * 1.25 || (avgDev !== null && avgDev > 25)) traits.push({ tone: 'info', text: '需求较重、耗时，但单项目能积累更多工时' })
            if (c.waiting > 2) traits.push({ tone: 'warn', text: `确认 / 反馈偏慢，等待较多（${c.waiting.toFixed(1)}h）` })
            else if (c.waiting <= 0) traits.push({ tone: 'good', text: '确认及时，几乎无等待' })
            if (avgDev !== null && Math.abs(avgDev) <= 15) traits.push({ tone: 'good', text: '工时可预估，报价风险低' })
            else if (avgDev !== null && avgDev > 30) traits.push({ tone: 'warn', text: `实际工时常超预估（+${avgDev}%），报价需留缓冲` })
            // 修改轮次：判断该需求人是否频繁要求改稿
            if (avgRevisions > 2) traits.push({ tone: 'warn', text: `改稿轮次偏多（均 ${avgRevisions.toFixed(1)} 轮/项目），来回打磨成本高` })
            else if (avgRevisions > 1.5) traits.push({ tone: 'info', text: `改稿轮次略多（均 ${avgRevisions.toFixed(1)} 轮/项目）` })
            else if (avgRevisions > 0 && avgRevisions <= 1) traits.push({ tone: 'good', text: `改稿轮次少（均 ${avgRevisions.toFixed(1)} 轮/项目），定稿利落` })
            // 延迟率：交付未按时占比，判断是否常拖期
            const lateRate = onTimeRate === null ? null : 100 - onTimeRate
            if (lateRate !== null && lateRate >= 40) traits.push({ tone: 'warn', text: `延迟率偏高（${lateRate}% 未按时交付），排期需多留缓冲` })
            else if (lateRate !== null && lateRate >= 20) traits.push({ tone: 'info', text: `延迟率中等（${lateRate}% 未按时）` })
            else if (lateRate !== null && lateRate < 10 && deliveredTotal >= 2) traits.push({ tone: 'good', text: `几乎不拖期（按时率 ${onTimeRate}%），节奏稳` })
            // 综合评级：以验收率、准时率、工时偏差、改稿密度、等待、体感问题加权
            const penalty =
              (avgDev !== null && avgDev > 25 ? 1 : 0) +
              (onTimeRate !== null && onTimeRate < 70 ? 1 : 0) +
              (c.waiting > 2 ? 1 : 0) +
              (avgRevisions > 1.5 ? 1 : 0) +
              (c.problem > 0 ? 1 : 0) +
              (acceptRate < 80 ? 1 : 0)
            const grade = penalty <= 1 ? 'A' : penalty <= 3 ? 'B' : 'C'
            const responsibility = c.problem > 0 || (avgDev !== null && avgDev > 25)
              ? '需重点跟进'
              : c.waiting > 0 || (onTimeRate !== null && onTimeRate < 70)
                ? '确认偏慢'
                : '配合顺畅'
            const adviceLines: string[] = []
            if (avgDev !== null && avgDev > 25) adviceLines.push(`实际工时平均超预估 ${avgDev}%，下次报价建议上浮或在开工前补一版需求确认稿。`)
            if (topTags.some(([tag]) => tag === '需求不清晰')) adviceLines.push('「需求不清晰」反复出现：开工前先产出需求 / 尺寸确认稿并留存确认截图，减少返工。')
            if (topTags.some(([tag]) => tag === '沟通成本高') || avgRevisions > 1.5) adviceLines.push('沟通 / 改稿成本偏高：约定每轮反馈时限与改稿轮次上限，超出按新增工时计。')
            if (topTags.some(([tag]) => tag === '定价偏低')) adviceLines.push('历史标记「定价偏低」：该需求人项目建议重新评估单价。')
            if (c.waiting > 2) adviceLines.push('等待耗时偏高：排期预留缓冲，并把等待计入洞察（不计结算）。')
            if (c.acceptanceFiles === 0 && c.accepted > 0) adviceLines.push('验收附件偏少：主动留存合作伙伴确认截图 / 最终稿，作为后续对账与画像依据。')
            if (adviceLines.length === 0) adviceLines.push('链路顺畅，可作为优先排期对象，沿用当前报价与验收资料要求。')
            return (
            <>
              <div className="sec-head">
                <h2>需求人画像 · {c.name}</h2>
                <p>从历史任务总结「这个需求人如何主导项目」，指导下次报价、排期与验收</p>
              </div>
              <div className="cp">
                <div className="cp-head">
                  <b>{c.name}</b>
                  <span>{c.projects} 个项目 · {c.hours.toFixed(1)}h · 综合评级 {grade}</span>
                  <span className={`cp-resp ${c.waiting > 0 ? 'r-partner' : 'r-共同'}`}>{responsibility}</span>
                </div>
                <div className="cp-stats">
                  <div className="cp-stat"><span className="k">合作项目</span><b>{c.projects}</b></div>
                  <div className="cp-stat"><span className="k">计费工时</span><b>{c.hours.toFixed(1)}h</b></div>
                  <div className="cp-stat"><span className="k">验收通过率</span><b className={acceptRate >= 80 ? 'good' : 'warn'}>{acceptRate}%</b></div>
                  <div className="cp-stat"><span className="k">单项目均时</span><b className={hpp > cohortHpp * 1.25 ? 'warn' : 'good'}>{hpp.toFixed(1)}h</b></div>
                  <div className="cp-stat"><span className="k">准时交付</span><b className={onTimeRate === null ? '' : onTimeRate >= 70 ? 'good' : 'warn'}>{onTimeRate === null ? '—' : `${onTimeRate}%`}</b></div>
                  <div className="cp-stat"><span className="k">工时偏差</span><b className={avgDev === null ? '' : avgDev > 25 ? 'warn' : 'good'}>{avgDev === null ? '—' : `${avgDev >= 0 ? '+' : ''}${avgDev}%`}</b></div>
                  <div className="cp-stat"><span className="k">平均改稿</span><b className={avgRevisions > 1.5 ? 'warn' : 'good'}>{avgRevisions.toFixed(1)} 轮</b></div>
                  <div className="cp-stat"><span className="k">等待耗时</span><b className={c.waiting > 2 ? 'warn' : 'good'}>{c.waiting.toFixed(1)}h</b></div>
                </div>

                <div className="cp-sub">这位需求人的特征</div>
                <ul className="cp-traits">
                  {traits.map((trait, index) => (
                    <li key={index} className={`cp-trait t-${trait.tone}`}><i />{trait.text}</li>
                  ))}
                </ul>

                <div className="cp-sub">体感与高频反馈</div>
                {ratedTotal > 0 ? (
                  <div className="cp-dist">
                    <span className="cp-dist-seg s-good" style={{ flexGrow: Math.max(c.smooth, 0.001) }}>顺利 {c.smooth}</span>
                    <span className="cp-dist-seg s-fair" style={{ flexGrow: Math.max(c.fair, 0.001) }}>一般 {c.fair}</span>
                    <span className="cp-dist-seg s-bad" style={{ flexGrow: Math.max(c.problem, 0.001) }}>有问题 {c.problem}</span>
                  </div>
                ) : (
                  <p className="cp-empty">暂无体感反馈记录（验收时勾选「顺利 / 一般 / 有问题」后会沉淀到这里）。</p>
                )}
                {topTags.length > 0 && (
                  <div className="cp-tags">
                    {topTags.map(([tag, count]) => (
                      <span key={tag} className="ftag warn-tag">{tag}{count > 1 ? ` ×${count}` : ''}</span>
                    ))}
                  </div>
                )}

                <div className="cp-advice">
                  <span className="ml">报价 / 排期 / 协作建议</span>
                  <ul className="cp-advice-list">
                    {adviceLines.map((line, index) => <li key={index}>{line}</li>)}
                  </ul>
                </div>
              </div>
            </>
            )
          })()}
        </section>
      </div>
      {hourCorrectionTarget && (
        <ModalShell className="task-action-modal hour-correction-modal" labelledBy="hour-correction-title" onClose={() => setHourCorrectionTarget(null)}>
          <header className="progress-lite-header">
            <div>
              <h2 id="hour-correction-title">校正工时偏差原因</h2>
              <small>{hourCorrectionTarget.title} · 采用 {hourCorrectionTarget.selectedHours.toFixed(1)}h / 实际 {hourCorrectionTarget.actualHours.toFixed(1)}h</small>
            </div>
            <button type="button" className="icon-button modal-close-button" aria-label="关闭" title="关闭" onClick={() => setHourCorrectionTarget(null)}>
              <X size={18} />
            </button>
          </header>
          <div className="hour-correction-body">
            <p>选择可验证的真实原因。人工校正会覆盖自动归因，并参与后续同类任务复盘。</p>
            <div className="hour-correction-options" role="group" aria-label="工时偏差原因">
              {hourOutcomeCorrectionReasons.map((reason) => (
                <button
                  type="button"
                  key={reason}
                  className={hourCorrectionFactors.includes(reason) ? 'active' : ''}
                  aria-pressed={hourCorrectionFactors.includes(reason)}
                  onClick={() => setHourCorrectionFactors((current) => current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason])}
                >
                  {reason}
                </button>
              ))}
            </div>
            <label className="field">
              <span>补充说明（选填）</span>
              <textarea value={hourCorrectionNote} onChange={(event) => setHourCorrectionNote(event.target.value)} placeholder="例如：合作伙伴在第二轮新增了 3 个横版尺寸，不属于原始任务范围。" />
            </label>
            {hourCorrectionError && <p className="error-text">{hourCorrectionError}</p>}
          </div>
          <footer className="modal-footer">
            <button type="button" className="ghost-button" onClick={() => setHourCorrectionTarget(null)}>取消</button>
            <button type="button" data-modal-save="true" className="primary-button" disabled={hourCorrectionSaving || (!hourCorrectionFactors.length && !hourCorrectionNote.trim())} onClick={() => void saveHourCorrection()}>
              {hourCorrectionSaving ? '保存中…' : '保存校正'}
            </button>
          </footer>
        </ModalShell>
      )}
      {hourQuoteTarget && (
        <ModalShell className="task-action-modal hour-correction-modal" labelledBy="hour-quote-title" onClose={() => setHourQuoteTarget(null)}>
          <header className="progress-lite-header">
            <div>
              <h2 id="hour-quote-title">记录报价结果</h2>
              <small>{hourQuoteTarget.title} · 用真实业务结果校准报价策略</small>
            </div>
            <button type="button" className="icon-button modal-close-button" aria-label="关闭" title="关闭" onClick={() => setHourQuoteTarget(null)}><X size={18} /></button>
          </header>
          <div className="hour-correction-body">
            <div className="hour-quote-fields">
              <label className="field"><span>最终对外报价</span><input type="number" min="0" step="1" value={hourQuotedAmount} onChange={(event) => setHourQuotedAmount(event.target.value)} placeholder="例如 1800" /></label>
              <label className="field"><span>实际结算金额（选填）</span><input type="number" min="0" step="1" value={hourSettledAmount} onChange={(event) => setHourSettledAmount(event.target.value)} placeholder="结算后补录" /></label>
            </div>
            <label className="field">
              <span>报价结果</span>
              <select value={hourQuoteStatus} onChange={(event) => setHourQuoteStatus(event.target.value)}>
                <option value="pending">等待确认</option><option value="accepted">直接接受</option><option value="adjusted">调整后接受</option><option value="rejected">未接受</option>
              </select>
            </label>
            <label className="field"><span>补充说明（选填）</span><textarea value={hourQuoteNote} onChange={(event) => setHourQuoteNote(event.target.value)} placeholder="例如：合作伙伴缩减一个尺寸后按 1500 元确认。" /></label>
            {hourQuoteError && <p className="error-text">{hourQuoteError}</p>}
          </div>
          <footer className="modal-footer">
            <button type="button" className="ghost-button" onClick={() => setHourQuoteTarget(null)}>取消</button>
            <button type="button" data-modal-save="true" className="primary-button" disabled={hourQuoteSaving || Number(hourQuotedAmount) <= 0} onClick={() => void saveHourQuote()}>{hourQuoteSaving ? '保存中…' : '保存报价结果'}</button>
          </footer>
        </ModalShell>
      )}
    </section>
  )
}
