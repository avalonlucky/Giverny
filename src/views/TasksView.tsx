import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import {
  Archive,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  List,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  RotateCcw,
} from 'lucide-react'
import type { DesignTypeGroup } from '../config/appConfig'
import type { TaskProgressAssessment } from '../lib/api'
import { monthLabelOf } from '../lib/month'
import { canRecordNewProgress, taskDisplayProgress } from '../lib/taskProgress'
import { isSupplementalTask, taskHoursInMonth, taskLifecycleDate } from '../lib/taskAccounting'
import { taskSettlementMonth } from '../lib/taskSettlement'
import {
  designTypeColorForTask,
  formatDueDateCompact,
  formatTaskActivityDateRange,
  formatTaskActivityTime,
  formatTaskRowDateTime,
  formatTaskScheduleSignal,
  isTaskListBlankContextTarget,
  taskDueState,
} from '../lib/taskListPresentation'
import { isoDate } from '../lib/dateTime'
import type { FileAsset, Task, TaskFilter, TaskViewMode } from '../types/domain'
import type { ProgressRecordMode, TaskContextInsight, TaskUpdateChanges } from '../types/taskUi'
import type { CalendarDisplayMode } from './CalendarView'
import { ActiveTaskFilters, StatusBadge, TaskSearchBox } from '../components/TaskUi'
import { CreateTaskContextMenu, TaskContextMenu } from '../components/TaskContextMenu'
import { DashboardTaskSidebar } from '../components/DashboardTaskSidebar'
import { EmptyState } from '../components/EmptyState'
import { TaskContextInsightBadge } from '../components/TaskContextInsightBadge'

const CalendarView = lazy(() => import('./CalendarView'))
const taskFilters: TaskFilter[] = ['全部', '计划中', '进行中', '待验收', '已验收']

export type TaskProgressTarget = {
  task: Task
  mode?: ProgressRecordMode
  editEntryId?: string
  initialAcceptanceMode?: boolean
}

type TasksViewProps = {
  viewMode: TaskViewMode
  onViewModeChange: (mode: TaskViewMode) => void
  calendarMode: CalendarDisplayMode
  calendarFocusDate: string
  onCalendarFocusDateChange: (value: string) => void
  monthValue: string
  onMonthChange: (month: string) => void
  designTypeGroups: DesignTypeGroup[]
  activeMonthTasks: Task[]
  selectedTask: Task | undefined
  tasks: Task[]
  contextInsights: Map<number, TaskContextInsight>
  taskFilter: TaskFilter
  taskQuery: string
  showVoidedTasks: boolean
  voidedTaskCount: number
  onFilterChange: (filter: TaskFilter) => void
  onQueryChange: (query: string) => void
  onShowVoidedChange: (value: boolean) => void
  onSelectTask: (id: number) => void
  onUpdateTask: (taskId: number, changes: TaskUpdateChanges) => void
  onVoidTask: (taskId: number) => void
  onRestoreTask: (taskId: number) => void
  onDeleteTask: (taskId: number) => void
  onDeleteEntry: (taskId: number, mode: ProgressRecordMode, entryId: string) => void
  onDeleteAcceptanceProgress: (taskId: number, entryId?: string) => void
  onOpenTask: (taskId: number) => void
  onOpenEditTask: (taskId: number) => void
  files: FileAsset[]
  progressAssessments: Record<number, TaskProgressAssessment>
  onPreviewFile: (file: FileAsset) => void
  hourlyRate: number
  onCreateTask: () => void
  onAutoEstimateProgress?: (task: Task) => void
  canWrite: boolean
  canDelete: boolean
  detailCollapsed: boolean
  onToggleDetail: () => void
  rowThemeOn: boolean
  renderProgressModal: (target: TaskProgressTarget, onClose: () => void) => ReactNode
}

export default function TasksView({
  viewMode,
  onViewModeChange,
  calendarMode,
  calendarFocusDate,
  onCalendarFocusDateChange,
  monthValue,
  onMonthChange,
  designTypeGroups,
  activeMonthTasks,
  selectedTask,
  tasks,
  contextInsights,
  taskFilter,
  taskQuery,
  showVoidedTasks,
  voidedTaskCount,
  onFilterChange,
  onQueryChange,
  onShowVoidedChange,
  onSelectTask,
  onUpdateTask,
  onVoidTask,
  onRestoreTask,
  onDeleteTask,
  onDeleteEntry,
  onDeleteAcceptanceProgress,
  onOpenTask,
  onOpenEditTask,
  files,
  progressAssessments,
  onPreviewFile,
  hourlyRate,
  onCreateTask,
  rowThemeOn,
  onAutoEstimateProgress,
  canWrite,
  canDelete,
  detailCollapsed,
  onToggleDetail,
  renderProgressModal,
}: TasksViewProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: Task } | null>(null)
  const [createMenu, setCreateMenu] = useState<{ x: number; y: number } | null>(null)
  const [progressTarget, setProgressTarget] = useState<TaskProgressTarget | null>(null)
  const viewTabs = (
    <div className="view-mode-tabs" aria-label="任务视图切换">
      <button className={viewMode === '列表' ? 'active' : ''} aria-pressed={viewMode === '列表'} title="切换到列表视图" onClick={() => onViewModeChange('列表')}>
        <List size={15} />列表视图
      </button>
      <button className={viewMode === '日历' ? 'active' : ''} aria-pressed={viewMode === '日历'} title="切换到日历视图" onClick={() => onViewModeChange('日历')}>
        <CalendarDays size={15} />日历视图
      </button>
    </div>
  )

  useEffect(() => {
    if (!contextMenu && !createMenu) return
    const closeMenu = () => {
      setContextMenu(null)
      setCreateMenu(null)
    }
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('click', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [contextMenu, createMenu])

  const openContextMenu = (event: React.MouseEvent, task: Task) => {
    event.preventDefault()
    setCreateMenu(null)
    onSelectTask(task.id)
    setContextMenu({ x: event.clientX, y: event.clientY, task })
  }
  const openCreateMenu = (event: React.MouseEvent) => {
    if (!canWrite || !isTaskListBlankContextTarget(event.target)) return
    event.preventDefault()
    setContextMenu(null)
    setCreateMenu({ x: event.clientX, y: event.clientY })
  }
  const openAcceptance = (task: Task) => {
    onSelectTask(task.id)
    setProgressTarget({ task, mode: 'progress', initialAcceptanceMode: true })
  }
  const openProgress = (task: Task, mode?: ProgressRecordMode, editEntryId?: string, initialAcceptanceMode = false) => {
    if ((mode ?? 'progress') === 'progress' && !editEntryId && !initialAcceptanceMode && !canRecordNewProgress(task)) return
    onSelectTask(task.id)
    setProgressTarget({ task, mode, editEntryId, initialAcceptanceMode })
  }
  const selectTaskAndReveal = (taskId: number) => {
    onSelectTask(taskId)
    if (!window.matchMedia('(max-width: 680px)').matches) return
    if (detailCollapsed) onToggleDetail()
    window.setTimeout(() => {
      document.querySelector('.management-grid .dashboard-task-sidebar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, detailCollapsed ? 80 : 0)
  }

  if (viewMode === '日历') {
    return (
      <section className="view-stack">
        <section className="panel view-toolbar">
          <div className="panel-header compact">
            <div><h2>任务日历</h2><p>按日期查看已完成与待完成任务，点击日期查看当天安排</p></div>
            <div className="panel-tools calendar-toolbar-actions">{viewTabs}</div>
          </div>
        </section>
        <Suspense fallback={<p className="calendar-empty-hint">正在载入任务日历…</p>}>
          <CalendarView
            key={monthValue}
            monthValue={monthValue}
            mode={calendarMode}
            focusDate={calendarFocusDate}
            tasks={tasks}
            getTaskLifecycleDate={taskLifecycleDate}
            getTaskColor={(type) => designTypeColorForTask(type, designTypeGroups)}
            onOpenTask={onOpenTask}
            onFocusDateChange={onCalendarFocusDateChange}
            onMonthChange={onMonthChange}
          />
        </Suspense>
      </section>
    )
  }

  return (
    <section className="view-stack task-create-context-surface" onContextMenu={openCreateMenu}>
      <section className="panel view-toolbar">
        <div className="panel-header compact task-panel-header">
          <div><h2>任务管理</h2><p>集中维护任务字段、验收状态、工时与交付文件</p></div>
          <TaskSearchBox value={taskQuery} onChange={onQueryChange} placeholder="搜索任务、需求、需求人" className="task-search-inline" />
          {viewTabs}
        </div>
        <div className="task-toolbar-row">
          <div className="segment-tabs">
            {taskFilters.map((filter) => (
              <button className={taskFilter === filter ? 'active' : ''} aria-pressed={taskFilter === filter} key={filter} onClick={() => onFilterChange(filter)}>
                {filter === '全部' ? '全部任务' : filter}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`voided-toggle ${showVoidedTasks ? 'active' : ''}`}
            onClick={() => {
              const nextValue = !showVoidedTasks
              onShowVoidedChange(nextValue)
              if (nextValue) onFilterChange('全部')
            }}
            title="作废任务默认隐藏，不参与统计、月报和工时"
          >
            <Archive size={15} />
            {showVoidedTasks ? '隐藏作废' : `显示作废${voidedTaskCount ? ` ${voidedTaskCount}` : ''}`}
          </button>
        </div>
        <ActiveTaskFilters query={taskQuery} filter={taskFilter} onClearQuery={() => onQueryChange('')} onClearFilter={() => onFilterChange('全部')} />
      </section>

      <section className={`management-grid ${detailCollapsed ? 'detail-collapsed' : ''}`}>
        <div className={`panel task-management-list ${rowThemeOn ? '' : 'no-row-theme'}`}>
          <div className="management-list-toolbar">
            <span>共 {tasks.length} 条</span>
            <div className="management-list-toolbar-end">
              <button type="button" className="detail-pane-toggle" aria-pressed={!detailCollapsed} title={detailCollapsed ? '显示任务详情' : '收起任务详情'} onClick={onToggleDetail}>
                {detailCollapsed ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
                {detailCollapsed ? '显示详情' : '收起详情'}
              </button>
            </div>
          </div>
          <div className="table-head"><span>日期</span><span>任务 · 预计时间</span><span>对接 · 工时</span><span>状态 · 交付</span></div>
          {tasks.map((task) => {
            const dueState = taskDueState(task, isoDate(), isoDate(3))
            const dueDateLabel = formatDueDateCompact(task.estimatedDate || task.date)
            const scheduleSignal = formatTaskScheduleSignal(task)
            const canAcceptTask = task.status === '待验收'
            const canRecordProgress = canRecordNewProgress(task)
            return (
              <article
                className={`task-row management-row ${selectedTask?.id === task.id ? 'selected' : ''} ${task.voidedAt ? 'voided' : ''} ${isSupplementalTask(task) ? 'supplemental' : ''}`}
                data-status={task.status}
                data-due={dueState || undefined}
                key={task.id}
                role="button"
                aria-pressed={selectedTask?.id === task.id}
                tabIndex={0}
                onClick={() => selectTaskAndReveal(task.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    selectTaskAndReveal(task.id)
                  }
                }}
                onContextMenu={(event) => openContextMenu(event, task)}
              >
                <div className="task-date">
                  <b>{formatTaskActivityDateRange(task)}</b>
                  <span className="task-date-meta">
                    {formatTaskActivityTime(task) && <span>{formatTaskActivityTime(task)}</span>}
                    <em>{task.type || '未分类'}</em>
                    {isSupplementalTask(task) && <em className="task-inline-supplement" title={`补录至 ${monthLabelOf(taskSettlementMonth(task))}`}>补录</em>}
                  </span>
                </div>
                <div className="task-main">
                  <strong>{task.title}</strong>
                  <p>{task.requirement}{task.voidedAt ? ` · 已作废${task.voidReason ? `：${task.voidReason}` : ''}` : ''}</p>
                  <div className={`task-schedule-row ${task.status === '已验收' ? 'done' : ''}`}>
                    <span className="time-chip"><span>开始</span><strong>{formatTaskRowDateTime(task.date)}</strong></span>
                    <span className="time-chip"><span>交付</span><strong>{formatTaskRowDateTime(task.estimatedDate || task.date)}</strong></span>
                    {task.status !== '已验收' && <span className={`schedule-countdown ${scheduleSignal.tone}`}>{scheduleSignal.label}</span>}
                    <TaskContextInsightBadge insight={contextInsights.get(task.id)} />
                  </div>
                </div>
                <div className="task-meta">
                  <b>{task.requester || task.contact || '待确认'}</b>
                  <span>实际 <strong>{taskHoursInMonth(task, monthValue).toFixed(1)}h</strong></span>
                </div>
                <div className="task-row-end">
                  <div className="task-state">
                    <div className="task-state-badges">
                      {task.voidedAt && <span className="voided-tag">作废</span>}
                      {dueState && <span className={`due-tag ${dueState}`}>{dueState === 'overdue' ? '已逾期' : '临期'}</span>}
                      <StatusBadge status={task.status} />
                    </div>
                    {task.status !== '已验收' && <div className="progress-cell"><div className="mini-meter"><span style={{ width: `${taskDisplayProgress(task)}%` }} /></div><small>{taskDisplayProgress(task)}%</small></div>}
                  </div>
                  {canWrite && <div className="task-row-actions" aria-label="任务快捷操作">
                    <span className="task-row-due">{dueDateLabel}</span>
                    <button type="button" className="icon-button" title="编辑任务" aria-label="编辑任务" onClick={(event) => { event.stopPropagation(); onOpenEditTask(task.id) }}><Pencil size={15} /></button>
                    <button type="button" className="icon-button" title={canRecordProgress ? '记录进展' : task.status === '计划中' ? '改为进行中后可记录进展' : '已进入验收闭环，需先编辑或删除验收进展'} aria-label={canRecordProgress ? '记录进展' : '当前不可记录进展'} disabled={!canRecordProgress} onClick={(event) => { event.stopPropagation(); openProgress(task) }}><BarChart3 size={15} /></button>
                    {canDelete && <button type="button" className="icon-button" title={canAcceptTask ? '去验收' : '当前不是待验收'} aria-label={canAcceptTask ? '去验收' : '当前不是待验收'} disabled={!canAcceptTask} onClick={(event) => { event.stopPropagation(); openAcceptance(task) }}><ClipboardCheck size={15} /></button>}
                  </div>}
                </div>
              </article>
            )
          })}
          {tasks.length === 0 && (
            <EmptyState
              role="status"
              title={activeMonthTasks.length === 0 ? '这个月还没有任务' : '没有找到匹配任务'}
              description={activeMonthTasks.length === 0 ? '新建任务后，可以通过双击或右键菜单管理任务。' : '换一个关键词或状态筛选试试。'}
              action={canWrite && activeMonthTasks.length === 0
                ? <button className="ghost-button compact-button empty-state-action" onClick={onCreateTask}><Plus size={15} />新建任务</button>
                : activeMonthTasks.length > 0
                  ? <button className="ghost-button compact-button empty-state-action" onClick={() => { onQueryChange(''); onFilterChange('全部') }}><RotateCcw size={15} />清除筛选</button>
                  : null}
            />
          )}
          <div className="task-schedule-legend" aria-label="排期状态说明">
            <span><i className="imminent" />临期：今日 / 明日到期</span><span><i className="overdue" />逾期：超过交付日</span><span><i className="started" />进行中：距交付倒计时</span><span><i className="normal" />正常 / 已验收：灰显</span>
          </div>
          {contextMenu && <TaskContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} onOpenTask={onOpenTask} onOpenEditTask={onOpenEditTask} onOpenAcceptance={openAcceptance} onOpenProgress={openProgress} onUpdateTask={onUpdateTask} onVoidTask={onVoidTask} onRestoreTask={onRestoreTask} onDeleteTask={onDeleteTask} canWrite={canWrite} canDelete={canDelete} />}
          {canWrite && createMenu && <CreateTaskContextMenu menu={createMenu} onCreate={() => { setCreateMenu(null); onCreateTask() }} />}
        </div>
        {!detailCollapsed && <DashboardTaskSidebar
          task={selectedTask}
          files={files}
          progressAssessment={selectedTask ? progressAssessments[selectedTask.id] : undefined}
          hourlyRate={hourlyRate}
          onPreviewFile={onPreviewFile}
          onUpdateTask={onUpdateTask}
          onOpenProgress={(taskId, mode, editEntryId, initialAcceptanceMode) => {
            const task = tasks.find((item) => item.id === taskId)
            if (task) openProgress(task, mode, editEntryId, initialAcceptanceMode)
          }}
          onDeleteEntry={onDeleteEntry}
          onDeleteAcceptanceProgress={onDeleteAcceptanceProgress}
          onOpenEdit={onOpenEditTask}
          onOpenAcceptance={(taskId) => {
            const task = tasks.find((item) => item.id === taskId)
            if (task) openAcceptance(task)
          }}
          onAutoEstimateProgress={onAutoEstimateProgress}
          canWrite={canWrite}
          canDelete={canDelete}
        />}
      </section>
      {progressTarget && renderProgressModal(tasks.find((task) => task.id === progressTarget.task.id) ? { ...progressTarget, task: tasks.find((task) => task.id === progressTarget.task.id)! } : progressTarget, () => setProgressTarget(null))}
    </section>
  )
}
