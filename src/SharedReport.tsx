import { useEffect, useState } from 'react'
import { Archive, BarChart3, CheckCircle2, Clock3, Download, Eye, FileArchive, FileText, Paperclip, Sparkles, X } from 'lucide-react'
import { defaultPdfTitle, defaultServiceCompanyName } from './config/appConfig'
import { api, type SharedReportState } from './lib/api'
import type { FileAsset, TaskStatus } from './types/domain'
import './App.css'

function monthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return `${year} 年 ${monthNumber} 月`
}

function datePart(value: string) {
  return value.slice(0, 10)
}

function monthPart(value: string) {
  return datePart(value).slice(0, 7)
}

function formatPublicDate(value: string) {
  return datePart(value).replaceAll('-', '/')
}

function SharedStatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`status-badge status-${status}`}>{status}</span>
}

function SharedStatCard({ label, value, trend, icon }: { label: string; value: string; trend: string; icon: React.ReactNode }) {
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

function SharedFilePreviewModal({ file, onClose }: { file: FileAsset; onClose: () => void }) {
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
            <img src={file.previewUrl} alt={file.name} />
          ) : (
            <div className="file-preview-placeholder">
              {file.type === 'PDF' ? <FileText size={42} /> : <FileArchive size={42} />}
              <strong>{file.type}</strong>
              <span>该文件暂无在线预览图，如需源文件请联系设计师。</span>
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

  const handleExportPdf = () => {
    const previousTitle = document.title
    document.title = `${pdfTitle}_${report.month}`
    window.print()
    document.title = previousTitle
  }

  return (
    <main className="shared-page">
      <div className="shared-content client-view">
        <section className="client-hero panel">
          <div>
            <p className="eyebrow">
              <Sparkles size={14} /> {serviceCompanyName} · 设计服务月度报告
            </p>
            <h2>{monthLabel(report.month)}{pdfTitle}</h2>
            <p>
              本报告由工时系统生成，结算数据已于 {report.generatedAt || '锁定时'} 锁定。包含任务明细、进展记录和可在线预览的交付文件。
            </p>
          </div>
          <button className="primary-button" onClick={handleExportPdf}>
            <Download size={18} />
            下载 PDF
          </button>
        </section>

        <section className="stats-grid">
          <SharedStatCard label="总工时" value={`${report.totalHours.toFixed(1)}h`} trend="本月投入" icon={<Clock3 size={20} />} />
          <SharedStatCard label="计费工时" value={`${report.billableHours.toFixed(1)}h`} trend="已排除不计费项" icon={<CheckCircle2 size={20} />} />
          <SharedStatCard label="结算金额" value={`¥${report.totalAmount.toLocaleString()}`} trend="已锁定快照" icon={<BarChart3 size={20} />} />
          <SharedStatCard label="交付文件" value={`${files.length}`} trend="点击可在线预览" icon={<Archive size={20} />} />
        </section>

        <section className="client-grid">
          <div className="panel">
            <div className="panel-header compact">
              <div>
                <h2>任务明细</h2>
                <p>本月计费与交付相关任务</p>
              </div>
            </div>
            {tasks.length === 0 && <p className="calendar-empty-hint">本月暂无任务记录。</p>}
            {tasks.map((task) => (
              <div className="client-task-row" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <span>
                    {formatPublicDate(task.date)}
                    {task.settlementMonth && task.settlementMonth !== monthPart(task.date) ? ` · 补录至 ${monthLabel(task.settlementMonth)}` : ''}
                    {' · '}
                    {task.requirement}
                  </span>
                </div>
                <em>{task.actualHours.toFixed(1)}h</em>
                <SharedStatusBadge status={task.status} />
              </div>
            ))}
          </div>

          <aside className="panel">
            <div className="panel-header compact">
              <div>
                <h2>交付文件</h2>
                <p>点击文件即可在线预览</p>
              </div>
            </div>
            <div className="client-files">
              {files.length === 0 && <p className="calendar-empty-hint">本月暂无可见文件。</p>}
              {files.map((file) => (
                <button className="client-file-row" key={file.id} onClick={() => setPreviewFile(file)}>
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
              <p>按时间倒序</p>
            </div>
          </div>
          <div className="timeline">
            {updates.length === 0 && <p className="calendar-empty-hint">本月暂无可见进展。</p>}
            {updates.map((update) => (
              <article className="timeline-item" key={update.id}>
                <span className="dot" />
                <time>{datePart(update.date)}</time>
                <h3>{update.title}</h3>
                <p>{update.body}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="shared-footer">本页面为只读报告，由 Giverny 自动生成。</footer>
      </div>
      {previewFile && <SharedFilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
    </main>
  )
}
