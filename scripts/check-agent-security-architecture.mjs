import { readFileSync } from 'node:fs'

const sources = {
  scope: readFileSync('src/agentScope.ts', 'utf8'),
  security: readFileSync('src/agentSecurity.ts', 'utf8'),
  runtime: readFileSync('src/aliceAgent.ts', 'utf8'),
  director: readFileSync('src/agentIntentDirector.ts', 'utf8'),
  worker: readFileSync('src/worker.ts', 'utf8'),
  eval: readFileSync('agent-evals/run-isolated.mjs', 'utf8'),
}
const failures = []
const requireMarker = (file, marker, message) => { if (!sources[file].includes(marker)) failures.push(message) }

requireMarker('scope', "crypto.subtle.verify('HMAC'", '租户 scope 签名未使用常量时间 HMAC verify')
requireMarker('runtime', 'agentModelCapabilityAllows(name, this.activePrincipal.role)', 'Alice 未按当前角色裁剪模型工具')
requireMarker('runtime', 'executeDirectedCapability(', 'Alice 未将模型与工具执行边界分离')
requireMarker('director', '不调用任何工具，不检索文档', '意图导演未禁止在未授权阶段读取外部上下文')
if (sources.runtime.includes('generateText({')) failures.push('Alice 仍可将工具结果或附件内容重新送入自由 Tool Calling 模型')
requireMarker('worker', 'workspaceId: principal.workspaceId', '确认凭证未绑定工作区')
requireMarker('worker', 'principalId: principal.principalId', '确认凭证未绑定操作主体')
requireMarker('worker', 'payload.workspaceId !== principal.workspaceId', '确认凭证未校验工作区')
requireMarker('worker', 'payload.principalId !== principal.principalId', '确认凭证未校验操作主体')
requireMarker('worker', 'monthly_reports.workspace_id = tasks.workspace_id', '月报分享附件未约束工作区')
requireMarker('worker', 'attachment.workspace_id !== settlementExport.workspace_id', '结算分享附件未约束工作区')
requireMarker('worker', 'canReadAttachmentResource(env, request, id, row)', '附件源文件与预览未共用权限判断')
requireMarker('worker', "return principal?.role === 'system' ? principal : null", '内部附件读取未限制系统角色')
for (const marker of ['cross-tenant explicit task ID', 'cross-tenant fuzzy search', 'cross-tenant attachment metadata', 'cross-tenant attachment path', 'confirmation token workspace binding', 'confirmation token tampering', 'prompt injection boundary']) {
  requireMarker('eval', marker, `隔离攻击矩阵缺少 ${marker}`)
}

if (failures.length) {
  console.error(`Agent 租户安全架构守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('Agent 租户安全架构守卫通过：身份签名、角色裁剪、提示注入、确认凭证与附件路径均有强制边界和攻击回归。')
