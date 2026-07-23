import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRightLeft, ChevronDown, Pencil, Plus, RotateCcw, Sparkles, Star, Trash2, X } from 'lucide-react'
import { api, authedPreviewUrl, type ActivityItem, type AttachmentNameSuggestion, type TextAssistantSuggestion, type TextLearningContext, type VoiceScheduleResult } from '../lib/api'
import { aiLearningAction, type AiLearningDraft } from '../lib/aiLearning'
import { createOptionalPreviewFile } from '../lib/attachmentPreview'
import { datePart, formatDurationZh, formatMonthDay, formatPlanDateTime, isoDate, isoDateTime, toDateTimeInputValue } from '../lib/dateTime'
import { formatDuration } from '../lib/durationDisplay'
import { DURATION_STEP_MINUTES, exactDurationMinutesBetween, formatEstimatedDurationInputValue, parseEstimatedDurationInputMinutes, type ScheduleAnchor } from '../lib/durationInput'
import { splitFileName } from '../lib/fileName'
import { parseFileTags, serializeFileTags } from '../lib/fileMetadata'
import { fileThumbnailSource, fileTypeForAsset, fileTypeForFile, isInlineImageFileType } from '../lib/fileTypes'
import { formatFileSize } from '../lib/format'
import { ensurePendingAttachmentPreparation, ensurePendingAttachmentPreview, imageFileBase64, imageUrlBase64, looksLikeUntidyFileName, pastedImageName, renamedFile, sanitizeAttachmentName, validateUploadFile } from '../lib/fileUpload'
import { formatYuan, roundCents } from '../lib/money'
import { monthLabelOf } from '../lib/month'
import { clearProgressDraft, getOrCreateStagedProgressEntryId, getPendingProgressAttachments, progressDraftKey, readProgressDraft, setPendingProgressAttachments, writeProgressDraft } from '../lib/progressDraftCache'
import { isSupplementalTask, minutesForTimeEntry, minutesForWaitingEntry, normalizeClockInput, sumTimeEntries, sumWaitingEntries } from '../lib/taskAccounting'
import { taskAssistantActivity, taskAssistantFiles, taskAssistantProgressHistory } from '../lib/taskAssistantContext'
import { taskSettlementMonth } from '../lib/taskSettlement'
import { formatEntryDateTimeRange, formatWaitingEntryDateTimeRange, isAcceptanceFileAsset, partnerFacingText } from '../lib/taskPresentation'
import { addMinutesToPlanDateTime, defaultTimeEntryDraft, fillTimeDraftFromDuration, findNearestAvailableTimeSlot, timeEntriesOverlap, type TimeEntryDraft } from '../lib/timeEntryDraft'
import type { FileAsset, Task, TaskFeedbackRating, TaskFeedbackTag, TimeEntry, WaitingEntry } from '../types/domain'
import type { AcceptancePayload, PendingProgressAttachment, ProgressRecordMode, TaskUpdateChanges } from '../types/taskUi'
import type { ToastTone } from '../lib/toastQueue'
import { AttachmentHoverThumbnail } from './AttachmentHoverThumbnail'
import { ModalShell } from './ModalShell'
import { PendingAttachmentPreview, PendingAttachmentThumbnail } from './PendingAttachmentPreview'
import { PlanDateTimeField } from './PlanDateTimeField'
import { ScheduleAnchorSwitch, VoiceScheduleButton } from './VoiceScheduleButton'

const taskFeedbackRatings: TaskFeedbackRating[] = ['顺利', '一般', '有问题']
const taskFeedbackTags: TaskFeedbackTag[] = ['需求不清晰', '沟通成本高', '定价偏低', '技术挑战大']

function renderTextAssistantBody(text: string) {
  return text.split('\n').map((line, index) => {
    const trimmed = line.trim()
    return trimmed ? <span className="ai-suggestion-line" key={index}>{trimmed}</span> : null
  })
}

export function TaskProgressModal({
  task,
  mode = 'progress',
  editEntryId,
  files,
  activity,
  onClose,
  onUpdateTask,
  onCreateTaskUpdate,
  onUploadImage,
  onPreviewFile,
  onUpdateFile,
  onDeleteFile,
  onConfirmAcceptance,
  onUploadAcceptanceFile,
  onNotify,
  initialAcceptanceMode = false,
  hourlyRate = 0,
}: {
  task: Task
  mode?: ProgressRecordMode
  editEntryId?: string
  files: FileAsset[]
  activity: ActivityItem[]
  onClose: () => void
  onUpdateTask: (taskId: number, changes: TaskUpdateChanges) => void | Promise<boolean>
  onCreateTaskUpdate: (taskId: number, update: { title: string; body: string; hours: number; visible: boolean }) => Promise<void>
  onUploadImage: (taskId: number, file: File, onProgress?: (ratio: number) => void, entryId?: string) => Promise<void>
  onPreviewFile: (file: FileAsset) => void
  onUpdateFile: (fileId: number, changes: { name?: string; tag?: string; scope?: 'acceptance' | 'progress' }) => Promise<FileAsset>
  onDeleteFile: (fileId: number) => void
  onConfirmAcceptance?: (task: Task, payload: AcceptancePayload) => Promise<void>
  onUploadAcceptanceFile?: (taskId: number, file: File, onProgress?: (ratio: number) => void, entryId?: string, preview?: File) => Promise<FileAsset>
  onNotify: (message: string, tone?: ToastTone) => void
  initialAcceptanceMode?: boolean
  hourlyRate?: number
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const replacementInputRef = useRef<HTMLInputElement | null>(null)
  const existingReplacementInputRef = useRef<HTMLInputElement | null>(null)
  const pasteImageFilesRef = useRef<(files: File[]) => void>(() => undefined)
  const [replacementAttachmentId, setReplacementAttachmentId] = useState('')
  const [replacementExistingFileId, setReplacementExistingFileId] = useState<number | null>(null)
  const isWaitingMode = mode === 'waiting'
  const isFeedbackMode = mode === 'feedback'
  const editingEntry = (isWaitingMode ? task.waitingEntries ?? [] : task.timeEntries ?? []).find((entry) => entry.id === editEntryId)
  const initialAcceptanceFlag = initialAcceptanceMode || Boolean(editingEntry?.isAcceptanceProgress)
  const existingEntryAttachments = files.filter((file) => {
    if (file.taskId !== task.id || file.deletedAt) {
      return false
    }
    if (editEntryId && file.entryId === editEntryId) {
      return true
    }
    return initialAcceptanceFlag && task.status === '已验收' && file.scope === 'acceptance'
  })
  const existingAttachmentSignature = existingEntryAttachments.map((file) => `${file.id}:${file.name}`).join('|')
  const progressDraftStorageKey = progressDraftKey(task.id, mode, editEntryId)
  const initialProgressDraft = useMemo(
    () => {
      const currentDefault = defaultTimeEntryDraft()
      const entryDraft = editingEntry
        ? {
            date: editingEntry.date || isoDate(),
            endDate: editingEntry.endDate || editingEntry.date || isoDate(),
            start: editingEntry.start,
            end: editingEntry.end,
            note: editingEntry.note ?? '',
          }
        : currentDefault
      const cachedDraft = readProgressDraft(progressDraftStorageKey, {
        note: initialAcceptanceFlag ? task.acceptanceNote ?? editingEntry?.note ?? '' : editingEntry?.note ?? '',
        timeDraft: isWaitingMode ? currentDefault : entryDraft,
        timeEntries: (task.timeEntries ?? []) as TimeEntry[],
        waitingDraft: isWaitingMode ? entryDraft : currentDefault,
        waitingEntries: (task.waitingEntries ?? []) as WaitingEntry[],
        segmentMinutes: Math.max(1, minutesForTimeEntry(entryDraft)),
        scheduleAnchor: 'hours' as ScheduleAnchor,
        feedbackRating: (task.feedbackRating ?? '') as TaskFeedbackRating | '',
        feedbackTags: (task.feedbackTags ?? []) as TaskFeedbackTag[],
        feedbackNote: task.feedbackNote ?? '',
      })
      const resolvedMinutes = Math.max(1, Math.round(Number.isFinite(cachedDraft.segmentMinutes) && cachedDraft.segmentMinutes > 0
        ? cachedDraft.segmentMinutes
        : minutesForTimeEntry(entryDraft)))
      const resolvedAnchor: ScheduleAnchor = (['start', 'hours', 'end'] as ScheduleAnchor[]).includes(cachedDraft.scheduleAnchor)
        ? cachedDraft.scheduleAnchor
        : 'hours'
      // 若缓存里某一端时间为空，在初始化时用「另一端 + 本段工时」补全，避免打开弹窗时显示空白。
      const timeDraftWithDerived = fillTimeDraftFromDuration(cachedDraft.timeDraft, resolvedMinutes)
      const waitingDraftWithDerived = fillTimeDraftFromDuration(cachedDraft.waitingDraft, resolvedMinutes)
      return {
        ...cachedDraft,
        // 始终从 task 取最新快照，避免缓存里的旧 timeEntries/waitingEntries 造成误判冲突
        timeEntries: (task.timeEntries ?? []) as TimeEntry[],
        waitingEntries: (task.waitingEntries ?? []) as WaitingEntry[],
        timeDraft: timeDraftWithDerived,
        waitingDraft: waitingDraftWithDerived,
        segmentMinutes: resolvedMinutes,
        scheduleAnchor: resolvedAnchor,
      }
    },
    [editingEntry, initialAcceptanceFlag, isWaitingMode, progressDraftStorageKey, task.acceptanceNote, task.feedbackNote, task.feedbackRating, task.feedbackTags, task.timeEntries, task.waitingEntries],
  )
  const [note, setNote] = useState(initialProgressDraft.note)
  const [timeDraft, setTimeDraft] = useState<TimeEntryDraft>(initialProgressDraft.timeDraft)
  const [draftTimeEntries] = useState<TimeEntry[]>(initialProgressDraft.timeEntries)
  const [waitingDraft, setWaitingDraft] = useState<TimeEntryDraft>(initialProgressDraft.waitingDraft)
  const [draftWaitingEntries] = useState<WaitingEntry[]>(initialProgressDraft.waitingEntries)
  const [segmentMinutes, setSegmentMinutes] = useState(initialProgressDraft.segmentMinutes)
  const [segmentDurationInput, setSegmentDurationInput] = useState(() => formatEstimatedDurationInputValue(initialProgressDraft.segmentMinutes))
  const [isSegmentDurationFocused, setIsSegmentDurationFocused] = useState(false)
  const [scheduleDerivedField, setScheduleDerivedField] = useState<ScheduleAnchor>(initialProgressDraft.scheduleAnchor)
  const [hasTouchedSchedule, setHasTouchedSchedule] = useState(Boolean(editingEntry))
  const [isSaving, setIsSaving] = useState(false)
  const [timeEntryError, setTimeEntryError] = useState('')
  const [activeDatePickerId, setActiveDatePickerId] = useState<string | null>(null)
  const [pendingAttachments, setPendingAttachments] = useState<PendingProgressAttachment[]>(
    () => getPendingProgressAttachments(progressDraftStorageKey),
  )
  // 本次草稿对应的稳定 entryId：预上传与最终生成的进展条目共用，确保文件挂到正确条目。
  const stagedEntryIdRef = useRef<string>(
    getOrCreateStagedProgressEntryId(progressDraftStorageKey, editEntryId),
  )
  // 进行中的预上传 Promise（按附件 id 索引），保存时若仍在传则等待其完成。
  const [existingAttachmentDrafts, setExistingAttachmentDrafts] = useState<Record<number, string>>({})
  const [existingAttachmentAiState, setExistingAttachmentAiState] = useState<Record<number, {
    loading?: boolean
    error?: string
    suggestion?: AttachmentNameSuggestion
  }>>({})
  const [uploadingExistingFileId, setUploadingExistingFileId] = useState<number | null>(null)
  const [updatingExistingAcceptanceFileId, setUpdatingExistingAcceptanceFileId] = useState<number | null>(null)
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [previewAttachment, setPreviewAttachment] = useState<PendingProgressAttachment | null>(null)
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const dragDepthRef = useRef(0)
  // 多段工时：用户在本次进展中预暂存的额外时间段（尚未提交到 DB）
  const [pendingExtraSegments, setPendingExtraSegments] = useState<TimeEntry[]>([])
  const [isAcceptanceMode, setIsAcceptanceMode] = useState(initialAcceptanceFlag)
  const initialPlanStartValue = toDateTimeInputValue(task.date || isoDateTime())
  const fallbackPlanEndValue = addMinutesToPlanDateTime(
    initialPlanStartValue || isoDateTime(),
    Math.max(1, Math.round((task.estimatedHours > 0 ? task.estimatedHours : 1) * 60)),
  )
  const initialPlanEndValue = toDateTimeInputValue(task.estimatedDate || fallbackPlanEndValue)
  const initialPlanDuration = exactDurationMinutesBetween(initialPlanStartValue, initialPlanEndValue)
  const initialPlanMinutes = Math.max(
    1,
    Math.round(task.estimatedHours > 0 ? task.estimatedHours * 60 : initialPlanDuration > 0 ? initialPlanDuration : 60),
  )
  const [planReferenceDraft, setPlanReferenceDraft] = useState<TimeEntryDraft>(() => ({
    date: datePart(initialPlanStartValue || isoDateTime()),
    start: initialPlanStartValue ? initialPlanStartValue.slice(11, 16) : '09:00',
    endDate: datePart(initialPlanEndValue || fallbackPlanEndValue),
    end: (initialPlanEndValue || fallbackPlanEndValue).slice(11, 16),
    note: '',
  }))
  const [planReferenceMinutes, setPlanReferenceMinutes] = useState(initialPlanMinutes)
  const [planReferenceDurationInput, setPlanReferenceDurationInput] = useState(() => formatEstimatedDurationInputValue(initialPlanMinutes))
  const [isPlanReferenceDurationFocused, setIsPlanReferenceDurationFocused] = useState(false)
  const [planReferenceDerivedField, setPlanReferenceDerivedField] = useState<ScheduleAnchor>('hours')
  // 验收阶段是否计入本次工时：默认计入；关闭后本次验收不新增工时（已汇总工时仍保留），
  // 用于「临近验收时一两分钟的小改动不想计时」等极少数特殊情况。
  const [countAcceptanceTime, setCountAcceptanceTime] = useState(true)
  // 普通进展是否计入工时：默认计入；编辑已有分段时以保存的 isUncounted 为准。
  // 适用于「对方只给了点修改反馈，想留个进展记录但不算工时」等场景。
  const [countProgressTime, setCountProgressTime] = useState(() => {
    if (isFeedbackMode) {
      return false
    }
    if (!editingEntry) {
      return true
    }
    if (editingEntry.isUncounted) {
      return false
    }
    return minutesForTimeEntry(editingEntry) > 0
  })
  // 本次进展是否为「改稿轮次」：显式开关，开 = 计入需求人画像的改稿轮次；
  // 关 = 只是把任务分阶段提交，不算改稿。仅用于画像/AI 分析，不影响计时与结算。
  const [isRevisionRound, setIsRevisionRound] = useState(isFeedbackMode ? editingEntry?.isRevision !== false : Boolean(editingEntry?.isRevision))
  const [feedbackVersion, setFeedbackVersion] = useState(editingEntry?.feedbackVersion ?? '')
  const [feedbackSource, setFeedbackSource] = useState(partnerFacingText(editingEntry?.feedbackSource))
  const [isAcceptanceBaseExpanded, setIsAcceptanceBaseExpanded] = useState(false)
  const acceptanceBaseRef = useRef<HTMLElement | null>(null)
  const [feedbackRating, setFeedbackRating] = useState<TaskFeedbackRating | ''>(initialProgressDraft.feedbackRating ?? '')
  const [feedbackTags, setFeedbackTags] = useState<TaskFeedbackTag[]>(initialProgressDraft.feedbackTags ?? [])
  const [feedbackNote, setFeedbackNote] = useState(initialProgressDraft.feedbackNote ?? '')
  const [progressAiSuggestion, setProgressAiSuggestion] = useState<TextAssistantSuggestion | null>(null)
  const [progressAiError, setProgressAiError] = useState('')
  const [isProgressAiLoading, setIsProgressAiLoading] = useState(false)
  const progressAiSuggestionAppliedRef = useRef<({ context: TextLearningContext } & AiLearningDraft) | null>(null)
  const pendingAttachmentAiNameAppliedRef = useRef<Record<string, AiLearningDraft>>({})
  const existingAttachmentAiNameAppliedRef = useRef<Record<number, AiLearningDraft>>({})
  const uploadedNames = pendingAttachments.map((attachment) => sanitizeAttachmentName(attachment.name, attachment.originalName))
  const projectProgressHistory = taskAssistantProgressHistory(task, files)
  const savedTimeSignature = JSON.stringify(task.timeEntries ?? [])
  const timeDirty = JSON.stringify(draftTimeEntries) !== savedTimeSignature
  const savedWaitingSignature = JSON.stringify(task.waitingEntries ?? [])
  const waitingDirty = JSON.stringify(draftWaitingEntries) !== savedWaitingSignature
  const activeDraft = isWaitingMode ? waitingDraft : timeDraft
  const updateActiveDraft = (updater: (current: TimeEntryDraft) => TimeEntryDraft) => {
    if (isWaitingMode) {
      setWaitingDraft(updater)
      return
    }
    setTimeDraft(updater)
  }
  const toggleAcceptanceMode = () => {
    if (isAcceptanceMode) {
      setTimeDraft((current) => ({
        ...current,
        note: note.trim() ? note : current.note,
      }))
    } else if (!note.trim() && timeDraft.note.trim()) {
      setNote(timeDraft.note)
    }
    setIsAcceptanceMode((current) => !current)
    setIsAcceptanceBaseExpanded(false)
  }
  const activeStartDate = /^\d{4}-\d{2}-\d{2}$/.test(activeDraft.date || '') ? activeDraft.date : isoDate()
  const activeEndDate = /^\d{4}-\d{2}-\d{2}$/.test(activeDraft.endDate || '') ? activeDraft.endDate : activeStartDate
  const draftEntry = {
    date: activeStartDate,
    endDate: activeEndDate,
    start: activeDraft.start,
    end: activeDraft.end,
  }
  const draftEntryMinutes = minutesForTimeEntry(draftEntry)
  const hasDraftTimeEntry = activeDraft.start.trim() !== '' && activeDraft.end.trim() !== '' && draftEntryMinutes > 0
  const isEditingEntry = Boolean(editEntryId && editingEntry)
  const comparableEntries = [...draftTimeEntries, ...draftWaitingEntries, ...pendingExtraSegments].filter((entry) => entry.id !== editEntryId)
  const draftConflict = activeDraft.start.trim() && activeDraft.end.trim() && draftEntryMinutes > 0
    ? comparableEntries.find((entry) => timeEntriesOverlap(draftEntry, entry))
    : undefined
  const isAcceptanceRevisionMode = isAcceptanceMode && task.status === '已验收'
  const isEditingAcceptanceEntry = Boolean(isEditingEntry && editingEntry?.isAcceptanceProgress)
  const isRollingBackAcceptanceEntry = isEditingAcceptanceEntry && !isAcceptanceMode && task.status === '已验收'
  const hasAnotherAcceptanceProgress = !isWaitingMode && (task.timeEntries ?? []).some((entry) => entry.isAcceptanceProgress && entry.id !== editEntryId)
  const canToggleAcceptanceMode = Boolean(onConfirmAcceptance) && !isWaitingMode && !isFeedbackMode && !hasAnotherAcceptanceProgress && (task.status !== '已验收' || isEditingAcceptanceEntry)
  const isConvertingEntryToAcceptance = isAcceptanceMode && isEditingEntry && !editingEntry?.isAcceptanceProgress && task.status !== '已验收'
  const showAcceptanceTaskReference = () => {
    setIsAcceptanceBaseExpanded(true)
    window.requestAnimationFrame(() => {
      acceptanceBaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }
  const shouldIncludeAcceptanceDraftEntry = !isWaitingMode && !isFeedbackMode && !isEditingEntry && hasTouchedSchedule && hasDraftTimeEntry && !draftConflict && countAcceptanceTime
  // 本次是否计入工时：等待恒计；验收看 countAcceptanceTime；普通进展看 countProgressTime
  const timeCounts = isWaitingMode ? true : isFeedbackMode ? false : isAcceptanceMode ? countAcceptanceTime : countProgressTime
  // 只有「验收且不计工时」才锁定时间输入；普通进展即便不计工时，时间仍可自选
  const lockSchedule = isAcceptanceMode && !countAcceptanceTime
  // 不计工时的普通进展：没有有效时间段也能保存，只要有备注或附件（计 0 工时，仅作进展记录）
  const isZeroTimeProgress = !isWaitingMode && !isAcceptanceMode && !countProgressTime
  const canSaveZeroTimeProgress = isZeroTimeProgress && (note.trim().length > 0 || (activeDraft.note ?? '').trim().length > 0 || pendingAttachments.length > 0)
  const suggestedTimeSlot = draftConflict ? findNearestAvailableTimeSlot(draftEntry, comparableEntries) : null
  const applySuggestedTimeSlot = () => {
    if (!suggestedTimeSlot) {
      return
    }
    setHasTouchedSchedule(true)
    updateActiveDraft((current) => ({
      ...current,
      date: datePart(suggestedTimeSlot.start),
      start: suggestedTimeSlot.start.slice(11, 16),
      endDate: datePart(suggestedTimeSlot.end),
      end: suggestedTimeSlot.end.slice(11, 16),
    }))
    setSegmentMinutes(Math.max(1, minutesForTimeEntry({
      date: datePart(suggestedTimeSlot.start),
      start: suggestedTimeSlot.start.slice(11, 16),
      endDate: datePart(suggestedTimeSlot.end),
      end: suggestedTimeSlot.end.slice(11, 16),
    })))
    setTimeEntryError('')
    setActiveDatePickerId(null)
  }

  useEffect(() => {
    writeProgressDraft(progressDraftStorageKey, {
      note,
      timeDraft,
      timeEntries: draftTimeEntries,
      waitingDraft,
      waitingEntries: draftWaitingEntries,
      segmentMinutes,
      scheduleAnchor: scheduleDerivedField,
      feedbackRating,
      feedbackTags,
      feedbackNote,
    })
  }, [draftTimeEntries, draftWaitingEntries, feedbackNote, feedbackRating, feedbackTags, note, progressDraftStorageKey, scheduleDerivedField, segmentMinutes, timeDraft, waitingDraft])

  // mount 后修复：若派生字段（结束/开始时间）为空，立即补全并写回 state
  const initRepairRef = useRef(false)
  useEffect(() => {
    if (initRepairRef.current) return
    initRepairRef.current = true
    const mins = initialProgressDraft.segmentMinutes
    setTimeDraft((current) => fillTimeDraftFromDuration(current, mins))
    setWaitingDraft((current) => fillTimeDraftFromDuration(current, mins))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setPendingProgressAttachments(progressDraftStorageKey, pendingAttachments)
  }, [pendingAttachments, progressDraftStorageKey])

  useEffect(() => {
    setExistingAttachmentDrafts((current) => {
      const next: Record<number, string> = {}
      existingEntryAttachments.forEach((file) => {
        next[file.id] = current[file.id] ?? file.name
      })
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingAttachmentSignature])

  const buildDraftTimeEntry = (options?: { isAcceptanceProgress?: boolean }) => {
    const start = activeDraft.start.trim()
    const end = activeDraft.end.trim()
    const rawNote = isAcceptanceMode ? note : (activeDraft.note || note)
    const noteText = rawNote?.trim() ?? ''
    if (isWaitingMode) {
      if (!start || !activeStartDate) {
        return null
      }
      return {
        id: editEntryId ?? stagedEntryIdRef.current,
        date: activeStartDate,
        endDate: activeStartDate,
        start,
        end: start,
        note: noteText,
      } as WaitingEntry
    }
    if (isFeedbackMode) {
      if (!noteText && pendingAttachments.length === 0) {
        return null
      }
      const hasPicked = Boolean(start && activeStartDate)
      const nowDate = isoDate()
      const nowTime = isoDateTime().slice(11, 16) || '00:00'
      return {
        id: editEntryId ?? stagedEntryIdRef.current,
        date: hasPicked ? activeStartDate : nowDate,
        endDate: hasPicked ? activeStartDate : nowDate,
        start: hasPicked ? start : nowTime,
        end: hasPicked ? start : nowTime,
        note: noteText,
        isClientFeedback: true,
        isUncounted: true,
        isRevision: isRevisionRound,
        feedbackVersion: feedbackVersion.trim(),
        feedbackSource: feedbackSource.trim() || '合作伙伴',
      } as TimeEntry
    }
    // 不计工时的普通进展：时间由用户自选（用于记录与排序），计 0 工时。未选时间则锚到当前时刻。
    if (isZeroTimeProgress) {
      if (!noteText && pendingAttachments.length === 0) {
        return null
      }
      const hasPicked = Boolean(start && activeStartDate)
      const nowDate = isoDate()
      const nowTime = isoDateTime().slice(11, 16) || '00:00'
      const entry: TimeEntry = {
        id: editEntryId ?? stagedEntryIdRef.current,
        date: hasPicked ? activeStartDate : nowDate,
        endDate: hasPicked ? (activeEndDate || activeStartDate) : nowDate,
        start: hasPicked ? start : nowTime,
        end: hasPicked ? (end || start) : nowTime,
        note: noteText,
        isUncounted: true,
      }
      if (isRevisionRound) {
        entry.isRevision = true
      }
      return entry
    }
    if (!start || !end || draftEntryMinutes <= 0) {
      return null
    }
    const entry: TimeEntry = { id: editEntryId ?? stagedEntryIdRef.current, date: activeStartDate, endDate: activeEndDate, start, end, note: noteText }
    if (options?.isAcceptanceProgress) {
      entry.isAcceptanceProgress = true
    }
    // 改稿轮次仅对普通工作进展有意义（等待记录不算改稿）
    if (!isWaitingMode && isRevisionRound) {
      entry.isRevision = true
    }
    return entry
  }

  // 把附件直接上传到后台（带预览生成 + 进度回调），返回服务端文件记录。
  // 不触发全局刷新/通知——这些副作用留到保存时统一处理。
  const stageUploadAttachment = async (
    attachment: PendingProgressAttachment,
    onProgress: (ratio: number) => void,
  ): Promise<FileAsset> => {
    // 用户可能先添加附件、再切换为验收进展。保存时必须以当前模式为准，
    // 不能沿用附件刚加入时的旧 scope，否则验收文件会被误存为普通进展附件。
    const acceptance = isAcceptanceMode || attachment.uploadScope === 'acceptance'
    const prepared = await ensurePendingAttachmentPreparation(attachment)
    const uploadFile = renamedFile(prepared.uploadFile, attachment.name)
    const lightweightPreview = prepared.previewFile
    if (acceptance && onUploadAcceptanceFile) {
      return onUploadAcceptanceFile(task.id, uploadFile, onProgress, stagedEntryIdRef.current, lightweightPreview)
    }
    const extension = fileTypeForFile(uploadFile).type
    const preview = lightweightPreview ?? await createOptionalPreviewFile(uploadFile)
    return api.uploadFile(
      {
        taskId: task.id,
        entryId: stagedEntryIdRef.current,
        scope: acceptance ? 'acceptance' : 'progress',
        file: uploadFile,
        preview,
        type: extension,
        size: formatFileSize(uploadFile.size),
        final: acceptance,
        visible: true,
        tag: acceptance ? '验收文件' : undefined,
        analyze: true,
      },
      onProgress,
    )
  }

  const startStagedUpload = (attachment: PendingProgressAttachment) => {
    attachment.uploadStatus = 'uploading'
    attachment.uploadProgress = 0
    attachment.uploadError = undefined
    let renderedProgressBucket = -1
    const uploadPromise = stageUploadAttachment(attachment, (ratio) => {
      attachment.uploadProgress = ratio
      const progressBucket = ratio >= 1 ? 10 : Math.floor(Math.max(0, ratio) * 10)
      if (progressBucket === renderedProgressBucket) return
      renderedProgressBucket = progressBucket
      setPendingAttachments((current) => current.map((item) =>
        item.id === attachment.id ? { ...item, uploadProgress: ratio } : item,
      ))
    })
      .then((saved) => {
        if (attachment.discarded) {
          void api.deleteFile(saved.id).catch(() => {})
          return undefined
        }
        attachment.uploadedFile = saved
        attachment.uploadStatus = 'done'
        attachment.uploadProgress = 1
        setPendingAttachments((current) => current.map((item) =>
          item.id === attachment.id
            ? { ...item, uploadStatus: 'done', uploadProgress: 1, uploadedFile: saved, uploadError: undefined }
            : item,
        ))
        return saved
      })
      .catch((error) => {
        attachment.uploadStatus = 'error'
        attachment.uploadError = error instanceof Error ? error.message : '上传失败'
        setPendingAttachments((current) => current.map((item) =>
          item.id === attachment.id
            ? { ...item, uploadStatus: 'error', uploadError: attachment.uploadError }
            : item,
        ))
        return undefined
      })
    attachment.uploadPromise = uploadPromise
    setPendingAttachments((current) => current.map((item) =>
      item.id === attachment.id
        ? { ...item, uploadStatus: 'uploading', uploadProgress: 0, uploadPromise, uploadError: undefined }
        : item,
    ))
  }

  // 移除某个待上传附件：若已传到后台则顺手删除，避免产生孤儿文件。
  const discardStagedFile = (fileId?: number) => {
    if (typeof fileId === 'number') {
      void api.deleteFile(fileId).catch(() => {})
    }
  }

  const discardStagedAttachment = (attachment: PendingProgressAttachment) => {
    attachment.discarded = true
    if (attachment.uploadedFile) {
      discardStagedFile(attachment.uploadedFile.id)
      return
    }
    void attachment.uploadPromise?.then((saved) => {
      if (saved) {
        discardStagedFile(saved.id)
      }
    })
  }

  // 保存时才上传，避免用户关闭弹窗后在 R2/D1 留下未关联的暂存文件。
  const finalizeStagedAttachments = async (): Promise<{ names: string[]; failures: string[] }> => {
    const names: string[] = []
    const failures: string[] = []
    for (const attachment of pendingAttachments) {
      let saved = attachment.uploadedFile ?? await attachment.uploadPromise
      if (!saved) {
        setPendingAttachments((current) => current.map((item) =>
          item.id === attachment.id ? { ...item, uploadStatus: 'uploading', uploadProgress: 0, uploadError: undefined } : item,
        ))
        try {
          saved = await stageUploadAttachment(attachment, (ratio) => {
            setPendingAttachments((current) => current.map((item) =>
              item.id === attachment.id ? { ...item, uploadProgress: ratio } : item,
            ))
          })
          attachment.uploadedFile = saved
          attachment.uploadPromise = Promise.resolve(saved)
          setPendingAttachments((current) => current.map((item) =>
            item.id === attachment.id ? { ...item, uploadStatus: 'done', uploadProgress: 1, uploadedFile: saved, uploadError: undefined } : item,
          ))
        } catch (error) {
          setPendingAttachments((current) => current.map((item) =>
            item.id === attachment.id
              ? { ...item, uploadStatus: 'error', uploadError: error instanceof Error ? error.message : '上传失败' }
              : item,
          ))
        }
      }
      const finalName = sanitizeAttachmentName(attachment.name, attachment.originalName)
      if (!saved) {
        failures.push(`${finalName}：上传失败，请重试`)
        continue
      }
      if (finalName !== saved.name) {
        try {
          await onUpdateFile(saved.id, { name: finalName })
        } catch {
          // 改名失败不阻断保存：文件已在，仅显示名沿用上传时的名字。
        }
      }
      names.push(finalName)
    }
    return { names, failures }
  }

  const addPendingFiles = (fileList: FileList | File[] | null, source: 'picker' | 'paste' = 'picker') => {
    const selectedFiles = Array.from(fileList ?? [])
    if (selectedFiles.length === 0) {
      return
    }
    setUploadErrors([])
    const nextAttachments: PendingProgressAttachment[] = []
    const nextErrors: string[] = []
    selectedFiles.forEach((file) => {
      try {
        validateUploadFile(file)
        const displayName = source === 'paste' ? pastedImageName(file) : file.name
        nextAttachments.push({
          id: crypto.randomUUID(),
          file,
          name: displayName,
          originalName: file.name,
          uploadScope: isAcceptanceMode ? 'acceptance' : 'progress',
        })
      } catch (error) {
        nextErrors.push(error instanceof Error ? error.message : `${file.name}：文件无法添加`)
      }
    })
    if (nextAttachments.length > 0) {
      setPendingAttachments((current) => [...current, ...nextAttachments])
      nextAttachments.forEach((attachment) => {
        if (attachment.uploadScope === 'acceptance') {
          startStagedUpload(attachment)
        }
        if (looksLikeUntidyFileName(attachment.name)) {
          window.setTimeout(() => void requestAttachmentNameSuggestion(attachment.id, attachment), 0)
        }
      })
    }
    if (nextErrors.length > 0) {
      setUploadErrors(nextErrors)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  pasteImageFilesRef.current = (pastedImages) => addPendingFiles(pastedImages, 'paste')

  useEffect(() => {
    const routeModalImagePaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented || !event.clipboardData) return
      const pastedImages = Array.from(event.clipboardData.items)
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file))
      if (pastedImages.length === 0) return
      event.preventDefault()
      event.stopPropagation()
      pasteImageFilesRef.current(pastedImages)
    }
    window.addEventListener('paste', routeModalImagePaste, true)
    return () => window.removeEventListener('paste', routeModalImagePaste, true)
  }, [])

  const replacePendingAttachment = (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file || !replacementAttachmentId) {
      return
    }
    try {
      validateUploadFile(file)
      const previous = pendingAttachments.find((item) => item.id === replacementAttachmentId)
      discardStagedFile(previous?.uploadedFile?.id)
      const replaced: PendingProgressAttachment = {
        id: replacementAttachmentId,
        file,
        name: file.name,
        originalName: file.name,
        uploadScope: previous?.uploadScope ?? (isAcceptanceMode ? 'acceptance' : 'progress'),
      }
      setPendingAttachments((current) => current.map((attachment) =>
        attachment.id === replacementAttachmentId ? replaced : attachment,
      ))
      if (replaced.uploadScope === 'acceptance') {
        startStagedUpload(replaced)
      }
      setUploadErrors([])
    } catch (error) {
      setUploadErrors([error instanceof Error ? error.message : `${file.name}：文件无法替换`])
    } finally {
      setReplacementAttachmentId('')
      if (replacementInputRef.current) {
        replacementInputRef.current.value = ''
      }
    }
  }

  const addReplacementExistingAttachment = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file || !replacementExistingFileId) {
      return
    }
    const existingFile = existingEntryAttachments.find((item) => item.id === replacementExistingFileId)
    if (!existingFile) {
      return
    }
    setUploadingExistingFileId(existingFile.id)
    setUploadErrors([])
    try {
      validateUploadFile(file)
      if (isAcceptanceMode && existingFile.scope === 'acceptance' && onUploadAcceptanceFile) {
        await onUploadAcceptanceFile(task.id, file, undefined, existingFile.entryId || editEntryId)
      } else {
        await onUploadImage(task.id, file, undefined, existingFile.entryId ?? editEntryId)
      }
    } catch (error) {
      setUploadErrors([error instanceof Error ? error.message : `${file.name}：文件无法添加`])
    } finally {
      setUploadingExistingFileId(null)
      setReplacementExistingFileId(null)
      if (existingReplacementInputRef.current) {
        existingReplacementInputRef.current.value = ''
      }
    }
  }

  const requestAttachmentNameSuggestion = async (
    attachmentId: string,
    attachmentSnapshot?: PendingProgressAttachment,
  ) => {
    const attachment = attachmentSnapshot ?? pendingAttachments.find((item) => item.id === attachmentId)
    if (!attachment || attachment.aiLoading) {
      return
    }
    setPendingAttachments((current) => current.map((item) =>
      item.id === attachmentId ? { ...item, aiLoading: true, aiError: undefined, aiSuggestion: undefined } : item,
    ))
    try {
      const suggestion = await api.suggestAttachmentName({
        fileName: sanitizeAttachmentName(attachment.name, attachment.originalName),
        mimeType: attachment.file.type,
        imageBase64: await imageFileBase64(await ensurePendingAttachmentPreview(attachment) ?? attachment.file),
        note,
        recentFileNames: files.filter((file) => file.taskId === task.id).map((file) => file.name).slice(-12),
        task,
      })
      const unchanged = suggestion.unchanged || !suggestion.suggestedName || suggestion.suggestedName === attachment.name
      setPendingAttachments((current) => current.map((item) =>
        item.id === attachmentId ? { ...item, aiLoading: false, aiSuggestion: unchanged ? undefined : suggestion } : item,
      ))
      if (!unchanged) {
        pendingAttachmentAiNameAppliedRef.current[attachmentId] = {
          sourceInput: sanitizeAttachmentName(attachment.name, attachment.originalName),
          aiOutput: suggestion.suggestedName,
          applied: false,
        }
      }
    } catch {
      setPendingAttachments((current) => current.map((item) =>
        item.id === attachmentId
          ? { ...item, aiLoading: false, aiError: 'AI 命名暂时不可用，请稍后重试或手动填写。' }
          : item,
      ))
    }
  }

  const saveExistingAttachmentName = async (file: FileAsset) => {
    const draftName = existingAttachmentDrafts[file.id] ?? file.name
    const nextName = sanitizeAttachmentName(draftName, file.name)
    setExistingAttachmentDrafts((current) => ({ ...current, [file.id]: nextName }))
    const learning = existingAttachmentAiNameAppliedRef.current[file.id]
    if (learning) {
      void api.recordAiLearningEvent({
        context: 'attachment_name',
        sourceInput: learning.sourceInput,
        aiOutput: learning.aiOutput,
        userFinal: nextName,
        action: aiLearningAction(learning, nextName),
        designType: task.type,
        taskId: task.id,
        taskTitle: task.title,
      })
      delete existingAttachmentAiNameAppliedRef.current[file.id]
    }
    if (nextName === file.name) {
      return
    }
    await onUpdateFile(file.id, { name: nextName })
  }

  const saveDirtyExistingAttachmentNames = async () => {
    for (const file of existingEntryAttachments) {
      const draftName = existingAttachmentDrafts[file.id]
      if (draftName && sanitizeAttachmentName(draftName, file.name) !== file.name) {
        await saveExistingAttachmentName(file)
      }
    }
  }

  const isExistingAttachmentAcceptanceFile = (file: FileAsset) => {
    const acceptanceFileNames = new Set((task.acceptanceFiles ?? []).map((name) => name.trim()).filter(Boolean))
    return isAcceptanceFileAsset(file, acceptanceFileNames)
  }

  const toggleExistingAttachmentAcceptanceFile = async (file: FileAsset) => {
    if (updatingExistingAcceptanceFileId === file.id) {
      return
    }
    setUpdatingExistingAcceptanceFileId(file.id)
    try {
      await saveExistingAttachmentName(file)
      const finalName = sanitizeAttachmentName(existingAttachmentDrafts[file.id] ?? file.name, file.name) || file.name
      const currentTags = parseFileTags(file.tag).filter((tag) => tag !== '验收文件' && tag !== '验收附件')
      const isMarked = isExistingAttachmentAcceptanceFile(file)
      if (isMarked) {
        await onUpdateFile(file.id, {
          scope: 'progress',
          tag: serializeFileTags(currentTags),
        })
        onUpdateTask(task.id, {
          acceptanceFiles: (task.acceptanceFiles ?? []).filter((name) => name !== file.name && name !== finalName),
        })
        return
      }
      await onUpdateFile(file.id, {
        scope: 'acceptance',
        tag: serializeFileTags([...currentTags, '验收文件']),
      })
      onUpdateTask(task.id, {
        acceptanceFiles: Array.from(new Set([...(task.acceptanceFiles ?? []), finalName])),
      })
    } finally {
      setUpdatingExistingAcceptanceFileId(null)
    }
  }

  const demoteRollbackAcceptanceAttachments = async () => {
    if (!isRollingBackAcceptanceEntry) {
      return
    }
    const rollbackFiles = existingEntryAttachments.filter((file) => file.scope === 'acceptance')
    if (rollbackFiles.length === 0) {
      return
    }
    await Promise.all(rollbackFiles.map((file) => {
      const nextTags = parseFileTags(file.tag).filter((tag) => tag !== '验收文件')
      return onUpdateFile(file.id, {
        scope: 'progress',
        tag: serializeFileTags(nextTags),
      })
    }))
  }

  const requestExistingAttachmentNameSuggestion = async (file: FileAsset) => {
    const aiState = existingAttachmentAiState[file.id]
    if (aiState?.loading) {
      return
    }
    setExistingAttachmentAiState((current) => ({
      ...current,
      [file.id]: { loading: true },
    }))
    try {
      const fileType = fileTypeForAsset(file).type
      const previewUrl = authedPreviewUrl(file.previewUrl ?? (isInlineImageFileType(fileType) ? file.sourceUrl : undefined))
      const suggestion = await api.suggestAttachmentName({
        fileName: sanitizeAttachmentName(existingAttachmentDrafts[file.id] ?? file.name, file.name),
        mimeType: file.mimeType || file.type,
        imageBase64: await imageUrlBase64(previewUrl),
        note,
        recentFileNames: files.filter((item) => item.taskId === task.id && item.id !== file.id).map((item) => item.name).slice(-12),
        task,
      })
      const currentName = sanitizeAttachmentName(existingAttachmentDrafts[file.id] ?? file.name, file.name)
      const unchanged = suggestion.unchanged || !suggestion.suggestedName || suggestion.suggestedName === currentName
      setExistingAttachmentAiState((current) => ({
        ...current,
        [file.id]: { loading: false, suggestion: unchanged ? undefined : suggestion },
      }))
      if (!unchanged) {
        existingAttachmentAiNameAppliedRef.current[file.id] = {
          sourceInput: currentName,
          aiOutput: suggestion.suggestedName,
          applied: false,
        }
      }
    } catch {
      setExistingAttachmentAiState((current) => ({
        ...current,
        [file.id]: { loading: false, error: 'AI 命名暂时不可用，请稍后重试或手动填写。' },
      }))
    }
  }

  const requestAllAttachmentNameSuggestions = () => {
    existingEntryAttachments.forEach((file) => {
      void requestExistingAttachmentNameSuggestion(file)
    })
    pendingAttachments.forEach((attachment) => {
      void requestAttachmentNameSuggestion(attachment.id)
    })
  }

  const recordAppliedTextLearning = (finalText: string) => {
    const applied = progressAiSuggestionAppliedRef.current
    const userFinal = finalText.trim()
    const aiOutput = applied?.aiOutput.trim() ?? ''
    if (!applied || !aiOutput) {
      return
    }
    void api.recordAiLearningEvent({
      context: applied.context,
      sourceInput: applied.sourceInput,
      aiOutput,
      userFinal,
      action: aiLearningAction(applied, userFinal),
      designType: task.type,
      taskId: task.id,
      taskTitle: task.title,
    })
    progressAiSuggestionAppliedRef.current = null
  }

  const recordAppliedAttachmentNameLearning = () => {
    pendingAttachments.forEach((attachment) => {
      const learning = pendingAttachmentAiNameAppliedRef.current[attachment.id]
      const userFinal = sanitizeAttachmentName(attachment.name, attachment.originalName)
      if (learning) {
        void api.recordAiLearningEvent({
          context: 'attachment_name',
          sourceInput: learning.sourceInput,
          aiOutput: learning.aiOutput,
          userFinal,
          action: aiLearningAction(learning, userFinal),
          designType: task.type,
          taskId: task.id,
          taskTitle: task.title,
        })
      }
      delete pendingAttachmentAiNameAppliedRef.current[attachment.id]
    })
  }

  // 验收态：工时汇总计算（复用现有工具函数）
  const acceptanceTimeEntries = task.timeEntries ?? []
  const acceptanceWaitingEntries = task.waitingEntries ?? []
  const acceptancePreviewEntry = countAcceptanceTime && hasDraftTimeEntry && !draftConflict
    ? buildDraftTimeEntry({ isAcceptanceProgress: true })
    : null
  const acceptancePreviewTimeEntries = isConvertingEntryToAcceptance && acceptancePreviewEntry
    ? acceptanceTimeEntries.map((entry) => entry.id === editEntryId ? acceptancePreviewEntry : entry)
    : shouldIncludeAcceptanceDraftEntry
      ? [...acceptanceTimeEntries, { id: 'acceptance-preview-entry', date: activeStartDate, endDate: activeEndDate, start: activeDraft.start.trim(), end: activeDraft.end.trim(), note: note.trim(), isAcceptanceProgress: true }]
      : acceptanceTimeEntries
  const acceptanceWaitingPreviewTask = acceptancePreviewTimeEntries === acceptanceTimeEntries
    ? task
    : { ...task, timeEntries: acceptancePreviewTimeEntries }
  const acceptanceComputedMinutes = sumTimeEntries(acceptancePreviewTimeEntries)
  const acceptanceLockedHours = Math.round((acceptanceComputedMinutes / 60) * 100) / 100
  const acceptanceBillablePreviewTimeEntries = acceptancePreviewTimeEntries.filter((entry) => minutesForTimeEntry(entry) > 0)
  const acceptanceWaitingMinutes = sumWaitingEntries(acceptanceWaitingPreviewTask)
  const acceptanceEstimatedAmount = roundCents(acceptanceLockedHours * hourlyRate)
  const canConfirmAcceptance = (acceptanceLockedHours > 0 || isAcceptanceRevisionMode || !countAcceptanceTime) && !isSaving && Boolean(onConfirmAcceptance) && !hasAnotherAcceptanceProgress && (!countAcceptanceTime || !draftConflict)
  const progressHeaderHint = isAcceptanceMode
    ? ''
    : isWaitingMode
      ? '记录非工作的等待开始时间，仅用于洞察分析，不计入结算工时'
      : isFeedbackMode
        ? '记录合作伙伴给出的版本反馈、批注意见或聊天截图，默认不计工时但进入生命周期'
      : isEditingEntry
        ? '修改这段记录的内容和时间'
        : `${task.title} · 按时间段计时，工时自动累计并计入结算`
  const toggleFeedbackTag = (tag: TaskFeedbackTag) => {
    setFeedbackTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])
  }

  const saveProgress = async () => {
    if (isSaving) {
      return
    }
    setTimeEntryError('')
    const shouldKeepAcceptanceProgress = isEditingAcceptanceEntry && isAcceptanceMode
    const shouldAllowAcceptedTimeEdit = isEditingAcceptanceEntry && task.status === '已验收'
    const nextEntry = buildDraftTimeEntry({ isAcceptanceProgress: shouldKeepAcceptanceProgress })
    // 0 时长进展不占时间段，跳过重叠校验。
    if (nextEntry && minutesForTimeEntry(nextEntry) > 0) {
      const conflict = comparableEntries.find((entry) => timeEntriesOverlap(nextEntry, entry))
      if (conflict) {
        setTimeEntryError(`这个时间段和 ${formatEntryDateTimeRange(task, conflict)} 已有记录重叠，请改到前后相邻的空档。`)
        return
      }
    }

    setIsSaving(true)
    onClose()
    onNotify(pendingAttachments.some((attachment) => attachment.uploadStatus !== 'done')
      ? '进展已提交，附件将在后台继续上传'
      : '进展已提交，正在后台同步', 'info')

    void (async () => {
      try {
        const persistTaskChanges = async (changes: Parameters<typeof onUpdateTask>[1]) => {
          const saved = await Promise.resolve(onUpdateTask(task.id, changes))
          if (saved === false) {
            throw new Error('任务数据同步失败')
          }
        }

        await saveDirtyExistingAttachmentNames()
        await demoteRollbackAcceptanceAttachments()
        const { names: finalizedUploadedNames, failures: uploadFailures } = await finalizeStagedAttachments()
        if (uploadFailures.length > 0) {
          throw new Error(uploadFailures.join('；'))
        }
        recordAppliedTextLearning(note.trim() || nextEntry?.note?.trim() || '')
        recordAppliedAttachmentNameLearning()
        const planScheduleChanges = buildPlanScheduleChanges()
        const hasPlanScheduleChanges = Object.keys(planScheduleChanges).length > 0
        const shouldStartFromProgress = task.status === '计划中' && !isWaitingMode && !isFeedbackMode && !isEditingEntry
        const nextTimeEntries = !isWaitingMode
          ? isEditingEntry && nextEntry
            ? draftTimeEntries.map((entry) => entry.id === editEntryId ? nextEntry : entry)
            : (() => {
                const newSegs = [...pendingExtraSegments, ...(nextEntry ? [nextEntry] : [])]
                const batchGroupId = newSegs.length > 1 ? crypto.randomUUID() : undefined
                const taggedSegs = batchGroupId ? newSegs.map((s) => ({ ...s, groupId: batchGroupId })) : newSegs
                return [...draftTimeEntries, ...taggedSegs]
              })()
          : draftTimeEntries
        const nextWaitingEntries = isWaitingMode && nextEntry
          ? isEditingEntry ? draftWaitingEntries.map((entry) => entry.id === editEntryId ? nextEntry : entry) : [...draftWaitingEntries, nextEntry]
          : draftWaitingEntries
        if (!isWaitingMode && (timeDirty || nextEntry || pendingExtraSegments.length > 0 || shouldStartFromProgress)) {
          const nextActualHours = Math.round((sumTimeEntries(nextTimeEntries) / 60) * 100) / 100
          await persistTaskChanges({
            ...planScheduleChanges,
            timeEntries: nextTimeEntries,
            actualHours: nextActualHours,
            ...(shouldStartFromProgress ? { startFromProgress: true } : {}),
            ...(shouldAllowAcceptedTimeEdit ? { allowAcceptedTimeEdit: true } : {}),
            ...(isRollingBackAcceptanceEntry ? {
              status: '待验收',
              progress: Math.min(task.progress, 80),
              actualDeliveryDate: '',
              acceptanceNote: '',
              acceptanceFiles: [],
              feedbackRating: '',
              feedbackTags: [],
              feedbackNote: '',
              allowAcceptanceRollback: true,
            } : {}),
          })
        } else if (hasPlanScheduleChanges) {
          await persistTaskChanges(planScheduleChanges)
        }
        if (isWaitingMode && (waitingDirty || nextEntry)) {
          await persistTaskChanges({ waitingEntries: nextWaitingEntries })
        }
        // 单独标记为验收文件的附件：更新 scope/tag，并追加到 task.acceptanceFiles
        const perAcceptanceAttachments = !isAcceptanceMode && !isRollingBackAcceptanceEntry
          ? pendingAttachments.filter((a) => a.isAcceptanceFile && a.uploadedFile)
          : []
        if (perAcceptanceAttachments.length > 0) {
          await Promise.all(perAcceptanceAttachments.map((a) =>
            onUpdateFile(a.uploadedFile!.id, { tag: '验收文件', scope: 'acceptance' }),
          ))
          const perAcceptanceNames = perAcceptanceAttachments.map((a) => sanitizeAttachmentName(a.name, a.originalName))
          await persistTaskChanges({
            acceptanceFiles: Array.from(new Set([...(task.acceptanceFiles ?? []), ...perAcceptanceNames])),
          })
        }
        const body = note.trim() || nextEntry?.note?.trim() || ''
        if (body || finalizedUploadedNames.length > 0) {
          await onCreateTaskUpdate(task.id, {
            title: isRollingBackAcceptanceEntry
              ? '验收进展已撤回'
              : isEditingEntry
                ? (isWaitingMode ? '等待记录已修改' : isFeedbackMode ? '反馈记录已修改' : '进展记录已修改')
                : (isWaitingMode ? '等待记录' : isFeedbackMode ? `${partnerFacingText(feedbackSource)}反馈` : '进展更新'),
            body: body || `上传过程附件：${finalizedUploadedNames.join('、')}`,
            hours: 0,
            visible: false,
          })
        }
        clearProgressDraft(progressDraftStorageKey)
        onNotify(isWaitingMode ? '等待记录已同步' : isFeedbackMode ? '修改建议已同步' : '进展与附件已同步', 'success')
      } catch (error) {
        onNotify(error instanceof Error ? `后台保存进展失败：${error.message}` : '后台保存进展失败，请重新打开任务重试', 'error')
      }
    })()
  }

  // 验收进展：先记录本次进展（工时/附件），再触发验收确认
  const confirmAcceptanceFromProgress = async () => {
    if (isSaving || !onConfirmAcceptance) {
      return
    }
    setTimeEntryError('')
    const nextEntry = isConvertingEntryToAcceptance
      ? buildDraftTimeEntry({ isAcceptanceProgress: true })
      : shouldIncludeAcceptanceDraftEntry ? buildDraftTimeEntry({ isAcceptanceProgress: true }) : null
    if (nextEntry) {
      const conflict = comparableEntries.find((entry) => timeEntriesOverlap(nextEntry, entry))
      if (conflict) {
        setTimeEntryError(`这个时间段和 ${formatEntryDateTimeRange(task, conflict)} 已有记录重叠，请改到前后相邻的空档。`)
        return
      }
    }

    // 验收附件在选择后已开始上传。提交时把剩余工作交给后台，立即释放弹窗。
    setIsSaving(true)
    onClose()
    onNotify(pendingAttachments.some((attachment) => attachment.uploadStatus !== 'done')
      ? '验收已提交，附件将在后台继续上传'
      : '验收已提交，正在后台完成同步', 'info')

    void (async () => {
      try {
        await saveDirtyExistingAttachmentNames()
        const { names: finalizedUploadedNames, failures: uploadFailures } = await finalizeStagedAttachments()
        if (uploadFailures.length > 0) {
          throw new Error(uploadFailures.join('；'))
        }
        recordAppliedTextLearning(note.trim() || nextEntry?.note?.trim() || '')
        recordAppliedAttachmentNameLearning()
        const nextTimeEntries = isConvertingEntryToAcceptance && nextEntry
          ? acceptanceTimeEntries.map((entry) => entry.id === editEntryId ? nextEntry : entry)
          : nextEntry ? [...acceptanceTimeEntries, nextEntry] : acceptanceTimeEntries
        const nextActualHours = nextTimeEntries.length > 0
          ? Math.round((sumTimeEntries(nextTimeEntries) / 60) * 100) / 100
          : task.actualHours
        const planScheduleChanges = buildPlanScheduleChanges()
        const taskForAcceptance = Object.keys(planScheduleChanges).length > 0
          ? { ...task, ...planScheduleChanges }
          : task
        const body = note.trim() || nextEntry?.note?.trim() || ''
        if (body || finalizedUploadedNames.length > 0) {
          await onCreateTaskUpdate(task.id, {
            title: '验收进展',
            body: body || `上传验收附件：${finalizedUploadedNames.join('、')}`,
            hours: 0,
            visible: false,
          })
        }
        await onConfirmAcceptance(taskForAcceptance, {
          actualHours: nextActualHours,
          acceptanceNote: note.trim() || task.acceptanceNote || '',
          feedbackRating,
          feedbackTags: feedbackRating && feedbackRating !== '顺利' ? feedbackTags : [],
          feedbackNote: feedbackNote.trim(),
          timeEntries: nextTimeEntries,
          waitingEntries: acceptanceWaitingEntries,
          acceptanceFiles: Array.from(new Set([...(task.acceptanceFiles ?? []), ...existingEntryAttachments.map((file) => file.name), ...finalizedUploadedNames])),
          taskChanges: planScheduleChanges,
        })
        clearProgressDraft(progressDraftStorageKey)
        onNotify('验收已完成，附件与任务状态均已同步', 'success')
      } catch (error) {
        onNotify(error instanceof Error ? `后台验收失败：${error.message}` : '后台验收失败，请重新打开任务重试', 'error')
      }
    })()
  }

  const requestProgressAiSuggestion = async () => {
    setProgressAiError('')
    setProgressAiSuggestion(null)
    setIsProgressAiLoading(true)
    try {
      const assistantTask = isAcceptanceMode
        ? { ...task, actualHours: acceptanceLockedHours, timeEntries: acceptancePreviewTimeEntries }
        : task
      const suggestion = await api.optimizeTaskTextAssistant({
        mode: isAcceptanceMode ? 'acceptance' : isFeedbackMode ? 'feedback' : 'progress',
        text: note,
        task: assistantTask,
        files: taskAssistantFiles(task, files, uploadedNames),
        activity: taskAssistantActivity(activity),
        uploadedFileNames: uploadedNames,
        progressHistory: isAcceptanceMode ? taskAssistantProgressHistory(assistantTask, files) : undefined,
      })
      setProgressAiSuggestion(suggestion)
      progressAiSuggestionAppliedRef.current = {
        context: isAcceptanceMode ? 'acceptance' : isFeedbackMode ? 'feedback' : 'progress',
        sourceInput: note.trim(),
        aiOutput: suggestion.optimizedText,
        applied: false,
      }
    } catch (error) {
      setProgressAiError(error instanceof Error ? error.message : 'AI 助手暂时不可用')
    } finally {
      setIsProgressAiLoading(false)
    }
  }

  const swapDraftTimes = () => {
    setHasTouchedSchedule(true)
    updateActiveDraft((current) => ({
      ...current,
      date: current.endDate || current.date,
      start: current.end,
      endDate: current.date,
      end: current.start,
    }))
    setActiveDatePickerId(null)
    setTimeEntryError('')
  }

  const progressStartValue = activeDraft.date && normalizeClockInput(activeDraft.start)
    ? `${activeDraft.date}T${normalizeClockInput(activeDraft.start)}`
    : ''
  const progressEndValue = activeDraft.endDate && normalizeClockInput(activeDraft.end)
    ? `${activeDraft.endDate}T${normalizeClockInput(activeDraft.end)}`
    : ''
  const planReferenceStartValue = planReferenceDraft.date && normalizeClockInput(planReferenceDraft.start)
    ? `${planReferenceDraft.date}T${normalizeClockInput(planReferenceDraft.start)}`
    : ''
  const planReferenceEndValue = planReferenceDraft.endDate && normalizeClockInput(planReferenceDraft.end)
    ? `${planReferenceDraft.endDate}T${normalizeClockInput(planReferenceDraft.end)}`
    : ''
  const hasWaitingStart = isWaitingMode && Boolean(progressStartValue)
  const waitingPreviewEntry = hasWaitingStart
    ? {
        id: editEntryId ?? stagedEntryIdRef.current,
        date: datePart(progressStartValue),
        endDate: datePart(progressStartValue),
        start: progressStartValue.slice(11, 16),
        end: progressStartValue.slice(11, 16),
        note: note.trim(),
      } as WaitingEntry
    : null
  const waitingPreviewMinutes = waitingPreviewEntry ? minutesForWaitingEntry(task, waitingPreviewEntry) : 0

  const writePlanReferenceStart = (value: string) => {
    setPlanReferenceDraft((current) => ({
      ...current,
      date: value ? datePart(value) : '',
      start: value ? value.slice(11, 16) : '',
    }))
  }

  const writePlanReferenceEnd = (value: string) => {
    setPlanReferenceDraft((current) => ({
      ...current,
      endDate: value ? datePart(value) : '',
      end: value ? value.slice(11, 16) : '',
    }))
  }

  const updatePlanReferenceStart = (value: string) => {
    writePlanReferenceStart(value)
    if (!value) {
      return
    }
    if (planReferenceDerivedField === 'end') {
      writePlanReferenceEnd(addMinutesToPlanDateTime(value, planReferenceMinutes))
      return
    }
    if (planReferenceEndValue) {
      const nextMinutes = exactDurationMinutesBetween(value, planReferenceEndValue)
      if (nextMinutes > 0) {
        setPlanReferenceMinutes(nextMinutes)
      }
    }
  }

  const updatePlanReferenceEnd = (value: string) => {
    writePlanReferenceEnd(value)
    if (!value) {
      return
    }
    if (planReferenceDerivedField === 'start') {
      writePlanReferenceStart(addMinutesToPlanDateTime(value, -planReferenceMinutes))
      return
    }
    if (planReferenceStartValue) {
      const nextMinutes = exactDurationMinutesBetween(planReferenceStartValue, value)
      if (nextMinutes > 0) {
        setPlanReferenceMinutes(nextMinutes)
      }
    }
  }

  const updatePlanReferenceMinutes = (value: number) => {
    const nextMinutes = Math.max(1, Math.round(Number.isFinite(value) ? value : 0))
    setPlanReferenceMinutes(nextMinutes)
    if (planReferenceDerivedField === 'start' && planReferenceEndValue) {
      writePlanReferenceStart(addMinutesToPlanDateTime(planReferenceEndValue, -nextMinutes))
      return
    }
    if (planReferenceDerivedField === 'end' && planReferenceStartValue) {
      writePlanReferenceEnd(addMinutesToPlanDateTime(planReferenceStartValue, nextMinutes))
      return
    }
    if (planReferenceStartValue) {
      writePlanReferenceEnd(addMinutesToPlanDateTime(planReferenceStartValue, nextMinutes))
      return
    }
    if (planReferenceEndValue) {
      writePlanReferenceStart(addMinutesToPlanDateTime(planReferenceEndValue, -nextMinutes))
    }
  }

  useEffect(() => {
    if (!isPlanReferenceDurationFocused) {
      setPlanReferenceDurationInput(formatEstimatedDurationInputValue(planReferenceMinutes))
    }
  }, [isPlanReferenceDurationFocused, planReferenceMinutes])

  const updatePlanReferenceDurationInput = (value: string) => {
    setPlanReferenceDurationInput(value.slice(0, 32))
    const nextMinutes = parseEstimatedDurationInputMinutes(value)
    if (nextMinutes) {
      updatePlanReferenceMinutes(nextMinutes)
    }
  }

  const commitPlanReferenceDurationInput = () => {
    const nextMinutes = parseEstimatedDurationInputMinutes(planReferenceDurationInput)
    if (nextMinutes) {
      updatePlanReferenceMinutes(nextMinutes)
    }
    setPlanReferenceDurationInput(formatEstimatedDurationInputValue(nextMinutes || planReferenceMinutes))
    setIsPlanReferenceDurationFocused(false)
  }

  const applyPlanReferenceDerivedField = (field: ScheduleAnchor) => {
    const currentReferenceMinutes = exactDurationMinutesBetween(planReferenceStartValue, planReferenceEndValue)
    if (field === 'start' && planReferenceEndValue) {
      writePlanReferenceStart(addMinutesToPlanDateTime(planReferenceEndValue, -planReferenceMinutes))
    } else if (field === 'start' && planReferenceStartValue) {
      writePlanReferenceEnd(addMinutesToPlanDateTime(planReferenceStartValue, planReferenceMinutes))
    } else if (field === 'end' && planReferenceStartValue) {
      writePlanReferenceEnd(addMinutesToPlanDateTime(planReferenceStartValue, planReferenceMinutes))
    } else if (field === 'end' && planReferenceEndValue) {
      writePlanReferenceStart(addMinutesToPlanDateTime(planReferenceEndValue, -planReferenceMinutes))
    } else if (field === 'hours' && currentReferenceMinutes > 0) {
      setPlanReferenceMinutes(currentReferenceMinutes)
    }
  }

  const togglePlanReferenceScheduleField = (field: ScheduleAnchor) => {
    const nextField = planReferenceDerivedField !== field ? field : field === 'start' ? 'end' : 'start'
    setPlanReferenceDerivedField(nextField)
    applyPlanReferenceDerivedField(nextField)
    setActiveDatePickerId(null)
  }

  const buildPlanScheduleChanges = (): TaskUpdateChanges => {
    if (!isAcceptanceMode || isWaitingMode) {
      return {}
    }
    const changes: TaskUpdateChanges = {}
    const nextEstimatedHours = planReferenceMinutes / 60
    if (planReferenceStartValue && planReferenceStartValue !== toDateTimeInputValue(task.date || '')) {
      changes.date = planReferenceStartValue
    }
    if (planReferenceEndValue && planReferenceEndValue !== toDateTimeInputValue(task.estimatedDate || '')) {
      changes.estimatedDate = planReferenceEndValue
    }
    if (Number.isFinite(nextEstimatedHours) && nextEstimatedHours > 0 && Math.round(nextEstimatedHours * 1000) / 1000 !== Math.round((task.estimatedHours || 0) * 1000) / 1000) {
      changes.estimatedHours = nextEstimatedHours
    }
    return changes
  }

  useEffect(() => {
    if (lockSchedule || segmentMinutes <= 0) {
      return
    }
    const startVal = normalizeClockInput(activeDraft.start)
    const endVal = normalizeClockInput(activeDraft.end)
    if (!endVal && startVal && activeDraft.date) {
      const computed = addMinutesToPlanDateTime(`${activeDraft.date}T${startVal}`, segmentMinutes)
      updateActiveDraft((current) => {
        const currentStart = normalizeClockInput(current.start)
        const currentEnd = normalizeClockInput(current.end)
        if (currentEnd || currentStart !== startVal || current.date !== activeDraft.date) {
          return current
        }
        return { ...current, start: startVal, endDate: computed.slice(0, 10), end: computed.slice(11, 16) }
      })
      return
    }
    if (!startVal && endVal && (activeDraft.endDate || activeDraft.date)) {
      const computed = addMinutesToPlanDateTime(`${activeDraft.endDate || activeDraft.date}T${endVal}`, -segmentMinutes)
      updateActiveDraft((current) => {
        const currentStart = normalizeClockInput(current.start)
        const currentEnd = normalizeClockInput(current.end)
        if (currentStart || currentEnd !== endVal || (current.endDate || current.date) !== (activeDraft.endDate || activeDraft.date)) {
          return current
        }
        return { ...current, date: computed.slice(0, 10), start: computed.slice(11, 16), endDate: current.endDate || current.date, end: endVal }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDraft.date, activeDraft.end, activeDraft.endDate, activeDraft.start, lockSchedule, segmentMinutes])

  const writeProgressStart = (value: string) => {
    updateActiveDraft((current) => ({
      ...current,
      date: value ? datePart(value) : '',
      start: value ? value.slice(11, 16) : '',
    }))
  }

  const writeProgressEnd = (value: string) => {
    updateActiveDraft((current) => ({
      ...current,
      endDate: value ? datePart(value) : '',
      end: value ? value.slice(11, 16) : '',
    }))
  }

  const updateProgressStart = (value: string) => {
    setHasTouchedSchedule(true)
    writeProgressStart(value)
    if (!value) {
      return
    }
    if (scheduleDerivedField === 'hours' && progressEndValue) {
      const nextMinutes = exactDurationMinutesBetween(value, progressEndValue)
      if (nextMinutes > 0) {
        setSegmentMinutes(nextMinutes)
      }
      return
    }
    if (scheduleDerivedField === 'end') {
      writeProgressEnd(addMinutesToPlanDateTime(value, segmentMinutes))
    }
  }

  const updateProgressEnd = (value: string) => {
    setHasTouchedSchedule(true)
    writeProgressEnd(value)
    if (!value) {
      return
    }
    if (scheduleDerivedField === 'hours' && progressStartValue) {
      const nextMinutes = exactDurationMinutesBetween(progressStartValue, value)
      if (nextMinutes > 0) {
        setSegmentMinutes(nextMinutes)
      }
      return
    }
    if (scheduleDerivedField === 'start') {
      writeProgressStart(addMinutesToPlanDateTime(value, -segmentMinutes))
    }
  }

  const updateProgressMinutes = (value: number) => {
    setHasTouchedSchedule(true)
    const nextMinutes = Math.max(1, Math.round(Number.isFinite(value) ? value : segmentMinutes))
    setSegmentMinutes(nextMinutes)
    if (scheduleDerivedField === 'start' && progressEndValue) {
      writeProgressStart(addMinutesToPlanDateTime(progressEndValue, -nextMinutes))
      return
    }
    if (scheduleDerivedField === 'start' && progressStartValue) {
      writeProgressEnd(addMinutesToPlanDateTime(progressStartValue, nextMinutes))
      return
    }
    if (scheduleDerivedField === 'end' && progressStartValue) {
      writeProgressEnd(addMinutesToPlanDateTime(progressStartValue, nextMinutes))
      return
    }
    if (scheduleDerivedField === 'end' && progressEndValue) {
      writeProgressStart(addMinutesToPlanDateTime(progressEndValue, -nextMinutes))
    }
  }

  useEffect(() => {
    if (!isSegmentDurationFocused) {
      setSegmentDurationInput(formatEstimatedDurationInputValue(segmentMinutes))
    }
  }, [isSegmentDurationFocused, segmentMinutes])

  const updateSegmentDurationInput = (value: string) => {
    setSegmentDurationInput(value.slice(0, 32))
    const nextMinutes = parseEstimatedDurationInputMinutes(value)
    if (nextMinutes) {
      updateProgressMinutes(nextMinutes)
    }
  }

  const commitSegmentDurationInput = () => {
    const nextMinutes = parseEstimatedDurationInputMinutes(segmentDurationInput)
    if (nextMinutes) {
      updateProgressMinutes(nextMinutes)
    }
    setSegmentDurationInput(formatEstimatedDurationInputValue(nextMinutes || segmentMinutes))
    setIsSegmentDurationFocused(false)
  }

  const applyVoiceProgressSchedule = (result: VoiceScheduleResult) => {
    setHasTouchedSchedule(true)
    if (result.startAt && result.durationMinutes && result.endAt) {
      setSegmentMinutes(result.durationMinutes)
      updateActiveDraft((current) => ({
        ...current,
        date: datePart(result.startAt || current.date),
        start: result.startAt?.slice(11, 16) || current.start,
        endDate: datePart(result.endAt || current.endDate || current.date),
        end: result.endAt?.slice(11, 16) || current.end,
      }))
      if (result.derivedField) setScheduleDerivedField(result.derivedField)
    } else {
      if (result.suppliedFields.includes('start') && result.startAt) updateProgressStart(result.startAt)
      if (result.suppliedFields.includes('hours') && result.durationMinutes) updateProgressMinutes(result.durationMinutes)
      if (result.suppliedFields.includes('end') && result.endAt) updateProgressEnd(result.endAt)
    }
    setActiveDatePickerId(null)
    setTimeEntryError('')
  }

  const applyVoicePlanReferenceSchedule = (result: VoiceScheduleResult) => {
    if (result.startAt && result.durationMinutes && result.endAt) {
      setPlanReferenceMinutes(result.durationMinutes)
      setPlanReferenceDraft((current) => ({
        ...current,
        date: datePart(result.startAt || current.date),
        start: result.startAt?.slice(11, 16) || current.start,
        endDate: datePart(result.endAt || current.endDate || current.date),
        end: result.endAt?.slice(11, 16) || current.end,
      }))
      if (result.derivedField) setPlanReferenceDerivedField(result.derivedField)
    } else {
      if (result.suppliedFields.includes('start') && result.startAt) updatePlanReferenceStart(result.startAt)
      if (result.suppliedFields.includes('hours') && result.durationMinutes) updatePlanReferenceMinutes(result.durationMinutes)
      if (result.suppliedFields.includes('end') && result.endAt) updatePlanReferenceEnd(result.endAt)
    }
    setActiveDatePickerId(null)
    setTimeEntryError('')
  }

  const applyVoiceSingleProgressTime = (result: VoiceScheduleResult) => {
    const value = result.startAt || result.endAt
    if (!value) return
    setHasTouchedSchedule(true)
    writeProgressStart(value)
    writeProgressEnd(value)
    setActiveDatePickerId(null)
    setTimeEntryError('')
  }

  const applyProgressDerivedField = (field: ScheduleAnchor) => {
    if (field === 'start' && progressEndValue) {
      writeProgressStart(addMinutesToPlanDateTime(progressEndValue, -segmentMinutes))
    } else if (field === 'start' && progressStartValue) {
      writeProgressEnd(addMinutesToPlanDateTime(progressStartValue, segmentMinutes))
    } else if (field === 'end' && progressStartValue) {
      writeProgressEnd(addMinutesToPlanDateTime(progressStartValue, segmentMinutes))
    } else if (field === 'end' && progressEndValue) {
      writeProgressStart(addMinutesToPlanDateTime(progressEndValue, -segmentMinutes))
    } else if (field === 'hours' && draftEntryMinutes > 0) {
      setSegmentMinutes(draftEntryMinutes)
    }
  }

  const toggleProgressScheduleField = (field: ScheduleAnchor) => {
    setHasTouchedSchedule(true)
    const nextField = scheduleDerivedField !== field ? field : field === 'start' ? 'end' : 'start'
    setScheduleDerivedField(nextField)
    applyProgressDerivedField(nextField)
    setTimeEntryError('')
  }

  const syncPlanReferenceToProgress = () => {
    const referenceMinutes = exactDurationMinutesBetween(planReferenceStartValue, planReferenceEndValue)
    if (!planReferenceStartValue || !planReferenceEndValue || referenceMinutes <= 0) {
      setTimeEntryError('预计结束时间需晚于预计开始时间，才能同步到实际工时')
      return
    }
    setHasTouchedSchedule(true)
    setScheduleDerivedField(planReferenceDerivedField)
    setSegmentMinutes(referenceMinutes)
    updateActiveDraft((current) => ({
      ...current,
      date: datePart(planReferenceStartValue),
      start: planReferenceStartValue.slice(11, 16),
      endDate: datePart(planReferenceEndValue),
      end: planReferenceEndValue.slice(11, 16),
    }))
    setActiveDatePickerId(null)
    setTimeEntryError('')
  }

  const sortSegmentsByTime = (segs: TimeEntry[]) =>
    [...segs].sort((a, b) => {
      const ta = `${a.date}T${a.start}`
      const tb = `${b.date}T${b.start}`
      return tb.localeCompare(ta) // 降序：最新的排最上
    })

  // 将当前输入段暂存，并用「上段结束时间 + 1h」预填下一段
  const stashCurrentSegment = () => {
    const entry = buildDraftTimeEntry()
    if (!entry || minutesForTimeEntry(entry) <= 0) return
    const stashedEntry = { ...entry, id: crypto.randomUUID() }
    setPendingExtraSegments((current) => sortSegmentsByTime([...current, stashedEntry]))
    const prevEnd = activeDraft.end
    const prevEndDate = activeDraft.endDate || activeDraft.date
    const nextStartFull = `${prevEndDate || activeDraft.date}T${prevEnd}`
    const nextEndFull = addMinutesToPlanDateTime(nextStartFull, DURATION_STEP_MINUTES * 2) // 默认 1h
    updateActiveDraft((current) => ({
      ...current,
      date: prevEndDate || current.date,
      endDate: nextEndFull.slice(0, 10),
      start: prevEnd,
      end: nextEndFull.slice(11, 16),
    }))
    setScheduleDerivedField('hours') // 工时派生，start/end 均可见
    setSegmentMinutes(DURATION_STEP_MINUTES * 2)
    setTimeEntryError('')
  }

  // 将一个暂存段装回当前输入框进行编辑；若当前草稿有效则先暂存它
  const editStashedSegment = (seg: TimeEntry) => {
    const currentEntry = buildDraftTimeEntry()
    const currentValid = currentEntry && minutesForTimeEntry(currentEntry) > 0
    setPendingExtraSegments((current) => {
      const withoutTarget = current.filter((s) => s.id !== seg.id)
      if (currentValid) {
        return sortSegmentsByTime([...withoutTarget, { ...currentEntry, id: crypto.randomUUID() }])
      }
      return withoutTarget
    })
    // 将该段的时间填入当前草稿
    updateActiveDraft((current) => ({
      ...current,
      date: seg.date ?? current.date,
      endDate: seg.endDate ?? seg.date ?? current.endDate,
      start: seg.start,
      end: seg.end,
    }))
    setScheduleDerivedField('hours')
    setSegmentMinutes(minutesForTimeEntry(seg))
    setTimeEntryError('')
  }

  const totalPendingMinutes = pendingExtraSegments.reduce((sum, entry) => sum + minutesForTimeEntry(entry), 0)

  const waitingTimeFields = (
    <section className="progress-lite-time-formula">
      <div className="progress-lite-time-heading">
        <div>
          <span>等待开始时间</span>
          <small>截止时间取同一任务下一段工作进展的开始时间</small>
        </div>
        <VoiceScheduleButton
          context="等待记录的开始时间"
          currentStart={progressStartValue}
          onApply={applyVoiceSingleProgressTime}
        />
      </div>
      <div className="progress-schedule-wrap">
        <div className="new-task-schedule-row progress-lite-schedule-row">
          <PlanDateTimeField
            label="开始时间"
            value={progressStartValue}
            onChange={(value) => {
              setHasTouchedSchedule(true)
              writeProgressStart(value)
              if (value) {
                writeProgressEnd(value)
              }
              setTimeEntryError('')
            }}
            isActive
            readOnly={false}
            pickerId="waiting-start"
            activePickerId={activeDatePickerId}
            onActivePickerChange={setActiveDatePickerId}
          />
          <div className="field progress-lite-hours-field">
            <span className="new-task-inline-label">自动截止</span>
            <output className="new-task-hours-input new-task-hours-output" aria-label="等待截止规则">
              {waitingPreviewEntry && waitingPreviewMinutes > 0 ? formatDuration(waitingPreviewMinutes) : '下一段工作进展'}
            </output>
          </div>
        </div>
      </div>
      <p className={`progress-lite-duration ${hasWaitingStart ? '' : 'invalid'}`} role="status">
        {hasWaitingStart
          ? waitingPreviewMinutes > 0
            ? `当前会按下一段工作进展自动计算为等待 ${formatDuration(waitingPreviewMinutes)}`
            : '保存后显示为等待中；下一次记录工作进展分段计时时自动截止'
          : '请选择等待开始时间'}
      </p>
    </section>
  )

  const feedbackTimeFields = (
    <section className="progress-lite-time-formula progress-feedback-time-formula">
      <div className="progress-lite-time-heading">
        <div>
          <span>反馈时间</span>
          <small>只用于生命周期追溯，不计入结算工时</small>
        </div>
        <VoiceScheduleButton
          context="合作伙伴反馈发生时间"
          currentStart={progressStartValue}
          onApply={applyVoiceSingleProgressTime}
        />
      </div>
      <div className="progress-schedule-wrap">
        <div className="new-task-schedule-row progress-lite-schedule-row">
          <PlanDateTimeField
            label="反馈时间"
            value={progressStartValue}
            onChange={(value) => {
              setHasTouchedSchedule(true)
              writeProgressStart(value)
              if (value) {
                writeProgressEnd(value)
              }
              setTimeEntryError('')
            }}
            isActive
            readOnly={false}
            pickerId="feedback-time"
            activePickerId={activeDatePickerId}
            onActivePickerChange={setActiveDatePickerId}
          />
          <div className="field progress-lite-hours-field">
            <span className="new-task-inline-label">计时口径</span>
            <output className="new-task-hours-input new-task-hours-output" aria-label="反馈计时口径">
              0 min
            </output>
          </div>
        </div>
      </div>
      <p className="progress-lite-duration" role="status">保存后显示为一条「合作伙伴反馈」节点，可附截图 / 批注文件追溯。</p>
    </section>
  )

  const timeFields = (
    <section className="progress-lite-time-formula">
      <div className="progress-lite-time-heading">
        <div>
          <span>时间与工时</span>
          <small>{timeCounts ? '三项同时只激活两项，第三项自动推算（灰色）' : isAcceptanceMode ? '本次验收不计入工时' : '本次不计工时，仅记录进展'}</small>
        </div>
        <div className="progress-lite-time-heading-actions">
          <VoiceScheduleButton
            context={isAcceptanceMode ? '验收进展的实际时间与工时' : '工作进展的实际时间与工时'}
            currentStart={progressStartValue}
            currentDurationMinutes={segmentMinutes}
            currentEnd={progressEndValue}
            onApply={applyVoiceProgressSchedule}
            disabled={lockSchedule}
          />
          {isAcceptanceMode && !isWaitingMode && (
            <button
              type="button"
              className="progress-lite-time-sync"
              onClick={syncPlanReferenceToProgress}
              disabled={!planReferenceStartValue || !planReferenceEndValue || planReferenceMinutes <= 0}
              title="把右侧预计时间与工时同步到左侧实际"
            >
              <ArrowRightLeft size={13} />
              <span>同步预计</span>
            </button>
          )}
          {isAcceptanceMode && (
            <button
              type="button"
              className={`switch-control progress-lite-time-toggle ${countAcceptanceTime ? 'active' : ''}`}
              aria-pressed={countAcceptanceTime}
              aria-label={countAcceptanceTime ? '本次计入工时，点击关闭则本次不计入' : '本次不计入工时，点击开启则计入'}
              title={countAcceptanceTime ? '本次计入工时，点击关闭则本次不计入' : '本次不计入工时，点击开启则计入'}
              onClick={() => setCountAcceptanceTime((value) => !value)}
            >
              <i />
              <span>{countAcceptanceTime ? '计入工时' : '不计入工时'}</span>
            </button>
          )}
          {!isAcceptanceMode && !isWaitingMode && (
            <button
              type="button"
              className={`switch-control progress-lite-time-toggle ${countProgressTime ? 'active' : ''}`}
              aria-pressed={countProgressTime}
              aria-label={countProgressTime ? '本次计入工时，点击关闭则本次不计入' : '本次不计入工时，点击开启则计入'}
              title={countProgressTime ? '本次计入工时，点击关闭则本次不计入' : '本次不计入工时，点击开启则计入'}
              onClick={() => setCountProgressTime((value) => !value)}
            >
              <i />
              <span>{countProgressTime ? '计入工时' : '不计工时'}</span>
            </button>
          )}
          <button
            type="button"
            className="progress-lite-time-swap"
            aria-label="交换开始时间和结束时间"
            title="交换开始时间和结束时间"
            onClick={swapDraftTimes}
            disabled={lockSchedule || !activeDraft.start.trim() || !activeDraft.end.trim()}
          >
            <ArrowRightLeft size={15} />
          </button>
        </div>
      </div>
      <div className={`progress-schedule-wrap${isAcceptanceMode && !isWaitingMode ? ' progress-schedule-two-col' : ''}`}>
        <div className={`new-task-schedule-row progress-lite-schedule-row ${lockSchedule ? 'is-uncounted' : ''}`} aria-disabled={lockSchedule}>
          <PlanDateTimeField
            label="开始时间"
            value={progressStartValue}
            onChange={updateProgressStart}
            isActive={scheduleDerivedField !== 'start'}
            readOnly={scheduleDerivedField === 'start'}
            control={<ScheduleAnchorSwitch active={scheduleDerivedField !== 'start'} label="切换开始时间" onClick={() => toggleProgressScheduleField('start')} />}
            pickerId="progress-start"
            activePickerId={activeDatePickerId}
            onActivePickerChange={setActiveDatePickerId}
          />
          <div className="field progress-lite-hours-field">
            <span className="new-task-inline-label">
              <ScheduleAnchorSwitch active={scheduleDerivedField !== 'hours'} label="切换本段工时" onClick={() => toggleProgressScheduleField('hours')} />
              本段工时
            </span>
            <div className="new-task-hours-row progress-lite-hours-row">
              {scheduleDerivedField === 'hours' ? (
                <output className="new-task-hours-input new-task-hours-output" aria-label="本段工时">
                  {isAcceptanceMode ? formatDurationZh(segmentMinutes) : formatDuration(segmentMinutes)}
                </output>
              ) : (
                <input
                  className="new-task-hours-input"
                  type="text"
                  inputMode="text"
                  value={segmentDurationInput}
                  placeholder="如 15分钟"
                  onFocus={(event) => {
                    setIsSegmentDurationFocused(true)
                    event.currentTarget.select()
                  }}
                  onChange={(event) => updateSegmentDurationInput(event.target.value)}
                  onBlur={commitSegmentDurationInput}
                  aria-label="本段工时，可输入15分钟、1小时30分钟或小数小时"
                />
              )}
            </div>
          </div>
          <PlanDateTimeField
            label="结束时间"
            value={progressEndValue}
            onChange={updateProgressEnd}
            isActive={scheduleDerivedField !== 'end'}
            readOnly={scheduleDerivedField === 'end'}
            control={<ScheduleAnchorSwitch active={scheduleDerivedField !== 'end'} label="切换结束时间" onClick={() => toggleProgressScheduleField('end')} />}
            pickerId="progress-end"
            activePickerId={activeDatePickerId}
            onActivePickerChange={setActiveDatePickerId}
          />
        </div>
        {isAcceptanceMode && !isWaitingMode && (
          <div className="new-task-schedule-row progress-lite-schedule-row progress-lite-schedule-row-plan">
            <div className="progress-lite-plan-head">
              <span>预计时间与工时</span>
              <VoiceScheduleButton
                label="用语音填写预计时间与工时"
                context="验收时调整任务预计时间与工时"
                currentStart={planReferenceStartValue}
                currentDurationMinutes={planReferenceMinutes}
                currentEnd={planReferenceEndValue}
                onApply={applyVoicePlanReferenceSchedule}
              />
            </div>
            <PlanDateTimeField
              label="开始时间"
              value={planReferenceStartValue}
              onChange={updatePlanReferenceStart}
              isActive
              readOnly={false}
              control={<ScheduleAnchorSwitch active={planReferenceDerivedField !== 'start'} label="切换预计开始时间" onClick={() => togglePlanReferenceScheduleField('start')} />}
              pickerId="plan-start"
              activePickerId={activeDatePickerId}
              onActivePickerChange={setActiveDatePickerId}
            />
            <div className="field progress-lite-hours-field">
              <span className="new-task-inline-label">
                <ScheduleAnchorSwitch active={planReferenceDerivedField !== 'hours'} label="切换预计工时" onClick={() => togglePlanReferenceScheduleField('hours')} />
                预计工时
              </span>
              <div className="new-task-hours-row progress-lite-hours-row">
                {planReferenceDerivedField === 'hours' ? (
                  <output className="new-task-hours-input new-task-hours-output" aria-label="预计工时">
                    {formatDurationZh(planReferenceMinutes)}
                  </output>
                ) : (
                  <>
                    <input
                      className="new-task-hours-input"
                      type="text"
                      inputMode="text"
                      value={planReferenceDurationInput}
                      placeholder="如 15分钟"
                      onFocus={(event) => {
                        setIsPlanReferenceDurationFocused(true)
                        event.currentTarget.select()
                      }}
                      onChange={(event) => updatePlanReferenceDurationInput(event.target.value)}
                      onBlur={commitPlanReferenceDurationInput}
                      aria-label="验收预计工时，可输入15分钟、1小时30分钟或小数小时"
                    />
                  </>
                )}
              </div>
            </div>
            <PlanDateTimeField
              label="结束时间"
              value={planReferenceEndValue}
              onChange={updatePlanReferenceEnd}
              isActive
              readOnly={false}
              control={<ScheduleAnchorSwitch active={planReferenceDerivedField !== 'end'} label="切换预计结束时间" onClick={() => togglePlanReferenceScheduleField('end')} />}
              pickerId="plan-end"
              activePickerId={activeDatePickerId}
              onActivePickerChange={setActiveDatePickerId}
            />
          </div>
        )}
      </div>
      {/* 多段工时列表：已暂存段 + 当前正在填写的段（合并排序显示） */}
      {pendingExtraSegments.length > 0 && (() => {
        const currentDraftSeg = hasDraftTimeEntry ? {
          id: '__current__',
          date: activeStartDate,
          endDate: activeEndDate,
          start: activeDraft.start,
          end: activeDraft.end,
          isCurrent: true,
        } : null
        const allSegs = sortSegmentsByTime([
          ...pendingExtraSegments.map((s) => ({ ...s, isCurrent: false as const })),
          ...(currentDraftSeg ? [currentDraftSeg] : []),
        ])
        const totalMinutes = totalPendingMinutes + (hasDraftTimeEntry ? draftEntryMinutes : 0)
        return (
          <ul className="progress-extra-segments">
            {allSegs.map((seg, i) => {
              const isCurrent = (seg as { isCurrent?: boolean }).isCurrent
              return (
                <li key={seg.id} className={`progress-extra-segment-row ${isCurrent ? 'is-current' : ''}`}>
                  <span className="progress-extra-segment-label">第 {i + 1} 段</span>
                  <span className="progress-extra-segment-time">
                    {seg.start} – {seg.end}
                  </span>
                  <span className="progress-extra-segment-duration">
                    {formatDuration(minutesForTimeEntry(seg))}
                  </span>
                  {isCurrent
                    ? <>
                        <span className="progress-extra-segment-editing">编辑中</span>
                        <button
                          type="button"
                          className="progress-extra-segment-remove"
                          aria-label="取消这一段"
                          title="取消这一段"
                          onClick={() => {
                            updateActiveDraft((d) => ({ ...d, start: '', end: '' }))
                            setSegmentMinutes(DURATION_STEP_MINUTES * 2)
                            setTimeEntryError('')
                          }}
                        >
                          <X size={12} />
                        </button>
                      </>
                    : (
                      <>
                        <button type="button" className="progress-extra-segment-edit" aria-label="编辑此段" title="编辑此段"
                          onClick={() => editStashedSegment(seg as TimeEntry)}>
                          <Pencil size={11} />
                        </button>
                        <button type="button" className="progress-extra-segment-remove" aria-label="移除此段"
                          onClick={() => setPendingExtraSegments((current) => current.filter((s) => s.id !== seg.id))}>
                          <X size={12} />
                        </button>
                      </>
                    )
                  }
                </li>
              )
            })}
            <li className="progress-extra-segment-total">
              合计 {formatDuration(totalMinutes)}
            </li>
          </ul>
        )
      })()}
      <p className={`progress-lite-duration ${!timeCounts || hasDraftTimeEntry ? '' : 'invalid'}`} role="status">
        {!timeCounts
          ? isAcceptanceMode
            ? '本次验收不计入工时，已汇总工时保留不变，可直接保存 / 验收'
            : '本次计 0 工时，仅记录进展（填写备注或上传附件即可保存）'
          : hasDraftTimeEntry
            ? isAcceptanceMode && !hasTouchedSchedule
              ? '如本次没有新增工时，可直接验收；调整时间后才会计入本次工时与结算'
              : pendingExtraSegments.length > 0
                ? ''
                : `${isWaitingMode ? '等待' : '本段计时'} ${formatDuration(draftEntryMinutes)}${isWaitingMode ? '' : '，保存后自动累计到实际工时与结算'}`
            : pendingExtraSegments.length > 0 ? '填写下一段的结束时间，或直接保存已暂存的时间段' : '结束时间需晚于开始时间'}
      </p>
      {!isWaitingMode && !isAcceptanceMode && !isEditingEntry && timeCounts && (
        <button
          type="button"
          className="progress-add-segment-btn"
          disabled={!hasDraftTimeEntry || Boolean(draftConflict)}
          onClick={stashCurrentSegment}
        >
          <Plus size={12} />
          再加一段
        </button>
      )}
      {(timeEntryError || draftConflict) && (
        <p className="progress-lite-entry-error" role="alert">
          <span>{timeEntryError || (draftConflict ? `这个时间段和 ${formatEntryDateTimeRange(task, draftConflict)} 已有记录重叠，请改到前后相邻的空档。` : '')}</span>
          {suggestedTimeSlot && (
            <button type="button" onClick={applySuggestedTimeSlot}>
              <Sparkles size={13} />
              切换到 {formatPlanDateTime(suggestedTimeSlot.start)}
            </button>
          )}
        </p>
      )}
    </section>
  )

  return (
    <ModalShell className="task-action-modal task-progress-modal progress-lite-modal" labelledBy="task-progress-title" onClose={onClose}>
      <header className="progress-lite-header">
        <div>
          <h2 id="task-progress-title">{isWaitingMode ? '记录等待' : isFeedbackMode ? (isEditingEntry ? '编辑反馈' : '记录反馈') : isAcceptanceRevisionMode ? '编辑验收进展' : isAcceptanceMode ? '记录验收进展' : '记录进展'}</h2>
          {progressHeaderHint && <small>{progressHeaderHint}</small>}
        </div>
        <button className="icon-button modal-close-button" aria-label="关闭" title="关闭" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className={`progress-lite-body ${isWaitingMode ? 'waiting-mode' : ''} ${isFeedbackMode ? 'feedback-mode' : ''} ${isAcceptanceMode ? 'acceptance-mode' : ''}`}>
        {isWaitingMode ? (
          <>
            {waitingTimeFields}
            <section className="progress-lite-field">
              <label className="progress-lite-label" htmlFor="progress-lite-waiting-note">备注</label>
              <textarea
                id="progress-lite-waiting-note"
                className="task-progress-note progress-lite-note"
                value={note}
                onChange={(event) => {
                  const value = event.target.value
                  setNote(value)
                  if (!isAcceptanceMode) {
                    updateActiveDraft((current) => ({ ...current, note: value }))
                  }
                }}
                placeholder="填写等待原因或补充说明"
              />
            </section>
          </>
        ) : (
          <>
            {canToggleAcceptanceMode && (
              <div
                className={`progress-acceptance-toggle ${isAcceptanceMode ? 'active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={toggleAcceptanceMode}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    toggleAcceptanceMode()
                  }
                }}
              >
                <span className={`switch-control ${isAcceptanceMode ? 'active' : ''}`}><i /></span>
                <span className="progress-acceptance-toggle-label">本次进展为验收进展</span>
                <em>
                  {isAcceptanceRevisionMode
                    ? '关闭后保存会撤回验收闭环'
                    : isAcceptanceMode ? '提交后完成验收闭环' : '打开后记录验收收尾'}
                </em>
              </div>
            )}
            {!isFeedbackMode && (
              <section className="progress-acceptance-base" ref={acceptanceBaseRef}>
                <button
                  type="button"
                  className="progress-acceptance-base-toggle"
                  aria-expanded={isAcceptanceBaseExpanded}
                  onClick={() => setIsAcceptanceBaseExpanded((current) => !current)}
                >
                  <span>基础信息</span>
                  <em>{isAcceptanceBaseExpanded ? '收起' : '展开'} <ChevronDown size={13} /></em>
                </button>
                {isAcceptanceBaseExpanded && (
                  <div className="progress-acceptance-basic-grid">
                    <div className="wide"><span>任务名称</span><strong>{task.title}</strong></div>
                    <div><span>设计类型</span><strong>{task.type || '未分类'}</strong></div>
                    <div><span>结算所属月份</span><strong>{monthLabelOf(taskSettlementMonth(task))}（{isSupplementalTask(task) ? '补录' : '非补录'}）</strong></div>
                    <div><span>对接人</span><strong>{task.contact || '待确认'}</strong></div>
                    <div><span>需求人</span><strong>{task.requester || '待确认'}</strong></div>
                    <div><span>验收人</span><strong>{task.reviewer || task.requester || '待确认'}</strong></div>
                    <div><span>预计开始</span><strong>{formatPlanDateTime(task.date)}</strong></div>
                    <div><span>预计交付</span><strong>{formatPlanDateTime(task.estimatedDate || task.date)}</strong></div>
                    <div><span>预估工时</span><strong>{formatDurationZh(Math.max(0, Math.round(task.estimatedHours * 60)))}</strong></div>
                    <div><span>实际工时</span><strong>{formatDurationZh(Math.max(0, Math.round(task.actualHours * 60)))}</strong></div>
                    <div><span>实际交付</span><strong>{task.actualDeliveryDate ? formatPlanDateTime(task.actualDeliveryDate) : '待验收确认'}</strong></div>
                    <div className="wide"><span>需求描述</span><strong>{task.requirement || '未填写'}</strong></div>
                  </div>
                )}
              </section>
            )}
            {isAcceptanceMode && timeFields}
            {isFeedbackMode && (
              <>
                <section className="progress-lite-field progress-feedback-meta">
                  <label>
                    <span>反馈版本</span>
                    <input
                      value={feedbackVersion}
                      onChange={(event) => setFeedbackVersion(event.target.value)}
                      placeholder="例如：B01 / B02 / B03"
                    />
                  </label>
                  <label className="progress-feedback-source">
                    <span>反馈来源</span>
                    <input
                      value={feedbackSource}
                      onChange={(event) => setFeedbackSource(event.target.value)}
                      placeholder="例如：合作伙伴 / 需求人 / 项目负责人"
                      maxLength={80}
                    />
                  </label>
                </section>
                {feedbackTimeFields}
              </>
            )}
            <section className="progress-lite-field">
              <div className="progress-lite-label-row">
                <label htmlFor="progress-lite-note">{isAcceptanceMode ? '验收备注' : isFeedbackMode ? '修改意见' : '进展内容'}</label>
                <span className="progress-lite-label-actions">
                  {isAcceptanceMode && (
                    <button
                      type="button"
                      className="text-button progress-reference-button"
                      onClick={showAcceptanceTaskReference}
                      title="查看任务详情，用于参考填写验收备注"
                    >
                      参考任务详情
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-button ai-assist-button"
                    aria-label={isAcceptanceMode ? 'AI 汇总项目验收备注' : isFeedbackMode ? 'AI 整理修改意见' : 'AI 优化进展内容'}
                    title={isAcceptanceMode ? `AI 汇总项目验收备注（参考 ${projectProgressHistory.length} 段历史进展）` : isFeedbackMode ? 'AI 整理修改意见' : 'AI 优化进展内容'}
                    onClick={() => void requestProgressAiSuggestion()}
                    disabled={isProgressAiLoading || (!note.trim() && uploadedNames.length === 0 && taskAssistantFiles(task, files).length === 0 && (!isAcceptanceMode || projectProgressHistory.length === 0))}
                  >
                    <Sparkles size={16} />
                  </button>
                </span>
              </div>
              <textarea
                id="progress-lite-note"
                className="task-progress-note progress-lite-note"
                value={note}
                onChange={(event) => {
                  const value = event.target.value
                  setNote(value)
                  if (!isAcceptanceMode) {
                    updateActiveDraft((current) => ({ ...current, note: value }))
                  }
                }}
                placeholder={isAcceptanceMode ? '可补充本次收尾重点；AI 会结合全部历史进展，汇总项目更新、修改与最终交付。' : isFeedbackMode ? '例如：B01 反馈：标题需要更突出，主视觉换成更正式的蓝色，补充数据安全痛点。' : '例如：按合作伙伴反馈调整封面配色，导出终稿'}
              />
              {(progressAiSuggestion || progressAiError || isProgressAiLoading) && (
                <div className="ai-suggestion-panel task-text-ai-panel">
                  <div className="ai-suggestion-head">
                    <span>{isProgressAiLoading ? (isAcceptanceMode ? 'AI 正在整理验收备注' : 'AI 正在整理进展') : isAcceptanceMode ? 'AI 验收建议' : 'AI 建议'}</span>
                    {!isProgressAiLoading && (progressAiSuggestion || progressAiError) && (
                      <button type="button" className="ai-suggestion-dismiss" aria-label="关闭建议" title="关闭建议" onClick={() => { setProgressAiSuggestion(null); setProgressAiError('') }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {isProgressAiLoading && <p>{isAcceptanceMode ? `正在汇总任务需求、${projectProgressHistory.length} 段历史进展、验收文件和当前备注...` : isFeedbackMode ? '正在结合任务需求和附件整理修改意见...' : '正在结合当前输入、任务附件和最近进展优化文案...'}</p>}
                  {progressAiError && <p className="ai-suggestion-error">{progressAiError}</p>}
                  {progressAiSuggestion && (
                    <>
                      <div className="ai-suggestion-body">
                        {renderTextAssistantBody(progressAiSuggestion.optimizedText)}
                      </div>
                      {progressAiSuggestion.summary && <small>{progressAiSuggestion.summary}</small>}
                      <div className="ai-suggestion-actions">
                        <button
                          type="button"
                          className="ghost-button compact-button"
                          onClick={() => {
                            const currentLearning = progressAiSuggestionAppliedRef.current
                            progressAiSuggestionAppliedRef.current = {
                              context: isAcceptanceMode ? 'acceptance' : isFeedbackMode ? 'feedback' : 'progress',
                              sourceInput: currentLearning?.sourceInput ?? note.trim(),
                              aiOutput: progressAiSuggestion.optimizedText,
                              applied: true,
                            }
                            setNote(progressAiSuggestion.optimizedText)
                            if (!isAcceptanceMode) {
                              updateActiveDraft((current) => ({ ...current, note: progressAiSuggestion.optimizedText }))
                            }
                          }}
                        >
                          采用建议
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>
            {!isAcceptanceMode && !isFeedbackMode && (
              <div
                className={`progress-acceptance-toggle progress-revision-toggle ${isRevisionRound ? 'active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setIsRevisionRound((current) => !current)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setIsRevisionRound((current) => !current)
                  }
                }}
              >
                <span className={`switch-control ${isRevisionRound ? 'active' : ''}`}><i /></span>
                <span className="progress-acceptance-toggle-label">本次为改稿轮次</span>
                <em>{isRevisionRound ? '计入需求人画像（不影响计时与结算）' : '仅分阶段提交，不算改稿'}</em>
              </div>
            )}
            {isFeedbackMode && (
              <div
                className={`progress-acceptance-toggle progress-revision-toggle ${isRevisionRound ? 'active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setIsRevisionRound((current) => !current)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setIsRevisionRound((current) => !current)
                  }
                }}
              >
                <span className={`switch-control ${isRevisionRound ? 'active' : ''}`}><i /></span>
                <span className="progress-acceptance-toggle-label">计入改稿轮次</span>
                <em>{isRevisionRound ? '这条反馈会进入需求人画像 / 改稿统计' : '仅作为反馈记录，不计入改稿轮次'}</em>
              </div>
            )}
            {!isAcceptanceMode && !isFeedbackMode && timeFields}
            <section
              className={`progress-lite-field progress-attachment-field ${isDraggingFiles ? 'is-dragover' : ''}`}
              onPaste={(event) => {
                const pastedImages = Array.from(event.clipboardData.items)
                  .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
                  .map((item) => item.getAsFile())
                  .filter((file): file is File => Boolean(file))
                if (pastedImages.length > 0) {
                  event.preventDefault()
                  addPendingFiles(pastedImages, 'paste')
                }
              }}
              onDragEnter={(event) => {
                if (Array.from(event.dataTransfer.types).includes('Files')) {
                  event.preventDefault()
                  dragDepthRef.current += 1
                  setIsDraggingFiles(true)
                }
              }}
              onDragOver={(event) => {
                if (Array.from(event.dataTransfer.types).includes('Files')) {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'copy'
                }
              }}
              onDragLeave={() => {
                dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
                if (dragDepthRef.current === 0) {
                  setIsDraggingFiles(false)
                }
              }}
              onDrop={(event) => {
                const droppedFiles = Array.from(event.dataTransfer.files)
                dragDepthRef.current = 0
                setIsDraggingFiles(false)
                if (droppedFiles.length > 0) {
                  event.preventDefault()
                  addPendingFiles(droppedFiles, 'picker')
                }
              }}
            >
              <div className="progress-lite-label-row">
                <span className="progress-lite-label">{isAcceptanceMode ? '验收附件' : '附件（选填）'}</span>
                {(existingEntryAttachments.length > 0 || pendingAttachments.length > 0) && (
                  <button
                    type="button"
                    className="attachment-ai-all"
                    onClick={requestAllAttachmentNameSuggestions}
                    disabled={
                      pendingAttachments.every((attachment) => attachment.aiLoading)
                      && existingEntryAttachments.every((file) => existingAttachmentAiState[file.id]?.loading)
                    }
                  >
                    <Sparkles size={13} />
                    AI 命名
                  </button>
                )}
              </div>
              {existingEntryAttachments.length > 0 && (
                <div className="progress-existing-attachments">
                  <small>已有附件</small>
                  <div className="progress-attachment-list progress-existing-attachment-list" aria-label="已有附件列表">
                    {existingEntryAttachments.map((file) => {
                      const fileType = fileTypeForAsset(file).type
                      const previewUrl = authedPreviewUrl(file.previewUrl ?? (isInlineImageFileType(fileType) ? file.sourceUrl : undefined))
                      const documentSourceUrl = fileThumbnailSource(file)
                      const draftName = existingAttachmentDrafts[file.id] ?? file.name
                      const aiState = existingAttachmentAiState[file.id] ?? {}
                      const isAcceptanceFile = isExistingAttachmentAcceptanceFile(file)
                      const isAcceptanceFileUpdating = updatingExistingAcceptanceFileId === file.id
                      return (
                        <article className="progress-attachment-draft progress-existing-attachment" key={file.id}>
                          <AttachmentHoverThumbnail
                            name={file.name}
                            type={fileType}
                            previewUrl={previewUrl}
                            previewFallback={Boolean(file.previewFallback)}
                            sourceUrl={documentSourceUrl}
                            onOpen={() => onPreviewFile(file)}
                          />
                          <div className="progress-attachment-main">
                            <div className="progress-attachment-name-field full-name">
                              <textarea
                                rows={2}
                                aria-label={`重命名已有附件 ${file.name}`}
                                title={draftName}
                                value={draftName}
                                onChange={(event) => {
                                  const value = event.target.value
                                  setExistingAttachmentDrafts((current) => ({ ...current, [file.id]: value }))
                                  setExistingAttachmentAiState((current) => ({
                                    ...current,
                                    [file.id]: { ...current[file.id], suggestion: undefined, error: undefined },
                                  }))
                                }}
                                onBlur={() => void saveExistingAttachmentName(file)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.currentTarget.blur()
                                  }
                                }}
                              />
                            </div>
                            <small title={file.name}>完整名称：{file.name}</small>
                            {!isAcceptanceMode && !isFeedbackMode && (
                              <button
                                type="button"
                                className={`attachment-acceptance-toggle ${isAcceptanceFile ? 'active' : ''}`}
                                aria-label={isAcceptanceFile ? '取消标记为验收文件' : '标记为验收文件'}
                                title={isAcceptanceFile ? '取消标记为验收文件' : '标记为验收文件'}
                                disabled={isAcceptanceFileUpdating}
                                onClick={() => void toggleExistingAttachmentAcceptanceFile(file)}
                              >
                                <Star size={12} fill={isAcceptanceFile ? 'currentColor' : 'none'} />
                                {isAcceptanceFile ? '验收文件' : '标为验收文件'}
                              </button>
                            )}
                            {aiState.loading && <small>视觉模型正在识别文件内容并整理名称...</small>}
                            {aiState.error && <small className="attachment-ai-error">{aiState.error}</small>}
                            {aiState.suggestion && (
                              <div className="attachment-ai-suggestion">
                                <span>建议：{aiState.suggestion.suggestedName}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextName = sanitizeAttachmentName(aiState.suggestion?.suggestedName ?? draftName, file.name)
                                    if (nextName) {
                                      const learning = existingAttachmentAiNameAppliedRef.current[file.id]
                                      existingAttachmentAiNameAppliedRef.current[file.id] = {
                                        sourceInput: learning?.sourceInput ?? sanitizeAttachmentName(existingAttachmentDrafts[file.id] ?? file.name, file.name),
                                        aiOutput: nextName,
                                        applied: true,
                                      }
                                    }
                                    setExistingAttachmentDrafts((current) => ({ ...current, [file.id]: nextName }))
                                    setExistingAttachmentAiState((current) => ({
                                      ...current,
                                      [file.id]: { loading: false },
                                    }))
                                    void onUpdateFile(file.id, { name: nextName })
                                  }}
                                >
                                  采用
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="progress-attachment-actions">
                            <button
                              type="button"
                              aria-label="AI 建议文件名"
                              title="AI 建议文件名"
                              onClick={() => void requestExistingAttachmentNameSuggestion(file)}
                              disabled={aiState.loading}
                            >
                              <Sparkles size={14} />
                            </button>
                            <button
                              type="button"
                              aria-label="重新添加附件"
                              title="重新添加附件"
                              disabled={uploadingExistingFileId === file.id}
                              onClick={() => {
                                setReplacementExistingFileId(file.id)
                                existingReplacementInputRef.current?.click()
                              }}
                            >
                              <RotateCcw size={14} />
                            </button>
                            <button
                              type="button"
                              aria-label="删除已有附件"
                              title="删除已有附件"
                              className="danger"
                              onClick={() => onDeleteFile(file.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              )}
              {pendingAttachments.length > 0 && (
                <div className="progress-pending-attachments">
                  {existingEntryAttachments.length > 0 && <small>本次新增</small>}
                  <div className="progress-attachment-desktop-grid" aria-label="新增附件列表">
                    {pendingAttachments.map((attachment) => (
                      <article className="progress-attachment-desktop-item" key={attachment.id}>
                        <PendingAttachmentThumbnail
                          attachment={attachment}
                          onOpen={() => setPreviewAttachment(attachment)}
                          ensurePreview={ensurePendingAttachmentPreview}
                        />
                        <div className="progress-attachment-name-field">
                          <textarea
                            rows={2}
                            aria-label={`重命名 ${attachment.originalName}，扩展名不可修改`}
                            value={splitFileName(attachment.name).base}
                            onChange={(event) => {
                              const base = event.target.value
                              const extension = splitFileName(attachment.originalName).extension
                              setPendingAttachments((current) => current.map((item) =>
                                item.id === attachment.id
                                  ? { ...item, name: `${base}${extension}`, aiSuggestion: undefined, aiError: undefined }
                                  : item,
                              ))
                            }}
                            onBlur={() => {
                              setPendingAttachments((current) => current.map((item) =>
                                item.id === attachment.id
                                  ? { ...item, name: sanitizeAttachmentName(item.name, item.originalName) }
                                  : item,
                              ))
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                event.currentTarget.blur()
                              }
                            }}
                          />
                          <span title="文件扩展名由系统保护，不可修改">
                            {splitFileName(attachment.originalName).extension}
                          </span>
                        </div>
                        {attachment.uploadStatus === 'uploading' && (
                          <div className="attachment-upload-bar" role="progressbar" aria-label="上传进度" title="上传中">
                            <span style={{ width: `${Math.max(6, Math.round((attachment.uploadProgress ?? 0) * 100))}%` }} />
                          </div>
                        )}
                        {attachment.uploadStatus === 'done' && (
                          <small className="attachment-upload-done">已上传，保存即用</small>
                        )}
                        {attachment.uploadStatus === 'error' && (
                          <small className="attachment-ai-error">上传失败：{attachment.uploadError ?? '请重试'}（保存时会自动重试）</small>
                        )}
                        {attachment.aiLoading && <small>视觉模型正在识别文件内容并整理名称...</small>}
                        {attachment.aiError && <small className="attachment-ai-error">{attachment.aiError}</small>}
                        {attachment.aiSuggestion && (
                          <div className="attachment-ai-suggestion">
                            <span>建议：{attachment.aiSuggestion.suggestedName}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const nextName = sanitizeAttachmentName(attachment.aiSuggestion?.suggestedName ?? attachment.name, attachment.originalName)
                                if (nextName) {
                                  const learning = pendingAttachmentAiNameAppliedRef.current[attachment.id]
                                  pendingAttachmentAiNameAppliedRef.current[attachment.id] = {
                                    sourceInput: learning?.sourceInput ?? sanitizeAttachmentName(attachment.name, attachment.originalName),
                                    aiOutput: nextName,
                                    applied: true,
                                  }
                                }
                                setPendingAttachments((current) => current.map((item) =>
                                  item.id === attachment.id
                                    ? {
                                        ...item,
                                        name: nextName || sanitizeAttachmentName(item.name, item.originalName),
                                        aiSuggestion: undefined,
                                      }
                                    : item,
                                ))
                              }}
                            >
                              采用
                            </button>
                          </div>
                        )}
                        {!isAcceptanceMode && !isFeedbackMode && (
                          <button
                            type="button"
                            className={`attachment-acceptance-toggle ${attachment.isAcceptanceFile ? 'active' : ''}`}
                            aria-label={attachment.isAcceptanceFile ? '取消标记为验收文件' : '标记为验收文件'}
                            title={attachment.isAcceptanceFile ? '取消标记为验收文件' : '标记为验收文件'}
                            onClick={() => setPendingAttachments((current) => current.map((item) =>
                              item.id === attachment.id ? { ...item, isAcceptanceFile: !item.isAcceptanceFile } : item,
                            ))}
                          >
                            <Star size={12} fill={attachment.isAcceptanceFile ? 'currentColor' : 'none'} />
                            {attachment.isAcceptanceFile ? '验收文件' : '标为验收文件'}
                          </button>
                        )}
                        <div className="progress-attachment-actions">
                          <button
                            type="button"
                            aria-label="AI 建议文件名"
                            title="AI 建议文件名"
                            onClick={() => void requestAttachmentNameSuggestion(attachment.id)}
                            disabled={attachment.aiLoading}
                          >
                            <Sparkles size={14} />
                          </button>
                          <button
                            type="button"
                            aria-label="重新上传"
                            title="重新上传"
                            onClick={() => {
                              setReplacementAttachmentId(attachment.id)
                              replacementInputRef.current?.click()
                            }}
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            type="button"
                            aria-label="删除附件"
                            title="删除附件"
                            className="danger"
                            onClick={() => {
                              discardStagedAttachment(attachment)
                              setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id))
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
              {uploadErrors.length > 0 && (
                <div className="upload-error-list" role="alert">
                  {uploadErrors.map((message) => <span key={message}>{message}</span>)}
                </div>
              )}
              <button type="button" className="progress-lite-upload-box" onClick={() => fileInputRef.current?.click()} disabled={isSaving}>
                <Plus size={15} />
                {isAcceptanceMode ? '添加验收截图 / 最终稿' : '添加过程截图 / 文件'}
                <small>单文件最大 200MB，大文件自动分片上传；也可以 Ctrl+V 粘贴图片</small>
              </button>
              <input
                ref={fileInputRef}
                className="task-row-upload-input"
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.psd,.ai,.eps,.fig,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.mp4,.mov,.webm,.m4v,.ogv"
                onChange={(event) => addPendingFiles(event.target.files)}
              />
              <input
                ref={replacementInputRef}
                className="task-row-upload-input"
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.psd,.ai,.eps,.fig,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.mp4,.mov,.webm,.m4v,.ogv"
                onChange={(event) => replacePendingAttachment(event.target.files)}
              />
              <input
                ref={existingReplacementInputRef}
                className="task-row-upload-input"
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.psd,.ai,.eps,.fig,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.mp4,.mov,.webm,.m4v,.ogv"
                onChange={(event) => void addReplacementExistingAttachment(event.target.files)}
              />
            </section>
            {isAcceptanceMode && (
              <div className="progress-acceptance-sections">
                <section className="progress-acceptance-block">
                  <h3 className="progress-acceptance-block-title">整体进度</h3>
                  <div className="progress-acceptance-progress">
                    <div className="acceptance-progress-track" aria-label={`当前进度 ${task.progress}%`}>
                      <span style={{ width: `${task.progress}%` }} />
                    </div>
                    <strong>{task.progress}%</strong>
                  </div>
                  <p className="progress-acceptance-hint">{isAcceptanceRevisionMode ? '保存后继续保持已验收状态，进度为 100%。' : '确认验收后，进度将自动设为 100%。'}</p>
                </section>
                <section className="progress-acceptance-block">
                  <h3 className="progress-acceptance-block-title">计时与工时汇总</h3>
                  {acceptanceBillablePreviewTimeEntries.length === 0 ? (
                    <p className="progress-acceptance-hint">还没有分段计时。</p>
                  ) : (
                    <div className="progress-acceptance-time-table-wrap">
                      <table className="progress-acceptance-time-table">
                        <thead><tr><th>日期</th><th>时间段</th><th>工时</th></tr></thead>
                        <tbody>
                          {acceptanceBillablePreviewTimeEntries.map((entry) => (
                            <tr key={entry.id}>
                              <td>{formatMonthDay(entry.date || datePart(task.date))}</td>
                              <td>{entry.start}–{entry.end}</td>
                              <td>{(minutesForTimeEntry(entry) / 60).toFixed(1)}h</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot><tr><td colSpan={2}>实际总工时 · 计入结算</td><td>{acceptanceLockedHours.toFixed(1)}h</td></tr></tfoot>
                      </table>
                    </div>
                  )}
                  <div className="progress-acceptance-money">
                    <div><span>结算时薪</span><strong>¥{hourlyRate.toLocaleString()} / 小时</strong></div>
                    <div><span>预计结算金额</span><strong>¥{formatYuan(acceptanceEstimatedAmount)}</strong></div>
                  </div>
                  {acceptanceWaitingEntries.length > 0 && (
                    <div className="progress-acceptance-waiting">
                      <h4>等待记录 · 不计入结算</h4>
                      {acceptanceWaitingEntries.map((entry) => {
                        const minutes = minutesForWaitingEntry(acceptanceWaitingPreviewTask, entry)
                        return (
                          <div className="progress-acceptance-waiting-row" key={entry.id}>
                            <span>{formatWaitingEntryDateTimeRange(acceptanceWaitingPreviewTask, entry)}</span>
                            <em>{minutes > 0 ? `${(minutes / 60).toFixed(1)}h` : '等待中'}</em>
                          </div>
                        )
                      })}
                      <div className="progress-acceptance-waiting-total"><strong>累计等待</strong><em>{(acceptanceWaitingMinutes / 60).toFixed(1)}h</em></div>
                    </div>
                  )}
                </section>
                <section className="progress-acceptance-block">
                  <h3 className="progress-acceptance-block-title">任务体感反馈 · 用于后续 BI / AI 分析</h3>
                  <div className="progress-acceptance-feedback">
                    <div className="task-feedback-options" role="group" aria-label="任务体感">
                      {taskFeedbackRatings.map((rating) => (
                        <button
                          type="button"
                          className={feedbackRating === rating ? 'active' : ''}
                          key={rating}
                          aria-pressed={feedbackRating === rating}
                          onClick={() => {
                            setFeedbackRating((current) => current === rating ? '' : rating)
                            if (rating === '顺利') { setFeedbackTags([]) }
                          }}
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                    {feedbackRating && feedbackRating !== '顺利' && (
                      <div className="task-feedback-tags" aria-label="体感原因标签">
                        {taskFeedbackTags.map((tag) => (
                          <button
                            type="button"
                            className={feedbackTags.includes(tag) ? 'active' : ''}
                            key={tag}
                            aria-pressed={feedbackTags.includes(tag)}
                            onClick={() => toggleFeedbackTag(tag)}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                    <label className="acceptance-feedback-note">
                      <span>体感评价</span>
                      <textarea value={feedbackNote} onChange={(event) => setFeedbackNote(event.target.value)} placeholder="例如：需求清晰，但等待合作伙伴确认主色耗时较长。" />
                    </label>
                  </div>
                </section>
                <div className="progress-acceptance-confirm-summary">确认后状态变更为「已验收」，进度设为 100%，当前验收备注和附件会写入任务闭环。</div>
              </div>
            )}
          </>
        )}
      </div>
      <footer className="modal-footer">
        <button className="ghost-button" onClick={onClose}>取消</button>
        {isAcceptanceMode && onConfirmAcceptance && (!isEditingEntry || isConvertingEntryToAcceptance) ? (
          <button
            data-modal-save="true"
            className="primary-button"
            disabled={!canConfirmAcceptance}
            onClick={() => void confirmAcceptanceFromProgress()}
          >
            {isSaving ? '保存中…' : isAcceptanceRevisionMode ? '保存修改' : '确认验收通过'}
          </button>
        ) : (
          <button data-modal-save="true" className="primary-button" disabled={isSaving || Boolean(draftConflict) || (isWaitingMode ? !hasWaitingStart : (!hasDraftTimeEntry && !canSaveZeroTimeProgress && pendingExtraSegments.length === 0))} onClick={() => void saveProgress()}>
            {isSaving ? '保存中…' : isEditingEntry ? '保存修改' : isWaitingMode ? '记录等待' : isFeedbackMode ? '记录反馈' : '记录进展'}
          </button>
        )}
      </footer>
      {previewAttachment && <PendingAttachmentPreview attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />}
    </ModalShell>
  )
}
