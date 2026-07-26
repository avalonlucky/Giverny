import assert from 'node:assert/strict'
import {
  agentCapabilityAllows,
  agentCapabilityRegistry,
  agentWorkflowWriteEndpoints,
} from '../src/agentToolRegistry.ts'

const previewPairs = [
  ['manage_settlement_export_preview', 'manage_settlement_export'],
  ['reschedule_task_preview', 'reschedule_task'],
  ['schedule_reminder_preview', 'schedule_reminder'],
  ['configure_ai_route_preview', 'configure_ai_route'],
  ['manage_task_plan_preview', 'manage_task_plan'],
  ['restore_ai_routing_preview', 'restore_ai_routing'],
]

for (const [previewName, executeName] of previewPairs) {
  const preview = agentCapabilityRegistry[previewName]
  const execute = agentCapabilityRegistry[executeName]
  assert.equal(preview.executeWith, executeName)
  assert.equal(execute.previewFor, previewName)
  assert.equal(preview.policy.confirmation, 'preview')
  assert.equal(execute.policy.confirmation, 'signed-execute')
  assert.ok(agentWorkflowWriteEndpoints.has(execute.endpoint))
}

for (const endpoint of [
  'generate-settlement-receipt',
  'manage-settlement-export-preview',
  'inspect-ai-settings',
  'test-ai-route',
  'configure-ai-route-preview',
  'diagnose-ai-routing',
  'restore-ai-routing-preview',
]) {
  assert.equal(agentCapabilityAllows(endpoint, 'admin', 'POST'), true)
  assert.equal(agentCapabilityAllows(endpoint, 'collaborator', 'POST'), false)
  assert.equal(agentCapabilityAllows(endpoint, 'viewer', 'POST'), false)
}

for (const endpoint of ['prepare-attachment-upload', 'reschedule-task-preview', 'schedule-reminder-preview']) {
  assert.equal(agentCapabilityAllows(endpoint, 'collaborator', 'POST'), true)
  assert.equal(agentCapabilityAllows(endpoint, 'viewer', 'POST'), false)
}

assert.equal(agentCapabilityAllows('schedule-conflicts', 'viewer', 'GET'), true)
assert.equal(agentCapabilityAllows('schedule-conflicts', 'client', 'GET'), false)
assert.equal(agentCapabilityAllows('agenda', 'viewer', 'GET'), true)
assert.equal(agentCapabilityAllows('agenda', 'client', 'GET'), false)
assert.equal(agentCapabilityAllows('project-execution', 'viewer', 'GET'), true)
assert.equal(agentCapabilityAllows('project-execution', 'client', 'GET'), false)
assert.equal(agentCapabilityAllows('manage-task-plan-preview', 'collaborator', 'POST'), true)
assert.equal(agentCapabilityAllows('manage-task-plan-preview', 'viewer', 'POST'), false)
assert.equal(agentCapabilityAllows('settlement-exports', 'viewer', 'GET'), true)
assert.equal(agentCapabilityAllows('settlement-reconciliation', 'viewer', 'GET'), true)
assert.equal(agentCapabilityAllows('settlement-exports', 'client', 'GET'), false)
assert.equal(agentCapabilityAllows('settlement-reconciliation', 'client', 'GET'), false)
assert.equal(agentCapabilityAllows('web-search', 'guest', 'GET'), true)
assert.equal(agentCapabilityRegistry.search_web.inputSchema.safeParse({ query: '上海明天天气' }).success, true)
assert.equal(agentCapabilityRegistry.search_web.inputSchema.safeParse({ query: '' }).success, false)

for (const capability of Object.values(agentCapabilityRegistry)) {
  if (capability.policy.confirmation === 'signed-execute') assert.equal(capability.exposure.includes('model'), false, `${capability.endpoint} 不得暴露给模型`)
  if (capability.exposure.includes('model') && capability.policy.risk !== 'read' && capability.policy.confirmation !== 'none') {
    assert.equal(capability.policy.confirmation, 'preview', `${capability.endpoint} 的模型写入能力必须先预览确认`)
  }
}

const upload = agentCapabilityRegistry.prepare_attachment_upload.inputSchema.safeParse({
  taskId: 12,
  scope: 'acceptance',
  files: [{ name: '验收通过截图.png', size: 1024, mimeType: 'image/png' }],
})
assert.equal(upload.success, true)
assert.equal(agentCapabilityRegistry.prepare_attachment_upload.inputSchema.safeParse({ taskId: 12, files: [] }).success, false)
assert.equal(agentCapabilityRegistry.prepare_attachment_upload.inputSchema.safeParse({ taskId: 12, files: [{ name: 'too-large.pdf', size: 201 * 1024 * 1024 }] }).success, false)

const aiRouteSchema = agentCapabilityRegistry.configure_ai_route_preview.inputSchema
assert.equal(aiRouteSchema.safeParse({ route: 'textPrimary', provider: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-reasoner' }).success, true)
assert.equal(aiRouteSchema.safeParse({ route: 'textPrimary', provider: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-reasoner', apiKey: 'sk-secret' }).success, true)
assert.equal('apiKey' in (aiRouteSchema.parse({ route: 'textPrimary', provider: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-reasoner', apiKey: 'sk-secret' })), false)
assert.equal(agentCapabilityRegistry.diagnose_ai_routing.inputSchema.safeParse({ scope: 'all', includeRecentFallbacks: true }).success, true)
assert.equal('apiKey' in agentCapabilityRegistry.diagnose_ai_routing.inputSchema.parse({ scope: 'all', apiKey: 'sk-secret' }), false)
assert.equal(Object.keys(agentCapabilityRegistry.restore_ai_routing_preview.inputSchema.parse({ apiKey: 'sk-secret', model: 'do-not-accept' })).length, 0)

assert.equal(agentCapabilityRegistry.check_schedule_conflicts.inputSchema.safeParse({ startDate: '2026-07-25T14:00', endDate: '2026-07-25T16:00', excludeTaskId: 12 }).success, true)
assert.equal(agentCapabilityRegistry.query_agenda.inputSchema.safeParse({ startDate: '2026-07-25', endDate: '2026-07-31', durationMinutes: 90, workingDayStart: '09:00', workingDayEnd: '18:00', slotStepMinutes: 30 }).success, true)
assert.equal(agentCapabilityRegistry.query_agenda.inputSchema.safeParse({ durationMinutes: 10 }).success, false)
assert.equal(agentCapabilityRegistry.query_agenda.inputSchema.safeParse({ workingDayStart: '9点' }).success, false)
assert.equal(agentCapabilityRegistry.schedule_reminder_preview.inputSchema.safeParse({ taskId: 12, goal: '提醒验收', remindAt: '2026-07-26T09:00:00+08:00' }).success, true)
assert.equal(agentCapabilityRegistry.generate_settlement_receipt.inputSchema.safeParse({ startDate: '2026-07-31', endDate: '2026-07-01' }).success, true, '跨字段日期顺序由确定性 Worker 校验')
assert.equal(agentCapabilityRegistry.generate_settlement_receipt.policy.confirmation, 'none')
assert.equal(agentCapabilityRegistry.generate_settlement_receipt.policy.risk, 'write')
assert.equal(agentCapabilityRegistry.reconcile_settlement_export.inputSchema.safeParse({ exportId: 'settlement-1' }).success, true)
assert.equal(agentCapabilityRegistry.reconcile_settlement_export.inputSchema.safeParse({ startDate: '2026-07-01', endDate: '2026-07-31' }).success, true)
assert.equal(agentCapabilityRegistry.manage_settlement_export_preview.inputSchema.safeParse({ exportId: 'settlement-1', action: 'delete_unlocked', password: 'do-not-accept' }).success, true)
assert.equal('password' in agentCapabilityRegistry.manage_settlement_export_preview.inputSchema.parse({ exportId: 'settlement-1', action: 'delete_unlocked', password: 'do-not-accept' }), false)
assert.equal(agentCapabilityRegistry.manage_task_plan_preview.inputSchema.safeParse({ planId: 'plan-1', action: 'pause' }).success, true)
assert.equal(agentCapabilityRegistry.manage_task_plan_preview.inputSchema.safeParse({ planId: 'plan-1', action: 'retry_step' }).success, true, 'stepId 由 Worker 按动作做跨字段校验')
assert.equal(agentCapabilityRegistry.manage_task_plan_preview.inputSchema.safeParse({ planId: 'plan-1', action: 'complete_step', stepId: 'plan-1:step-1' }).success, false)

console.log('Agent business tool deterministic tests passed.')
