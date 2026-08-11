import { randomBytes } from 'node:crypto'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import process from 'node:process'
import {
  cloudflareAccountApiRoot,
  cloudflareAccountId,
  loadCloudflareToken,
} from './lib/cloudflare-api.mjs'

const workerName = 'designer-worklog'
const tunnelName = 'giverny-adk-dmit'
const hostname = 'adk.mayeai.com'
const origin = 'http://127.0.0.1:18080'
const apiRoot = 'https://api.cloudflare.com/client/v4'

async function request(token, url, options = {}) {
  const response = await fetch(url, {
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

async function prepare(outputPath) {
  if (!outputPath) throw new Error('prepare 需要安全输出文件路径')
  const token = await loadCloudflareToken()
  const tunnels = await request(token, `${cloudflareAccountApiRoot}/cfd_tunnel?is_deleted=false`)
  let tunnel = tunnels.find((item) => item.name === tunnelName)
  if (!tunnel) {
    tunnel = await request(token, `${cloudflareAccountApiRoot}/cfd_tunnel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: tunnelName, config_src: 'cloudflare' }),
    })
  }
  await request(token, `${cloudflareAccountApiRoot}/cfd_tunnel/${tunnel.id}/configurations`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      config: {
        ingress: [
          { hostname, service: origin, originRequest: { connectTimeout: 30 } },
          { service: 'http_status:404' },
        ],
      },
    }),
  })

  const zones = await request(token, `${apiRoot}/zones?name=mayeai.com`)
  const zone = zones[0]
  if (!zone?.id) throw new Error('Cloudflare 中未找到 mayeai.com zone')
  const records = await request(token, `${apiRoot}/zones/${zone.id}/dns_records?name=${encodeURIComponent(hostname)}`)
  const recordBody = {
    type: 'CNAME',
    name: hostname,
    content: `${tunnel.id}.cfargotunnel.com`,
    proxied: true,
    ttl: 1,
    comment: 'Giverny ADK Runtime on DMIT via outbound-only Cloudflare Tunnel',
  }
  if (records[0]?.id) {
    await request(token, `${apiRoot}/zones/${zone.id}/dns_records/${records[0].id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(recordBody),
    })
  } else {
    await request(token, `${apiRoot}/zones/${zone.id}/dns_records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(recordBody),
    })
  }

  const tunnelToken = await request(token, `${cloudflareAccountApiRoot}/cfd_tunnel/${tunnel.id}/token`)
  const bundle = {
    tunnelId: tunnel.id,
    tunnelToken,
    runtimeKey: randomBytes(48).toString('base64url'),
    toolToken: randomBytes(48).toString('base64url'),
    runtimeUrl: `https://${hostname}`,
  }
  await writeFile(outputPath, `${JSON.stringify(bundle)}\n`, { mode: 0o600 })
  process.stdout.write(`Cloudflare Tunnel 与 DNS 已就绪：${hostname}；密钥仅写入权限 0600 的临时文件。\n`)
}

async function prepareDirect(outputPath) {
  if (!outputPath) throw new Error('prepare-direct 需要安全输出文件路径')
  const bundle = {
    runtimeKey: randomBytes(48).toString('base64url'),
    toolToken: randomBytes(48).toString('base64url'),
    runtimeUrl: 'https://179.253.249.92.sslip.io:8443',
  }
  await writeFile(outputPath, `${JSON.stringify(bundle)}\n`, { mode: 0o600 })
  process.stdout.write('DMIT 直连 Runtime 密钥已写入权限 0600 的临时文件；未创建 Cloudflare Tunnel。\n')
}

async function prepareOrigin(outputPath) {
  if (!outputPath) throw new Error('prepare-origin 需要安全输出文件路径')
  const token = await loadCloudflareToken()
  const zones = await request(token, `${apiRoot}/zones?name=mayeai.com`)
  const zone = zones[0]
  if (!zone?.id) throw new Error('Cloudflare 中未找到 mayeai.com zone')
  const originHostname = 'adk-origin.mayeai.com'
  const records = await request(token, `${apiRoot}/zones/${zone.id}/dns_records?name=${encodeURIComponent(originHostname)}`)
  const recordBody = {
    type: 'A',
    name: originHostname,
    content: '179.253.249.92',
    proxied: false,
    ttl: 300,
    comment: 'Giverny ADK Runtime origin on DMIT; TLS and runtime-key protected',
  }
  if (records[0]?.id) {
    await request(token, `${apiRoot}/zones/${zone.id}/dns_records/${records[0].id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(recordBody),
    })
  } else {
    await request(token, `${apiRoot}/zones/${zone.id}/dns_records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(recordBody),
    })
  }
  const bundle = {
    runtimeKey: randomBytes(48).toString('base64url'),
    toolToken: randomBytes(48).toString('base64url'),
    runtimeUrl: `https://${originHostname}:8443`,
  }
  await writeFile(outputPath, `${JSON.stringify(bundle)}\n`, { mode: 0o600 })
  process.stdout.write(`灰云源站域名已指向 DMIT：${originHostname}；密钥仅写入权限 0600 的临时文件。\n`)
}

async function activate(inputPath) {
  if (!inputPath) throw new Error('activate 需要安全输入文件路径')
  const bundle = JSON.parse(await readFile(inputPath, 'utf8'))
  const token = await loadCloudflareToken()
  for (const [name, text] of Object.entries({
    AGENT_TOOL_TOKEN: bundle.toolToken,
    ADK_AGENT_KEY: bundle.runtimeKey,
    ADK_AGENT_URL: bundle.runtimeUrl,
  })) {
    await request(token, `${cloudflareAccountApiRoot}/workers/scripts/${workerName}/secrets`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, type: 'secret_text', text }),
    })
  }
  process.stdout.write(`Worker 已切换到 ${bundle.runtimeUrl}；未输出任何密钥值。\n`)
}

const [command, path] = process.argv.slice(2)
if (command === 'prepare') await prepare(path)
else if (command === 'prepare-direct') await prepareDirect(path)
else if (command === 'prepare-origin') await prepareOrigin(path)
else if (command === 'activate') await activate(path)
else if (command === 'cleanup') {
  if (!path) throw new Error('cleanup 需要临时文件路径')
  await unlink(path).catch((error) => {
    if (error?.code !== 'ENOENT') throw error
  })
  process.stdout.write('本地临时密钥文件已清理。\n')
} else {
  throw new Error('用法：node scripts/configure-dmit-adk-cloudflare.mjs prepare|prepare-direct|prepare-origin|activate|cleanup <secure-file>')
}
