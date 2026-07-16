export type AgentApprovalStatus = 'pending' | 'processing' | 'executed' | 'cancelled' | 'failed' | 'expired'

export type AgentApproval = {
  id: string
  action: string
  label: string
  draft: Record<string, unknown>
  warnings: string[]
  status: AgentApprovalStatus
  createdAt: number
  expiresAt: number
  error?: string
  result?: {
    taskId?: number
    taskTitle?: string
  }
}

export type AgentTaskCandidate = {
  id: number
  title: string
  type: string
  status: string
  startDate: string
  settlementMonth: string
}

export type AgentTaskSelection = {
  id: string
  kind: 'task'
  prompt: string
  candidates: AgentTaskCandidate[]
}

export type AgentResultAttachment = {
  id: number
  taskId: number
  taskTitle: string
  name: string
  type: string
  mimeType: string
  size: string
  scope: 'progress' | 'acceptance'
  tag: string
  uploadedAt: string
  previewUrl?: string
  sourceUrl: string
}

export type AgentBackgroundTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export type AgentBackgroundTaskPhase = 'queued' | 'collecting' | 'analyzing' | 'completed' | 'failed' | 'cancelled'

export type AgentBackgroundTaskType =
  | 'monthly_review'
  | 'weekly_digest'
  | 'risk_digest'
  | 'cross_task_analysis'
  | 'batch_attachment_analysis'
  | 'trend_analysis'

export type AgentBackgroundTask = {
  id: string
  type: AgentBackgroundTaskType
  title: string
  month: string
  query: string
  source: 'manual' | 'scheduled'
  unread: boolean
  status: AgentBackgroundTaskStatus
  phase: AgentBackgroundTaskPhase
  progress: number
  result: string
  error: string
  createdAt: string
  updatedAt: string
  completedAt: string
}

export type AgentConversationMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  trace?: string[]
  approval?: AgentApproval
  selection?: AgentTaskSelection
  backgroundTask?: AgentBackgroundTask
  attachments?: AgentResultAttachment[]
  createdAt: number
}

export type AgentConversationSummary = {
  id: string
  title: string
  lastMessagePreview: string
  messageCount: number
  createdAt: string
  updatedAt: string
}
