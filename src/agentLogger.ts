/**
 * 结构化日志模块——输出 JSON 格式日志，便于 Cloudflare 日志分析和告警。
 * 每条日志包含 level、timestamp、event、context 字段。
 */

export type AgentLogLevel = 'debug' | 'info' | 'warn' | 'error'

export type AgentLogContext = {
  turnId?: string
  toolName?: string
  endpoint?: string
  durationMs?: number
  attempt?: number
  error?: string
  [key: string]: unknown
}

type AgentLogEntry = {
  level: AgentLogLevel
  ts: string
  event: string
  ctx: AgentLogContext
}

function emit(entry: AgentLogEntry): void {
  const line = JSON.stringify(entry)
  if (entry.level === 'error') console.error(line)
  else if (entry.level === 'warn') console.warn(line)
  else console.log(line)
}

export const agentLog = {
  debug(event: string, ctx: AgentLogContext = {}) {
    emit({ level: 'debug', ts: new Date().toISOString(), event, ctx })
  },
  info(event: string, ctx: AgentLogContext = {}) {
    emit({ level: 'info', ts: new Date().toISOString(), event, ctx })
  },
  warn(event: string, ctx: AgentLogContext = {}) {
    emit({ level: 'warn', ts: new Date().toISOString(), event, ctx })
  },
  error(event: string, ctx: AgentLogContext = {}) {
    emit({ level: 'error', ts: new Date().toISOString(), event, ctx })
  },
}
