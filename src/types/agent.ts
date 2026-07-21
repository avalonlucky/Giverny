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

export type AgentPlanStep = {
  id: string
  label: string
  action: string
  status: 'pending' | 'completed' | 'skipped'
  completedAt?: string
}

export type AgentTaskPlan = {
  id: string
  conversationId?: string
  taskId?: number
  kind: 'goal' | 'reminder'
  goal: string
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  steps: AgentPlanStep[]
  currentStep: number
  nextActionAt?: string
  unread: boolean
  createdAt: string
  updatedAt: string
  completedAt?: string
  pausedAt?: string
}

export type AgentTaskMemory = {
  taskId: number
  taskTitle: string
  summary: string
  openItems: string[]
  preferences: string[]
  userNotes: string[]
  ignoredItems: string[]
  disabled: boolean
  reviewedAt?: string
  updatedAt: string
}

export type AgentFailureCase = {
  fingerprint: string
  category: string
  intent: string
  toolName?: string
  httpStatus: number
  occurrences: number
  regressionStatus: 'candidate' | 'required' | 'covered' | 'ignored'
  resolutionNote: string
  firstSeenAt: string
  lastSeenAt: string
  updatedAt: string
}

export type {
  AgentEvidence,
  AgentIntent,
  AgentPlannedToolCall,
  AgentRiskLevel,
  AgentTurn,
  AgentTurnPhase,
  AgentVerification,
} from '../agentOrchestrator'
export type { AgentPrincipalContext, AgentPrincipalRole } from '../agentScope'
