export type TaskStatus = '计划中' | '进行中' | '挂起' | '待验收' | '已验收' | '终止' | '不计费'

export type AppView = '工作台' | '任务' | '文件库' | '收入' | '结算' | '甲方查看' | '设置'

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
