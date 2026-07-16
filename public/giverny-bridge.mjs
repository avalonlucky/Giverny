#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, hostname, platform, arch } from 'node:os'
import { basename, delimiter, join } from 'node:path'

const VERSION = '0.1.0'
const CONFIG_DIR = join(homedir(), '.giverny')
const CONFIG_FILE = join(CONFIG_DIR, 'bridge.json')
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
