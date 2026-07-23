import type { DailyKnowledgeItem } from '../types/knowledge'
import {
  DAILY_KNOWLEDGE_QUEUE_SIZE,
  readDailyKnowledgeHistory,
  readStoredDailyKnowledgeItem,
  readStoredDailyKnowledgeQueue,
} from './dailyKnowledgeCache'

export function createDailyKnowledgeCatalog(pool: DailyKnowledgeItem[]) {
  const fallbackDailyKnowledge = (excludedTitles: string | string[] = '') => {
    const excludedList = Array.isArray(excludedTitles) ? excludedTitles.filter(Boolean) : [excludedTitles].filter(Boolean)
    const excluded = new Set(excludedList)
    const candidates = pool.filter((item) => !excluded.has(item.title))
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)]
    }
    const history = readDailyKnowledgeHistory()
    const currentTitle = excludedList[0] ?? ''
    const leastRecent = pool
      .filter((item) => item.title !== currentTitle)
      .sort((left, right) => history.indexOf(left.title) - history.indexOf(right.title))
    const candidatePool = leastRecent.length > 0
      ? leastRecent.slice(0, Math.max(1, Math.ceil(leastRecent.length / 3)))
      : pool
    return candidatePool[Math.floor(Math.random() * candidatePool.length)]
  }

  const fallbackDailyKnowledgeBatch = (count: number, excludedTitles: string[] = []) => {
    const items: DailyKnowledgeItem[] = []
    const excluded = new Set(excludedTitles)
    let attempts = 0
    while (items.length < count && attempts < pool.length * 3) {
      attempts += 1
      const next = fallbackDailyKnowledge([...excluded])
      if (excluded.has(next.title)) {
        break
      }
      items.push(next)
      excluded.add(next.title)
    }
    return items
  }

  const mergeDailyKnowledgeQueue = (items: DailyKnowledgeItem[], excludedTitles: string[] = []) => {
    const excluded = new Set(excludedTitles)
    const seen = new Set<string>()
    return items.filter((item) => {
      if (!item.title || excluded.has(item.title) || seen.has(item.title)) {
        return false
      }
      seen.add(item.title)
      return true
    })
  }

  const prepareDailyKnowledgeSession = () => {
    const history = readDailyKnowledgeHistory()
    const storedCurrent = readStoredDailyKnowledgeItem()
    const storedQueue = mergeDailyKnowledgeQueue(readStoredDailyKnowledgeQueue(), [storedCurrent?.title ?? '', ...history])
    const [queuedCurrent, ...remainingQueue] = storedQueue
    if (queuedCurrent) {
      return { current: queuedCurrent, queue: remainingQueue }
    }
    const current = fallbackDailyKnowledge([storedCurrent?.title ?? '', ...history])
    return {
      current,
      queue: fallbackDailyKnowledgeBatch(DAILY_KNOWLEDGE_QUEUE_SIZE, [current.title, storedCurrent?.title ?? '', ...history]),
    }
  }

  return {
    fallbackDailyKnowledge,
    fallbackDailyKnowledgeBatch,
    mergeDailyKnowledgeQueue,
    prepareDailyKnowledgeSession,
  }
}
