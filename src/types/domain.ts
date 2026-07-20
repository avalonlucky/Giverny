export type TaskStatus = '计划中' | '进行中' | '挂起' | '待验收' | '已验收' | '终止' | '不计费'

export type AppView = '工作台' | '任务' | '文件库' | '洞察' | '收入' | '结算' | '设置' | '知识库'

export type TaskFilter = '全部' | '计划中' | '进行中' | '挂起' | '待验收' | '已验收' | '终止'

export type TaskViewMode = '列表' | '日历'

export type TaxMode = 'salary' | 'labor'

export type TaskFeedbackRating = '顺利' | '一般' | '有问题'
export type TaskFeedbackTag = '需求不清晰' | '沟通成本高' | '定价偏低' | '技术挑战大'

export type Task = {
  id: number
  date: string
  estimatedDate: string
  actualDeliveryDate?: string
  settlementMonth?: string
  isSupplemental?: boolean
  type: string
  title: string
  requirement: string
  requester?: string
  contact: string
  reviewer: string
  stage: string
  estimatedHours: number
  /** 新建任务时关联本次 AI 工时建议，用于后续对照最终实际工时；不作为任务业务字段展示。 */
  hourEstimateSuggestionId?: string
  actualHours: number
  status: TaskStatus
  progress: number
  /** 是否计费。独立于状态、持久保存：不计费任务即便走完整验收流程也始终不计费 */
  billable?: boolean
  suspendReason?: string
  terminateReason?: string
  supplementalNote?: string
  acceptanceNote?: string
  feedbackRating?: TaskFeedbackRating | ''
  feedbackTags?: TaskFeedbackTag[]
  feedbackNote?: string
  acceptanceFiles?: string[]
  timeEntries?: TimeEntry[]
  waitingEntries?: WaitingEntry[]
  voidedAt?: string
  voidReason?: string
  files: string[]
}

export type TimeEntry = {
  id: string
  date?: string
  endDate?: string
  start: string
  end: string
  note?: string
  isAcceptanceProgress?: boolean
  /** 本段是否为「改稿轮次」。仅用于需求人画像/AI 分析，不影响计时与结算。
   *  显式开关判定，避免把「任务分阶段提交」误判为改稿。 */
  isRevision?: boolean
  /** 本段是否「不计工时」：时间仍可自选（用于记录与排序），但计 0 工时、不进结算。 */
  isUncounted?: boolean
  /** 本段是否为合作伙伴反馈 / 修改意见节点：用于记录 B01/B02 等版本反馈，不计工时但进入任务生命周期。 */
  isClientFeedback?: boolean
  feedbackVersion?: string
  feedbackSource?: string
  /** 同一次「记录进展」提交的多段工时共享同一 groupId，用于右侧面板合并展示。 */
  groupId?: string
}

export type WaitingReason = '等待合作伙伴意见' | '等待补充资料' | '等待排期' | '其他'

export type WaitingEntry = TimeEntry & {
  reason?: WaitingReason
}

export type FileAsset = {
  id: number
  taskId: number
  entryId?: string
  scope: 'progress' | 'acceptance'
  name: string
  task: string
  type: string
  mimeType?: string
  size: string
  uploadedAt: string
  final: boolean
  visible: boolean
  tag?: string
  deletedAt?: string
  previewUrl?: string
  previewFallback?: boolean
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
