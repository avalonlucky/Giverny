import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const worker = readFileSync('src/worker.ts', 'utf8')
const alice = readFileSync('src/aliceAgent.ts', 'utf8')
const director = readFileSync('src/agentIntentDirector.ts', 'utf8')
const facts = readFileSync('src/agentFactGuard.ts', 'utf8')

for (const symbol of [
  'agentInspectAttachmentEvidenceTool',
  'agentQueryAttachmentAnalysisTool',
  'agentManageAttachmentAnalysisPreviewTool',
  'agentManageAttachmentAnalysisTool',
  'agentUpdateAttachmentMetadataPreviewTool',
  'agentUpdateAttachmentMetadataTool',
  'extractXlsxTableText',
]) assert.ok(worker.includes(symbol), `multimodal architecture missing ${symbol}`)

assert.match(worker, /agentAttachmentVisibleToRole/)
assert.match(worker, /role !== 'client' \|\| Boolean\(row\.visible_to_client\)/)
assert.match(worker, /修改文件名不能改变真实文件扩展名/)
assert.match(worker, /附件分析状态在确认期间发生变化，请重新预览/)
assert.match(worker, /isLockedReportMonth\(env, row\.settlement_month, principal\.workspaceId\)/)
assert.match(worker, /\[工作表 \$\{sheetIndex \+ 1\}/)
assert.match(director, /inspect_attachment_evidence/)
assert.match(alice, /buildAgentFactSnapshot/)
assert.match(facts, /renderAttachmentEvidence/)
assert.match(facts, /analysisRef/)
assert.match(facts, /extractedTextRef/)

console.log('Agent multimodal architecture guard passed.')
