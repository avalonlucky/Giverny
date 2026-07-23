import type { DailyKnowledgeItem } from '../types/knowledge'
import { writeJsonLocalCache } from './localCache'

const DAILY_KNOWLEDGE_HISTORY_KEY = 'giverny-daily-knowledge-history-v1'
const DAILY_KNOWLEDGE_CURRENT_KEY = 'giverny-daily-knowledge-current-v1'
const DAILY_KNOWLEDGE_QUEUE_KEY = 'giverny-daily-knowledge-queue-v1'

export const DAILY_KNOWLEDGE_QUEUE_SIZE = 10

function isDailyKnowledgeItem(value: unknown): value is DailyKnowledgeItem {
  const item = value as Partial<DailyKnowledgeItem> | null
  return Boolean(
    item
    && typeof item.category === 'string'
    && typeof item.source === 'string'
    && typeof item.title === 'string'
    && typeof item.teaser === 'string'
    && Array.isArray(item.body)
    && item.body.length > 0,
  )
}

export function readDailyKnowledgeHistory() {
  if (typeof window === 'undefined') {
    return []
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DAILY_KNOWLEDGE_HISTORY_KEY) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
  } catch {
    return []
  }
}

export function rememberDailyKnowledgeTitle(title: string) {
  const history = readDailyKnowledgeHistory().filter((item) => item !== title)
  writeJsonLocalCache(DAILY_KNOWLEDGE_HISTORY_KEY, [...history, title].slice(-80))
}

export function readStoredDailyKnowledgeItem() {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DAILY_KNOWLEDGE_CURRENT_KEY) ?? 'null') as unknown
    return isDailyKnowledgeItem(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeStoredDailyKnowledgeItem(item: DailyKnowledgeItem) {
  try {
    writeJsonLocalCache(DAILY_KNOWLEDGE_CURRENT_KEY, item)
  } catch {
    // Best-effort cache: losing it only affects knowledge-card variety after refresh.
  }
}

export function readStoredDailyKnowledgeQueue() {
  if (typeof window === 'undefined') {
    return []
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DAILY_KNOWLEDGE_QUEUE_KEY) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter(isDailyKnowledgeItem) : []
  } catch {
    return []
  }
}

export function writeStoredDailyKnowledgeQueue(items: DailyKnowledgeItem[]) {
  try {
    writeJsonLocalCache(DAILY_KNOWLEDGE_QUEUE_KEY, items.slice(0, DAILY_KNOWLEDGE_QUEUE_SIZE))
  } catch {
    // Best-effort cache only.
  }
}
