import type { AgentExecutionPlanStatus, AgentExecutionStep } from '../agentExecutionEngine'

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
  id: number | string
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
  downloadUrl?: string
  shareUrl?: string
  kind?: 'task-file' | 'settlement-receipt' | 'formal-deliverable'
}

export type AgentUploadHandoff = {
  taskId: number
  taskTitle: string
  scope: 'progress' | 'acceptance'
  files: Array<{ name: string; size: number; mimeType?: string }>
  maxFileSize: number
  maxFiles: number
  uploadEndpoint: string
  transport: 'authenticated-browser-to-r2'
  apiKeyExposed: false
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
  uploadHandoff?: AgentUploadHandoff
  createdAt: number
}

export type AgentConversationSummary = {
  id: string
  title: string
  lastMessagePreview: string
  messageCount: number
  createdAt: string
  updatedAt: string
  projectId?: string
  projectName?: string
}

export type AgentPlanStep = AgentExecutionStep

export type AgentTaskPlan = {
  id: string
  conversationId?: string
  taskId?: number
  kind: 'goal' | 'reminder'
  goal: string
  status: AgentExecutionPlanStatus
  steps: AgentPlanStep[]
  currentStep: number
  executionMode: 'guided' | 'batch'
  failurePolicy: 'stop'
  revision: number
  nextActionAt?: string
  unread: boolean
  createdAt: string
  updatedAt: string
  completedAt?: string
  pausedAt?: string
  approvedAt?: string
  failedAt?: string
  error?: string
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

export type AgentEnterpriseMemoryScope = 'organization' | 'partner' | 'project'
export type AgentEnterpriseMemoryType = 'fact' | 'preference' | 'rule' | 'decision'
export type AgentEnterpriseMemoryStatus = 'active' | 'superseded' | 'expired' | 'deleted'

export type AgentEnterpriseMemory = {
  id: string
  scopeType: AgentEnterpriseMemoryScope
  scopeKey: string
  memoryType: AgentEnterpriseMemoryType
  title: string
  content: string
  sourceType: 'manual' | 'task' | 'conversation' | 'document' | 'system'
  sourceRef: string
  sourceLabel: string
  sourceExcerpt: string
  confidence: 'confirmed' | 'derived'
  status: AgentEnterpriseMemoryStatus
  version: number
  supersedesId?: string
  validFrom: string
  expiresAt?: string
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

export type AgentEnterpriseMemorySummary = {
  active: number
  organization: number
  partner: number
  project: number
  expiringSoon: number
  corrected: number
}

export type AgentProactiveItem = {
  id: string
  taskId: number
  taskTitle: string
  signalType: 'overdue' | 'due_soon' | 'ready_for_acceptance' | 'hours_overrun' | 'waiting_blocked' | 'acceptance_note_missing'
  priority: 'critical' | 'high' | 'medium' | 'low'
  title: string
  evidence: string[]
  recommendation: string
  suggestedPrompt: string
  status: 'open' | 'snoozed' | 'resolved' | 'dismissed'
  unread: boolean
  detectedAt: string
  lastSeenAt: string
  snoozedUntil?: string
  handledAt?: string
  resolution?: 'resolved' | 'dismissed' | 'auto_resolved'
  resolutionNote?: string
}

export type AgentProactiveSummary = {
  open: number
  critical: number
  high: number
  resolved: number
  dismissed: number
  autoResolved: number
  handledTotal: number
  resolutionRate: number
  dismissalRate: number
  averageResponseMinutes: number
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
