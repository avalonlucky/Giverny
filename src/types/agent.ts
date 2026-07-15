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

export type AgentBackgroundTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export type AgentBackgroundTaskPhase = 'queued' | 'collecting' | 'analyzing' | 'completed' | 'failed' | 'cancelled'

export type AgentBackgroundTask = {
  id: string
  type: 'monthly_review'
  title: string
  month: string
  status: AgentBackgroundTaskStatus
  phase: AgentBackgroundTaskPhase
  progress: number
  result: string
  error: string
  createdAt: string
  updatedAt: string
  completedAt: string
}
