import assert from 'node:assert/strict'
import {
  agentCapabilityAllows,
  agentCapabilityByEndpoint,
  agentCapabilityManifest,
  agentCapabilityRegistry,
  agentCapabilityTraceLabel,
  agentReadToolRegistry,
  agentWorkflowWriteEndpoints,
  agentWritePreviewConfig,
} from '../src/agentToolRegistry.ts'

let assertions = 0
const check = (condition, message) => {
  assert.ok(condition, message)
  assertions += 1
}

const manifest = agentCapabilityManifest()
check(manifest.length === 74, '能力总数必须固定为 74')
check(Object.keys(agentReadToolRegistry).length === 19, 'MCP 读取工具应为 19 项')
check(manifest.filter((item) => item.exposure.includes('model')).length === 48, '模型能力应为 48 项')
check(manifest.filter((item) => item.exposure.includes('mcp')).length === 19, 'MCP 能力应为 19 项')
check(manifest.filter((item) => item.confirmation === 'preview').length === 21, '写入预览应为 21 项')
check(manifest.filter((item) => item.confirmation === 'signed-execute').length === 21, '签名执行应为 21 项')
check(agentWorkflowWriteEndpoints.size === 21, 'Workflow 白名单应为 21 项')

for (const capability of manifest) {
  check(Boolean(capability.name), '能力名不能为空')
  check(Boolean(capability.endpoint), `${capability.name} endpoint 不能为空`)
  check(capability.methods.length > 0, `${capability.name} methods 不能为空`)
  check(capability.roles.length > 0, `${capability.name} roles 不能为空`)
  check(capability.scopes.length > 0, `${capability.name} scopes 不能为空`)
  check(Boolean(capability.auditEvent), `${capability.name} auditEvent 不能为空`)
  check(['read', 'write', 'sensitive'].includes(capability.risk), `${capability.name} risk 非法`)
  check(['none', 'preview', 'signed-execute', 'system-only'].includes(capability.confirmation), `${capability.name} confirmation 非法`)
  check(agentCapabilityByEndpoint(capability.endpoint)?.[0] === capability.name, `${capability.name} endpoint 反查失败`)
  check(agentCapabilityTraceLabel(capability.name, 'running') !== '调用业务工具', `${capability.name} 缺少运行轨迹`)
  check(agentCapabilityTraceLabel(capability.name, 'completed') !== '业务工具已返回', `${capability.name} 缺少完成轨迹`)
}

for (const preview of manifest.filter((item) => item.confirmation === 'preview')) {
  const config = agentWritePreviewConfig(preview.name)
  check(Boolean(config), `${preview.name} 缺少确认映射`)
  check(config?.previewEndpoint === preview.endpoint, `${preview.name} preview endpoint 不一致`)
  check(config?.executeName === preview.executeWith, `${preview.name} execute name 不一致`)
  check(agentWorkflowWriteEndpoints.has(String(config?.executeEndpoint)), `${preview.name} execute endpoint 未进入 Workflow`)
}

check(agentCapabilityAllows('context', 'guest', 'GET'), '访客应能读取产品上下文')
check(agentCapabilityAllows('product-help', 'client', 'GET'), '合作伙伴应能读取产品说明')
check(agentCapabilityAllows('task-detail', 'client', 'GET'), '合作伙伴应能读取授权任务详情')
check(!agentCapabilityAllows('month-finance', 'client', 'GET'), '合作伙伴不能读取财务')
check(agentCapabilityAllows('diagnose-ai-routing', 'admin', 'POST'), '管理员应能诊断模型路由')
check(!agentCapabilityAllows('diagnose-ai-routing', 'collaborator', 'POST'), '协作者不能读取安全模型配置')
check(!agentCapabilityAllows('project-execution', 'client', 'GET'), '合作伙伴不能读取内部执行计划')
check(agentCapabilityAllows('project-execution', 'viewer', 'GET'), '只读成员应能读取执行计划')
check(agentCapabilityAllows('plan-continuation', 'viewer', 'GET'), '只读成员应能读取计划续接建议')
check(agentCapabilityAllows('workspace-search', 'viewer', 'GET'), '只读成员应能使用全域搜索')
check(!agentCapabilityAllows('workspace-search', 'client', 'GET'), '合作伙伴不能搜索内部对话与企业记忆')
check(agentCapabilityAllows('month-finance', 'viewer', 'GET'), '只读成员应能读取财务')
check(!agentCapabilityAllows('create-task-preview', 'viewer', 'POST'), '只读成员不能生成写入草稿')
check(agentCapabilityAllows('create-task-preview', 'collaborator', 'POST'), '协作者应能生成写入草稿')
check(agentCapabilityAllows('create-task', 'admin', 'POST'), '管理员应能执行已确认写入')
check(!agentCapabilityAllows('create-task', 'admin', 'GET'), '写入端点不能使用 GET')
check(!agentCapabilityAllows('workflow-write', 'admin', 'POST'), 'Workflow 内部端点不能由管理员主体直接调用')
check(agentCapabilityAllows('workflow-write', 'system', 'POST'), '系统主体应能调用 Workflow 内部端点')
check(!agentCapabilityAllows('missing', 'system', 'POST'), '未知端点必须拒绝')

check(agentCapabilityRegistry.query_month_finance.inputSchema.safeParse({ question: '7 月金额' }).success, '财务 schema 应接受问题')
check(!agentCapabilityRegistry.get_requester_profile.inputSchema.safeParse({ name: '' }).success, '画像 schema 应拒绝空姓名')
check(agentCapabilityRegistry.query_task_portfolio.inputSchema.safeParse({ scope: 'waiting' }).success, '跨任务 schema 应接受等待范围')
check(!agentCapabilityRegistry.query_task_portfolio.inputSchema.safeParse({ scope: 'invalid' }).success, '跨任务 schema 应拒绝非法范围')
check(agentCapabilityRegistry.create_task_plan.inputSchema.safeParse({ goal: '跟进项目', steps: [{ label: '创建', action: 'create' }, { label: '验收', action: 'accept' }] }).success, '计划 schema 应接受有效步骤')
check(!agentCapabilityRegistry.create_task_plan.inputSchema.safeParse({ goal: '跟进项目', steps: [{ label: '创建', action: 'create' }] }).success, '计划 schema 应拒绝单步骤')
check(agentCapabilityRegistry.query_project_execution.inputSchema.safeParse({ taskId: 1, status: 'open' }).success, '执行计划查询 schema 应接受任务与状态范围')
check(!agentCapabilityRegistry.query_project_execution.inputSchema.safeParse({ status: 'cancelled' }).success, '执行计划查询 schema 应拒绝未支持范围')
check(agentCapabilityRegistry.manage_task_plan_preview.inputSchema.safeParse({ planId: 'plan-1', action: 'retry_step', stepId: 'plan-1:step-1' }).success, '计划管理 schema 应接受失败步骤重试')
check(agentCapabilityRegistry.manage_task_plan_preview.inputSchema.safeParse({ planId: 'plan-1', action: 'revise_steps', steps: [{ key: 'next', label: '新的下一步', action: 'append_progress' }] }).success, '计划管理 schema 应接受未来步骤修订')
check(!agentCapabilityRegistry.manage_task_plan_preview.inputSchema.safeParse({ planId: 'plan-1', action: 'complete_step', stepId: 'plan-1:step-1' }).success, 'Agent 不得直接完成业务步骤')
check(agentCapabilityRegistry.query_plan_continuation.inputSchema.safeParse({ taskId: 1, limit: 10 }).success, '计划续接 schema 应接受任务范围')
check(agentCapabilityRegistry.search_workspace.inputSchema.safeParse({ query: '验收截图在哪', sources: ['task', 'attachment', 'conversation'], limit: 20 }).success, '全域搜索 schema 应接受多来源查询')
check(!agentCapabilityRegistry.search_workspace.inputSchema.safeParse({ query: '', sources: ['task'] }).success, '全域搜索 schema 应拒绝空查询')
check(agentCapabilityRegistry.diagnose_ai_routing.inputSchema.safeParse({ scope: 'text' }).success, '模型诊断 schema 应接受文字链路范围')
check(!agentCapabilityRegistry.diagnose_ai_routing.inputSchema.safeParse({ scope: 'provider-secret' }).success, '模型诊断 schema 应拒绝未知范围')
check(agentCapabilityRegistry.restore_ai_routing_preview.inputSchema.safeParse({}).success, '模型路由恢复预览不接受模型或密钥参数')
check(agentCapabilityRegistry.append_progress_preview.inputSchema.safeParse({ taskId: 1, note: '完成初稿' }).success, '进展 schema 应接受有效草稿')
check(!agentCapabilityRegistry.append_progress_preview.inputSchema.safeParse({ taskId: 1 }).success, '进展 schema 应要求备注')
check(agentCapabilityRegistry.complete_acceptance_preview.inputSchema.safeParse({ taskId: 1, acceptanceNote: '验收通过', progressNote: '完成交付' }).success, '验收 schema 应接受完整草稿')
check(!agentCapabilityRegistry.complete_acceptance_preview.inputSchema.safeParse({ taskId: 1, acceptanceNote: '验收通过' }).success, '验收 schema 应要求最终进展')
check(agentCapabilityRegistry.batch_task_operations_preview.inputSchema.safeParse({ operations: [{ action: 'update_task_fields', taskId: 1, fields: { contact: '张三' } }, { action: 'append_waiting', taskId: 2, note: '等待资料' }] }).success, '批量事务 schema 应接受两个明确任务操作')
check(!agentCapabilityRegistry.batch_task_operations_preview.inputSchema.safeParse({ operations: [{ action: 'update_task_fields', taskId: 1, fields: { contact: '张三' } }] }).success, '批量事务 schema 应拒绝单操作')
check(!agentCapabilityRegistry.batch_task_operations_preview.inputSchema.safeParse({ operations: [{ action: 'update_task_fields', fields: { contact: '张三' } }, { action: 'append_waiting', taskId: 2, note: '等待资料' }] }).success, '批量事务 schema 应要求每项都有 taskId')
check(agentCapabilityRegistry.create_task.inputSchema.safeParse({ confirmationToken: 'signed' }).success, '执行 schema 应要求确认凭证')
check(!agentCapabilityRegistry.create_task.inputSchema.safeParse({}).success, '执行 schema 应拒绝缺少确认凭证')

console.log(`Agent capability registry deterministic tests: ${assertions} assertions passed`)
