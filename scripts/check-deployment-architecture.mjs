import { readFileSync } from 'node:fs'
import process from 'node:process'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const deployScripts = Object.entries(packageJson.scripts || {}).filter(([name]) => name.startsWith('deploy:'))
const failures = []

if (packageJson.scripts?.['deploy:production'] !== 'npm run build && node scripts/deploy-cloudflare-api.mjs') {
  failures.push('deploy:production 必须使用 Cloudflare HTTP API 发布器')
}
for (const [name, command] of deployScripts) {
  if (/\bwrangler\b/i.test(command)) failures.push(`${name} 禁止调用 Wrangler`)
}

if (failures.length > 0) {
  console.error(`部署架构守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log('部署架构守卫通过：正式发布仅使用 Cloudflare HTTP API Direct Upload。')
