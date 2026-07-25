import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const worker = readFileSync('src/worker.ts', 'utf8')
const alice = readFileSync('src/aliceAgent.ts', 'utf8')
const chat = readFileSync('src/components/ChatPanel.tsx', 'utf8')
const registry = readFileSync('src/agentToolRegistry.ts', 'utf8')

for (const symbol of [
  'agentQuerySettlementExportsTool',
  'agentReconcileSettlementTool',
  'agentAgendaTool',
  'agentScheduleConflictsTool',
  'agentPrepareAttachmentUploadTool',
  'agentInspectAiSettingsTool',
  'agentTestAiRouteTool',
  'agentExportSettlementPreviewTool',
  'agentExportSettlementTool',
  'agentManageSettlementPreviewTool',
  'agentManageSettlementTool',
  'agentReschedulePreviewTool',
  'agentRescheduleTool',
  'agentScheduleReminderPreviewTool',
  'agentScheduleReminderTool',
  'agentConfigureAiRoutePreviewTool',
  'agentConfigureAiRouteTool',
  'agentQueryProjectExecutionTool',
  'agentManageTaskPlanPreviewTool',
  'agentManageTaskPlanTool',
]) assert.ok(worker.includes(symbol), `Worker missing ${symbol}`)

assert.match(worker, /settlementSnapshotChecksum\(receipt\) !== draft\.snapshotChecksum/)
assert.match(worker, /scheduleSnapshotChecksum/)
assert.match(worker, /任务排期在确认期间发生变化，请重新预览/)
assert.match(worker, /相关任务或冲突列表在确认期间发生变化，请重新预览/)
assert.match(worker, /schedulingMethod:/)
assert.match(worker, /action === 'delete_unlocked' && row\.locked/)
assert.match(worker, /settlementExportFingerprint\(before\) !== draft\.recordFingerprint/)
assert.match(worker, /DELETE FROM settlement_exports WHERE id = \? AND workspace_id = \? AND locked = 0/)
assert.match(worker, /missingTaskIds/)
assert.match(worker, /coverage\.overlaps/)
assert.match(worker, /transport: 'authenticated-browser-to-r2'/)
assert.match(worker, /apiKeyExposed: false/)
assert.match(worker, /Agent 只能使用平台默认地址或已在设置页登记的服务商地址/)
assert.ok(!registry.match(/apiKey:\s*z\./), 'Agent capability schema must never accept a plaintext API key')
assert.match(chat, /api\.uploadFile\(\{ taskId: handoff\.taskId/)
assert.match(chat, /上传接力返回的文件清单与当前附件不一致/)
assert.match(alice, /uploadHandoff = rawHandoff/)
assert.match(worker, /kind: 'reminder'/)
assert.match(worker, /isLockedReportMonth\(env, task\.settlement_month, workspaceId\)/)
assert.match(worker, /执行计划只反映编排状态/)
assert.match(worker, /执行计划在确认前已发生变化，请重新预览/)
assert.match(worker, /action === 'retry_step'/)
assert.doesNotMatch(registry, /manage_task_plan_preview[\s\S]{0,1200}complete_step/)

console.log('Agent business tool architecture guard passed.')
