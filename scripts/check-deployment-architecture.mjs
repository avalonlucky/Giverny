import { readFileSync } from 'node:fs'
import process from 'node:process'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const deploySource = readFileSync('scripts/deploy-cloudflare-api.mjs', 'utf8')
const apiSource = readFileSync('scripts/lib/cloudflare-api.mjs', 'utf8')
const infraSource = readFileSync('scripts/sync-cloudflare-infrastructure.mjs', 'utf8')
const deployScripts = Object.entries(packageJson.scripts || {}).filter(([name]) => name.startsWith('deploy:'))
const failures = []

if (packageJson.scripts?.['deploy:production'] !== 'npm run build && npm run infra:sync && node scripts/deploy-cloudflare-api.mjs && npm run agent:fact:production') {
  failures.push('deploy:production 必须先同步 Cloudflare 基础设施，再使用 HTTP API 发布器并执行生产 Agent 事实协议验收')
}
for (const [name, command] of deployScripts) {
  if (/\bwrangler\b/i.test(command)) failures.push(`${name} 禁止调用 Wrangler`)
}
if (deploySource.includes("'.wrangler'")) failures.push('HTTP API 发布器禁止读取 Wrangler 配置路径')
if (!apiSource.includes('refreshOAuthToken') || !apiSource.includes('refresh_token')) {
  failures.push('共享 Cloudflare HTTP API 客户端必须支持 OAuth 凭证自动刷新')
}
for (const marker of ['/versions?bindings_inherit=strict', '/deployments', 'Cloudflare-Workers-Version-Overrides', 'Cloudflare-Workers-Version-Key', 'findCandidateAffinityKey', 'waitForCandidate', '自动回滚']) {
  if (!deploySource.includes(marker)) failures.push(`HTTP API 发布器缺少受控发布能力：${marker}`)
}
for (const marker of ['/queues', '/consumers', 'dead_letter_queue', '/script-settings', 'observability', 'traces', '--check']) {
  if (!infraSource.includes(marker)) failures.push(`Cloudflare 基础设施同步器缺少能力：${marker}`)
}

if (failures.length > 0) {
  console.error(`部署架构守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log('部署架构守卫通过：HTTP API 会先同步队列、DLQ 与 Tracing，再执行候选验证和失败回滚。')
