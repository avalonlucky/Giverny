import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Plus, Sparkles, X } from 'lucide-react'
import { defaultDesignTypes, type DesignTypeGroup } from '../config/appConfig'
import { api, type HourEstimateSuggestion, type TaskAssistantSuggestion, type VoiceScheduleResult } from '../lib/api'
import { aiLearningAction, type AiLearningDraft } from '../lib/aiLearning'
import { createOptionalPreviewFile, createTextPreviewFile } from '../lib/attachmentPreview'
import { extractAttachmentText } from '../lib/attachmentText'
import { datePart, isoDate, isoDateTime, localDateFromIsoDate, monthPart, pad } from '../lib/dateTime'
import { flattenDesignTypeGroups, normalizeDesignTypeGroups } from '../lib/designTypeGroups'
import {
  exactDurationMinutesBetween,
  formatEstimatedDurationInputValue,
  normalizeEstimatedMinutes,
  parseEstimatedDurationInputMinutes,
  withDatePart,
  type ScheduleAnchor,
} from '../lib/durationInput'
import { splitFileName } from '../lib/fileName'
import { pastedImageName } from '../lib/fileUpload'
import { isEditableShortcutTarget } from '../lib/keyboardShortcuts'
import { monthLabelOf } from '../lib/month'
import { newTaskDraftFromTask, readNewTaskDraftCache, writeNewTaskDraftCache } from '../lib/newTaskDraftCache'
import { taskAssistantRequirementWithoutOutputFiles } from '../lib/taskAssistantContext'
import { addMinutesToPlanDateTime } from '../lib/timeEntryDraft'
import type { Task, TaskStatus } from '../types/domain'
import { ImageLightbox } from './CommandPalette'
import { ModalShell } from './ModalShell'
import { NewTaskDesignTypeSelector } from './NewTaskDesignTypeSelector'
import { PlanDateTimeField } from './PlanDateTimeField'
import { ScheduleAnchorSwitch, VoiceScheduleButton } from './VoiceScheduleButton'

type HourEstimateFeedbackRating = 'too_low' | 'accurate' | 'too_high'

const hourEstimateFeedbackOptions: Array<{ value: HourEstimateFeedbackRating; label: string }> = [
  { value: 'too_low', label: '偏低' },
  { value: 'accurate', label: '合适' },
  { value: 'too_high', label: '偏高' },
]

const hourEstimateFeedbackReasons = ['交付数量', '尺寸适配', '内容整理', '专项处理', '沟通改稿', '参考样本']

function supplementalMonthSelectOptions(currentValue = monthPart(isoDate())) {
  const anchor = localDateFromIsoDate(`${currentValue}-01`)
  return Array.from({ length: 4 }, (_, index) => {
    const date = new Date(anchor)
    date.setMonth(anchor.getMonth() - index)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
  })
}

export function NewTaskModal({
  designTypeGroups,
  currentMonthValue,
  initialSupplemental = false,
  editingTask,
  onClose,
  onCreate,
  onSave,
  onDesignTypeGroupsChange,
}: {
  designTypeGroups: DesignTypeGroup[]
  currentMonthValue: string
  initialSupplemental?: boolean
  editingTask?: Task
  onClose: () => void
  onCreate: (task: Task) => void
  onSave?: (changes: Partial<Task>) => void
  onDesignTypeGroupsChange: (nextGroups: DesignTypeGroup[]) => void | Promise<void>
}) {
  const availableDesignTypeGroups = normalizeDesignTypeGroups(designTypeGroups)
  const fallbackType = flattenDesignTypeGroups(availableDesignTypeGroups)[0] ?? defaultDesignTypes[0]
  const defaultStartDateTime = useMemo(() => isoDateTime(), [])
  const isEditing = Boolean(editingTask)
  const initialDraft = useMemo(
    () => editingTask
      ? newTaskDraftFromTask(editingTask, fallbackType, currentMonthValue)
      : readNewTaskDraftCache(defaultStartDateTime, fallbackType, currentMonthValue),
    [currentMonthValue, defaultStartDateTime, editingTask, fallbackType],
  )
  const [title, setTitle] = useState(initialDraft.title)
  const [requirement, setRequirement] = useState(initialDraft.requirement)
  const [type, setType] = useState(initialDraft.type)
  const [startDate, setStartDate] = useState(initialDraft.startDate)
  const [estimatedMinutes, setEstimatedMinutes] = useState(initialDraft.estimatedMinutes)
  const [estimatedHoursInput, setEstimatedHoursInput] = useState(() => formatEstimatedDurationInputValue(initialDraft.estimatedMinutes))
  const [estimatedDate, setEstimatedDate] = useState(initialDraft.estimatedDate)
  const [scheduleDerivedField, setScheduleDerivedField] = useState<ScheduleAnchor>(initialDraft.scheduleAnchor)
  const [isSupplemental, setIsSupplemental] = useState(initialSupplemental || initialDraft.isSupplemental)
  // 不计费任务（免费协助）：从创建起即不计费，不计入计费工时与收入，但仍出现在结算报表
  const [isFree, setIsFree] = useState(editingTask?.billable === false || editingTask?.status === '不计费')
  const [settlementMonth, setSettlementMonth] = useState(initialDraft.settlementMonth)
  const [requester, setRequester] = useState(initialDraft.requester)
  const [contact, setContact] = useState(initialDraft.contact)
  const [reviewer, setReviewer] = useState(initialDraft.reviewer)
  const [reviewerEdited, setReviewerEdited] = useState(
    Boolean(editingTask?.reviewer && editingTask.reviewer !== (editingTask.requester || editingTask.contact)),
  )
  const [supplementalNote, setSupplementalNote] = useState(initialDraft.supplementalNote)
  const [aiSuggestion, setAiSuggestion] = useState<TaskAssistantSuggestion | null>(null)
  const [aiError, setAiError] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)
  // 记录 AI 生成的建议文本（用于提交时对比用户最终输入，保存差异供学习）
  const aiSuggestionAppliedRef = useRef<AiLearningDraft | null>(null)
  const aiTitleSuggestionAppliedRef = useRef<AiLearningDraft | null>(null)
  // 甲方文案附件：仅用于 AI 需求分析（前端就地抽取文字或图片 base64），不随任务持久化
  type BriefItem = {
    id: string
    name: string
    text: string
    chars: number
    isImage?: boolean
    base64?: string
    mimeType?: string
    previewUrl?: string
    previewLabel?: string
  }
  const [briefFiles, setBriefFiles] = useState<BriefItem[]>([])
  const [briefError, setBriefError] = useState('')
  const [isBriefLoading, setIsBriefLoading] = useState(false)
  const [isBriefDragOver, setIsBriefDragOver] = useState(false)
  const [briefLightboxSrc, setBriefLightboxSrc] = useState<string | null>(null)
  const briefInputRef = useRef<HTMLInputElement | null>(null)
  const briefFilesRef = useRef<BriefItem[]>([])
  const briefDragDepthRef = useRef(0)
  const [hourSuggestion, setHourSuggestion] = useState<HourEstimateSuggestion | null>(null)
  const [hourSuggestionInputSignature, setHourSuggestionInputSignature] = useState('')
  const [hourSuggestionError, setHourSuggestionError] = useState('')
  const [isHourSuggestionLoading, setIsHourSuggestionLoading] = useState(false)
  const [hourSuggestionFeedback, setHourSuggestionFeedback] = useState<HourEstimateFeedbackRating | null>(null)
  const [hourSuggestionFeedbackReasons, setHourSuggestionFeedbackReasons] = useState<string[]>([])
  const [hourSampleFeedback, setHourSampleFeedback] = useState<Record<number, boolean>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [activeDatePickerId, setActiveDatePickerId] = useState<string | null>(null)
  const supplementalMonthOptions = useMemo(() => supplementalMonthSelectOptions(monthPart(isoDate())), [])
  const currentHourSuggestionSignature = useMemo(() => JSON.stringify({
    title: title.trim(),
    requirement: requirement.trim(),
    type: type.trim(),
    requester: requester.trim(),
    attachments: briefFiles.map((file) => ({ name: file.name, chars: file.chars, text: file.text.slice(0, 1000) })),
  }), [briefFiles, requester, requirement, title, type])
  const hourSuggestionIsStale = Boolean(hourSuggestion && hourSuggestionInputSignature !== currentHourSuggestionSignature)

  const revokeBriefPreview = useCallback((item: BriefItem) => {
    if (item.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(item.previewUrl)
    }
  }, [])

  const removeBriefFile = (id: string) => {
    setBriefFiles((prev) => {
      const removed = prev.find((item) => item.id === id)
      if (removed) {
        revokeBriefPreview(removed)
      }
      return prev.filter((item) => item.id !== id)
    })
  }

  useEffect(() => {
    briefFilesRef.current = briefFiles
  }, [briefFiles])

  useEffect(() => () => {
    briefFilesRef.current.forEach(revokeBriefPreview)
  }, [revokeBriefPreview])

  useEffect(() => {
    if (isEditing) {
      return
    }
    writeNewTaskDraftCache({
      title,
      requirement,
      type,
      startDate,
      estimatedMinutes,
      estimatedDate,
      scheduleAnchor: scheduleDerivedField,
      isSupplemental,
      settlementMonth,
      requester,
      contact,
      reviewer,
      supplementalNote,
    })
  }, [contact, estimatedDate, estimatedMinutes, isEditing, isSupplemental, requirement, requester, reviewer, scheduleDerivedField, settlementMonth, startDate, supplementalNote, title, type])

  const toggleScheduleField = (field: ScheduleAnchor) => {
    setScheduleDerivedField((current) => {
      if (current !== field) {
        return field
      }
      return field === 'start' ? 'end' : 'start'
    })
  }

  const updateStartDate = (value: string) => {
    const previousStartDate = datePart(startDate)
    const nextStartDate = datePart(value)
    const dateChanged = Boolean(value && previousStartDate && nextStartDate && previousStartDate !== nextStartDate)
    setStartDate(value)
    if (dateChanged && estimatedDate) {
      setEstimatedDate(withDatePart(estimatedDate, nextStartDate))
      return
    }
    if (scheduleDerivedField === 'hours') {
      const nextMinutes = exactDurationMinutesBetween(value, estimatedDate)
      if (nextMinutes > 0) {
        setEstimatedMinutes(nextMinutes)
        setEstimatedHoursInput(formatEstimatedDurationInputValue(nextMinutes))
      }
      return
    }
    setEstimatedDate(addMinutesToPlanDateTime(value, estimatedMinutes))
  }

  const updateEstimatedDate = (value: string) => {
    const previousEstimatedDate = datePart(estimatedDate)
    const nextEstimatedDate = datePart(value)
    const dateChanged = Boolean(value && previousEstimatedDate && nextEstimatedDate && previousEstimatedDate !== nextEstimatedDate)
    setEstimatedDate(value)
    if (dateChanged && startDate) {
      setStartDate(withDatePart(startDate, nextEstimatedDate))
      return
    }
    if (scheduleDerivedField === 'hours') {
      const nextMinutes = exactDurationMinutesBetween(startDate, value)
      if (nextMinutes > 0) {
        setEstimatedMinutes(nextMinutes)
        setEstimatedHoursInput(formatEstimatedDurationInputValue(nextMinutes))
      }
      return
    }
    setStartDate(addMinutesToPlanDateTime(value, -estimatedMinutes))
  }

  const updateEstimatedMinutes = (value: number, preserveInput = false) => {
    const nextMinutes = normalizeEstimatedMinutes(value)
    setEstimatedMinutes(nextMinutes)
    if (!preserveInput) {
      setEstimatedHoursInput(formatEstimatedDurationInputValue(nextMinutes))
    }
    if (scheduleDerivedField === 'start') {
      setStartDate(addMinutesToPlanDateTime(estimatedDate, -nextMinutes))
      return
    }
    setEstimatedDate(addMinutesToPlanDateTime(startDate, nextMinutes))
  }

  const updateEstimatedHoursInput = (value: string) => {
    setEstimatedHoursInput(value.slice(0, 32))
    if (scheduleDerivedField === 'hours') {
      setScheduleDerivedField('end')
    }
    const nextMinutes = parseEstimatedDurationInputMinutes(value)
    if (nextMinutes) {
      updateEstimatedMinutes(nextMinutes, true)
    }
  }

  const commitEstimatedHoursInput = () => {
    const nextMinutes = parseEstimatedDurationInputMinutes(estimatedHoursInput)
    updateEstimatedMinutes(nextMinutes || estimatedMinutes)
  }

  const applyVoiceTaskSchedule = (result: VoiceScheduleResult) => {
    if (result.startAt && result.durationMinutes && result.endAt) {
      setStartDate(result.startAt)
      setEstimatedMinutes(result.durationMinutes)
      setEstimatedHoursInput(formatEstimatedDurationInputValue(result.durationMinutes))
      setEstimatedDate(result.endAt)
      if (result.derivedField) setScheduleDerivedField(result.derivedField)
      setActiveDatePickerId(null)
      return
    }
    if (result.suppliedFields.includes('start') && result.startAt) updateStartDate(result.startAt)
    if (result.suppliedFields.includes('hours') && result.durationMinutes) updateEstimatedMinutes(result.durationMinutes)
    if (result.suppliedFields.includes('end') && result.endAt) updateEstimatedDate(result.endAt)
    setActiveDatePickerId(null)
  }

  const clearFieldError = useCallback((field: string) => {
    setFormErrors((current) => {
      if (!current[field]) {
        return current
      }
      const next = { ...current }
      delete next[field]
      return next
    })
  }, [])

  const recordTaskAssistantLearning = (finalTitle: string, finalRequirement: string, finalType: string) => {
    const requirementLearning = aiSuggestionAppliedRef.current
    if (requirementLearning) {
      void api.recordAiLearningEvent({
        context: 'task_requirement',
        sourceInput: requirementLearning.sourceInput,
        aiOutput: requirementLearning.aiOutput,
        userFinal: finalRequirement,
        action: aiLearningAction(requirementLearning, finalRequirement),
        designType: finalType,
        taskId: editingTask?.id,
        taskTitle: finalTitle,
      })
    }
    const titleLearning = aiTitleSuggestionAppliedRef.current
    if (titleLearning) {
      void api.recordAiLearningEvent({
        context: 'task_title',
        sourceInput: titleLearning.sourceInput,
        aiOutput: titleLearning.aiOutput,
        userFinal: finalTitle,
        action: aiLearningAction(titleLearning, finalTitle),
        designType: finalType,
        taskId: editingTask?.id,
        taskTitle: finalTitle,
      })
    }
    // 无论是否使用 AI，每次提交都记录最终选择的设计类型，供分类建议模型学习。
    if (finalTitle || finalRequirement) {
      void api.recordTaskTypeChoice({
        requirement: finalRequirement,
        title: finalTitle,
        finalType,
        aiSuggestedType: aiSuggestion?.suggestedType ?? undefined,
      })
      if (aiSuggestion?.suggestedType) {
        void api.recordAiLearningEvent({
          context: 'task_type',
          sourceInput: initialDraft.type,
          aiOutput: aiSuggestion.suggestedType,
          userFinal: finalType,
          action: finalType === aiSuggestion.suggestedType ? 'adopted' : 'rejected',
          designType: finalType,
          taskId: editingTask?.id,
          taskTitle: finalTitle,
        })
      }
    }
    if (hourSuggestion && !hourSuggestionIsStale) {
      const selectedHours = Math.round((estimatedMinutes / 60) * 100) / 100
      void api.recordAiLearningEvent({
        context: 'hour_estimate',
        sourceInput: currentHourSuggestionSignature,
        aiOutput: String(hourSuggestion.suggestedHours),
        userFinal: String(selectedHours),
        action: Math.abs(selectedHours - hourSuggestion.suggestedHours) < 0.01 ? 'adopted' : 'edited',
        designType: finalType,
        taskId: editingTask?.id,
        taskTitle: finalTitle,
        metadata: {
          suggestionId: hourSuggestion.suggestionId,
          source: 'task_submit',
          safeHours: hourSuggestion.safeHours,
          feedbackRating: hourSuggestionFeedback,
          feedbackReasons: hourSuggestionFeedbackReasons,
        },
      })
    }
    aiSuggestionAppliedRef.current = null
    aiTitleSuggestionAppliedRef.current = null
  }

  const handleSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!type.trim()) {
      nextErrors.type = '请选择设计类型'
    }
    if (!title.trim()) {
      nextErrors.title = '请填写任务名称'
    }
    if (!requirement.trim()) {
      nextErrors.requirement = '请填写任务具体需求'
    }
    if (!requester.trim()) {
      nextErrors.requester = '请填写需求人'
    }
    if (!contact.trim()) {
      nextErrors.contact = '请填写对接人'
    }
    if (!reviewer.trim()) {
      nextErrors.reviewer = '请填写验收人'
    }
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }
    const estimated = Math.round((estimatedMinutes / 60) * 100) / 100
    const finalTitle = title.trim()
    const finalRequirement = requirement.trim()
    const finalType = type.trim()
    recordTaskAssistantLearning(finalTitle, finalRequirement, finalType)
    if (editingTask && onSave) {
      const nextRequester = requester.trim() || editingTask.requester || contact.trim() || '待确认'
      const nextContact = contact.trim() || editingTask.contact || nextRequester
      const nextReviewer = reviewer.trim() || editingTask.reviewer || nextRequester
      onSave({
        title: finalTitle || editingTask.title,
        date: startDate,
        estimatedDate,
        settlementMonth: isSupplemental ? settlementMonth : '',
        isSupplemental,
        type: finalType || editingTask.type,
        requirement: finalRequirement,
        requester: nextRequester,
        contact: nextContact,
        reviewer: nextReviewer,
        estimatedHours: estimated,
        hourEstimateSuggestionId: hourSuggestion && !hourSuggestionIsStale ? hourSuggestion.suggestionId : undefined,
        supplementalNote: isSupplemental ? supplementalNote.trim() : '',
        acceptanceNote: editingTask.acceptanceNote ?? '',
      })
      return
    }

    const status: TaskStatus = '计划中'

    onCreate({
      id: Date.now(),
      date: startDate,
      estimatedDate,
      settlementMonth: isSupplemental ? settlementMonth : '',
      isSupplemental,
      type: finalType,
      title: finalTitle,
      requirement: finalRequirement,
      requester: requester.trim(),
      contact: contact.trim(),
      reviewer: reviewer.trim() || requester.trim(),
      stage: status,
      estimatedHours: estimated,
      hourEstimateSuggestionId: hourSuggestion && !hourSuggestionIsStale ? hourSuggestion.suggestionId : undefined,
      actualHours: 0,
      status,
      progress: 0,
      billable: !isFree,
      supplementalNote: isSupplemental ? supplementalNote.trim() : '',
      acceptanceNote: '',
      files: [],
    })
  }

  const toggleFree = () => setIsFree((value) => !value)

  const toggleSupplemental = () => {
    const next = !isSupplemental
    setIsSupplemental(next)
    if (next && !supplementalMonthOptions.includes(settlementMonth)) {
      setSettlementMonth(supplementalMonthOptions[0])
    }
    if (!next) {
      setSupplementalNote('')
    }
  }

  const loadBriefFiles = useCallback(async (fileList: FileList | File[] | null, source: 'picker' | 'paste' = 'picker') => {
    const files = Array.from(fileList ?? [])
    if (files.length === 0) return
    const availableSlots = Math.max(0, 6 - briefFilesRef.current.length)
    if (availableSlots === 0) {
      setBriefError('最多添加 6 个需求附件')
      return
    }
    setBriefError('')
    setIsBriefLoading(true)
    const added: BriefItem[] = []
    try {
      for (const file of files.slice(0, availableSlots)) {
        const displayName = source === 'paste' ? pastedImageName(file) : file.name
        if (file.type.startsWith('image/')) {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
            reader.readAsDataURL(file)
          })
          added.push({ id: crypto.randomUUID(), name: displayName, text: '', chars: 0, isImage: true, base64, mimeType: file.type || 'image/jpeg' })
        } else {
          const text = await extractAttachmentText(file)
          if (text.trim()) {
            const previewFile = await createOptionalPreviewFile(file) ?? await createTextPreviewFile(file.name, text)
            const previewUrl = previewFile ? URL.createObjectURL(previewFile) : undefined
            added.push({
              id: crypto.randomUUID(),
              name: displayName,
              text,
              chars: text.length,
              previewUrl,
              previewLabel: splitFileName(file.name).extension.replace('.', '').toUpperCase() || 'FILE',
            })
          } else {
            setBriefError('部分文件没能读到文字（支持 Word .docx、PPT .pptx、PDF、txt；旧版 .doc/.ppt 请另存为新格式）')
          }
        }
      }
      if (added.length > 0) {
        setBriefFiles((prev) => {
          const combined = [...prev, ...added]
          combined.slice(6).forEach(revokeBriefPreview)
          return combined.slice(0, 6)
        })
      }
    } catch {
      added.forEach(revokeBriefPreview)
      setBriefError('读取附件失败，请换个文件或稍后重试')
    } finally {
      setIsBriefLoading(false)
      if (briefInputRef.current) briefInputRef.current.value = ''
    }
  }, [revokeBriefPreview])

  const handleBriefPaste = (event: React.ClipboardEvent) => {
    // 已明确聚焦任务名称/需求等可编辑字段时，交回给该字段正常粘贴，避免图片被附件区抢走。
    if (isEditableShortcutTarget(event.target) && !(event.target instanceof Element && event.target.closest('.new-task-brief-field'))) {
      return
    }
    const pastedImages = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
    if (pastedImages.length === 0) {
      return
    }
    event.preventDefault()
    void loadBriefFiles(pastedImages, 'paste')
  }

  useEffect(() => {
    const routeDefaultPaste = (event: ClipboardEvent) => {
      // 用户已经把光标放进输入框时，文本和图片都由当前字段决定；不覆盖明确意图。
      if (isEditableShortcutTarget(document.activeElement)) {
        return
      }
      const clipboard = event.clipboardData
      if (!clipboard) {
        return
      }
      const pastedImages = Array.from(clipboard.items)
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file))
      if (pastedImages.length > 0) {
        event.preventDefault()
        void loadBriefFiles(pastedImages, 'paste')
        return
      }
      const pastedText = clipboard.getData('text/plain').trim()
      if (!pastedText) {
        return
      }
      event.preventDefault()
      setRequirement((current) => current ? `${current}\n${pastedText}` : pastedText)
      clearFieldError('requirement')
    }
    window.addEventListener('paste', routeDefaultPaste, true)
    return () => window.removeEventListener('paste', routeDefaultPaste, true)
  }, [clearFieldError, loadBriefFiles])

  const isBriefFileDrag = (event: React.DragEvent<HTMLElement>) => Array.from(event.dataTransfer.types).includes('Files')

  const handleBriefDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isBriefFileDrag(event)) return
    event.preventDefault()
    briefDragDepthRef.current += 1
    setIsBriefDragOver(true)
  }

  const handleBriefDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isBriefFileDrag(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleBriefDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isBriefFileDrag(event)) return
    briefDragDepthRef.current = Math.max(0, briefDragDepthRef.current - 1)
    if (briefDragDepthRef.current === 0) setIsBriefDragOver(false)
  }

  const handleBriefDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isBriefFileDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    briefDragDepthRef.current = 0
    setIsBriefDragOver(false)
    void loadBriefFiles(event.dataTransfer.files)
  }

  const requestAiSuggestion = async () => {
    setAiError('')
    setAiSuggestion(null)
    setIsAiLoading(true)
    try {
      const textFiles = briefFiles.filter((f) => !f.isImage)
      const imageFiles = briefFiles.filter((f) => f.isImage && f.base64)
      const suggestion = await api.suggestTaskAssistant({
        title,
        requirement,
        selectedType: type,
        designTypeGroups: availableDesignTypeGroups,
        attachmentText: textFiles.map((f) => f.text).join('\n\n').slice(0, 8000) || undefined,
        attachmentName: textFiles.map((f) => f.name).join('、') || undefined,
        attachmentImages: imageFiles.map((f) => ({ base64: f.base64!, mimeType: f.mimeType ?? 'image/jpeg', name: f.name })),
      })
      setAiSuggestion(suggestion)
      const optimizedRequirement = taskAssistantRequirementWithoutOutputFiles(suggestion.optimizedRequirement)
      aiSuggestionAppliedRef.current = optimizedRequirement
        ? { sourceInput: requirement.trim(), aiOutput: optimizedRequirement, applied: false }
        : null
      aiTitleSuggestionAppliedRef.current = suggestion.suggestedTitle
        ? { sourceInput: title.trim(), aiOutput: suggestion.suggestedTitle, applied: false }
        : null
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI 助手暂时不可用')
    } finally {
      setIsAiLoading(false)
    }
  }

  const applyAiTitle = () => {
    if (!aiSuggestion?.suggestedTitle) return
    aiTitleSuggestionAppliedRef.current = {
      sourceInput: aiTitleSuggestionAppliedRef.current?.sourceInput ?? title.trim(),
      aiOutput: aiSuggestion.suggestedTitle,
      applied: true,
    }
    setTitle(aiSuggestion.suggestedTitle)
  }

  const applyAiSuggestion = () => {
    if (!aiSuggestion) {
      return
    }
    const nextRequirement = taskAssistantRequirementWithoutOutputFiles(aiSuggestion.optimizedRequirement)
    aiSuggestionAppliedRef.current = {
      sourceInput: aiSuggestionAppliedRef.current?.sourceInput ?? requirement.trim(),
      aiOutput: nextRequirement,
      applied: true,
    }
    setRequirement(nextRequirement)
  }

  const applyAiCategory = () => {
    if (!aiSuggestion?.categoryExists) {
      return
    }
    setType(aiSuggestion.suggestedType)
  }

  const addSuggestedCategoryAndApply = async () => {
    if (!aiSuggestion) {
      return
    }
    const parent = aiSuggestion.suggestedParentType.trim()
    const child = aiSuggestion.suggestedChildType.trim()
    if (!parent || !child) {
      return
    }
    const nextGroups = [...availableDesignTypeGroups]
    const index = nextGroups.findIndex((group) => group.name === parent)
    if (index >= 0) {
      const current = nextGroups[index]
      nextGroups[index] = { ...current, items: current.items.includes(child) ? current.items : [...current.items, child] }
    } else {
      nextGroups.push({ name: parent, items: [child] })
    }
    await onDesignTypeGroupsChange(nextGroups)
    setType(`${parent} / ${child}`)
    setAiSuggestion({ ...aiSuggestion, categoryExists: true, missingCategory: undefined })
  }

  const requestHourSuggestion = async () => {
    setHourSuggestionError('')
    setHourSuggestion(null)
    setHourSuggestionFeedback(null)
    setHourSuggestionFeedbackReasons([])
    setHourSampleFeedback({})
    setIsHourSuggestionLoading(true)
    try {
      const suggestion = await api.suggestHourEstimate({
        title,
        requirement,
        selectedType: type,
        requester,
        startDate,
        estimatedDate,
        currentEstimatedHours: estimatedMinutes / 60,
        attachmentText: briefFiles.filter((file) => !file.isImage).map((file) => file.text).join('\n\n').slice(0, 5000) || undefined,
        attachmentNames: briefFiles.map((file) => file.name),
      })
      setHourSuggestion(suggestion)
      setHourSuggestionInputSignature(currentHourSuggestionSignature)
    } catch (error) {
      setHourSuggestionError(error instanceof Error ? error.message : 'AI 工时建议暂时不可用')
    } finally {
      setIsHourSuggestionLoading(false)
    }
  }

  const applyHourSuggestion = (hours = hourSuggestion?.suggestedHours) => {
    if (!hourSuggestion || hourSuggestionIsStale || !hourSuggestion.decision.canApply || !hours) {
      return
    }
    updateEstimatedMinutes(hours * 60)
  }

  const applyHourCompletionOption = (appendText: string) => {
    if (!appendText || requirement.includes(appendText)) return
    setRequirement([requirement.trim(), appendText].filter(Boolean).join('\n'))
  }

  const toggleHourSampleFeedback = (sampleTaskId: number) => {
    if (!hourSuggestion || hourSuggestionIsStale) return
    const relevant = hourSampleFeedback[sampleTaskId] === false
    setHourSampleFeedback((current) => ({ ...current, [sampleTaskId]: relevant }))
    void api.recordHourEstimateSampleFeedback({
      suggestionId: hourSuggestion.suggestionId,
      sampleTaskId,
      relevant,
      reason: relevant ? '恢复为可参考样本' : '当前任务与该历史样本不相似',
    }).catch((error) => {
      setHourSampleFeedback((current) => ({ ...current, [sampleTaskId]: !relevant }))
      setHourSuggestionError(error instanceof Error ? error.message : '参考样本反馈保存失败')
    })
  }

  const recordHourSuggestionFeedback = (rating: HourEstimateFeedbackRating) => {
    if (!hourSuggestion || hourSuggestionIsStale) {
      return
    }
    setHourSuggestionFeedback(rating)
    if (rating === 'accurate') {
      setHourSuggestionFeedbackReasons([])
    }
    void api.recordAiLearningEvent({
      context: 'hour_estimate',
      sourceInput: currentHourSuggestionSignature,
      aiOutput: String(hourSuggestion.suggestedHours),
      userFinal: '',
      action: rating === 'accurate' ? 'adopted' : 'rejected',
      designType: type.trim(),
      taskId: editingTask?.id,
      taskTitle: title.trim(),
      metadata: {
        suggestionId: hourSuggestion.suggestionId,
        source: 'explicit_feedback',
        rating,
      },
    })
  }

  const toggleHourSuggestionFeedbackReason = (reason: string) => {
    if (!hourSuggestion || !hourSuggestionFeedback || hourSuggestionFeedback === 'accurate') {
      return
    }
    setHourSuggestionFeedbackReasons((current) => {
      const next = current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason]
      void api.recordAiLearningEvent({
        context: 'hour_estimate',
        sourceInput: currentHourSuggestionSignature,
        aiOutput: String(hourSuggestion.suggestedHours),
        userFinal: '',
        action: 'rejected',
        designType: type.trim(),
        taskId: editingTask?.id,
        taskTitle: title.trim(),
        metadata: {
          suggestionId: hourSuggestion.suggestionId,
          source: 'explicit_feedback',
          rating: hourSuggestionFeedback,
          reasons: next,
        },
      })
      return next
    })
  }

  return (
    <ModalShell className="new-task-modal" labelledBy="new-task-title" onClose={onClose} closeOnBackdrop={false} closeOnEscape={false}>
        <header className="modal-header">
          <div>
            <h2 id="new-task-title">{isEditing ? '编辑任务' : isSupplemental ? '补录已完成任务' : '新建任务'}</h2>
            <span className="new-task-modal-subtitle">
              {isEditing ? '修改任务信息，工时、文件与月报仍会从这里串起来' : isSupplemental ? '登记过往已交付、需计入某月结算的任务' : '记录一条真实任务，工时、文件与月报都会从这里串起来'}
            </span>
          </div>
          <div className="modal-header-actions">
            <div className="supplemental-switch-wrap">
              {!isEditing && (
                <button
                  type="button"
                  className={`supplemental-toggle-button ${isFree ? 'active' : ''}`}
                  aria-label="不计费任务"
                  aria-pressed={isFree}
                  title={isFree ? '不计费任务：不计入计费工时与收入，但仍会出现在结算报表' : '标记为不计费任务（免费协助）'}
                  onClick={toggleFree}
                >
                  <span>不计费</span>
                  <span className={`switch-control ${isFree ? 'active' : ''}`} aria-hidden="true"><i /></span>
                </button>
              )}
              {isSupplemental && (
                <label className="supplemental-month-select">
                  <span>记录月份</span>
                  <select value={settlementMonth} onChange={(event) => setSettlementMonth(event.target.value)} aria-label="计入结算月份">
                    {supplementalMonthOptions.map((monthValue) => (
                      <option key={monthValue} value={monthValue}>
                        {monthLabelOf(monthValue)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                className={`supplemental-toggle-button ${isSupplemental ? 'active' : ''}`}
                aria-label="补录任务"
                aria-pressed={isSupplemental}
                title={isSupplemental ? `补录至 ${monthLabelOf(settlementMonth)}` : '标记为补录任务'}
                onClick={toggleSupplemental}
              >
                <span>补录</span>
                <span className={`switch-control ${isSupplemental ? 'active' : ''}`} aria-hidden="true"><i /></span>
              </button>
            </div>
          </div>
        </header>

        <div className="form-grid new-task-form" onPaste={handleBriefPaste}>
          <div className={`field wide new-task-type-field ${formErrors.type ? 'field-invalid' : ''}`}>
            <span>设计类型</span>
            <NewTaskDesignTypeSelector groups={availableDesignTypeGroups} value={type} onChange={(value) => { setType(value); clearFieldError('type') }} />
            {formErrors.type && <small className="field-error">{formErrors.type}</small>}
          </div>
          <label className={`field wide ${formErrors.title ? 'field-invalid' : ''}`}>
            <span>任务名称</span>
            <input value={title} onChange={(event) => { setTitle(event.target.value); clearFieldError('title') }} placeholder="例如：金博会邀请函长图设计" aria-required="true" />
            {formErrors.title && <small className="field-error">{formErrors.title}</small>}
          </label>
          <div className={`field wide ${formErrors.requirement ? 'field-invalid' : ''}`}>
            <span className="field-label-row">
              <span>任务需求</span>
              <button
                type="button"
                className="icon-button ai-assist-button"
                aria-label="AI 优化任务需求"
                title="AI 优化任务需求"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void requestAiSuggestion()
                }}
                disabled={isAiLoading || (!title.trim() && !requirement.trim() && briefFiles.length === 0)}
              >
                <Sparkles size={16} />
              </button>
            </span>
            <textarea
              aria-label="任务具体需求"
              value={requirement}
              onChange={(event) => { setRequirement(event.target.value); clearFieldError('requirement') }}
              placeholder="例如：为金博会制作论坛预热邀请长图，用于各渠道发送"
              aria-required="true"
            />
            {formErrors.requirement && <small className="field-error">{formErrors.requirement}</small>}
          </div>
          <div
            className={`field wide new-task-brief-field ${isBriefDragOver ? 'is-dragover' : ''}`}
            data-testid="new-task-brief-dropzone"
            onDragEnter={handleBriefDragEnter}
            onDragOver={handleBriefDragOver}
            onDragLeave={handleBriefDragLeave}
            onDrop={handleBriefDrop}
          >
            <span className="field-label-row">
              <span>合作伙伴文案附件（选填）</span>
            </span>
            <div className="brief-files-list">
              {briefFiles.map((f) => (
                f.isImage && f.base64 ? (
                  <div key={f.id} className="brief-img-chip">
                    <img src={`data:${f.mimeType};base64,${f.base64}`} className="brief-img-thumb" alt={f.name} onClick={() => setBriefLightboxSrc(`data:${f.mimeType};base64,${f.base64}`)} style={{ cursor: 'zoom-in' }} />
                    <button type="button" className="brief-img-remove" aria-label="移除" onClick={() => removeBriefFile(f.id)}>
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <div key={f.id} className={`brief-file-chip ${f.previewUrl ? 'has-preview' : ''}`}>
                    <button type="button" className="brief-file-remove" aria-label="移除" onClick={() => removeBriefFile(f.id)}>
                      <X size={10} />
                    </button>
                    <button
                      type="button"
                      className="brief-file-preview-thumb"
                      aria-label={`预览 ${f.name}`}
                      onClick={() => f.previewUrl && setBriefLightboxSrc(f.previewUrl)}
                      disabled={!f.previewUrl}
                    >
                      {f.previewUrl ? (
                        <img src={f.previewUrl} alt={f.name} />
                      ) : (
                        <>
                          <FileText size={18} />
                          <span>{f.previewLabel || 'FILE'}</span>
                        </>
                      )}
                    </button>
                    <div className="brief-file-meta">
                      <strong>{f.name}</strong>
                      <small>约 {f.chars} 字</small>
                    </div>
                  </div>
                )
              ))}
              {briefFiles.length < 6 && (
                <button
                  type="button"
                  className={`brief-upload-box ${briefFiles.length > 0 ? 'brief-upload-compact' : ''}`}
                  onClick={() => briefInputRef.current?.click()}
                  disabled={isBriefLoading}
                >
                  <Plus size={briefFiles.length > 0 ? 16 : 14} />
                  {briefFiles.length === 0 && (isBriefLoading ? '正在读取…' : '上传、拖拽或 Command+V 粘贴合作伙伴文案到这里')}
                  {briefFiles.length > 0 && isBriefLoading && <small>读取中…</small>}
                  {briefFiles.length === 0 && <small>支持 Word .docx / PPT .pptx / PDF / txt / 图片，最多 6 个</small>}
                </button>
              )}
            </div>
            {briefError && <small className="field-error">{briefError}</small>}
            <input
              ref={briefInputRef}
              type="file"
              multiple
              className="task-row-upload-input"
              accept=".docx,.pptx,.pdf,.txt,.md,.csv,.jpg,.jpeg,.png,.webp,.gif"
              onChange={(event) => void loadBriefFiles(event.target.files)}
            />
          </div>
          {briefLightboxSrc && <ImageLightbox src={briefLightboxSrc} alt="附件图片预览" onClose={() => setBriefLightboxSrc(null)} />}
          {(aiSuggestion || aiError || isAiLoading) && (
            <div className="ai-suggestion-panel wide">
              <div className="ai-suggestion-head">
                <span>{isAiLoading ? 'AI 正在整理需求' : 'AI 建议'}</span>
                {aiSuggestion && (
                  <button
                    type="button"
                    className="ai-suggestion-category-adopt"
                    aria-label={`采用建议分类：${aiSuggestion.suggestedType}`}
                    title="点击采用此分类"
                    onClick={() => aiSuggestion.categoryExists ? applyAiCategory() : void addSuggestedCategoryAndApply()}
                  >
                    {aiSuggestion.suggestedType}
                  </button>
                )}
                {!isAiLoading && (aiSuggestion || aiError) && (
                  <button type="button" className="ai-suggestion-dismiss" aria-label="关闭建议" title="关闭建议" onClick={() => { setAiSuggestion(null); setAiError('') }}>
                    <X size={14} />
                  </button>
                )}
              </div>
              {isAiLoading && <p>正在优化文案并匹配设计类型...</p>}
              {aiError && <p className="ai-suggestion-error">{aiError}</p>}
              {aiSuggestion && (
                <>
                  {aiSuggestion.suggestedTitle && (
                    <button
                      type="button"
                      className="ai-suggestion-title-row ai-suggestion-adopt-target"
                      aria-label="采用建议任务名称"
                      title="点击采用建议任务名称"
                      onClick={applyAiTitle}
                    >
                      <span className="ai-suggestion-title-label">建议任务名称</span>
                      <span className="ai-suggestion-title-text">{aiSuggestion.suggestedTitle}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="ai-suggestion-body ai-suggestion-adopt-target"
                    aria-label="采用建议文案"
                    title="点击采用建议文案"
                    onClick={applyAiSuggestion}
                  >
                    {taskAssistantRequirementWithoutOutputFiles(aiSuggestion.optimizedRequirement).split('\n').map((line, index) => {
                      const trimmed = line.trim()
                      if (!trimmed) {
                        return null
                      }
                      const isHeading = /^【.+】/.test(trimmed)
                      const isItem = trimmed.startsWith('·') || trimmed.startsWith('•')
                      if (isHeading) {
                        return <strong className="ai-suggestion-heading" key={index}>{trimmed}</strong>
                      }
                      if (isItem) {
                        return <span className="ai-suggestion-item" key={index}>{trimmed}</span>
                      }
                      return <span className="ai-suggestion-line" key={index}>{trimmed}</span>
                    })}
                  </button>
                  {aiSuggestion.reason && <small>{aiSuggestion.reason}</small>}
                </>
              )}
            </div>
          )}
          <div className="new-task-people-row wide">
            <label className={`field ${formErrors.requester ? 'field-invalid' : ''}`}>
              <span>需求人</span>
              <input
                value={requester}
                onChange={(event) => {
                  const value = event.target.value
                  setRequester(value)
                  if (!reviewerEdited) {
                    setReviewer(value)
                  }
                  clearFieldError('requester')
                  if (!reviewerEdited) {
                    clearFieldError('reviewer')
                  }
                }}
                placeholder="例如：市场部 · 王敏"
                aria-required="true"
              />
              {formErrors.requester && <small className="field-error">{formErrors.requester}</small>}
            </label>
            <label className={`field ${formErrors.contact ? 'field-invalid' : ''}`}>
              <span>对接人</span>
              <input value={contact} onChange={(event) => { setContact(event.target.value); clearFieldError('contact') }} placeholder="例如：黄媚" aria-required="true" />
              {formErrors.contact && <small className="field-error">{formErrors.contact}</small>}
            </label>
            <label className={`field ${formErrors.reviewer ? 'field-invalid' : ''}`}>
              <span>验收人</span>
              <input
                value={reviewer}
                onChange={(event) => {
                  setReviewer(event.target.value)
                  setReviewerEdited(true)
                  clearFieldError('reviewer')
                }}
                placeholder="默认同需求人"
                aria-required="true"
              />
              {formErrors.reviewer && <small className="field-error">{formErrors.reviewer}</small>}
            </label>
          </div>
          <div className="new-task-time-label">
            <span>时间与工时</span>
            <em>三项同时只激活两项，第三项自动推算（灰色）</em>
            <VoiceScheduleButton
              context="新建或编辑任务的预计排期"
              currentStart={startDate}
              currentDurationMinutes={estimatedMinutes}
              currentEnd={estimatedDate}
              onApply={applyVoiceTaskSchedule}
            />
          </div>
          <div className="new-task-schedule-row">
            <PlanDateTimeField
              label="预计开始"
              value={startDate}
              onChange={updateStartDate}
              isActive={scheduleDerivedField !== 'start'}
              readOnly={scheduleDerivedField === 'start'}
              control={<ScheduleAnchorSwitch active={scheduleDerivedField !== 'start'} label="切换预计开始时间" onClick={() => toggleScheduleField('start')} />}
              pickerId="new-task-start"
              activePickerId={activeDatePickerId}
              onActivePickerChange={setActiveDatePickerId}
            />
            <div className="field">
              <span className="new-task-inline-label">
                <ScheduleAnchorSwitch active={scheduleDerivedField !== 'hours'} label="切换预估工时" onClick={() => toggleScheduleField('hours')} />
                预估工时
              </span>
              <div className="new-task-hours-row">
                <input
                  className="new-task-hours-input"
                  type="text"
                  inputMode="text"
                  value={estimatedHoursInput}
                  placeholder="如 15分钟"
                  onFocus={(event) => {
                    event.currentTarget.select()
                    if (scheduleDerivedField === 'hours') {
                      setScheduleDerivedField('end')
                    }
                  }}
                  onChange={(event) => updateEstimatedHoursInput(event.target.value)}
                  onBlur={commitEstimatedHoursInput}
                  aria-label="预估工时，可输入15分钟、1小时30分钟或小数小时"
                />
                <button
                  type="button"
                  className="new-task-ai-pill"
                  onClick={() => void requestHourSuggestion()}
                  disabled={isHourSuggestionLoading || !type.trim() || (!title.trim() && !requirement.trim())}
                >
                  <Sparkles size={14} />
                  {isHourSuggestionLoading ? '分析中' : 'AI 分析'}
                </button>
              </div>
            </div>
            <PlanDateTimeField
              label="预计交付"
              value={estimatedDate}
              onChange={updateEstimatedDate}
              isActive={scheduleDerivedField !== 'end'}
              readOnly={scheduleDerivedField === 'end'}
              control={<ScheduleAnchorSwitch active={scheduleDerivedField !== 'end'} label="切换预计交付时间" onClick={() => toggleScheduleField('end')} />}
              pickerId="new-task-end"
              activePickerId={activeDatePickerId}
              onActivePickerChange={setActiveDatePickerId}
            />
          </div>
          {(isHourSuggestionLoading || hourSuggestion || hourSuggestionError) && (
          <div className="hour-estimate-panel wide">
            <div className="hour-estimate-head">
              <div>
                <strong>工时建议</strong>
                <span>基于同类型历史任务、实际工时和验收备注分析</span>
              </div>
              <div className="hour-estimate-head-actions">
                <button
                  type="button"
                  className="ghost-button compact-button"
                  onClick={() => void requestHourSuggestion()}
                  disabled={isHourSuggestionLoading || !type.trim() || (!title.trim() && !requirement.trim())}
                >
                  <Sparkles size={14} />
                  {isHourSuggestionLoading ? '分析中' : 'AI 分析'}
                </button>
                {!isHourSuggestionLoading && (hourSuggestion || hourSuggestionError) && (
                  <button type="button" className="ai-suggestion-dismiss" aria-label="关闭工时建议" title="关闭工时建议" onClick={() => { setHourSuggestion(null); setHourSuggestionError('') }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            {isHourSuggestionLoading && <p>正在读取历史任务并生成工时建议...</p>}
            {hourSuggestionError && <p className="ai-suggestion-error">{hourSuggestionError}</p>}
            {!isHourSuggestionLoading && !hourSuggestion && !hourSuggestionError && (
              <p>填写任务类型和需求后，可以让 AI 参考过往同类任务，给出更稳的预估工时。</p>
            )}
            {hourSuggestion && (
              <div className="hour-estimate-result">
                <div className="hour-estimate-main">
                  <div className="hour-estimate-primary-value">
                    <span>常规预估</span>
                    <strong>{hourSuggestion.suggestedHours.toFixed(1)} h</strong>
                  </div>
                  <div className="hour-estimate-safe-value">
                    <span>稳妥预留</span>
                    <strong>{hourSuggestion.safeHours.toFixed(1)} h</strong>
                  </div>
                  <em className={`hour-confidence confidence-${hourSuggestion.confidence}`}>{hourSuggestion.confidence}置信度</em>
                  <em className={`hour-complexity complexity-${hourSuggestion.complexity.level}`}>
                    {hourSuggestion.complexity.level}复杂度 · {hourSuggestion.complexity.score}
                  </em>
                </div>
                <div className="hour-estimate-stats">
                  <span>常规区间 {hourSuggestion.expectedRange.low.toFixed(1)}–{hourSuggestion.expectedRange.high.toFixed(1)} h</span>
                  <span>精确同类 {hourSuggestion.exactSampleCount} 条</span>
                  <span>相关参考 {hourSuggestion.similarSampleCount} 条</span>
                  {hourSuggestion.sampleCount > 0 && <span>历史中位 {hourSuggestion.medianHours.toFixed(1)} h</span>}
                  {hourSuggestion.sampleCount > 0 && <span>范围 {hourSuggestion.minHours.toFixed(1)}–{hourSuggestion.maxHours.toFixed(1)} h</span>}
                  {hourSuggestion.averageDeliveryDays > 0 && <span>平均周期 {hourSuggestion.averageDeliveryDays.toFixed(1)} 天</span>}
                </div>
                <section className={`hour-estimate-decision ${hourSuggestion.decision.mode}`}>
                  <div>
                    <strong>{hourSuggestion.decision.mode === 'estimate' ? '可采用建议' : hourSuggestion.decision.mode === 'range_only' ? '仅提供区间' : '需要补充信息'}</strong>
                    <span>需求质量 {hourSuggestion.requirementQuality.score} 分 · {hourSuggestion.requirementQuality.grade}</span>
                  </div>
                  <p>{hourSuggestion.decision.reason}</p>
                  <small>{hourSuggestion.requirementQuality.summary}</small>
                </section>
                {hourSuggestion.completionOptions.length > 0 && (
                  <section className="hour-requirement-completion">
                    <div><strong>快速补全需求</strong><span>点击后写入需求，再重新分析</span></div>
                    <div>
                      {hourSuggestion.completionOptions.map((option) => (
                        <button type="button" key={option.key} disabled={requirement.includes(option.appendText)} onClick={() => applyHourCompletionOption(option.appendText)}>
                          {requirement.includes(option.appendText) ? '已补充 · ' : ''}{option.label}
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                <section className="hour-change-audit">
                  <div><strong>相比上次建议</strong><span>{hourSuggestion.changeAudit.hasPrevious ? `${hourSuggestion.changeAudit.deltaHours >= 0 ? '+' : ''}${hourSuggestion.changeAudit.deltaHours.toFixed(1)} h` : '首次基线'}</span></div>
                  <p>{hourSuggestion.changeAudit.summary}</p>
                  {hourSuggestion.changeAudit.reasons.length > 0 && <small>{hourSuggestion.changeAudit.reasons.join('；')}</small>}
                </section>
                <section className="hour-pricing-suggestion" aria-label="报价建议">
                  <header>
                    <strong>报价建议</strong>
                    <span>按 ¥{hourSuggestion.pricing.hourlyRate.toLocaleString()} / 小时，仅供确认前参考</span>
                  </header>
                  <div>
                    <p><span>常规报价</span><strong>¥{hourSuggestion.pricing.regularAmount.toLocaleString()}</strong></p>
                    <p><span>稳妥报价</span><strong>¥{hourSuggestion.pricing.safeAmount.toLocaleString()}</strong></p>
                    <p><span>建议范围</span><strong>¥{hourSuggestion.pricing.rangeLowAmount.toLocaleString()}–{hourSuggestion.pricing.rangeHighAmount.toLocaleString()}</strong></p>
                  </div>
                  <small>{hourSuggestion.pricing.summary} 风险预留参考 {hourSuggestion.pricing.riskReserveRate}%。</small>
                </section>
                <p>{hourSuggestion.historicalSummary}</p>
                <div className="hour-estimate-explain-grid">
                  <section className="hour-estimate-explain-section">
                    <header>
                      <strong>复杂度画像</strong>
                      <span>按当前需求确定性提取</span>
                    </header>
                    <div>
                      {hourSuggestion.complexity.dimensions.map((dimension) => (
                        <p key={dimension.key} title={dimension.evidence}>
                          <span>{dimension.label}</span>
                          <strong>{dimension.value}</strong>
                          <em className={`impact-${dimension.impact}`}>{dimension.impact}</em>
                        </p>
                      ))}
                    </div>
                  </section>
                  <section className="hour-estimate-explain-section">
                    <header>
                      <strong>工时拆分</strong>
                      <span>合计 {hourSuggestion.suggestedHours.toFixed(1)} h</span>
                    </header>
                    <div>
                      {hourSuggestion.breakdown.map((item) => (
                        <p key={item.label} title={item.reason}>
                          <span>{item.label}</span>
                          <strong>{item.reason}</strong>
                          <em>{item.hours.toFixed(1)} h</em>
                        </p>
                      ))}
                    </div>
                  </section>
                </div>
                {hourSuggestion.requesterAdjustment.requester && (
                  <div className={`hour-requester-adjustment ${hourSuggestion.requesterAdjustment.applied ? 'applied' : ''}`}>
                    <strong>需求人校准</strong>
                    <span>{hourSuggestion.requesterAdjustment.summary}</span>
                  </div>
                )}
                <div className={`hour-requester-adjustment ${hourSuggestion.learningAdjustment.applied ? 'applied' : ''}`}>
                  <strong>个人采用校准</strong>
                  <span>{hourSuggestion.learningAdjustment.summary}</span>
                </div>
                <div className="hour-estimate-reliability">
                  <div>
                    <strong>历史命中率</strong>
                    <span>{hourSuggestion.accuracy.summary}</span>
                  </div>
                  {hourSuggestion.riskFactors.length > 0 && (
                    <div>
                      <strong>本次不确定因素</strong>
                      <span>{hourSuggestion.riskFactors.join('；')}</span>
                    </div>
                  )}
                </div>
                {hourSuggestion.clarificationQuestions.length > 0 && (
                  <div className="hour-estimate-questions">
                    <strong>补充这些信息，建议会更准</strong>
                    <ol>
                      {hourSuggestion.clarificationQuestions.map((question) => <li key={question}>{question}</li>)}
                    </ol>
                  </div>
                )}
                {hourSuggestionIsStale && <p className="hour-estimate-stale">任务信息已经变化，请重新分析后再采用。</p>}
                {hourSuggestion.basis.length > 0 && (
                  <ul>
                    {hourSuggestion.basis.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                )}
                {hourSuggestion.matchedTasks.length > 0 && (
                  <details className="hour-estimate-samples">
                    <summary>查看参考任务</summary>
                    <div>
                      {hourSuggestion.matchedTasks.map((sample) => (
                        <p key={sample.id}>
                          <span>{sample.relation}</span>
                          <strong>
                            {sample.title}
                            {sample.similarityReasons.length > 0 && <small>{sample.similarityReasons.join(' · ')}</small>}
                          </strong>
                          <em>{sample.actualHours.toFixed(1)} h</em>
                          <button
                            type="button"
                            className={hourSampleFeedback[sample.id] === false ? 'active' : ''}
                            disabled={hourSuggestionIsStale}
                            onClick={() => toggleHourSampleFeedback(sample.id)}
                          >
                            {hourSampleFeedback[sample.id] === false ? '已标记不相似' : '不相似'}
                          </button>
                        </p>
                      ))}
                    </div>
                  </details>
                )}
                <div className="hour-estimate-feedback">
                  <div>
                    <strong>这次建议准确吗？</strong>
                    <span>反馈会在同类样本达到门槛后参与后续校准。</span>
                  </div>
                  <div className="hour-estimate-feedback-options" role="group" aria-label="评价 AI 工时建议">
                    {hourEstimateFeedbackOptions.map((option) => (
                      <button
                        type="button"
                        key={option.value}
                        className={hourSuggestionFeedback === option.value ? 'active' : ''}
                        aria-pressed={hourSuggestionFeedback === option.value}
                        disabled={hourSuggestionIsStale}
                        onClick={() => recordHourSuggestionFeedback(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {hourSuggestionFeedback && hourSuggestionFeedback !== 'accurate' && (
                    <div className="hour-estimate-feedback-reasons" role="group" aria-label="工时建议偏差原因">
                      {hourEstimateFeedbackReasons.map((reason) => (
                        <button
                          type="button"
                          key={reason}
                          className={hourSuggestionFeedbackReasons.includes(reason) ? 'active' : ''}
                          aria-pressed={hourSuggestionFeedbackReasons.includes(reason)}
                          onClick={() => toggleHourSuggestionFeedbackReason(reason)}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="hour-estimate-actions">
                  <small>{hourSuggestion.usedFallback ? '精确样本不足时，相关任务仅作为较低权重参考。' : '建议仅使用已验收任务的真实工时。'} · 算法 {hourSuggestion.modelVersion.algorithm}</small>
                  <div>
                    <button type="button" className="ghost-button compact-button" disabled={hourSuggestionIsStale || !hourSuggestion.decision.canApply} onClick={() => applyHourSuggestion(hourSuggestion.safeHours)}>
                      采用稳妥值
                    </button>
                    <button type="button" className="primary-button compact-button" disabled={hourSuggestionIsStale || !hourSuggestion.decision.canApply} onClick={() => applyHourSuggestion(hourSuggestion.suggestedHours)}>
                      采用常规值
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}
          {isSupplemental && (
            <label className="field wide">
              <span>补录说明</span>
              <textarea
                value={supplementalNote}
                onChange={(event) => setSupplementalNote(event.target.value)}
                placeholder="例如：该任务已于 5 月完成，本次补录到 6 月结算单。验收、实际工时和交付文件请在任务详情中确认。"
              />
            </label>
          )}
        </div>

        <footer className="modal-footer">
          <button className="ghost-button" onClick={onClose}>
            取消
          </button>
          <button data-modal-save="true" className="primary-button" onClick={handleSubmit}>
            {isEditing ? '保存修改' : '创建任务'}
          </button>
        </footer>
    </ModalShell>
  )
}
