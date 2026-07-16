#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, hostname, platform, arch } from 'node:os'
import { basename, delimiter, join } from 'node:path'

const VERSION = '0.3.0'
const CONFIG_DIR = join(homedir(), '.giverny')
const CONFIG_FILE = join(CONFIG_DIR, 'bridge.json')
const WORKSPACE_DIR = join(CONFIG_DIR, 'workspace')
const DEFAULT_SERVER = 'https://mayeai.com'

function compact(value, max = 240) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function executableCandidates(names) {
  const pathDirs = String(process.env.PATH || '').split(delimiter).filter(Boolean)
  const fallbackDirs = [
    join(homedir(), '.local', 'bin'),
    join(homedir(), '.grok', 'bin'),
    join(homedir(), '.npm-global', 'bin'),
    join(homedir(), '.bun', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
  ]
  const extensions = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : ['']
  return [...new Set([...pathDirs, ...fallbackDirs])].flatMap((dir) => names.flatMap((name) => extensions.map((ext) => join(dir, `${name}${ext}`))))
}

function findExecutable(names) {
  return executableCandidates(names).find((candidate) => existsSync(candidate)) || ''
}

function run(command, args, timeout = 5000) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    windowsHide: true,
    env: { ...process.env, NO_COLOR: '1', TERM: 'dumb' },
  })
  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim()
  return {
    ok: result.status === 0 && !result.error,
    output,
    error: result.error ? compact(result.error.message || '命令执行失败') : result.status === 0 ? '' : `命令退出码 ${result.status}`,
  }
}

function adapterResult(definition, command, version, status, authStatus, detail = '') {
  return {
    id: definition.id,
    name: definition.name,
    command,
    version: compact(version, 80),
    status,
    authStatus,
    supportsStreaming: definition.supportsStreaming,
    supportsMcp: definition.supportsMcp,
    detail: compact(detail),
  }
}

function scanCodex(definition, command) {
  const version = run(command, ['--version'])
  const auth = run(command, ['login', 'status'])
  const loggedIn = /logged in/i.test(auth.output)
  return adapterResult(definition, command, version.output, loggedIn ? 'available' : 'needs_auth', loggedIn ? 'authenticated' : 'signed_out', loggedIn ? '支持 JSONL 事件和 MCP。' : '请先运行 codex login。')
}

function scanClaude(definition, command) {
  const version = run(command, ['--version'])
  const auth = run(command, ['auth', 'status'])
  let loggedIn = false
  try {
    loggedIn = Boolean(JSON.parse(auth.output).loggedIn)
  } catch {
    loggedIn = /logged.?in/i.test(auth.output)
  }
  return adapterResult(definition, command, version.output, loggedIn ? 'available' : 'needs_auth', loggedIn ? 'authenticated' : 'signed_out', loggedIn ? '支持 stream-json 和 MCP。' : '请先运行 claude 登录。')
}

function scanGrok(definition, command) {
  const version = run(command, ['--version'])
  const help = run(command, ['--help'])
  const compatible = /streaming-json/.test(help.output) && /--single/.test(help.output)
  return adapterResult(definition, command, version.output, compatible ? 'available' : 'unsupported', 'unknown', compatible ? '支持单轮 streaming-json；首次运行时可能需要登录。' : '当前版本缺少可识别的无界面输出协议。')
}

function scanAntigravity(definition, command) {
  const version = run(command, ['--version'])
  return adapterResult(definition, command, version.output, 'unsupported', 'unknown', '已发现 Antigravity，但尚未确认安全的无界面结构化输出协议；不会使用跳过权限参数。')
}

export function scanLocalClis() {
  const definitions = [
    { id: 'codex', name: 'Codex CLI', commands: ['codex'], supportsStreaming: true, supportsMcp: true, scan: scanCodex },
    { id: 'claude', name: 'Claude Code', commands: ['claude'], supportsStreaming: true, supportsMcp: true, scan: scanClaude },
    { id: 'grok', name: 'Grok Build', commands: ['grok'], supportsStreaming: true, supportsMcp: true, scan: scanGrok },
    { id: 'antigravity', name: 'Antigravity', commands: ['agy', 'antigravity'], supportsStreaming: false, supportsMcp: false, scan: scanAntigravity },
  ]
  return definitions.map((definition) => {
    const command = findExecutable(definition.commands)
    if (!command) return adapterResult(definition, '', '', 'not_installed', 'unknown', '未在 PATH 和常见安装目录中发现。')
    return definition.scan(definition, command)
  })
}

function readConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'))
  } catch {
    return null
  }
}

function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  writeFileSync(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
}

async function request(server, pathname, options = {}) {
  const response = await fetch(`${server.replace(/\/$/, '')}${pathname}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `请求失败：${response.status}`)
  return payload
}

async function pair(code, server) {
  const clis = scanLocalClis()
  const payload = await request(server, '/api/local-cli/bridge/pair', {
    method: 'POST',
    body: JSON.stringify({
      code: code.replace(/\s+/g, '').toUpperCase(),
      name: hostname() || '我的电脑',
      platform: platform(),
      arch: arch(),
      bridgeVersion: VERSION,
      clis,
    }),
  })
  saveConfig({ server, deviceId: payload.deviceId, token: payload.token, deviceName: payload.deviceName })
  process.stdout.write(`已配对：${payload.deviceName}\n`)
  process.stdout.write(`扫描到 ${clis.filter((item) => item.status !== 'not_installed').length} 个 CLI。运行以下命令保持连接：\n`)
  process.stdout.write(`node ${process.argv[1]} start\n`)
}

async function heartbeat(config, clis) {
  return request(config.server, '/api/local-cli/bridge/heartbeat', {
    method: 'POST',
    headers: { authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ bridgeVersion: VERSION, clis }),
  })
}

async function completeCommand(config, commandId, result, error = '') {
  await request(config.server, `/api/local-cli/bridge/commands/${encodeURIComponent(commandId)}/complete`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ result, error }),
  })
}

async function reportCommandProgress(config, commandId, result) {
  await request(config.server, `/api/local-cli/bridge/commands/${encodeURIComponent(commandId)}/events`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ result }),
  })
}

async function commandState(config, commandId) {
  return request(config.server, `/api/local-cli/bridge/commands/${encodeURIComponent(commandId)}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${config.token}` },
  })
}

function appendTrace(state, value) {
  const line = compact(value, 180)
  if (!line || state.trace.includes(line)) return
  state.trace = [...state.trace, line].slice(-16)
}

function appendContent(state, value) {
  const text = String(value ?? '')
  if (!text) return
  if (!state.content) state.content = text
  else if (!state.content.endsWith(text)) state.content += text
  state.content = state.content.slice(-40_000)
}

function parseCliEvent(adapterId, line, state) {
  const trimmed = String(line || '').trim()
  if (!trimmed) return
  let event
  try {
    event = JSON.parse(trimmed)
  } catch {
    state.plainOutput = `${state.plainOutput}${state.plainOutput ? '\n' : ''}${trimmed}`.slice(-20_000)
    return
  }
  const type = String(event.type || '')
  if (event.thread_id || event.session_id) state.sessionId = String(event.thread_id || event.session_id).slice(0, 160)
  if (adapterId === 'codex') {
    if (type === 'thread.started') {
      state.sessionId = String(event.thread_id || '').slice(0, 160)
      appendTrace(state, '已连接 Codex CLI')
    } else if (type === 'turn.started') {
      appendTrace(state, '正在分析问题')
    } else if (type === 'item.started' || type === 'item.completed') {
      const item = event.item || {}
      if (item.type === 'command_execution') appendTrace(state, `执行本机命令：${compact(item.command || '受控命令', 100)}`)
      else if (item.type === 'mcp_tool_call') appendTrace(state, `读取 Giverny 数据：${compact(item.tool || item.name || 'MCP 工具', 80)}`)
      else if (item.type === 'agent_message' && type === 'item.completed') state.content = String(item.text || '').slice(0, 40_000)
      else if (item.type === 'reasoning') appendTrace(state, 'Codex CLI 正在核对信息')
    } else if (type === 'turn.completed') {
      appendTrace(state, 'Codex CLI 已完成本机执行')
    } else if (type.includes('failed') || type.includes('error')) {
      state.error = compact(event.error?.message || event.message || 'Codex CLI 执行失败', 600)
    }
    return
  }
  if (type === 'system') appendTrace(state, `${adapterId === 'claude' ? 'Claude Code' : '本机 CLI'} 已建立执行会话`)
  if (type === 'assistant') {
    const blocks = Array.isArray(event.message?.content) ? event.message.content : []
    for (const block of blocks) {
      if (block?.type === 'tool_use') appendTrace(state, `执行工具：${compact(block.name || '本机工具', 100)}`)
      if (block?.type === 'text') appendContent(state, block.text)
    }
  }
  if (type === 'content_block_delta' && event.delta?.text) appendContent(state, event.delta.text)
  if (type === 'result') {
    if (event.result) state.content = String(event.result).slice(0, 40_000)
    if (event.is_error) state.error = compact(event.result || event.error || '本机 CLI 执行失败', 600)
    appendTrace(state, '本机 CLI 已完成执行')
  }
  if (type.includes('tool') && (event.name || event.tool_name)) appendTrace(state, `执行工具：${compact(event.name || event.tool_name, 100)}`)
  if (type.includes('error') || type.includes('failed')) state.error = compact(event.error?.message || event.message || event.error || '本机 CLI 执行失败', 600)
}

function cliInvocation(adapterId, prompt, mcpUrl, resumeSessionId = '') {
  if (adapterId === 'codex') {
    const sharedConfig = [
      '-c', 'approval_policy="never"',
      '-c', 'sandbox_mode="workspace-write"',
      '-c', 'sandbox_workspace_write.network_access=true',
      '-c', `mcp_servers.giverny.url=${JSON.stringify(mcpUrl)}`,
      '-c', 'mcp_servers.giverny.bearer_token_env_var="GIVERNY_MCP_TOKEN"',
    ]
    if (resumeSessionId) {
      return {
        args: ['exec', 'resume', '--json', '--skip-git-repo-check', ...sharedConfig, resumeSessionId, prompt],
      }
    }
    return {
      args: [
        'exec', '--json', '--color', 'never', '--sandbox', 'workspace-write', '--skip-git-repo-check',
        '-C', WORKSPACE_DIR,
        ...sharedConfig,
        prompt,
      ],
    }
  }
  if (adapterId === 'claude') {
    const mcpConfig = JSON.stringify({
      mcpServers: { giverny: { type: 'http', url: mcpUrl, headers: { Authorization: 'Bearer ${GIVERNY_MCP_TOKEN}' } } },
    })
    return {
      args: [
        '-p', prompt, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'dontAsk',
        '--mcp-config', mcpConfig, '--strict-mcp-config', '--no-session-persistence',
        '--tools', 'Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,mcp__giverny__*',
      ],
    }
  }
  if (adapterId === 'grok') {
    return {
      args: ['--single', prompt, '--output-format', 'streaming-json', '--permission-mode', 'dontAsk', '--cwd', WORKSPACE_DIR],
    }
  }
  throw new Error('当前 CLI 尚未开放安全执行适配')
}

async function executeRunCommand(config, command) {
  const payload = command.payload || {}
  const adapterId = String(payload.adapterId || '')
  const adapter = scanLocalClis().find((item) => item.id === adapterId && item.status === 'available' && item.command)
  if (!adapter) {
    await completeCommand(config, command.id, {}, '所选 CLI 当前不可用，请重新扫描或登录')
    return
  }
  mkdirSync(WORKSPACE_DIR, { recursive: true, mode: 0o700 })
  const state = { trace: [payload.resumeSessionId ? '继续上次对话' : '已进入本机执行环境'], content: '', plainOutput: '', sessionId: '', error: '' }
  const timeoutMs = Math.min(Math.max(Number(payload.timeoutMs) || 180_000, 30_000), 300_000)
  let invocation
  try {
    invocation = cliInvocation(
      adapterId,
      String(payload.prompt || '').slice(0, 40_000),
      String(payload.mcpUrl || ''),
      String(payload.resumeSessionId || ''),
    )
  } catch (error) {
    await completeCommand(config, command.id, state, compact(error?.message || error, 600))
    return
  }
  appendTrace(state, payload.resumeSessionId ? `继续 ${adapter.name} 会话` : `连接 ${adapter.name}`)
  await reportCommandProgress(config, command.id, state)
  await new Promise((resolve) => {
    const child = spawn(adapter.command, invocation.args, {
      cwd: WORKSPACE_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
      env: {
        ...process.env,
        NO_COLOR: '1',
        TERM: 'dumb',
        GIVERNY_MCP_TOKEN: String(payload.mcpToken || ''),
      },
    })
    let stdoutBuffer = ''
    let stderrOutput = ''
    let closed = false
    let publishChain = Promise.resolve()
    const publish = () => {
      publishChain = publishChain
        .then(() => reportCommandProgress(config, command.id, state))
        .catch(() => undefined)
    }
    const consume = (chunk) => {
      stdoutBuffer += String(chunk)
      const lines = stdoutBuffer.split(/\r?\n/)
      stdoutBuffer = lines.pop() || ''
      for (const line of lines) parseCliEvent(adapterId, line, state)
      publish()
    }
    child.stdout.on('data', consume)
    child.stderr.on('data', (chunk) => { stderrOutput = `${stderrOutput}${String(chunk)}`.slice(-4000) })
    child.on('error', (error) => { state.error = compact(error.message, 600) })
    const heartbeatTimer = setInterval(() => { void heartbeat(config, undefined).catch(() => undefined) }, 15_000)
    const cancelTimer = setInterval(() => {
      void commandState(config, command.id).then((result) => {
        if (result.status === 'cancelled' && !closed) {
          state.error = '用户已停止本机 CLI 执行'
          child.kill('SIGTERM')
        }
      }).catch(() => undefined)
    }, 1_500)
    const timeoutTimer = setTimeout(() => {
      if (!closed) {
        state.error = `本机 CLI 执行超过 ${Math.round(timeoutMs / 1000)} 秒，已停止`
        child.kill('SIGTERM')
      }
    }, timeoutMs)
    child.on('close', async (code) => {
      closed = true
      clearInterval(heartbeatTimer)
      clearInterval(cancelTimer)
      clearTimeout(timeoutTimer)
      if (stdoutBuffer.trim()) parseCliEvent(adapterId, stdoutBuffer, state)
      if (!state.content && state.plainOutput) state.content = state.plainOutput
      if (!state.error && code !== 0) state.error = compact(stderrOutput || `命令退出码 ${code}`, 600)
      if (!state.error && !state.content) state.error = '本机 CLI 没有返回可显示的回答'
      await publishChain
      await completeCommand(config, command.id, {
        trace: state.trace,
        content: state.content,
        sessionId: state.sessionId,
        workspace: WORKSPACE_DIR,
      }, state.error)
      resolve()
    })
  })
}

async function pollCommand(config) {
  const payload = await request(config.server, '/api/local-cli/bridge/commands', {
    method: 'GET',
    headers: { authorization: `Bearer ${config.token}` },
  })
  if (!payload.command) return null
  if (payload.command.type === 'scan') {
    const clis = scanLocalClis()
    await completeCommand(config, payload.command.id, { clis })
    return clis
  }
  if (payload.command.type === 'run') {
    await executeRunCommand(config, payload.command)
    return null
  }
  await completeCommand(config, payload.command.id, {}, '当前 Bridge 不支持该命令')
  return null
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function start() {
  const config = readConfig()
  if (!config?.token || !config?.server) throw new Error('尚未配对，请先运行 pair 命令。')
  let clis = scanLocalClis()
  await heartbeat(config, clis)
  process.stdout.write(`Giverny Local Bridge ${VERSION} 已连接，设备：${config.deviceName || config.deviceId}\n`)
  process.stdout.write('按 Ctrl+C 停止。\n')
  let lastHeartbeat = Date.now()
  while (true) {
    try {
      const scanned = await pollCommand(config)
      if (scanned) clis = scanned
      if (Date.now() - lastHeartbeat >= 15_000) {
        await heartbeat(config, clis)
        lastHeartbeat = Date.now()
      }
    } catch (error) {
      process.stderr.write(`[Bridge] ${compact(error?.message || error)}\n`)
      await sleep(5_000)
    }
    await sleep(2_000)
  }
}

function printStatus() {
  const config = readConfig()
  process.stdout.write(`${config ? `已配对：${config.deviceName || config.deviceId}` : '尚未配对'}\n`)
  for (const item of scanLocalClis()) {
    process.stdout.write(`${item.name.padEnd(16)} ${item.status.padEnd(14)} ${item.version || basename(item.command || '')}\n`)
  }
}

function help() {
  process.stdout.write(`Giverny Local Bridge ${VERSION}\n\n`)
  process.stdout.write('用法：\n')
  process.stdout.write('  node giverny-bridge.mjs pair <配对码> [--server https://mayeai.com]\n')
  process.stdout.write('  node giverny-bridge.mjs start\n')
  process.stdout.write('  node giverny-bridge.mjs scan\n')
  process.stdout.write('  node giverny-bridge.mjs status\n')
}

const [action = 'help', value] = process.argv.slice(2)
const serverIndex = process.argv.indexOf('--server')
const server = serverIndex >= 0 ? process.argv[serverIndex + 1] : DEFAULT_SERVER

try {
  if (action === 'pair' && value) await pair(value, server)
  else if (action === 'start') await start()
  else if (action === 'scan') process.stdout.write(`${JSON.stringify(scanLocalClis(), null, 2)}\n`)
  else if (action === 'status') printStatus()
  else help()
} catch (error) {
  process.stderr.write(`${compact(error?.message || error)}\n`)
  process.exitCode = 1
}
