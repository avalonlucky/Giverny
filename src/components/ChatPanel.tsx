import { type ClipboardEvent as ReactClipboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, BookOpen, CheckCircle2, ChevronDown, ChevronRight, FileText as FileTextIcon, Flower2, Globe, Maximize2, Minimize2, Plus, Search, Settings, Sparkles, Trash2, Waves, X } from 'lucide-react'
import { api, type AiModelConfig, type AiProviderConfig, type OpenRouterFreeModel } from '../lib/api'
import { aiBrandForValue, type AiBrandKey } from '../lib/aiBrands'
import { aiProviderDisplayLabel, chatModelChoiceLabel } from '../lib/chatModelPresentation'
import { createOptionalPreviewFile } from '../lib/attachmentPreview'
import {
  loadChatHistory,
  mergeConversationHistory,
  normalizeChatModelChoice,
  readChatModelChoice,
  saveChatHistory,
  upsertChatHistory,
  writeChatModelChoice,
  type ChatMessage,
  type ChatModelChoice,
  type ConversationRecord,
} from '../lib/conversationCache'
import { fileTypeForFile } from '../lib/fileTypes'
import { validateUploadFile } from '../lib/fileUpload'
import { formatFileSize } from '../lib/format'
import { localCliBrowserDeviceKey, localCliRuntimeReady } from '../lib/localCli'
import { providerSupportsVision } from '../lib/aiProviders'
import { givernyCopy } from '../lib/brandCopy'
import type { FileAsset } from '../types/domain'
import type { AgentApproval, AgentBackgroundTask, AgentConversationMessage, AgentConversationSummary, AgentResultAttachment, AgentTaskSelection, AgentUploadHandoff } from '../types/agent'
import type { ToastTone } from '../lib/toastQueue'
import { AgentAnalysisTaskCard } from './AgentAnalysisTaskCard'
import { AgentApprovalCard } from './AgentApprovalCard'
import { AgentAttachmentResults, AgentResultPreviewModal } from './AgentAttachmentResults'
import { AgentExecutionTimeline } from './AgentExecutionTimeline'
import { AgentTaskSelectionCard } from './AgentTaskSelectionCard'
import { AiBrandIcon } from './AiBrandIcon'
import { ChatContent } from './ChatContent'
import { ChatSidebar } from './ChatSidebar'
import { EmptyState } from './EmptyState'
import { ImageLightbox } from './CommandPalette'

type ChatAttachment = { id: string; type: 'image' | 'text' | 'file'; name: string; data: string; mimeType: string; preview?: string; file: File }
type ActiveLocalCliRoute = { adapterId: string; name: string; version: string; deviceName: string }

const ALICE_WELCOME_ID = 'alice-welcome'
const ALICE_SUGGESTED = ['今天完成了哪些工作？', '生成本周工作摘要', '分析最近几个月的工作趋势']

type ChatPanelProps = {
  currentMonthValue: string
  aiModelConfig: AiModelConfig | null
  aiProviderConfigs: AiProviderConfig[]
  initialAnalysisJobId?: string
  onClose: () => void
  onOpenTask: (taskId: number) => void
  onNotify: (message: string, tone?: ToastTone) => void
  canConfigureModel?: boolean
}

export function ChatPanel({
  currentMonthValue,
  aiModelConfig,
  aiProviderConfigs,
  initialAnalysisJobId,
  onClose,
  onOpenTask,
  onNotify,
  canConfigureModel = true,
}: ChatPanelProps) {
  const initialConversation = initialAnalysisJobId
    ? loadChatHistory().find((record) => record.messages.some((message) => message.backgroundTask?.id === initialAnalysisJobId))
    : undefined
  const [messages, setMessages] = useState<ChatMessage[]>(initialConversation?.messages ?? [{ id: ALICE_WELCOME_ID, role: 'assistant', content: '' }])
  const [conversationRecordId, setConversationRecordId] = useState<string>(() => initialConversation?.id ?? crypto.randomUUID())
  const [agentConversationId, setAgentConversationId] = useState<string | undefined>(initialConversation?.agentConversationId)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [useKnowledge, setUseKnowledge] = useState(true)
  const [useWebSearch, setUseWebSearch] = useState(false)
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [expanded, setExpanded] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false)
  const [selectedModelChoice, setSelectedModelChoice] = useState<ChatModelChoice>(() => readChatModelChoice())
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterFreeModel[]>([])
  const [isLoadingOpenRouterModels, setIsLoadingOpenRouterModels] = useState(false)
  const [historyList, setHistoryList] = useState<ConversationRecord[]>(() => loadChatHistory())
  const [historySearch, setHistorySearch] = useState('')
  const [activeLocalCommandId, setActiveLocalCommandId] = useState('')
  const [isCancellingLocalCommand, setIsCancellingLocalCommand] = useState(false)
  const [activeLocalCliRoute, setActiveLocalCliRoute] = useState<ActiveLocalCliRoute | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [agentPreviewAttachment, setAgentPreviewAttachment] = useState<AgentResultAttachment | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isWelcome = messages.length === 1 && messages[0].id === ALICE_WELCOME_ID

  // --- Effects ---
  useEffect(() => { if (!isWelcome) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isWelcome])
  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    let cancelled = false
    const refreshLocalRoute = async () => {
      try {
        const result = await api.getLocalCliDevices(localCliBrowserDeviceKey())
        const device = result.devices.find((item) => item.online && item.selectedCliId && localCliRuntimeReady(item.bridgeVersion))
        const cli = device?.clis.find((item) => item.id === device.selectedCliId && item.status === 'available')
        if (!cancelled) {
          setActiveLocalCliRoute(device && cli ? { adapterId: cli.id, name: cli.name, version: cli.version, deviceName: device.name } : null)
        }
      } catch { if (!cancelled) setActiveLocalCliRoute(null) }
    }
    void refreshLocalRoute()
    const timer = window.setInterval(() => void refreshLocalRoute(), 8_000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [])

  // Auto-save conversation
  useEffect(() => {
    if (!isWelcome) upsertChatHistory(conversationRecordId, messages, agentConversationId, null)
  }, [agentConversationId, conversationRecordId, isWelcome, messages])

  const refreshCloudHistory = useCallback(async () => {
    const response = await fetch('/api/ai/conversations')
    const data = await response.json().catch(() => null) as { conversations?: AgentConversationSummary[] } | null
    if (!response.ok || !Array.isArray(data?.conversations)) return
    const cloudRecords = data.conversations.map((item) => ({
      id: item.id,
      title: item.title,
      messages: [] as ChatMessage[],
      savedAt: new Date(item.updatedAt).getTime(),
      agentConversationId: item.id,
      cloud: true,
    }))
    setHistoryList(mergeConversationHistory(loadChatHistory(), cloudRecords))
  }, [])

  useEffect(() => {
    let cancelled = false
    const migrateAndLoad = async () => {
      const local = loadChatHistory()
      if (local.length > 0) {
        await fetch('/api/ai/conversations/sync', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ conversations: local.map((record) => ({
            id: record.id, agentConversationId: record.agentConversationId, title: record.title, savedAt: record.savedAt,
            messages: record.messages.map((message, index) => ({ ...message, createdAt: record.savedAt + index })),
          })) }),
        }).catch(() => undefined)
      }
      if (!cancelled) await refreshCloudHistory()
    }
    void migrateAndLoad()
    return () => { cancelled = true }
  }, [refreshCloudHistory])

  // Poll active analysis jobs
  const activeAnalysisKey = messages
    .map((m) => m.backgroundTask)
    .filter((t): t is AgentBackgroundTask => Boolean(t && (t.status === 'queued' || t.status === 'running')))
    .map((t) => t.id).sort().join(',')

  useEffect(() => {
    const ids = activeAnalysisKey ? activeAnalysisKey.split(',').filter(Boolean) : []
    if (ids.length === 0) return
    let cancelled = false
    const refresh = async () => {
      const tasks = await Promise.all(ids.map(async (id) => {
        const r = await fetch(`/api/ai/analysis-jobs/${encodeURIComponent(id)}`)
        const d = await r.json().catch(() => null) as { job?: AgentBackgroundTask } | null
        return r.ok ? d?.job : undefined
      }))
      if (cancelled) return
      const byId = new Map(tasks.filter((t): t is AgentBackgroundTask => Boolean(t)).map((t) => [t.id, t]))
      if (byId.size > 0) {
        setMessages((current) => current.map((m) => (
          m.backgroundTask && byId.has(m.backgroundTask.id) ? { ...m, backgroundTask: byId.get(m.backgroundTask.id) } : m
        )))
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 2500)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [activeAnalysisKey])

  useEffect(() => { writeChatModelChoice(selectedModelChoice) }, [selectedModelChoice])
  useEffect(() => {
    let cancelled = false
    void api.getActiveAiModelChoice().then(({ choice }) => { if (!cancelled) setSelectedModelChoice(normalizeChatModelChoice(choice)) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Close settings/dropdown on outside click
  useEffect(() => {
    if (!showSettings && !showHistoryDropdown) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (showSettings && !target.closest('.alice-settings-popup') && !target.closest('.alice-settings-btn')) setShowSettings(false)
      if (showHistoryDropdown && !target.closest('.chat-history-dropdown') && !target.closest('.chat-panel-title')) setShowHistoryDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSettings, showHistoryDropdown])

  // History search (cloud)
  useEffect(() => {
    const q = historySearch.trim()
    if (!q) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void fetch(`/api/ai/conversations/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
        .then(({ ok, d }: { ok: boolean; d: { conversations?: AgentConversationSummary[] } }) => {
          if (!ok || cancelled || !Array.isArray(d.conversations)) return
          const cloudRecords = d.conversations.map((item) => ({
            id: item.id, title: item.title, messages: [] as ChatMessage[],
            savedAt: new Date(item.updatedAt).getTime(), agentConversationId: item.id, cloud: true,
          }))
          setHistoryList((current) => mergeConversationHistory(loadChatHistory(), [...current.filter((r) => r.cloud), ...cloudRecords]))
        }).catch(() => undefined)
    }, 220)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [historySearch])

  // --- Core functions ---
  const newConversation = () => {
    if (!isWelcome) upsertChatHistory(conversationRecordId, messages, agentConversationId, null)
    setHistoryList(mergeConversationHistory(loadChatHistory(), historyList.filter((r) => r.cloud)))
    setMessages([{ id: ALICE_WELCOME_ID, role: 'assistant', content: '' }])
    setConversationRecordId(crypto.randomUUID())
    setAgentConversationId(undefined)
    setInput('')
    setAttachments([])
    setShowSettings(false)
    setShowHistoryDropdown(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const loadConversation = async (record: ConversationRecord) => {
    let nextMessages = record.messages
    if (record.cloud || nextMessages.length === 0) {
      const response = await fetch(`/api/ai/conversations/${encodeURIComponent(record.agentConversationId || record.id)}`)
      const data = await response.json().catch(() => null) as { messages?: AgentConversationMessage[] } | null
      if (!response.ok || !Array.isArray(data?.messages)) {
        if (record.messages.length === 0) { onNotify('云端会话读取失败，请稍后重试', 'error'); return }
        nextMessages = record.messages
      } else {
        const cloudMessages = data.messages.map((message) => ({
          id: message.id, role: message.role, content: message.content, trace: message.trace,
          traceStatus: message.trace?.length ? 'completed' as const : undefined,
          approval: message.approval, selection: message.selection, backgroundTask: message.backgroundTask, attachments: message.attachments,
        }))
        nextMessages = cloudMessages.length > 0 ? cloudMessages : record.messages
      }
    }
    setMessages(nextMessages)
    setConversationRecordId(record.id)
    setAgentConversationId(record.agentConversationId || record.id)
    setShowHistoryDropdown(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const deleteHistoryItem = async (id: string) => {
    const target = historyList.find((r) => r.id === id || r.agentConversationId === id)
    const cloudId = target?.agentConversationId || id
    const updatedLocal = loadChatHistory().filter((r) => r.id !== id && r.agentConversationId !== id && r.id !== cloudId && r.agentConversationId !== cloudId)
    saveChatHistory(updatedLocal)
    setHistoryList((current) => current.filter((r) => r.id !== id && r.agentConversationId !== id && r.id !== cloudId && r.agentConversationId !== cloudId))
    await fetch(`/api/ai/conversations/${encodeURIComponent(cloudId)}`, { method: 'DELETE' }).catch(() => undefined)
  }

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files) return
    const added: ChatAttachment[] = []
    for (const file of Array.from(files).slice(0, 4)) {
      const isImage = file.type.startsWith('image/')
      const isText = file.type.startsWith('text/') || /\.(txt|md|json|csv)$/i.test(file.name)
      const data = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        if (isImage) { reader.onload = () => { resolve((reader.result as string).split(',')[1] ?? '') }; reader.readAsDataURL(file) }
        else if (isText) { reader.onload = () => resolve(reader.result as string); reader.readAsText(file) }
        else resolve('')
      })
      added.push({ id: crypto.randomUUID(), type: isImage ? 'image' : isText ? 'text' : 'file', name: file.name, data, mimeType: file.type || 'text/plain', preview: isImage ? `data:${file.type || 'image/jpeg'};base64,${data}` : undefined, file })
    }
    setAttachments((prev) => [...prev, ...added].slice(0, 4))
  }

  const handleInputPaste = (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
    const pastedImages = Array.from(event.clipboardData.items).filter((item) => item.kind === 'file' && item.type.startsWith('image/')).map((item) => item.getAsFile()).filter((file): file is File => Boolean(file))
    if (pastedImages.length === 0) return
    event.preventDefault()
    void handleFiles(pastedImages)
  }

  const openSettings = () => {
    setShowSettings((v) => !v)
    if (openRouterModels.length > 0 || isLoadingOpenRouterModels) return
    setIsLoadingOpenRouterModels(true)
    api.getOpenRouterFreeModels().then((result) => { setOpenRouterModels((result.models ?? []).filter((m) => m.status === 'ok').slice(0, 12)) }).catch(() => setOpenRouterModels([])).finally(() => setIsLoadingOpenRouterModels(false))
  }

  const chooseModel = async (choice: ChatModelChoice) => {
    const previous = selectedModelChoice
    setSelectedModelChoice(choice)
    setShowSettings(false)
    try {
      const saved = await api.setActiveAiModelChoice(choice)
      setSelectedModelChoice(normalizeChatModelChoice(saved.choice))
      onNotify(choice === 'auto' ? '已恢复自动模型路由' : `已将 ${chatModelChoiceLabel(choice, aiModelConfig, aiProviderConfigs)} 设为全站 AI 首选`, 'success')
    } catch (error) {
      setSelectedModelChoice(previous)
      onNotify(error instanceof Error ? error.message : '模型优先级保存失败', 'error')
    }
  }

  const reviseApproval = async (messageId: string, approvalId: string, draft: Record<string, unknown>) => {
    if (!agentConversationId) throw new Error('当前会话已失效，请重新生成任务草稿。')
    const res = await fetch('/api/ai/approval', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agentRuntimeConversationId: agentConversationId, approvalId, draft }) })
    const data = (await res.json().catch(() => null)) as { approval?: AgentApproval; error?: string } | null
    if (!res.ok || !data?.approval) throw new Error(data?.error ?? '草稿更新失败')
    setMessages((current) => current.map((m) => (m.id === messageId ? { ...m, approval: data.approval } : m)))
  }

  const updateAnalysisTask = async (messageId: string, taskId: string, action: 'cancel' | 'retry') => {
    const response = await fetch(`/api/ai/analysis-jobs/${encodeURIComponent(taskId)}/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' } })
    const data = await response.json().catch(() => null) as { job?: AgentBackgroundTask; error?: string } | null
    if (!response.ok || !data?.job) { onNotify(data?.error || (action === 'cancel' ? '取消分析失败' : '重新分析失败'), 'error'); return }
    setMessages((current) => current.map((m) => (m.id === messageId ? { ...m, backgroundTask: data.job } : m)))
    onNotify(action === 'cancel' ? '后台分析已取消' : '已重新启动后台分析', action === 'cancel' ? 'info' : 'success')
  }

  const stopLocalCliExecution = async () => {
    if (!activeLocalCommandId || isCancellingLocalCommand) return
    setIsCancellingLocalCommand(true)
    try { await api.cancelLocalCliCommand(activeLocalCommandId); onNotify('正在停止本机 CLI…', 'info') }
    catch (error) { setIsCancellingLocalCommand(false); onNotify(error instanceof Error ? error.message : '停止本机 CLI 失败', 'error') }
  }

  const send = async (overrideText?: string, approvalDecision?: { messageId: string; approvalId: string }) => {
    let text = (overrideText !== undefined ? overrideText : input).trim()
    if ((!text && attachments.length === 0) || loading) return
    const sentAttachments = [...attachments]
    const targetTaskId = Number(text.match(/(?:任务\s*)?#(\d+)/)?.[1] || 0)
    let filesUploadedBeforeAgent = false
    if (targetTaskId && sentAttachments.length > 0 && overrideText === undefined) {
      setLoading(true)
      try {
        const uploaded: FileAsset[] = []
        for (const item of sentAttachments) {
          validateUploadFile(item.file)
          const preview = await createOptionalPreviewFile(item.file)
          uploaded.push(await api.uploadFile({ taskId: targetTaskId, scope: 'progress', file: item.file, preview, type: fileTypeForFile(item.file).type, size: formatFileSize(item.file.size), final: false, visible: true, tag: 'Agent 对话附件', analyze: true }))
        }
        filesUploadedBeforeAgent = true
        text = `${text}\n\n[已上传到任务 #${targetTaskId} 的真实附件：${uploaded.map((f) => `${f.name}（attachmentId=${f.id}）`).join('、')}]`
      } catch (error) { onNotify(error instanceof Error ? `附件上传失败：${error.message}` : '附件上传失败', 'error'); setLoading(false); return }
    }
    if (!targetTaskId && sentAttachments.length > 0) {
      text = `${text}${text ? '\n\n' : ''}[待上传附件：${sentAttachments.map((item) => `${item.name}（${item.file.size} 字节，${item.mimeType}）`).join('、')}；请先定位所属任务并调用上传接力工具]`
    }
    const displayText = text || `[附件：${attachments.map((a) => a.name).join('、')}]`
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: displayText }
    const assistantId = crypto.randomUUID()
    const baseMessages = (isWelcome ? [] : messages).map((m) => (
      approvalDecision && m.id === approvalDecision.messageId && m.approval?.id === approvalDecision.approvalId
        ? { ...m, approval: { ...m.approval, status: 'processing' as const } } : m
    ))
    if (overrideText === undefined) setInput('')
    setAttachments([])
    setMessages([...baseMessages, userMsg, { id: assistantId, role: 'assistant', content: '', trace: [], traceStatus: 'running' }])
    setLoading(true)
    try {
      const allMessages = [...baseMessages, userMsg].map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          messages: allMessages, month: currentMonthValue, useKnowledge, useWebSearch,
          modelChoice: selectedModelChoice,
          attachments: sentAttachments.filter((item) => item.type !== 'file').map(({ type, name, data, mimeType }) => ({ type, name, data, mimeType })),
          agentRuntimeConversationId: agentConversationId,
          localCliConversationId: conversationRecordId,
          browserDeviceKey: localCliBrowserDeviceKey(),
        }),
      })
      if (!res.ok) { const err = (await res.json().catch(() => null)) as { error?: string } | null; throw new Error(err?.error ?? `请求失败：${res.status}`) }
      type AgentChatResult = { content?: string; thinking?: string; reasoningExpected?: boolean; trace?: string[]; agentRuntimeConversationId?: string; approval?: AgentApproval; selection?: AgentTaskSelection; backgroundTask?: AgentBackgroundTask; attachments?: AgentResultAttachment[]; uploadHandoff?: AgentUploadHandoff }
      let uploadHandoffStarted = false
      const applyAgentResult = (data: AgentChatResult) => {
        if (data.agentRuntimeConversationId) setAgentConversationId(data.agentRuntimeConversationId)
        setMessages((prev) => prev.map((m) => {
          if (m.id === assistantId) {
            return { ...m, content: data.content ?? '（无回复）', thinking: data.thinking ?? m.thinking, reasoningExpected: data.reasoningExpected ?? m.reasoningExpected, trace: data.trace?.length ? data.trace : m.trace, traceStatus: 'completed',
              ...(data.approval?.status === 'pending' ? { approval: data.approval } : {}),
              ...(data.selection ? { selection: data.selection } : {}),
              ...(data.backgroundTask ? { backgroundTask: data.backgroundTask } : {}),
              ...(data.attachments?.length ? { attachments: data.attachments } : {}) }
          }
          if (data.approval && m.approval?.id === data.approval.id) return { ...m, approval: data.approval }
          if (approvalDecision && m.id === approvalDecision.messageId && m.approval?.id === approvalDecision.approvalId) {
            return { ...m, approval: data.approval ?? { ...m.approval, status: 'failed', error: 'Agent 没有返回操作结果，请重新生成预览。' } }
          }
          return m
        }))
        if (data.uploadHandoff && !filesUploadedBeforeAgent && !uploadHandoffStarted && sentAttachments.length > 0) {
          uploadHandoffStarted = true
          const handoff = data.uploadHandoff
          const allowedNames = new Set(handoff.files.map((f) => f.name))
          void (async () => {
            if (!sentAttachments.every((item) => allowedNames.has(item.name))) throw new Error('上传接力返回的文件清单与当前附件不一致')
            const uploaded: FileAsset[] = []
            for (const item of sentAttachments) {
              validateUploadFile(item.file)
              const preview = await createOptionalPreviewFile(item.file)
              uploaded.push(await api.uploadFile({ taskId: handoff.taskId, scope: handoff.scope, file: item.file, preview, type: fileTypeForFile(item.file).type, size: formatFileSize(item.file.size), final: handoff.scope === 'acceptance', visible: true, tag: 'Agent 对话附件', analyze: true }))
            }
            setMessages((current) => current.map((msg) => msg.id === assistantId ? { ...msg, content: `${msg.content}\n\n已将 ${uploaded.length} 个附件上传到"${handoff.taskTitle}"。` } : msg))
            onNotify(`已上传到"${handoff.taskTitle}"`, 'success')
          })().catch((error) => onNotify(error instanceof Error ? `附件上传失败：${error.message}` : '附件上传失败', 'error'))
        }
      }
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('text/event-stream')) { applyAgentResult((await res.json()) as AgentChatResult); return }
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''; let streamError = ''; let receivedResult = false
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') break
          try {
            const event = JSON.parse(payload) as AgentChatResult & { type?: string; status?: string; error?: string; t?: string; commandId?: string; runtime?: string }
            if (event.type === 'trace' && (event.trace?.length || event.thinking !== undefined || event.reasoningExpected !== undefined)) {
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, thinking: event.thinking ?? m.thinking, reasoningExpected: event.reasoningExpected ?? m.reasoningExpected, trace: event.trace?.length ? event.trace : m.trace, traceStatus: 'running' } : m)))
            } else if (event.type === 'route' && event.runtime === 'local-cli' && event.commandId) {
              setActiveLocalCommandId(event.commandId)
            } else if (event.type === 'result') { receivedResult = true; applyAgentResult(event) }
            else if (event.type === 'error') { streamError = event.error || 'Agent 请求失败' }
            else if (event.t) { setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + event.t } : m))) }
          } catch { /* skip */ }
        }
      }
      if (streamError) throw new Error(streamError)
      if (!receivedResult) setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, traceStatus: 'completed' } : m)))
    } catch (e) {
      const msg = e instanceof Error ? e.message : '请求失败，请重试'
      setMessages((prev) => prev.map((m) => {
        if (m.id === assistantId) return { ...m, content: `⚠️ ${msg}`, trace: [...(m.trace ?? []), '执行失败：请检查服务状态后重试'], traceStatus: 'failed' }
        if (approvalDecision && m.id === approvalDecision.messageId && m.approval?.id === approvalDecision.approvalId) return { ...m, approval: { ...m.approval, status: 'failed', error: msg } }
        return m
      }))
    } finally { setLoading(false); setActiveLocalCommandId(''); setIsCancellingLocalCommand(false) }
  }

  // --- Model options ---
  const activeProviderConfigs = useMemo(() => aiProviderConfigs.filter((c) => c.enabled && c.hasApiKey && c.models.includes(c.defaultModel)), [aiProviderConfigs])
  const modelOptions: Array<{ value: ChatModelChoice; label: string; meta: string; brand: AiBrandKey }> = [
    { value: 'auto', label: activeLocalCliRoute ? `自动 · ${activeLocalCliRoute.name}` : '自动路由', meta: activeLocalCliRoute ? '普通问答优先本机 CLI；深度分析自动使用站内 Agent' : '由站内 Agent 自动选择模型', brand: activeLocalCliRoute ? aiBrandForValue(activeLocalCliRoute.adapterId) : 'auto' },
    ...activeProviderConfigs.map((config) => ({
      value: `provider:${config.provider}` as ChatModelChoice,
      label: config.defaultModel,
      meta: `${aiProviderDisplayLabel(config.provider)} · 手动最高优先级${providerSupportsVision(config.provider) ? ' · 支持识图' : ''}`,
      brand: aiBrandForValue(`${config.provider} ${config.defaultModel}`),
    })),
  ]
  const usesLocalCli = selectedModelChoice === 'auto' && Boolean(activeLocalCliRoute)
  const activeRuntimeLabel = usesLocalCli ? activeLocalCliRoute!.name : chatModelChoiceLabel(selectedModelChoice, aiModelConfig, aiProviderConfigs)
  const activeRuntimeBrand = usesLocalCli ? aiBrandForValue(activeLocalCliRoute!.adapterId) : aiBrandForValue(`${selectedModelChoice} ${activeRuntimeLabel}`)

  const recentHistory = useMemo(() => [...historyList].sort((a, b) => b.savedAt - a.savedAt).slice(0, 10), [historyList])

  // --- Render ---
  return (
    <div className={`chat-panel ${expanded ? 'is-expanded' : ''}`} role="dialog" aria-label="爱丽丝">
      {/* Sidebar (fullscreen mode) */}
      {expanded && showSidebar && (
        <ChatSidebar
          history={historyList}
          activeConversationId={conversationRecordId}
          onSelect={(record) => void loadConversation(record)}
          onNew={newConversation}
          onDelete={(id) => void deleteHistoryItem(id)}
          onOpenSettings={openSettings}
          onClose={() => setShowSidebar(false)}
        />
      )}

      <div className="chat-panel-main">
        {/* Header */}
        <div className="chat-panel-header">
          <div className="chat-panel-identity">
            <span className="chat-panel-brand-mark" aria-hidden="true"><Sparkles size={16} /></span>
            <div
              className="chat-panel-title"
              onClick={() => { setShowHistoryDropdown((v) => !v); void refreshCloudHistory() }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setShowHistoryDropdown((v) => !v)}
            >
              <div>
                <span>爱丽丝</span>
                <ChevronDown size={12} className="chat-panel-title-chevron" />
              </div>
              <p className="chat-panel-runtime">
                <span aria-hidden="true" />
                {activeRuntimeLabel}
                {usesLocalCli && <em>本机</em>}
              </p>
            </div>
          </div>
          <div className="chat-panel-header-actions">
            {expanded && !showSidebar && (
              <button type="button" className="chat-panel-icon-btn" onClick={() => setShowSidebar(true)} title="显示侧栏" aria-label="显示侧栏">
                <Search size={15} />
              </button>
            )}
            <button type="button" className="chat-panel-icon-btn" onClick={() => setExpanded((v) => !v)} title={expanded ? '收起为侧栏' : '展开全屏'} aria-label={expanded ? '收起' : '展开'}>
              {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button type="button" className="chat-panel-icon-btn" onClick={onClose} aria-label="关闭"><X size={15} /></button>
          </div>
        </div>

        {/* History dropdown (drawer mode) */}
        {showHistoryDropdown && (
          <div className="chat-history-dropdown">
            <div className="chat-history-dropdown-search">
              <Search size={13} />
              <input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="搜索对话…" aria-label="搜索对话" />
            </div>
            <div className="chat-history-dropdown-list">
              {recentHistory.length === 0 && <EmptyState variant="inline" title="暂无历史记录" />}
              {recentHistory.map((r) => (
                <div key={r.id} className={`chat-history-dropdown-item ${r.id === conversationRecordId ? 'active' : ''}`} onClick={() => void loadConversation(r)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && void loadConversation(r)}>
                  <span>{r.title}</span>
                  <small>{new Date(r.savedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
                  <button type="button" className="chat-history-dropdown-del" onClick={(e) => { e.stopPropagation(); void deleteHistoryItem(r.id) }} title="删除" aria-label={`删除：${r.title}`}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
            <button type="button" className="chat-history-dropdown-new" onClick={newConversation}>
              <Plus size={14} /> 新对话
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="chat-panel-messages">
          {isWelcome ? (
            <div className="alice-welcome">
              <span className="alice-welcome-lily" aria-hidden="true"><Waves /><Flower2 /></span>
              <div className="alice-welcome-kicker">Giverny Agent</div>
              <h2 className="alice-welcome-title">{givernyCopy.assistantWelcomeTitle}</h2>
              <p className="alice-welcome-sub">{givernyCopy.assistantWelcomeDescription}</p>
              <div className="alice-suggested">
                {ALICE_SUGGESTED.map((s, index) => (
                  <button key={s} type="button" className="alice-suggested-btn" onClick={() => void send(s)}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{s}</strong>
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                  {msg.role === 'assistant' && (msg.thinking || msg.trace?.length || msg.traceStatus === 'running') ? (
                    <AgentExecutionTimeline thinking={msg.thinking} reasoningExpected={msg.reasoningExpected} trace={msg.trace ?? []} status={msg.traceStatus ?? 'completed'} />
                  ) : null}
                  {msg.content ? <ChatContent content={msg.content} /> : (msg.role === 'assistant' && loading ? <span className="chat-cursor" /> : '…')}
                  {msg.role === 'assistant' && msg.approval && (
                    <AgentApprovalCard approval={msg.approval} busy={loading} onRevise={(draft) => reviseApproval(msg.id, msg.approval!.id, draft)} onOpenTask={onOpenTask} onDecision={(decision) => void send(decision === 'confirm' ? '确认执行' : '取消', { messageId: msg.id, approvalId: msg.approval!.id })} />
                  )}
                  {msg.role === 'assistant' && msg.selection && (
                    <AgentTaskSelectionCard selection={msg.selection} busy={loading} onSelect={(candidate) => void send(`选择任务 #${candidate.id}：${candidate.title}`)} />
                  )}
                  {msg.role === 'assistant' && msg.backgroundTask && (
                    <AgentAnalysisTaskCard task={msg.backgroundTask} busy={loading} onCancel={() => void updateAnalysisTask(msg.id, msg.backgroundTask!.id, 'cancel')} onRetry={() => void updateAnalysisTask(msg.id, msg.backgroundTask!.id, 'retry')} />
                  )}
                  {msg.role === 'assistant' && msg.attachments && msg.attachments.length > 0 && (
                    <AgentAttachmentResults attachments={msg.attachments} onPreview={setAgentPreviewAttachment} />
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div className="chat-attachments">
            {attachments.map((a) => (
              <div key={a.id} className="chat-attachment-chip">
                {a.type === 'image' && a.preview
                  ? <img src={a.preview} className="chat-attachment-thumb" alt={a.name} onClick={() => setLightboxSrc(a.preview ?? null)} style={{ cursor: 'zoom-in' }} />
                  : <FileTextIcon size={13} />}
                <span>{a.name}</span>
                <button type="button" className="chat-attachment-remove" onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}><X size={11} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="alice-input-wrap">
          {/* Settings popup */}
          {showSettings && (
            <div className="alice-settings-popup">
              <div className="alice-settings-section">
                <div className="alice-settings-title">内容范围</div>
                <label className="alice-scope-row"><BookOpen size={14} /><span>个人知识库</span><div className={`alice-toggle ${useKnowledge ? 'on' : ''}`} onClick={() => setUseKnowledge((v) => !v)} role="switch" aria-checked={useKnowledge} /></label>
                <label className="alice-scope-row"><Globe size={14} /><span>全网搜索</span><div className={`alice-toggle ${useWebSearch ? 'on' : ''}`} onClick={() => setUseWebSearch((v) => !v)} role="switch" aria-checked={useWebSearch} /></label>
              </div>
              {canConfigureModel && (
                <div className="alice-settings-section">
                  <div className="alice-settings-title">回答路线</div>
                  {modelOptions.map((option) => (
                    <button key={option.value} type="button" className={`alice-model-row ${selectedModelChoice === option.value ? 'active' : ''}`} onClick={() => void chooseModel(option.value)}>
                      <AiBrandIcon brand={option.brand} size={18} />
                      <span><strong>{option.label}</strong><small>{option.meta}</small></span>
                      {selectedModelChoice === option.value && <CheckCircle2 size={16} aria-hidden="true" />}
                    </button>
                  ))}
                  {isLoadingOpenRouterModels && <p className="loading-state">正在读取 OpenRouter 免费模型…</p>}
                  {openRouterModels.map((model) => (
                    <button key={model.id} type="button" className={`alice-model-row ${selectedModelChoice === `openrouter:${model.id}` ? 'active' : ''}`} onClick={() => void chooseModel(`openrouter:${model.id}` as ChatModelChoice)}>
                      <AiBrandIcon brand="openrouter" size={18} />
                      <span><strong>{model.id}</strong><small>{[model.vision && '可识图', model.context > 0 && `${Math.round(model.context / 1000)}K`].filter(Boolean).join(' · ') || 'free'}</small></span>
                      {selectedModelChoice === `openrouter:${model.id}` && <CheckCircle2 size={16} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <input ref={fileInputRef} type="file" multiple accept="image/*,.txt,.md,.json,.csv,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.mp4,.mov" style={{ display: 'none' }} onChange={(e) => void handleFiles(e.target.files)} />
          <div className="alice-input-card">
            <textarea
              ref={inputRef}
              className="alice-textarea"
              value={input}
              rows={1}
              placeholder="向爱丽丝提问…"
              onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px` }}
              onPaste={handleInputPaste}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
            />
            <div className="alice-input-toolbar">
              <button type="button" className="alice-tool-btn" onClick={() => fileInputRef.current?.click()} title="添加附件" aria-label="添加附件"><Plus size={17} /></button>
              <button type="button" className={`alice-tool-btn alice-settings-btn ${showSettings ? 'active' : ''}`} onClick={openSettings} title="设置（模型、范围）" aria-label="设置"><Settings size={15} /></button>
              <div style={{ flex: 1 }} />
              <button type="button" className={`alice-tool-btn alice-model-label-btn ${usesLocalCli ? 'active' : ''}`} title={activeRuntimeLabel} aria-label={activeRuntimeLabel}>
                <AiBrandIcon brand={activeRuntimeBrand} size={16} />
              </button>
              <button
                type="button"
                className="alice-send-btn"
                onClick={() => loading ? void stopLocalCliExecution() : void send()}
                disabled={loading ? !activeLocalCommandId || isCancellingLocalCommand : (!input.trim() && attachments.length === 0)}
                aria-label={loading ? '停止' : '发送'}
              >
                {loading ? <X size={17} /> : <ArrowUp size={17} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {lightboxSrc && <ImageLightbox src={lightboxSrc} alt="附件预览" onClose={() => setLightboxSrc(null)} />}
      {agentPreviewAttachment && <AgentResultPreviewModal attachment={agentPreviewAttachment} onClose={() => setAgentPreviewAttachment(null)} />}
    </div>
  )
}
