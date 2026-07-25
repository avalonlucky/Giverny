import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const runtime = readFileSync('agent-evals/isolated-runtime.mjs', 'utf8')
const isolatedEval = readFileSync('agent-evals/run-isolated.mjs', 'utf8')
const browserEval = readFileSync('agent-evals/start-browser-eval.mjs', 'utf8')
const browserRunner = readFileSync('scripts/run-browser-eval.mjs', 'utf8')
const workflow = readFileSync('.github/workflows/agent-quality-gate.yml', 'utf8')
const executableEvalSources = readdirSync('agent-evals')
  .filter((name) => name.endsWith('.mjs'))
  .map((name) => readFileSync(join('agent-evals', name), 'utf8'))
  .join('\n')
const failures = []

if (existsSync('agent-evals/wrangler.eval.toml') || existsSync('agent-evals/run-wrangler-d1.mjs')) {
  failures.push('旧 Wrangler 隔离评测配置必须删除')
}
if (/\b(?:npx\s+)?wrangler\b/i.test(`${executableEvalSources}\n${browserRunner}\n${workflow}`)) {
  failures.push('Agent、浏览器或 CI 可执行链路禁止调用 Wrangler')
}
if (!packageJson.devDependencies?.miniflare) failures.push('Miniflare 必须是显式的开发依赖')
for (const contract of [
  'new Miniflare',
  'd1Databases',
  'r2Buckets',
  'durableObjects',
  'workflows',
  '.metadata_never_index',
  'async restart()',
  'async dispose()',
]) {
  if (!runtime.includes(contract)) failures.push(`隔离运行时缺少契约：${contract}`)
}
if (!isolatedEval.includes("from './isolated-runtime.mjs'") || !browserEval.includes("from './isolated-runtime.mjs'")) {
  failures.push('Agent 与浏览器评测必须共用同一隔离运行时')
}
if (!isolatedEval.includes('runRuntimeRestartRecoveryCheck') || !isolatedEval.includes('isolatedRuntime.restart()')) {
  failures.push('全链路评测必须覆盖 workerd 重启后的 D1/R2/幂等恢复')
}
if (!isolatedEval.includes('rmSync(isolatedRuntime.persistPath') || !browserEval.includes('rmSync(isolatedRuntime.persistPath')) {
  failures.push('隔离评测必须在进程退出时同步兜底清理临时目录')
}
if (!packageJson.scripts?.['agent:quality:gate']?.includes('agent:eval:isolated') || !packageJson.scripts?.['agent:quality:gate']?.includes('browser:eval')) {
  failures.push('发布前 Agent 质量门必须串行执行工具链和浏览器隔离评测')
}
if (!workflow.includes('npm run agent:quality:gate')) failures.push('CI 必须执行与本机一致的 Agent 质量门')

if (failures.length > 0) {
  console.error(`无 Wrangler 隔离评测架构守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log('无 Wrangler 隔离评测架构守卫通过：Agent、浏览器和 CI 共用 Miniflare workerd + 临时 D1/R2/DO/Workflow，并覆盖重启恢复与强制清理。')
