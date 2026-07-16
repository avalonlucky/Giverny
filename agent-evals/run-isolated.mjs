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
  const expected = ['get_giverny_context', 'get_task_detail', 'query_month_finance', 'search_attachments', 'search_tasks']
  if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error(`Unexpected MCP tools: ${names.join(', ')}`)
  const called = await request(4, 'tools/call', { name: 'get_giverny_context', arguments: {} })
  if (called.isError || !Array.isArray(called.content) || !called.content.some((item) => item.type === 'text')) {
    throw new Error('MCP context tool did not return text content')
  }
  const attachmentResult = await request(5, 'tools/call', { name: 'search_attachments', arguments: { query: '直播邀请', limit: 10 } })
  const structuredFiles = attachmentResult.structuredContent?.files
  if (attachmentResult.isError || !Array.isArray(structuredFiles) || structuredFiles.length === 0) {
    throw new Error('MCP attachment search did not return structured files')
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

async function runBackgroundAnalysisCheck(cookie) {
  const headers = { 'content-type': 'application/json', cookie, 'x-giverny-agent-eval': '1' }
  const startResponse = await fetch('http://127.0.0.1:8798/api/ai/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages: [{ role: 'user', content: '帮我做一份 7 月工作复盘' }],
      month: '2026-07',
      agentRuntimeConversationId: `background-analysis-${crypto.randomUUID()}`,
    }),
  })
  const started = await startResponse.json().catch(() => ({}))
  if (!startResponse.ok || started.backgroundTask?.type !== 'monthly_review') {
    throw new Error(`Background analysis did not start: ${JSON.stringify(started)}`)
  }
  const taskId = started.backgroundTask.id
  let completed
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await fetch(`http://127.0.0.1:8798/api/ai/analysis-jobs/${taskId}`, { headers: { cookie } })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || `Background analysis status HTTP ${response.status}`)
    if (data.job?.status === 'completed') {
      completed = data.job
      break
    }
    if (data.job?.status === 'failed') throw new Error(data.job.error || 'Background analysis failed')
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  if (!completed?.result?.includes('本月结论') || completed.progress !== 100) {
    throw new Error(`Background analysis did not complete: ${JSON.stringify(completed || started.backgroundTask)}`)
  }

  const secondStart = await fetch('http://127.0.0.1:8798/api/ai/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages: [{ role: 'user', content: '后台分析一下 6 月整月工作' }],
      month: '2026-06',
      agentRuntimeConversationId: `background-cancel-${crypto.randomUUID()}`,
    }),
  })
  const second = await secondStart.json().catch(() => ({}))
  if (!secondStart.ok || !second.backgroundTask?.id) throw new Error('Cancelable background analysis did not start')
  const cancelResponse = await fetch(`http://127.0.0.1:8798/api/ai/analysis-jobs/${second.backgroundTask.id}/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
  })
  const cancelled = await cancelResponse.json().catch(() => ({}))
  if (!cancelResponse.ok || cancelled.job?.status !== 'cancelled') throw new Error('Background analysis cancellation failed')
  const retryResponse = await fetch(`http://127.0.0.1:8798/api/ai/analysis-jobs/${second.backgroundTask.id}/retry`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
  })
  const retried = await retryResponse.json().catch(() => ({}))
  if (!retryResponse.ok || !['queued', 'running', 'completed'].includes(retried.job?.status)) throw new Error('Background analysis retry failed')
  let retryCompleted = retried.job?.status === 'completed' ? retried.job : null
  for (let attempt = 0; !retryCompleted && attempt < 40; attempt += 1) {
    const response = await fetch(`http://127.0.0.1:8798/api/ai/analysis-jobs/${second.backgroundTask.id}`, { headers: { cookie } })
    const data = await response.json().catch(() => ({}))
    if (data.job?.status === 'completed') retryCompleted = data.job
    if (data.job?.status === 'failed') throw new Error('Retried background analysis failed')
    if (!retryCompleted) await new Promise((resolve) => setTimeout(resolve, 250))
  }
  if (!retryCompleted) throw new Error('Retried background analysis did not complete')
  process.stdout.write('Background monthly review, cancellation, and retry checks passed.\n')
}

async function runAgentWorkspaceCheck(cookie) {
  const headers = { 'content-type': 'application/json', cookie, 'x-giverny-agent-eval': '1' }
  const conversationId = `cloud-conversation-${crypto.randomUUID()}`
  const chatResponse = await fetch('http://127.0.0.1:8798/api/ai/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages: [{ role: 'user', content: '查一下7月有哪些任务' }],
      month: '2026-07',
      agentRuntimeConversationId: conversationId,
    }),
  })
  if (!chatResponse.ok) throw new Error('Cloud conversation seed chat failed')
  const listResponse = await fetch('http://127.0.0.1:8798/api/ai/conversations', { headers: { cookie } })
  const list = await listResponse.json().catch(() => ({}))
  if (!listResponse.ok || !list.conversations?.some((item) => item.id === conversationId)) {
    throw new Error('Cloud conversation index was not persisted')
  }
  const detailResponse = await fetch(`http://127.0.0.1:8798/api/ai/conversations/${conversationId}`, { headers: { cookie } })
  const detail = await detailResponse.json().catch(() => ({}))
  if (!detailResponse.ok || detail.messages?.length < 2) throw new Error('Cloud conversation messages were not restored')

  const importedId = `imported-conversation-${crypto.randomUUID()}`
  const syncResponse = await fetch('http://127.0.0.1:8798/api/ai/conversations/sync', {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversations: [{
      id: importedId,
      title: '旧设备会话',
      messages: [
        { id: crypto.randomUUID(), role: 'user', content: '旧设备问题', createdAt: Date.now() - 2 },
        { id: crypto.randomUUID(), role: 'assistant', content: '旧设备回答', createdAt: Date.now() - 1 },
      ],
    }] }),
  })
  if (!syncResponse.ok) throw new Error('Local conversation migration failed')
  const deleteResponse = await fetch(`http://127.0.0.1:8798/api/ai/conversations/${importedId}`, { method: 'DELETE', headers })
  if (!deleteResponse.ok) throw new Error('Cloud conversation deletion failed')

  const jobsResponse = await fetch('http://127.0.0.1:8798/api/ai/analysis-jobs?unread=1', { headers: { cookie } })
  const jobs = await jobsResponse.json().catch(() => ({}))
  const unread = jobs.jobs?.find((job) => job.unread)
  if (!jobsResponse.ok || !unread) throw new Error('Task center did not expose unread analysis jobs')
  const readResponse = await fetch(`http://127.0.0.1:8798/api/ai/analysis-jobs/${unread.id}/read`, { method: 'POST', headers })
  const read = await readResponse.json().catch(() => ({}))
  if (!readResponse.ok || read.job?.unread !== false) throw new Error('Task center read state was not persisted')
  process.stdout.write('Cloud conversation, migration, deletion, and task notification checks passed.\n')
}

async function runAiLearningCheck(cookie) {
  const response = await fetch('http://127.0.0.1:8798/api/ai/learning-events', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      context: 'task_requirement',
      action: 'rejected',
      sourceInput: '做一张直播邀请海报',
      aiOutput: '1、设计背景：直播活动邀请。\n2、设计要求：科技感蓝色。\n3、输出文件：海报。',
      userFinal: '1、设计背景：用于直播当天邀请。\n2、设计要求：沿用现有主视觉，不新增配色。\n3、输出文件：邀请长图 JPG。',
      designType: '传播类 / 海报',
      taskTitle: 'AI 学习隔离评测',
    }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || result.saved !== true) {
    throw new Error(`AI learning event was not persisted: ${JSON.stringify(result)}`)
  }
  process.stdout.write('AI feedback learning endpoint check passed.\n')
}

async function runHourEstimateLearningCheck(cookie) {
  for (let index = 0; index < 3; index += 1) {
    const learningResponse = await fetch('http://127.0.0.1:8798/api/ai/learning-events', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        context: 'hour_estimate',
        action: 'edited',
        sourceInput: '三个产品视频背景降噪',
        aiOutput: '4',
        userFinal: String(5 + index * 0.5),
        designType: '视频剪辑',
        taskTitle: `工时学习隔离评测 ${index + 1}`,
        metadata: {
          suggestionId: `hour-eval-${index + 1}`,
          source: 'task_submit',
        },
      }),
    })
    const learning = await learningResponse.json().catch(() => ({}))
    if (!learningResponse.ok || learning.saved !== true) {
      throw new Error(`Hour estimate learning event failed: ${JSON.stringify(learning)}`)
    }
  }

  const response = await fetch('http://127.0.0.1:8798/api/ai/hour-estimate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      title: '发布会产品视频降噪',
      requirement: '复用现有剪辑工程，处理产品视频的背景电流声，适配三个尺寸并导出。',
      selectedType: '视频剪辑',
      requester: '陈义君',
      startDate: '2026-07-16T09:00',
      estimatedDate: '2026-07-16T18:00',
      currentEstimatedHours: 4,
    }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`Hour estimate request failed: ${JSON.stringify(result)}`)
  }
  if (result.learningAdjustment?.applied !== true || result.learningAdjustment?.sampleCount < 3) {
    throw new Error(`Hour estimate learning adjustment was not applied: ${JSON.stringify(result.learningAdjustment)}`)
  }
  if (!(result.expectedRange?.low > 0) || result.expectedRange.high < result.expectedRange.low) {
    throw new Error(`Hour estimate range is invalid: ${JSON.stringify(result.expectedRange)}`)
  }
  if (!Array.isArray(result.riskFactors) || !result.accuracy?.summary) {
    throw new Error('Hour estimate reliability details are missing')
  }
  const adaptation = result.complexity?.dimensions?.find((item) => item.key === 'adaptation')
  if (!adaptation?.value?.includes('3')) {
    throw new Error(`Chinese adaptation count was not parsed: ${JSON.stringify(adaptation)}`)
  }
  const scope = result.complexity?.dimensions?.find((item) => item.key === 'scope')
  if (scope?.value?.includes('3')) {
    throw new Error(`Adaptation count leaked into deliverable count: ${JSON.stringify(scope)}`)
  }
  if (!result.matchedTasks?.some((task) => task.similarityReasons?.includes('近期已验收任务'))) {
    throw new Error('Recent historical sample was not identified')
  }

  const createResponse = await fetch('http://127.0.0.1:8798/api/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      id: 0,
      title: '工时自动复盘评测',
      requirement: '复用现有剪辑工程，处理背景电流声，适配三个尺寸并完成一轮修改。',
      type: '视频剪辑',
      date: '2026-07-16T09:00',
      estimatedDate: '2026-07-16T18:00',
      settlementMonth: '2026-07',
      estimatedHours: 5,
      actualHours: 0,
      requester: '陈义君',
      contact: '陈义君',
      reviewer: '黄媚',
      stage: '计划中',
      status: '计划中',
      progress: 0,
      billable: true,
      files: [],
      timeEntries: [],
      waitingEntries: [],
      hourEstimateSuggestionId: result.suggestionId,
    }),
  })
  const created = await createResponse.json().catch(() => ({}))
  if (!createResponse.ok || !created.id) {
    throw new Error(`Hour estimate review task creation failed: ${JSON.stringify(created)}`)
  }
  const acceptResponse = await fetch(`http://127.0.0.1:8798/api/tasks/${created.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      status: '已验收',
      stage: '已验收',
      progress: 100,
      actualDeliveryDate: '2026-07-16T15:00',
      feedbackTags: ['沟通成本高'],
      timeEntries: [{
        id: 'hour-review-entry',
        date: '2026-07-16',
        start: '09:00',
        end: '15:00',
        note: '完成降噪、三个尺寸适配和一轮修改',
        isRevision: true,
        isAcceptanceProgress: true,
      }],
    }),
  })
  const accepted = await acceptResponse.json().catch(() => ({}))
  if (!acceptResponse.ok || accepted.status !== '已验收') {
    throw new Error(`Hour estimate review acceptance failed: ${JSON.stringify(accepted)}`)
  }
  const metricsResponse = await fetch('http://127.0.0.1:8798/api/ai/hour-estimate/metrics?month=2026-07', {
    headers: { cookie },
  })
  const metrics = await metricsResponse.json().catch(() => ({}))
  if (!metricsResponse.ok || metrics.summary?.observedCount < 1 || !metrics.recent?.some((item) => item.taskId === created.id)) {
    throw new Error(`Hour estimate metrics did not include accepted task: ${JSON.stringify(metrics)}`)
  }
  if (!metrics.byType?.some((item) => item.name === '视频剪辑') || !metrics.byRequester?.some((item) => item.name === '陈义君')) {
    throw new Error(`Hour estimate calibration groups are missing: ${JSON.stringify(metrics)}`)
  }
  process.stdout.write('AI hour estimate recency, semantic retrieval, outcome review, metrics, and calibration checks passed.\n')
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
  await runBackgroundAnalysisCheck(cookie)
  await runAgentWorkspaceCheck(cookie)
  await runAiLearningCheck(cookie)
  await runHourEstimateLearningCheck(cookie)

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
    .filter((line) => !line.includes('/monthly-review-generate 409 Conflict'))
    .filter((line) => !line.includes('/analysis-job-generate 409 Conflict'))
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
