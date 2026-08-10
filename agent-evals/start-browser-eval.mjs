import { spawn, spawnSync } from 'node:child_process'
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

// Playwright 用 detached 启动 webServer，所以本进程通常是自己进程组的组长。
// 只有确认是组长时才允许整组回收，否则会误杀外层 Playwright 或用户终端。
const processGroupId = (() => {
  const listed = spawnSync('ps', ['-o', 'pgid=', '-p', String(process.pid)], { encoding: 'utf8' })
  const parsed = Number(listed.stdout?.trim())
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0
})()
const ownsProcessGroup = processGroupId === process.pid
const startupParentPid = process.ppid

function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

// workerd 由 Miniflare 在进程内派生，拿不到句柄，只能按进程组枚举兜底回收。
function processGroupMembers() {
  if (!ownsProcessGroup) return []
  const listed = spawnSync('ps', ['-o', 'pid=', '-g', String(processGroupId)], { encoding: 'utf8' })
  if (!listed.stdout) return []
  return listed.stdout
    .split('\n')
    .map((value) => Number(value.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 1 && pid !== process.pid)
}

function sweepProcessGroup(signal) {
  for (const pid of processGroupMembers()) {
    try {
      process.kill(pid, signal)
    } catch {
      // 该子进程已经退出。
    }
  }
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

const withTimeout = (promise, timeoutMs) => Promise.race([
  promise,
  new Promise((resolve) => setTimeout(resolve, timeoutMs).unref()),
])

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
  // dispose 卡住不能拖住整组回收，否则 workerd 会继续占用端口。
  await withTimeout(isolatedRuntime?.dispose() ?? Promise.resolve(), 8000)
  sweepProcessGroup('SIGTERM')
  await new Promise((resolve) => setTimeout(resolve, 300))
  sweepProcessGroup('SIGKILL')
}

function shutdown(exitCode) {
  setTimeout(() => process.exit(exitCode), 12_000).unref()
  void stop().finally(() => process.exit(exitCode))
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => shutdown(0))
}

// Playwright 被强杀时 webServer 会被 launchd 收养，必须自己发现孤儿状态并退出，
// 否则 workerd 会一直占着端口，让下一组评测启动失败。
const orphanWatchdog = setInterval(() => {
  if (stopping) return
  if (process.ppid === startupParentPid && isAlive(startupParentPid)) return
  process.stderr.write('Browser eval server lost its parent process; shutting down.\n')
  clearInterval(orphanWatchdog)
  shutdown(0)
}, 1000)
orphanWatchdog.unref()

process.on('exit', () => {
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue
    try {
      child.kill('SIGKILL')
    } catch {
      // The process already exited.
    }
  }
  if (isolatedRuntime?.persistPath) rmSync(isolatedRuntime.persistPath, { recursive: true, force: true })
  sweepProcessGroup('SIGKILL')
})

try {
  const model = start('node', ['agent-evals/mock-model.mjs'], {
    MOCK_MODEL_PORT: String(modelPort),
    MOCK_APP_PORT: String(appPort),
  })
  isolatedRuntime = await createIsolatedRuntime({
    appPort,
    modelPort,
    adkRuntimeUrl: `http://127.0.0.1:${modelPort}`,
    prefix: 'giverny-browser-eval-',
  })
  await Promise.race([
    waitForHealth(`http://127.0.0.1:${appPort}/api/health`),
    model.failed,
  ])
  // 启动成功后模型桩若中途退出，必须走同一套清理流程，而不是变成未捕获的 rejection。
  model.failed.catch((error) => {
    if (stopping) return
    process.stderr.write(`Browser eval mock model stopped mid-run: ${error.message}\n`)
    shutdown(1)
  })
  process.stdout.write(`Browser eval server ready at http://127.0.0.1:${appPort}\n`)
  await new Promise(() => {})
} catch (error) {
  await stop()
  throw error
}
