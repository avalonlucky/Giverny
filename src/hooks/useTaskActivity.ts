import { useCallback, useRef } from 'react'
import { api } from '../lib/api'
import { useTaskRuntimeStore } from '../stores/taskRuntimeStore'
import { useShallow } from 'zustand/react/shallow'

export function useTaskActivity() {
  const { taskActivity, setTaskActivity } = useTaskRuntimeStore(useShallow((state) => ({
    taskActivity: state.taskActivity,
    setTaskActivity: state.setTaskActivity,
  })))
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
  }, [setTaskActivity])

  return { taskActivity, loadTaskActivity }
}
