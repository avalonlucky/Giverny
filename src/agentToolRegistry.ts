import { z } from 'zod'
import type { AgentPrincipalRole } from './agentScope'

export type AgentCapabilityRisk = 'read' | 'write' | 'sensitive'
export type AgentCapabilityConfirmation = 'none' | 'preview' | 'signed-execute' | 'system-only'
export type AgentCapabilitySource = 'd1' | 'r2' | 'product_registry' | 'workflow'
export type AgentCapabilityExposure = 'model' | 'mcp' | 'api' | 'workflow'

export type AgentCapabilityDefinition = {
  title: string
  description: string
  category: 'finance' | 'tasks' | 'files' | 'product' | 'planning' | 'memory' | 'analysis' | 'write' | 'internal'
  endpoint: string
  methods: readonly ('GET' | 'POST')[]
  inputSchema: z.ZodType
  policy: {
    risk: AgentCapabilityRisk
    deterministic: boolean
    source: AgentCapabilitySource
    scopes: readonly string[]
    roles: readonly AgentPrincipalRole[]
    confirmation: AgentCapabilityConfirmation
    audit: 'turn' | 'business' | 'workflow'
    auditEvent: string
  }
  exposure: readonly AgentCapabilityExposure[]
  trace: { running: string; completed: string }
  taskScoped?: boolean
  previewFor?: string
  executeWith?: string
}

const allRoles = ['admin', 'collaborator', 'viewer', 'client', 'guest', 'mcp-read', 'system'] as const
const businessReadRoles = ['admin', 'collaborator', 'viewer', 'client', 'mcp-read', 'system'] as const
const financeReadRoles = ['admin', 'collaborator', 'viewer', 'mcp-read', 'system'] as const
const writeRoles = ['admin', 'collaborator', 'system'] as const
const systemRoles = ['system'] as const
const confirmationInputSchema = z.object({ confirmationToken: z.string().min(1) })
const taskReferenceSchema = {
  taskId: z.number().int().positive().optional(),
  taskTitle: z.string().optional(),
}

function defineCapability<const T extends AgentCapabilityDefinition>(definition: T) {
  return definition
}

function readCapability<const T extends Omit<AgentCapabilityDefinition, 'methods' | 'exposure'> & { methods?: readonly ('GET' | 'POST')[] }>(input: T) {
  return defineCapability({ ...input, methods: input.methods || ['GET', 'POST'], exposure: ['model', 'mcp', 'api'] })
}

function writePreviewCapability<const T extends Omit<AgentCapabilityDefinition, 'methods' | 'exposure'>>(input: T) {
  return defineCapability({ ...input, methods: ['POST'], exposure: ['model', 'api'] })
}

function writeExecuteCapability<const T extends Omit<AgentCapabilityDefinition, 'methods' | 'exposure' | 'inputSchema'>>(input: T) {
  return defineCapability({ ...input, methods: ['POST'], inputSchema: confirmationInputSchema, exposure: ['api', 'workflow'] })
}

export const agentCapabilityRegistry = {
  query_month_finance: readCapability({
    title: '查询月份财务', description: '查询真实的月份收入、工时、计费与结算统计。', category: 'finance', endpoint: 'month-finance',
    policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['finance:read'], roles: financeReadRoles, confirmation: 'none', audit: 'turn', auditEvent: 'agent_read_finance' },
    inputSchema: z.object({ question: z.string(), currentMonth: z.string().optional(), months: z.string().optional() }),
    trace: { running: '核对月份工时与收入', completed: '月份统计已返回' },
  }),
  search_tasks: readCapability({
    title: '搜索任务', description: '按月份、状态意图、任务名、需求或人员搜索任务。月份问题必须传 month。', category: 'tasks', endpoint: 'search-tasks',
    policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['tasks:read'], roles: businessReadRoles, confirmation: 'none', audit: 'turn', auditEvent: 'agent_search_tasks' },
    inputSchema: z.object({ query: z.string(), month: z.string().optional(), limit: z.number().int().min(1).max(50).default(30) }),
    trace: { running: '检索相关任务', completed: '任务检索已完成' },
  }),
  query_task_portfolio: readCapability({
    title: '查询跨任务工作概况', description: '按日期、状态、需求人、对接人和设计类型聚合当前工作区任务，确定性返回未完成、逾期、正在等待、最近进展和负责人。用户询问“哪些任务”、“全部延期”、“谁在等待什么”或跨项目工作概况时必须调用。', category: 'tasks', endpoint: 'task-portfolio',
    policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['tasks:read'], roles: businessReadRoles, confirmation: 'none', audit: 'turn', auditEvent: 'agent_query_portfolio' },
    inputSchema: z.object({ scope: z.enum(['all', 'unfinished', 'overdue', 'waiting', 'accepted']).default('all'), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), month: z.string().regex(/^\d{4}-\d{2}$/).optional(), statuses: z.array(z.string()).max(10).optional(), requester: z.string().max(80).optional(), contact: z.string().max(80).optional(), designType: z.string().max(80).optional(), limit: z.number().int().min(1).max(200).default(100) }),
    trace: { running: '汇总跨任务工作概况', completed: '工作概况已核对' },
  }),
  get_task_detail: readCapability({
    title: '读取任务详情', description: '按任务 ID 或近似标题读取任务详情、进展、附件与验收信息。', category: 'tasks', endpoint: 'task-detail', taskScoped: true,
    policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['tasks:read'], roles: businessReadRoles, confirmation: 'none', audit: 'turn', auditEvent: 'agent_get_task_detail' },
    inputSchema: z.object({ taskId: z.number().int().positive().optional(), title: z.string().optional() }),
    trace: { running: '读取任务详情', completed: '任务详情已返回' },
  }),
  get_requester_profile: readCapability({
    title: '读取需求人画像', description: '按需求人姓名读取当前工作区的全部历史任务，并确定性计算项目数、工时、验收率、准时率、工时偏差、改稿、等待和反馈特征。用户要求某人的用户画像、需求人画像或合作特征时必须调用。', category: 'tasks', endpoint: 'requester-profile',
    policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['tasks:read'], roles: businessReadRoles, confirmation: 'none', audit: 'turn', auditEvent: 'agent_get_requester_profile' },
    inputSchema: z.object({ name: z.string().min(1).max(80) }),
    trace: { running: '读取需求人画像', completed: '需求人画像已返回' },
  }),
  search_attachments: readCapability({
    title: '搜索任务附件', description: '按任务语义、任务名和文件名搜索真实附件。用户要求查看、预览、打开或下载附件时必须优先调用。', category: 'files', endpoint: 'search-attachments',
    policy: { risk: 'read', deterministic: true, source: 'r2', scopes: ['attachments:read'], roles: businessReadRoles, confirmation: 'none', audit: 'turn', auditEvent: 'agent_search_attachments' },
    inputSchema: z.object({ query: z.string(), month: z.string().optional(), limit: z.number().int().min(1).max(50).default(30) }),
    trace: { running: '查找相关附件', completed: '附件检索已完成' },
  }),
  get_giverny_context: readCapability({
    title: '读取工作台能力', description: '读取当前 Giverny 工作台概览和能力边界。', category: 'product', endpoint: 'context',
    policy: { risk: 'read', deterministic: true, source: 'product_registry', scopes: ['product:read'], roles: allRoles, confirmation: 'none', audit: 'turn', auditEvent: 'agent_get_context' },
    inputSchema: z.object({}), trace: { running: '确认平台能力边界', completed: '能力范围已确认' },
  }),
  search_product_help: readCapability({
    title: '查询产品使用说明', description: '查询 Giverny 的快捷键、功能入口、操作流程、模型设置、版本更新、品牌说明、模型路由、权限边界和产品规则。网站怎么用、产品是什么或为何这样设计的问题必须优先调用。', category: 'product', endpoint: 'product-help',
    policy: { risk: 'read', deterministic: true, source: 'product_registry', scopes: ['product:read'], roles: allRoles, confirmation: 'none', audit: 'turn', auditEvent: 'agent_search_product_help' },
    inputSchema: z.object({ query: z.string().min(1).max(500), limit: z.number().int().min(1).max(10).default(5) }),
    trace: { running: '查询产品使用说明', completed: '产品说明已返回' },
  }),
  create_task_plan: defineCapability({
    title: '创建持续任务计划', description: '保存一个可跨会话持续推进的任务计划。适用于“从新建跟到验收”“持续提醒我完成这个项目”等目标。', category: 'planning', endpoint: 'create-task-plan', methods: ['POST'], exposure: ['model', 'api'], taskScoped: true,
    policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['plans:write'], roles: writeRoles, confirmation: 'none', audit: 'business', auditEvent: 'agent_create_task_plan' },
    inputSchema: z.object({ goal: z.string().min(2).max(500), taskId: z.number().int().positive().optional(), nextActionAt: z.string().optional(), steps: z.array(z.object({ label: z.string().min(1).max(120), action: z.string().min(1).max(60) })).min(2).max(8) }),
    trace: { running: '整理持续任务计划', completed: '持续任务计划已创建' },
  }),
  get_task_memory: defineCapability({
    title: '读取任务记忆', description: '读取并刷新某个任务的长期记忆，包括需求摘要、近期记录、合作伙伴反馈偏好和未解决事项。', category: 'memory', endpoint: 'get-task-memory', methods: ['GET', 'POST'], exposure: ['model', 'api'], taskScoped: true,
    policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['memory:read'], roles: businessReadRoles, confirmation: 'none', audit: 'turn', auditEvent: 'agent_get_task_memory' },
    inputSchema: z.object({ taskId: z.number().int().positive().optional() }), trace: { running: '读取任务长期记忆', completed: '任务记忆已返回' },
  }),
  start_monthly_review: defineCapability({
    title: '启动月度复盘', description: '启动指定月份的持久化后台工作复盘。用于整月工作分析，不用于单个数字查询。', category: 'analysis', endpoint: 'monthly-review-start', methods: ['POST'], exposure: ['model', 'api'],
    policy: { risk: 'write', deterministic: false, source: 'workflow', scopes: ['analysis:write'], roles: writeRoles, confirmation: 'none', audit: 'workflow', auditEvent: 'agent_start_monthly_review' },
    inputSchema: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }), trace: { running: '创建月度复盘任务', completed: '月度复盘已进入后台执行' },
  }),
  start_deep_analysis: defineCapability({
    title: '启动深度分析', description: '启动持久化深度分析，支持周报、风险扫描、跨任务比较、批量附件总结和多月趋势分析。', category: 'analysis', endpoint: 'analysis-job-start', methods: ['POST'], exposure: ['model', 'api'],
    policy: { risk: 'write', deterministic: false, source: 'workflow', scopes: ['analysis:write'], roles: writeRoles, confirmation: 'none', audit: 'workflow', auditEvent: 'agent_start_deep_analysis' },
    inputSchema: z.object({ type: z.enum(['weekly_digest', 'risk_digest', 'cross_task_analysis', 'batch_attachment_analysis', 'trend_analysis']), month: z.string().regex(/^\d{4}-\d{2}$/).optional(), query: z.string().max(1000).optional(), taskIds: z.array(z.number().int().positive()).max(30).optional() }),
    trace: { running: '创建深度分析任务', completed: '深度分析已进入后台执行' },
  }),
  create_task_preview: writePreviewCapability({
    title: '预览创建任务', description: '生成新任务草稿。只预览，不直接创建。', category: 'write', endpoint: 'create-task-preview', executeWith: 'create_task',
    policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['tasks:write'], roles: writeRoles, confirmation: 'preview', audit: 'turn', auditEvent: 'agent_preview_create_task' },
    inputSchema: z.object({ title: z.string().optional(), requirement: z.string().optional(), type: z.string().optional(), startDate: z.string().optional(), estimatedDate: z.string().optional(), settlementMonth: z.string().optional(), estimatedHours: z.number().optional(), requester: z.string().optional(), contact: z.string().optional(), reviewer: z.string().optional(), billable: z.boolean().optional(), isSupplemental: z.boolean().optional() }),
    trace: { running: '整理新任务草稿', completed: '任务草稿已生成' },
  }),
  record_feedback_preview: writePreviewCapability({
    title: '预览记录反馈', description: '生成记录合作伙伴反馈或修改建议的预览。', category: 'write', endpoint: 'record-feedback-preview', executeWith: 'record_feedback', taskScoped: true,
    policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['tasks:write'], roles: writeRoles, confirmation: 'preview', audit: 'turn', auditEvent: 'agent_preview_feedback' },
    inputSchema: z.object({ ...taskReferenceSchema, note: z.string(), feedbackVersion: z.string().optional(), feedbackSource: z.string().optional(), dateTime: z.string().optional() }), trace: { running: '整理反馈记录', completed: '反馈草稿已生成' },
  }),
  update_task_status_preview: writePreviewCapability({
    title: '预览修改状态', description: '生成任务状态与进度修改预览。', category: 'write', endpoint: 'update-task-status-preview', executeWith: 'update_task_status', taskScoped: true,
    policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['tasks:write'], roles: writeRoles, confirmation: 'preview', audit: 'turn', auditEvent: 'agent_preview_update_status' },
    inputSchema: z.object({ ...taskReferenceSchema, status: z.enum(['计划中', '进行中', '挂起', '待验收', '已验收', '终止', '不计费']), progress: z.number().min(0).max(100).optional(), reason: z.string().optional() }), trace: { running: '核对状态变更', completed: '状态变更草稿已生成' },
  }),
  update_task_fields_preview: writePreviewCapability({
    title: '预览修改字段', description: '生成任务字段修改预览。fields 只包含需要变更的字段。', category: 'write', endpoint: 'update-task-fields-preview', executeWith: 'update_task_fields', taskScoped: true,
    policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['tasks:write'], roles: writeRoles, confirmation: 'preview', audit: 'turn', auditEvent: 'agent_preview_update_fields' },
    inputSchema: z.object({ ...taskReferenceSchema, fields: z.record(z.string(), z.unknown()) }), trace: { running: '核对任务字段', completed: '字段修改草稿已生成' },
  }),
  append_progress_preview: writePreviewCapability({
    title: '预览追加进展', description: '生成任务进展和分段计时记录预览。', category: 'write', endpoint: 'append-progress-preview', executeWith: 'append_progress', taskScoped: true,
    policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['tasks:write'], roles: writeRoles, confirmation: 'preview', audit: 'turn', auditEvent: 'agent_preview_progress' },
    inputSchema: z.object({ ...taskReferenceSchema, note: z.string(), startDateTime: z.string().optional(), endDateTime: z.string().optional(), isUncounted: z.boolean().optional(), isRevision: z.boolean().optional(), isAcceptanceProgress: z.boolean().optional() }), trace: { running: '整理进展记录', completed: '进展草稿已生成' },
  }),
  append_waiting_preview: writePreviewCapability({
    title: '预览记录等待', description: '生成等待记录预览。等待时长不计入实际工时或结算。', category: 'write', endpoint: 'append-waiting-preview', executeWith: 'append_waiting', taskScoped: true,
    policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['tasks:write'], roles: writeRoles, confirmation: 'preview', audit: 'turn', auditEvent: 'agent_preview_waiting' },
    inputSchema: z.object({ ...taskReferenceSchema, note: z.string(), reason: z.enum(['等待合作伙伴意见', '等待补充资料', '等待排期', '其他']).optional(), startDateTime: z.string().optional(), endDateTime: z.string().optional() }), trace: { running: '整理等待记录', completed: '等待草稿已生成' },
  }),
  manage_record_preview: writePreviewCapability({
    title: '预览维护任务记录', description: '生成编辑或删除已有进展、反馈、等待记录的预览。必须先读取任务详情取得 recordId。', category: 'write', endpoint: 'manage-record-preview', executeWith: 'manage_record', taskScoped: true,
    policy: { risk: 'sensitive', deterministic: true, source: 'd1', scopes: ['tasks:write'], roles: writeRoles, confirmation: 'preview', audit: 'turn', auditEvent: 'agent_preview_manage_record' },
    inputSchema: z.object({ ...taskReferenceSchema, recordType: z.enum(['progress', 'feedback', 'waiting']), action: z.enum(['edit', 'delete']), recordId: z.string(), changes: z.record(z.string(), z.unknown()).optional() }), trace: { running: '核对已有记录', completed: '记录维护草稿已生成' },
  }),
  mark_acceptance_files_preview: writePreviewCapability({
    title: '预览标记验收文件', description: '把任务已有附件标记为验收文件。必须先通过任务详情或附件搜索获得 attachmentId。', category: 'write', endpoint: 'mark-acceptance-files-preview', executeWith: 'mark_acceptance_files', taskScoped: true,
    policy: { risk: 'write', deterministic: true, source: 'r2', scopes: ['attachments:write'], roles: writeRoles, confirmation: 'preview', audit: 'turn', auditEvent: 'agent_preview_acceptance_files' },
    inputSchema: z.object({ ...taskReferenceSchema, attachmentIds: z.array(z.number().int().positive()).min(1).max(30) }), trace: { running: '核对验收文件', completed: '验收文件草稿已生成' },
  }),
  complete_acceptance_preview: writePreviewCapability({
    title: '预览完整验收', description: '生成完整验收包预览，一次确认验收备注、最终进展、实际工时和已有验收附件。', category: 'write', endpoint: 'complete-acceptance-preview', executeWith: 'complete_acceptance', taskScoped: true,
    policy: { risk: 'sensitive', deterministic: true, source: 'd1', scopes: ['tasks:write', 'attachments:write'], roles: writeRoles, confirmation: 'preview', audit: 'turn', auditEvent: 'agent_preview_acceptance' },
    inputSchema: z.object({ ...taskReferenceSchema, acceptanceNote: z.string(), progressNote: z.string(), startDateTime: z.string().optional(), endDateTime: z.string().optional(), countTime: z.boolean().optional(), isRevision: z.boolean().optional(), attachmentIds: z.array(z.number().int().positive()).max(30).optional() }), trace: { running: '整理完整验收包', completed: '验收草稿已生成' },
  }),
  create_task: writeExecuteCapability({ title: '执行创建任务', description: '使用签名确认凭证创建任务。', category: 'write', endpoint: 'create-task', previewFor: 'create_task_preview', policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['tasks:write'], roles: writeRoles, confirmation: 'signed-execute', audit: 'business', auditEvent: 'agent_create' }, trace: { running: '执行创建任务', completed: '任务已创建' } }),
  record_feedback: writeExecuteCapability({ title: '执行记录反馈', description: '使用签名确认凭证记录合作伙伴反馈。', category: 'write', endpoint: 'record-feedback', previewFor: 'record_feedback_preview', taskScoped: true, policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['tasks:write'], roles: writeRoles, confirmation: 'signed-execute', audit: 'business', auditEvent: 'agent_record_feedback' }, trace: { running: '执行记录反馈', completed: '反馈已记录' } }),
  update_task_status: writeExecuteCapability({ title: '执行修改状态', description: '使用签名确认凭证修改任务状态。', category: 'write', endpoint: 'update-task-status', previewFor: 'update_task_status_preview', taskScoped: true, policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['tasks:write'], roles: writeRoles, confirmation: 'signed-execute', audit: 'business', auditEvent: 'agent_update_status' }, trace: { running: '执行状态修改', completed: '状态已修改' } }),
  update_task_fields: writeExecuteCapability({ title: '执行修改字段', description: '使用签名确认凭证修改任务字段。', category: 'write', endpoint: 'update-task-fields', previewFor: 'update_task_fields_preview', taskScoped: true, policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['tasks:write'], roles: writeRoles, confirmation: 'signed-execute', audit: 'business', auditEvent: 'agent_update_fields' }, trace: { running: '执行字段修改', completed: '字段已修改' } }),
  append_progress: writeExecuteCapability({ title: '执行追加进展', description: '使用签名确认凭证追加任务进展。', category: 'write', endpoint: 'append-progress', previewFor: 'append_progress_preview', taskScoped: true, policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['tasks:write'], roles: writeRoles, confirmation: 'signed-execute', audit: 'business', auditEvent: 'agent_append_progress' }, trace: { running: '执行追加进展', completed: '进展已追加' } }),
  append_waiting: writeExecuteCapability({ title: '执行记录等待', description: '使用签名确认凭证记录等待。', category: 'write', endpoint: 'append-waiting', previewFor: 'append_waiting_preview', taskScoped: true, policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['tasks:write'], roles: writeRoles, confirmation: 'signed-execute', audit: 'business', auditEvent: 'agent_append_waiting' }, trace: { running: '执行记录等待', completed: '等待已记录' } }),
  manage_record: writeExecuteCapability({ title: '执行维护任务记录', description: '使用签名确认凭证编辑或删除单条任务记录。', category: 'write', endpoint: 'manage-record', previewFor: 'manage_record_preview', taskScoped: true, policy: { risk: 'sensitive', deterministic: true, source: 'd1', scopes: ['tasks:write'], roles: writeRoles, confirmation: 'signed-execute', audit: 'business', auditEvent: 'agent_manage_record' }, trace: { running: '执行记录维护', completed: '记录已维护' } }),
  mark_acceptance_files: writeExecuteCapability({ title: '执行标记验收文件', description: '使用签名确认凭证标记已有验收文件。', category: 'write', endpoint: 'mark-acceptance-files', previewFor: 'mark_acceptance_files_preview', taskScoped: true, policy: { risk: 'write', deterministic: true, source: 'r2', scopes: ['attachments:write'], roles: writeRoles, confirmation: 'signed-execute', audit: 'business', auditEvent: 'agent_mark_acceptance_files' }, trace: { running: '执行验收文件标记', completed: '验收文件已标记' } }),
  complete_acceptance: writeExecuteCapability({ title: '执行完整验收', description: '使用签名确认凭证完成任务验收。', category: 'write', endpoint: 'complete-acceptance', previewFor: 'complete_acceptance_preview', taskScoped: true, policy: { risk: 'sensitive', deterministic: true, source: 'd1', scopes: ['tasks:write', 'attachments:write'], roles: writeRoles, confirmation: 'signed-execute', audit: 'business', auditEvent: 'agent_complete_acceptance' }, trace: { running: '执行完整验收', completed: '任务已验收' } }),
  progress_task_plan: defineCapability({ title: '推进持续计划', description: '业务写入成功后确定性推进关联计划。', category: 'internal', endpoint: 'progress-task-plan', methods: ['POST'], exposure: ['api'], policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['plans:write'], roles: writeRoles, confirmation: 'system-only', audit: 'workflow', auditEvent: 'agent_progress_task_plan' }, inputSchema: z.object({ conversationId: z.string().optional(), action: z.string(), taskId: z.number().int().positive().optional() }), trace: { running: '推进持续计划', completed: '持续计划已推进' } }),
  workflow_write: defineCapability({ title: '执行 Workflow 写入', description: 'Workflow 使用 operationId 和签名确认凭证执行白名单写入。', category: 'internal', endpoint: 'workflow-write', methods: ['POST'], exposure: ['api', 'workflow'], policy: { risk: 'sensitive', deterministic: true, source: 'workflow', scopes: ['workflow:write'], roles: systemRoles, confirmation: 'system-only', audit: 'workflow', auditEvent: 'agent_workflow_write' }, inputSchema: z.object({ operationId: z.string(), endpoint: z.string(), confirmationToken: z.string() }), trace: { running: '执行持久化写入', completed: '持久化写入已完成' } }),
  analysis_job_prepare: defineCapability({ title: '准备后台分析数据', description: 'Workflow 收集后台分析所需的确定性数据。', category: 'internal', endpoint: 'analysis-job-prepare', methods: ['POST'], exposure: ['api', 'workflow'], policy: { risk: 'read', deterministic: true, source: 'workflow', scopes: ['analysis:execute'], roles: systemRoles, confirmation: 'system-only', audit: 'workflow', auditEvent: 'agent_analysis_prepare' }, inputSchema: z.object({ jobId: z.string() }), trace: { running: '收集分析数据', completed: '分析数据已收集' } }),
  analysis_job_generate: defineCapability({ title: '生成后台分析报告', description: 'Workflow 基于确定性快照生成并保存报告。', category: 'internal', endpoint: 'analysis-job-generate', methods: ['POST'], exposure: ['api', 'workflow'], policy: { risk: 'write', deterministic: false, source: 'workflow', scopes: ['analysis:execute'], roles: systemRoles, confirmation: 'system-only', audit: 'workflow', auditEvent: 'agent_analysis_generate' }, inputSchema: z.object({ jobId: z.string() }), trace: { running: '生成分析报告', completed: '分析报告已生成' } }),
  analysis_job_fail: defineCapability({ title: '记录后台分析失败', description: 'Workflow 持久化后台分析失败状态。', category: 'internal', endpoint: 'analysis-job-fail', methods: ['POST'], exposure: ['api', 'workflow'], policy: { risk: 'write', deterministic: true, source: 'workflow', scopes: ['analysis:execute'], roles: systemRoles, confirmation: 'system-only', audit: 'workflow', auditEvent: 'agent_analysis_fail' }, inputSchema: z.object({ jobId: z.string(), error: z.string() }), trace: { running: '记录分析异常', completed: '分析异常已记录' } }),
} as const satisfies Record<string, AgentCapabilityDefinition>

export type AgentCapabilityName = keyof typeof agentCapabilityRegistry

const readToolNames = ['query_month_finance', 'search_tasks', 'query_task_portfolio', 'get_task_detail', 'get_requester_profile', 'search_attachments', 'get_giverny_context', 'search_product_help'] as const
export type AgentReadToolName = typeof readToolNames[number]
export const agentReadToolRegistry = Object.fromEntries(readToolNames.map((name) => [name, agentCapabilityRegistry[name]])) as Pick<typeof agentCapabilityRegistry, AgentReadToolName>

export function agentCapabilityByEndpoint(endpoint: string) {
  return Object.entries(agentCapabilityRegistry).find(([, capability]) => capability.endpoint === endpoint) as [AgentCapabilityName, AgentCapabilityDefinition] | undefined
}

export function agentCapabilityAllows(endpoint: string, role: AgentPrincipalRole, method: string) {
  const match = agentCapabilityByEndpoint(endpoint)
  return Boolean(match && match[1].methods.includes(method as 'GET' | 'POST') && match[1].policy.roles.includes(role))
}

export function agentModelCapabilityAllows(name: string, role: AgentPrincipalRole) {
  const capability = agentCapabilityRegistry[name as AgentCapabilityName] as AgentCapabilityDefinition | undefined
  return Boolean(capability?.exposure.includes('model') && capability.policy.roles.includes(role))
}

export function agentCapabilityTraceLabel(name: string, phase: 'running' | 'completed') {
  const capability = agentCapabilityRegistry[name as AgentCapabilityName]
  return capability?.trace[phase] || (phase === 'running' ? '调用业务工具' : '业务工具已返回')
}

export function agentWritePreviewConfig(name: string) {
  const preview = agentCapabilityRegistry[name as AgentCapabilityName] as AgentCapabilityDefinition | undefined
  if (!preview || preview.policy.confirmation !== 'preview' || !preview.executeWith) return null
  const execute = agentCapabilityRegistry[preview.executeWith as AgentCapabilityName] as AgentCapabilityDefinition | undefined
  if (!execute || execute.policy.confirmation !== 'signed-execute') return null
  return { executeName: preview.executeWith, previewEndpoint: preview.endpoint, executeEndpoint: execute.endpoint, label: execute.title.replace(/^执行/, '') }
}

export const agentWorkflowWriteEndpoints: ReadonlySet<string> = new Set(
  (Object.values(agentCapabilityRegistry) as AgentCapabilityDefinition[])
    .filter((capability) => capability.policy.confirmation === 'signed-execute' && capability.exposure.includes('workflow'))
    .map((capability) => capability.endpoint),
)

export function agentCapabilityManifest() {
  return (Object.entries(agentCapabilityRegistry) as [AgentCapabilityName, AgentCapabilityDefinition][]).map(([name, capability]) => ({
    name,
    title: capability.title,
    description: capability.description,
    category: capability.category,
    endpoint: capability.endpoint,
    methods: [...capability.methods],
    risk: capability.policy.risk,
    deterministic: capability.policy.deterministic,
    source: capability.policy.source,
    scopes: [...capability.policy.scopes],
    roles: [...capability.policy.roles],
    confirmation: capability.policy.confirmation,
    audit: capability.policy.audit,
    auditEvent: capability.policy.auditEvent,
    exposure: [...capability.exposure],
    taskScoped: Boolean(capability.taskScoped),
    previewFor: capability.previewFor || null,
    executeWith: capability.executeWith || null,
  }))
}
