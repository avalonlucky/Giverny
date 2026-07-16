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

async function runAgentLifecycleWriteCheck() {
  const headers = { authorization: 'Bearer eval-agent-tool-token', 'content-type': 'application/json' }
  const previewAndExecute = async (previewEndpoint, executeEndpoint, payload) => {
    const previewResponse = await fetch(`http://127.0.0.1:8798/api/agent/tools/${previewEndpoint}`, {
      method: 'POST', headers, body: JSON.stringify(payload),
    })
    const preview = await previewResponse.json().catch(() => ({}))
    if (!previewResponse.ok || preview.ready !== true || !preview.confirmationToken) {
      throw new Error(`${previewEndpoint} preview failed: ${JSON.stringify(preview)}`)
    }
    const response = await fetch('http://127.0.0.1:8798/api/agent/tools/workflow-write', {
      method: 'POST', headers,
      body: JSON.stringify({ operationId: `lifecycle-${crypto.randomUUID()}`, endpoint: executeEndpoint, confirmationToken: preview.confirmationToken }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || result.ok !== true) throw new Error(`${executeEndpoint} execute failed: ${JSON.stringify(result)}`)
    return result
  }
  const created = await previewAndExecute('create-task-preview', 'create-task', {
    title: 'Agent 全生命周期隔离评测', requirement: '验证等待、记录维护与完整验收原子写入', type: '画册',
    startDate: '2026-07-16T09:00', estimatedDate: '2026-07-20T18:00', settlementMonth: '2026-07', estimatedHours: 4,
  })
  const taskId = Number(created.task?.id)
  if (!taskId) throw new Error('Lifecycle task was not created')
  const progress = await previewAndExecute('append-progress-preview', 'append-progress', {
    taskId, note: '完成第一版排版', startDateTime: '2026-07-16T09:00', endDateTime: '2026-07-16T11:00',
  })
  const waiting = await previewAndExecute('append-waiting-preview', 'append-waiting', {
    taskId, note: '等待甲方补充文字', reason: '等待补充资料', startDateTime: '2026-07-16T11:00', endDateTime: '2026-07-16T12:00',
  })
  await previewAndExecute('manage-record-preview', 'manage-record', {
    taskId, recordType: 'progress', action: 'edit', recordId: progress.entry.id, changes: { note: '完成第一版排版与校对' },
  })
  await previewAndExecute('manage-record-preview', 'manage-record', {
    taskId, recordType: 'waiting', action: 'delete', recordId: waiting.entry.id,
  })
  await previewAndExecute('mark-acceptance-files-preview', 'mark-acceptance-files', { taskId: 1, attachmentIds: [104] })
  const accepted = await previewAndExecute('complete-acceptance-preview', 'complete-acceptance', {
    taskId,
    acceptanceNote: '已完成排版、校对与最终交付。',
    progressNote: '完成最终文件整理并提交验收。',
    endDateTime: '2026-07-16T18:00',
    countTime: false,
  })
  if (accepted.task?.status !== '已验收' || accepted.task?.progress !== 100 || accepted.task?.acceptanceNote !== '已完成排版、校对与最终交付。') {
    throw new Error(`Complete acceptance package is inconsistent: ${JSON.stringify(accepted.task)}`)
  }
  if (accepted.task?.waitingEntries?.length !== 0 || !accepted.task?.timeEntries?.some((entry) => entry.note === '完成第一版排版与校对')) {
    throw new Error(`Lifecycle record maintenance is inconsistent: ${JSON.stringify(accepted.task)}`)
  }
  const fileResponse = await fetch('http://127.0.0.1:8798/api/agent/tools/search-attachments?query=封套过程稿V1', { headers })
  const fileResult = await fileResponse.json().catch(() => ({}))
  const marked = fileResult.files?.find((file) => file.id === 104)
  if (!fileResponse.ok || marked?.scope !== 'acceptance' || marked?.tag !== '验收文件') {
    throw new Error(`Acceptance file marking is inconsistent: ${JSON.stringify(fileResult)}`)
  }
  process.stdout.write('Agent waiting, record maintenance, acceptance file, and complete acceptance workflow checks passed.\n')
}

async function runAgentOrchestrationCheck(cookie) {
  const toolHeaders = { authorization: 'Bearer eval-agent-tool-token', 'content-type': 'application/json' }
  const conversationId = `plan-${crypto.randomUUID()}`
  const planResponse = await fetch('http://127.0.0.1:8798/api/agent/tools/create-task-plan', {
    method: 'POST',
    headers: toolHeaders,
    body: JSON.stringify({
      conversationId,
      taskId: 1,
      goal: '持续推进公司产品封套修改直到验收',
      steps: [
        { label: '记录制作进展', action: 'append_progress' },
        { label: '整理验收文件', action: 'mark_acceptance_files' },
        { label: '完成验收', action: 'complete_acceptance' },
      ],
    }),
  })
  const created = await planResponse.json().catch(() => ({}))
  if (!planResponse.ok || created.plan?.steps?.length !== 3) throw new Error(`Agent plan creation failed: ${JSON.stringify(created)}`)

  const memoryResponse = await fetch('http://127.0.0.1:8798/api/agent/tools/get-task-memory?taskId=1', { headers: toolHeaders })
  const memory = await memoryResponse.json().catch(() => ({}))
  if (!memoryResponse.ok || memory.memory?.taskId !== 1 || !memory.memory?.summary) throw new Error(`Task memory refresh failed: ${JSON.stringify(memory)}`)

  const progressResponse = await fetch('http://127.0.0.1:8798/api/agent/tools/progress-task-plan', {
    method: 'POST',
    headers: toolHeaders,
    body: JSON.stringify({ conversationId, taskId: 1, action: 'append_progress' }),
  })
  const progressed = await progressResponse.json().catch(() => ({}))
  if (!progressResponse.ok || progressed.updated !== 1) throw new Error(`Agent plan progression failed: ${JSON.stringify(progressed)}`)

  const listResponse = await fetch('http://127.0.0.1:8798/api/ai/agent-plans', { headers: { cookie } })
  const listed = await listResponse.json().catch(() => ({}))
  const plan = listed.plans?.find((item) => item.id === created.plan.id)
  if (!listResponse.ok || plan?.steps?.[0]?.status !== 'completed' || plan.currentStep !== 1) {
    throw new Error(`Agent task center plan is inconsistent: ${JSON.stringify(plan)}`)
  }
  const updatePlan = async (action, stepId) => {
    const response = await fetch(`http://127.0.0.1:8798/api/ai/agent-plans/${created.plan.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ action, stepId }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.plan) throw new Error(`Plan ${action} failed: ${JSON.stringify(data)}`)
    return data.plan
  }
  const paused = await updatePlan('pause')
  if (paused.status !== 'paused' || !paused.pausedAt) throw new Error('Agent plan pause was not persisted')
  const resumed = await updatePlan('resume')
  if (resumed.status !== 'active' || resumed.pausedAt) throw new Error('Agent plan resume was not persisted')
  const manuallyCompleted = await updatePlan('complete_step', resumed.steps[1].id)
  if (manuallyCompleted.steps[1].status !== 'completed') throw new Error('Agent plan manual step completion failed')
  const reopened = await updatePlan('reopen_step', resumed.steps[1].id)
  if (reopened.steps[1].status !== 'pending') throw new Error('Agent plan step reopening failed')

  const updateMemory = async (payload) => {
    const response = await fetch('http://127.0.0.1:8798/api/ai/task-memories/1', {
      method: 'PATCH', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(payload),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.memory) throw new Error(`Memory update failed: ${JSON.stringify(data)}`)
    return data.memory
  }
  const corrected = await updateMemory({ action: 'add_note', note: '甲方更偏好简洁排版' })
  if (!corrected.userNotes.includes('甲方更偏好简洁排版')) throw new Error('Task memory correction was not persisted')
  const disabled = await updateMemory({ action: 'set_enabled', enabled: false })
  if (!disabled.disabled || disabled.summary) throw new Error('Task memory forget operation failed')
  const enabled = await updateMemory({ action: 'set_enabled', enabled: true })
  if (enabled.disabled || !enabled.summary) throw new Error('Task memory re-enable failed')

  const failuresResponse = await fetch('http://127.0.0.1:8798/api/ai/agent-failures', { headers: { cookie } })
  const failures = await failuresResponse.json().catch(() => ({}))
  const failure = failures.cases?.find((item) => item.regressionStatus === 'required')
  if (!failuresResponse.ok || !failure) throw new Error('Failure learning dashboard did not expose required case')
  const coveredResponse = await fetch(`http://127.0.0.1:8798/api/ai/agent-failures/${encodeURIComponent(failure.fingerprint)}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ status: 'covered', note: 'isolated regression' }),
  })
  const covered = await coveredResponse.json().catch(() => ({}))
  if (!coveredResponse.ok || !covered.cases?.some((item) => item.fingerprint === failure.fingerprint && item.regressionStatus === 'covered')) {
    throw new Error('Failure regression status update failed')
  }

  const metricsResponse = await fetch('http://127.0.0.1:8798/api/ai/agent-metrics?days=7', { headers: { cookie } })
  const metrics = await metricsResponse.json().catch(() => ({}))
  if (!metricsResponse.ok || typeof metrics.summary?.promptTokens !== 'number' || typeof metrics.summary?.completionTokens !== 'number' || !Array.isArray(metrics.models) || !metrics.tuning) {
    throw new Error(`Agent cost and tuning metrics are incomplete: ${JSON.stringify(metrics)}`)
  }
  process.stdout.write('Persistent Agent plan, step progression, and task memory checks passed.\n')
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
      requirement: '复用现有剪辑工程，完成 1 条产品视频背景电流声降噪；甲方已提供完整视频与文案，适配三个尺寸，包含一轮修改，由陈义君确认并导出。',
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
  if (!(result.requirementQuality?.score >= 50) || !result.requirementQuality?.grade || !result.decision?.mode) {
    throw new Error(`Hour estimate requirement quality or decision is missing: ${JSON.stringify({ requirementQuality: result.requirementQuality, decision: result.decision })}`)
  }
  if (!(result.pricing?.regularAmount > 0) || !(result.pricing.safeAmount >= result.pricing.regularAmount)) {
    throw new Error(`Hour estimate pricing is invalid: ${JSON.stringify(result.pricing)}`)
  }
  if (result.modelVersion?.algorithm !== '3.1.0' || !result.modelVersion?.prompt || !result.modelVersion?.provider) {
    throw new Error(`Hour estimate version metadata is missing: ${JSON.stringify(result.modelVersion)}`)
  }
  if (!Array.isArray(result.completionOptions) || !result.changeAudit?.summary) {
    throw new Error(`Hour estimate completion or change audit is missing: ${JSON.stringify({ completionOptions: result.completionOptions, changeAudit: result.changeAudit })}`)
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
  const feedbackSample = result.matchedTasks?.[0]
  if (feedbackSample) {
    const sampleFeedbackResponse = await fetch('http://127.0.0.1:8798/api/ai/hour-estimate/sample-feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        suggestionId: result.suggestionId,
        sampleTaskId: feedbackSample.id,
        relevant: false,
        reason: '隔离评测标记为不相似',
      }),
    })
    const sampleFeedback = await sampleFeedbackResponse.json().catch(() => ({}))
    if (!sampleFeedbackResponse.ok || sampleFeedback.relevant !== false) {
      throw new Error(`Hour estimate sample feedback failed: ${JSON.stringify(sampleFeedback)}`)
    }
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

  let replayQuoteTaskId = 0
  for (let index = 0; index < 6; index += 1) {
    const replaySuggestionResponse = await fetch('http://127.0.0.1:8798/api/ai/hour-estimate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        title: `工时回放评测 ${index + 1}`,
        requirement: '复用现有剪辑工程，完成 1 条产品视频降噪；甲方已提供完整视频与文案，适配三个尺寸，包含一轮修改，由陈义君确认并导出。',
        selectedType: '视频剪辑',
        requester: '陈义君',
        startDate: `2026-07-${String(17 + index).padStart(2, '0')}T09:00`,
        estimatedDate: `2026-07-${String(17 + index).padStart(2, '0')}T18:00`,
        currentEstimatedHours: 5,
      }),
    })
    const replaySuggestion = await replaySuggestionResponse.json().catch(() => ({}))
    if (!replaySuggestionResponse.ok || !replaySuggestion.suggestionId) {
      throw new Error(`Hour estimate replay suggestion failed: ${JSON.stringify(replaySuggestion)}`)
    }
    if (!replaySuggestion.changeAudit?.hasPrevious) {
      throw new Error(`Hour estimate replay change audit did not find the previous suggestion: ${JSON.stringify(replaySuggestion.changeAudit)}`)
    }
    const day = String(17 + index).padStart(2, '0')
    const replayCreateResponse = await fetch('http://127.0.0.1:8798/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        id: 0,
        title: `工时回放评测 ${index + 1}`,
        requirement: '复用现有剪辑工程，完成 1 条产品视频降噪；甲方已提供完整视频与文案，适配三个尺寸，包含一轮修改，由陈义君确认并导出。',
        type: '视频剪辑',
        date: `2026-07-${day}T09:00`,
        estimatedDate: `2026-07-${day}T18:00`,
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
        hourEstimateSuggestionId: replaySuggestion.suggestionId,
      }),
    })
    const replayTask = await replayCreateResponse.json().catch(() => ({}))
    if (!replayCreateResponse.ok || !replayTask.id) {
      throw new Error(`Hour estimate replay task creation failed: ${JSON.stringify(replayTask)}`)
    }
    if (index === 0) replayQuoteTaskId = replayTask.id
    const replayEnd = index < 3 ? '14:00' : '16:00'
    const replayAcceptResponse = await fetch(`http://127.0.0.1:8798/api/tasks/${replayTask.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        status: '已验收',
        stage: '已验收',
        progress: 100,
        actualDeliveryDate: `2026-07-${day}T${replayEnd}`,
        timeEntries: [{
          id: `hour-replay-entry-${index + 1}`,
          date: `2026-07-${day}`,
          start: '09:00',
          end: replayEnd,
          note: '完成降噪、三个尺寸适配和一轮修改',
          isAcceptanceProgress: true,
        }],
      }),
    })
    const replayAccepted = await replayAcceptResponse.json().catch(() => ({}))
    if (!replayAcceptResponse.ok || replayAccepted.status !== '已验收') {
      throw new Error(`Hour estimate replay acceptance failed: ${JSON.stringify(replayAccepted)}`)
    }
  }

  const quoteResponse = await fetch('http://127.0.0.1:8798/api/ai/hour-estimate/quote-outcome', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ taskId: created.id, quotedAmount: 1800, settledAmount: 1700, status: 'adjusted', note: '隔离评测报价调整' }),
  })
  const quote = await quoteResponse.json().catch(() => ({}))
  if (!quoteResponse.ok || quote.status !== 'adjusted') {
    throw new Error(`Hour estimate quote outcome failed: ${JSON.stringify(quote)}`)
  }
  const replayQuoteResponse = await fetch('http://127.0.0.1:8798/api/ai/hour-estimate/quote-outcome', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ taskId: replayQuoteTaskId, quotedAmount: 1500, settledAmount: 1500, status: 'accepted', note: '隔离评测完整生命周期报价' }),
  })
  if (!replayQuoteResponse.ok) {
    throw new Error(`Hour estimate replay quote outcome failed: ${await replayQuoteResponse.text()}`)
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
  const review = metrics.recent.find((item) => item.taskId === created.id)
  if (!review?.requirementChange?.changed || !metrics.trends?.some((item) => item.month === '2026-07')) {
    throw new Error(`Requirement change or cross-month trend is missing: ${JSON.stringify(review)}`)
  }
  if (!metrics.versions?.some((item) => item.current && item.algorithm === '3.1.0')) {
    throw new Error(`Hour estimate version comparison is missing: ${JSON.stringify(metrics.versions)}`)
  }
  if (metrics.releaseGate?.status !== 'pass' || metrics.releaseGate?.samples < 3) {
    throw new Error(`Hour estimate chronological replay gate did not pass: ${JSON.stringify(metrics.releaseGate)}`)
  }
  if (metrics.quoteSummary?.recordedCount < 1 || review?.quoteOutcome?.status !== 'adjusted') {
    throw new Error(`Hour estimate quote feedback loop is missing: ${JSON.stringify({ quoteSummary: metrics.quoteSummary, quoteOutcome: review?.quoteOutcome })}`)
  }
  if (!metrics.efficiencyProfiles?.some((item) => item.name === '视频剪辑') || !Array.isArray(review?.requirementTimeline)) {
    throw new Error(`Hour estimate efficiency profile or requirement timeline is missing: ${JSON.stringify({ efficiencyProfiles: metrics.efficiencyProfiles, timeline: review?.requirementTimeline })}`)
  }
  if (metrics.observationReadiness?.completeLifecycleCount < 1 || !metrics.classificationDiagnostics?.length) {
    throw new Error(`Hour estimate observation readiness or classification diagnostics are missing: ${JSON.stringify({ observation: metrics.observationReadiness, diagnostics: metrics.classificationDiagnostics })}`)
  }
  if (!metrics.driftAlerts?.some((item) => item.designType === '视频剪辑' && item.direction === 'up')) {
    throw new Error(`Hour estimate drift alert is missing: ${JSON.stringify(metrics.driftAlerts)}`)
  }
  if (!metrics.pricingStrategies?.some((item) => item.dimension === 'all')) {
    throw new Error(`Hour estimate pricing strategy is missing: ${JSON.stringify(metrics.pricingStrategies)}`)
  }

  const qualityResponse = await fetch('http://127.0.0.1:8798/api/ai/hour-estimate/sample-quality', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ taskId: created.id, excluded: true, reason: '需求中途变更，不纳入标准样本' }),
  })
  const quality = await qualityResponse.json().catch(() => ({}))
  if (!qualityResponse.ok || quality.excluded !== true) {
    throw new Error(`Hour estimate sample quality update failed: ${JSON.stringify(quality)}`)
  }
  const correctionResponse = await fetch('http://127.0.0.1:8798/api/ai/hour-estimate/outcome-correction', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ taskId: created.id, factors: ['需求中途追加', '多尺寸 / 多版本'], note: '隔离评测人工校正' }),
  })
  const correction = await correctionResponse.json().catch(() => ({}))
  if (!correctionResponse.ok || correction.factors?.length !== 2) {
    throw new Error(`Hour estimate outcome correction failed: ${JSON.stringify(correction)}`)
  }
  const correctedMetricsResponse = await fetch('http://127.0.0.1:8798/api/ai/hour-estimate/metrics?month=2026-07', { headers: { cookie } })
  const correctedMetrics = await correctedMetricsResponse.json().catch(() => ({}))
  const correctedReview = correctedMetrics.recent?.find((item) => item.taskId === created.id)
  if (!correctedMetricsResponse.ok || correctedReview?.correction?.note !== '隔离评测人工校正') {
    throw new Error(`Hour estimate corrected review is missing: ${JSON.stringify(correctedReview)}`)
  }
  if (!correctedMetrics.sampleQuality?.some((item) => item.taskId === created.id && item.excluded === true)) {
    throw new Error(`Hour estimate excluded sample is missing: ${JSON.stringify(correctedMetrics.sampleQuality)}`)
  }
  process.stdout.write('AI hour estimate quality scoring, completion, change audit, observation readiness, classification diagnostics, drift alerts, pricing strategy, replay gate, and learning checks passed.\n')
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
  await runAgentLifecycleWriteCheck()
  await runAgentOrchestrationCheck(cookie)
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
