import { readFile } from 'node:fs/promises'
import process from 'node:process'

const suiteUrl = new URL('./cases.json', import.meta.url)
const suite = JSON.parse(await readFile(suiteUrl, 'utf8'))
const cases = Array.isArray(suite.cases) ? suite.cases : []
const ids = new Set()
const errors = []

for (const testCase of cases) {
  if (!testCase.id || !testCase.category || !testCase.prompt || !testCase.expect) {
    errors.push(`无效用例：${JSON.stringify(testCase)}`)
    continue
  }
  if (ids.has(testCase.id)) errors.push(`重复用例 ID：${testCase.id}`)
  ids.add(testCase.id)
  for (const key of ['tools', 'forbiddenTools']) {
    if (testCase.expect[key] && !Array.isArray(testCase.expect[key])) errors.push(`${testCase.id}.${key} 必须是数组`)
  }
}

if (cases.length < 50) errors.push(`评测集至少需要 50 条用例，当前 ${cases.length} 条`)
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

const categories = cases.reduce((result, item) => {
  result[item.category] = (result[item.category] || 0) + 1
  return result
}, {})

if (process.argv.includes('--validate-only') || !process.env.GIVERNY_AGENT_EVAL_URL) {
  console.log(`Agent eval schema passed: ${cases.length} cases`)
  console.log(categories)
  if (!process.argv.includes('--validate-only')) console.log('Set GIVERNY_AGENT_EVAL_URL to run live evaluations.')
  process.exit(0)
}

const baseUrl = process.env.GIVERNY_AGENT_EVAL_URL.replace(/\/+$/, '')
const headers = { 'content-type': 'application/json' }
if (process.env.GIVERNY_AGENT_EVAL_COOKIE) headers.cookie = process.env.GIVERNY_AGENT_EVAL_COOKIE
if (!headers.cookie && process.env.GIVERNY_AGENT_EVAL_AUTH_EMAIL && process.env.GIVERNY_AGENT_EVAL_AUTH_KEY) {
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.GIVERNY_AGENT_EVAL_AUTH_EMAIL,
      key: process.env.GIVERNY_AGENT_EVAL_AUTH_KEY,
    }),
  })
  const setCookie = loginResponse.headers.get('set-cookie') || ''
  const sessionCookie = setCookie.split(';')[0]
  if (!loginResponse.ok || !sessionCookie) {
    const data = await loginResponse.json().catch(() => ({}))
    throw new Error(data.error || `Agent eval 登录失败：HTTP ${loginResponse.status}`)
  }
  headers.cookie = sessionCookie
}

const results = []
for (const testCase of cases) {
  const conversationId = `eval-${testCase.id}-${crypto.randomUUID()}`
  try {
    const response = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [{ role: 'user', content: testCase.prompt }],
        month: '2026-07',
        agentRuntimeConversationId: conversationId,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
    const trace = Array.isArray(data.trace) ? data.trace.join('\n') : ''
    const failures = []
    for (const tool of testCase.expect.tools || []) {
      if (!trace.includes(tool)) failures.push(`未调用 ${tool}`)
    }
    for (const tool of testCase.expect.forbiddenTools || []) {
      if (trace.includes(tool)) failures.push(`误调用 ${tool}`)
    }
    if (testCase.expect.approval && data.approval?.action !== testCase.expect.approval) {
      failures.push(`approval=${data.approval?.action || 'none'}，预期 ${testCase.expect.approval}`)
    }
    if (data.selection && !testCase.expect.selectionAllowed) failures.push('意外返回任务消歧')
    results.push({ id: testCase.id, ok: failures.length === 0, detail: failures.join('；') })
  } catch (error) {
    results.push({ id: testCase.id, ok: false, detail: error instanceof Error ? error.message : String(error) })
  }
}

for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.id}${result.detail ? `: ${result.detail}` : ''}`)
const failed = results.filter((item) => !item.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
