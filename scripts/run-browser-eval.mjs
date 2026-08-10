import { spawn } from 'node:child_process'
import { readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const testSource = readFileSync(new URL('../tests/browser/critical-flows.spec.ts', import.meta.url), 'utf8')
const testTitles = [...testSource.matchAll(/^test\('([^']+)'/gm)].map((match) => match[1])
const chunkSize = 18
const testChunks = Array.from(
  { length: Math.ceil(testTitles.length / chunkSize) },
  (_, index) => testTitles.slice(index * chunkSize, (index + 1) * chunkSize),
)
const escapePattern = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const projects = ['desktop-chromium', 'mobile-chromium']
const suites = projects.flatMap((project) =>
  testChunks.map((titles, chunkIndex) => ({
    project,
    chunkIndex,
    grep: titles.map(escapePattern).join('|'),
    testCount: titles.length,
  })),
)

// 每个（分组 × 重试）都独占一对端口，避免上一轮残留进程和下一轮抢同一个端口。
const portBase = 8700
const portSlot = (index, attempt) => attempt * suites.length + index
const suitePorts = (index, attempt) => ({
  appPort: portBase + portSlot(index, attempt) * 2,
  modelPort: portBase + portSlot(index, attempt) * 2 + 1,
})

// 只回收评测自己的进程，外部占用端口时报错而不是误杀用户进程。
const evalProcessPattern = /workerd|agent-evals\/(?:start-browser-eval|mock-model)\.mjs/

let activeSuiteProcess = null
let interruptedSignal = ''

function stopActiveSuite(signal = 'SIGTERM') {
  const child = activeSuiteProcess
  if (!child?.pid || child.exitCode !== null) return
  try {
    process.kill(-child.pid, signal)
  } catch {
    try {
      child.kill(signal)
    } catch {
      // The suite already exited while shutdown was propagating.
    }
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    interruptedSignal = signal
    stopActiveSuite('SIGTERM')
    setTimeout(() => stopActiveSuite('SIGKILL'), 3000).unref()
  })
}

process.on('exit', () => stopActiveSuite('SIGKILL'))

function readCommandOutput(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'ignore'] })
    let stdout = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.once('error', () => resolve(''))
    child.once('close', () => resolve(stdout))
  })
}

async function portHolders(port) {
  const listed = await readCommandOutput('lsof', ['-ti', `tcp:${port}`])
  return [...new Set(
    listed.split('\n')
      .map((value) => Number(value.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 1 && pid !== process.pid),
  )]
}

async function describeProcess(pid) {
  return (await readCommandOutput('ps', ['-o', 'command=', '-p', String(pid)])).trim()
}

// Playwright 被强杀时 webServer 进程组会被收养，端口不会马上释放；
// 这里在每组结束后确认端口真的空了，必要时按进程回收，再交给下一组。
async function releasePorts(ports) {
  const stubborn = []
  for (const port of ports) {
    for (let round = 0; round < 3; round += 1) {
      const holders = await portHolders(port)
      if (holders.length === 0) break
      if (round === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500))
        continue
      }
      for (const pid of holders) {
        const command = await describeProcess(pid)
        if (!evalProcessPattern.test(command)) {
          stubborn.push(`端口 ${port} 被外部进程占用：pid ${pid} ${command}`)
          continue
        }
        try {
          process.kill(pid, round === 1 ? 'SIGTERM' : 'SIGKILL')
        } catch {
          // The leftover process exited on its own.
        }
      }
      await new Promise((resolve) => setTimeout(resolve, round === 1 ? 1500 : 500))
    }
  }
  for (const warning of stubborn) console.warn(`浏览器回归提示：${warning}`)
}

// start-browser-eval 自己带孤儿看护，这里再兜一层，防止看护还没触发就开下一组。
async function reapOrphanedEvalServers() {
  const listed = await readCommandOutput('ps', ['-eo', 'pid=,ppid=,command='])
  for (const line of listed.split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)
    if (!match) continue
    const [, pid, parentPid, command] = match
    if (Number(parentPid) !== 1) continue
    if (!/agent-evals\/start-browser-eval\.mjs/.test(command)) continue
    try {
      process.kill(Number(pid), 'SIGKILL')
      console.warn(`浏览器回归提示：已回收孤立的评测服务进程 pid ${pid}`)
    } catch {
      // The orphan exited before it could be reaped.
    }
  }
}

// workerd 的隔离 D1/R2 目录单组约 13MB，被强杀时会留在 tmp 里，必须每组结束后回收。
const evalStoragePrefix = 'giverny-browser-eval-'

async function hasLiveEvalServer() {
  const listed = await readCommandOutput('ps', ['-eo', 'command='])
  return listed.split('\n').some((line) => /agent-evals\/start-browser-eval\.mjs/.test(line))
}

async function sweepEvalStorage() {
  // 并发跑第二个 browser:eval 时不要动别人的隔离目录。
  if (await hasLiveEvalServer()) return
  let entries = []
  try {
    entries = readdirSync(tmpdir()).filter((name) => name.startsWith(evalStoragePrefix))
  } catch {
    return
  }
  for (const name of entries) {
    try {
      rmSync(join(tmpdir(), name), { recursive: true, force: true, maxRetries: 3 })
    } catch {
      // 目录仍被占用时留给下一轮回收。
    }
  }
}

function runSuite(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', args, {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
      detached: true,
    })
    activeSuiteProcess = child
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (activeSuiteProcess === child) activeSuiteProcess = null
      resolve({ status: code, signal })
    })
  })
}

// 上一次被中断的评测可能留下隔离目录，开跑前先清干净。
await reapOrphanedEvalServers()
await sweepEvalStorage()

for (const [index, suite] of suites.entries()) {
  let passed = false
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { appPort, modelPort } = suitePorts(index, attempt)
    const label = `${suite.project} / 第 ${suite.chunkIndex + 1}/${testChunks.length} 组（${suite.testCount} 条）`
    console.log(`\nBrowser eval: ${label}${attempt ? '（Worker 异常后重试）' : ''}`)
    await releasePorts([appPort, modelPort])
    const result = await runSuite(
      ['playwright', 'test', `--project=${suite.project}`, `--grep=${suite.grep}`],
      {
        ...process.env,
        BROWSER_EVAL_APP_PORT: String(appPort),
        BROWSER_EVAL_MODEL_PORT: String(modelPort),
      },
    )
    // 无论这一组是通过、失败还是被中断，都先把进程组和端口收干净再继续。
    stopActiveSuite('SIGKILL')
    await reapOrphanedEvalServers()
    await releasePorts([appPort, modelPort])
    await sweepEvalStorage()
    if (interruptedSignal) {
      process.exitCode = interruptedSignal === 'SIGINT' ? 130 : 143
      process.exit()
    }
    if (result.status === 0) {
      passed = true
      break
    }
  }
  if (!passed) {
    console.error(`浏览器回归失败：${suite.project} / ${suite.grep}`)
    process.exit(1)
  }
}

console.log(`\n浏览器回归全部通过：桌面 ${testTitles.length}/${testTitles.length}，移动 ${testTitles.length}/${testTitles.length}。`)
