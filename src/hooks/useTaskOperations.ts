import { useRef, type Dispatch, type SetStateAction } from 'react'
import type { ConfirmDialogState } from '../components/ConfirmDialogModal'
import type { ProgressModalTarget } from '../components/AppOverlayLayer'
import { api, authedPreviewUrl } from '../lib/api'
import { createOptionalPreviewFile } from '../lib/attachmentPreview'
import { clearNewTaskDraftCache } from '../lib/newTaskDraftCache'
import { fileTypeForFile } from '../lib/fileTypes'
import { formatDuration } from '../lib/durationDisplay'
import { formatFileSize } from '../lib/format'
import { isoDate, isoDateTime, localDateFromIsoDate, monthPart, pad } from '../lib/dateTime'
import { addIsoDays } from '../lib/calendar'
import { isSupplementalTask, minutesForTimeEntry, sumTimeEntries } from '../lib/taskAccounting'
import { taskSettlementMonth } from '../lib/taskSettlement'
import { canRecordNewProgress, snapProgress, taskDisplayProgress } from '../lib/taskProgress'
import { formatEntryDateTimeRange, formatWaitingEntryDateTimeRange, sortTimeEntriesDesc } from '../lib/taskPresentation'
import { normalizeTaskClosure } from '../lib/taskContextInsights'
import { prepareImageFiles, validateUploadFile } from '../lib/fileUpload'
import type { FileAsset, Task, WaitingEntry } from '../types/domain'
import type { AcceptancePayload, ProgressRecordMode, TaskUpdateChanges } from '../types/taskUi'
import type { ToastState } from '../lib/toastQueue'
import type { useWorkspaceData } from './useWorkspaceData'
import { useTaskRuntimeStore } from '../stores/taskRuntimeStore'
import { useShallow } from 'zustand/react/shallow'

type Notify = (
  message: string,
  tone?: ToastState['tone'],
  options?: Pick<ToastState, 'actionLabel' | 'onAction' | 'durationMs'>,
) => void
type WorkspaceData = ReturnType<typeof useWorkspaceData>

export function useTaskOperations({
  workspace, selectedTask, detailTaskId, loadTaskActivity, notify,
  setSelectedTaskId, setMonthValue, setIsModalOpen, setDetailTaskId, setEditTaskId,
  setProgressModalTarget, setConfirmDialog, setIsLoginModalOpen, previewFile, setPreviewFile,
  calendarDisplayMode, currentMonthValue, effectiveCalendarFocusDate, setCalendarFocusDate,
  canWrite, isAdmin,
}: {
  workspace: WorkspaceData
  selectedTask?: Task
  detailTaskId: number
  loadTaskActivity: (taskId: number) => Promise<void>
  notify: Notify
  setSelectedTaskId: Dispatch<SetStateAction<number>>
  setMonthValue: Dispatch<SetStateAction<string>>
  setIsModalOpen: Dispatch<SetStateAction<boolean>>
  setDetailTaskId: Dispatch<SetStateAction<number>>
  setEditTaskId: Dispatch<SetStateAction<number>>
  setProgressModalTarget: Dispatch<SetStateAction<ProgressModalTarget | null>>
  setConfirmDialog: Dispatch<SetStateAction<ConfirmDialogState | null>>
  setIsLoginModalOpen: Dispatch<SetStateAction<boolean>>
  previewFile: FileAsset | null
  setPreviewFile: Dispatch<SetStateAction<FileAsset | null>>
  calendarDisplayMode: '日' | '周' | '月'
  currentMonthValue: string
  effectiveCalendarFocusDate: string
  setCalendarFocusDate: Dispatch<SetStateAction<string>>
  canWrite: boolean
  isAdmin: boolean
}) {
  const {
    role, taskItems, setTaskItems, taskItemsRef, setUpdateItems, fileItems, setFileItems,
    setBackendStatus, refreshState,
  } = workspace
  const {
    progressAssessments, setProgressAssessments, voidTaskTarget, setVoidTaskTarget,
    isVoidTaskBusy, setIsVoidTaskBusy, showFireworks, setShowFireworks,
  } = useTaskRuntimeStore(useShallow((state) => ({
    progressAssessments: state.progressAssessments,
    setProgressAssessments: state.setProgressAssessments,
    voidTaskTarget: state.voidTaskTarget,
    setVoidTaskTarget: state.setVoidTaskTarget,
    isVoidTaskBusy: state.isVoidTaskBusy,
    setIsVoidTaskBusy: state.setIsVoidTaskBusy,
    showFireworks: state.showFireworks,
    setShowFireworks: state.setShowFireworks,
  })))
  const updatingTaskIdsRef = useRef<Set<number>>(new Set())
  const pendingTaskChangesRef = useRef<Map<number, Partial<Task>>>(new Map())

  const requireAdmin = () => {
    notify('请先登录管理员身份再编辑')
    setIsLoginModalOpen(true)
  }

  const shiftMonthValue = (value: string, offset: number) => {
    const base = localDateFromIsoDate(`${value || isoDate().slice(0, 7)}-01`)
    base.setMonth(base.getMonth() + offset)
    return `${base.getFullYear()}-${pad(base.getMonth() + 1)}`
  }

  const handleCreateTask = async (task: Task) => {
    try {
      const savedTask = await api.createTask(task)
      await refreshState()
      setSelectedTaskId(savedTask.id)
      if (taskSettlementMonth(savedTask).length >= 7) {
        setMonthValue(taskSettlementMonth(savedTask))
      }
      clearNewTaskDraftCache(role === 'demo' ? 'demo' : 'default')
      setIsModalOpen(false)
      setBackendStatus('已接入 D1/R2')
      notify('任务已写入 D1，最新进展已同步')
      return savedTask
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `任务保存失败：${error.message}` : '任务保存失败')
      return undefined
    }
  }

  const handleRetryAttachmentAnalysis = async (attachmentId: number) => {
    await api.retryAttachmentAnalysis(attachmentId)
    notify('已重新创建附件分析任务')
    await refreshState()
  }

  const handleCreateTaskUpdate = async (taskId: number, update: { title: string; body: string; hours: number; visible: boolean }) => {
    try {
      const savedUpdate = await api.createUpdate({
        id: 0,
        taskId,
        date: isoDateTime(),
        title: update.title,
        body: update.body,
        hours: update.hours,
        visible: update.visible,
        files: [],
      })
      setUpdateItems((currentUpdates) => [savedUpdate, ...currentUpdates])
      await refreshState()
      await loadTaskActivity(taskId)
      notify('进展记录已保存')
    } catch (error) {
      notify(error instanceof Error ? `进展保存失败：${error.message}` : '进展保存失败')
    }
  }

  const handleOpenTaskDetail = (taskId: number) => {
    setSelectedTaskId(taskId)
    setDetailTaskId(taskId)
    void loadTaskActivity(taskId)
  }

  const handleOpenTaskEdit = (taskId: number) => {
    setSelectedTaskId(taskId)
    setEditTaskId(taskId)
  }

  const handleOpenTaskProgress = (taskId: number, mode: ProgressRecordMode = 'progress', editEntryId?: string, initialAcceptanceMode = false) => {
    const task = taskItemsRef.current.find((item) => item.id === taskId)
    if (task && mode === 'progress' && !editEntryId && !initialAcceptanceMode && !canRecordNewProgress(task)) {
      notify('任务已进入验收闭环。如需继续记录，请先编辑或删除右侧的验收进展。', 'error')
      return
    }
    setSelectedTaskId(taskId)
    setProgressModalTarget({ taskId, mode, editEntryId, initialAcceptanceMode })
    void loadTaskActivity(taskId)
  }

  const handleDeleteTaskTimeEntry = (taskId: number, mode: ProgressRecordMode, entryId: string) => {
    const task = taskItems.find((item) => item.id === taskId)
    if (!task) {
      return
    }
    if (mode === 'progress' && task.status === '已验收') {
      notify('已验收任务的结算工时已锁定，不能直接删除分段记录', 'error')
      return
    }
    const entries = mode === 'waiting' ? task.waitingEntries ?? [] : task.timeEntries ?? []
    const entry = entries.find((item) => item.id === entryId)
    if (!entry) {
      notify('这条记录已不存在，请刷新后重试', 'error')
      return
    }
    const isWaiting = mode === 'waiting'
    const restoreDeletedEntry = async () => {
      const latestTask = taskItemsRef.current.find((item) => item.id === taskId)
      if (!latestTask) {
        notify('撤回失败：任务不存在', 'error')
        return
      }
      if (isWaiting) {
        const latestEntries = latestTask.waitingEntries ?? []
        if (latestEntries.some((item) => item.id === entry.id)) {
          notify('这段等待记录已恢复')
          return
        }
        const restored = await handleUpdateTask(taskId, { waitingEntries: sortTimeEntriesDesc([...latestEntries, entry as WaitingEntry]) })
        if (!restored) {
          notify('撤回失败：等待记录未能恢复', 'error')
          return
        }
        await api.setEntryAttachmentsArchived(taskId, entry.id, false)
        await refreshState()
        notify('已撤回等待记录')
        return
      }
      const latestEntries = latestTask.timeEntries ?? []
      if (latestEntries.some((item) => item.id === entry.id)) {
        notify('这段分段计时已恢复')
        return
      }
      const nextEntries = sortTimeEntriesDesc([...latestEntries, entry])
      const nextActualHours = Math.round((sumTimeEntries(nextEntries) / 60) * 100) / 100
      const restored = await handleUpdateTask(taskId, { timeEntries: nextEntries, actualHours: nextActualHours })
      if (!restored) {
        notify('撤回失败：分段计时未能恢复', 'error')
        return
      }
      await api.setEntryAttachmentsArchived(taskId, entry.id, false)
      await refreshState()
      notify('已撤回分段计时')
    }
    const entryRangeLabel = isWaiting ? formatWaitingEntryDateTimeRange(task, entry as WaitingEntry) : formatEntryDateTimeRange(task, entry)
    setConfirmDialog({
      title: `确定删除 ${entryRangeLabel} 这段记录吗？`,
      body: isWaiting
        ? '删除后，这段等待时长将不再进入洞察分析。'
        : '删除后，这段工时会从实际工时和结算金额中扣除。',
      confirmText: '确认删除',
      tone: 'danger',
      hideIcon: true,
      details: [entry.note || (isWaiting ? '未填写等待说明' : '未填写进展内容'), isWaiting ? '不计结算，下一段工作进展开始时自动截止' : `计时 ${formatDuration(minutesForTimeEntry(entry))}`],
      onConfirm: async () => {
        // 附件归档与 task update 并行，减少串行等待
        const archivePromise = api.setEntryAttachmentsArchived(taskId, entry.id, true)
        if (isWaiting) {
          const deleted = await handleUpdateTask(taskId, { waitingEntries: entries.filter((item) => item.id !== entryId) })
          if (!deleted) {
            archivePromise.then(() => api.setEntryAttachmentsArchived(taskId, entry.id, false)).catch(() => {})
            notify('等待记录删除失败，关联附件已保留', 'error')
            return
          }
          void refreshState()
          notify('等待记录已删除', 'success', {
            actionLabel: '撤回',
            durationMs: 7200,
            onAction: restoreDeletedEntry,
          })
          return
        }
        const nextEntries = entries.filter((item) => item.id !== entryId)
        const nextActualHours = Math.round((sumTimeEntries(nextEntries) / 60) * 100) / 100
        const deleted = await handleUpdateTask(taskId, { timeEntries: nextEntries, actualHours: nextActualHours })
        if (!deleted) {
          archivePromise.then(() => api.setEntryAttachmentsArchived(taskId, entry.id, false)).catch(() => {})
          notify('分段计时删除失败，关联附件已保留', 'error')
          return
        }
        void refreshState()
        notify('分段计时已删除，实际工时已重新计算', 'success', {
          actionLabel: '撤回',
          durationMs: 7200,
          onAction: restoreDeletedEntry,
        })
      },
    })
  }

  const handleTaskCalendarMonthChange = (value: string) => {
    setMonthValue(value)
    setCalendarFocusDate((current) => (current.startsWith(value) ? current : `${value}-01`))
  }

  const shiftTaskCalendarPeriod = (direction: -1 | 1) => {
    if (calendarDisplayMode === '月') {
      const nextMonth = shiftMonthValue(currentMonthValue, direction)
      setMonthValue(nextMonth)
      setCalendarFocusDate(`${nextMonth}-01`)
      return
    }
    const nextDate = addIsoDays(effectiveCalendarFocusDate, direction * (calendarDisplayMode === '周' ? 7 : 1))
    setCalendarFocusDate(nextDate)
    if (monthPart(nextDate) !== currentMonthValue) {
      setMonthValue(monthPart(nextDate))
    }
  }

  const handleDeleteAcceptanceProgress = (taskId: number, entryId?: string) => {
    const task = taskItems.find((item) => item.id === taskId)
    if (!task) {
      return
    }
    const entry = entryId ? (task.timeEntries ?? []).find((item) => item.id === entryId) : undefined
    if (entryId && !entry) {
      notify('这条验收进展已不存在，请刷新后重试', 'error')
      return
    }
    const nextEntries = entryId ? (task.timeEntries ?? []).filter((item) => item.id !== entryId) : task.timeEntries ?? []
    const nextActualHours = Math.round((sumTimeEntries(nextEntries) / 60) * 100) / 100
    const restoreAcceptanceProgress = async () => {
      if (!entry) {
        notify('这条验收进展没有可撤回的分段工时')
        return
      }
      const latestTask = taskItemsRef.current.find((item) => item.id === taskId)
      if (!latestTask) {
        notify('撤回失败：任务不存在', 'error')
        return
      }
      const latestEntries = latestTask.timeEntries ?? []
      if (latestEntries.some((item) => item.id === entry.id)) {
        notify('这条验收进展已恢复')
        return
      }
      const restoredEntries = sortTimeEntriesDesc([...latestEntries, entry])
      const restoredHours = Math.round((sumTimeEntries(restoredEntries) / 60) * 100) / 100
      const restored = await handleUpdateTask(taskId, {
        status: '已验收',
        stage: '已验收',
        progress: 100,
        timeEntries: restoredEntries,
        actualHours: restoredHours,
        acceptanceNote: task.acceptanceNote ?? entry.note ?? '',
        acceptanceFiles: task.acceptanceFiles ?? [],
        actualDeliveryDate: task.actualDeliveryDate || isoDateTime(),
        allowAcceptedTimeEdit: true,
      })
      if (!restored) {
        notify('撤回失败：验收进展未能恢复', 'error')
        return
      }
      await api.setEntryAttachmentsArchived(taskId, entry.id, false)
      await refreshState()
      notify('已撤回验收进展删除')
    }
    setConfirmDialog({
      title: entry ? `确定删除 ${formatEntryDateTimeRange(task, entry)} 这条验收进展吗？` : '确定删除这条验收进展吗？',
      body: entry
        ? '删除后，这段验收工时会从实际工时和结算金额中扣除，任务将回到待验收状态。'
        : '删除后，任务将回到待验收状态，验收备注与验收附件记录会从本次验收进展中移除。',
      confirmText: '确认删除',
      tone: 'danger',
      hideIcon: true,
      details: [
        entry?.note || task.acceptanceNote || '未填写验收备注',
        entry ? `计时 ${formatDuration(minutesForTimeEntry(entry))}` : '不新增计时',
      ],
      onConfirm: async () => {
        if (entry) {
          await api.setEntryAttachmentsArchived(taskId, entry.id, true)
        }
        const deleted = await handleUpdateTask(taskId, {
          status: '待验收',
          stage: '待验收',
          progress: Math.min(taskDisplayProgress(task), 80),
          actualDeliveryDate: '',
          acceptanceNote: '',
          acceptanceFiles: [],
          ...(entryId ? { timeEntries: nextEntries, actualHours: nextActualHours } : {}),
          allowAcceptedTimeEdit: Boolean(entryId),
          allowAcceptanceRollback: true,
        })
        if (!deleted) {
          if (entry) {
            await api.setEntryAttachmentsArchived(taskId, entry.id, false)
          }
          notify('验收进展删除失败，关联附件已保留', 'error')
          return
        }
        await refreshState()
        notify(entry ? '验收进展已删除，实际工时已重新计算' : '验收进展已删除，任务已回到待验收', 'success', entry ? {
          actionLabel: '撤回',
          durationMs: 7200,
          onAction: restoreAcceptanceProgress,
        } : undefined)
      },
    })
  }

  const handleOpenTaskAcceptance = (taskId: number) => {
    if (!isAdmin) {
      requireAdmin()
      return
    }
    setSelectedTaskId(taskId)
    setProgressModalTarget({ taskId, mode: 'progress', initialAcceptanceMode: true })
    void loadTaskActivity(taskId)
  }

  const handleSaveTaskEdit = (taskId: number, changes: Partial<Task>) => {
    if (canWrite) {
      void handleUpdateTask(taskId, changes)
    } else {
      requireAdmin()
    }
    setEditTaskId(0)
  }

  const handleConfirmTaskAcceptance = async (
    task: Task,
    payload: AcceptancePayload,
  ) => {
    if (isAdmin) {
      const saved = await handleUpdateTask(task.id, {
        ...payload.taskChanges,
        status: '已验收',
        reviewer: payload.taskChanges?.reviewer || task.reviewer || payload.taskChanges?.requester || task.requester || '待确认',
        actualHours: payload.actualHours,
        acceptanceNote: payload.acceptanceNote,
        feedbackRating: payload.feedbackRating,
        feedbackTags: payload.feedbackTags,
        feedbackNote: payload.feedbackNote,
        timeEntries: payload.timeEntries,
        waitingEntries: payload.waitingEntries,
        acceptanceFiles: payload.acceptanceFiles,
        progress: 100,
        ...(task.status === '已验收' ? { allowAcceptedTimeEdit: true } : {}),
        // 非补录任务：结算月份自动跟随验收时间（当前年月）
        settlementMonth: isSupplementalTask(task) ? taskSettlementMonth(task) : monthPart(isoDate()),
      })
      if (!saved) {
        throw new Error('任务状态未能写入，请稍后重试')
      }
    } else {
      requireAdmin()
      throw new Error('需要管理员权限')
    }
  }

  const handleQuickUploadImage = async (
    taskId: number,
    file: File,
    onProgress?: (ratio: number) => void,
    entryId?: string,
  ) => {
    try {
      validateUploadFile(file)
      const prepared = await prepareImageFiles(file)
      const uploadFile = prepared.uploadFile
      const uploadExtension = fileTypeForFile(uploadFile).type
      const preview = prepared.previewFile ?? await createOptionalPreviewFile(uploadFile)
      await api.uploadFile({
        taskId,
        entryId,
        scope: 'progress',
        file: uploadFile,
        preview,
        type: uploadExtension,
        size: formatFileSize(uploadFile.size),
        final: false,
        visible: true,
        analyze: true,
      }, onProgress)
      await refreshState()
      await loadTaskActivity(taskId)
      notify('图片已上传')
    } catch (error) {
      notify(error instanceof Error ? `上传失败：${error.message}` : '上传失败')
      throw error
    }
  }

  const handleAcceptanceFileUpload = async (taskId: number, file: File, onProgress?: (ratio: number) => void, entryId?: string, preview?: File) => {
    const extension = fileTypeForFile(file).type
    const savedFile = await api.uploadFile(
      {
        taskId,
        entryId,
        scope: 'acceptance',
        file,
        preview,
        type: extension,
        size: formatFileSize(file.size),
        final: true,
        visible: true,
        tag: '验收文件',
        analyze: true,
      },
      onProgress,
    )
    setFileItems((currentFiles) => [savedFile, ...currentFiles])
    setTaskItems((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? { ...task, files: Array.from(new Set([savedFile.name, ...task.files])) } : task)),
    )
    // 缩略图不是源文件上传的前置条件。复杂 PDF / Office 即使首次渲染失败，
    // 完整文件也已经可用；后台再有限重试并把成功结果持久化到 R2。
    if (fileTypeForFile(file).kind !== 'image') {
      void (async () => {
        for (const delay of [0, 800, 2400]) {
          if (delay > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, delay))
          }
          const preview = await createOptionalPreviewFile(file)
          if (!preview) {
            continue
          }
          try {
            const result = await api.setFilePreview(savedFile.id, preview)
            if (result.previewUrl) {
              savedFile.previewUrl = result.previewUrl
              setFileItems((currentFiles) => currentFiles.map((item) => (
                item.id === savedFile.id ? { ...item, previewUrl: result.previewUrl, previewFallback: Boolean(result.previewFallback) } : item
              )))
              return
            }
          } catch (error) {
            console.warn('验收附件缩略图持久化失败', file.name, error)
          }
        }
      })()
    }
    return savedFile
  }

  // AI 自动估算整体进度：读取完整生命周期证据，并按语义签名去重。
  const autoEstimateSigRef = useRef<Map<number, string>>(new Map())
  const aiProgressWriteRef = useRef<Set<number>>(new Set())
  const handleAutoEstimateProgress = async (task: Task) => {
    if (!isAdmin) {
      return
    }
    if (['已验收', '终止', '挂起', '不计费'].includes(task.status)) {
      return
    }
    const taskFiles = fileItems.filter((file) => file.taskId === task.id && !file.deletedAt)
    const attachmentsByEntry = new Map<string, string[]>()
    taskFiles.forEach((file) => {
      if (!file.entryId) return
      attachmentsByEntry.set(file.entryId, [...(attachmentsByEntry.get(file.entryId) ?? []), file.name])
    })
    const entries = [...(task.timeEntries ?? [])]
      .sort((left, right) => `${left.date ?? ''}T${left.start}`.localeCompare(`${right.date ?? ''}T${right.start}`))
      .filter((entry) => (entry.note ?? '').trim() || (attachmentsByEntry.get(entry.id)?.length ?? 0) > 0)
    if (entries.length === 0 && taskFiles.length === 0) {
      return
    }
    const payload = {
      taskId: task.id,
      title: task.title,
      type: task.type,
      requirement: task.requirement,
      status: task.status,
      currentProgress: snapProgress(task.progress),
      estimatedHours: task.estimatedHours,
      actualHours: task.actualHours,
      entries: entries.map((entry) => ({
        id: entry.id,
        date: entry.date ?? '',
        endDate: entry.endDate ?? entry.date ?? '',
        note: entry.note ?? '',
        isAcceptance: Boolean(entry.isAcceptanceProgress),
        isRevision: Boolean(entry.isRevision),
        isClientFeedback: Boolean(entry.isClientFeedback),
        isUncounted: Boolean(entry.isUncounted),
        feedbackVersion: entry.feedbackVersion ?? '',
        attachments: attachmentsByEntry.get(entry.id) ?? [],
      })),
      waitingEntries: (task.waitingEntries ?? []).map((entry) => ({
        date: entry.date ?? '',
        note: entry.note ?? '',
        reason: entry.reason ?? '',
        active: (entry.endDate ?? entry.date ?? '') === (entry.date ?? '') && entry.end === entry.start,
      })),
      files: taskFiles.map((file) => ({
        name: file.name,
        scope: file.scope,
        final: file.final,
        tag: file.tag ?? '',
      })),
    }
    const signature = JSON.stringify(payload)
    if (autoEstimateSigRef.current.get(task.id) === signature) {
      return
    }
    autoEstimateSigRef.current.set(task.id, signature)
    try {
      const result = await api.estimateTaskProgress(payload)
      if (autoEstimateSigRef.current.get(task.id) !== signature) {
        return
      }
      setProgressAssessments((current) => ({ ...current, [task.id]: result }))
      const next = snapProgress(result.progress)
      const current = taskItemsRef.current.find((item) => item.id === task.id)
      if (!current || ['已验收', '终止', '挂起', '不计费'].includes(current.status)) {
        return
      }
      if (snapProgress(current.progress) !== next) {
        aiProgressWriteRef.current.add(task.id)
        await handleUpdateTask(task.id, { progress: next })
      }
    } catch {
      // 失败则清掉签名，下次再试
      if (autoEstimateSigRef.current.get(task.id) === signature) {
        autoEstimateSigRef.current.delete(task.id)
      }
    }
  }

  const handleUpdateTask = async (taskId: number, changes: TaskUpdateChanges) => {
    if (updatingTaskIdsRef.current.has(taskId)) {
      pendingTaskChangesRef.current.set(taskId, { ...(pendingTaskChangesRef.current.get(taskId) ?? {}), ...changes })
      return false
    }
    const currentTask = taskItemsRef.current.find((task) => task.id === taskId)
    if (!currentTask) {
      return false
    }
    const allowAcceptedTimeEdit = Boolean(changes.allowAcceptedTimeEdit)
    const allowAcceptanceRollback = Boolean(changes.allowAcceptanceRollback)
    if (currentTask.status === '已验收') {
      if (changes.status && changes.status !== '已验收' && !allowAcceptanceRollback) {
        notify('已验收任务状态已锁定，如需调整请先走验收修正流程')
        return false
      }
      if (!allowAcceptedTimeEdit && ('actualHours' in changes || 'timeEntries' in changes)) {
        notify('已验收任务的工时已锁定，不能再修改实际工时')
        return false
      }
    }
    const normalizedChanges = { ...changes }
    const isAiProgressWrite = Object.hasOwn(changes, 'progress') && aiProgressWriteRef.current.has(taskId)
    const isManualProgressCorrection = Object.hasOwn(changes, 'progress') && !isAiProgressWrite
    if (normalizedChanges.progress !== undefined) {
      normalizedChanges.progress = snapProgress(Number(normalizedChanges.progress))
    }
    if (currentTask.status === '计划中' && normalizedChanges.progress !== undefined && !changes.status) {
      normalizedChanges.progress = 0
    }
    if (changes.status) {
      normalizedChanges.stage = changes.status === '已验收' ? '完成' : changes.status
      normalizedChanges.progress = changes.status === '已验收'
        ? 100
        : changes.status === '计划中'
          ? 0
          : allowAcceptanceRollback && changes.status === '待验收'
            ? snapProgress(Number(changes.progress ?? Math.min(currentTask.progress, 80)))
            : changes.status === '待验收'
              ? snapProgress(Math.max(currentTask.progress, 80))
              : snapProgress(currentTask.progress)
      notify('正在保存…', 'info')
    }

    updatingTaskIdsRef.current.add(taskId)
    let savedSuccessfully = false
    try {
      const savedTask = normalizeTaskClosure(await api.updateTask(taskId, normalizedChanges))
      setTaskItems((currentTasks) => currentTasks.map((task) => (task.id === taskId ? normalizeTaskClosure({ ...task, ...savedTask }) : task)))
      setBackendStatus('已接入 D1/R2')
      if (detailTaskId === taskId) {
        void loadTaskActivity(taskId)
      }
      if (selectedTask?.id === taskId) {
        void loadTaskActivity(taskId)
      }
      if (changes.status === '已验收') {
        setShowFireworks(true)
        window.setTimeout(() => setShowFireworks(false), 3000)
      }
      if (changes.status) {
        notify('任务已同步到 D1')
      }
      savedSuccessfully = true
      if (isManualProgressCorrection) {
        const assessment = progressAssessments[taskId]
        if (assessment && snapProgress(Number(normalizedChanges.progress)) !== assessment.progress) {
          void api.recordAiLearningEvent({
            context: 'task_progress',
            sourceInput: assessment.reason,
            aiOutput: String(assessment.progress),
            userFinal: String(snapProgress(Number(normalizedChanges.progress))),
            action: 'edited',
            designType: currentTask.type,
            taskId,
            taskTitle: currentTask.title,
            metadata: {
              stage: assessment.stage,
              confidence: assessment.confidence,
              evidence: assessment.evidence,
              algorithmVersion: '2.0.0',
            },
          })
        }
      }
      const shouldReassessProgress = !Object.hasOwn(changes, 'progress') && (
        Object.hasOwn(changes, 'timeEntries')
        || Object.hasOwn(changes, 'waitingEntries')
        || Object.hasOwn(changes, 'requirement')
        || Object.hasOwn(changes, 'type')
        || Object.hasOwn(changes, 'status')
      )
      if (shouldReassessProgress && !['已验收', '终止', '挂起', '不计费'].includes(savedTask.status)) {
        window.setTimeout(() => void handleAutoEstimateProgress(savedTask), 0)
      }
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `任务更新失败：${error.message}` : '任务更新失败')
    } finally {
      updatingTaskIdsRef.current.delete(taskId)
      if (isAiProgressWrite) {
        aiProgressWriteRef.current.delete(taskId)
      }
      const pendingChanges = pendingTaskChangesRef.current.get(taskId)
      if (pendingChanges) {
        pendingTaskChangesRef.current.delete(taskId)
        void handleUpdateTask(taskId, pendingChanges)
      }
    }
    return savedSuccessfully
  }

  const handleVoidTask = (taskId: number) => {
    const task = taskItems.find((item) => item.id === taskId)
    if (!task || task.voidedAt) {
      return
    }
    setVoidTaskTarget(task)
  }

  const confirmVoidTask = async (reason: string) => {
    if (!voidTaskTarget || isVoidTaskBusy) {
      return
    }
    setIsVoidTaskBusy(true)
    try {
      await api.voidTask(voidTaskTarget.id, reason.trim())
      await refreshState()
      setVoidTaskTarget(null)
      notify('任务已作废，不再计入工时和结算')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `作废失败：${error.message}` : '作废失败')
    } finally {
      setIsVoidTaskBusy(false)
    }
  }

  const handleRestoreTask = async (taskId: number) => {
    try {
      await api.restoreTask(taskId)
      await refreshState()
      notify('任务已恢复')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `恢复失败：${error.message}` : '恢复失败')
    }
  }

  const handleDeleteTask = (taskId: number) => {
    const task = taskItems.find((item) => item.id === taskId)
    if (!task?.voidedAt) {
      notify('只有已作废任务才能永久删除', 'error')
      return
    }
    setConfirmDialog({
      eyebrow: '永久删除',
      title: `确定永久删除「${task.title}」吗？`,
      body: '永久删除只允许用于已作废任务。删除后任务不会再出现在后台列表中，关联文件仍会保留在文件库记录里。',
      confirmText: '永久删除',
      tone: 'danger',
      details: [task.type, `作废原因：${task.voidReason || '未记录'}`],
      onConfirm: async () => {
        try {
          await api.deleteTask(taskId)
          await refreshState()
          notify('已作废任务已永久删除')
        } catch (error) {
          setBackendStatus('后端异常')
          notify(error instanceof Error ? `删除失败：${error.message}` : '删除失败')
        }
      },
    })
  }

  const handleDownloadFile = (file: FileAsset) => {
    const sourceUrl = authedPreviewUrl(file.sourceUrl)
    if (!sourceUrl) {
      notify('源文件链接不可用', 'error')
      return
    }
    const link = document.createElement('a')
    link.href = sourceUrl
    link.download = file.name
    link.rel = 'noreferrer'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const handleDeleteFile = async (fileId: number) => {
    const file = fileItems.find((item) => item.id === fileId)
    const fileTask = file ? taskItemsRef.current.find((task) => task.id === file.taskId) : undefined
    const shouldRollbackAcceptance = Boolean(file && file.scope === 'acceptance' && fileTask?.status === '已验收')
    setConfirmDialog({
      eyebrow: shouldRollbackAcceptance ? '撤回验收文件' : '删除文件',
      title: `确定删除「${file?.name ?? '该文件'}」吗？`,
      body: shouldRollbackAcceptance
        ? '这是已验收任务的验收文件。删除后会同时撤回验收状态，任务回到待验收，方便重新补传文件后再次确认。'
        : '删除后会同时移除 D1 文件记录、R2 源文件和预览图。请只删除误传文件，已验收或已发给合作伙伴的文件建议保留。',
      confirmText: shouldRollbackAcceptance ? '删除并撤回验收' : '确认删除',
      tone: 'danger',
      details: [file?.task, file?.type, file?.size, shouldRollbackAcceptance ? '状态将改回待验收' : ''].filter(Boolean) as string[],
      onConfirm: async () => {
        try {
          await api.deleteFile(fileId)
          if (previewFile?.id === fileId) {
            setPreviewFile(null)
          }
          if (shouldRollbackAcceptance && fileTask && file) {
            const nextAcceptanceFiles = (fileTask.acceptanceFiles ?? []).filter((name) => name !== file.name)
            await handleUpdateTask(fileTask.id, {
              status: '待验收',
              stage: '待验收',
              progress: snapProgress(Math.min(fileTask.progress, 80)),
              acceptanceFiles: nextAcceptanceFiles,
              actualDeliveryDate: '',
              allowAcceptanceRollback: true,
            })
          }
          await refreshState()
          notify(shouldRollbackAcceptance ? '验收文件已删除，任务已回到待验收' : '文件已删除')
        } catch (error) {
          setBackendStatus('后端异常')
          notify(error instanceof Error ? `文件删除失败：${error.message}` : '文件删除失败')
        }
      },
    })
  }

  const handleUpdateFile = async (fileId: number, changes: { name?: string; tag?: string; scope?: 'acceptance' | 'progress' }) => {
    try {
      const updatedFile = await api.updateFile(fileId, changes)
      setFileItems((currentFiles) => currentFiles.map((file) => (file.id === fileId ? { ...file, ...updatedFile } : file)))
      setTaskItems((currentTasks) =>
        currentTasks.map((task) =>
          task.id === updatedFile.taskId
            ? { ...task, files: Array.from(new Set([updatedFile.name, ...task.files.filter((fileName) => fileName !== updatedFile.name)])) }
            : task,
        ),
      )
      notify('文件信息已更新')
      return updatedFile
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `文件更新失败：${error.message}` : '文件更新失败')
      throw error
    }
  }


  return {
    progressAssessments, voidTaskTarget, setVoidTaskTarget, isVoidTaskBusy, showFireworks,
    requireAdmin, handleCreateTask, handleRetryAttachmentAnalysis, handleCreateTaskUpdate,
    handleOpenTaskDetail, handleOpenTaskEdit, handleOpenTaskProgress, handleDeleteTaskTimeEntry,
    handleTaskCalendarMonthChange, shiftTaskCalendarPeriod,
    handleDeleteAcceptanceProgress, handleOpenTaskAcceptance, handleSaveTaskEdit,
    handleConfirmTaskAcceptance, handleQuickUploadImage, handleAcceptanceFileUpload,
    handleAutoEstimateProgress, handleUpdateTask, handleVoidTask, confirmVoidTask,
    handleRestoreTask, handleDeleteTask, handleDownloadFile, handleDeleteFile, handleUpdateFile,
  }
}
