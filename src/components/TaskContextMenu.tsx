import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import type { Task } from '../types/domain'
import {
  canRecordNewProgress,
  hasAcceptanceProgress,
  isTaskStarted,
  taskDisplayProgress,
} from '../lib/taskProgress'

type TaskProgressUpdate = {
  progress: number
}

export function CreateTaskContextMenu({
  menu,
  onCreate,
}: {
  menu: { x: number; y: number }
  onCreate: () => void
}) {
  return (
    <div className="task-context-menu create-task-context-menu" style={{ left: menu.x, top: menu.y }} role="menu">
      <button type="button" onClick={onCreate}>
        <Plus size={15} />
        新建任务
      </button>
    </div>
  )
}

export function TaskContextMenu({
  menu,
  onClose,
  onOpenTask,
  onOpenEditTask,
  onOpenAcceptance,
  onOpenProgress,
  onUpdateTask,
  onVoidTask,
  onRestoreTask,
  onDeleteTask,
  canWrite,
  canDelete,
}: {
  menu: { x: number; y: number; task: Task }
  onClose: () => void
  onOpenTask: (taskId: number) => void
  onOpenEditTask: (taskId: number) => void
  onOpenAcceptance: (task: Task) => void
  onOpenProgress: (task: Task) => void
  onUpdateTask: (taskId: number, changes: TaskProgressUpdate) => void
  onVoidTask: (taskId: number) => void
  onRestoreTask: (taskId: number) => void
  onDeleteTask: (taskId: number) => void
  canWrite: boolean
  canDelete: boolean
}) {
  const run = (action: () => void) => {
    action()
    onClose()
  }

  const isVoided = Boolean(menu.task.voidedAt)
  const canRecordProgress = canRecordNewProgress(menu.task)
  const canAdjustProgress = canRecordProgress && isTaskStarted(menu.task)
  const hasAcceptanceClosure = menu.task.status === '已验收' || hasAcceptanceProgress(menu.task)
  const progressOptions = [0, 20, 40, 60, 80, 100]
  const snappedProgress = taskDisplayProgress(menu.task)

  return (
    <div className="task-context-menu" style={{ left: menu.x, top: menu.y }} role="menu">
      <button type="button" onClick={() => run(() => onOpenTask(menu.task.id))}>
        <Eye size={15} />
        查看任务详情
      </button>
      {!isVoided && canWrite && (
        <>
          <button type="button" onClick={() => run(() => onOpenEditTask(menu.task.id))}>
            <Pencil size={15} />
            编辑任务
          </button>
          <button type="button" disabled={!canRecordProgress} title={canRecordProgress ? (menu.task.status === '计划中' ? '记录进展并自动进入进行中' : '记录进展') : '已进入验收闭环，需先编辑或删除验收进展'} onClick={() => run(() => onOpenProgress(menu.task))}>
            <BarChart3 size={15} />
            记录进展
          </button>
          {canDelete && <button type="button" disabled={menu.task.status !== '待验收'} onClick={() => run(() => onOpenAcceptance(menu.task))}>
            <ClipboardCheck size={15} />
            {menu.task.status === '待验收' ? '去验收' : '去验收（非待验收）'}
          </button>}
        </>
      )}
      {!isVoided && canWrite && !hasAcceptanceClosure && (
        <div className="context-submenu">
          <button type="button" className="context-menu-parent" aria-haspopup="menu" disabled={!canAdjustProgress} title={canAdjustProgress ? '快速改进度' : '首次记录进展后可调整进度'}>
            <BarChart3 size={15} />
            快速改进度
            <span>{snappedProgress}%</span>
            <ChevronRight size={14} />
          </button>
          <div className="context-submenu-panel progress-submenu-panel" role="menu">
            {progressOptions.map((progress) => {
              const active = snappedProgress === progress
              return (
                <button type="button" key={progress} className={active ? 'selected' : ''} disabled={!canAdjustProgress} onClick={() => run(() => onUpdateTask(menu.task.id, { progress }))}>
                  {active ? <CheckCircle2 size={15} /> : <BarChart3 size={15} />}
                  {progress}%
                </button>
              )
            })}
          </div>
        </div>
      )}
      {isVoided && canDelete && (
        <button type="button" onClick={() => run(() => onRestoreTask(menu.task.id))}>
          <RotateCcw size={15} />
          恢复任务
        </button>
      )}
      {canDelete && <div className="context-menu-separator" />}
      {canDelete && (isVoided ? (
        <button type="button" className="danger" onClick={() => run(() => onDeleteTask(menu.task.id))}>
          <Trash2 size={15} />
          永久删除
        </button>
      ) : (
        <button type="button" className="danger" onClick={() => run(() => onVoidTask(menu.task.id))}>
          <Trash2 size={15} />
          作废任务
        </button>
      ))}
    </div>
  )
}
