import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
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

process.on('exit', () => stopActiveSuite('SIGTERM'))

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

for (const [index, suite] of suites.entries()) {
  let passed = false
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const appPort = 8799 + index + attempt * 100
    const modelPort = 8899 + index + attempt * 100
    const label = `${suite.project} / 第 ${suite.chunkIndex + 1}/${testChunks.length} 组（${suite.testCount} 条）`
    console.log(`\nBrowser eval: ${label}${attempt ? '（Worker 异常后重试）' : ''}`)
    const result = await runSuite(
      ['playwright', 'test', `--project=${suite.project}`, `--grep=${suite.grep}`],
      {
        ...process.env,
        BROWSER_EVAL_APP_PORT: String(appPort),
        BROWSER_EVAL_MODEL_PORT: String(modelPort),
      },
    )
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
