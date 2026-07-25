import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const governance = readFileSync('src/agentGovernance.ts', 'utf8')
const worker = readFileSync('src/worker.ts', 'utf8')
const deploy = readFileSync('scripts/deploy-cloudflare-api.mjs', 'utf8')
const operations = readFileSync('src/components/AiOperationsCenterPanel.tsx', 'utf8')
const packageJson = readFileSync('package.json', 'utf8')

for (const marker of ['minimumSuccessRate: 99', 'minimumFactVerificationRate: 100', 'maximumFallbackRate: 1', 'evaluateEmergencyFallback', 'decideCanaryPromotion']) {
  assert.ok(governance.includes(marker), `governance missing ${marker}`)
}
assert.match(worker, /evaluateAgentSlo/)
assert.match(worker, /evaluateEmergencyFallback/)
assert.match(worker, /主模型尚未达到应急回退条件/)
assert.match(operations, /生产保护/)
assert.match(operations, /主模型纪律/)
assert.match(deploy, /workers\/scripts\/\$\{workerName\}\/versions/)
assert.match(deploy, /Cloudflare-Workers-Version-Overrides/)
assert.match(deploy, /自动回滚/)
assert.match(packageJson, /agent:governance:test/)

console.log('Agent governance architecture guard passed.')
