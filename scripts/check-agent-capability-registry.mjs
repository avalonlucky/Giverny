import { readFileSync } from 'node:fs'
import { agentCapabilityManifest, agentCapabilityRegistry, agentWorkflowWriteEndpoints } from '../src/agentToolRegistry.ts'

const fail = (message) => {
  console.error(`Agent 能力注册表架构守卫失败：${message}`)
  process.exit(1)
}

const manifest = agentCapabilityManifest()
const alice = readFileSync('src/aliceAgent.ts', 'utf8')
const worker = readFileSync('src/worker.ts', 'utf8')
const writeWorkflow = readFileSync('src/agentWriteWorkflow.ts', 'utf8')
const analysisWorkflow = readFileSync('src/agentAnalysisWorkflow.ts', 'utf8')
const docs = readFileSync('docs/AGENT_CAPABILITY_REGISTRY.md', 'utf8')

if (manifest.length < 59) fail(`只登记了 ${manifest.length} 项能力，读取、计划、记忆、主动工作、后台、预览、执行或内部能力存在缺失`)
if (new Set(manifest.map((item) => item.endpoint)).size !== manifest.length) fail('存在重复 endpoint')

for (const capability of manifest) {
  if (!capability.scopes.length || !capability.roles.length || !capability.auditEvent) fail(`${capability.name} 缺少 scope、role 或审计事件`)
  if (!docs.includes(`\`${capability.name}\``)) fail(`生成文档缺少 ${capability.name}`)
  if (capability.exposure.includes('model') && !alice.includes(`capabilities.${capability.name}.inputSchema`)) fail(`AliceAgent 未从注册表读取 ${capability.name} schema`)
}

for (const [name, capability] of Object.entries(agentCapabilityRegistry)) {
  if (capability.policy.confirmation === 'preview') {
    if (!capability.executeWith) fail(`${name} 缺少 executeWith`)
    const execute = agentCapabilityRegistry[capability.executeWith]
    if (!execute || execute.previewFor !== name || execute.policy.confirmation !== 'signed-execute') fail(`${name} 的预览/执行关系不完整`)
  }
  if (capability.policy.confirmation === 'signed-execute') {
    if (!capability.previewFor) fail(`${name} 缺少 previewFor`)
    if (!agentWorkflowWriteEndpoints.has(capability.endpoint)) fail(`${name} 未进入 Workflow 写入白名单`)
  }
}

if (/PREVIEW_ACTIONS|AGENT_TOOL_TRACE_LABELS/.test(alice)) fail('AliceAgent 重新维护了预览或轨迹旁路表')
if (/const agentWorkflowWriteEndpoints/.test(worker)) fail('Worker 重新维护了 Workflow 端点白名单')
if (!worker.includes('agentCapabilityAllows(endpoint, role, method)')) fail('Worker 权限判断未使用注册表')
if (!worker.includes("'x-giverny-capabilities': agentCapabilityManifest()")) fail('OpenAPI 未暴露注册表清单')
if (!worker.includes('Object.entries(agentReadToolRegistry)')) fail('MCP 工具未从注册表批量注册')
if (!writeWorkflow.includes('agentCapabilityRegistry.workflow_write.endpoint')) fail('写入 Workflow 未从注册表读取内部端点')
if (!writeWorkflow.includes("{ ...params.principal, role: 'system' }")) fail('写入 Workflow 未以系统执行角色调用内部端点')
for (const name of ['analysis_job_prepare', 'analysis_job_generate', 'analysis_job_fail']) {
  if (!analysisWorkflow.includes(`agentCapabilityRegistry.${name}.endpoint`)) fail(`分析 Workflow 未从注册表读取 ${name}`)
}
if (!analysisWorkflow.includes("{ ...principal, role: 'system' }")) fail('分析 Workflow 未以系统执行角色调用内部端点')

console.log(`Agent 能力注册表架构守卫通过：${manifest.length} 项能力统一生成 schema、权限、风险、确认、审计、文档与 Runtime 暴露面。`)
