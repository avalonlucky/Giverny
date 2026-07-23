import { useEffect, useState } from 'react'
import { ChevronLeft, Pencil, Plus, Sparkles } from 'lucide-react'
import { authedPreviewUrl, type TaskProgressAssessment } from '../lib/api'
import { AttachmentHoverThumbnail } from './AttachmentHoverThumbnail'
import { StatusDotLabel } from './TaskUi'
import { formatPlanDateTime, isoDateTime } from '../lib/dateTime'
import { formatYuan, roundCents } from '../lib/money'
import { monthLabelOf } from '../lib/month'
import { taskSettlementMonth } from '../lib/taskSettlement'
import { billableTimeEntries, isSupplementalTask, isTaskBillable, isWaitingEntryActive, minutesForTimeEntry, minutesForWaitingEntry, sumWaitingEntries } from '../lib/taskAccounting'
import { canRecordNewProgress, isTaskStarted, taskDisplayProgress } from '../lib/taskProgress'
import { feedbackEntryLabel, formatEntryDateTimeRange, formatMonthDayDash, formatSignedHours, formatWaitingElapsed, formatWaitingEntryDateTimeRange, isAcceptanceFileAsset, partnerFacingText, sortTimeEntriesDesc } from '../lib/taskPresentation'
import { fileThumbnailSource, fileTypeForAsset, isInlineImageFileType } from '../lib/fileTypes'
import type { FileAsset, Task, TimeEntry } from '../types/domain'
import type { ProgressRecordMode, TaskUpdateChanges } from '../types/taskUi'

const progressStageLabels: Record<TaskProgressAssessment['stage'], string> = {
  not_started: '尚未开始',
  preparation: '准备与启动',
  production: '核心制作',
  first_version: '首版完成',
  finalizing: '修改与定稿',
  accepted: '验收闭环',
}
const progressConfidenceLabels: Record<TaskProgressAssessment['confidence'], string> = {
  low: '低置信度',
  medium: '中置信度',
  high: '高置信度',
}

export function DashboardTaskSidebar({
  task,
  files,
  progressAssessment,
  hourlyRate,
  onPreviewFile,
  onUpdateTask,
  onOpenProgress,
  onDeleteEntry,
  onDeleteAcceptanceProgress,
  onOpenEdit,
  onOpenAcceptance,
  onAutoEstimateProgress,
  canWrite,
  canDelete,
}: {
  task: Task | undefined
  files: FileAsset[]
  progressAssessment?: TaskProgressAssessment
  hourlyRate: number
  onPreviewFile: (file: FileAsset) => void
  onUpdateTask: (taskId: number, changes: TaskUpdateChanges) => void
  onOpenProgress: (taskId: number, mode?: ProgressRecordMode, editEntryId?: string, initialAcceptanceMode?: boolean) => void
  onDeleteEntry: (taskId: number, mode: ProgressRecordMode, entryId: string) => void
  onDeleteAcceptanceProgress: (taskId: number, entryId?: string) => void
  onOpenEdit: (taskId: number) => void
  onOpenAcceptance: (taskId: number) => void
  onAutoEstimateProgress?: (task: Task) => void
  canWrite: boolean
  canDelete: boolean
}) {
  const [activeTab, setActiveTab] = useState<'info' | 'progress'>('progress')
  const [expandedEntryNotes, setExpandedEntryNotes] = useState<Record<string, boolean>>({})
  const [waitingNowStamp, setWaitingNowStamp] = useState(() => Math.floor(Date.now() / 60000))
  const [progressUiState, setProgressUiState] = useState({
    taskId: 0,
    pane: 'progress' as ProgressRecordMode,
    expandedProgress: false,
    expandedFeedback: false,
    expandedWaiting: false,
  })

  // 查看「进展」时按完整生命周期证据重算；语义签名去重，避免重复调用。
  const taskId = task?.id
  const evidenceSignature = task ? JSON.stringify({
    status: task.status,
    requirement: task.requirement,
    timeEntries: task.timeEntries ?? [],
    waitingEntries: task.waitingEntries ?? [],
    files: files.filter((file) => file.taskId === task.id && !file.deletedAt).map((file) => [file.id, file.name, file.scope, file.final, file.tag, file.entryId]),
  }) : ''
  useEffect(() => {
    if (!task || activeTab !== 'progress' || !onAutoEstimateProgress || !evidenceSignature) {
      return
    }
    onAutoEstimateProgress(task)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, activeTab, evidenceSignature])

  useEffect(() => {
    const timer = window.setInterval(() => setWaitingNowStamp(Math.floor(Date.now() / 60000)), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  if (!task) {
    return (
      <aside className="dashboard-task-sidebar">
        <div className="dashboard-task-sidebar-empty">
          <strong>选择一条任务</strong>
          <p>右侧会显示任务信息、进度、分段计时和等待记录。</p>
        </div>
      </aside>
    )
  }

  const timeEntries = task.timeEntries ?? []
  const waitingEntries = task.waitingEntries ?? []
  const progressBillableEntries = billableTimeEntries(task)
  const billableMinutes = progressBillableEntries.reduce((sum, entry) => sum + minutesForTimeEntry(entry), 0)
  const billableHours = billableMinutes > 0 ? billableMinutes / 60 : (isTaskBillable(task) ? task.actualHours : 0)
  const billableAmount = roundCents(billableHours * hourlyRate)
  const waitingMinutes = sumWaitingEntries(task, waitingNowStamp)
  const canAcceptTask = task.status === '待验收'
  const canRecordProgress = canRecordNewProgress(task)
  const canAdjustProgress = canRecordProgress && isTaskStarted(task)
  const demandPerson = task.requester || task.contact || '待确认'
  const snappedProgress = taskDisplayProgress(task)
  const displayedProgress = task.status === '计划中' ? 0 : snappedProgress
  const scopedProgressUiState = progressUiState.taskId === task.id
    ? progressUiState
    : { taskId: task.id, pane: 'progress' as ProgressRecordMode, expandedProgress: false, expandedFeedback: false, expandedWaiting: false }
  const progressPane = scopedProgressUiState.pane
  const expandedProgressEntries = scopedProgressUiState.expandedProgress
  const expandedFeedbackEntries = scopedProgressUiState.expandedFeedback
  const expandedWaitingEntries = scopedProgressUiState.expandedWaiting
  const setProgressPane = (pane: ProgressRecordMode) => {
    setProgressUiState({ taskId: task.id, pane, expandedProgress: false, expandedFeedback: false, expandedWaiting: false })
  }
  const toggleProgressEntries = () => {
    setProgressUiState((current) => {
      const scoped = current.taskId === task.id ? current : scopedProgressUiState
      return { ...scoped, expandedProgress: !scoped.expandedProgress }
    })
  }
  const toggleWaitingEntries = () => {
    setProgressUiState((current) => {
      const scoped = current.taskId === task.id ? current : scopedProgressUiState
      return { ...scoped, expandedWaiting: !scoped.expandedWaiting }
    })
  }
  const toggleFeedbackEntries = () => {
    setProgressUiState((current) => {
      const scoped = current.taskId === task.id ? current : scopedProgressUiState
      return { ...scoped, expandedFeedback: !scoped.expandedFeedback }
    })
  }
  const toggleEntryNote = (noteKey: string) => {
    setExpandedEntryNotes((current) => ({ ...current, [noteKey]: !current[noteKey] }))
  }
  const renderEntryNote = (noteKey: string, text: string) => {
    const expanded = Boolean(expandedEntryNotes[noteKey])
    return (
      <button
        type="button"
        className={`dashboard-side-entry-note ${expanded ? 'expanded' : ''}`}
        aria-expanded={expanded}
        title={expanded ? '点击收起备注' : '点击查看完整备注'}
        onClick={() => toggleEntryNote(noteKey)}
      >
        {text}
      </button>
    )
  }
  const sortedTimeEntries = sortTimeEntriesDesc(timeEntries)
  const sortedFeedbackEntries = sortedTimeEntries.filter((entry) => entry.isClientFeedback)
  const sortedWaitingEntries = sortTimeEntriesDesc(waitingEntries)
  const hasAcceptanceProgressEntry = sortedTimeEntries.some((entry) => entry.isAcceptanceProgress)
  const shouldShowAcceptanceSummary = task.status === '已验收' && !hasAcceptanceProgressEntry && Boolean(task.acceptanceNote?.trim() || (task.acceptanceFiles?.length ?? 0) > 0)
  const acceptanceSummaryFiles = shouldShowAcceptanceSummary
    ? files.filter((file) => file.taskId === task.id && file.scope === 'acceptance' && !file.deletedAt).slice(0, 6)
    : []
  const groupedTimeEntries: Array<{ primary: TimeEntry; siblings: TimeEntry[]; totalMinutes: number }> = sortedTimeEntries.map((entry) => ({ primary: entry, siblings: [], totalMinutes: minutesForTimeEntry(entry) }))
  const shownGroups = expandedProgressEntries ? groupedTimeEntries : groupedTimeEntries.slice(0, 5)
  const shownFeedbackEntries = expandedFeedbackEntries ? sortedFeedbackEntries : sortedFeedbackEntries.slice(0, 5)
  const shownWaitingEntries = expandedWaitingEntries ? sortedWaitingEntries : sortedWaitingEntries.slice(0, 5)
  return (
    <aside className="dashboard-task-sidebar">
      <header className="dashboard-task-sidebar-header">
        <button
          type="button"
          className="dashboard-side-mobile-back"
          onClick={() => document.querySelector('.task-management-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          <ChevronLeft size={15} />
          返回任务列表
        </button>
        <h2>{task.title}</h2>
        <p className="dashboard-task-sidebar-meta">
          <span>{formatMonthDayDash(task.date)}</span>
          <span>{task.type || '未分类'}</span>
          <span>需求人 {demandPerson}</span>
        </p>
      </header>

      <div className="dashboard-side-tabs" role="tablist" aria-label="任务侧栏">
        <button type="button" className={activeTab === 'info' ? 'active' : ''} onClick={() => setActiveTab('info')} role="tab" aria-selected={activeTab === 'info'}>
          信息
        </button>
        <button type="button" className={activeTab === 'progress' ? 'active' : ''} onClick={() => setActiveTab('progress')} role="tab" aria-selected={activeTab === 'progress'}>
          进展
        </button>
      </div>

      {activeTab === 'info' ? (
        <section className="dashboard-side-section" role="tabpanel">
          <dl className="dashboard-side-info">
            <div>
              <dt>计划开始</dt>
              <dd>{task.date ? formatPlanDateTime(task.date) : '未设置'}</dd>
            </div>
            <div>
              <dt>预计交付</dt>
              <dd>{task.estimatedDate ? formatPlanDateTime(task.estimatedDate) : '未设置'}</dd>
            </div>
            <div>
              <dt>类型</dt>
              <dd>{task.type || '未填写'}</dd>
            </div>
            <div>
              <dt>需求人</dt>
              <dd>{demandPerson}</dd>
            </div>
            <div>
              <dt>状态</dt>
              <dd><StatusDotLabel status={task.status} /></dd>
            </div>
            <div>
              <dt>结算</dt>
              <dd>
                {monthLabelOf(taskSettlementMonth(task))}
                {isSupplementalTask(task) ? <span className="supplement-inline">补录</span> : null}
              </dd>
            </div>
          </dl>
          {canWrite && <div className="dashboard-side-info-actions">
            {canDelete && canAcceptTask && (
              <button type="button" className="ghost-button compact-button" onClick={() => onOpenAcceptance(task.id)}>
                去验收
              </button>
            )}
            <button type="button" className="ghost-button compact-button" onClick={() => onOpenEdit(task.id)}>
              <Pencil size={15} />
              编辑信息
            </button>
          </div>}
        </section>
      ) : (
        <section className="dashboard-side-section dashboard-side-progress-section" role="tabpanel">
          <div className="dashboard-side-progress">
            <div className="dashboard-side-progress-head">
              <span>整体进度</span>
              <strong>{displayedProgress}%</strong>
            </div>
            <div className="dashboard-side-progress-track">
              <span style={{ width: `${displayedProgress}%` }} />
            </div>
            <div className="dashboard-side-progress-scale">
              {[0, 20, 40, 60, 80, 100].map((value) => (
                <button
                  type="button"
                  className={displayedProgress === value ? 'active' : ''}
                  key={value}
                  aria-label={`设置进度为 ${value}%`}
                  aria-pressed={displayedProgress === value}
                  disabled={!canWrite || !canAdjustProgress}
                  title={!canWrite ? '当前为只读访问' : canAdjustProgress ? `设置进度为 ${value}%` : task.status === '计划中' ? '首次记录进展后可调整整体进度' : '任务已进入验收闭环，需先编辑或删除验收进展'}
                  onClick={() => onUpdateTask(task.id, { progress: value })}
                >
                  {value}%
                </button>
              ))}
            </div>
            {progressAssessment && (
              <details className="dashboard-side-progress-assessment">
                <summary>
                  <span><Sparkles size={13} />AI 判断 · {progressStageLabels[progressAssessment.stage]}</span>
                  <em>{progressConfidenceLabels[progressAssessment.confidence]}</em>
                </summary>
                <p>{progressAssessment.reason}</p>
                {progressAssessment.evidence.length > 0 && (
                  <ul>
                    {progressAssessment.evidence.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
                {progressAssessment.missingInfo.length > 0 && (
                  <small>待补证据：{progressAssessment.missingInfo.join('；')}</small>
                )}
              </details>
            )}
            {task.status === '计划中' && (
              <p className="dashboard-side-muted dashboard-side-planned-note">
                首次保存「记录进展」后，任务会自动进入进行中，无需手动改状态。
              </p>
            )}
            {!canRecordProgress && task.status !== '计划中' && (
              <p className="dashboard-side-muted dashboard-side-planned-note">
                任务已进入验收闭环。如需继续记录，请先编辑或删除右侧的验收进展。
              </p>
            )}
          </div>

          <div className="dashboard-side-record-tabs" role="tablist" aria-label="进展记录类型">
            <button type="button" className={progressPane === 'progress' ? 'active' : ''} onClick={() => setProgressPane('progress')} role="tab" aria-selected={progressPane === 'progress'}>
              分段计时
            </button>
            <button type="button" className={progressPane === 'feedback' ? 'active' : ''} onClick={() => setProgressPane('feedback')} role="tab" aria-selected={progressPane === 'feedback'}>
              修改建议
            </button>
            <button type="button" className={progressPane === 'waiting' ? 'active' : ''} onClick={() => setProgressPane('waiting')} role="tab" aria-selected={progressPane === 'waiting'}>
              等待记录
            </button>
          </div>

          {progressPane === 'progress' ? (
            <div className="dashboard-side-subsection dashboard-side-record-pane" role="tabpanel">
              <div className="dashboard-side-subsection-title">
                <span>分段计时</span>
                {canWrite && <button type="button" className="text-button dashboard-side-action" disabled={!canRecordProgress} title={canRecordProgress ? (task.status === '计划中' ? '记录进展并自动进入进行中' : '记录进展') : '已进入验收闭环，需先编辑或删除验收进展'} onClick={() => onOpenProgress(task.id, 'progress')}>
                  <Plus size={15} />
                  记录进展
                </button>}
              </div>
              <p className="dashboard-side-subsection-meta">可结算 · {progressBillableEntries.length} 段 · {billableHours.toFixed(1)}h · ¥{formatYuan(billableAmount)}</p>
              {timeEntries.length === 0 && !shouldShowAcceptanceSummary ? (
                <p className="dashboard-side-muted">暂无分段计时；点击记录进展后添加。</p>
              ) : (
                <>
                  <div className="dashboard-side-timeline">
                    {shouldShowAcceptanceSummary && (
                      <article className="dashboard-side-time-item dashboard-side-acceptance-item">
                        <span className="dot" />
                        {(canWrite || canDelete) && <div className="dashboard-side-entry-actions">
                          {canWrite && <button type="button" onClick={() => onOpenProgress(task.id, 'progress', undefined, true)}>编辑</button>}
                          {canDelete && <button type="button" className="danger" onClick={() => onDeleteAcceptanceProgress(task.id)}>删除</button>}
                        </div>}
                        <div className="dashboard-side-entry-time-row">
                          <time>{task.actualDeliveryDate ? formatPlanDateTime(task.actualDeliveryDate) : formatPlanDateTime(isoDateTime())}</time>
                          <span className="progress-entry-tag acceptance">验收进展</span>
                        </div>
                        {renderEntryNote(`${task.id}:acceptance-summary`, task.acceptanceNote?.trim() || '已完成验收确认。')}
                        <em>不新增计时 · 已进入验收闭环</em>
                        {acceptanceSummaryFiles.length > 0 && (
                          <div className="dashboard-side-entry-files" aria-label="验收附件">
                            {acceptanceSummaryFiles.map((file) => {
                              const fileType = fileTypeForAsset(file).type
                              const previewUrl = authedPreviewUrl(file.previewUrl ?? (isInlineImageFileType(fileType) ? file.sourceUrl : undefined))
                              const documentSourceUrl = fileThumbnailSource(file)
                              return (
                                <AttachmentHoverThumbnail
                                  key={file.id}
                                  name={file.name}
                                  type={fileType}
                                  previewUrl={previewUrl}
                                  previewFallback={Boolean(file.previewFallback)}
                                  sourceUrl={documentSourceUrl}
                                  compact
                                  onOpen={() => onPreviewFile(file)}
                                />
                              )
                            })}
                          </div>
                        )}
                      </article>
                    )}
                    {shownGroups.map(({ primary: entry, siblings, totalMinutes }) => {
                      const isGrouped = siblings.length > 0
                      const displayMinutes = isGrouped ? totalMinutes : minutesForTimeEntry(entry)
                      const acceptanceFileNames = new Set((task.acceptanceFiles ?? []).map((name) => name.trim()).filter(Boolean))
                      const groupEntryIds = new Set([entry.id, ...siblings.map((s) => s.id)])
                      const entryFiles = files.filter((file) => {
                        if (file.taskId !== task.id || file.deletedAt) {
                          return false
                        }
                        if (groupEntryIds.has(file.entryId ?? '')) {
                          return true
                        }
                        return entry.isAcceptanceProgress && isAcceptanceFileAsset(file, acceptanceFileNames) && (!file.entryId || acceptanceFileNames.has(file.name.trim()))
                      })
                      const entryNote = entry.isAcceptanceProgress ? (task.acceptanceNote?.trim() || entry.note || '已完成验收确认。') : (entry.note || '未填写具体内容')
                      const hasAcceptanceFiles = entryFiles.some((file) => isAcceptanceFileAsset(file, acceptanceFileNames))
                      return (
                        <article className="dashboard-side-time-item" key={entry.id}>
                          <span className="dot" />
                          {(canWrite || canDelete) && <div className="dashboard-side-entry-actions">
                            {canWrite && <button type="button" onClick={() => onOpenProgress(task.id, 'progress', entry.id)}>编辑</button>}
                            {canDelete && <button
                              type="button"
                              className="danger"
                              onClick={() => entry.isAcceptanceProgress
                                ? onDeleteAcceptanceProgress(task.id, entry.id)
                                : onDeleteEntry(task.id, 'progress', entry.id)}
                            >
                              删除
                            </button>}
                          </div>}
                          <div className="dashboard-side-entry-time-row">
                            <time>{formatEntryDateTimeRange(task, entry)}</time>
                            {isGrouped && siblings.map((sib) => (
                              <span key={sib.id} className="progress-group-inline-sib">
                                <span className="progress-group-inline-sep">·</span>
                                <span className="progress-group-inline-time">{sib.start}–{sib.end}</span>
                                {canWrite && <button type="button" className="progress-group-sibling-edit" onClick={() => onOpenProgress(task.id, 'progress', sib.id)} aria-label="编辑此段"><Pencil size={10} /></button>}
                              </span>
                            ))}
                            {entry.isAcceptanceProgress && <span className="progress-entry-tag acceptance">验收进展</span>}
                            {entry.isClientFeedback && <span className="progress-entry-tag client-feedback">{feedbackEntryLabel(entry)}</span>}
                            {entry.feedbackVersion && <span className="progress-entry-tag feedback-version">{entry.feedbackVersion}</span>}
                            {hasAcceptanceFiles && <span className="progress-entry-tag acceptance-file">验收文件</span>}
                          </div>
                          {renderEntryNote(`${task.id}:progress:${entry.id}`, entryNote)}
                          <em className={`progress-time-pill ${displayMinutes > 0 ? '' : 'is-uncounted'}`}>{displayMinutes > 0 ? `计时 ${formatSignedHours(displayMinutes)}` : '不计工时'}</em>
                          {entryFiles.length > 0 && (
                            <div className="dashboard-side-entry-files" aria-label="本段进展附件">
                              {entryFiles.map((file) => {
                                const fileType = fileTypeForAsset(file).type
                                const previewUrl = authedPreviewUrl(file.previewUrl ?? (isInlineImageFileType(fileType) ? file.sourceUrl : undefined))
                                const documentSourceUrl = fileThumbnailSource(file)
                                return (
                                  <AttachmentHoverThumbnail
                                    key={file.id}
                                    name={file.name}
                                    type={fileType}
                                    previewUrl={previewUrl}
                                    previewFallback={Boolean(file.previewFallback)}
                                    sourceUrl={documentSourceUrl}
                                    compact
                                    onOpen={() => onPreviewFile(file)}
                                  />
                                )
                              })}
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                  {groupedTimeEntries.length > 5 && (
                    <button type="button" className="dashboard-side-expand" onClick={toggleProgressEntries}>
                      {expandedProgressEntries ? '收起记录' : `展开 ${groupedTimeEntries.length - 5} 条`}
                    </button>
                  )}
                </>
              )}
            </div>
          ) : progressPane === 'feedback' ? (
            <div className="dashboard-side-subsection dashboard-side-record-pane dashboard-side-feedback" role="tabpanel">
              <div className="dashboard-side-subsection-title">
                <span>修改建议</span>
                {canWrite && <button type="button" className="text-button dashboard-side-action" disabled={!canRecordProgress} title={canRecordProgress ? '记录合作伙伴反馈 / 修改意见' : '改为进行中后可记录反馈'} onClick={() => onOpenProgress(task.id, 'feedback')}>
                  <Plus size={15} />
                  记录反馈
                </button>}
              </div>
              <p className="dashboard-side-subsection-meta">用于追溯 B01 / B02 等每轮修改意见，默认不计工时。</p>
              {sortedFeedbackEntries.length === 0 ? (
                <p className="dashboard-side-muted">暂无合作伙伴反馈；收到批注、聊天截图或版本意见时可单独记录。</p>
              ) : (
                <>
                  <div className="dashboard-side-timeline">
                    {shownFeedbackEntries.map((entry) => {
                      const entryFiles = files.filter((file) => file.taskId === task.id && !file.deletedAt && file.entryId === entry.id)
                      return (
                        <article className="dashboard-side-time-item dashboard-side-feedback-item" key={entry.id}>
                          <span className="dot" />
                          {(canWrite || canDelete) && <div className="dashboard-side-entry-actions">
                            {canWrite && <button type="button" onClick={() => onOpenProgress(task.id, 'feedback', entry.id)}>编辑</button>}
                            {canDelete && <button type="button" className="danger" onClick={() => onDeleteEntry(task.id, 'feedback', entry.id)}>删除</button>}
                          </div>}
                          <div className="dashboard-side-entry-time-row">
                            <time>{formatEntryDateTimeRange(task, entry)}</time>
                            <span className="progress-entry-tag client-feedback">{feedbackEntryLabel(entry)}</span>
                            {entry.feedbackVersion && <span className="progress-entry-tag feedback-version">{entry.feedbackVersion}</span>}
                          </div>
                          {renderEntryNote(`${task.id}:feedback:${entry.id}`, entry.note || '未填写修改意见')}
                          <em className="progress-time-pill is-uncounted">不计工时</em>
                          {entryFiles.length > 0 && (
                            <div className="dashboard-side-entry-files" aria-label="反馈附件">
                              {entryFiles.map((file) => {
                                const fileType = fileTypeForAsset(file).type
                                const previewUrl = authedPreviewUrl(file.previewUrl ?? (isInlineImageFileType(fileType) ? file.sourceUrl : undefined))
                                const documentSourceUrl = fileThumbnailSource(file)
                                return (
                                  <AttachmentHoverThumbnail
                                    key={file.id}
                                    name={file.name}
                                    type={fileType}
                                    previewUrl={previewUrl}
                                    previewFallback={Boolean(file.previewFallback)}
                                    sourceUrl={documentSourceUrl}
                                    compact
                                    onOpen={() => onPreviewFile(file)}
                                  />
                                )
                              })}
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                  {sortedFeedbackEntries.length > 5 && (
                    <button type="button" className="dashboard-side-expand" onClick={toggleFeedbackEntries}>
                      {expandedFeedbackEntries ? '收起记录' : `展开 ${sortedFeedbackEntries.length - 5} 条`}
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="dashboard-side-subsection dashboard-side-record-pane dashboard-side-waiting" role="tabpanel">
              <div className="dashboard-side-subsection-title">
                <span>等待记录</span>
                {canWrite && <button type="button" className="text-button dashboard-side-action" disabled={!canRecordProgress} title={canRecordProgress ? '记录等待' : '改为进行中后可记录等待'} onClick={() => onOpenProgress(task.id, 'waiting')}>
                  <Plus size={15} />
                  记录等待
                </button>}
              </div>
              {waitingMinutes > 0 && <p className="dashboard-side-subsection-meta">等待合计 {(waitingMinutes / 60).toFixed(1)}h · 仅进入洞察分析</p>}
              {waitingEntries.length === 0 ? (
                <p className="dashboard-side-muted">暂无等待记录；等待合作伙伴意见、补资料或确认时可单独记录。</p>
              ) : (
                <>
                  <div className="dashboard-side-waiting-list">
                    {shownWaitingEntries.map((entry) => {
                      const active = isWaitingEntryActive(task, entry)
                      const minutes = minutesForWaitingEntry(task, entry, waitingNowStamp)
                      return (
                        <article className="dashboard-side-waiting-item" key={entry.id}>
                          {(canWrite || canDelete) && <div className="dashboard-side-entry-actions">
                            {canWrite && <button type="button" onClick={() => onOpenProgress(task.id, 'waiting', entry.id)}>编辑</button>}
                            {canDelete && <button type="button" className="danger" onClick={() => onDeleteEntry(task.id, 'waiting', entry.id)}>删除</button>}
                          </div>}
                          <time>{formatWaitingEntryDateTimeRange(task, entry)}</time>
                          {renderEntryNote(`${task.id}:waiting:${entry.id}`, partnerFacingText(entry.note || entry.reason, '等待合作伙伴确认'))}
                          <em>{active ? `已等待 ${formatWaitingElapsed(minutes)}` : `等待 ${formatWaitingElapsed(minutes)}`} · 不计结算</em>
                        </article>
                      )
                    })}
                  </div>
                  {waitingEntries.length > 5 && (
                    <button type="button" className="dashboard-side-expand" onClick={toggleWaitingEntries}>
                      {expandedWaitingEntries ? '收起记录' : `展开 ${waitingEntries.length - 5} 条`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      )}
    </aside>
  )
}
