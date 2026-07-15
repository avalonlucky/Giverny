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
}
