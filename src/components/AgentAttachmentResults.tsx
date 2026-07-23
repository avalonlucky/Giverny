import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Download, Eye, FileText, Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react'
import microsoftExcelIcon from '../assets/microsoft-excel.svg?url'
import { authedPreviewUrl } from '../lib/api'
import type { ReceiptExcelOptions } from '../lib/receiptExcel'
import type { FileAsset } from '../types/domain'
import type { AgentResultAttachment } from '../types/agent'
import { FilePreviewModal } from './FilePreviewModal'
import { FileThumbnailPreview } from './FileThumbnailPreview'
import { ModalShell } from './ModalShell'
import { SettlementReceipt } from './SettlementReceipt'

function agentResultAttachmentToFile(file: AgentResultAttachment): FileAsset {
  return {
    id: typeof file.id === 'number' ? file.id : 0,
    taskId: file.taskId,
    scope: file.scope,
    name: file.name,
    task: file.taskTitle,
    type: file.type,
    mimeType: file.mimeType,
    size: file.size,
    uploadedAt: file.uploadedAt,
    final: file.scope === 'acceptance',
    visible: false,
    tag: file.tag,
    previewUrl: file.previewUrl,
    sourceUrl: file.downloadUrl || file.sourceUrl,
  }
}

function settlementReceiptRangeLabel(name: string) {
  const matched = name.match(/_(\d{4})(\d{2})(\d{2})-(\d{4})(\d{2})(\d{2})/)
  if (!matched) return name.replace(/\.xlsx$/i, '')
  const [, startYear, startMonth, startDay, endYear, endMonth, endDay] = matched
  const start = `${startYear}/${startMonth}/${startDay}`
  const end = `${endYear}/${endMonth}/${endDay}`
  return `${start} 至 ${end}`
}

function AgentSettlementReceiptPreview({ attachment, onClose }: { attachment: AgentResultAttachment; onClose: () => void }) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [receipt, setReceipt] = useState<ReceiptExcelOptions | null>(null)
  const [error, setError] = useState('')
  const [scale, setScale] = useState(0.42)
  const shareToken = attachment.shareUrl?.split('/').filter(Boolean).at(-1) ?? ''

  const fitReceipt = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    setScale(Math.max(0.25, Math.min(1, (viewport.clientWidth - 32) / 2200)))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const loadReceipt = async () => {
      if (!shareToken) {
        setError('该回单缺少在线预览地址，请重新导出。')
        return
      }
      try {
        const response = await fetch(`/api/shared-settlement/${encodeURIComponent(shareToken)}`, { signal: controller.signal })
        const payload = await response.json().catch(() => null) as { receipt?: ReceiptExcelOptions; error?: string } | null
        if (!response.ok || !payload?.receipt) throw new Error(payload?.error || '回单读取失败')
        setReceipt(payload.receipt)
        window.requestAnimationFrame(fitReceipt)
      } catch (caughtError) {
        if (!controller.signal.aborted) setError(caughtError instanceof Error ? caughtError.message : '回单读取失败')
      }
    }
    void loadReceipt()
    return () => controller.abort()
  }, [fitReceipt, shareToken])

  const changeScale = (delta: number) => setScale((current) => Math.max(0.25, Math.min(1.5, Number((current + delta).toFixed(2)))))

  return createPortal(
    <ModalShell className="agent-receipt-preview-modal" labelledBy="agent-receipt-preview-title" onClose={onClose} closeOnEscape>
      <header className="modal-header agent-receipt-preview-header">
        <div>
          <p className="eyebrow">回单预览</p>
          <h2 id="agent-receipt-preview-title">{settlementReceiptRangeLabel(attachment.name)}</h2>
        </div>
        <div className="modal-header-actions">
          <button type="button" className="icon-button" onClick={() => changeScale(-0.08)} disabled={scale <= 0.25} aria-label="缩小" title="缩小"><ZoomOut size={16} /></button>
          <button type="button" className="agent-receipt-scale" onClick={() => setScale(1)} aria-label="按 1 比 1 显示" title="1:1 原始尺寸">1:1</button>
          <button type="button" className="icon-button" onClick={() => changeScale(0.08)} disabled={scale >= 1.5} aria-label="放大" title="放大"><ZoomIn size={16} /></button>
          <button type="button" className="icon-button" onClick={fitReceipt} aria-label="适合窗口" title="适合窗口"><Maximize2 size={16} /></button>
          <button type="button" className="icon-button modal-close-button" onClick={onClose} aria-label="关闭" title="关闭"><X size={18} /></button>
        </div>
      </header>
      <div ref={viewportRef} className="agent-receipt-preview-viewport">
        {!receipt && !error && <div className="office-preview-status">正在加载完整回单…</div>}
        {error && <div className="file-preview-placeholder"><FileText size={38} /><strong>暂时无法预览</strong><span>{error}</span></div>}
        {receipt && (
          <div className="agent-receipt-preview-sheet" style={{ zoom: scale } as CSSProperties}>
            <SettlementReceipt options={receipt} />
          </div>
        )}
      </div>
    </ModalShell>,
    document.body,
  )
}

export function AgentResultPreviewModal({ attachment, onClose }: { attachment: AgentResultAttachment; onClose: () => void }) {
  if (attachment.kind === 'settlement-receipt') return <AgentSettlementReceiptPreview attachment={attachment} onClose={onClose} />
  return <FilePreviewModal file={agentResultAttachmentToFile(attachment)} onClose={onClose} />
}

export function AgentAttachmentResults({ attachments, onPreview }: { attachments: AgentResultAttachment[]; onPreview: (attachment: AgentResultAttachment) => void }) {
  const isSettlementBatch = attachments.every((item) => item.kind === 'settlement-receipt')
  return (
    <section className={`agent-attachment-results ${isSettlementBatch ? 'is-settlement-receipt' : ''}`} aria-label={`附件结果，共 ${attachments.length} 个`}>
      <header className="agent-attachment-results-header">
        <div>
          <small>{isSettlementBatch ? '已生成文件' : '找到的真实文件'}</small>
          <strong>{isSettlementBatch ? '导出结果' : '附件'}</strong>
        </div>
        <span>{attachments.length} 个</span>
      </header>
      <div className="agent-attachment-grid">
        {attachments.map((attachment) => {
          const file = agentResultAttachmentToFile(attachment)
          const isSettlementReceipt = attachment.kind === 'settlement-receipt'
          return (
            <article className={`agent-attachment-card ${isSettlementReceipt ? 'is-settlement-receipt' : ''}`} key={attachment.id}>
              <button type="button" className="agent-attachment-preview" onClick={() => onPreview(attachment)} aria-label={`预览 ${attachment.name}`} title="预览附件">
                {isSettlementReceipt ? <span className="agent-receipt-file-mark"><img src={microsoftExcelIcon} alt="Microsoft Excel" /></span> : <FileThumbnailPreview file={file} />}
              </button>
              <div className="agent-attachment-info">
                <strong title={attachment.name}>{isSettlementReceipt ? settlementReceiptRangeLabel(attachment.name) : attachment.name}</strong>
                <span title={attachment.taskTitle}>{isSettlementReceipt ? 'Excel 工作簿' : attachment.taskTitle}</span>
                <small>{isSettlementReceipt ? '可预览、在线查看或下载' : [attachment.type, attachment.size, attachment.tag || (attachment.scope === 'acceptance' ? '验收附件' : '进展附件')].filter(Boolean).join(' · ')}</small>
              </div>
              <div className="agent-attachment-actions">
                <button type="button" className="ghost-button compact-button" onClick={() => onPreview(attachment)}><Eye size={13} />预览</button>
                {attachment.shareUrl && <a className="ghost-button compact-button" href={attachment.shareUrl} target="_blank" rel="noreferrer"><Eye size={13} />在线预览</a>}
                <a className="ghost-button compact-button" href={authedPreviewUrl(attachment.downloadUrl || attachment.sourceUrl)} target="_blank" rel="noreferrer"><Download size={13} />{isSettlementReceipt ? '下载' : '打开'}</a>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
