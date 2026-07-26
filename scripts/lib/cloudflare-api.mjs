import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'

export const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || 'ccd312f47f0dca574199fa6e33758c6d'
export const cloudflareAccountApiRoot = `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}`
const authPath = join(homedir(), '.config', 'giverny', 'cloudflare-auth.json')
const oauthClientId = '54d11594-84e4-41aa-b438-e81b8fa78ee7'
const oauthTokenUrl = 'https://dash.cloudflare.com/oauth2/token'

async function saveAuthState(authState) {
  await mkdir(dirname(authPath), { recursive: true, mode: 0o700 })
  const temporaryPath = `${authPath}.${process.pid}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(authState, null, 2)}\n`, { mode: 0o600 })
  await rename(temporaryPath, authPath)
}

async function refreshOAuthToken(saved) {
  const response = await fetch(oauthTokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: saved.refreshToken, client_id: oauthClientId }),
    signal: AbortSignal.timeout(30_000),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.access_token) {
    const detail = payload.error_description || payload.error || response.statusText
    throw new Error(`Cloudflare OAuth 刷新失败：${detail}`)
  }
  const refreshed = {
    apiToken: payload.access_token,
    refreshToken: payload.refresh_token || saved.refreshToken,
    expirationTime: new Date(Date.now() + Number(payload.expires_in || 3600) * 1000).toISOString(),
    scopes: typeof payload.scope === 'string' ? payload.scope.split(' ') : saved.scopes,
  }
  await saveAuthState(refreshed)
  process.stdout.write('Cloudflare HTTP API 凭证已自动刷新。\n')
  return refreshed.apiToken
}

export async function loadCloudflareToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN
  if (!existsSync(authPath)) throw new Error(`缺少 Cloudflare API 凭证。请设置 CLOUDFLARE_API_TOKEN 或写入 ${authPath}`)
  const saved = JSON.parse(await readFile(authPath, 'utf8'))
  if (saved.refreshToken) return refreshOAuthToken(saved)
  if (saved.apiToken) return saved.apiToken
  throw new Error(`${authPath} 中没有可用的 Cloudflare API 凭证`)
}

export async function cloudflareAccountRequest(token, path, options = {}) {
  const response = await fetch(`${cloudflareAccountApiRoot}${path}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, ...options.headers },
    signal: options.signal || AbortSignal.timeout(120_000),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.success === false) {
    const detail = payload.errors?.map((item) => `${item.code}: ${item.message}`).join('; ') || response.statusText
    throw new Error(`Cloudflare API ${response.status}: ${detail}`)
  }
  return payload.result ?? payload
}
