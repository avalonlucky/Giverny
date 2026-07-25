import assert from 'node:assert/strict'
import { agentCapabilityAllows, agentCapabilityRegistry, agentWorkflowWriteEndpoints } from '../src/agentToolRegistry.ts'

assert.equal(agentCapabilityAllows('enterprise-memory', 'viewer', 'GET'), true)
assert.equal(agentCapabilityAllows('enterprise-memory', 'client', 'GET'), false)
assert.equal(agentCapabilityAllows('manage-enterprise-memory-preview', 'collaborator', 'POST'), true)
assert.equal(agentCapabilityAllows('manage-enterprise-memory-preview', 'viewer', 'POST'), false)
assert.equal(agentCapabilityRegistry.manage_enterprise_memory_preview.executeWith, 'manage_enterprise_memory')
assert.equal(agentCapabilityRegistry.manage_enterprise_memory.previewFor, 'manage_enterprise_memory_preview')
assert.ok(agentWorkflowWriteEndpoints.has('manage-enterprise-memory'))

const create = { action: 'create', scopeType: 'partner', scopeKey: '昂楷', memoryType: 'preference', title: '验收文件偏好', content: '验收时优先提供 PDF。', sourceType: 'manual', sourceLabel: '2026-07-25 人工确认' }
assert.equal(agentCapabilityRegistry.manage_enterprise_memory_preview.inputSchema.safeParse(create).success, true)
assert.equal(agentCapabilityRegistry.manage_enterprise_memory_preview.inputSchema.safeParse({ ...create, scopeType: 'unknown' }).success, false)
assert.equal(agentCapabilityRegistry.query_enterprise_memory.inputSchema.safeParse({ query: '验收偏好', scopeType: 'partner', limit: 20 }).success, true)
assert.equal(agentCapabilityRegistry.query_enterprise_memory.inputSchema.safeParse({ limit: 101 }).success, false)

console.log('Agent enterprise memory deterministic tests passed.')
