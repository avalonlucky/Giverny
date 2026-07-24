import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, extname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const accountId = 'ccd312f47f0dca574199fa6e33758c6d'
const workerName = 'designer-worklog'
const apiRoot = `https://api.cloudflare.com/client/v4/accounts/${accountId}`
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const assetsDirectory = join(root, 'dist')
const bundlePath = '/private/tmp/giverny-worker-api-deploy.mjs'
const authPath = join(homedir(), '.config', 'giverny', 'cloudflare-auth.json')

const contentTypes = {
  '.css': 'text/css', '.gif': 'image/gif', '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg',
  '.js': 'text/javascript', '.json': 'application/json', '.mjs': 'text/javascript',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.webm': 'video/webm', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
}

async function loadToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN
  if (existsSync(authPath)) {
    const saved = JSON.parse(await readFile(authPath, 'utf8'))
    if (saved.apiToken) return saved.apiToken
  }

  const legacyPath = join(homedir(), '.wrangler', 'config', 'default.toml')
  if (!existsSync(legacyPath)) {
    throw new Error(`缺少 Cloudflare API Token。请设置 CLOUDFLARE_API_TOKEN 或写入 ${authPath}`)
  }
  const legacy = await readFile(legacyPath, 'utf8')
  const token = legacy.match(/^oauth_token = "([^"]+)"/m)?.[1]
  if (!token) throw new Error('旧凭证中没有可迁移的 Cloudflare OAuth Token')

  await mkdir(dirname(authPath), { recursive: true, mode: 0o700 })
  await writeFile(authPath, `${JSON.stringify({ apiToken: token }, null, 2)}\n`, { mode: 0o600 })
  process.stdout.write(`Cloudflare 凭证已迁移到 ${authPath}，后续不再读取旧配置。\n`)
  return token
}

async function apiRequest(token, path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, ...options.headers },
    signal: AbortSignal.timeout(120_000),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.success === false) {
    const detail = payload.errors?.map((item) => `${item.code}: ${item.message}`).join('; ') || response.statusText
    throw new Error(`Cloudflare API ${response.status}: ${detail}`)
  }
  return payload.result ?? payload
}

async function listFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(path))
    else if (entry.isFile()) files.push(path)
  }
  return files
}

async function createAssetManifest() {
  const filesByHash = new Map()
  const manifest = {}
  for (const path of await listFiles(assetsDirectory)) {
    const content = await readFile(path)
    const extension = extname(path).slice(1)
    const hash = createHash('sha256').update(`${content.toString('base64')}${extension}`).digest('hex').slice(0, 32)
    const assetPath = `/${relative(assetsDirectory, path).split('\\').join('/')}`
    manifest[assetPath] = { hash, size: content.length }
    filesByHash.set(hash, { content, contentType: contentTypes[extname(path).toLowerCase()] || 'application/octet-stream' })
  }
  return { manifest, filesByHash }
}

async function uploadAssets(token, manifest, filesByHash) {
  const session = await apiRequest(token, `/workers/scripts/${workerName}/assets-upload-session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ manifest }),
  })
  let completionToken = session.jwt
  for (const [index, bucket] of session.buckets.entries()) {
    const form = new FormData()
    for (const hash of bucket) {
      const file = filesByHash.get(hash)
      if (!file) throw new Error(`资源清单缺少哈希 ${hash}`)
      form.append(hash, new Blob([file.content.toString('base64')], { type: file.contentType }), hash)
    }
    const response = await fetch(`${apiRoot}/workers/assets/upload?base64=true`, {
      method: 'POST',
      headers: { authorization: `Bearer ${session.jwt}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload.success === false) throw new Error(`静态资源第 ${index + 1} 批上传失败：${JSON.stringify(payload.errors || payload)}`)
    completionToken = payload.result?.jwt || payload.jwt || completionToken
  }
  return completionToken
}

async function bundleWorker() {
  await build({
    entryPoints: [join(root, 'src', 'worker.ts')],
    outfile: bundlePath,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    conditions: ['workerd', 'worker', 'browser'],
    mainFields: ['module', 'main'],
    external: ['cloudflare:*'],
    sourcemap: false,
    logLevel: 'warning',
  })
  return readFile(bundlePath)
}

async function deploy() {
  if (!existsSync(join(assetsDirectory, 'index.html'))) throw new Error('dist 尚未构建，请先运行 npm run build')
  const token = await loadToken()
  const settings = await apiRequest(token, `/workers/scripts/${workerName}/settings`)
  const { manifest, filesByHash } = await createAssetManifest()
  process.stdout.write(`正在登记 ${Object.keys(manifest).length} 个静态资源…\n`)
  const assetToken = await uploadAssets(token, manifest, filesByHash)
  const workerBundle = await bundleWorker()
  const keepBindings = [...new Set((settings.bindings || []).map((binding) => binding.type).filter((type) => type !== 'assets'))]
  const metadata = {
    main_module: 'worker.mjs',
    compatibility_date: settings.compatibility_date || '2026-06-10',
    compatibility_flags: settings.compatibility_flags || ['nodejs_compat'],
    usage_model: settings.usage_model || 'standard',
    keep_bindings: keepBindings,
    bindings: [{ name: 'ASSETS', type: 'assets' }],
    assets: {
      jwt: assetToken,
      config: { not_found_handling: 'single-page-application', run_worker_first: ['/*'] },
    },
    observability: settings.observability,
  }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json')
  form.append('worker.mjs', new Blob([workerBundle], { type: 'application/javascript+module' }), 'worker.mjs')
  const result = await apiRequest(token, `/workers/scripts/${workerName}`, { method: 'PUT', body: form })
  process.stdout.write(`Cloudflare API 发布完成：${result.id || workerName} · ${result.modified_on || new Date().toISOString()}\n`)
}

await deploy()
