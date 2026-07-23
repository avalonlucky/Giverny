import type { Task } from '../types/domain'
import { addMinutesToPlanDateTime } from './timeEntryDraft'
import { ESTIMATED_HOURS_STEP_MINUTES, type ScheduleAnchor } from './durationInput'
import { isoDateTime, monthPart } from './dateTime'
import { removeLocalCache, writeJsonLocalCache } from './localCache'
import { isSupplementalTask } from './taskAccounting'
import { taskSettlementMonth } from './taskSettlement'

const NEW_TASK_DRAFT_STORAGE_KEY = 'giverny:new-task-draft:v1'

export type NewTaskDraftCache = {
  title: string
  requirement: string
  type: string
  startDate: string
  estimatedMinutes: number
  estimatedDate: string
  scheduleAnchor: ScheduleAnchor
  isSupplemental: boolean
  settlementMonth: string
  requester: string
  contact: string
  reviewer: string
  supplementalNote: string
}

export function readNewTaskDraftCache(
  fallbackStartDate: string,
  fallbackType: string,
  fallbackSettlementMonth = monthPart(fallbackStartDate),
): NewTaskDraftCache {
  const fallbackMinutes = 120
  const fallbackDraft: NewTaskDraftCache = {
    title: '',
    requirement: '',
    type: fallbackType,
    startDate: fallbackStartDate,
    estimatedMinutes: fallbackMinutes,
    estimatedDate: addMinutesToPlanDateTime(fallbackStartDate, fallbackMinutes),
    scheduleAnchor: 'end',
    isSupplemental: false,
    settlementMonth: fallbackSettlementMonth,
    requester: '黄媚',
    contact: '黄媚',
    reviewer: '黄媚',
    supplementalNote: '',
  }
  if (typeof window === 'undefined') {
    return fallbackDraft
  }
  try {
    const raw = window.localStorage.getItem(NEW_TASK_DRAFT_STORAGE_KEY)
    if (!raw) {
      return fallbackDraft
    }
    const parsed = JSON.parse(raw) as Partial<NewTaskDraftCache>
    const startDate = parsed.startDate || fallbackDraft.startDate
    const estimatedMinutes = Number.isFinite(parsed.estimatedMinutes) && Number(parsed.estimatedMinutes) > 0
      ? Number(parsed.estimatedMinutes)
      : fallbackMinutes
    return {
      title: parsed.title ?? '',
      requirement: parsed.requirement ?? '',
      type: parsed.type || fallbackType,
      startDate,
      estimatedMinutes,
      estimatedDate: parsed.estimatedDate || addMinutesToPlanDateTime(startDate, estimatedMinutes),
      scheduleAnchor: 'end',
      isSupplemental: Boolean(parsed.isSupplemental),
      settlementMonth: parsed.settlementMonth || fallbackSettlementMonth,
      requester: parsed.requester || parsed.contact || '黄媚',
      contact: parsed.contact || '黄媚',
      reviewer: parsed.reviewer || parsed.requester || parsed.contact || '黄媚',
      supplementalNote: parsed.supplementalNote ?? '',
    }
  } catch {
    return fallbackDraft
  }
}

export function writeNewTaskDraftCache(draft: NewTaskDraftCache) {
  writeJsonLocalCache(NEW_TASK_DRAFT_STORAGE_KEY, draft)
}

export function clearNewTaskDraftCache() {
  removeLocalCache(NEW_TASK_DRAFT_STORAGE_KEY)
}

export function newTaskDraftFromTask(
  task: Task,
  fallbackType: string,
  fallbackSettlementMonth: string,
): NewTaskDraftCache {
  const startDate = task.date || isoDateTime()
  const estimatedMinutes = Math.max(ESTIMATED_HOURS_STEP_MINUTES, Math.round((Number(task.estimatedHours) || 2) * 60))
  return {
    title: task.title ?? '',
    requirement: task.requirement ?? '',
    type: task.type || fallbackType,
    startDate,
    estimatedMinutes,
    estimatedDate: task.estimatedDate || addMinutesToPlanDateTime(startDate, estimatedMinutes),
    scheduleAnchor: 'end',
    isSupplemental: isSupplementalTask(task),
    settlementMonth: taskSettlementMonth(task) || fallbackSettlementMonth,
    requester: task.requester || task.contact || '黄媚',
    contact: task.contact || task.requester || '黄媚',
    reviewer: task.reviewer || task.requester || task.contact || '黄媚',
    supplementalNote: task.supplementalNote ?? '',
  }
}
