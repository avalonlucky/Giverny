export type TaskStatus = '计划中' | '进行中' | '挂起' | '待验收' | '已验收' | '终止' | '不计费'

export type AppView = '工作台' | '任务' | '文件库' | '洞察' | '收入' | '结算' | '甲方查看' | '设置'

export type TaskFilter = '全部' | '计划中' | '进行中' | '挂起' | '待验收' | '已验收' | '终止'

export type TaskViewMode = '列表' | '日历'

export type TaxMode = 'salary' | 'labor'

export type Task = {
  id: number
  date: string
  estimatedDate: string
  settlementMonth?: string
  type: string
  title: string
  requirement: string
  requester?: string
  contact: string
  reviewer: string
  stage: string
  estimatedHours: number
  actualHours: number
  status: TaskStatus
  progress: number
  suspendReason?: string
  terminateReason?: string
  acceptanceNote?: string
  acceptanceFiles?: string[]
  timeEntries?: TimeEntry[]
  voidedAt?: string
  voidReason?: string
  files: string[]
}

export type TimeEntry = {
  id: string
  start: string
  end: string
  note?: string
}

export type FileAsset = {
  id: number
  taskId: number
  name: string
  task: string
  type: string
  size: string
  uploadedAt: string
  final: boolean
  visible: boolean
  tag?: string
  previewUrl?: string
  sourceUrl?: string
}

export type AttachmentAnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'unsupported'

export type AttachmentAnalysis = {
  attachmentId: number
  taskId: number
  fileName: string
  fileType: string
  status: AttachmentAnalysisStatus
  attemptCount: number
  parserKind: string
  provider: string
  model: string
  summary: string
  contentType: string
  extractedText: string
  findings: string[]
  qualityIssues: string[]
  requirementMatches: string[]
  risks: string[]
  suggestions: string[]
  confidence: '低' | '中' | '高' | ''
  errorMessage: string
  requestedAt: string
  completedAt: string
}

export type InsightPeriodType = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year'

export type InsightDiagnosis = {
  periodKey: string
  periodType: InsightPeriodType
  status: 'anomalies' | 'clear'
  generatedAt: string
  comparedWith: string
  insights: Array<{
    key: string
    signal: string
    evidence: string
    action: string
    state: 'new' | 'persisting' | 'improved'
  }>
  dataNotes: string[]
}

export type InsightHistoryStatus = 'open' | 'improved' | 'resolved' | 'ignored'

export type InsightHistoryItem = {
  id: string
  generatedAt: string
  insightType: 'efficiency' | 'pricing' | 'gap' | 'client'
  finding: string
  recommendation: string
  dataSnapshot: Record<string, unknown>
  status: InsightHistoryStatus
  triggerKey: string
}

export type TaskUpdate = {
  id: number
  taskId: number
  date: string
  title: string
  body: string
  hours: number
  visible: boolean
  files: string[]
}
