import { writeFile } from 'node:fs/promises'
import { agentCapabilityManifest } from '../src/agentToolRegistry.ts'

const capabilities = agentCapabilityManifest()
const counts = capabilities.reduce((result, capability) => {
  result[capability.category] = (result[capability.category] || 0) + 1
  return result
}, {})

const escapeCell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
const rows = capabilities.map((capability) => [
  `\`${capability.name}\``,
  capability.title,
  capability.category,
  capability.risk,
  capability.confirmation,
  capability.roles.join(', '),
  capability.scopes.join(', '),
  capability.exposure.join(', '),
  `\`${capability.auditEvent}\``,
].map(escapeCell).join(' | '))

const output = `# Agent Capability Registry

> 本文由 \`npm run agent-capabilities:generate\` 根据 \`src/agentToolRegistry.ts\` 自动生成，请勿手工维护能力清单。

## 概览

- 注册能力：${capabilities.length} 项
- 分类：${Object.entries(counts).map(([name, count]) => `${name} ${count}`).join('、')}
- 单一来源：输入 schema、权限角色、scope、风险、确认方式、审计事件、Runtime 暴露面和执行关系均来自统一注册表。

## 能力清单

能力名 | 标题 | 分类 | 风险 | 确认 | 允许角色 | Scope | 暴露面 | 审计事件
--- | --- | --- | --- | --- | --- | --- | --- | ---
${rows.join('\n')}

## 约束

- 模型只能调用标记为 \`model\` 的能力。
- MCP 只注册标记为 \`mcp\` 的只读能力。
- 写入预览必须通过 \`executeWith\` 关联一个签名执行能力；执行能力必须通过 \`previewFor\` 反向关联。
- Workflow 写入白名单由 \`signed-execute + workflow\` 自动生成，禁止维护第二份端点列表。
- Worker 鉴权依据注册表中的 method 与 role 判断；业务写入审计事件也直接读取注册表。
- OpenAPI 的通用路径、输入 schema 与 \`x-giverny-capabilities\` 清单由注册表生成。
`

await writeFile(new URL('../docs/AGENT_CAPABILITY_REGISTRY.md', import.meta.url), output)
console.log(`Generated Agent capability documentation for ${capabilities.length} capabilities.`)
