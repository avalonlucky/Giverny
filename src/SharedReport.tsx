import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { defaultPdfTitle, defaultServiceCompanyName } from './config/appConfig'
import { api, type SharedReportState } from './lib/api'
import { buildReceiptExcelBuffer, type ReceiptExcelRow } from './lib/receiptExcel'
import { SettlementReceipt } from './components/SettlementReceipt'
import { SharedProjectAppendix } from './components/SharedProjectAppendix'
import './App.css'

function monthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return `${year} 年 ${monthNumber} 月`
}

function datePart(value: string) {
  return value.slice(0, 10)
}

function formatPublicDate(value: string) {
  return datePart(value).replaceAll('-', '/')
}

export default function SharedReport({ token }: { token: string }) {
  const [state, setState] = useState<SharedReportState | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .getSharedReport(token)
       
      .then(setState)
      .catch((cause) => setError(cause instanceof Error ? cause.message : '加载失败'))
  }, [token])

  if (error) {
    return (
      <main className="shared-page">
        <div className="shared-message panel">
          <strong>无法打开该报告</strong>
          <p>{error}</p>
        </div>
      </main>
    )
  }

  if (!state) {
    return (
      <main className="shared-page">
        <div className="shared-message panel">
          <strong>正在加载报告…</strong>
        </div>
      </main>
    )
  }

  const { report, tasks, updates, files } = state
  const pdfTitle = state.settings?.pdfTitle || defaultPdfTitle
  const serviceCompanyName = state.settings?.serviceCompanyName || defaultServiceCompanyName
  // 计费口径与主应用一致：状态不影响计费，只排除「不计费」；仅展示有工时的计费行
  const billableTasks = tasks.filter((task) => task.billable !== false && task.status !== '不计费' && task.actualHours > 0)
  // 用精确单价（不取整）反推，保证每行金额之和恰好等于已锁定的总额
  const hourlyRate = report.billableHours > 0 ? report.totalAmount / report.billableHours : 0
  const receiptNo = `AK-${report.month.replace('-', '')}-${String(billableTasks.length + 1).padStart(3, '0')}`
  const fileLabel = monthLabel(report.month).replace(/\s/g, '')
  const receiptRows: ReceiptExcelRow[] = billableTasks.map((task, index) => ({
    taskId: task.id,
    sequence: String(index + 1).padStart(2, '0'),
    type: task.type,
    title: task.title,
    requirement: task.requirement || '',
    estimatedStartDate: formatPublicDate(task.date),
    actualCompletionDate: formatPublicDate(task.actualDeliveryDate || task.estimatedDate || task.date),
    requester: task.requester || task.contact || '—',
    contact: task.contact || task.requester || '—',
    status: task.status,
    estimatedHours: Number(task.estimatedHours) || null,
    actualHours: task.actualHours,
    unitPrice: hourlyRate,
    amount: Math.round(task.actualHours * hourlyRate * 100) / 100,
    acceptanceNote: task.acceptanceNote || '—',
  }))
  const receiptOptions = {
    fileLabel,
    title: pdfTitle,
    receiptNo,
    issuedAt: report.generatedAt || new Date().toLocaleString('zh-CN', { hour12: false }),
    companyName: serviceCompanyName,
    serviceName: '平面设计兼职',
    settlementLabel: monthLabel(report.month),
    hourlyRate,
    rows: receiptRows,
    totalHours: report.billableHours,
    totalAmount: report.totalAmount,
  }

  const handleExportPdf = () => {
    const previousTitle = document.title
    document.title = `${pdfTitle}_${report.month}`
    window.print()
    document.title = previousTitle
  }

  const handleExportUserSheet = async () => {
    const buffer = await buildReceiptExcelBuffer(receiptOptions)
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `结算回单_${fileLabel}.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="shared-page">
      <div className="shared-content shared-receipt-view">
        <header className="shared-receipt-toolbar">
          <div>
            <h1>结算回单</h1>
            <p>{monthLabel(report.month)} · 数据已锁定，只读查看</p>
          </div>
          <div className="shared-receipt-actions">
            <button type="button" onClick={() => void handleExportUserSheet()}>
              <Download size={16} />
              下载 Excel 回单
            </button>
            <button type="button" onClick={handleExportPdf}>
              <Download size={16} />
              下载 PDF
            </button>
          </div>
        </header>

        <SettlementReceipt options={receiptOptions} className="shared-receipt" />

        <SharedProjectAppendix tasks={billableTasks} updates={updates} files={files} />
        <footer className="shared-footer">本页面为只读结算回单，由 Giverny 自动生成。</footer>
      </div>
    </main>
  )
}
