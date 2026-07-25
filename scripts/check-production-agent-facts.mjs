import process from 'node:process'

const healthUrl = process.env.AGENT_FACT_HEALTH_URL || 'https://mayeai.com/api/health'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let lastFailure = ''
for (let attempt = 1; attempt <= 4; attempt += 1) {
  const response = await fetch(`${healthUrl}${healthUrl.includes('?') ? '&' : '?'}factProtocol=${Date.now()}`, {
    headers: { 'cache-control': 'no-cache' },
    signal: AbortSignal.timeout(20_000),
  })
  const payload = await response.json().catch(() => ({}))
  const protocol = payload.agentFactProtocol || {}
  if (response.ok && payload.ok === true && protocol.ok === true && protocol.rejectedInvalidAnswer === true && Number(protocol.checkedClaims) > 0 && Array.isArray(protocol.coveredSources) && protocol.coveredSources.length >= 2) {
    console.log(`生产 Agent 事实协议验收通过：${protocol.checkedClaims} 条声明，覆盖 ${protocol.coveredSources.join('、')}，错误事实已拒绝。`)
    process.exit(0)
  }
  lastFailure = `HTTP ${response.status} ${JSON.stringify(payload)}`
  if (attempt < 4) await sleep(5000)
}
console.error(`生产 Agent 事实协议验收失败：${lastFailure}`)
process.exit(1)
