import { useEffect, useState } from 'react'
import { Download, Eye, ExternalLink, FileArchive, FileText, Paperclip, Sparkles, X } from 'lucide-react'
import { defaultPdfTitle, defaultServiceCompanyName } from './config/appConfig'
import { api, type SharedReportState } from './lib/api'
import { toChineseAmount } from './lib/format'
import type { FileAsset } from './types/domain'
import './App.css'

// 金额展示：真实保留小数（最多两位），不四舍五入到元
const formatYuan = (value: number) =>
  (Math.round(value * 100) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

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
  // 不计费任务（免费协助）：以 ¥0 行体现在回单里，不计入合计金额
  const freeTasks = tasks.filter((task) => task.billable === false || task.status === '不计费')
  // 用精确单价（不取整）反推，保证每行金额之和恰好等于已锁定的总额
  const hourlyRate = report.billableHours > 0 ? report.totalAmount / report.billableHours : 0
  const receiptNo = `AK-${report.month.replace('-', '')}-${String(billableTasks.length + 1).padStart(3, '0')}`
  const acceptedCount = tasks.filter((task) => task.status === '已验收').length
  const pendingCount = tasks.filter((task) => task.status === '待验收').length

  const handleExportPdf = () => {
    const previousTitle = document.title
    document.title = `${pdfTitle}_${report.month}`
    window.print()
    document.title = previousTitle
  }

  const handleExportUserSheet = async () => {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('User')
    sheet.columns = [
      { header: '参考开始日期', key: 'start', width: 16 },
      { header: '设计类型', key: 'type', width: 18 },
      { header: '项目/任务名称', key: 'title', width: 34 },
      { header: '具体任务需求', key: 'requirement', width: 46 },
      { header: '需求人', key: 'requester', width: 14 },
      { header: '实际工时', key: 'actualHours', width: 12 },
      { header: '状态', key: 'status', width: 12 },
      { header: '验收人/确认', key: 'reviewer', width: 14 },
      { header: '验收备注', key: 'acceptanceNote', width: 48 },
    ]
    billableTasks.forEach((task) => {
      sheet.addRow({
        start: formatPublicDate(task.date),
        type: task.type,
        title: task.title,
        requirement: task.requirement || '',
        requester: task.requester || task.contact || '',
        actualHours: task.actualHours,
        status: task.status,
        reviewer: task.reviewer || task.requester || '',
        acceptanceNote: task.acceptanceNote || '',
      })
    })
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F3EE' } }
    sheet.eachRow((row) => {
      row.alignment = { vertical: 'top', wrapText: true }
    })
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `User_${monthLabel(report.month).replace(/\s/g, '')}_工时明细.xlsx`
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
              下载 User 表
            </button>
            <button type="button" onClick={handleExportPdf}>
              <Download size={16} />
              下载 PDF
            </button>
          </div>
        </header>

        <section className="receipt receipt-template-min shared-receipt" aria-label="月度结算回单" data-company={serviceCompanyName}>
          <header className="receipt-header">
            <div className="receipt-brand">
              <span className="receipt-mark"><Sparkles size={16} /></span>
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
              <span>锁定时间：{report.generatedAt || '—'}</span>
            </div>
          </header>
          <div className="receipt-rule" />
          <dl className="receipt-info">
            <div><dt>客户名称</dt><dd>{serviceCompanyName}</dd></div>
            <div><dt>服务内容</dt><dd>平面设计兼职</dd></div>
            <div><dt>结算月份</dt><dd>{monthLabel(report.month)}</dd></div>
            <div><dt>结算单价</dt><dd>¥{formatYuan(hourlyRate)} / 小时</dd></div>
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
                  <td>
                    {monthLabel(task.settlementMonth || report.month)}
                    {task.settlementMonth && task.settlementMonth !== monthPart(task.date) ? '（补录）' : ''}
                  </td>
                  <td className="receipt-task-name">{task.title}</td>
                  <td>{task.type}</td>
                  <td className="num">{task.actualHours.toFixed(1)}</td>
                  <td className="num">{formatYuan(task.actualHours * hourlyRate)}</td>
                </tr>
              ))}
              {freeTasks.map((task, index) => (
                <tr key={task.id} className="receipt-free-row">
                  <td>{String(billableTasks.length + index + 1).padStart(2, '0')}</td>
                  <td>{monthLabel(task.settlementMonth || report.month)}</td>
                  <td className="receipt-task-name">{task.title} <em className="receipt-free-tag">不计费</em></td>
                  <td>{task.type}</td>
                  <td className="num">{task.actualHours.toFixed(1)}</td>
                  <td className="num">¥0</td>
                </tr>
              ))}
              {billableTasks.length === 0 && freeTasks.length === 0 && (
                <tr><td className="receipt-empty" colSpan={6}>本月暂无可纳入结算的任务</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>合计</td>
                <td className="num">{report.billableHours.toFixed(1)}</td>
                <td className="num">¥{formatYuan(report.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="receipt-amount">
            <span>人民币（大写）</span>
            <strong>{toChineseAmount(report.totalAmount)}</strong>
          </div>
          <div className="receipt-remarks">
            <p>备注：本月共 {tasks.length} 项任务，已验收 {acceptedCount} 项，待验收 {pendingCount} 项。</p>
            <p>本回单由系统根据已锁定的任务与工时记录自动生成。</p>
            <div className="receipt-stamp" aria-hidden="true">
              <span>{serviceCompanyName}</span>
              <em>★</em>
              <span>工时结算确认</span>
            </div>
          </div>
          <div className="receipt-cutline"><span>✂</span></div>
        </section>

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
