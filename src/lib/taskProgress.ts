import type { Task } from '../types/domain'

export function snapProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value / 20) * 20))
}

export function isTaskStarted(task: Pick<Task, 'status'>) {
  return task.status !== '计划中'
}

export function hasAcceptanceProgress(task: Pick<Task, 'timeEntries'>) {
  return (task.timeEntries ?? []).some((entry) => entry.isAcceptanceProgress)
}

export function canRecordNewProgress(task: Pick<Task, 'status' | 'timeEntries'>) {
  return task.status !== '已验收' && !hasAcceptanceProgress(task)
}

export function taskDisplayProgress(task: Pick<Task, 'status' | 'progress' | 'timeEntries'>) {
  // 已验收即任务闭环，整体进度恒为 100%（兜底历史数据中状态已验收但 progress 未到 100 的情况）
  if (task.status === '已验收' || hasAcceptanceProgress(task)) {
    return 100
  }
  return isTaskStarted(task) ? snapProgress(task.progress) : 0
}
