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
