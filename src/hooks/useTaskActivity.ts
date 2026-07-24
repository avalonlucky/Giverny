import { useCallback, useRef, useState } from 'react'
import { api, type ActivityItem } from '../lib/api'

export function useTaskActivity() {
  const [taskActivity, setTaskActivity] = useState<ActivityItem[]>([])
  const requestRef = useRef(0)

  const loadTaskActivity = useCallback(async (taskId: number) => {
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    try {
      const result = await api.getTaskActivity(taskId)
      if (requestRef.current === requestId) setTaskActivity(result.items)
    } catch {
      if (requestRef.current === requestId) setTaskActivity([])
    }
  }, [])

  return { taskActivity, loadTaskActivity }
}
