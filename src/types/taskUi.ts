import type { Task } from './domain'
import type { FileAsset } from './domain'
import type { AttachmentNameSuggestion } from '../lib/api'

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

export type PendingProgressAttachment = {
  id: string
  file: File
  name: string
  originalName: string
  aiSuggestion?: AttachmentNameSuggestion
  aiLoading?: boolean
  aiError?: string
  uploadStatus?: 'uploading' | 'done' | 'error'
  uploadProgress?: number
  uploadedFile?: FileAsset
  uploadPromise?: Promise<FileAsset | undefined>
  uploadError?: string
  uploadScope?: 'acceptance' | 'progress'
  discarded?: boolean
  isAcceptanceFile?: boolean
  previewFile?: File
  optimizedFile?: File
  preparationPromise?: Promise<{ uploadFile: File; previewFile?: File }>
}
