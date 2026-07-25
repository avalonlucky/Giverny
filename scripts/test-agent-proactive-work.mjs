import assert from 'node:assert/strict'
import { buildAgentProactiveSignals } from '../src/agentProactive.ts'
import { agentCapabilityAllows, agentCapabilityRegistry, agentWorkflowWriteEndpoints } from '../src/agentToolRegistry.ts'

const baseTask = { id: 12, title: '展厅展板设计', status: '进行中', progress: 60, estimatedDeliveryDate: '2026-07-20', estimatedHours: 4, actualHours: 6, hasAcceptanceFile: false, activeWaiting: [] }
const signals = buildAgentProactiveSignals(baseTask, '2026-07-25')
assert.deepEqual(signals.map((item) => item.type), ['overdue', 'hours_overrun'])
assert.equal(signals[0].priority, 'critical')
assert.ok(signals[0].evidence.some((item) => item.includes('2026-07-20')))
assert.ok(signals[0].suggestedPrompt.includes('任务 #12'))

const acceptanceSignals = buildAgentProactiveSignals({ ...baseTask, progress: 100, actualHours: 4, estimatedDeliveryDate: '2026-07-25', hasAcceptanceFile: true, activeWaiting: [{ reason: '等待合作伙伴意见', note: '等待确认', startedAt: '2026-07-24 18:00' }] }, '2026-07-25')
assert.deepEqual(acceptanceSignals.map((item) => item.type), ['ready_for_acceptance', 'waiting_blocked', 'acceptance_note_missing'])
assert.ok(acceptanceSignals.find((item) => item.type === 'waiting_blocked')?.evidence.some((item) => item.includes('等待确认')))
assert.deepEqual(buildAgentProactiveSignals({ ...baseTask, status: '已验收' }, '2026-07-25'), [])
assert.deepEqual(buildAgentProactiveSignals({ ...baseTask, estimatedDeliveryDate: '2026-07-27', actualHours: 4 }, '2026-07-25'), [])

assert.equal(agentCapabilityAllows('proactive-work', 'viewer', 'GET'), true)
assert.equal(agentCapabilityAllows('proactive-work', 'client', 'GET'), false)
assert.equal(agentCapabilityAllows('manage-proactive-item-preview', 'collaborator', 'POST'), true)
assert.equal(agentCapabilityAllows('manage-proactive-item-preview', 'viewer', 'POST'), false)
assert.equal(agentCapabilityRegistry.manage_proactive_item_preview.executeWith, 'manage_proactive_item')
assert.equal(agentCapabilityRegistry.manage_proactive_item.previewFor, 'manage_proactive_item_preview')
assert.ok(agentWorkflowWriteEndpoints.has('manage-proactive-item'))
assert.equal(agentCapabilityRegistry.manage_proactive_item_preview.inputSchema.safeParse({ itemId: 'signal-1', action: 'resolve' }).success, true)
assert.equal(agentCapabilityRegistry.manage_proactive_item_preview.inputSchema.safeParse({ itemId: 'signal-1', action: 'delete' }).success, false)

console.log('Agent proactive work deterministic tests passed.')
