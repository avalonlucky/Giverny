import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { decideCanaryPromotion } from '../src/agentGovernance.ts'
import { cloudflareAccountApiRoot as apiRoot, cloudflareAccountRequest as apiRequest, loadCloudflareToken as loadToken } from './lib/cloudflare-api.mjs'

const workerName = 'designer-worklog'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const assetsDirectory = join(root, 'dist')
const bundlePath = '/private/tmp/giverny-worker-api-deploy.mjs'
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

async function probeCandidate(versionId, affinityKey = '') {
  const headers = {
    'cache-control': 'no-cache',
    ...(affinityKey
      ? { 'Cloudflare-Workers-Version-Key': affinityKey }
      : { 'Cloudflare-Workers-Version-Overrides': `${workerName}="${versionId}"` }),
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

async function findCandidateAffinityKey(versionId, batches = 20, batchSize = 30) {
  for (let batch = 0; batch < batches; batch += 1) {
    const candidates = Array.from({ length: batchSize }, (_, index) => `giverny-${versionId}-${batch * batchSize + index}`)
    const results = await Promise.all(candidates.map(async (key) => {
      const response = await fetch(`${productionUrl}/api/health?affinity=${encodeURIComponent(key)}`, {
        headers: { 'cache-control': 'no-cache', 'Cloudflare-Workers-Version-Key': key },
        signal: AbortSignal.timeout(20_000),
      }).catch(() => null)
      const health = response ? await response.json().catch(() => ({})) : {}
      return response?.ok && health.ok === true && String(health.version || '') === releaseVersion ? key : ''
    }))
    const matched = results.find(Boolean)
    if (matched) return matched
  }
  return ''
}

async function waitForCandidate(versionId, attempts = 7) {
  let latest
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    latest = await probeCandidate(versionId)
    if (latest.decision.action === 'promote') return latest
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  const affinityKey = await findCandidateAffinityKey(versionId)
  if (affinityKey) latest = await probeCandidate(versionId, affinityKey)
  return latest
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
    { version_id: previousVersionId, percentage: 99 },
    { version_id: candidateVersionId, percentage: 1 },
  ], `v${releaseVersion} 候选验证`)
  try {
    const probe = await waitForCandidate(candidateVersionId)
    if (probe.decision.action !== 'promote') {
      throw new Error(`候选验证失败：${probe.decision.failures.join('；')}（版本 ${probe.health?.version || '无'} / ${releaseVersion}；资源 ${probe.observedAsset || '无'} / ${probe.expectedAsset || '无'}）`)
    }
    await createDeployment(token, [{ version_id: candidateVersionId, percentage: 100 }], `v${releaseVersion} 候选验证通过，正式推广`)
    process.stdout.write(`Cloudflare 受控发布完成：v${releaseVersion} · ${candidateVersionId} · 健康、事实协议、版本与资源校验通过\n`)
  } catch (error) {
    await createDeployment(token, [{ version_id: previousVersionId, percentage: 100 }], `v${releaseVersion} 候选失败，自动回滚`)
    throw new Error(`候选版本未通过，已自动回滚到 ${previousVersionId}：${error instanceof Error ? error.message : String(error)}`)
  }
}

await deploy()
