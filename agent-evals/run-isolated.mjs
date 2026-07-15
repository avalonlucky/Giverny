import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const persistPath = await mkdtemp(join(tmpdir(), 'giverny-agent-eval-'))
const children = []

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', ...options })
    child.on('error', reject)
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)))
  })
}

function start(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk; process.stdout.write(chunk) })
  child.stderr.on('data', (chunk) => { output += chunk; process.stderr.write(chunk) })
  children.push({ child, output: () => output })
  return child
}

async function waitForHealth(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function stopChildren() {
  for (const { child } of children.reverse()) {
    if (!child.pid || child.killed) continue
    try {
      if (process.platform === 'win32') child.kill('SIGTERM')
      else process.kill(-child.pid, 'SIGTERM')
    } catch {
      child.kill('SIGTERM')
    }
  }
}

async function runMcpChecks() {
  const endpoint = 'http://127.0.0.1:8798/mcp'
  const unauthorized = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  })
  if (unauthorized.status !== 401) throw new Error(`MCP unauthorized check returned HTTP ${unauthorized.status}`)

  const loginWithMcpToken = await fetch('http://127.0.0.1:8798/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'mcp@example.com', key: 'mcp_eval_read_token' }),
  })
  if (loginWithMcpToken.status !== 401) throw new Error('MCP read token unexpectedly authenticated to the website')

  const headers = {
    authorization: 'Bearer mcp_eval_read_token',
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  }
  const request = async (id, method, params) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data.error) throw new Error(`MCP ${method} failed: ${JSON.stringify(data.error || data)}`)
    return data.result
  }

  await request(2, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'giverny-isolated-eval', version: '1.0.0' },
  })
  const listed = await request(3, 'tools/list', {})
  const names = Array.isArray(listed.tools) ? listed.tools.map((item) => item.name).sort() : []
  const expected = ['get_giverny_context', 'get_task_detail', 'query_month_finance', 'search_tasks']
  if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error(`Unexpected MCP tools: ${names.join(', ')}`)
  const called = await request(4, 'tools/call', { name: 'get_giverny_context', arguments: {} })
  if (called.isError || !Array.isArray(called.content) || !called.content.some((item) => item.type === 'text')) {
    throw new Error('MCP context tool did not return text content')
  }
  process.stdout.write('MCP authentication, tool list, and read-only call checks passed.\n')
}

async function runWorkflowWriteCheck(cookie) {
  const endpoint = 'http://127.0.0.1:8798/api/ai/chat'
  const conversationId = `workflow-write-${crypto.randomUUID()}`
  const request = async (message) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'x-giverny-agent-eval': '1' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }],
        month: '2026-07',
        agentRuntimeConversationId: conversationId,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || `Workflow eval returned HTTP ${response.status}`)
    return data
  }
  const preview = await request('新建一个 Workflow 隔离评测任务')
  if (preview.approval?.status !== 'pending' || preview.approval?.action !== 'create_task') {
    throw new Error('Workflow eval did not return a pending create-task approval')
  }
  let result = await request('确认')
  for (let attempt = 0; result.approval?.status === 'processing' && attempt < 5; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    result = await request('确认')
  }
  if (result.approval?.status !== 'executed' || !result.approval?.result?.taskId) {
    throw new Error(`Workflow write did not complete: ${JSON.stringify(result.approval || result)}`)
  }
  if (!Array.isArray(result.trace) || !result.trace.join('\n').includes('Workflow')) {
    throw new Error('Workflow write response did not expose the durable execution trace')
  }
  process.stdout.write('Workflow approval and durable write check passed.\n')
}

async function runWorkflowReplayCheck() {
  const headers = {
    authorization: 'Bearer eval-agent-tool-token',
    'content-type': 'application/json',
  }
  const previewResponse = await fetch('http://127.0.0.1:8798/api/agent/tools/create-task-preview', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'Workflow 幂等评测任务',
      requirement: '验证同一 operationId 不会重复创建任务',
      type: '画册',
      startDate: '2026-07-16T10:00',
      estimatedDate: '2026-07-20T18:00',
      settlementMonth: '2026-07',
      estimatedHours: 2,
    }),
  })
  const preview = await previewResponse.json().catch(() => ({}))
  if (!previewResponse.ok || !preview.confirmationToken) throw new Error('Workflow replay preview failed')
  const operationId = `workflow-replay-${crypto.randomUUID()}`
  const execute = async () => {
    const response = await fetch('http://127.0.0.1:8798/api/agent/tools/workflow-write', {
      method: 'POST',
      headers,
      body: JSON.stringify({ operationId, endpoint: 'create-task', confirmationToken: preview.confirmationToken }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || `Workflow replay returned HTTP ${response.status}`)
    return data
  }
  const first = await execute()
  const replay = await execute()
  if (first.replayed !== false || replay.replayed !== true || first.task?.id !== replay.task?.id) {
    throw new Error('Workflow operation replay was not idempotent')
  }
  process.stdout.write('Workflow idempotent replay check passed.\n')
}

try {
  await run('npx', ['wrangler', 'd1', 'execute', 'giverny-agent-eval', '--local', '--config', 'agent-evals/wrangler.eval.toml', '--persist-to', persistPath, '--file', 'db/schema.sql'])
  await run('npx', ['wrangler', 'd1', 'execute', 'giverny-agent-eval', '--local', '--config', 'agent-evals/wrangler.eval.toml', '--persist-to', persistPath, '--file', 'agent-evals/fixture.sql'])
  start('node', ['agent-evals/mock-model.mjs'], { MOCK_MODEL_PORT: '8898' })
  start('npx', ['wrangler', 'dev', '--local', '--config', 'agent-evals/wrangler.eval.toml', '--persist-to', persistPath, '--port', '8798'])
  await waitForHealth('http://127.0.0.1:8798/api/health')

  const loginResponse = await fetch('http://127.0.0.1:8798/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'bh141425@gmail.com', key: 'eval-admin-key' }),
  })
  const cookie = (loginResponse.headers.get('set-cookie') || '').split(';')[0]
  if (!loginResponse.ok || !cookie) throw new Error('Isolated eval login failed')

  await runMcpChecks()
  await runWorkflowWriteCheck(cookie)
  await runWorkflowReplayCheck()

  await run('node', ['agent-evals/run.mjs'], {
    env: {
      ...process.env,
      GIVERNY_AGENT_EVAL_URL: 'http://127.0.0.1:8798',
      GIVERNY_AGENT_EVAL_COOKIE: cookie,
    },
  })

  const toolErrors = children
    .flatMap((entry) => entry.output().split('\n'))
    .filter((line) => line.includes('/api/agent/tools/') && !line.includes('200 OK'))
  if (toolErrors.length) {
    throw new Error(`Agent tools returned non-200 responses:\n${toolErrors.join('\n')}`)
  }

  await new Promise((resolve) => setTimeout(resolve, 300))
  const metricsResponse = await fetch('http://127.0.0.1:8798/api/ai/agent-metrics?days=7', { headers: { cookie } })
  const metrics = await metricsResponse.json()
  if (!metricsResponse.ok || metrics.summary?.totalRuns !== 0) {
    throw new Error('Eval-tagged traffic leaked into production metrics aggregation')
  }
  process.stdout.write('Isolated D1 and telemetry exclusion checks passed.\n')
} finally {
  stopChildren()
  await rm(persistPath, { recursive: true, force: true })
}
