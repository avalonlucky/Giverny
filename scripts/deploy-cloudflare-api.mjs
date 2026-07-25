import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, extname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { decideCanaryPromotion } from '../src/agentGovernance.ts'

const accountId = 'ccd312f47f0dca574199fa6e33758c6d'
const workerName = 'designer-worklog'
const apiRoot = `https://api.cloudflare.com/client/v4/accounts/${accountId}`
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const assetsDirectory = join(root, 'dist')
const bundlePath = '/private/tmp/giverny-worker-api-deploy.mjs'
const authPath = join(homedir(), '.config', 'giverny', 'cloudflare-auth.json')
const cloudflareOAuthClientId = '54d11594-84e4-41aa-b438-e81b8fa78ee7'
const cloudflareOAuthTokenUrl = 'https://dash.cloudflare.com/oauth2/token'
const productionUrl = 'https://mayeai.com'
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const releaseVersion = String(packageJson.version || '')

const contentTypes = {
  '.css': 'text/css', '.gif': 'image/gif', '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg',
  '.js': 'text/javascript', '.json': 'application/json', '.mjs': 'text/javascript',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.webm': 'video/webm', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
}

async function saveAuthState(authState) {
  await mkdir(dirname(authPath), { recursive: true, mode: 0o700 })
  const temporaryPath = `${authPath}.${process.pid}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(authState, null, 2)}\n`, { mode: 0o600 })
  await rename(temporaryPath, authPath)
}

async function refreshCloudflareOAuthToken(saved) {
  const response = await fetch(cloudflareOAuthTokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: saved.refreshToken,
      client_id: cloudflareOAuthClientId,
    }),
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

async function loadToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN
  if (!existsSync(authPath)) {
    throw new Error(`缺少 Cloudflare API 凭证。请设置 CLOUDFLARE_API_TOKEN 或写入 ${authPath}`)
  }
  const saved = JSON.parse(await readFile(authPath, 'utf8'))
  if (saved.refreshToken) return refreshCloudflareOAuthToken(saved)
  if (saved.apiToken) return saved.apiToken
  throw new Error(`${authPath} 中没有可用的 Cloudflare API 凭证`)
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

function deploymentVersions(value) {
  const deployments = Array.isArray(value) ? value : value?.deployments || []
  return Array.isArray(deployments[0]?.versions) ? deployments[0].versions : []
}

async function createDeployment(token, versions, message) {
  return apiRequest(token, `/workers/scripts/${workerName}/deployments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      strategy: 'percentage',
      versions,
      annotations: {
        'workers/message': message,
      },
    }),
  })
}

async function probeCandidate(versionId) {
  const headers = {
    'cache-control': 'no-cache',
    'Cloudflare-Workers-Version-Overrides': `${workerName}="${versionId}"`,
  }
  const [healthResponse, htmlResponse] = await Promise.all([
    fetch(`${productionUrl}/api/health?canary=${Date.now()}`, { headers, signal: AbortSignal.timeout(20_000) }),
    fetch(`${productionUrl}/?canary=${Date.now()}`, { headers, signal: AbortSignal.timeout(20_000) }),
  ])
  const health = await healthResponse.json().catch(() => ({}))
  const html = await htmlResponse.text()
  const expectedHtml = await readFile(join(assetsDirectory, 'index.html'), 'utf8')
  const assetPattern = /src="(\/assets\/index-[^"]+\.js)"/
  const expectedAsset = expectedHtml.match(assetPattern)?.[1] || ''
  const observedAsset = html.match(assetPattern)?.[1] || ''
  let assetOk = Boolean(expectedAsset && observedAsset && expectedAsset === observedAsset)
  if (assetOk) {
    const assetResponse = await fetch(`${productionUrl}${observedAsset}`, { headers, signal: AbortSignal.timeout(20_000) })
    assetOk = assetResponse.ok
  }
  const decision = decideCanaryPromotion({
    healthOk: healthResponse.ok && health.ok === true,
    factProtocolOk: health.agentFactProtocol?.ok === true && health.agentFactProtocol?.rejectedInvalidAnswer === true,
    assetParityOk: assetOk,
    expectedVersion: releaseVersion,
    observedVersion: String(health.version || ''),
  })
  return { decision, expectedAsset, observedAsset, health }
}

async function deploy() {
  if (!existsSync(join(assetsDirectory, 'index.html'))) throw new Error('dist 尚未构建，请先运行 npm run build')
  const token = await loadToken()
  const settings = await apiRequest(token, `/workers/scripts/${workerName}/settings`)
  const currentDeployments = await apiRequest(token, `/workers/scripts/${workerName}/deployments`)
  const previousVersions = deploymentVersions(currentDeployments)
  const previousVersionId = previousVersions.slice().sort((left, right) => Number(right.percentage) - Number(left.percentage))[0]?.version_id || ''
  const { manifest, filesByHash } = await createAssetManifest()
  process.stdout.write(`正在登记 ${Object.keys(manifest).length} 个静态资源…\n`)
  const assetToken = await uploadAssets(token, manifest, filesByHash)
  const workerBundle = await bundleWorker()
  const inheritedBindings = (settings.bindings || [])
    .filter((binding) => binding.type !== 'assets' && binding.name)
    .map((binding) => ({ name: binding.name, type: 'inherit', version_id: 'latest' }))
  const metadata = {
    main_module: 'worker.mjs',
    compatibility_date: settings.compatibility_date || '2026-06-10',
    compatibility_flags: settings.compatibility_flags || ['nodejs_compat'],
    usage_model: settings.usage_model || 'standard',
    bindings: [...inheritedBindings, { name: 'ASSETS', type: 'assets' }],
    assets: {
      jwt: assetToken,
      config: { not_found_handling: 'single-page-application', run_worker_first: ['/*'] },
    },
    observability: settings.observability,
    annotations: {
      'workers/message': `Giverny v${releaseVersion} candidate`,
      'workers/tag': `v${releaseVersion}`,
    },
  }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json')
  form.append('worker.mjs', new Blob([workerBundle], { type: 'application/javascript+module' }), 'worker.mjs')
  const candidate = await apiRequest(token, `/workers/scripts/${workerName}/versions?bindings_inherit=strict`, { method: 'POST', body: form })
  const candidateVersionId = candidate.id
  if (!candidateVersionId) throw new Error('Cloudflare 未返回候选版本 ID')
  if (!previousVersionId || previousVersionId === candidateVersionId) {
    await createDeployment(token, [{ version_id: candidateVersionId, percentage: 100 }], `v${releaseVersion} 首次受控发布`)
    process.stdout.write(`Cloudflare 受控发布完成：v${releaseVersion} · ${candidateVersionId}\n`)
    return
  }
  process.stdout.write(`候选版本已上传：${candidateVersionId}；正在进行隔离冒烟验证…\n`)
  await createDeployment(token, [
    { version_id: previousVersionId, percentage: 99.99 },
    { version_id: candidateVersionId, percentage: 0.01 },
  ], `v${releaseVersion} 候选验证`)
  try {
    await new Promise((resolve) => setTimeout(resolve, 3000))
    const probe = await probeCandidate(candidateVersionId)
    if (probe.decision.action !== 'promote') {
      throw new Error(`候选验证失败：${probe.decision.failures.join('；')}（资源 ${probe.observedAsset || '无'} / ${probe.expectedAsset || '无'}）`)
    }
    await createDeployment(token, [{ version_id: candidateVersionId, percentage: 100 }], `v${releaseVersion} 候选验证通过，正式推广`)
    process.stdout.write(`Cloudflare 受控发布完成：v${releaseVersion} · ${candidateVersionId} · 健康、事实协议、版本与资源校验通过\n`)
  } catch (error) {
    await createDeployment(token, [{ version_id: previousVersionId, percentage: 100 }], `v${releaseVersion} 候选失败，自动回滚`)
    throw new Error(`候选版本未通过，已自动回滚到 ${previousVersionId}：${error instanceof Error ? error.message : String(error)}`)
  }
}

await deploy()
