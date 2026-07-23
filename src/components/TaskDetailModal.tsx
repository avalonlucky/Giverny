import { BarChart3, Pencil, X } from 'lucide-react'
import { ModalShell } from './ModalShell'
import { StatusBadge, StatusDotLabel } from './TaskUi'
import { formatPlanDateTime, isoDate } from '../lib/dateTime'
import { isSupplementalTask, sumTimeEntries, sumWaitingEntries } from '../lib/taskAccounting'
import { taskSettlementMonth } from '../lib/taskSettlement'
import { taskDisplayProgress } from '../lib/taskProgress'
import { taskDueState } from '../lib/taskListPresentation'
import { monthLabelOf } from '../lib/month'
import type { Task } from '../types/domain'

export function TaskDetailModal({
  task,
  onClose,
  onOpenAcceptance,
  canAccept,
  onOpenEdit,
  onOpenProgress,
}: {
  task: Task
  onClose: () => void
  onOpenAcceptance: (taskId: number) => void
  canAccept: boolean
  onOpenEdit: (taskId: number) => void
  onOpenProgress: (taskId: number) => void
}) {
  const dueState = taskDueState(task, isoDate(), isoDate(3))
  const actualMinutes = sumTimeEntries(task.timeEntries ?? [])
  const waitingMinutes = sumWaitingEntries(task)
  const actualHoursText = actualMinutes > 0 ? `${(actualMinutes / 60).toFixed(2)} h（共 ${(task.timeEntries ?? []).length} 段）` : `${task.actualHours.toFixed(2)} h`
  const actualH = actualMinutes > 0 ? actualMinutes / 60 : task.actualHours
  const estimatedH = task.estimatedHours
  const hoursDevPct = estimatedH > 0 && actualH > 0 ? Math.round(((actualH - estimatedH) / estimatedH) * 100) : null
  const waitingHoursText = `${(waitingMinutes / 60).toFixed(2)} h（共 ${(task.waitingEntries ?? []).length} 段）`

  return (
    <ModalShell className="task-detail-modal" labelledBy="task-detail-title" onClose={onClose}>
      <header className="modal-header">
        <div><p className="eyebrow">{task.type} · {task.contact || '待确认'}</p><h2 id="task-detail-title">{task.title}</h2></div>
        <div className="modal-header-actions">
          {task.status === '待验收' && canAccept ? (
            <button type="button" className="status-badge status-待验收 detail-acceptance-status-button" aria-label="去验收" title="去验收" onClick={() => onOpenAcceptance(task.id)}>
              <span className="status-label-default">待验收</span><span className="status-label-hover">去验收</span>
            </button>
          ) : <StatusBadge status={task.status} />}
          <button className="icon-button modal-close-button" aria-label="关闭" title="关闭" onClick={onClose}><X size={18} /></button>
        </div>
      </header>
      <div className="task-detail-body task-detail-summary-body">
        <section className="task-detail-summary">
          <dl>
            <div className="wide"><dt>任务名称</dt><dd>{task.title}</dd></div>
            <div><dt>设计类型</dt><dd>{task.type || '未填写'}</dd></div>
            <div><dt>对接人</dt><dd>{task.contact || '待确认'}</dd></div>
            <div><dt>需求人</dt><dd>{task.requester || '未填写'}</dd></div>
            <div><dt>验收人</dt><dd>{task.reviewer || '未填写'}</dd></div>
            <div className="wide"><dt>任务需求</dt><dd>{task.requirement || '未填写'}</dd></div>
            {isSupplementalTask(task) && <div className="wide"><dt>补录说明</dt><dd className="supplemental-note-content">{task.supplementalNote || '未填写'}</dd></div>}
            <div><dt>预计开始</dt><dd>{task.date ? formatPlanDateTime(task.date) : '未设置'}</dd></div>
            <div><dt>预计交付</dt><dd>{task.estimatedDate ? formatPlanDateTime(task.estimatedDate) : '未设置'}{dueState ? <span className={`due-tag ${dueState}`}>{dueState === 'overdue' ? '已逾期' : '临期'}</span> : null}</dd></div>
            <div><dt>任务状态</dt><dd><StatusDotLabel status={task.status} /></dd></div>
            <div><dt>当前进度</dt><dd>{taskDisplayProgress(task)}%</dd></div>
            <div><dt>实际工时</dt><dd>{actualHoursText}{estimatedH > 0 && <span className="hours-vs-estimate">{' / 预估 '}{estimatedH.toFixed(2)} h{hoursDevPct !== null && <span className={`hours-dev-badge ${hoursDevPct > 0 ? 'over' : 'under'}`}>{hoursDevPct > 0 ? `+${hoursDevPct}%` : `${hoursDevPct}%`}</span>}</span>}</dd></div>
            {waitingMinutes > 0 && <div><dt>等待记录</dt><dd className="admin-only-data">{waitingHoursText}</dd></div>}
            {task.feedbackRating && <div><dt>任务体感</dt><dd className="task-feedback-detail admin-only-data"><span>{task.feedbackRating}</span>{(task.feedbackTags ?? []).map((tag) => <em key={tag}>{tag}</em>)}</dd></div>}
            {task.feedbackNote && <div className="wide"><dt>体感评价</dt><dd className="admin-only-data">{task.feedbackNote}</dd></div>}
            <div><dt>结算月份</dt><dd>{monthLabelOf(taskSettlementMonth(task))}{isSupplementalTask(task) ? <span className="supplement-inline">补录</span> : null}</dd></div>
          </dl>
          <div className="task-detail-progress"><div className="large-meter"><span style={{ width: `${taskDisplayProgress(task)}%` }} /></div><strong>{taskDisplayProgress(task)}%</strong></div>
        </section>
      </div>
      <footer className="modal-footer">
        <button className="text-button task-detail-footer-btn" onClick={() => onOpenProgress(task.id)}><BarChart3 size={15} />进展</button>
        <button className="text-button task-detail-footer-btn" onClick={() => onOpenEdit(task.id)}><Pencil size={15} />去编辑</button>
      </footer>
    </ModalShell>
  )
}
