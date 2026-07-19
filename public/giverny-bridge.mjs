#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, renameSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir, hostname, platform, arch } from 'node:os'
import { basename, delimiter, isAbsolute, join, resolve } from 'node:path'

const VERSION = '0.4.0'
const CONFIG_DIR = join(homedir(), '.giverny')
const CONFIG_FILE = join(CONFIG_DIR, 'bridge.json')
const WORKSPACE_DIR = join(CONFIG_DIR, 'workspace')
const CODEX_RUNTIME_HOME = join(CONFIG_DIR, 'codex-runtime')
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

function proxyAwareEnv(baseEnv = process.env) {
  const env = { ...baseEnv }
  const existing = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']
    .find((key) => env[key])
  if (existing) return { env, mode: 'environment' }
  if (process.platform !== 'darwin') return { env, mode: 'direct' }

  const result = spawnSync('/usr/sbin/scutil', ['--proxy'], { encoding: 'utf8', timeout: 3000 })
  const values = {}
  for (const line of String(result.stdout || '').split(/\r?\n/)) {
    const match = line.match(/^\s*(HTTP|HTTPS|SOCKS)(Enable|Proxy|Port)\s*:\s*(.*?)\s*$/)
    if (match) values[`${match[1]}${match[2]}`] = match[3]
  }
  const setProxy = (name, value) => {
    if (!value) return
    env[name] = value
    env[name.toLowerCase()] = value
  }
  if (values.HTTPEnable === '1' && values.HTTPProxy && values.HTTPPort) {
    setProxy('HTTP_PROXY', `http://${values.HTTPProxy}:${values.HTTPPort}`)
  }
  if (values.HTTPSEnable === '1' && values.HTTPSProxy && values.HTTPSPort) {
    setProxy('HTTPS_PROXY', `http://${values.HTTPSProxy}:${values.HTTPSPort}`)
  }
  if (values.SOCKSEnable === '1' && values.SOCKSProxy && values.SOCKSPort) {
    setProxy('ALL_PROXY', `socks5h://${values.SOCKSProxy}:${values.SOCKSPort}`)
  }
  if (!env.NO_PROXY && !env.no_proxy) setProxy('NO_PROXY', 'localhost,127.0.0.1,::1,*.local')
  const detected = Boolean(env.HTTP_PROXY || env.HTTPS_PROXY || env.ALL_PROXY)
  return { env, mode: detected ? 'system' : 'direct' }
}

function ensureSymlink(source, target) {
  if (!existsSync(source)) return
  try {
    if (lstatSync(target).isSymbolicLink() && readlinkSync(target) === source) return
    unlinkSync(target)
  } catch {
    // Target does not exist yet.
  }
  symlinkSync(source, target)
}

function codexRuntimeConfig(sourceHome) {
  const sourcePath = join(sourceHome, 'config.toml')
  if (!existsSync(sourcePath)) return ''
  const rootKeys = new Set(['model', 'model_provider', 'model_reasoning_effort', 'service_tier', 'model_catalog_json'])
  const lines = []
  let section = ''
  let keepSection = false
  for (const rawLine of readFileSync(sourcePath, 'utf8').split(/\r?\n/)) {
    const trimmed = rawLine.trim()
    const sectionMatch = trimmed.match(/^\[([^\]]+)]$/)
    if (sectionMatch) {
      section = sectionMatch[1]
      keepSection = section.startsWith('model_providers.')
      if (keepSection) lines.push('', rawLine)
      continue
    }
    if (keepSection) {
      lines.push(rawLine)
      continue
    }
    if (section || !trimmed || trimmed.startsWith('#')) continue
    const keyValue = trimmed.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/)
    if (!keyValue || !rootKeys.has(keyValue[1])) continue
    let value = keyValue[2]
    if (keyValue[1] === 'model_catalog_json') {
      try {
        const parsed = JSON.parse(value)
        if (!isAbsolute(parsed)) value = JSON.stringify(join(sourceHome, parsed))
      } catch {
        // Keep the original TOML value if it is not a JSON string.
      }
    }
    lines.push(`${keyValue[1]} = ${value}`)
  }
  return `${lines.join('\n').trim()}\n`
}

function prepareCodexRuntime() {
  const sourceHome = String(process.env.CODEX_HOME || join(homedir(), '.codex'))
  mkdirSync(CODEX_RUNTIME_HOME, { recursive: true, mode: 0o700 })
  const config = codexRuntimeConfig(sourceHome)
  if (config.trim()) {
    const runtimeConfigPath = join(CODEX_RUNTIME_HOME, 'config.toml')
    writeFileSync(runtimeConfigPath, config, { mode: 0o600 })
    chmodSync(runtimeConfigPath, 0o600)
  }
  for (const name of ['auth.json', '.cockpit_codex_auth.json']) {
    ensureSymlink(join(sourceHome, name), join(CODEX_RUNTIME_HOME, name))
  }
  return CODEX_RUNTIME_HOME
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

function versionParts(value) {
  return String(value || '').split('.').map((part) => Number(part.replace(/\D.*$/, '')) || 0)
}

function versionIsNewer(candidate, current) {
  const next = versionParts(candidate)
  const active = versionParts(current)
  for (let index = 0; index < Math.max(next.length, active.length); index += 1) {
    if ((next[index] || 0) > (active[index] || 0)) return true
    if ((next[index] || 0) < (active[index] || 0)) return false
  }
  return false
}

function restartUpdatedBridge(scriptPath) {
  if (process.ppid === 1) {
    process.stdout.write(`[Bridge] 已更新到新版本，正在由系统服务重启。\n`)
    return
  }
  const child = spawn(process.execPath, [scriptPath, 'start'], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  })
  child.unref()
  process.stdout.write(`[Bridge] 已更新并重新启动。\n`)
}

async function maybeUpdateBridge(config, heartbeatResult) {
  const targetVersion = compact(heartbeatResult?.bridgeRuntimeVersion, 40)
  const updateUrl = compact(heartbeatResult?.bridgeDownloadUrl, 500)
  if (!targetVersion || !updateUrl || !versionIsNewer(targetVersion, VERSION)) return false

  const serverOrigin = new URL(config.server).origin
  const sourceUrl = new URL(updateUrl, serverOrigin)
  if (sourceUrl.origin !== serverOrigin || !['https:', 'http:'].includes(sourceUrl.protocol)) {
    throw new Error('Bridge 更新地址未通过同源校验')
  }
  const response = await fetch(sourceUrl, { headers: { accept: 'text/javascript' } })
  if (!response.ok) throw new Error(`Bridge 更新下载失败：${response.status}`)
  const source = await response.text()
  const expectedVersionLine = `const VERSION = '${targetVersion}'`
  if (!source.startsWith('#!/usr/bin/env node') || !source.includes(expectedVersionLine) || source.length > 1_000_000) {
    throw new Error('Bridge 更新文件校验失败')
  }

  const scriptPath = resolve(process.argv[1] || '')
  if (!scriptPath || !existsSync(scriptPath)) throw new Error('无法定位当前 Bridge 文件')
  const temporaryPath = `${scriptPath}.update-${process.pid}`
  writeFileSync(temporaryPath, source, { mode: 0o700 })
  chmodSync(temporaryPath, 0o700)
  renameSync(temporaryPath, scriptPath)
  restartUpdatedBridge(scriptPath)
  return true
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
  if (!state.timings.firstContentAt) state.timings.firstContentAt = Date.now()
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
  if (!state.timings.firstEventAt) state.timings.firstEventAt = Date.now()
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
      else if (item.type === 'agent_message' && type === 'item.completed') {
        if (!state.timings.firstContentAt) state.timings.firstContentAt = Date.now()
        state.content = String(item.text || '').slice(0, 40_000)
        state.contentFinal = Boolean(state.content)
      }
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
    if (state.content) state.contentFinal = true
    if (event.is_error) state.error = compact(event.result || event.error || '本机 CLI 执行失败', 600)
    appendTrace(state, '本机 CLI 已完成执行')
  }
  if (type.includes('tool') && (event.name || event.tool_name)) appendTrace(state, `执行工具：${compact(event.name || event.tool_name, 100)}`)
  if (type.includes('error') || type.includes('failed')) state.error = compact(event.error?.message || event.message || event.error || '本机 CLI 执行失败', 600)
}

function cliInvocation(adapterId, prompt, mcpUrl, resumeSessionId = '', timeoutMs = 12_000) {
  if (adapterId === 'codex') {
    const proxy = proxyAwareEnv(process.env)
    const runtimeHome = prepareCodexRuntime()
    const sharedConfig = [
      '-c', 'approval_policy="never"',
      '-c', 'sandbox_mode="workspace-write"',
      '-c', 'sandbox_workspace_write.network_access=true',
      '-c', `mcp_servers.giverny.url=${JSON.stringify(mcpUrl)}`,
      '-c', 'mcp_servers.giverny.bearer_token_env_var="GIVERNY_MCP_TOKEN"',
      '-c', 'mcp_servers.giverny.startup_timeout_sec=5',
      '-c', 'mcp_servers.giverny.tool_timeout_sec=12',
    ]
    if (timeoutMs <= 12_000) sharedConfig.push('-c', 'model_reasoning_effort="low"')
    return {
      args: [
        'exec', '--json', '--color', 'never', '--sandbox', 'workspace-write', '--skip-git-repo-check', '--ephemeral', '--ignore-rules',
        '--disable', 'plugins', '--disable', 'remote_plugin', '--disable', 'apps', '--disable', 'in_app_browser', '--disable', 'plugin_sharing',
        '-C', WORKSPACE_DIR,
        ...sharedConfig,
        prompt,
      ],
      env: { ...proxy.env, CODEX_HOME: runtimeHome },
      diagnostics: { proxyMode: proxy.mode, configMode: 'isolated', bridgeVersion: VERSION },
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

async function executeRunCommand(config, command, clis) {
  const payload = command.payload || {}
  const adapterId = String(payload.adapterId || '')
  const adapter = clis.find((item) => item.id === adapterId && item.status === 'available' && item.command)
  if (!adapter) {
    await completeCommand(config, command.id, {}, '所选 CLI 当前不可用，请重新扫描或登录')
    return
  }
  mkdirSync(WORKSPACE_DIR, { recursive: true, mode: 0o700 })
  const startedAt = Date.now()
  const state = {
    trace: [payload.resumeSessionId ? '继续上次对话' : '已进入本机执行环境'],
    content: '',
    contentFinal: false,
    plainOutput: '',
    sessionId: '',
    error: '',
    diagnostics: {},
    timings: { bridgeStartedAt: startedAt, cliSpawnedAt: 0, firstEventAt: 0, firstContentAt: 0, completedAt: 0, durationMs: 0 },
  }
  const timeoutMs = Math.min(Math.max(Number(payload.timeoutMs) || 12_000, 5_000), 50_000)
  let invocation
  try {
    invocation = cliInvocation(
      adapterId,
      String(payload.prompt || '').slice(0, 40_000),
      String(payload.mcpUrl || ''),
      String(payload.resumeSessionId || ''),
      timeoutMs,
    )
  } catch (error) {
    await completeCommand(config, command.id, state, compact(error?.message || error, 600))
    return
  }
  state.diagnostics = invocation.diagnostics || { proxyMode: 'environment', configMode: 'default', bridgeVersion: VERSION }
  if (state.diagnostics.configMode === 'isolated') appendTrace(state, '已启用 Giverny 专用 Codex 环境')
  if (state.diagnostics.proxyMode === 'system') appendTrace(state, '已读取 macOS 系统代理')
  else if (state.diagnostics.proxyMode === 'environment') appendTrace(state, '已继承代理环境')
  else appendTrace(state, '当前使用直连网络')
  appendTrace(state, payload.resumeSessionId ? `继续 ${adapter.name} 会话` : `连接 ${adapter.name}`)
  await reportCommandProgress(config, command.id, state)
  await new Promise((resolve) => {
    state.timings.cliSpawnedAt = Date.now()
    const child = spawn(adapter.command, invocation.args, {
      cwd: WORKSPACE_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
      env: {
        ...(invocation.env || process.env),
        NO_COLOR: '1',
        TERM: 'dumb',
        GIVERNY_MCP_TOKEN: String(payload.mcpToken || ''),
      },
    })
    let stdoutBuffer = ''
    let stderrOutput = ''
    let closed = false
    let forceKillTimer
    let publishChain = Promise.resolve()
    const stopChild = (message) => {
      if (closed) return
      state.error = message
      child.kill('SIGTERM')
      if (!forceKillTimer) {
        forceKillTimer = setTimeout(() => {
          if (!closed) child.kill('SIGKILL')
        }, 2_000)
      }
    }
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
        if (['cancelled', 'expired'].includes(result.status) && !closed) {
          stopChild(result.status === 'cancelled' ? '用户已停止本机 CLI 执行' : '网站等待已结束，本机 CLI 已停止')
        }
      }).catch(() => undefined)
    }, 1_500)
    const timeoutTimer = setTimeout(() => {
      if (!closed) {
        stopChild(`本机 CLI 执行超过 ${Math.round(timeoutMs / 1000)} 秒，已停止`)
      }
    }, timeoutMs)
    child.on('close', async (code) => {
      closed = true
      clearInterval(heartbeatTimer)
      clearInterval(cancelTimer)
      clearTimeout(timeoutTimer)
      if (forceKillTimer) clearTimeout(forceKillTimer)
      if (stdoutBuffer.trim()) parseCliEvent(adapterId, stdoutBuffer, state)
      if (!state.content && state.plainOutput) state.content = state.plainOutput
      if (state.content) state.contentFinal = true
      if (!state.error && code !== 0) state.error = compact(stderrOutput || `命令退出码 ${code}`, 600)
      if (!state.error && !state.content) state.error = '本机 CLI 没有返回可显示的回答'
      state.timings.completedAt = Date.now()
      state.timings.durationMs = state.timings.completedAt - startedAt
      await publishChain
      await completeCommand(config, command.id, {
        trace: state.trace,
        content: state.content,
        contentFinal: state.contentFinal,
        sessionId: state.sessionId,
        workspace: WORKSPACE_DIR,
        diagnostics: state.diagnostics,
        timings: state.timings,
      }, state.error)
      resolve()
    })
  })
}

async function pollCommand(config, clis) {
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
    await executeRunCommand(config, payload.command, clis)
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
  const initialHeartbeat = await heartbeat(config, clis)
  if (await maybeUpdateBridge(config, initialHeartbeat)) return
  process.stdout.write(`Giverny Local Bridge ${VERSION} 已连接，设备：${config.deviceName || config.deviceId}\n`)
  process.stdout.write('按 Ctrl+C 停止。\n')
  let lastHeartbeat = Date.now()
  while (true) {
    try {
      const scanned = await pollCommand(config, clis)
      if (scanned) clis = scanned
      if (Date.now() - lastHeartbeat >= 15_000) {
        const heartbeatResult = await heartbeat(config, clis)
        if (await maybeUpdateBridge(config, heartbeatResult)) return
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
