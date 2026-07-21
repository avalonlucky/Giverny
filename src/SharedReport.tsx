import { useEffect, useState } from 'react'
import { Download, Eye, ExternalLink, FileArchive, FileText, Paperclip, X } from 'lucide-react'
import { defaultPdfTitle, defaultServiceCompanyName } from './config/appConfig'
import { api, type SharedReportState } from './lib/api'
import { buildReceiptExcelBuffer, type ReceiptExcelRow } from './lib/receiptExcel'
import { SettlementReceipt } from './components/SettlementReceipt'
import type { FileAsset } from './types/domain'
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

function SharedFilePreviewModal({ file, onClose }: { file: FileAsset; onClose: () => void }) {
  const fileType = file.type.toUpperCase()
  const sourceUrl = file.sourceUrl ?? ''
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section className="task-modal file-preview-modal" role="dialog" aria-modal="true" aria-labelledby="shared-preview-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">文件预览</p>
            <h2 id="shared-preview-title">{file.name}</h2>
          </div>
          <button className="icon-button modal-close-button" aria-label="关闭" title="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="file-preview-body">
          {file.previewUrl ? (
            <img src={file.previewUrl} alt={file.name} loading="lazy" />
          ) : sourceUrl && fileType === 'PDF' ? (
            <iframe className="file-preview-frame" src={sourceUrl} title={file.name} />
          ) : (
            <div className="file-preview-placeholder">
              {fileType === 'PDF' ? <FileText size={42} /> : <FileArchive size={42} />}
              <strong>{file.type}</strong>
              <span>{sourceUrl ? '该格式暂无在线预览图，可以直接打开源文件。' : '该文件暂无在线预览图，如需源文件请联系设计师。'}</span>
              {sourceUrl && (
                <a className="primary-button compact-button" href={sourceUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={15} />
                  打开源文件
                </a>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default function SharedReport({ token }: { token: string }) {
  const [state, setState] = useState<SharedReportState | null>(null)
  const [error, setError] = useState('')
  const [previewFile, setPreviewFile] = useState<FileAsset | null>(null)

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

        {(files.length > 0 || updates.length > 0) && (
          <section className="shared-receipt-appendix">
            {files.length > 0 && (
              <div>
                <h2>交付文件</h2>
                <div className="shared-file-list">
                  {files.map((file) => (
                    <button type="button" key={file.id} onClick={() => setPreviewFile(file)}>
                      <Paperclip size={15} />
                      <span>{file.name}</span>
                      <Eye size={15} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {updates.length > 0 && (
              <div>
                <h2>验收与进展记录</h2>
                <div className="shared-update-list">
                  {updates.map((update) => (
                    <article key={update.id}>
                      <time>{datePart(update.date)}</time>
                      <strong>{update.title}</strong>
                      <p>{update.body}</p>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
        <footer className="shared-footer">本页面为只读结算回单，由 Giverny 自动生成。</footer>
      </div>
      {previewFile && <SharedFilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
    </main>
  )
}
