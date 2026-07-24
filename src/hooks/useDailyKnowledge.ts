import { useCallback, useEffect, useRef, useState } from 'react'
import { dailyKnowledgePool } from '../data/dailyKnowledgePool'
import { api, type DailyKnowledgeSuggestion } from '../lib/api'
import {
  DAILY_KNOWLEDGE_QUEUE_SIZE,
  readDailyKnowledgeHistory,
  rememberDailyKnowledgeTitle,
  writeStoredDailyKnowledgeItem,
  writeStoredDailyKnowledgeQueue,
} from '../lib/dailyKnowledgeCache'
import { createDailyKnowledgeCatalog } from '../lib/dailyKnowledgeCatalog'
import type { Task } from '../types/domain'
import type { DailyKnowledgeItem } from '../types/knowledge'

const {
  fallbackDailyKnowledge,
  fallbackDailyKnowledgeBatch,
  mergeDailyKnowledgeQueue,
  prepareDailyKnowledgeSession,
} = createDailyKnowledgeCatalog(dailyKnowledgePool)

export function useDailyKnowledge({
  isAdmin,
  isLoaded,
  currentMonthValue,
  activeMonthTasks,
}: {
  isAdmin: boolean
  isLoaded: boolean
  currentMonthValue: string
  activeMonthTasks: Task[]
}) {
  const [session] = useState(() => prepareDailyKnowledgeSession())
  const [dailyKnowledge, setDailyKnowledge] = useState<DailyKnowledgeItem>(session.current)
  const [dailyKnowledgeQueue, setDailyKnowledgeQueue] = useState<DailyKnowledgeItem[]>(session.queue)
  const [isDailyKnowledgeLoading, setIsDailyKnowledgeLoading] = useState(false)
  const [isDailyKnowledgePrefetching, setIsDailyKnowledgePrefetching] = useState(false)
  const requestedRef = useRef(false)
  const dailyKnowledgeRef = useRef(dailyKnowledge)
  const queueRef = useRef(dailyKnowledgeQueue)
  const prefetchRef = useRef(false)

  useEffect(() => {
    dailyKnowledgeRef.current = dailyKnowledge
    writeStoredDailyKnowledgeItem(dailyKnowledge)
    rememberDailyKnowledgeTitle(dailyKnowledge.title)
  }, [dailyKnowledge])

  useEffect(() => {
    queueRef.current = dailyKnowledgeQueue
    writeStoredDailyKnowledgeQueue(dailyKnowledgeQueue)
  }, [dailyKnowledgeQueue])

  const seedQueue = useCallback((baseQueue: DailyKnowledgeItem[] = queueRef.current) => {
    const history = readDailyKnowledgeHistory()
    const currentTitle = dailyKnowledgeRef.current.title
    const excluded = [currentTitle, ...history]
    const merged = mergeDailyKnowledgeQueue(baseQueue, excluded)
    const missingCount = DAILY_KNOWLEDGE_QUEUE_SIZE - merged.length
    const filled = missingCount > 0
      ? mergeDailyKnowledgeQueue(
        [...merged, ...fallbackDailyKnowledgeBatch(missingCount, [...excluded, ...merged.map((item) => item.title)])],
        excluded,
      )
      : merged
    const nextQueue = filled.slice(0, DAILY_KNOWLEDGE_QUEUE_SIZE)
    queueRef.current = nextQueue
    setDailyKnowledgeQueue(nextQueue)
    return nextQueue
  }, [])

  const fetchItem = useCallback(async (extraTitles: string[] = []) => {
    const taskThemes = activeMonthTasks.flatMap((task) => [task.type, task.title]).filter(Boolean).slice(0, 12)
    const recentTitles = [
      ...readDailyKnowledgeHistory(),
      dailyKnowledgeRef.current.title,
      ...queueRef.current.map((item) => item.title),
      ...extraTitles,
    ].filter(Boolean)
    const attemptedTitles = new Set(recentTitles)
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const suggestion: DailyKnowledgeSuggestion = await api.suggestDailyKnowledge({
        currentMonth: currentMonthValue,
        taskThemes,
        recentTitles: [...attemptedTitles],
      })
      if (suggestion.title && !attemptedTitles.has(suggestion.title)) return suggestion
      if (suggestion.title) attemptedTitles.add(suggestion.title)
    }
    return null
  }, [activeMonthTasks, currentMonthValue])

  const prefetchQueue = useCallback(async () => {
    if (!isAdmin || prefetchRef.current) return
    prefetchRef.current = true
    setIsDailyKnowledgePrefetching(true)
    try {
      const fetchedItems: DailyKnowledgeItem[] = []
      const fetchTargetCount = Math.min(3, DAILY_KNOWLEDGE_QUEUE_SIZE)
      for (let index = 0; index < fetchTargetCount; index += 1) {
        const nextItem = await fetchItem(fetchedItems.map((item) => item.title))
        if (!nextItem) break
        fetchedItems.push(nextItem)
        const nextQueue = mergeDailyKnowledgeQueue(
          [nextItem, ...queueRef.current],
          [dailyKnowledgeRef.current.title],
        ).slice(0, DAILY_KNOWLEDGE_QUEUE_SIZE)
        queueRef.current = nextQueue
        setDailyKnowledgeQueue(nextQueue)
      }
    } catch {
      seedQueue()
    } finally {
      seedQueue()
      prefetchRef.current = false
      setIsDailyKnowledgePrefetching(false)
    }
  }, [fetchItem, isAdmin, seedQueue])

  const showNextDailyKnowledge = useCallback(async () => {
    const [nextItem, ...remainingQueue] = queueRef.current
    if (nextItem) {
      dailyKnowledgeRef.current = nextItem
      setDailyKnowledge(nextItem)
      rememberDailyKnowledgeTitle(nextItem.title)
      seedQueue(remainingQueue)
      void prefetchQueue()
      return
    }
    if (isDailyKnowledgeLoading) return
    setIsDailyKnowledgeLoading(true)
    try {
      const excludedTitles = [
        dailyKnowledgeRef.current.title,
        ...readDailyKnowledgeHistory(),
        ...queueRef.current.map((item) => item.title),
      ]
      const fetchedItem = await fetchItem()
      const nextItemValue = fetchedItem ?? fallbackDailyKnowledge(excludedTitles)
      dailyKnowledgeRef.current = nextItemValue
      setDailyKnowledge(nextItemValue)
      rememberDailyKnowledgeTitle(nextItemValue.title)
    } catch {
      const fallback = fallbackDailyKnowledge([
        dailyKnowledgeRef.current.title,
        ...readDailyKnowledgeHistory(),
        ...queueRef.current.map((item) => item.title),
      ])
      dailyKnowledgeRef.current = fallback
      setDailyKnowledge(fallback)
      rememberDailyKnowledgeTitle(fallback.title)
    } finally {
      setIsDailyKnowledgeLoading(false)
      seedQueue()
      void prefetchQueue()
    }
  }, [fetchItem, isDailyKnowledgeLoading, prefetchQueue, seedQueue])

  useEffect(() => {
    if (!isLoaded || !isAdmin || requestedRef.current) return
    requestedRef.current = true
    seedQueue()
    void prefetchQueue()
  }, [isAdmin, isLoaded, prefetchQueue, seedQueue])

  return {
    dailyKnowledge,
    dailyKnowledgeQueueLength: dailyKnowledgeQueue.length,
    isDailyKnowledgeLoading,
    isDailyKnowledgePrefetching,
    showNextDailyKnowledge,
  }
}
