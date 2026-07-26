import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { cloudflareAccountRequest, loadCloudflareToken } from './lib/cloudflare-api.mjs'

const databaseId = '4b784afe-7d17-4b22-b101-bec380ddc075'
const inputPath = process.argv[2]

if (!inputPath) throw new Error('请提供要应用的 SQL 文件路径')
const sqlPath = resolve(inputPath)
if (!existsSync(sqlPath)) throw new Error(`SQL 文件不存在：${sqlPath}`)
const token = await loadCloudflareToken()

const source = await readFile(sqlPath, 'utf8')
const statements = source
  .replace(/^\s*--.*$/gm, '')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean)

for (const [index, sql] of statements.entries()) {
  try {
    await cloudflareAccountRequest(token, `/d1/database/${databaseId}/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sql }),
      signal: AbortSignal.timeout(60_000),
    })
  } catch (error) {
    throw new Error(`第 ${index + 1}/${statements.length} 条 D1 SQL 执行失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

process.stdout.write(`Cloudflare D1 API 已应用 ${statements.length} 条 SQL：${sqlPath}\n`)
