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
  const expected = ['get_giverny_context', 'get_task_detail', 'query_month_finance', 'search_attachments', 'search_product_help', 'search_tasks']
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
  const productHelpResult = await request(6, 'tools/call', { name: 'search_product_help', arguments: { query: '显示金额的快捷键', limit: 3 } })
  const productMatches = productHelpResult.structuredContent?.matches
  if (productHelpResult.isError || !Array.isArray(productMatches) || !productMatches.some((item) => String(item.answer || '').includes('Command + Shift + M'))) {
    throw new Error('MCP product help did not return the authoritative shortcut')
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

async function runFinanceAnchorCheck(cookie) {
  const response = await fetch('http://127.0.0.1:8798/api/state', { headers: { cookie } })
  const state = await response.json().catch(() => ({}))
  const task = state.tasks?.find((item) => item.id === 1)
  if (!response.ok || task?.actualHours !== 2.5) {
    throw new Error(`Saved finance anchor was replaced by rounded entry hours: ${JSON.stringify(task)}`)
  }
  process.stdout.write('Saved task hours remain the finance anchor when entry-minute rounding differs.\n')
}

async function runSupplementalActivityDateCheck(cookie) {
  const response = await fetch('http://127.0.0.1:8798/api/state', { headers: { cookie } })
  const state = await response.json().catch(() => ({}))
  const task = state.tasks?.find((item) => item.id === 11)
  if (!response.ok || task?.actualDeliveryDate !== '2026-06-08T00:00') {
    throw new Error(`Supplemental task used its later bookkeeping acceptance date: ${JSON.stringify(task)}`)
  }
  process.stdout.write('Supplemental task completion follows its recorded acceptance progress date.\n')
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

async function runPlannedProgressTransitionCheck(cookie) {
  const headers = { 'content-type': 'application/json', cookie, 'x-giverny-agent-eval': '1' }
  const createResponse = await fetch('http://127.0.0.1:8798/api/tasks', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: 0,
      title: '计划中直接记录进展评测',
      requirement: '验证首次记录进展会自动开始任务，并保留 0.1h 精度的预估工时。',
      type: '传播类 / 海报',
      date: '2026-07-16T09:00',
      estimatedDate: '2026-07-16T10:12',
      settlementMonth: '2026-07',
      estimatedHours: 1.2,
      actualHours: 0,
      requester: '陈义君',
      contact: '黄媚',
      reviewer: '陈义君',
      stage: '计划中',
      status: '计划中',
      progress: 0,
      billable: true,
      files: [],
      timeEntries: [],
      waitingEntries: [],
    }),
  })
  const created = await createResponse.json().catch(() => ({}))
  if (!createResponse.ok || created.status !== '计划中' || created.estimatedHours !== 1.2) {
    throw new Error(`Planned progress task creation failed: ${JSON.stringify(created)}`)
  }
  const progressResponse = await fetch(`http://127.0.0.1:8798/api/tasks/${created.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      startFromProgress: true,
      timeEntries: [{
        id: `planned-progress-${crypto.randomUUID()}`,
        date: '2026-07-16',
        start: '09:00',
        end: '09:30',
        note: '完成初版布局',
      }],
    }),
  })
  const progressed = await progressResponse.json().catch(() => ({}))
  if (!progressResponse.ok || progressed.status !== '进行中' || progressed.stage !== '进行中' || progressed.progress < 20 || progressed.progress % 20 !== 0 || progressed.estimatedHours !== 1.2) {
    throw new Error(`Planned task did not start from its first progress entry: ${JSON.stringify(progressed)}`)
  }
  process.stdout.write('Planned task first-progress transition and decimal estimate checks passed.\n')
}

async function runUploadLimitCheck(cookie) {
  const response = await fetch('http://127.0.0.1:8798/api/files/multipart/init', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie, 'x-giverny-agent-eval': '1' },
    body: JSON.stringify({
      taskId: 1,
      fileName: 'oversized-video.mp4',
      contentType: 'video/mp4',
      fileSize: 200 * 1024 * 1024 + 1,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (response.status !== 413 || !String(payload.error ?? '').includes('200MB')) {
    throw new Error(`Upload hard limit check failed: ${response.status} ${JSON.stringify(payload)}`)
  }
  process.stdout.write('Multipart upload 200MB server limit check passed.\n')
}

async function runAcceptanceNoteGuardrailCheck(cookie) {
  const response = await fetch('http://127.0.0.1:8798/api/ai/text-assistant', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie, 'x-giverny-agent-eval': '1' },
    body: JSON.stringify({
      mode: 'acceptance',
      text: '',
      task: {
        id: 1,
        title: '验收备注隔离评测',
        type: '展板',
        requirement: '完成展板矢量化、统一视觉并交付正式文件。',
        actualHours: 5,
        timeEntries: [
          { id: 'acceptance-hours-1', date: '2026-06-08', start: '15:30', end: '18:30', note: '' },
          { id: 'acceptance-hours-2', date: '2026-06-09', start: '09:00', end: '11:00', note: '' },
        ],
      },
      files: [{ name: '验收预览.pdf', type: 'PDF', tag: '验收文件', final: true, visible: true, uploadedAt: '2026-07-20' }],
      uploadedFileNames: ['验收预览.pdf'],
      progressHistory: [
        { sequence: 1, date: '2026-06-08', endDate: '2026-06-08', start: '15:30', end: '18:30', note: '', kind: 'progress', counted: true, attachments: [] },
        { sequence: 2, date: '2026-06-09', endDate: '2026-06-09', start: '09:00', end: '11:00', note: '', kind: 'progress', counted: true, attachments: [] },
      ],
    }),
  })
  const payload = await response.json().catch(() => ({}))
  const text = String(payload.optimizedText || '')
  const lines = text.split('\n').filter(Boolean)
  const fileMentions = text.match(/验收预览\.pdf/g)?.length || 0
  if (
    !response.ok ||
    lines.length !== 3 ||
    !lines[0]?.startsWith('1、需求达成：') ||
    !lines[1]?.startsWith('2、额外价值：') ||
    !lines[2]?.startsWith('3、项目价值：') ||
    /3\s*小时|工时|一次交付|改稿轮次|2026\s*年|清理画布|建议修改/.test(text) ||
    fileMentions !== 1
  ) {
    throw new Error(`Acceptance note guardrail failed: ${response.status} ${JSON.stringify(payload)}`)
  }
  process.stdout.write('Acceptance note authoritative-hours context, value structure, noise removal, and attachment deduplication checks passed.\n')
}

async function runAiModelDraftListCheck(cookie) {
  const endpoint = 'http://127.0.0.1:8798/api/ai/models'
  const providerEndpoint = 'http://127.0.0.1:8798/api/ai/provider-models'
  const requestModels = async (provider) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        route: 'textPrimary',
        provider,
        baseUrl: 'http://127.0.0.1:8898',
        model: provider === 'doubao' ? 'doubao-seed-eval' : 'qwen3.7-plus',
        apiKey: 'eval-model-key',
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || `Draft model list returned HTTP ${response.status}`)
    return data
  }
  const doubao = await requestModels('doubao')
  if (doubao.provider !== 'doubao' || JSON.stringify(doubao.models) !== JSON.stringify(['doubao-seed-eval'])) {
    throw new Error(`Doubao draft model list leaked another provider: ${JSON.stringify(doubao)}`)
  }
  const qwen = await requestModels('qwen')
  if (qwen.provider !== 'qwen' || JSON.stringify(qwen.models) !== JSON.stringify(['qwen3.7-plus'])) {
    throw new Error(`Qwen draft model list leaked another provider: ${JSON.stringify(qwen)}`)
  }
  const legacyResponse = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      route: 'textPrimary',
      provider: 'qwen',
      baseUrl: 'http://127.0.0.1:8898/legacy-qwen',
      model: 'qwen3.7-plus',
      apiKey: 'eval-model-key',
    }),
  })
  const legacyQwen = await legacyResponse.json().catch(() => ({}))
  if (!legacyResponse.ok || JSON.stringify(legacyQwen.models) !== JSON.stringify(['qwen3.6-plus', 'qwen3.7-max', 'qwen3.7-plus'])) {
    throw new Error(`Qwen legacy discovery recovery failed: ${JSON.stringify(legacyQwen)}`)
  }
  const mismatchedHostResponse = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      route: 'textPrimary',
      provider: 'qwen',
      baseUrl: 'http://127.0.0.1:8898/legacy-qwen-denied',
      model: 'qwen3.7-plus',
      apiKey: 'eval-model-key',
    }),
  })
  const mismatchedHost = await mismatchedHostResponse.json().catch(() => ({}))
  if (mismatchedHostResponse.ok || !String(mismatchedHost.error || '').includes('专属 API Host')) {
    throw new Error(`Qwen workspace host mismatch was not explained: ${JSON.stringify(mismatchedHost)}`)
  }
  const requestProviderModels = async (provider, baseUrl) => {
    const response = await fetch(providerEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ provider, baseUrl, apiKey: 'eval-model-key' }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || `Provider model list returned HTTP ${response.status}`)
    return data
  }
  const normalizedQwen = await requestProviderModels('qwen', '127.0.0.1:8898')
  if (normalizedQwen.baseUrl !== 'http://127.0.0.1:8898/compatible-mode/v1' || !normalizedQwen.models.includes('qwen3.7-plus')) {
    throw new Error(`Qwen API Host normalization failed: ${JSON.stringify(normalizedQwen)}`)
  }
  const normalizedDoubao = await requestProviderModels('doubao', '127.0.0.1:8898')
  if (normalizedDoubao.baseUrl !== 'http://127.0.0.1:8898/api/v3' || !normalizedDoubao.models.includes('doubao-seed-eval')) {
    throw new Error(`Doubao API Host normalization failed: ${JSON.stringify(normalizedDoubao)}`)
  }
  process.stdout.write('Draft provider model discovery and provider filtering checks passed.\n')
}

async function runSiteWideModelPriorityCheck(cookie) {
  const base = 'http://127.0.0.1:8798'
  const headers = { 'content-type': 'application/json', cookie }
  const setChoice = async (choice) => {
    const response = await fetch(`${base}/api/ai/active-model`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ choice }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data.choice !== choice) {
      throw new Error(`Active model choice update failed: ${response.status} ${JSON.stringify(data)}`)
    }
  }

  await setChoice('doubao-seed-2-1-pro')
  const textRequestsBefore = await fetch('http://127.0.0.1:8898/test/requests').then((response) => response.json())
  await fetch(`${base}/api/ai/progress-estimate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      taskId: 92001,
      title: '全站文字模型优先级评测',
      type: '评测类 / 模型路由',
      requirement: '完成一份可审阅的设计稿。',
      status: '进行中',
      currentProgress: 0,
      entries: [{ id: 'route-text', date: '2026-07-17', note: '开始整理内容结构并制作版式' }],
      files: [],
    }),
  })
  const textRequestsAfter = await fetch('http://127.0.0.1:8898/test/requests').then((response) => response.json())
  const textRequests = (textRequestsAfter.requests || []).slice((textRequestsBefore.requests || []).length)
  if (textRequests[0]?.model !== 'doubao-seed-eval') {
    throw new Error(`Site-wide text route ignored selected model: ${JSON.stringify(textRequests.slice(0, 3))}`)
  }

  const visionRequestsBefore = await fetch('http://127.0.0.1:8898/test/requests').then((response) => response.json())
  await fetch(`${base}/api/ai/attachment-name`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fileName: 'route-check.png',
      mimeType: 'image/png',
      imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      note: '模型优先级识图测试',
      task: { id: 92001, title: '全站识图模型优先级评测', type: '评测类 / 模型路由' },
    }),
  })
  const visionRequestsAfter = await fetch('http://127.0.0.1:8898/test/requests').then((response) => response.json())
  const visionRequests = (visionRequestsAfter.requests || []).slice((visionRequestsBefore.requests || []).length)
  if (visionRequests[0]?.model !== 'doubao-seed-eval') {
    throw new Error(`Site-wide vision route ignored selected multimodal model: ${JSON.stringify(visionRequests.slice(0, 3))}`)
  }

  await setChoice('auto')
  const current = await fetch(`${base}/api/ai/active-model`, { headers: { cookie } }).then((response) => response.json())
  if (current.choice !== 'auto') throw new Error(`Automatic model route was not restored: ${JSON.stringify(current)}`)
  process.stdout.write('Site-wide selected text and vision model priority checks passed.\n')
}

async function runLocalCliBridgeCheck(cookie) {
  const base = 'http://127.0.0.1:8798'
  const browserDeviceKey = `eval-browser-${crypto.randomUUID()}`
  const unauthenticated = await fetch(`${base}/api/local-cli/devices?browserDeviceKey=${encodeURIComponent(browserDeviceKey)}`)
  if (unauthenticated.status !== 401) throw new Error(`Local CLI device list allowed unauthenticated access: ${unauthenticated.status}`)

  const pairingResponse = await fetch(`${base}/api/local-cli/pairings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ browserDeviceKey }),
  })
  const pairing = await pairingResponse.json().catch(() => ({}))
  if (!pairingResponse.ok || !pairing.code || !pairing.bridgeUrl) throw new Error(`Local CLI pairing creation failed: ${JSON.stringify(pairing)}`)

  const initialClis = [
    { id: 'codex', name: 'Codex CLI', command: '/usr/local/bin/codex', version: 'codex-cli eval', status: 'available', authStatus: 'authenticated', supportsStreaming: true, supportsMcp: true, detail: 'eval' },
    { id: 'claude', name: 'Claude Code', command: '/usr/local/bin/claude', version: 'claude eval', status: 'needs_auth', authStatus: 'signed_out', supportsStreaming: true, supportsMcp: true, detail: 'login required' },
  ]
  const bridgePairResponse = await fetch(`${base}/api/local-cli/bridge/pair`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: pairing.code, name: 'Eval Mac', platform: 'darwin', arch: 'arm64', bridgeVersion: '0.4.1', clis: initialClis }),
  })
  const bridgePair = await bridgePairResponse.json().catch(() => ({}))
  if (!bridgePairResponse.ok || !bridgePair.deviceId || !bridgePair.token) throw new Error(`Local CLI bridge pairing failed: ${JSON.stringify(bridgePair)}`)

  const replayPair = await fetch(`${base}/api/local-cli/bridge/pair`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: pairing.code, name: 'Replay device' }),
  })
  if (replayPair.status !== 404) throw new Error(`Local CLI pairing code replay was not rejected: ${replayPair.status}`)

  const bridgeHeaders = { authorization: `Bearer ${bridgePair.token}`, 'content-type': 'application/json' }
  const heartbeat = await fetch(`${base}/api/local-cli/bridge/heartbeat`, {
    method: 'POST',
    headers: bridgeHeaders,
    body: JSON.stringify({ bridgeVersion: '0.4.1', clis: initialClis }),
  })
  const heartbeatResult = await heartbeat.json().catch(() => ({}))
  if (!heartbeat.ok || heartbeatResult.bridgeRuntimeVersion !== '0.4.1' || heartbeatResult.bridgeDownloadUrl !== `${base}/giverny-bridge.mjs`) {
    throw new Error(`Local CLI heartbeat did not advertise the runtime update: ${JSON.stringify(heartbeatResult)}`)
  }
  const bridgeSource = await fetch(pairing.bridgeUrl).then((response) => response.text())
  if (!bridgeSource.includes("const VERSION = '0.4.1'") || !bridgeSource.includes('proxyAwareEnv') || !bridgeSource.includes('refreshCachedCli') || !bridgeSource.includes("--disable', 'plugins'") || !bridgeSource.includes('model_reasoning_effort="low"') || !bridgeSource.includes('executeRunCommand(config, payload.command, clis)')) {
    throw new Error('Published Bridge is missing the isolated proxy-aware Codex runtime')
  }

  const listedResponse = await fetch(`${base}/api/local-cli/devices?browserDeviceKey=${encodeURIComponent(browserDeviceKey)}`, { headers: { cookie } })
  const listed = await listedResponse.json().catch(() => ({}))
  const device = listed.devices?.[0]
  if (!listedResponse.ok || !device?.online || device.clis?.length !== 2) throw new Error(`Local CLI device discovery failed: ${JSON.stringify(listed)}`)

  const scanResponse = await fetch(`${base}/api/local-cli/devices/${bridgePair.deviceId}/scan`, { method: 'POST', headers: { cookie } })
  const scan = await scanResponse.json().catch(() => ({}))
  if (scanResponse.status !== 202 || !scan.commandId) throw new Error(`Local CLI scan queue failed: ${JSON.stringify(scan)}`)

  const pollResponse = await fetch(`${base}/api/local-cli/bridge/commands`, { headers: bridgeHeaders })
  const polled = await pollResponse.json().catch(() => ({}))
  if (!pollResponse.ok || polled.command?.id !== scan.commandId || polled.command?.type !== 'scan') throw new Error(`Local CLI bridge command poll failed: ${JSON.stringify(polled)}`)

  const scannedClis = initialClis.map((item) => item.id === 'claude' ? { ...item, status: 'available', authStatus: 'authenticated', detail: 'ready' } : item)
  const completeResponse = await fetch(`${base}/api/local-cli/bridge/commands/${scan.commandId}/complete`, {
    method: 'POST',
    headers: bridgeHeaders,
    body: JSON.stringify({ result: { clis: scannedClis } }),
  })
  if (!completeResponse.ok) throw new Error(`Local CLI scan completion failed: ${completeResponse.status}`)

  const commandResponse = await fetch(`${base}/api/local-cli/commands/${scan.commandId}`, { headers: { cookie } })
  const command = await commandResponse.json().catch(() => ({}))
  if (!commandResponse.ok || command.status !== 'completed') throw new Error(`Local CLI scan result failed: ${JSON.stringify(command)}`)

  const selectResponse = await fetch(`${base}/api/local-cli/devices/${bridgePair.deviceId}/select`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ cliId: 'codex' }),
  })
  const selected = await selectResponse.json().catch(() => ({}))
  if (!selectResponse.ok || selected.device?.selectedCliId !== 'codex' || !selected.device?.clis?.find((item) => item.id === 'codex')?.selected) {
    throw new Error(`Local CLI adapter selection failed: ${JSON.stringify(selected)}`)
  }

  const identityResponse = await fetch(`${base}/api/ai/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream', cookie, 'x-giverny-agent-eval': '1' },
    body: JSON.stringify({
      browserDeviceKey,
      localCliConversationId: 'eval-local-identity',
      month: '2026-07',
      messages: [{ role: 'user', content: '请问你现在用的哪个大模型？' }],
    }),
  })
  const identityText = await identityResponse.text()
  if (!identityResponse.ok || !identityText.includes('Codex CLI') || identityText.includes('Claude 4') || identityText.includes('"commandId"')) {
    throw new Error(`Local CLI runtime identity answer was inaccurate or unnecessarily queued: ${identityText}`)
  }

  const financeResponse = await fetch(`${base}/api/ai/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream', cookie, 'x-giverny-agent-eval': '1' },
    body: JSON.stringify({
      browserDeviceKey,
      localCliConversationId: 'eval-local-finance',
      month: '2026-07',
      messages: [{ role: 'user', content: '请问 6 月和 7 月的收入加起来是多少？' }],
    }),
  })
  const financeText = await financeResponse.text()
  if (!financeResponse.ok || !financeText.includes('"runtime":"site-tools"') || !financeText.includes('计费工时') || financeText.includes('"commandId"')) {
    throw new Error(`Deterministic finance query did not use the direct read-only route: ${financeText}`)
  }

  const productHelpResponse = await fetch(`${base}/api/ai/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream', cookie, 'x-giverny-agent-eval': '1' },
    body: JSON.stringify({
      browserDeviceKey,
      modelChoice: 'deepseek-v4-flash',
      month: '2026-07',
      messages: [{ role: 'user', content: '显示金额和隐藏金额的快捷键是什么？' }],
    }),
  })
  const productHelpText = await productHelpResponse.text()
  if (!productHelpResponse.ok || !productHelpText.includes('Command + Shift + M') || !productHelpText.includes('search_product_help') || productHelpText.includes('"commandId"')) {
    throw new Error(`Product help did not bypass model and local CLI routing: ${productHelpText}`)
  }

  const explicitModelResponse = await fetch(`${base}/api/ai/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream', cookie, 'x-giverny-agent-eval': '1' },
    body: JSON.stringify({
      browserDeviceKey,
      modelChoice: 'deepseek-v4-flash',
      month: '2026-07',
      messages: [{ role: 'user', content: '请介绍一下你能做什么' }],
    }),
  })
  const explicitModelText = await explicitModelResponse.text()
  if (!explicitModelResponse.ok || !explicitModelText.includes('直接使用 DeepSeek V4 Flash') || explicitModelText.includes('"commandId"')) {
    throw new Error(`Explicit cloud model selection still entered the local CLI route: ${explicitModelText}`)
  }

  const modelRequestsBefore = await fetch('http://127.0.0.1:8898/test/requests').then((response) => response.json())
  const doubaoPriorityResponse = await fetch(`${base}/api/ai/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream', cookie, 'x-giverny-agent-eval': '1' },
    body: JSON.stringify({
      browserDeviceKey,
      modelChoice: 'doubao-seed-2-1-pro',
      month: '2026-07',
      messages: [{ role: 'user', content: '请查询 2026 年 6 月的收入和计费工时' }],
    }),
  })
  const doubaoPriorityText = await doubaoPriorityResponse.text()
  const modelRequestsAfter = await fetch('http://127.0.0.1:8898/test/requests').then((response) => response.json())
  const newModelRequests = (modelRequestsAfter.requests || []).slice((modelRequestsBefore.requests || []).length)
  if (!doubaoPriorityResponse.ok || newModelRequests[0]?.model !== 'doubao-seed-eval' || !doubaoPriorityText.includes('豆包 Seed 2.1 Pro')) {
    throw new Error(`Explicit Doubao did not own the full chat turn before fallback: ${JSON.stringify({ newModelRequests, doubaoPriorityText })}`)
  }

  const visionRequestsBefore = await fetch('http://127.0.0.1:8898/test/requests').then((response) => response.json())
  const doubaoVisionResponse = await fetch(`${base}/api/ai/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream', cookie, 'x-giverny-agent-eval': '1' },
    body: JSON.stringify({
      browserDeviceKey,
      modelChoice: 'doubao-seed-2-1-pro',
      month: '2026-07',
      messages: [{ role: 'user', content: '请描述这张测试图片' }],
      attachments: [{ type: 'image', name: 'eval.png', mimeType: 'image/png', data: 'aXNvbGF0ZWQtZXZhbC1pbWFnZQ==' }],
    }),
  })
  const doubaoVisionText = await doubaoVisionResponse.text()
  const visionRequestsAfter = await fetch('http://127.0.0.1:8898/test/requests').then((response) => response.json())
  const newVisionRequests = (visionRequestsAfter.requests || []).slice((visionRequestsBefore.requests || []).length)
  if (!doubaoVisionResponse.ok || newVisionRequests[0]?.model !== 'doubao-seed-eval' || !doubaoVisionText.includes('识图答复：使用 豆包 Seed 2.1 Pro')) {
    throw new Error(`Vision-capable explicit model was not preferred for image understanding: ${JSON.stringify({ newVisionRequests, doubaoVisionText })}`)
  }

  const trendResponse = await fetch(`${base}/api/ai/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream', cookie, 'x-giverny-agent-eval': '1' },
    body: JSON.stringify({
      browserDeviceKey,
      modelChoice: 'auto',
      month: '2026-07',
      messages: [{ role: 'user', content: '分析最近几个月的工作趋势' }],
    }),
  })
  const trendText = await trendResponse.text()
  if (!trendResponse.ok || !trendText.includes('多月深度分析') || trendText.includes('"commandId"') || trendText.includes('本机 CLI 未完成')) {
    throw new Error(`Background trend analysis unnecessarily waited for the local CLI: ${trendText}`)
  }

  const waitForBridgeRun = async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await fetch(`${base}/api/local-cli/bridge/commands`, { headers: bridgeHeaders })
      const payload = await response.json().catch(() => ({}))
      if (payload.command?.type === 'run') return payload.command
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('Local CLI chat command was not queued for the selected browser device')
  }
  const chatResponse = await fetch(`${base}/api/ai/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream', cookie, 'x-giverny-agent-eval': '1' },
    body: JSON.stringify({
      browserDeviceKey,
      localCliConversationId: 'eval-local-conversation',
      month: '2026-07',
      messages: [{ role: 'user', content: '请查询本月任务概况' }],
    }),
  })
  if (!chatResponse.ok || !String(chatResponse.headers.get('content-type')).includes('text/event-stream')) {
    throw new Error(`Local CLI chat did not start an SSE response: ${chatResponse.status}`)
  }
  const chatTextPromise = chatResponse.text()
  const earlyChatResult = await Promise.race([
    chatTextPromise.then((text) => text),
    new Promise((resolve) => setTimeout(() => resolve(''), 500)),
  ])
  if (earlyChatResult) throw new Error(`Local CLI chat ended before Bridge pickup: ${earlyChatResult}`)
  const runCommand = await waitForBridgeRun()
  if (runCommand.payload?.adapterId !== 'codex' || runCommand.payload?.timeoutMs !== 12_000 || !String(runCommand.payload?.mcpToken || '').startsWith('lc_') || !String(runCommand.payload?.prompt || '').includes('giverny MCP') || !String(runCommand.payload?.prompt || '').includes('站内只读工具预取结果')) {
    throw new Error(`Local CLI run payload is incomplete or unsafe: ${JSON.stringify(runCommand.payload)}`)
  }
  const progressResponse = await fetch(`${base}/api/local-cli/bridge/commands/${runCommand.id}/events`, {
    method: 'POST',
    headers: bridgeHeaders,
    body: JSON.stringify({ result: { trace: ['已连接 Codex CLI', '读取 Giverny 数据：search_tasks'], content: '正在整理' } }),
  })
  if (!progressResponse.ok) throw new Error(`Local CLI progress event failed: ${progressResponse.status}`)
  const runComplete = await fetch(`${base}/api/local-cli/bridge/commands/${runCommand.id}/complete`, {
    method: 'POST',
    headers: bridgeHeaders,
    body: JSON.stringify({
      result: {
        trace: ['已连接 Codex CLI', '读取 Giverny 数据：search_tasks', '本机 CLI 已完成执行'],
        content: '这是本机 Codex CLI 的回答。',
        sessionId: 'eval-codex-session',
        workspace: '/tmp/giverny',
        diagnostics: { proxyMode: 'system', configMode: 'isolated', bridgeVersion: '0.4.1', proxyUrl: 'must-not-persist' },
        timings: { bridgeStartedAt: 1000, cliSpawnedAt: 1100, firstEventAt: 1200, firstContentAt: 2500, completedAt: 2800, durationMs: 1800, unsafe: 99 },
      },
    }),
  })
  if (!runComplete.ok) throw new Error(`Local CLI run completion failed: ${runComplete.status}`)
  const chatText = await chatTextPromise
  if (!chatText.includes('"runtime":"local-cli"') || !chatText.includes('这是本机 Codex CLI 的回答') || !chatText.includes('读取 Giverny 数据')) {
    throw new Error(`Local CLI SSE did not expose route, progress, and result: ${chatText}`)
  }
  const completedCommandResponse = await fetch(`${base}/api/local-cli/commands/${runCommand.id}`, { headers: { cookie } })
  const completedCommand = await completedCommandResponse.json().catch(() => ({}))
  if (completedCommand.result?.diagnostics?.proxyMode !== 'system' || completedCommand.result?.diagnostics?.configMode !== 'isolated' || completedCommand.result?.timings?.durationMs !== 1800 || completedCommand.result?.diagnostics?.proxyUrl || completedCommand.result?.timings?.unsafe) {
    throw new Error(`Local CLI diagnostics were not safely normalized: ${JSON.stringify(completedCommand)}`)
  }
  const expiredMcpToken = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { authorization: `Bearer ${runCommand.payload.mcpToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'eval', version: '1' } } }),
  })
  if (expiredMcpToken.status !== 401) throw new Error('Local CLI MCP token remained valid after command completion')

  const overheadChatResponse = await fetch(`${base}/api/ai/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream', cookie, 'x-giverny-agent-eval': '1' },
    body: JSON.stringify({ browserDeviceKey, localCliConversationId: 'eval-local-overhead', month: '2026-07', messages: [{ role: 'user', content: '请给我一个设计沟通建议' }] }),
  })
  const overheadTextPromise = overheadChatResponse.text()
  const overheadCommand = await waitForBridgeRun()
  await new Promise((resolve) => setTimeout(resolve, 12_500))
  const overheadFinalEventResponse = await fetch(`${base}/api/local-cli/bridge/commands/${overheadCommand.id}/events`, {
    method: 'POST',
    headers: bridgeHeaders,
    body: JSON.stringify({ result: { trace: ['本机 CLI 已生成完整回答'], content: '这是包含 Bridge 传输开销后的本机回答。', contentFinal: true } }),
  })
  const overheadText = await overheadTextPromise
  const overheadLateCompleteResponse = await fetch(`${base}/api/local-cli/bridge/commands/${overheadCommand.id}/complete`, {
    method: 'POST',
    headers: bridgeHeaders,
    body: JSON.stringify({ result: { content: '迟到的进程退出结果', contentFinal: true }, error: '迟到错误不应覆盖最终答案' }),
  })
  const overheadLateComplete = await overheadLateCompleteResponse.json().catch(() => ({}))
  if (!overheadFinalEventResponse.ok || !overheadText.includes('这是包含 Bridge 传输开销后的本机回答') || overheadText.includes('已自动回退云端 Agent') || !overheadLateComplete.alreadyCompleted) {
    throw new Error(`Local CLI transport overhead incorrectly consumed the 12-second execution budget: ${overheadText}`)
  }

  const cancelChatResponse = await fetch(`${base}/api/ai/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream', cookie, 'x-giverny-agent-eval': '1' },
    body: JSON.stringify({ browserDeviceKey, localCliConversationId: 'eval-local-conversation', month: '2026-07', messages: [{ role: 'user', content: '请分析一个普通设计问题' }] }),
  })
  const cancelTextPromise = cancelChatResponse.text()
  const cancellableCommand = await waitForBridgeRun()
  if (cancellableCommand.payload?.resumeSessionId) {
    throw new Error(`Codex CLI unexpectedly attempted to resume a prior session: ${JSON.stringify(cancellableCommand.payload)}`)
  }
  const cancelResponse = await fetch(`${base}/api/local-cli/commands/${cancellableCommand.id}/cancel`, { method: 'POST', headers: { cookie } })
  if (!cancelResponse.ok) throw new Error(`Local CLI cancellation failed: ${cancelResponse.status}`)
  const bridgeStateResponse = await fetch(`${base}/api/local-cli/bridge/commands/${cancellableCommand.id}`, { headers: bridgeHeaders })
  const bridgeState = await bridgeStateResponse.json().catch(() => ({}))
  if (bridgeState.status !== 'cancelled') throw new Error(`Bridge did not observe cancellation: ${JSON.stringify(bridgeState)}`)
  const lateCompleteResponse = await fetch(`${base}/api/local-cli/bridge/commands/${cancellableCommand.id}/complete`, {
    method: 'POST',
    headers: bridgeHeaders,
    body: JSON.stringify({ result: { content: '这个迟到结果不应覆盖取消状态' } }),
  })
  const lateComplete = await lateCompleteResponse.json().catch(() => ({}))
  const cancelledCommand = await fetch(`${base}/api/local-cli/commands/${cancellableCommand.id}`, { headers: { cookie } }).then((response) => response.json())
  if (!lateCompleteResponse.ok || !lateComplete.cancelled || cancelledCommand.status !== 'cancelled' || cancelledCommand.result?.content) {
    throw new Error(`Late local CLI completion overwrote the terminal state: ${JSON.stringify({ lateComplete, cancelledCommand })}`)
  }
  const cancelText = await cancelTextPromise
  if (!cancelText.includes('已停止本机 CLI 执行')) throw new Error(`Cancelled local CLI chat did not close cleanly: ${cancelText}`)
  process.stdout.write('Local CLI identity, runtime update, explicit cloud selection, background-analysis routing, deterministic site-tool routing, data prefetch, tenant isolation, streaming routing, execution/transport budget separation, safe diagnostics, MCP cleanup, cancellation, late-result protection, and adapter selection checks passed.\n')
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

async function runProgressAssessmentCheck(cookie) {
  const endpoint = 'http://127.0.0.1:8798/api/ai/progress-estimate'
  const headers = { 'content-type': 'application/json', cookie }
  const assess = async (overrides = {}) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        taskId: 90001,
        title: '进度里程碑隔离评测',
        type: '评测类 / 进度校准',
        requirement: '完成一份可供甲方审阅并最终交付的完整设计稿。',
        status: '进行中',
        currentProgress: 0,
        estimatedHours: 4,
        actualHours: 2,
        entries: [],
        waitingEntries: [],
        files: [],
        ...overrides,
      }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(`Progress assessment HTTP ${response.status}: ${JSON.stringify(result)}`)
    if (![0, 20, 40, 60, 80, 100].includes(result.progress)) {
      throw new Error(`Progress assessment escaped 20% milestones: ${JSON.stringify(result)}`)
    }
    return result
  }

  const firstVersion = await assess({
    entries: [{ id: 'first', date: '2026-07-17', endDate: '2026-07-17', note: '完成第一版完整排版并提交甲方审阅', attachments: ['方案B01.pdf'] }],
  })
  if (firstVersion.progress !== 60 || firstVersion.stage !== 'first_version') {
    throw new Error(`First-version milestone is incorrect: ${JSON.stringify(firstVersion)}`)
  }
  const finalizing = await assess({
    currentProgress: 60,
    entries: [{ id: 'final', date: '2026-07-17', endDate: '2026-07-17', note: '完成全部反馈修改，整理终稿等待验收', isRevision: true }],
    files: [{ name: '项目最终版.pdf', scope: 'acceptance', final: true, tag: '验收文件' }],
  })
  if (finalizing.progress !== 80 || finalizing.stage !== 'finalizing') {
    throw new Error(`Finalizing milestone is incorrect: ${JSON.stringify(finalizing)}`)
  }
  const accepted = await assess({ status: '已验收', currentProgress: 80, entries: [{ id: 'accept', note: '验收通过', isAcceptance: true }] })
  if (accepted.progress !== 100 || accepted.stage !== 'accepted') {
    throw new Error(`Accepted milestone is incorrect: ${JSON.stringify(accepted)}`)
  }

  for (let index = 0; index < 3; index += 1) {
    const response = await fetch('http://127.0.0.1:8798/api/ai/learning-events', {
      method: 'POST', headers,
      body: JSON.stringify({
        context: 'task_progress', action: 'edited', aiOutput: '60', userFinal: '40',
        designType: '评测类 / 进度校准', taskId: 91000 + index, taskTitle: `进度校准样本 ${index + 1}`,
      }),
    })
    if (!response.ok) throw new Error('Progress correction learning event failed')
  }
  const calibrated = await assess({
    taskId: 90002,
    entries: [{ id: 'calibrated', date: '2026-07-17', endDate: '2026-07-17', note: '完成第一版完整排版并提交甲方审阅', attachments: ['方案B01.pdf'] }],
  })
  if (calibrated.progress !== 40 || !calibrated.evidence?.some((item) => item.includes('人工修正'))) {
    throw new Error(`Progress calibration was not applied safely: ${JSON.stringify(calibrated)}`)
  }
  process.stdout.write('AI progress milestone, guardrail, and correction-learning checks passed.\n')
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
  await runFinanceAnchorCheck(cookie)
  await runSupplementalActivityDateCheck(cookie)
  await runWorkflowWriteCheck(cookie)
  await runWorkflowReplayCheck()
  await runAgentLifecycleWriteCheck()
  await runPlannedProgressTransitionCheck(cookie)
  await runUploadLimitCheck(cookie)
  await runAcceptanceNoteGuardrailCheck(cookie)
  await runAiModelDraftListCheck(cookie)
  await runSiteWideModelPriorityCheck(cookie)
  await runLocalCliBridgeCheck(cookie)
  await runAgentOrchestrationCheck(cookie)
  await runBackgroundAnalysisCheck(cookie)
  await runAgentWorkspaceCheck(cookie)
  await runAiLearningCheck(cookie)
  await runProgressAssessmentCheck(cookie)
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
