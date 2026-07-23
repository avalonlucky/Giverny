import type { TaskFeedbackRating, TaskFeedbackTag, TimeEntry, WaitingEntry } from '../types/domain'
import type { PendingProgressAttachment, ProgressRecordMode } from '../types/taskUi'
import type { ScheduleAnchor } from './durationInput'
import { readMergedLocalCache, removeLocalCache, writeJsonLocalCache } from './localCache'
import type { TimeEntryDraft } from './timeEntryDraft'

export type ProgressDraftSnapshot = {
  note: string
  timeDraft: TimeEntryDraft
  timeEntries: TimeEntry[]
  waitingDraft: TimeEntryDraft
  waitingEntries: WaitingEntry[]
  segmentMinutes: number
  scheduleAnchor: ScheduleAnchor
  feedbackRating: TaskFeedbackRating | ''
  feedbackTags: TaskFeedbackTag[]
  feedbackNote: string
}

const pendingAttachmentCache = new Map<string, PendingProgressAttachment[]>()
const stagedEntryIdCache = new Map<string, string>()

export function progressDraftKey(taskId: number, mode: ProgressRecordMode | undefined, editEntryId?: string) {
  return `giverny:task-progress-draft:${taskId}:${mode}:${editEntryId ?? 'new'}:v2`
}

export function readProgressDraft(key: string, fallback: ProgressDraftSnapshot) {
  return readMergedLocalCache(key, fallback)
}

export function writeProgressDraft(key: string, draft: ProgressDraftSnapshot) {
  writeJsonLocalCache(key, draft)
}

export function getPendingProgressAttachments(key: string) {
  return pendingAttachmentCache.get(key) ?? []
}

export function setPendingProgressAttachments(key: string, attachments: PendingProgressAttachment[]) {
  pendingAttachmentCache.set(key, attachments)
}

export function getOrCreateStagedProgressEntryId(key: string, editEntryId?: string) {
  if (editEntryId) {
    return editEntryId
  }
  const cached = stagedEntryIdCache.get(key)
  if (cached) {
    return cached
  }
  const created = crypto.randomUUID()
  stagedEntryIdCache.set(key, created)
  return created
}

export function clearProgressDraft(key: string) {
  removeLocalCache(key)
  pendingAttachmentCache.delete(key)
  stagedEntryIdCache.delete(key)
}
