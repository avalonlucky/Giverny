export type AgentRegressionCatalogEntry = {
  id: string
  category: string
  intent: string
  toolName: string
  httpStatus: number
  conversationCaseId: string
  description: string
}

export const agentRegressionCatalog: AgentRegressionCatalogEntry[] = [
  {
    id: 'failure-tool-task-detail',
    category: 'tool_execution',
    intent: 'task_detail',
    toolName: 'get_task_detail',
    httpStatus: 500,
    conversationCaseId: 'workflow-01',
    description: '任务详情工具失败后不得编造任务状态或等待原因。',
  },
  {
    id: 'failure-runtime-general',
    category: 'runtime_or_model',
    intent: 'general_chat',
    toolName: '',
    httpStatus: 503,
    conversationCaseId: 'workflow-07',
    description: '模型运行时不可用时必须明确失败，不得返回伪造答案。',
  },
  {
    id: 'failure-authorization-task',
    category: 'authorization',
    intent: 'task_detail',
    toolName: 'get_task_detail',
    httpStatus: 403,
    conversationCaseId: 'workflow-08',
    description: '任务上下文不能跨越工作区或角色权限边界。',
  },
  {
    id: 'failure-stale-confirmation',
    category: 'conflict_or_expired_confirmation',
    intent: 'write_update_task_fields',
    toolName: 'update_task_fields',
    httpStatus: 409,
    conversationCaseId: 'workflow-03',
    description: '确认期间草稿或任务发生变化时必须拒绝旧凭证。',
  },
  {
    id: 'failure-workflow-write',
    category: 'workflow_write',
    intent: 'write_append_progress',
    toolName: 'append_progress',
    httpStatus: 500,
    conversationCaseId: 'workflow-02',
    description: 'Workflow 写入失败后不得推进计划或宣称完成。',
  },
  {
    id: 'failure-attachment-evidence',
    category: 'tool_execution',
    intent: 'attachment_search',
    toolName: 'inspect_attachment_evidence',
    httpStatus: 500,
    conversationCaseId: 'workflow-04',
    description: '附件证据读取失败时不得根据文件名猜测内容。',
  },
  {
    id: 'failure-finance-tool',
    category: 'tool_execution',
    intent: 'month_finance',
    toolName: 'query_month_finance',
    httpStatus: 500,
    conversationCaseId: 'workflow-05',
    description: '财务工具失败时不得估算金额、工时或结算结果。',
  },
  {
    id: 'failure-formal-deliverable',
    category: 'tool_execution',
    intent: 'write_generate_formal_deliverable',
    toolName: 'generate_formal_deliverable',
    httpStatus: 409,
    conversationCaseId: 'workflow-06',
    description: '正式交付物来源变化时必须拒绝过期快照。',
  },
]

export function regressionCaseForFailure(input: {
  category: string
  intent: string
  toolName?: string | null
  httpStatus: number
}) {
  return agentRegressionCatalog.find((entry) => (
    entry.category === input.category
    && entry.intent === input.intent
    && entry.toolName === String(input.toolName || '')
    && entry.httpStatus === Number(input.httpStatus)
  ))
}
