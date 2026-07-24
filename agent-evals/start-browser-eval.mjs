import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { runWranglerD1 } from './run-wrangler-d1.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const persistPath = await mkdtemp(join(tmpdir(), 'giverny-browser-eval-'))
const appPort = Number(process.env.BROWSER_EVAL_APP_PORT || 8799)
const modelPort = Number(process.env.BROWSER_EVAL_MODEL_PORT || 8899)
const children = []
let stopping = false
const proxyEnvKeys = new Set(['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy'])
const localProcessEnv = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !proxyEnvKeys.has(key))),
  NO_PROXY: '127.0.0.1,localhost',
  no_proxy: '127.0.0.1,localhost',
}

function start(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...localProcessEnv, ...env },
    stdio: 'inherit',
  })
  children.push(child)
  const failed = new Promise((_, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => {
      if (!stopping) reject(new Error(`${command} exited before browser eval startup with ${code}`))
    })
  })
  return { child, failed }
}

async function waitForHealth(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Wrangler is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function stop() {
  if (stopping) return
  stopping = true
  for (const child of children.reverse()) {
    if (!child.pid || child.exitCode !== null) continue
    const exited = new Promise((resolve) => child.once('exit', resolve))
    try {
      child.kill('SIGTERM')
    } catch {
      // The process already exited.
    }
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))])
    if (child.exitCode === null) {
      try {
        child.kill('SIGKILL')
      } catch {
        // The process exited while the timeout was being handled.
      }
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 1000))])
    }
  }
  await rm(persistPath, { recursive: true, force: true })
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void stop().finally(() => process.exit(0))
  })
}

process.on('exit', () => {
  for (const child of children) {
    if (child.pid && !child.killed) child.kill('SIGTERM')
  }
})

try {
  await runWranglerD1('npx', ['wrangler', 'd1', 'execute', 'giverny-agent-eval', '--local', '--config', 'agent-evals/wrangler.eval.toml', '--persist-to', persistPath, '--file', 'db/schema.sql'], { cwd: root, env: localProcessEnv })
  await runWranglerD1('npx', ['wrangler', 'd1', 'execute', 'giverny-agent-eval', '--local', '--config', 'agent-evals/wrangler.eval.toml', '--persist-to', persistPath, '--file', 'agent-evals/fixture.sql'], { cwd: root, env: localProcessEnv })
  const model = start('node', ['agent-evals/mock-model.mjs'], { MOCK_MODEL_PORT: String(modelPort) })
  const worker = start('npx', [
    'wrangler', 'dev', '--local', '--config', 'agent-evals/wrangler.eval.toml',
    '--persist-to', persistPath, '--port', String(appPort),
    '--var', `DEEPSEEK_BASE_URL:http://127.0.0.1:${modelPort}`,
    '--var', `DOUBAO_BASE_URL:http://127.0.0.1:${modelPort}`,
    '--var', `GIVERNY_API_BASE_URL:http://127.0.0.1:${appPort}`,
  ])
  await Promise.race([
    waitForHealth(`http://127.0.0.1:${appPort}/api/health`),
    model.failed,
    worker.failed,
  ])
  process.stdout.write(`Browser eval server ready at http://127.0.0.1:${appPort}\n`)
  await new Promise(() => {})
} catch (error) {
  await stop()
  throw error
}
