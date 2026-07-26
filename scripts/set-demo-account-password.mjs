import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { cloudflareAccountRequest, loadCloudflareToken } from './lib/cloudflare-api.mjs'

const databaseId = '4b784afe-7d17-4b22-b101-bec380ddc075'
const password = String(process.env.DEMO_ACCOUNT_PASSWORD || '')
if (password.length < 14) throw new Error('DEMO_ACCOUNT_PASSWORD 至少需要 14 位')

const iterations = 100000
const salt = randomBytes(16)
const digest = pbkdf2Sync(password, salt, iterations, 32, 'sha256')
const passwordHash = `pbkdf2-sha256$${iterations}$${salt.toString('base64')}$${digest.toString('base64')}`
const token = await loadCloudflareToken()

await cloudflareAccountRequest(token, `/d1/database/${databaseId}/query`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    sql: `INSERT INTO app_settings (key, value, updated_at) VALUES ('demoAccountPasswordHash', ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    params: [passwordHash],
  }),
  signal: AbortSignal.timeout(60_000),
})

process.stdout.write('演示账号密码已通过 Cloudflare D1 API 更新，明文未写入仓库。\n')
