import { useEffect, useMemo, useState } from 'react'
import { Clock3, Copy, Download, ExternalLink, Eye, FileText as FileTextIcon, LoaderCircle, Lock, Trash2, X } from 'lucide-react'
import { importedHoursMonth, importedMonthlyHours } from '../config/appConfig'
import { ModalShell } from '../components/ModalShell'
import { PlanDateTimeField } from '../components/PlanDateTimeField'
import { SettlementReceipt } from '../components/SettlementReceipt'
import { api, type ReportRecord, type SettlementExportRecord } from '../lib/api'
import { datePart, isoDate, pad } from '../lib/dateTime'
import { formatYuan, roundCents } from '../lib/money'
import { monthLabelOf } from '../lib/month'
import { buildReceiptExcelBuffer, type ReceiptExcelRow } from '../lib/receiptExcel'
import {
  acceptanceProgressEndDateTime,
  isDateValueInRange,
  isSupplementalTask,
  isTaskBillable,
  safeMonthPart,
  sortTasksByLatestActivity,
  sumBillableAmountForMonth,
  taskBillableHoursInDateRange,
  taskBillableHoursInMonth,
  taskHasMonthActivity,
  taskHoursInDateRange,
  taskHoursInMonth,
  timeEntryActivityValue,
} from '../lib/taskAccounting'
import { hasAcceptanceProgress, taskDisplayProgress } from '../lib/taskProgress'
import type { Task, TaskUpdate } from '../types/domain'

type ToastTone = 'success' | 'error' | 'info'

function nowStamp() {
  const now = new Date()
  return `${isoDate()} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function monthDateRangeLabelOf(value: string) {
  const [year, month] = value.split('-').map(Number)
  const end = new Date(year, month, 0)
  return `${year}/${pad(month)}/01 至 ${end.getFullYear()}/${pad(end.getMonth() + 1)}/${pad(end.getDate())}`
}

function monthDateRangeOf(value: string) {
  const [year, month] = value.split('-').map(Number)
  const end = new Date(year, month, 0)
  return {
    startDate: `${year}-${pad(month)}-01`,
    endDate: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  }
}

export default function ReportsView({
  stats,
  tasks,
  allTasks,
  updates,
  allUpdates,
  hourlyRate,
  importedHours,
  currentMonth,
  pdfTitle,
  serviceCompanyName,
  reports,
  onReportDeleted,
  onNotify,
}: {
  stats: {
    totalHours: number
    billableHours: number
    amount: number
    accepted: number
    pending: number
  }
  tasks: Task[]
  allTasks: Task[]
  updates: TaskUpdate[]
  allUpdates: TaskUpdate[]
  hourlyRate: number
  importedHours: number
  currentMonth: { label: string; value: string }
  pdfTitle: string
  serviceCompanyName: string
  reports: ReportRecord[]
  onReportDeleted: (reportId: string) => void
  onNotify: (message: string, tone?: ToastTone) => void
}) {
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false)
  const [customExportStart, setCustomExportStart] = useState(() => `${currentMonth.value}-01`)
  const [customExportEnd, setCustomExportEnd] = useState(() => isoDate())
  const [isCustomRangePreviewActive, setIsCustomRangePreviewActive] = useState(false)
  const [activeRangePickerId, setActiveRangePickerId] = useState<string | null>(null)
  const [reportSectionTab, setReportSectionTab] = useState<'receipt' | 'history'>('receipt')
  const [exportRecords, setExportRecords] = useState<SettlementExportRecord[]>([])
  const [deleteExportRecord, setDeleteExportRecord] = useState<SettlementExportRecord | null>(null)
  const [deleteExportPassword, setDeleteExportPassword] = useState('')
  const [deleteReport, setDeleteReport] = useState<ReportRecord | null>(null)
  const [deleteReportPassword, setDeleteReportPassword] = useState('')
  const [accessExportRecord, setAccessExportRecord] = useState<SettlementExportRecord | null>(null)
  const [accessExpiryMode, setAccessExpiryMode] = useState<'permanent' | '1' | '7' | '30' | 'custom'>('permanent')
  const [accessExpiryDate, setAccessExpiryDate] = useState('')
  const [accessDisabled, setAccessDisabled] = useState(false)
  const [isExportRecordBusy, setIsExportRecordBusy] = useState(false)
  useEffect(() => {
    api.getSettlementExports()
      .then(({ records }) => setExportRecords(records))
      .catch((error) => console.error('读取导出记录失败', error))
  }, [])
  const selectedMonth = currentMonth.value
  const selectedMonthLabel = monthLabelOf(selectedMonth)
  const selectedReport = reports.find((report) => report.month === selectedMonth)
  const selectedTasks = selectedMonth === currentMonth.value
    ? tasks
    : sortTasksByLatestActivity(allTasks.filter((task) => taskHasMonthActivity(task, selectedMonth) && !task.voidedAt))
  const selectedUpdates = selectedMonth === currentMonth.value
    ? updates
    : allUpdates.filter((update) => {
      const task = allTasks.find((item) => item.id === update.taskId)
      if (task?.voidedAt) {
        return false
      }
      return update.date.startsWith(selectedMonth)
    })
  const selectedImportedHours = selectedMonth === currentMonth.value ? importedHours : 0
  const getSelectedTaskHours = (task: Task) => taskHoursInMonth(task, selectedMonth)
  const getSelectedTaskBillableHours = (task: Task) => taskBillableHoursInMonth(task, selectedMonth)
  type SettlementTaskRow = {
    task: Task
    sequence: string
    estimatedStartDate: string
    actualCompletionDate: string
    estimatedHours: number
    actualHours: number
    amount: number
    progressText: string
  }
  const formatReceiptDate = (value?: string) => (value ? datePart(value).replaceAll('-', '/') : '—')
  const latestUpdatesByTask = useMemo(() => {
    const result = new Map<number, TaskUpdate>()
    selectedUpdates
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((update) => {
        if (!result.has(update.taskId)) {
          result.set(update.taskId, update)
        }
      })
    return result
  }, [selectedUpdates])
  const getTaskProgressText = (task: Task, updatesMap = latestUpdatesByTask) => {
    const latestUpdate = updatesMap.get(task.id)
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
      parts.push(`${task.status}，进度 ${taskDisplayProgress(task)}%`)
    }
    return parts.join('；')
  }
  const latestTaskProgressDate = (
    task: Task,
    latestUpdate: TaskUpdate | undefined,
    isIncluded: (value: string) => boolean,
  ) => [
    latestUpdate?.date ?? '',
    ...(task.timeEntries ?? []).map((entry) => timeEntryActivityValue(entry, task)),
    task.date,
  ].filter((value) => value && isIncluded(value)).sort().at(-1) ?? ''
  const actualCompletionDateForMonth = (task: Task, month: string, updatesMap = latestUpdatesByTask) => {
    const latestProgressDate = latestTaskProgressDate(task, updatesMap.get(task.id), (value) => safeMonthPart(value) === month)
    if (task.status === '已验收' || hasAcceptanceProgress(task)) {
      return acceptanceProgressEndDateTime(task) || task.actualDeliveryDate || latestProgressDate || task.date || ''
    }
    return latestProgressDate || task.date || ''
  }
  const selectedReceiptHourlyRate = selectedReport?.billableHours && selectedReport.billableHours > 0
    ? selectedReport.totalAmount / selectedReport.billableHours
    : hourlyRate
  const buildMonthReceiptRows = (
    month: string,
    tasksForMonth: Task[],
    updatesMap = latestUpdatesByTask,
    rate = selectedReceiptHourlyRate,
  ): SettlementTaskRow[] => tasksForMonth
    .filter((task) => isTaskBillable(task) && taskBillableHoursInMonth(task, month) > 0)
    .map((task, index) => {
      const actualHours = taskBillableHoursInMonth(task, month)
      return {
        task,
        sequence: String(index + 1).padStart(2, '0'),
        estimatedStartDate: formatReceiptDate(task.date),
        actualCompletionDate: formatReceiptDate(actualCompletionDateForMonth(task, month, updatesMap)),
        estimatedHours: Number(task.estimatedHours) || 0,
        actualHours,
        amount: roundCents(actualHours * rate),
        progressText: getTaskProgressText(task, updatesMap),
      }
    })
  const buildRangeReceiptRows = (
    rangeStart: string,
    rangeEnd: string,
    rate = hourlyRate,
  ): SettlementTaskRow[] => {
    const rangeUpdatesMap = new Map<number, TaskUpdate>()
    allUpdates
      .filter((update) => {
        const task = allTasks.find((item) => item.id === update.taskId)
        return !task?.voidedAt && isDateValueInRange(update.date, rangeStart, rangeEnd)
      })
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((update) => {
        if (!rangeUpdatesMap.has(update.taskId)) {
          rangeUpdatesMap.set(update.taskId, update)
        }
      })

    return sortTasksByLatestActivity(allTasks.filter((task) => (
      !task.voidedAt
      && isTaskBillable(task)
      && taskBillableHoursInDateRange(task, rangeStart, rangeEnd) > 0
    ))).map((task, index) => {
      const actualHours = taskBillableHoursInDateRange(task, rangeStart, rangeEnd)
      const latestProgressDate = latestTaskProgressDate(
        task,
        rangeUpdatesMap.get(task.id),
        (value) => isDateValueInRange(value, rangeStart, rangeEnd),
      )
      const actualCompletionDate = task.status === '已验收' || hasAcceptanceProgress(task)
        ? acceptanceProgressEndDateTime(task) || task.actualDeliveryDate || latestProgressDate || task.date
        : latestProgressDate || task.date
      return {
        task,
        sequence: String(index + 1).padStart(2, '0'),
        estimatedStartDate: formatReceiptDate(task.date),
        actualCompletionDate: formatReceiptDate(actualCompletionDate),
        estimatedHours: Number(task.estimatedHours) || 0,
        actualHours,
        amount: roundCents(actualHours * rate),
        progressText: getTaskProgressText(task, rangeUpdatesMap),
      }
    })
  }
  const receiptRows = buildMonthReceiptRows(selectedMonth, selectedTasks)
  const selectedStats = selectedMonth === currentMonth.value
    ? stats
    : {
        totalHours: selectedTasks.reduce((sum, task) => sum + getSelectedTaskHours(task), selectedImportedHours),
        billableHours: selectedTasks
          .filter(isTaskBillable)
          .reduce((sum, task) => sum + getSelectedTaskBillableHours(task), selectedImportedHours),
        amount: selectedReport?.totalAmount ?? sumBillableAmountForMonth(selectedTasks, selectedMonth, hourlyRate, selectedImportedHours),
        accepted: selectedTasks.filter((task) => task.status === '已验收').length,
        pending: selectedTasks.filter((task) => task.status === '待验收').length,
      }
  const visibleReports = isHistoryExpanded ? reports : reports.slice(0, Math.max(3, Math.min(reports.length, 5)))
  const hasValidCustomPreviewRange = isCustomRangePreviewActive
    && /^\d{4}-\d{2}-\d{2}$/.test(customExportStart)
    && /^\d{4}-\d{2}-\d{2}$/.test(customExportEnd)
    && customExportStart <= customExportEnd
  const activeReceiptRows = hasValidCustomPreviewRange
    ? buildRangeReceiptRows(customExportStart, customExportEnd)
    : receiptRows
  const activeReceiptHourlyRate = hasValidCustomPreviewRange ? hourlyRate : selectedReceiptHourlyRate
  const activeReceiptLabel = hasValidCustomPreviewRange
    ? `${formatReceiptDate(customExportStart)} 至 ${formatReceiptDate(customExportEnd)}`
    : selectedMonthLabel
  const activeReceiptKey = hasValidCustomPreviewRange
    ? `${customExportStart}-${customExportEnd}`
    : selectedMonth
  const receiptNo = `AK-${activeReceiptKey.replaceAll('-', '')}-${String(activeReceiptRows.length + 1).padStart(3, '0')}`
  const previewReceiptRows: ReceiptExcelRow[] = activeReceiptRows.map((row) => ({
    taskId: row.task.id,
    sequence: row.sequence,
    type: row.task.type,
    title: `${row.task.title}${isSupplementalTask(row.task) ? '（补录）' : ''}`,
    requirement: row.task.requirement || '',
    estimatedStartDate: row.estimatedStartDate,
    actualCompletionDate: row.actualCompletionDate,
    requester: row.task.requester || row.task.contact || '—',
    contact: row.task.contact || row.task.requester || '—',
    status: row.task.status,
    estimatedHours: row.estimatedHours,
    actualHours: row.actualHours,
    unitPrice: activeReceiptHourlyRate,
    amount: roundCents(row.actualHours * activeReceiptHourlyRate),
    acceptanceNote: row.task.acceptanceNote?.trim() || row.progressText || '—',
  }))
  if (!hasValidCustomPreviewRange && selectedImportedHours > 0) {
    previewReceiptRows.push({
      sequence: String(previewReceiptRows.length + 1).padStart(2, '0'),
      type: '导入',
      title: '月初导入工时（线下记录补录）',
      requirement: '—',
      estimatedStartDate: '—',
      actualCompletionDate: '—',
      requester: '—',
      contact: '—',
      status: '导入',
      estimatedHours: null,
      actualHours: selectedImportedHours,
      unitPrice: selectedReceiptHourlyRate,
      amount: roundCents(selectedImportedHours * selectedReceiptHourlyRate),
      acceptanceNote: '线下记录补录',
    })
  }
  const previewTotalHours = hasValidCustomPreviewRange
    ? previewReceiptRows.reduce((sum, row) => sum + row.actualHours, 0)
    : selectedStats.billableHours
  const previewTotalAmount = hasValidCustomPreviewRange
    ? roundCents(previewReceiptRows.reduce((sum, row) => sum + row.amount, 0))
    : selectedStats.amount
  const activeSummaryStats = hasValidCustomPreviewRange
    ? {
        totalHours: roundCents(allTasks.filter((task) => !task.voidedAt).reduce((sum, task) => sum + taskHoursInDateRange(task, customExportStart, customExportEnd), 0)),
        billableHours: previewTotalHours,
        amount: previewTotalAmount,
        accepted: activeReceiptRows.filter((row) => row.task.status === '已验收' || hasAcceptanceProgress(row.task)).length,
        pending: activeReceiptRows.filter((row) => row.task.status === '待验收').length,
      }
    : selectedStats
  const previewReceiptOptions = {
    fileLabel: activeReceiptLabel.replace(/[\s/]/g, ''),
    title: pdfTitle,
    receiptNo,
    issuedAt: hasValidCustomPreviewRange ? nowStamp() : selectedReport?.generatedAt || nowStamp(),
    companyName: serviceCompanyName,
    serviceName: '平面设计兼职',
    settlementLabelTitle: hasValidCustomPreviewRange ? '结算日期' : '结算月份',
    settlementLabel: activeReceiptLabel,
    hourlyRate: activeReceiptHourlyRate,
    rows: previewReceiptRows,
    totalHours: previewTotalHours,
    totalAmount: previewTotalAmount,
  }
  const lastLockedExport = exportRecords
    .filter((record) => record.locked)
    .sort((a, b) => b.endDate.localeCompare(a.endDate))[0]

  const [isPdfExporting, setIsPdfExporting] = useState(false)

  const handleExportUserSheet = async (
    options: { month?: string; startDate?: string; endDate?: string; label?: string; action?: 'download' | 'share' | 'pdf' | 'record' } = { month: selectedMonth },
  ): Promise<SettlementExportRecord | null> => {
    try {
      const rangeStart = options.startDate ?? ''
      const rangeEnd = options.endDate ?? ''
      const isRangeExport = Boolean(rangeStart && rangeEnd)
      const month = options.month ?? selectedMonth
      const targetReport = !isRangeExport ? reports.find((report) => report.month === month) : undefined
      const targetUpdates = isRangeExport
        ? allUpdates.filter((update) => {
          const task = allTasks.find((item) => item.id === update.taskId)
          return !task?.voidedAt && isDateValueInRange(update.date, rangeStart, rangeEnd)
        })
        : month === selectedMonth
          ? selectedUpdates
          : allUpdates.filter((update) => {
            const task = allTasks.find((item) => item.id === update.taskId)
            return !task?.voidedAt && update.date.startsWith(month)
          })
      const updatesMap = new Map<number, TaskUpdate>()
      targetUpdates
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .forEach((update) => {
          if (!updatesMap.has(update.taskId)) {
            updatesMap.set(update.taskId, update)
          }
        })
      const targetRows = isRangeExport
        ? buildRangeReceiptRows(rangeStart, rangeEnd)
        : month === selectedMonth
          ? receiptRows
          : buildMonthReceiptRows(
            month,
            sortTasksByLatestActivity(allTasks.filter((task) => taskHasMonthActivity(task, month) && !task.voidedAt)),
            updatesMap,
            targetReport?.billableHours && targetReport.billableHours > 0
              ? targetReport.totalAmount / targetReport.billableHours
              : hourlyRate,
          )
      const exportHourlyRate = targetReport?.billableHours && targetReport.billableHours > 0
        ? targetReport.totalAmount / targetReport.billableHours
        : hourlyRate
      const exportRows: ReceiptExcelRow[] = targetRows.map((row) => ({
        taskId: row.task.id,
        sequence: row.sequence,
        type: row.task.type,
        title: `${row.task.title}${isSupplementalTask(row.task) ? '（补录）' : ''}`,
        requirement: row.task.requirement || '',
        estimatedStartDate: row.estimatedStartDate,
        actualCompletionDate: row.actualCompletionDate,
        requester: row.task.requester || row.task.contact || '—',
        contact: row.task.contact || row.task.requester || '—',
        status: row.task.status,
        estimatedHours: row.estimatedHours,
        actualHours: row.actualHours,
        unitPrice: exportHourlyRate,
        amount: roundCents(row.actualHours * exportHourlyRate),
        acceptanceNote: row.task.acceptanceNote?.trim() || row.progressText || '—',
      }))
      if (!isRangeExport && month === importedHoursMonth && importedMonthlyHours > 0) {
        exportRows.push({
          sequence: String(targetRows.length + 1).padStart(2, '0'),
          type: '导入',
          title: '月初导入工时（线下记录补录）',
          requirement: '',
          estimatedStartDate: '—',
          actualCompletionDate: '—',
          requester: '',
          contact: '',
          status: '导入',
          estimatedHours: null,
          actualHours: importedMonthlyHours,
          unitPrice: exportHourlyRate,
          amount: roundCents(importedMonthlyHours * exportHourlyRate),
          acceptanceNote: '线下记录补录',
        })
      }
      const totalHours = targetReport?.billableHours ?? exportRows.reduce((sum, row) => sum + row.actualHours, 0)
      const totalAmount = targetReport?.totalAmount ?? roundCents(exportRows.reduce((sum, row) => sum + row.amount, 0))
      const filenameLabel = options.label ?? (isRangeExport ? `${formatReceiptDate(rangeStart).replaceAll('/', '')}-${formatReceiptDate(rangeEnd).replaceAll('/', '')}` : monthLabelOf(month).replace(/\s/g, ''))
      const receiptPayload = {
        fileLabel: filenameLabel,
        title: pdfTitle,
        receiptNo: `AK-${(isRangeExport ? `${rangeStart}-${rangeEnd}` : month).replaceAll('-', '')}-${String(exportRows.length + 1).padStart(3, '0')}`,
        issuedAt: nowStamp(),
        companyName: serviceCompanyName,
        serviceName: '平面设计兼职',
        settlementLabelTitle: isRangeExport ? '结算日期' : '结算月份',
        settlementLabel: isRangeExport ? `${formatReceiptDate(rangeStart)} 至 ${formatReceiptDate(rangeEnd)}` : monthLabelOf(month),
        hourlyRate: exportHourlyRate,
        rows: exportRows,
        totalHours,
        totalAmount,
      }
      const [exportYear, exportMonth] = month.split('-').map(Number)
      const snapshotStart = isRangeExport ? rangeStart : `${month}-01`
      const snapshotEnd = isRangeExport
        ? rangeEnd
        : `${month}-${pad(new Date(exportYear, exportMonth, 0).getDate())}`
      const createdExport = isRangeExport || options.action === 'share' || options.action === 'pdf' || options.action === 'record'
        ? await api.createSettlementExport({ startDate: snapshotStart, endDate: snapshotEnd, receipt: receiptPayload })
        : null
      if (options.action === 'record' && createdExport) {
        setExportRecords((records) => [createdExport.record, ...records.filter((record) => record.id !== createdExport.record.id)].slice(0, 100))
        return createdExport.record
      }
      if (options.action === 'share' && createdExport) {
        setExportRecords((records) => [createdExport.record, ...records.filter((record) => record.id !== createdExport.record.id)].slice(0, 100))
        const shareUrl = `${window.location.origin}/settlement-share/${createdExport.record.publicToken}`
        try {
          await navigator.clipboard.writeText(shareUrl)
          onNotify(`已生成 ${createdExport.record.label} 分享链接，链接已复制`)
        } catch {
          onNotify(`已生成未锁定分享链接：${shareUrl}`)
        }
        return createdExport.record
      }
      if (options.action === 'pdf' && createdExport) {
        setExportRecords((records) => [createdExport.record, ...records.filter((record) => record.id !== createdExport.record.id)].slice(0, 100))
        const link = document.createElement('a')
        link.href = `/api/shared-settlement/${createdExport.record.publicToken}/pdf`
        link.download = `结算回单_${filenameLabel}.pdf`
        document.body.appendChild(link)
        link.click()
        link.remove()
        onNotify(`正在生成 ${createdExport.record.label} PDF`)
        return createdExport.record
      }
      const buffer = await buildReceiptExcelBuffer(receiptPayload)
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `结算回单_${filenameLabel}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      if (createdExport) {
        setExportRecords((records) => [createdExport.record, ...records.filter((record) => record.id !== createdExport.record.id)].slice(0, 100))
        onNotify(`已导出 ${targetRows.length} 项，${totalHours.toFixed(1)}h · ¥${formatYuan(totalAmount)}`)
      }
      return createdExport?.record ?? null
    } catch (error) {
      console.error('Excel 回单导出失败', error)
      onNotify(error instanceof Error ? `Excel 回单导出失败：${error.message}` : 'Excel 回单导出失败，请重试', 'error')
      return null
    }
  }

  const validateCustomExportRange = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(customExportStart) || !/^\d{4}-\d{2}-\d{2}$/.test(customExportEnd)) {
      onNotify('请选择完整的开始日期和结束日期', 'error')
      return false
    }
    if (customExportStart > customExportEnd) {
      onNotify('开始日期不能晚于结束日期', 'error')
      return false
    }
    return true
  }

  const handleExportCustomRange = () => {
    if (!validateCustomExportRange()) return
    const overlappingLocked = exportRecords.find((record) => record.locked && customExportStart <= record.endDate && customExportEnd >= record.startDate)
    if (overlappingLocked) {
      onNotify(`该范围与已锁定记录 ${overlappingLocked.label} 有重叠，请注意不要重复结算`, 'error')
    }
    void handleExportUserSheet({
      startDate: customExportStart,
      endDate: customExportEnd,
      label: `${customExportStart.replaceAll('-', '')}-${customExportEnd.replaceAll('-', '')}`,
    })
  }

  const handleShareCustomRange = () => {
    if (!validateCustomExportRange()) return
    void handleExportUserSheet({
      startDate: customExportStart,
      endDate: customExportEnd,
      label: `${customExportStart.replaceAll('-', '')}-${customExportEnd.replaceAll('-', '')}`,
      action: 'share',
    })
  }

  const handleExportCustomPdf = async () => {
    if (!validateCustomExportRange() || isPdfExporting) return
    setIsPdfExporting(true)
    try {
      await handleExportUserSheet({
        startDate: customExportStart,
        endDate: customExportEnd,
        label: `${customExportStart.replaceAll('-', '')}-${customExportEnd.replaceAll('-', '')}`,
        action: 'pdf',
      })
    } finally {
      setIsPdfExporting(false)
    }
  }

  const toggleExportRecordLock = async (record: SettlementExportRecord) => {
    setIsExportRecordBusy(true)
    try {
      const result = await api.updateSettlementExportLock(record.id, !record.locked)
      setExportRecords((records) => records.map((item) => item.id === record.id ? result.record : item))
      onNotify(result.record.locked ? '导出记录已锁定' : '导出记录已解锁')
    } catch (error) {
      onNotify(error instanceof Error ? error.message : '更新锁定状态失败', 'error')
    } finally {
      setIsExportRecordBusy(false)
    }
  }

  const copySettlementShareLink = async (record: SettlementExportRecord) => {
    const url = `${window.location.origin}/settlement-share/${record.publicToken}`
    await navigator.clipboard.writeText(url)
    onNotify('线上回单链接已复制')
  }

  const previewSettlementExportRange = (record: SettlementExportRecord) => {
    setCustomExportStart(record.startDate)
    setCustomExportEnd(record.endDate)
    setIsCustomRangePreviewActive(true)
    setReportSectionTab('receipt')
  }

  const existingSettlementExportForRange = (startDate: string, endDate: string) =>
    exportRecords.find((record) => record.startDate === startDate && record.endDate === endDate)

  const ensureSettlementExportForReport = async (report: ReportRecord) => {
    const { startDate, endDate } = monthDateRangeOf(report.month)
    const existingRecord = existingSettlementExportForRange(startDate, endDate)
    if (existingRecord) return existingRecord
    return handleExportUserSheet({
      startDate,
      endDate,
      label: `${startDate.replaceAll('-', '')}-${endDate.replaceAll('-', '')}`,
      action: 'record',
    })
  }

  const previewLockedReportRange = (report: ReportRecord) => {
    const { startDate, endDate } = monthDateRangeOf(report.month)
    setCustomExportStart(startDate)
    setCustomExportEnd(endDate)
    setIsCustomRangePreviewActive(true)
    setReportSectionTab('receipt')
  }

  const copyLockedReportShareLink = async (report: ReportRecord) => {
    const record = await ensureSettlementExportForReport(report)
    if (!record) return
    await copySettlementShareLink(record)
  }

  const openLockedReportSharePage = async (report: ReportRecord) => {
    const record = await ensureSettlementExportForReport(report)
    if (!record) return
    const link = document.createElement('a')
    link.href = `/settlement-share/${record.publicToken}`
    link.target = '_blank'
    link.rel = 'noreferrer'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const openLockedReportAccessManager = async (report: ReportRecord) => {
    const record = await ensureSettlementExportForReport(report)
    if (record) openSettlementAccessManager(record)
  }

  const openSettlementAccessManager = (record: SettlementExportRecord) => {
    setAccessExportRecord(record)
    setAccessDisabled(record.disabled)
    setAccessExpiryDate(record.expiresAt ? datePart(record.expiresAt) : '')
    setAccessExpiryMode(record.expiresAt ? 'custom' : 'permanent')
  }

  const saveSettlementAccess = async () => {
    if (!accessExportRecord) return
    let expiresAt: string | null = null
    if (accessExpiryMode === 'custom') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(accessExpiryDate)) {
        onNotify('请选择完整的链接到期日期', 'error')
        return
      }
      expiresAt = new Date(`${accessExpiryDate}T23:59:59+08:00`).toISOString()
    } else if (accessExpiryMode !== 'permanent') {
      expiresAt = new Date(Date.now() + Number(accessExpiryMode) * 86400000).toISOString()
    }
    setIsExportRecordBusy(true)
    try {
      const result = await api.updateSettlementExportAccess(accessExportRecord.id, { expiresAt, disabled: accessDisabled })
      setExportRecords((records) => records.map((record) => record.id === result.record.id ? result.record : record))
      setAccessExportRecord(null)
      onNotify(accessDisabled ? '分享链接已停止访问' : expiresAt ? '链接有效期已更新' : '链接已设为永久有效')
    } catch (error) {
      onNotify(error instanceof Error ? error.message : '链接权限更新失败', 'error')
    } finally {
      setIsExportRecordBusy(false)
    }
  }

  const confirmDeleteExportRecord = async () => {
    if (!deleteExportRecord) return
    setIsExportRecordBusy(true)
    try {
      await api.deleteSettlementExport(deleteExportRecord.id, deleteExportPassword)
      setExportRecords((records) => records.filter((record) => record.id !== deleteExportRecord.id))
      setDeleteExportRecord(null)
      setDeleteExportPassword('')
      onNotify('导出记录已删除')
    } catch (error) {
      onNotify(error instanceof Error ? error.message : '删除导出记录失败', 'error')
    } finally {
      setIsExportRecordBusy(false)
    }
  }

  const confirmDeleteReport = async () => {
    if (!deleteReport) return
    setIsExportRecordBusy(true)
    try {
      await api.deleteReport(deleteReport.id, deleteReportPassword)
      onReportDeleted(deleteReport.id)
      setDeleteReport(null)
      setDeleteReportPassword('')
      onNotify('结算历史已删除')
    } catch (error) {
      onNotify(error instanceof Error ? error.message : '删除结算历史失败', 'error')
    } finally {
      setIsExportRecordBusy(false)
    }
  }

  return (
    <section className="report-workspace">
      <section className="panel report-control-bar">
        <div className="report-summary-chips">
          <div>
            <span>总工时</span>
            <strong>{activeSummaryStats.totalHours.toFixed(1)}h</strong>
          </div>
          <div>
            <span>计费工时</span>
            <strong>{activeSummaryStats.billableHours.toFixed(1)}h</strong>
          </div>
          <div>
            <span>结算金额</span>
            <strong>¥{formatYuan(activeSummaryStats.amount)}</strong>
          </div>
          <div>
            <span>已验收</span>
            <strong>{activeSummaryStats.accepted} 个</strong>
          </div>
        </div>
        <p className="report-flow-hint">
          当前查看：{hasValidCustomPreviewRange ? activeReceiptLabel : selectedMonthLabel}。分享和锁定互不影响；确认数据不再变动时再到导出记录中手动锁定。
        </p>
        <div className="report-section-tabs" role="tablist" aria-label="结算视图">
          <button type="button" role="tab" aria-selected={reportSectionTab === 'receipt'} className={reportSectionTab === 'receipt' ? 'active' : ''} onClick={() => setReportSectionTab('receipt')}>结算回单</button>
          <button type="button" role="tab" aria-selected={reportSectionTab === 'history'} className={reportSectionTab === 'history' ? 'active' : ''} onClick={() => setReportSectionTab('history')}>导出记录</button>
        </div>

        {reportSectionTab === 'receipt' && <div className="report-range-export">
          <div className="report-range-fields">
            <PlanDateTimeField
              label="自定义导出"
              value={customExportStart}
              onChange={(value) => {
                setCustomExportStart(value)
                setIsCustomRangePreviewActive(true)
              }}
              includeTime={false}
              pickerId="report-range-start"
              activePickerId={activeRangePickerId}
              onActivePickerChange={setActiveRangePickerId}
              commitValidInputOnChange
            />
            <PlanDateTimeField
              label="至"
              value={customExportEnd}
              onChange={(value) => {
                setCustomExportEnd(value)
                setIsCustomRangePreviewActive(true)
              }}
              includeTime={false}
              pickerId="report-range-end"
              activePickerId={activeRangePickerId}
              onActivePickerChange={setActiveRangePickerId}
              commitValidInputOnChange
            />
            <button className="icon-button report-range-icon-button" type="button" onClick={handleExportCustomRange} aria-label="导出范围 Excel" title="导出范围 Excel">
              <Download size={17} />
            </button>
            <button className="icon-button report-range-icon-button" type="button" onClick={handleShareCustomRange} aria-label="分享范围链接" title="分享范围链接">
              <Copy size={17} />
            </button>
            <button className="icon-button report-range-icon-button" type="button" onClick={() => void handleExportCustomPdf()} disabled={isPdfExporting} aria-label="导出范围 PDF" title="导出范围 PDF">
              {isPdfExporting ? <LoaderCircle className="spin" size={17} /> : <FileTextIcon size={17} />}
            </button>
          </div>
          <p>
            {lastLockedExport
              ? `已锁定至 ${formatReceiptDate(lastLockedExport.endDate)}，下次建议从下一天开始，避免重复或漏算。`
              : '可按任意日期范围导出，导出后可锁定记录作为下次核对边界。'}
          </p>
        </div>}

        {reportSectionTab === 'history' && exportRecords.length > 0 && (
          <div className="report-export-history">
            <div className="report-history-header">
              <h3>导出记录</h3>
              <span>按自定义日期范围生成，可分享、下载或锁定</span>
            </div>
            {exportRecords.slice(0, 6).map((record) => (
              <div className="report-history-row report-export-row" key={record.id}>
                <div className="report-history-primary">
                  <strong>{record.label}</strong>
                  <em className="report-history-kind">自定义导出</em>
                </div>
                <span>{record.taskCount} 项 · {record.billableHours.toFixed(1)}h · ¥{formatYuan(record.amount)}</span>
                <small>
                  {record.locked ? '已锁定' : '未锁定'} · 导出于 {record.exportedAt} · {record.disabled ? '链接已停止' : record.expired ? '链接已过期' : record.expiresAt ? `有效至 ${record.expiresAt}` : '永久有效'}
                </small>
                <div className="report-history-actions">
                  <button className="icon-button" disabled={isExportRecordBusy || record.locked} onClick={() => void toggleExportRecordLock(record)} aria-label={record.locked ? '已锁定' : '锁定记录'} title={record.locked ? '已锁定' : '锁定记录'}>
                    <Lock size={15} />
                  </button>
                  <button className="icon-button" onClick={() => void copySettlementShareLink(record)} aria-label="复制链接" title="复制链接">
                    <Copy size={15} />
                  </button>
                  <button className="icon-button" onClick={() => openSettlementAccessManager(record)} aria-label="链接管理" title="链接管理">
                    <Clock3 size={15} />
                  </button>
                  <button className="icon-button" onClick={() => previewSettlementExportRange(record)} aria-label="查看回单" title="查看回单">
                    <Eye size={15} />
                  </button>
                  <a className="icon-button" href={`/api/shared-settlement/${record.publicToken}/excel`} aria-label="下载 Excel" title="下载 Excel">
                    <Download size={15} />
                  </a>
                  <a className="icon-button" href={`/api/shared-settlement/${record.publicToken}/pdf`} aria-label="下载 PDF" title="下载 PDF">
                    <FileTextIcon size={15} />
                  </a>
                  <a className="icon-button" href={`/settlement-share/${record.publicToken}`} target="_blank" rel="noreferrer" aria-label="打开合作伙伴页" title="打开合作伙伴页">
                    <ExternalLink size={15} />
                  </a>
                  <button className="icon-button danger-text" aria-label="删除记录" title="删除记录" onClick={() => {
                    setDeleteExportRecord(record)
                    setDeleteExportPassword('')
                  }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {reportSectionTab === 'history' && reports.length > 0 && (
          <div className="report-history">
            <div className="report-history-header">
              <h3>已锁定快照</h3>
              {reports.length > 1 && (
                <button type="button" onClick={() => setIsHistoryExpanded((expanded) => !expanded)}>
                  {isHistoryExpanded ? '收起' : `展开全部 ${reports.length} 条`}
                </button>
              )}
            </div>
            {visibleReports.map((report) => (
              <div className="report-history-row" key={report.id}>
                <div className="report-history-primary">
                  <strong>{monthDateRangeLabelOf(report.month)}</strong>
                  <em className="report-history-kind">锁定快照</em>
                </div>
                <span>
                  {report.billableHours.toFixed(1)}h · ¥{formatYuan(report.totalAmount)}
                </span>
                <small>
                  锁定于 {report.generatedAt || '—'}
                  {report.viewCount > 0 ? ` · 合作伙伴已查看 ${report.viewCount} 次（最近 ${report.viewedAt}）` : ' · 合作伙伴尚未查看'}
                </small>
                <div className="report-history-actions">
                  <button className="icon-button" disabled aria-label="已锁定" title="已锁定">
                    <Lock size={15} />
                  </button>
                  <button className="icon-button" aria-label={`复制 ${report.month} 合作伙伴链接`} title="复制链接" onClick={() => void copyLockedReportShareLink(report)}>
                    <Copy size={15} />
                  </button>
                  <button className="icon-button" aria-label={`管理 ${report.month} 合作伙伴链接`} title="链接管理" onClick={() => void openLockedReportAccessManager(report)}>
                    <Clock3 size={15} />
                  </button>
                  <button className="icon-button" onClick={() => previewLockedReportRange(report)} aria-label={`查看 ${report.month} 回单`} title="查看回单">
                    <Eye size={15} />
                  </button>
                  <button className="icon-button" aria-label={`下载 ${report.month} Excel 回单`} title="下载 Excel" onClick={() => {
                    const { startDate, endDate } = monthDateRangeOf(report.month)
                    void handleExportUserSheet({
                      startDate,
                      endDate,
                      label: `${startDate.replaceAll('-', '')}-${endDate.replaceAll('-', '')}`,
                    })
                  }}>
                    <Download size={15} />
                  </button>
                  <button className="icon-button" aria-label={`下载 ${report.month} PDF 回单`} title="下载 PDF" onClick={() => {
                    const { startDate, endDate } = monthDateRangeOf(report.month)
                    void handleExportUserSheet({
                      startDate,
                      endDate,
                      label: `${startDate.replaceAll('-', '')}-${endDate.replaceAll('-', '')}`,
                      action: 'pdf',
                    })
                  }}>
                    <FileTextIcon size={15} />
                  </button>
                  <button className="icon-button" aria-label={`打开 ${report.month} 合作伙伴页面`} title="打开合作伙伴页" onClick={() => void openLockedReportSharePage(report)}>
                    <ExternalLink size={15} />
                  </button>
                  <button className="icon-button danger-text" aria-label={`删除 ${report.month} 结算历史`} title="删除" onClick={() => {
                    setDeleteReport(report)
                    setDeleteReportPassword('')
                  }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {reportSectionTab === 'receipt' && <SettlementReceipt options={previewReceiptOptions} />}
      {deleteExportRecord && (
        <ModalShell className="delete-confirm-modal light-confirm-modal settlement-export-delete-modal" labelledBy="delete-settlement-export-title" onClose={() => setDeleteExportRecord(null)}>
          <div className="delete-confirm-copy">
            <h2 id="delete-settlement-export-title">删除这条导出记录？</h2>
            <p>{deleteExportRecord.label}{deleteExportRecord.locked ? ' 已锁定，需要管理员密码才能删除。' : ' 尚未锁定，确认后将直接删除。'}</p>
          </div>
          {deleteExportRecord.locked && (
            <label className="field settlement-export-password-field">
              <span>管理员密码</span>
              <input
                type="password"
                autoComplete="current-password"
                value={deleteExportPassword}
                onChange={(event) => setDeleteExportPassword(event.target.value)}
                placeholder="输入当前管理员登录密码"
                autoFocus
              />
            </label>
          )}
          <div className="delete-confirm-actions">
            <button className="ghost-button" disabled={isExportRecordBusy} onClick={() => setDeleteExportRecord(null)}>取消</button>
            <button className="danger-button solid-danger-button" disabled={isExportRecordBusy || (deleteExportRecord.locked && !deleteExportPassword)} onClick={() => void confirmDeleteExportRecord()}>
              {isExportRecordBusy ? '删除中…' : '确认删除'}
            </button>
          </div>
        </ModalShell>
      )}
      {accessExportRecord && (
        <ModalShell className="settlement-access-modal" labelledBy="settlement-access-title" onClose={() => setAccessExportRecord(null)} closeOnEscape>
          <header className="modal-header">
            <div>
              <p className="eyebrow">链接管理</p>
              <h2 id="settlement-access-title">{accessExportRecord.label}</h2>
            </div>
            <button type="button" className="icon-button modal-close-button" onClick={() => setAccessExportRecord(null)} aria-label="关闭" title="关闭"><X size={18} /></button>
          </header>
          <div className="settlement-access-body">
            <label className="settlement-access-switch">
              <span><strong>允许访问</strong><small>关闭后，已分享的链接会立即失效</small></span>
              <button type="button" className={`switch-control ${!accessDisabled ? 'active' : ''}`} aria-pressed={!accessDisabled} onClick={() => setAccessDisabled((disabled) => !disabled)}><i /></button>
            </label>
            <div className="settlement-expiry-options" aria-label="链接有效期">
              {([
                ['permanent', '永久'],
                ['1', '1 天'],
                ['7', '7 天'],
                ['30', '30 天'],
                ['custom', '自定义'],
              ] as const).map(([value, label]) => (
                <button type="button" key={value} className={accessExpiryMode === value ? 'active' : ''} onClick={() => setAccessExpiryMode(value)}>{label}</button>
              ))}
            </div>
            {accessExpiryMode === 'custom' && (
              <PlanDateTimeField label="有效至" value={accessExpiryDate} onChange={setAccessExpiryDate} includeTime={false} commitValidInputOnChange />
            )}
            <p>{accessDisabled ? '当前链接已停止访问。' : accessExpiryMode === 'permanent' ? '链接将永久有效，除非手动关闭。' : '到期后系统会自动拒绝访问，可随时改回永久有效。'}</p>
          </div>
          <footer className="modal-footer">
            <button className="ghost-button" type="button" onClick={() => setAccessExportRecord(null)}>取消</button>
            <button className="primary-button" type="button" disabled={isExportRecordBusy} onClick={() => void saveSettlementAccess()}>{isExportRecordBusy ? '保存中…' : '保存'}</button>
          </footer>
        </ModalShell>
      )}
      {deleteReport && (
        <ModalShell className="delete-confirm-modal light-confirm-modal settlement-export-delete-modal" labelledBy="delete-report-title" onClose={() => setDeleteReport(null)}>
          <div className="delete-confirm-copy">
            <h2 id="delete-report-title">删除这条结算历史？</h2>
            <p>{monthLabelOf(deleteReport.month)}{deleteReport.status === 'locked' ? ' 已锁定，需要管理员密码才能删除。' : ' 尚未锁定，确认后将直接删除。'}</p>
          </div>
          {deleteReport.status === 'locked' && (
            <label className="field settlement-export-password-field">
              <span>管理员密码</span>
              <input type="password" autoComplete="current-password" value={deleteReportPassword} onChange={(event) => setDeleteReportPassword(event.target.value)} placeholder="输入当前管理员登录密码" autoFocus />
            </label>
          )}
          <div className="delete-confirm-actions">
            <button className="ghost-button" disabled={isExportRecordBusy} onClick={() => setDeleteReport(null)}>取消</button>
            <button className="danger-button solid-danger-button" disabled={isExportRecordBusy || (deleteReport.status === 'locked' && !deleteReportPassword)} onClick={() => void confirmDeleteReport()}>{isExportRecordBusy ? '删除中…' : '确认删除'}</button>
          </div>
        </ModalShell>
      )}
    </section>
  )
}
