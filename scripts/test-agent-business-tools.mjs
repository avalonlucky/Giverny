import assert from 'node:assert/strict'
import {
  agentCapabilityAllows,
  agentCapabilityRegistry,
  agentWorkflowWriteEndpoints,
} from '../src/agentToolRegistry.ts'

const previewPairs = [
  ['export_settlement_preview', 'export_settlement'],
  ['manage_settlement_export_preview', 'manage_settlement_export'],
  ['reschedule_task_preview', 'reschedule_task'],
  ['schedule_reminder_preview', 'schedule_reminder'],
  ['configure_ai_route_preview', 'configure_ai_route'],
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
  'export-settlement-preview',
  'manage-settlement-export-preview',
  'inspect-ai-settings',
  'test-ai-route',
  'configure-ai-route-preview',
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
assert.equal(agentCapabilityAllows('settlement-exports', 'viewer', 'GET'), true)
assert.equal(agentCapabilityAllows('settlement-reconciliation', 'viewer', 'GET'), true)
assert.equal(agentCapabilityAllows('settlement-exports', 'client', 'GET'), false)
assert.equal(agentCapabilityAllows('settlement-reconciliation', 'client', 'GET'), false)

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

assert.equal(agentCapabilityRegistry.check_schedule_conflicts.inputSchema.safeParse({ startDate: '2026-07-25T14:00', endDate: '2026-07-25T16:00', excludeTaskId: 12 }).success, true)
assert.equal(agentCapabilityRegistry.schedule_reminder_preview.inputSchema.safeParse({ taskId: 12, goal: '提醒验收', remindAt: '2026-07-26T09:00:00+08:00' }).success, true)
assert.equal(agentCapabilityRegistry.export_settlement_preview.inputSchema.safeParse({ startDate: '2026-07-31', endDate: '2026-07-01' }).success, true, '跨字段日期顺序由确定性 Worker 校验')
assert.equal(agentCapabilityRegistry.reconcile_settlement_export.inputSchema.safeParse({ exportId: 'settlement-1' }).success, true)
assert.equal(agentCapabilityRegistry.reconcile_settlement_export.inputSchema.safeParse({ startDate: '2026-07-01', endDate: '2026-07-31' }).success, true)
assert.equal(agentCapabilityRegistry.manage_settlement_export_preview.inputSchema.safeParse({ exportId: 'settlement-1', action: 'delete_unlocked', password: 'do-not-accept' }).success, true)
assert.equal('password' in agentCapabilityRegistry.manage_settlement_export_preview.inputSchema.parse({ exportId: 'settlement-1', action: 'delete_unlocked', password: 'do-not-accept' }), false)

console.log('Agent business tool deterministic tests passed.')
