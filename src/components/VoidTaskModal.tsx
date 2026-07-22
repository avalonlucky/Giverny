import type { Task } from '../types/domain'
import { ModalShell } from './ModalShell'

export function VoidTaskModal({
  task,
  monthLabel,
  isBusy,
  onClose,
  onConfirm,
}: {
  task: Task
  monthLabel: string
  isBusy: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const submit = () => {
    if (isBusy) {
      return
    }
    onConfirm('')
  }

  return (
    <ModalShell className="delete-confirm-modal void-task-modal danger-confirm light-confirm-modal" labelledBy="void-task-title" onClose={onClose}>
      <div className="delete-confirm-copy">
        <h2 id="void-task-title">确定作废「{task.title}」吗？</h2>
        <p>作废后，这个任务不会计入工时、收入和结算；管理员仍可在数据中保留记录，避免误删真实历史。</p>
      </div>
      <div className="delete-confirm-meta">
        <span>{task.type}</span>
        <span>{monthLabel}</span>
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
