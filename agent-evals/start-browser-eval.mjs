import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createIsolatedRuntime } from './isolated-runtime.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const appPort = Number(process.env.BROWSER_EVAL_APP_PORT || 8799)
const modelPort = Number(process.env.BROWSER_EVAL_MODEL_PORT || 8899)
const children = []
let isolatedRuntime
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
      // The isolated workerd runtime is still starting.
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
  await isolatedRuntime?.dispose()
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void stop().finally(() => process.exit(0))
  })
}

process.on('exit', () => {
  for (const child of children) if (child.pid && !child.killed) child.kill('SIGTERM')
  if (isolatedRuntime?.persistPath) rmSync(isolatedRuntime.persistPath, { recursive: true, force: true })
})

try {
  const model = start('node', ['agent-evals/mock-model.mjs'], { MOCK_MODEL_PORT: String(modelPort) })
  isolatedRuntime = await createIsolatedRuntime({ appPort, modelPort, prefix: 'giverny-browser-eval-' })
  await Promise.race([
    waitForHealth(`http://127.0.0.1:${appPort}/api/health`),
    model.failed,
  ])
  process.stdout.write(`Browser eval server ready at http://127.0.0.1:${appPort}\n`)
  await new Promise(() => {})
} catch (error) {
  await stop()
  throw error
}
