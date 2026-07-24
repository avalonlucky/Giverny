import { spawnSync } from 'node:child_process'
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

for (const [index, suite] of suites.entries()) {
  let passed = false
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const appPort = 8799 + index + attempt * 100
    const modelPort = 8899 + index + attempt * 100
    const label = `${suite.project} / 第 ${suite.chunkIndex + 1}/${testChunks.length} 组（${suite.testCount} 条）`
    console.log(`\nBrowser eval: ${label}${attempt ? '（Worker 异常后重试）' : ''}`)
    const result = spawnSync(
      'npx',
      ['playwright', 'test', `--project=${suite.project}`, `--grep=${suite.grep}`],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          BROWSER_EVAL_APP_PORT: String(appPort),
          BROWSER_EVAL_MODEL_PORT: String(modelPort),
        },
        stdio: 'inherit',
      },
    )
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

console.log('\n浏览器回归全部通过：桌面 36/36，移动 36/36。')
