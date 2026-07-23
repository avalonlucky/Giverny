import type { AiModelProvider, AiModelRouteKey } from './api'
import type {
  AgentApproval,
  AgentBackgroundTask,
  AgentResultAttachment,
  AgentTaskSelection,
} from '../types/agent'
import { writeJsonLocalCache } from './localCache'

const CHAT_HISTORY_KEY = 'alice_chat_history'
const CHAT_PROJECTS_KEY = 'alice_chat_projects'
const CHAT_MODEL_CHOICE_KEY = 'alice_chat_model_choice'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  trace?: string[]
  traceStatus?: 'running' | 'completed' | 'failed'
  approval?: AgentApproval
  selection?: AgentTaskSelection
  backgroundTask?: AgentBackgroundTask
  attachments?: AgentResultAttachment[]
}

export type ConversationProject = { id: string; name: string; savedAt: number }

export type ConversationRecord = {
  id: string
  title: string
  messages: ChatMessage[]
  savedAt: number
  agentConversationId?: string
  cloud?: boolean
  projectId?: string
  projectName?: string
}

export type ChatModelChoice =
  | 'auto'
  | `route:${AiModelRouteKey}`
  | `provider:${AiModelProvider}`
  | 'doubao-seed-2-1-pro'
  | 'deepseek-v4-flash'
  | 'deepseek-v4-pro'
  | 'workers-ai'
  | `openrouter:${string}`

export function loadChatHistory(): ConversationRecord[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(window.localStorage.getItem(CHAT_HISTORY_KEY) ?? '[]') as ConversationRecord[]
  } catch {
    return []
  }
}

export function saveChatHistory(records: ConversationRecord[]) {
  writeJsonLocalCache(CHAT_HISTORY_KEY, records.slice(0, 50))
}

export function loadChatProjects(): ConversationProject[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(window.localStorage.getItem(CHAT_PROJECTS_KEY) ?? '[]') as ConversationProject[]
  } catch {
    return []
  }
}

export function saveChatProjects(projects: ConversationProject[]) {
  writeJsonLocalCache(CHAT_PROJECTS_KEY, projects.slice(0, 50))
}

function conversationRecordKey(record: Pick<ConversationRecord, 'id' | 'agentConversationId'>) {
  return record.agentConversationId || record.id
}

export function mergeConversationHistory(local: ConversationRecord[], cloud: ConversationRecord[]) {
  const merged = new Map<string, ConversationRecord>()
  local.forEach((record) => {
    merged.set(conversationRecordKey(record), record)
  })
  cloud.forEach((record) => {
    const key = conversationRecordKey(record)
    const localRecord = merged.get(key)
    merged.set(key, {
      ...record,
      messages: localRecord?.messages.length ? localRecord.messages : record.messages,
      savedAt: localRecord ? localRecord.savedAt : record.savedAt,
      agentConversationId: record.agentConversationId || localRecord?.agentConversationId || record.id,
      cloud: true,
    })
  })
  return Array.from(merged.values()).sort((a, b) => b.savedAt - a.savedAt).slice(0, 50)
}

export function writeChatHistoryRecord(record: ConversationRecord) {
  const recordKey = conversationRecordKey(record)
  const previous = loadChatHistory()
    .filter((item) => item.id !== record.id && conversationRecordKey(item) !== recordKey)
    .slice(0, 49)
  saveChatHistory([record, ...previous])
}

export function upsertChatHistory(
  recordId: string,
  messages: ChatMessage[],
  agentConversationId?: string,
  project?: ConversationProject | null,
) {
  const userMessages = messages.filter((message) => message.role === 'user')
  if (userMessages.length === 0) return
  const firstMessage = userMessages[0].content
  const record: ConversationRecord = {
    id: recordId,
    title: firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '…' : ''),
    messages,
    savedAt: Date.now(),
    agentConversationId,
    projectId: project?.id,
    projectName: project?.name,
  }
  writeChatHistoryRecord(record)
}

export function normalizeChatModelChoice(value: unknown): ChatModelChoice {
  const raw = String(value ?? '').trim()
  if (raw === 'doubao-seed-2-1-pro') return 'provider:doubao'
  if (raw === 'deepseek-v4-flash' || raw === 'deepseek-v4-pro') return 'provider:deepseek'
  if (raw === 'auto' || raw === 'workers-ai' || raw.startsWith('route:') || raw.startsWith('openrouter:')) {
    return raw as ChatModelChoice
  }
  if (raw.startsWith('provider:')) {
    const provider = raw.replace(/^provider:/, '')
    if (['deepseek', 'gemini', 'kimi', 'doubao', 'qwen', 'openai', 'openrouter', 'anthropic', 'custom-openai'].includes(provider)) {
      return `provider:${provider}` as ChatModelChoice
    }
  }
  return 'auto'
}

export function readChatModelChoice(): ChatModelChoice {
  if (typeof window === 'undefined') return 'auto'
  try {
    return normalizeChatModelChoice(window.localStorage.getItem(CHAT_MODEL_CHOICE_KEY))
  } catch {
    return 'auto'
  }
}

export function writeChatModelChoice(choice: ChatModelChoice) {
  try {
    writeJsonLocalCache(CHAT_MODEL_CHOICE_KEY, choice)
  } catch {
    // Best-effort browser preference; the server remains authoritative.
  }
}
