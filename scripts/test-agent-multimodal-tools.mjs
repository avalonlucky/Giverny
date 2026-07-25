import assert from 'node:assert/strict'
import { agentCapabilityAllows, agentCapabilityRegistry, agentWorkflowWriteEndpoints } from '../src/agentToolRegistry.ts'

for (const endpoint of ['attachment-evidence', 'attachment-analysis-status']) {
  assert.equal(agentCapabilityAllows(endpoint, 'viewer', 'GET'), true)
  assert.equal(agentCapabilityAllows(endpoint, 'client', 'GET'), true)
}

for (const endpoint of ['manage-attachment-analysis-preview', 'update-attachment-metadata-preview']) {
  assert.equal(agentCapabilityAllows(endpoint, 'collaborator', 'POST'), true)
  assert.equal(agentCapabilityAllows(endpoint, 'viewer', 'POST'), false)
  assert.equal(agentCapabilityAllows(endpoint, 'client', 'POST'), false)
}

for (const [previewName, executeName] of [
  ['manage_attachment_analysis_preview', 'manage_attachment_analysis'],
  ['update_attachment_metadata_preview', 'update_attachment_metadata'],
]) {
  const preview = agentCapabilityRegistry[previewName]
  const execute = agentCapabilityRegistry[executeName]
  assert.equal(preview.executeWith, executeName)
  assert.equal(execute.previewFor, previewName)
  assert.equal(preview.policy.confirmation, 'preview')
  assert.equal(execute.policy.confirmation, 'signed-execute')
  assert.ok(agentWorkflowWriteEndpoints.has(execute.endpoint))
}

assert.equal(agentCapabilityRegistry.inspect_attachment_evidence.inputSchema.safeParse({ attachmentIds: [101], includeExtractedText: true }).success, true)
assert.equal(agentCapabilityRegistry.inspect_attachment_evidence.inputSchema.safeParse({ attachmentIds: [] }).success, false)
assert.equal(agentCapabilityRegistry.manage_attachment_analysis_preview.inputSchema.safeParse({ attachmentIds: [101, 102], action: 'retry' }).success, true)
assert.equal(agentCapabilityRegistry.manage_attachment_analysis_preview.inputSchema.safeParse({ attachmentIds: [101], action: 'delete' }).success, false)
assert.equal(agentCapabilityRegistry.update_attachment_metadata_preview.inputSchema.safeParse({ attachmentId: 101, name: '验收通过截图', scope: 'acceptance', visibleToClient: true }).success, true)

console.log('Agent multimodal tool deterministic tests passed.')
