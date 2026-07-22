import { CheckCircle2, Trash2 } from 'lucide-react'
import { ModalShell } from './ModalShell'

export type ConfirmDialogState = {
  eyebrow?: string
  title: string
  body: string
  confirmText: string
  cancelText?: string
  tone?: 'danger' | 'default'
  details?: string[]
  hideIcon?: boolean
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialogModal({
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
    <ModalShell
      className={`delete-confirm-modal confirm-dialog-modal ${isDanger ? 'danger-confirm' : ''} ${dialog.hideIcon ? 'compact-confirm-dialog' : ''}`}
      labelledBy="confirm-dialog-title"
      onClose={onClose}
    >
      {!dialog.hideIcon && (
        <div className="delete-confirm-icon">
          {isDanger ? <Trash2 size={24} /> : <CheckCircle2 size={24} />}
        </div>
      )}
      <div className="delete-confirm-copy">
        {dialog.eyebrow && <p className="eyebrow">{dialog.eyebrow}</p>}
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
