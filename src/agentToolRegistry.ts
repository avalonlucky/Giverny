import { z } from 'zod'
import type { AgentPrincipalRole } from './agentScope'

export type AgentCapabilityRisk = 'read' | 'write' | 'sensitive'
export type AgentCapabilityConfirmation = 'none' | 'preview' | 'signed-execute' | 'system-only'
export type AgentCapabilitySource = 'd1' | 'r2' | 'product_registry' | 'workflow'
export type AgentCapabilityExposure = 'model' | 'mcp' | 'api' | 'workflow'

export type AgentCapabilityDefinition = {
  title: string
  description: string
  category: 'finance' | 'tasks' | 'files' | 'calendar' | 'notifications' | 'security' | 'product' | 'planning' | 'memory' | 'analysis' | 'write' | 'internal'
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
const adminRoles = ['admin', 'system'] as const
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
  inspect_attachment_evidence: readCapability({
    title: '读取附件证据', description: '按附件 ID 读取文件元数据、任务归属、OCR/文档提取、分析结论和稳定证据引用。回答文件内容、质量或需求匹配时必须调用。', category: 'files', endpoint: 'attachment-evidence', taskScoped: true,
    policy: { risk: 'read', deterministic: true, source: 'r2', scopes: ['attachments:read'], roles: businessReadRoles, confirmation: 'none', audit: 'turn', auditEvent: 'agent_inspect_attachment_evidence' },
    inputSchema: z.object({ attachmentIds: z.array(z.number().int().positive()).min(1).max(20), includeExtractedText: z.boolean().default(true) }),
    trace: { running: '读取附件内容与证据', completed: '附件证据已返回' },
  }),
  query_attachment_analysis: readCapability({
    title: '查询附件分析状态', description: '查询任务附件的分析状态、解析方式、尝试次数和失败原因，用于判断是否需要补分析或恢复。', category: 'files', endpoint: 'attachment-analysis-status', taskScoped: true,
    policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['attachments:read'], roles: businessReadRoles, confirmation: 'none', audit: 'turn', auditEvent: 'agent_query_attachment_analysis' },
    inputSchema: z.object({ ...taskReferenceSchema, attachmentIds: z.array(z.number().int().positive()).max(30).optional(), statuses: z.array(z.enum(['missing', 'pending', 'processing', 'completed', 'failed', 'unsupported'])).max(6).optional(), limit: z.number().int().min(1).max(100).default(30) }),
    trace: { running: '检查附件分析状态', completed: '附件分析状态已返回' },
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
  query_settlement_exports: readCapability({
    title: '查询结算导出记录', description: '按日期范围查询当前工作区的结算导出、锁定、分享有效期以及预览、Excel、PDF 入口。', category: 'finance', endpoint: 'settlement-exports',
    policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['finance:read'], roles: financeReadRoles, confirmation: 'none', audit: 'turn', auditEvent: 'agent_query_settlement_exports' },
    inputSchema: z.object({ startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), limit: z.number().int().min(1).max(100).default(30) }),
    trace: { running: '查询结算导出记录', completed: '结算导出记录已返回' },
  }),
  reconcile_settlement_export: readCapability({
    title: '核对结算回单', description: '确定性复算结算快照的任务数、工时和金额，检查重复任务、数据变化、导出范围重叠与日期空档。', category: 'finance', endpoint: 'settlement-reconciliation',
    policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['finance:read'], roles: financeReadRoles, confirmation: 'none', audit: 'turn', auditEvent: 'agent_reconcile_settlement_export' },
    inputSchema: z.object({ exportId: z.string().min(1).optional(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
    trace: { running: '逐项核对结算数据', completed: '结算核对结果已生成' },
  }),
  check_schedule_conflicts: readCapability({
    title: '检查任务排期冲突', description: '按开始和交付时间检查当前工作区未闭环任务的时间重叠与容量风险。', category: 'calendar', endpoint: 'schedule-conflicts', taskScoped: true,
    policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['tasks:read'], roles: businessReadRoles, confirmation: 'none', audit: 'turn', auditEvent: 'agent_check_schedule_conflicts' },
    inputSchema: z.object({ startDate: z.string(), endDate: z.string(), excludeTaskId: z.number().int().positive().optional(), estimatedHours: z.number().min(0).optional() }),
    trace: { running: '检查排期冲突', completed: '排期冲突已核对' },
  }),
  prepare_attachment_upload: defineCapability({
    title: '准备附件上传接力', description: '核对任务归属、附件范围、文件大小和上传入口；二进制文件仍由已登录浏览器直传 R2，不进入模型上下文。', category: 'files', endpoint: 'prepare-attachment-upload', methods: ['POST'], exposure: ['model', 'api'], taskScoped: true,
    policy: { risk: 'write', deterministic: true, source: 'r2', scopes: ['attachments:write'], roles: writeRoles, confirmation: 'none', audit: 'workflow', auditEvent: 'agent_prepare_attachment_upload' },
    inputSchema: z.object({ ...taskReferenceSchema, scope: z.enum(['progress', 'acceptance']).default('progress'), files: z.array(z.object({ name: z.string().min(1).max(240), size: z.number().int().positive().max(200 * 1024 * 1024), mimeType: z.string().max(120).optional() })).min(1).max(6) }),
    trace: { running: '核对附件上传条件', completed: '附件上传接力已准备' },
  }),
  manage_attachment_analysis_preview: writePreviewCapability({ title: '预览批量分析附件', description: '预览新建分析或重试失败/不支持的附件；确认后进入现有后台解析与多模态分析链路。', category: 'files', endpoint: 'manage-attachment-analysis-preview', executeWith: 'manage_attachment_analysis', taskScoped: true, policy: { risk: 'write', deterministic: true, source: 'r2', scopes: ['attachments:write', 'analysis:write'], roles: writeRoles, confirmation: 'preview', audit: 'turn', auditEvent: 'agent_preview_manage_attachment_analysis' }, inputSchema: z.object({ attachmentIds: z.array(z.number().int().positive()).min(1).max(20), action: z.enum(['analyze', 'retry']) }), trace: { running: '核对附件分析任务', completed: '附件分析预览已生成' } }),
  manage_attachment_analysis: writeExecuteCapability({ title: '执行批量分析附件', description: '使用签名确认凭证创建或重置附件分析任务，并交给后台队列处理。', category: 'files', endpoint: 'manage-attachment-analysis', previewFor: 'manage_attachment_analysis_preview', taskScoped: true, policy: { risk: 'write', deterministic: true, source: 'r2', scopes: ['attachments:write', 'analysis:write'], roles: writeRoles, confirmation: 'signed-execute', audit: 'business', auditEvent: 'agent_manage_attachment_analysis' }, trace: { running: '提交附件分析任务', completed: '附件分析任务已提交' } }),
  update_attachment_metadata_preview: writePreviewCapability({ title: '预览修改附件信息', description: '预览修改一个附件的文件名、标签或进展/验收范围；保留真实扩展名并检查锁定月份。', category: 'files', endpoint: 'update-attachment-metadata-preview', executeWith: 'update_attachment_metadata', taskScoped: true, policy: { risk: 'write', deterministic: true, source: 'r2', scopes: ['attachments:write'], roles: writeRoles, confirmation: 'preview', audit: 'turn', auditEvent: 'agent_preview_update_attachment_metadata' }, inputSchema: z.object({ attachmentId: z.number().int().positive(), name: z.string().min(1).max(120).optional(), tag: z.string().max(240).optional(), scope: z.enum(['progress', 'acceptance']).optional(), visibleToClient: z.boolean().optional() }), trace: { running: '核对附件信息修改', completed: '附件信息草稿已生成' } }),
  update_attachment_metadata: writeExecuteCapability({ title: '执行修改附件信息', description: '使用签名确认凭证修改附件名称、标签、范围或合作伙伴可见性。', category: 'files', endpoint: 'update-attachment-metadata', previewFor: 'update_attachment_metadata_preview', taskScoped: true, policy: { risk: 'write', deterministic: true, source: 'r2', scopes: ['attachments:write'], roles: writeRoles, confirmation: 'signed-execute', audit: 'business', auditEvent: 'agent_update_attachment_metadata' }, trace: { running: '更新附件信息', completed: '附件信息已更新' } }),
  inspect_ai_settings: defineCapability({
    title: '检查模型设置', description: '读取脱敏后的主模型、备用模型、识图模型和服务商可用状态，不返回 API Key。', category: 'security', endpoint: 'inspect-ai-settings', methods: ['GET', 'POST'], exposure: ['model', 'api'],
    policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['settings:read'], roles: adminRoles, confirmation: 'none', audit: 'turn', auditEvent: 'agent_inspect_ai_settings' },
    inputSchema: z.object({}), trace: { running: '检查模型设置', completed: '模型设置已脱敏返回' },
  }),
  test_ai_route: defineCapability({
    title: '测试模型路由', description: '使用已安全保存的凭证测试指定文字或识图路由，不接受或返回 API Key。', category: 'security', endpoint: 'test-ai-route', methods: ['POST'], exposure: ['model', 'api'],
    policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['settings:read'], roles: adminRoles, confirmation: 'none', audit: 'turn', auditEvent: 'agent_test_ai_route' },
    inputSchema: z.object({ route: z.enum(['textPrimary', 'textFallback', 'visionPrimary', 'visionFallback']) }), trace: { running: '测试模型路由', completed: '模型路由测试完成' },
  }),
  export_settlement_preview: writePreviewCapability({ title: '预览导出结算回单', description: '核对日期范围和确定性金额快照，确认后生成 Excel 与合作伙伴分享链接。', category: 'finance', endpoint: 'export-settlement-preview', executeWith: 'export_settlement', policy: { risk: 'sensitive', deterministic: true, source: 'd1', scopes: ['finance:write'], roles: adminRoles, confirmation: 'preview', audit: 'turn', auditEvent: 'agent_preview_export_settlement' }, inputSchema: z.object({ startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }), trace: { running: '核对结算导出范围', completed: '结算导出预览已生成' } }),
  export_settlement: writeExecuteCapability({ title: '执行导出结算回单', description: '使用签名确认凭证生成结算快照、Excel 和分享链接。', category: 'finance', endpoint: 'export-settlement', previewFor: 'export_settlement_preview', policy: { risk: 'sensitive', deterministic: true, source: 'd1', scopes: ['finance:write'], roles: adminRoles, confirmation: 'signed-execute', audit: 'business', auditEvent: 'agent_export_settlement' }, trace: { running: '生成结算回单', completed: '结算回单已生成' } }),
  manage_settlement_export_preview: writePreviewCapability({ title: '预览管理结算回单', description: '预览锁定结算快照、修改分享链接有效期，或删除未锁定记录；不会接收管理员密码。', category: 'finance', endpoint: 'manage-settlement-export-preview', executeWith: 'manage_settlement_export', policy: { risk: 'sensitive', deterministic: true, source: 'd1', scopes: ['finance:write'], roles: adminRoles, confirmation: 'preview', audit: 'turn', auditEvent: 'agent_preview_manage_settlement' }, inputSchema: z.object({ exportId: z.string().min(1), action: z.enum(['lock', 'set_access', 'delete_unlocked']), expiresAt: z.string().optional(), disabled: z.boolean().optional() }), trace: { running: '核对结算回单操作', completed: '结算回单操作预览已生成' } }),
  manage_settlement_export: writeExecuteCapability({ title: '执行管理结算回单', description: '使用签名确认凭证锁定快照、修改分享有效期或删除未锁定记录；锁定记录删除仍只允许在管理界面验证密码。', category: 'finance', endpoint: 'manage-settlement-export', previewFor: 'manage_settlement_export_preview', policy: { risk: 'sensitive', deterministic: true, source: 'd1', scopes: ['finance:write'], roles: adminRoles, confirmation: 'signed-execute', audit: 'business', auditEvent: 'agent_manage_settlement' }, trace: { running: '更新结算回单', completed: '结算回单已更新' } }),
  reschedule_task_preview: writePreviewCapability({ title: '预览调整任务排期', description: '先检查冲突，再预览任务开始、交付和预估工时调整。', category: 'calendar', endpoint: 'reschedule-task-preview', executeWith: 'reschedule_task', taskScoped: true, policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['tasks:write'], roles: writeRoles, confirmation: 'preview', audit: 'turn', auditEvent: 'agent_preview_reschedule_task' }, inputSchema: z.object({ ...taskReferenceSchema, startDate: z.string(), endDate: z.string(), estimatedHours: z.number().min(0).optional(), reason: z.string().max(500).optional() }), trace: { running: '检查并整理新排期', completed: '排期调整预览已生成' } }),
  reschedule_task: writeExecuteCapability({ title: '执行调整任务排期', description: '使用签名确认凭证更新任务排期。', category: 'calendar', endpoint: 'reschedule-task', previewFor: 'reschedule_task_preview', taskScoped: true, policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['tasks:write'], roles: writeRoles, confirmation: 'signed-execute', audit: 'business', auditEvent: 'agent_reschedule_task' }, trace: { running: '更新任务排期', completed: '任务排期已更新' } }),
  schedule_reminder_preview: writePreviewCapability({ title: '预览安排站内提醒', description: '预览与任务关联的站内提醒及触发时间。', category: 'notifications', endpoint: 'schedule-reminder-preview', executeWith: 'schedule_reminder', taskScoped: true, policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['plans:write'], roles: writeRoles, confirmation: 'preview', audit: 'turn', auditEvent: 'agent_preview_schedule_reminder' }, inputSchema: z.object({ ...taskReferenceSchema, goal: z.string().min(2).max(500), remindAt: z.string() }), trace: { running: '整理提醒草稿', completed: '提醒草稿已生成' } }),
  schedule_reminder: writeExecuteCapability({ title: '执行安排站内提醒', description: '使用签名确认凭证创建可跨会话恢复的站内提醒。', category: 'notifications', endpoint: 'schedule-reminder', previewFor: 'schedule_reminder_preview', taskScoped: true, policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['plans:write'], roles: writeRoles, confirmation: 'signed-execute', audit: 'business', auditEvent: 'agent_schedule_reminder' }, trace: { running: '创建站内提醒', completed: '站内提醒已创建' } }),
  query_proactive_work: readCapability({ title: '查询主动事项', description: '读取按风险优先级排序的主动待办、事实证据、处理建议和历史处理效果统计。', category: 'notifications', endpoint: 'proactive-work', taskScoped: true, policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['plans:read'], roles: financeReadRoles, confirmation: 'none', audit: 'turn', auditEvent: 'agent_query_proactive_work' }, inputSchema: z.object({ taskId: z.number().int().positive().optional(), status: z.enum(['active', 'open', 'snoozed', 'resolved', 'dismissed']).default('active'), priority: z.enum(['critical', 'high', 'medium', 'low']).optional(), limit: z.number().int().min(1).max(100).default(50) }), trace: { running: '读取主动事项与处理效果', completed: '主动事项已按优先级整理' } }),
  manage_proactive_item_preview: writePreviewCapability({ title: '预览处理主动事项', description: '预览解决、忽略或稍后处理一个主动事项；不会直接修改任务业务字段。', category: 'notifications', endpoint: 'manage-proactive-item-preview', executeWith: 'manage_proactive_item', taskScoped: true, policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['plans:write'], roles: writeRoles, confirmation: 'preview', audit: 'turn', auditEvent: 'agent_preview_manage_proactive_item' }, inputSchema: z.object({ itemId: z.string().min(1).max(160), action: z.enum(['resolve', 'dismiss', 'snooze']), note: z.string().max(500).optional(), snoozedUntil: z.string().optional() }), trace: { running: '核对主动事项处理方式', completed: '主动事项处理草稿已生成' } }),
  manage_proactive_item: writeExecuteCapability({ title: '执行处理主动事项', description: '使用签名确认凭证解决、忽略或稍后处理主动事项，并记录处理效果。', category: 'notifications', endpoint: 'manage-proactive-item', previewFor: 'manage_proactive_item_preview', taskScoped: true, policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['plans:write'], roles: writeRoles, confirmation: 'signed-execute', audit: 'business', auditEvent: 'agent_manage_proactive_item' }, trace: { running: '处理主动事项', completed: '主动事项处理结果已记录' } }),
  configure_ai_route_preview: writePreviewCapability({ title: '预览配置模型路由', description: '使用已保存凭证验证服务商、模型和 Base URL，预览后再修改路由；API Key 不进入 Agent。', category: 'security', endpoint: 'configure-ai-route-preview', executeWith: 'configure_ai_route', policy: { risk: 'sensitive', deterministic: true, source: 'd1', scopes: ['settings:write'], roles: adminRoles, confirmation: 'preview', audit: 'turn', auditEvent: 'agent_preview_configure_ai_route' }, inputSchema: z.object({ route: z.enum(['textPrimary', 'textFallback', 'visionPrimary', 'visionFallback']), provider: z.enum(['deepseek', 'gemini', 'kimi', 'doubao', 'qwen', 'openrouter', 'openai', 'anthropic']), baseUrl: z.string().min(1), model: z.string().min(1), makeActive: z.boolean().default(false) }), trace: { running: '验证模型路由配置', completed: '模型路由配置预览已生成' } }),
  configure_ai_route: writeExecuteCapability({ title: '执行配置模型路由', description: '使用签名确认凭证保存已验证的模型路由，不处理明文 API Key。', category: 'security', endpoint: 'configure-ai-route', previewFor: 'configure_ai_route_preview', policy: { risk: 'sensitive', deterministic: true, source: 'd1', scopes: ['settings:write'], roles: adminRoles, confirmation: 'signed-execute', audit: 'business', auditEvent: 'agent_configure_ai_route' }, trace: { running: '保存模型路由配置', completed: '模型路由配置已保存' } }),
  create_task_plan: defineCapability({
    title: '创建持续任务计划', description: '保存一个可跨会话恢复的多步骤执行批次。步骤可以声明依赖与补偿动作；批次必须由用户整体确认后才能推进。', category: 'planning', endpoint: 'create-task-plan', methods: ['POST'], exposure: ['model', 'api'], taskScoped: true,
    policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['plans:write'], roles: writeRoles, confirmation: 'none', audit: 'business', auditEvent: 'agent_create_task_plan' },
    inputSchema: z.object({
      goal: z.string().min(2).max(500),
      taskId: z.number().int().positive().optional(),
      nextActionAt: z.string().optional(),
      executionMode: z.enum(['batch', 'guided']).default('batch'),
      steps: z.array(z.object({
        key: z.string().min(1).max(60).optional(),
        label: z.string().min(1).max(120),
        action: z.string().min(1).max(60),
        dependsOn: z.array(z.string().min(1).max(60)).max(8).optional(),
        compensation: z.object({ label: z.string().min(1).max(120), action: z.string().min(1).max(60) }).optional(),
      })).min(2).max(8),
    }),
    trace: { running: '整理持续任务计划', completed: '持续任务计划已创建' },
  }),
  get_task_memory: defineCapability({
    title: '读取任务记忆', description: '读取并刷新某个任务的长期记忆，包括需求摘要、近期记录、合作伙伴反馈偏好和未解决事项。', category: 'memory', endpoint: 'get-task-memory', methods: ['GET', 'POST'], exposure: ['model', 'api'], taskScoped: true,
    policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['memory:read'], roles: businessReadRoles, confirmation: 'none', audit: 'turn', auditEvent: 'agent_get_task_memory' },
    inputSchema: z.object({ taskId: z.number().int().positive().optional() }), trace: { running: '读取任务长期记忆', completed: '任务记忆已返回' },
  }),
  query_enterprise_memory: readCapability({
    title: '查询企业分层记忆', description: '查询当前工作区的组织规则、合作伙伴记忆和项目记忆，并返回来源、有效期、版本与纠正关系。涉及组织约定、合作偏好或项目历史规则时必须调用。', category: 'memory', endpoint: 'enterprise-memory',
    policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['memory:read'], roles: financeReadRoles, confirmation: 'none', audit: 'turn', auditEvent: 'agent_query_enterprise_memory' },
    inputSchema: z.object({ query: z.string().max(500).optional(), scopeType: z.enum(['organization', 'partner', 'project']).optional(), scopeKey: z.string().max(160).optional(), memoryType: z.enum(['fact', 'preference', 'rule', 'decision']).optional(), includeHistory: z.boolean().default(false), limit: z.number().int().min(1).max(100).default(30) }),
    trace: { running: '检索企业知识与记忆', completed: '分层记忆及来源已返回' },
  }),
  manage_enterprise_memory_preview: writePreviewCapability({
    title: '预览维护企业记忆', description: '预览新增、纠正、失效或删除组织规则、合作伙伴记忆和项目记忆；纠正会保留旧版本。', category: 'memory', endpoint: 'manage-enterprise-memory-preview', executeWith: 'manage_enterprise_memory',
    policy: { risk: 'sensitive', deterministic: true, source: 'd1', scopes: ['memory:write'], roles: writeRoles, confirmation: 'preview', audit: 'turn', auditEvent: 'agent_preview_manage_enterprise_memory' },
    inputSchema: z.object({ action: z.enum(['create', 'correct', 'expire', 'delete']), memoryId: z.string().max(160).optional(), scopeType: z.enum(['organization', 'partner', 'project']).optional(), scopeKey: z.string().max(160).optional(), memoryType: z.enum(['fact', 'preference', 'rule', 'decision']).optional(), title: z.string().max(160).optional(), content: z.string().max(4000).optional(), sourceType: z.enum(['manual', 'task', 'conversation', 'document', 'system']).optional(), sourceRef: z.string().max(500).optional(), sourceLabel: z.string().max(300).optional(), sourceExcerpt: z.string().max(1000).optional(), confidence: z.enum(['confirmed', 'derived']).optional(), expiresAt: z.string().optional(), reason: z.string().max(500).optional() }),
    trace: { running: '核对记忆范围、来源和变更', completed: '企业记忆维护草稿已生成' },
  }),
  manage_enterprise_memory: writeExecuteCapability({ title: '执行维护企业记忆', description: '使用签名确认凭证新增、纠正、失效或软删除企业记忆，并写入不可覆盖的修订记录。', category: 'memory', endpoint: 'manage-enterprise-memory', previewFor: 'manage_enterprise_memory_preview', policy: { risk: 'sensitive', deterministic: true, source: 'd1', scopes: ['memory:write'], roles: writeRoles, confirmation: 'signed-execute', audit: 'business', auditEvent: 'agent_manage_enterprise_memory' }, trace: { running: '写入企业记忆修订', completed: '企业记忆与修订记录已保存' } }),
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
  progress_task_plan: defineCapability({ title: '推进持续计划', description: '业务 Workflow 开始、成功或失败后确定性推进关联执行批次。', category: 'internal', endpoint: 'progress-task-plan', methods: ['POST'], exposure: ['api'], policy: { risk: 'write', deterministic: true, source: 'd1', scopes: ['plans:write'], roles: writeRoles, confirmation: 'system-only', audit: 'workflow', auditEvent: 'agent_progress_task_plan' }, inputSchema: z.object({ conversationId: z.string().optional(), planId: z.string().optional(), stepId: z.string().optional(), action: z.string(), taskId: z.number().int().positive().optional(), outcome: z.enum(['started', 'completed', 'failed']).default('completed'), error: z.string().max(500).optional() }), trace: { running: '推进持续计划', completed: '持续计划已推进' } }),
  workflow_write: defineCapability({ title: '执行 Workflow 写入', description: 'Workflow 使用 operationId 和签名确认凭证执行白名单写入。', category: 'internal', endpoint: 'workflow-write', methods: ['POST'], exposure: ['api', 'workflow'], policy: { risk: 'sensitive', deterministic: true, source: 'workflow', scopes: ['workflow:write'], roles: systemRoles, confirmation: 'system-only', audit: 'workflow', auditEvent: 'agent_workflow_write' }, inputSchema: z.object({ operationId: z.string(), endpoint: z.string(), confirmationToken: z.string() }), trace: { running: '执行持久化写入', completed: '持久化写入已完成' } }),
  analysis_job_prepare: defineCapability({ title: '准备后台分析数据', description: 'Workflow 收集后台分析所需的确定性数据。', category: 'internal', endpoint: 'analysis-job-prepare', methods: ['POST'], exposure: ['api', 'workflow'], policy: { risk: 'read', deterministic: true, source: 'workflow', scopes: ['analysis:execute'], roles: systemRoles, confirmation: 'system-only', audit: 'workflow', auditEvent: 'agent_analysis_prepare' }, inputSchema: z.object({ jobId: z.string() }), trace: { running: '收集分析数据', completed: '分析数据已收集' } }),
  analysis_job_generate: defineCapability({ title: '生成后台分析报告', description: 'Workflow 基于确定性快照生成并保存报告。', category: 'internal', endpoint: 'analysis-job-generate', methods: ['POST'], exposure: ['api', 'workflow'], policy: { risk: 'write', deterministic: false, source: 'workflow', scopes: ['analysis:execute'], roles: systemRoles, confirmation: 'system-only', audit: 'workflow', auditEvent: 'agent_analysis_generate' }, inputSchema: z.object({ jobId: z.string() }), trace: { running: '生成分析报告', completed: '分析报告已生成' } }),
  analysis_job_fail: defineCapability({ title: '记录后台分析失败', description: 'Workflow 持久化后台分析失败状态。', category: 'internal', endpoint: 'analysis-job-fail', methods: ['POST'], exposure: ['api', 'workflow'], policy: { risk: 'write', deterministic: true, source: 'workflow', scopes: ['analysis:execute'], roles: systemRoles, confirmation: 'system-only', audit: 'workflow', auditEvent: 'agent_analysis_fail' }, inputSchema: z.object({ jobId: z.string(), error: z.string() }), trace: { running: '记录分析异常', completed: '分析异常已记录' } }),
} as const satisfies Record<string, AgentCapabilityDefinition>

export type AgentCapabilityName = keyof typeof agentCapabilityRegistry

const readToolNames = ['query_month_finance', 'query_settlement_exports', 'reconcile_settlement_export', 'search_tasks', 'query_task_portfolio', 'get_task_detail', 'get_requester_profile', 'search_attachments', 'inspect_attachment_evidence', 'query_attachment_analysis', 'check_schedule_conflicts', 'query_proactive_work', 'query_enterprise_memory', 'get_giverny_context', 'search_product_help'] as const
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
