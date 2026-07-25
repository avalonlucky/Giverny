import { readFileSync } from 'node:fs'
import process from 'node:process'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const deploySource = readFileSync('scripts/deploy-cloudflare-api.mjs', 'utf8')
const deployScripts = Object.entries(packageJson.scripts || {}).filter(([name]) => name.startsWith('deploy:'))
const failures = []

if (packageJson.scripts?.['deploy:production'] !== 'npm run build && node scripts/deploy-cloudflare-api.mjs && npm run agent:fact:production') {
  failures.push('deploy:production 必须使用 Cloudflare HTTP API 发布器并执行生产 Agent 事实协议验收')
}
for (const [name, command] of deployScripts) {
  if (/\bwrangler\b/i.test(command)) failures.push(`${name} 禁止调用 Wrangler`)
}
if (deploySource.includes("'.wrangler'")) failures.push('HTTP API 发布器禁止读取 Wrangler 配置路径')
if (!deploySource.includes('refreshCloudflareOAuthToken') || !deploySource.includes('refresh_token')) {
  failures.push('HTTP API 发布器必须支持 OAuth 凭证自动刷新')
}

if (failures.length > 0) {
  console.error(`部署架构守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log('部署架构守卫通过：正式发布仅使用可自动刷新凭证的 Cloudflare HTTP API Direct Upload，并强制执行生产 Agent 事实协议验收。')
