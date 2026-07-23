import type { Task } from './domain'

export type TaskUpdateChanges = Partial<Task> & {
  allowAcceptedTimeEdit?: boolean
  allowAcceptanceRollback?: boolean
  startFromProgress?: boolean
}

export type ProgressRecordMode = 'progress' | 'waiting' | 'feedback'

export type TaskContextInsight = {
  tone: 'warning' | 'info'
  label: string
  detail: string
  evidence: string
}
