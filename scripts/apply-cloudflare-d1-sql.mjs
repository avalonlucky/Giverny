import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'

const accountId = 'ccd312f47f0dca574199fa6e33758c6d'
const databaseId = '4b784afe-7d17-4b22-b101-bec380ddc075'
const authPath = `${homedir()}/.config/giverny/cloudflare-auth.json`
const inputPath = process.argv[2]

if (!inputPath) throw new Error('请提供要应用的 SQL 文件路径')
const sqlPath = resolve(inputPath)
if (!existsSync(sqlPath)) throw new Error(`SQL 文件不存在：${sqlPath}`)
const token = process.env.CLOUDFLARE_API_TOKEN || JSON.parse(await readFile(authPath, 'utf8')).apiToken
if (!token) throw new Error('缺少 Giverny Cloudflare API Token')

const source = await readFile(sqlPath, 'utf8')
const statements = source
  .replace(/^\s*--.*$/gm, '')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean)

for (const [index, sql] of statements.entries()) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ sql }),
      signal: AbortSignal.timeout(60_000),
    },
  )
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.success === false) {
    const detail = payload.errors?.map((item) => `${item.code}: ${item.message}`).join('; ') || response.statusText
    throw new Error(`第 ${index + 1}/${statements.length} 条 D1 SQL 执行失败：${detail}`)
  }
}

process.stdout.write(`Cloudflare D1 API 已应用 ${statements.length} 条 SQL：${sqlPath}\n`)
