import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentBackgroundTask } from '../types/agent'
import type { ToastState } from '../lib/toastQueue'

type Notify = (
  message: string,
  tone?: ToastState['tone'],
  options?: Pick<ToastState, 'actionLabel' | 'onAction' | 'durationMs'>,
) => void

export function useAgentJobNotifications({
  isAdmin,
  notify,
  onOpenJob,
}: {
  isAdmin: boolean
  notify: Notify
  onOpenJob: (jobId: string) => void
}) {
  const [topAnalysisJobs, setTopAnalysisJobs] = useState<AgentBackgroundTask[]>([])
  const statusesRef = useRef<Map<string, AgentBackgroundTask['status']>>(new Map())
  const initializedRef = useRef(false)
  const notifiedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!isAdmin) {
      statusesRef.current.clear()
      notifiedRef.current.clear()
      initializedRef.current = false
      return
    }
    let cancelled = false
    const poll = async () => {
      const response = await fetch('/api/ai/analysis-jobs?limit=20')
      const data = await response.json().catch(() => null) as { jobs?: AgentBackgroundTask[] } | null
      if (!response.ok || cancelled || !Array.isArray(data?.jobs)) return
      setTopAnalysisJobs(data.jobs)
      const next = new Map(data.jobs.map((job) => [job.id, job.status]))
      if (!initializedRef.current) {
        data.jobs.forEach((job) => {
          if (job.unread && (job.status === 'completed' || job.status === 'failed')) notifiedRef.current.add(job.id)
        })
        statusesRef.current = next
        initializedRef.current = true
        return
      }
      for (const job of data.jobs) {
        const shouldNotify = job.unread && !notifiedRef.current.has(job.id)
        const previous = statusesRef.current.get(job.id)
        if (shouldNotify && job.status === 'completed' && previous && previous !== job.status) {
          notifiedRef.current.add(job.id)
          if (job.source === 'scheduled' && (job.type === 'risk_digest' || job.type === 'monthly_review')) continue
          notify(`${job.title}已完成`, 'success', {
            actionLabel: '查看结果',
            durationMs: 7200,
            onAction: () => onOpenJob(job.id),
          })
        }
        if (shouldNotify && job.status === 'failed' && previous && previous !== job.status) {
          notifiedRef.current.add(job.id)
          notify(`${job.title}失败，可在对话中重试`, 'error', {
            actionLabel: '打开爱丽丝',
            durationMs: 7200,
            onAction: () => onOpenJob(job.id),
          })
        }
      }
      statusesRef.current = next
      initializedRef.current = true
    }
    void poll()
    const timer = window.setInterval(() => void poll(), 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [isAdmin, notify, onOpenJob])

  const markAnalysisJobRead = useCallback((jobId: string) => {
    setTopAnalysisJobs((current) => current.map((job) => job.id === jobId ? { ...job, unread: false } : job))
    void fetch(`/api/ai/analysis-jobs/${encodeURIComponent(jobId)}/read`, { method: 'POST' }).catch(() => undefined)
  }, [])

  return { topAnalysisJobs, markAnalysisJobRead }
}
