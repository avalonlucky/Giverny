import { type ClipboardEvent as ReactClipboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, BookOpen, CheckCircle2, ChevronDown, ChevronRight, Eye, FileText as FileTextIcon, Folder, Globe, History, Plus, RotateCcw, Search, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react'
import { api, type AiModelConfig, type AiProviderConfig, type OpenRouterFreeModel } from '../lib/api'
import { aiBrandForValue, type AiBrandKey } from '../lib/aiBrands'
import { aiProviderDisplayLabel, chatModelChoiceLabel } from '../lib/chatModelPresentation'
import { createOptionalPreviewFile } from '../lib/attachmentPreview'
import {
  loadChatHistory,
  loadChatProjects,
  mergeConversationHistory,
  normalizeChatModelChoice,
  readChatModelChoice,
  saveChatHistory,
  saveChatProjects,
  upsertChatHistory,
  writeChatModelChoice,
  type ChatMessage,
  type ChatModelChoice,
  type ConversationProject,
  type ConversationRecord,
} from '../lib/conversationCache'
import { fileTypeForFile } from '../lib/fileTypes'
import { validateUploadFile } from '../lib/fileUpload'
import { formatFileSize } from '../lib/format'
import { localCliBrowserDeviceKey, localCliRuntimeReady } from '../lib/localCli'
import { providerSupportsVision } from '../lib/aiProviders'
import { agentAnalysisStatusLabel } from '../lib/agentAnalysisPresentation'
import type { FileAsset } from '../types/domain'
import type { AgentApproval, AgentBackgroundTask, AgentConversationMessage, AgentConversationSummary, AgentResultAttachment, AgentTaskMemory, AgentTaskPlan, AgentTaskSelection } from '../types/agent'
import type { ToastTone } from '../lib/toastQueue'
import { AgentAnalysisTaskCard } from './AgentAnalysisTaskCard'
import { AgentApprovalCard } from './AgentApprovalCard'
import { AgentAttachmentResults, AgentResultPreviewModal } from './AgentAttachmentResults'
import { AgentExecutionTimeline } from './AgentExecutionTimeline'
import { AgentTaskSelectionCard } from './AgentTaskSelectionCard'
import { AiBrandIcon } from './AiBrandIcon'
import { ChatContent } from './ChatContent'
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
}


export function ChatPanel({
  currentMonthValue,
  aiModelConfig,
  aiProviderConfigs,
  initialAnalysisJobId,
  onClose,
  onOpenTask,
  onNotify,
}: ChatPanelProps) {
  const initialConversation = initialAnalysisJobId
    ? loadChatHistory().find((record) => record.messages.some((message) => message.backgroundTask?.id === initialAnalysisJobId))
    : undefined
  const [messages, setMessages] = useState<ChatMessage[]>(initialConversation?.messages ?? [{ id: ALICE_WELCOME_ID, role: 'assistant', content: '' }])
  const [conversationRecordId, setConversationRecordId] = useState<string>(() => initialConversation?.id ?? crypto.randomUUID())
  const [agentConversationId, setAgentConversationId] = useState<string | undefined>(initialConversation?.agentConversationId)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [temporaryChat, setTemporaryChat] = useState(false)
  const [projects, setProjects] = useState<ConversationProject[]>(() => loadChatProjects())
  const [activeProjectId, setActiveProjectId] = useState<string>(initialConversation?.projectId ?? '')
  const [projectDraft, setProjectDraft] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [useKnowledge, setUseKnowledge] = useState(true)
  const [useWebSearch, setUseWebSearch] = useState(false)
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showTaskCenter, setShowTaskCenter] = useState(false)
  const [showProjectPopup, setShowProjectPopup] = useState(false)
  const [showScopePopup, setShowScopePopup] = useState(false)
  const [showModelPopup, setShowModelPopup] = useState(false)
  const [selectedModelChoice, setSelectedModelChoice] = useState<ChatModelChoice>(() => readChatModelChoice())
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterFreeModel[]>([])
  const [isLoadingOpenRouterModels, setIsLoadingOpenRouterModels] = useState(false)
  const [historyList, setHistoryList] = useState<ConversationRecord[]>(() => loadChatHistory())
  const [analysisJobs, setAnalysisJobs] = useState<AgentBackgroundTask[]>([])
  const [agentPlans, setAgentPlans] = useState<AgentTaskPlan[]>([])
  const [taskMemories, setTaskMemories] = useState<AgentTaskMemory[]>([])
  const [taskCenterTab, setTaskCenterTab] = useState<'plans' | 'memories'>('plans')
  const [expandedPlanId, setExpandedPlanId] = useState('')
  const [expandedMemoryId, setExpandedMemoryId] = useState(0)
  const [memoryNoteDrafts, setMemoryNoteDrafts] = useState<Record<number, string>>({})
  const [memoryForgetConfirmId, setMemoryForgetConfirmId] = useState(0)
  const [taskCenterBusy, setTaskCenterBusy] = useState('')
  const [activeLocalCommandId, setActiveLocalCommandId] = useState('')
  const [isCancellingLocalCommand, setIsCancellingLocalCommand] = useState(false)
  const [activeLocalCliRoute, setActiveLocalCliRoute] = useState<ActiveLocalCliRoute | null>(null)

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [agentPreviewAttachment, setAgentPreviewAttachment] = useState<AgentResultAttachment | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isWelcome = messages.length === 1 && messages[0].id === ALICE_WELCOME_ID
  const activeProject = activeProjectId ? projects.find((project) => project.id === activeProjectId) ?? null : null

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
          setActiveLocalCliRoute(device && cli
            ? { adapterId: cli.id, name: cli.name, version: cli.version, deviceName: device.name }
            : null)
        }
      } catch {
        if (!cancelled) setActiveLocalCliRoute(null)
      }
    }
    void refreshLocalRoute()
    const timer = window.setInterval(() => void refreshLocalRoute(), 8_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])
  useEffect(() => {
    if (!temporaryChat && !isWelcome) upsertChatHistory(conversationRecordId, messages, agentConversationId, activeProject)
  }, [activeProject, agentConversationId, conversationRecordId, isWelcome, messages, temporaryChat])

  const refreshCloudHistory = useCallback(async () => {
    const response = await fetch('/api/ai/conversations')
    const data = await response.json().catch(() => null) as { conversations?: AgentConversationSummary[] } | null
    if (!response.ok || !Array.isArray(data?.conversations)) return
    const cloudRecords = data.conversations.map((item) => ({
      id: item.id,
      title: item.title,
      messages: [],
      savedAt: new Date(item.updatedAt).getTime(),
      agentConversationId: item.id,
      projectId: item.projectId,
      projectName: item.projectName,
      cloud: true,
    }))
    const localProjects = loadChatProjects()
    const cloudProjects = cloudRecords
      .filter((record) => record.projectId && record.projectName)
      .map((record) => ({ id: record.projectId!, name: record.projectName!, savedAt: record.savedAt }))
    const projectMap = new Map<string, ConversationProject>()
    ;[...localProjects, ...cloudProjects].forEach((project) => {
      const current = projectMap.get(project.id)
      if (!current || project.savedAt > current.savedAt) projectMap.set(project.id, project)
    })
    const nextProjects = Array.from(projectMap.values()).sort((a, b) => b.savedAt - a.savedAt).slice(0, 50)
    saveChatProjects(nextProjects)
    setProjects(nextProjects)
    setHistoryList(mergeConversationHistory(loadChatHistory(), cloudRecords))
  }, [])

  const refreshAnalysisJobs = useCallback(async () => {
    const [jobsResponse, plansResponse, memoriesResponse] = await Promise.all([
      fetch('/api/ai/analysis-jobs?limit=50'),
      fetch('/api/ai/agent-plans?limit=50'),
      fetch('/api/ai/task-memories?limit=50'),
    ])
    const data = await jobsResponse.json().catch(() => null) as { jobs?: AgentBackgroundTask[] } | null
    const planData = await plansResponse.json().catch(() => null) as { plans?: AgentTaskPlan[] } | null
    const memoryData = await memoriesResponse.json().catch(() => null) as { memories?: AgentTaskMemory[] } | null
    if (jobsResponse.ok && Array.isArray(data?.jobs)) setAnalysisJobs(data.jobs)
    if (plansResponse.ok && Array.isArray(planData?.plans)) setAgentPlans(planData.plans)
    if (memoriesResponse.ok && Array.isArray(memoryData?.memories)) setTaskMemories(memoryData.memories)
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
            id: record.id,
            agentConversationId: record.agentConversationId,
            title: record.title,
            savedAt: record.savedAt,
            projectId: record.projectId,
            projectName: record.projectName,
            messages: record.messages.map((message, index) => ({ ...message, createdAt: record.savedAt + index })),
          })) }),
        }).catch(() => undefined)
      }
      if (!cancelled) await Promise.all([refreshCloudHistory(), refreshAnalysisJobs()])
    }
    void migrateAndLoad()
    return () => { cancelled = true }
  }, [refreshAnalysisJobs, refreshCloudHistory])

  useEffect(() => {
    if (!initialAnalysisJobId) return
    const local = loadChatHistory().find((record) => record.messages.some((message) => message.backgroundTask?.id === initialAnalysisJobId))
    if (local) return
    void fetch(`/api/ai/analysis-jobs/${encodeURIComponent(initialAnalysisJobId)}`)
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }: { ok: boolean; data: { job?: AgentBackgroundTask } }) => {
        if (!ok || !data.job) return
        setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: '', backgroundTask: data.job }])
        void fetch(`/api/ai/analysis-jobs/${encodeURIComponent(data.job.id)}/read`, { method: 'POST' })
        setAnalysisJobs((current) => current.map((job) => job.id === data.job!.id ? { ...job, unread: false } : job))
      })
      .catch(() => undefined)
  }, [initialAnalysisJobId])

  const activeAnalysisKey = messages
    .map((message) => message.backgroundTask)
    .filter((task): task is AgentBackgroundTask => Boolean(task && (task.status === 'queued' || task.status === 'running')))
    .map((task) => task.id)
    .sort()
    .join(',')

  useEffect(() => {
    const ids = activeAnalysisKey ? activeAnalysisKey.split(',').filter(Boolean) : []
    if (ids.length === 0) return
    let cancelled = false
    const refresh = async () => {
      const tasks = await Promise.all(ids.map(async (id) => {
        const response = await fetch(`/api/ai/analysis-jobs/${encodeURIComponent(id)}`)
        const data = await response.json().catch(() => null) as { job?: AgentBackgroundTask } | null
        return response.ok ? data?.job : undefined
      }))
      if (cancelled) return
      const byId = new Map(tasks.filter((task): task is AgentBackgroundTask => Boolean(task)).map((task) => [task.id, task]))
      if (byId.size > 0) {
        setMessages((current) => current.map((message) => (
          message.backgroundTask && byId.has(message.backgroundTask.id)
            ? { ...message, backgroundTask: byId.get(message.backgroundTask.id) }
            : message
        )))
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 2500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeAnalysisKey])

  useEffect(() => {
    if (!showScopePopup) return
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.alice-scope-popup') && !(e.target as HTMLElement).closest('.alice-scope-btn')) {
        setShowScopePopup(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showScopePopup])

  useEffect(() => {
    if (!showModelPopup) return
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.alice-model-popup') && !(e.target as HTMLElement).closest('.alice-model-btn')) {
        setShowModelPopup(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showModelPopup])

  useEffect(() => {
    writeChatModelChoice(selectedModelChoice)
  }, [selectedModelChoice])

  useEffect(() => {
    let cancelled = false
    void api.getActiveAiModelChoice()
      .then(({ choice }) => {
        if (!cancelled) setSelectedModelChoice(normalizeChatModelChoice(choice))
      })
      .catch(() => {
        // 离线时保留当前浏览器上一次选择，发送请求仍由服务端安全回退。
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!showHistory) return
    const q = historySearch.trim()
    if (!q) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q })
      if (activeProjectId) params.set('projectId', activeProjectId)
      void fetch(`/api/ai/conversations/search?${params.toString()}`)
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }: { ok: boolean; data: { conversations?: AgentConversationSummary[] } }) => {
          if (!ok || cancelled || !Array.isArray(data.conversations)) return
          const cloudRecords = data.conversations.map((item) => ({
            id: item.id,
            title: item.title,
            messages: [] as ChatMessage[],
            savedAt: new Date(item.updatedAt).getTime(),
            agentConversationId: item.id,
            projectId: item.projectId,
            projectName: item.projectName,
            cloud: true,
          }))
          setHistoryList((current) => mergeConversationHistory(loadChatHistory(), [...current.filter((record) => record.cloud), ...cloudRecords]))
        })
        .catch(() => undefined)
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [activeProjectId, historySearch, showHistory])

  const newConversation = () => {
    if (!temporaryChat && !isWelcome) upsertChatHistory(conversationRecordId, messages, agentConversationId, activeProject)
    setHistoryList(mergeConversationHistory(loadChatHistory(), historyList.filter((record) => record.cloud)))
    setMessages([{ id: ALICE_WELCOME_ID, role: 'assistant', content: '' }])
    setConversationRecordId(crypto.randomUUID())
    setAgentConversationId(undefined)
    setTemporaryChat(false)
    setInput('')
    setAttachments([])
    setShowModelPopup(false)
    setShowHistory(false)
    setShowTaskCenter(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const openHistory = () => {
    void refreshCloudHistory()
    setHistoryList((current) => mergeConversationHistory(loadChatHistory(), current.filter((record) => record.cloud)))
    setShowTaskCenter(false)
    setShowProjectPopup(false)
    setShowHistory(true)
  }

  const loadConversation = async (record: ConversationRecord) => {
    let nextMessages = record.messages
    if (record.cloud || nextMessages.length === 0) {
      const response = await fetch(`/api/ai/conversations/${encodeURIComponent(record.agentConversationId || record.id)}`)
      const data = await response.json().catch(() => null) as { messages?: AgentConversationMessage[] } | null
      if (!response.ok || !Array.isArray(data?.messages)) {
        if (record.messages.length === 0) {
          onNotify('云端会话读取失败，请稍后重试', 'error')
          return
        }
        nextMessages = record.messages
      } else {
        const cloudMessages = data.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          trace: message.trace,
          traceStatus: message.trace?.length ? 'completed' as const : undefined,
          approval: message.approval,
          selection: message.selection,
          backgroundTask: message.backgroundTask,
          attachments: message.attachments,
        }))
        nextMessages = cloudMessages.length > 0 ? cloudMessages : record.messages
      }
    }
    setMessages(nextMessages)
    setConversationRecordId(record.id)
    setAgentConversationId(record.agentConversationId || record.id)
    setActiveProjectId(record.projectId ?? '')
    setTemporaryChat(false)
    setShowHistory(false)
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

  const createConversationProject = () => {
    const name = projectDraft.trim()
    if (!name) return
    const project = { id: crypto.randomUUID(), name: name.slice(0, 24), savedAt: Date.now() }
    const nextProjects = [project, ...projects.filter((item) => item.name !== project.name)].slice(0, 50)
    saveChatProjects(nextProjects)
    setProjects(nextProjects)
    setActiveProjectId(project.id)
    setProjectDraft('')
    if (temporaryChat) setTemporaryChat(false)
    setShowProjectPopup(false)
    onNotify(`已新建对话项目：${project.name}`, 'success')
  }

  const selectConversationProject = (projectId: string) => {
    if (!temporaryChat && !isWelcome) upsertChatHistory(conversationRecordId, messages, agentConversationId, activeProject)
    setActiveProjectId(projectId)
    setTemporaryChat(false)
    setShowProjectPopup(false)
    setShowHistory(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const clearConversationProject = () => {
    if (!temporaryChat && !isWelcome) upsertChatHistory(conversationRecordId, messages, agentConversationId, activeProject)
    setActiveProjectId('')
    setTemporaryChat(false)
    setShowProjectPopup(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const startTemporaryChat = () => {
    if (!temporaryChat && !isWelcome) upsertChatHistory(conversationRecordId, messages, agentConversationId, activeProject)
    setTemporaryChat(true)
    setActiveProjectId('')
    setMessages([{ id: ALICE_WELCOME_ID, role: 'assistant', content: '' }])
    setConversationRecordId(crypto.randomUUID())
    setAgentConversationId(undefined)
    setInput('')
    setAttachments([])
    setShowProjectPopup(false)
    setShowHistory(false)
    setShowTaskCenter(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const openTaskCenter = () => {
    void refreshAnalysisJobs()
    setShowHistory(false)
    setShowTaskCenter(true)
  }

  const openAnalysisJob = async (job: AgentBackgroundTask) => {
    setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: '', backgroundTask: { ...job, unread: false } }])
    setConversationRecordId(crypto.randomUUID())
    setAgentConversationId(undefined)
    setShowTaskCenter(false)
    setAnalysisJobs((current) => current.map((item) => item.id === job.id ? { ...item, unread: false } : item))
    await fetch(`/api/ai/analysis-jobs/${encodeURIComponent(job.id)}/read`, { method: 'POST' }).catch(() => undefined)
  }

  const openAgentPlan = async (plan: AgentTaskPlan) => {
    setAgentPlans((current) => current.map((item) => item.id === plan.id ? { ...item, unread: false } : item))
    await fetch(`/api/ai/agent-plans/${encodeURIComponent(plan.id)}/read`, { method: 'POST' }).catch(() => undefined)
    setExpandedPlanId((current) => current === plan.id ? '' : plan.id)
  }

  const authHeaders = (): Record<string, string> => {
    return { 'content-type': 'application/json' }
  }

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files) return
    const added: ChatAttachment[] = []
    for (const file of Array.from(files).slice(0, 4)) {
      const isImage = file.type.startsWith('image/')
      const isText = file.type.startsWith('text/') || /\.(txt|md|json|csv)$/i.test(file.name)
      const data = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        if (isImage) {
          reader.onload = () => { resolve((reader.result as string).split(',')[1] ?? '') }
          reader.readAsDataURL(file)
        } else if (isText) {
          reader.onload = () => resolve(reader.result as string)
          reader.readAsText(file)
        } else resolve('')
      })
      added.push({
        id: crypto.randomUUID(),
        type: isImage ? 'image' : isText ? 'text' : 'file',
        name: file.name,
        data,
        mimeType: file.type || 'text/plain',
        preview: isImage ? `data:${file.type || 'image/jpeg'};base64,${data}` : undefined,
        file,
      })
    }
    setAttachments((prev) => [...prev, ...added].slice(0, 4))
  }

  const handleInputPaste = (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
    const pastedImages = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
    if (pastedImages.length === 0) return
    event.preventDefault()
    void handleFiles(pastedImages)
  }

  const openModelPicker = () => {
    setShowModelPopup((value) => !value)
    if (openRouterModels.length > 0 || isLoadingOpenRouterModels) return
    setIsLoadingOpenRouterModels(true)
    api.getOpenRouterFreeModels()
      .then((result) => {
        setOpenRouterModels((result.models ?? []).filter((model) => model.status === 'ok').slice(0, 12))
      })
      .catch(() => setOpenRouterModels([]))
      .finally(() => setIsLoadingOpenRouterModels(false))
  }

  const reviseApproval = async (messageId: string, approvalId: string, draft: Record<string, unknown>) => {
    if (!agentConversationId) throw new Error('当前会话已失效，请重新生成任务草稿。')
    const res = await fetch('/api/ai/approval', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        agentRuntimeConversationId: agentConversationId,
        approvalId,
        draft,
      }),
    })
    const data = (await res.json().catch(() => null)) as { approval?: AgentApproval; error?: string } | null
    if (!res.ok || !data?.approval) throw new Error(data?.error ?? '草稿更新失败')
    setMessages((current) => current.map((message) => (
      message.id === messageId ? { ...message, approval: data.approval } : message
    )))
  }

  const updateAnalysisTask = async (messageId: string, taskId: string, action: 'cancel' | 'retry') => {
    const response = await fetch(`/api/ai/analysis-jobs/${encodeURIComponent(taskId)}/${action}`, {
      method: 'POST',
      headers: authHeaders(),
    })
    const data = await response.json().catch(() => null) as { job?: AgentBackgroundTask; error?: string } | null
    if (!response.ok || !data?.job) {
      onNotify(data?.error || (action === 'cancel' ? '取消分析失败' : '重新分析失败'), 'error')
      return
    }
    setMessages((current) => current.map((message) => (
      message.id === messageId ? { ...message, backgroundTask: data.job } : message
    )))
    onNotify(action === 'cancel' ? '后台分析已取消' : '已重新启动后台分析', action === 'cancel' ? 'info' : 'success')
  }

  const send = async (overrideText?: string, approvalDecision?: { messageId: string; approvalId: string }) => {
    let text = (overrideText !== undefined ? overrideText : input).trim()
    if ((!text && attachments.length === 0) || loading) return
    const sentAttachments = [...attachments]
    const targetTaskId = Number(text.match(/(?:任务\s*)?#(\d+)/)?.[1] || 0)
    if (sentAttachments.some((item) => item.file) && !targetTaskId && sentAttachments.some((item) => item.type === 'file')) {
      onNotify('上传 PDF、Office 等文件时，请在问题中写明任务 #ID，文件才有明确归属。', 'info')
      return
    }
    if (targetTaskId && sentAttachments.length > 0 && overrideText === undefined) {
      setLoading(true)
      try {
        const uploaded: FileAsset[] = []
        for (const item of sentAttachments) {
          validateUploadFile(item.file)
          const preview = await createOptionalPreviewFile(item.file)
          uploaded.push(await api.uploadFile({
            taskId: targetTaskId,
            scope: 'progress',
            file: item.file,
            preview,
            type: fileTypeForFile(item.file).type,
            size: formatFileSize(item.file.size),
            final: false,
            visible: true,
            tag: 'Agent 对话附件',
            analyze: true,
          }))
        }
        text = `${text}\n\n[已上传到任务 #${targetTaskId} 的真实附件：${uploaded.map((file) => `${file.name}（attachmentId=${file.id}）`).join('、')}]`
      } catch (error) {
        onNotify(error instanceof Error ? `附件上传失败：${error.message}` : '附件上传失败', 'error')
        setLoading(false)
        return
      }
    }
    const displayText = text || `[附件：${attachments.map((a) => a.name).join('、')}]`
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: displayText }
    const assistantId = crypto.randomUUID()
    const baseMessages = (isWelcome ? [] : messages).map((message) => (
      approvalDecision && message.id === approvalDecision.messageId && message.approval?.id === approvalDecision.approvalId
        ? { ...message, approval: { ...message.approval, status: 'processing' as const } }
        : message
    ))
    if (overrideText === undefined) setInput('')
    setAttachments([])

    setMessages([...baseMessages, userMsg, {
      id: assistantId,
      role: 'assistant',
      content: '',
      trace: ['开始分析：识别问题目标与需要核对的依据。'],
      traceStatus: 'running',
    }])
    setLoading(true)
    try {
      const allMessages = [...baseMessages, userMsg].map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          messages: allMessages,
          month: currentMonthValue,
          useKnowledge,
          useWebSearch,
          modelChoice: selectedModelChoice,
          attachments: sentAttachments.filter((item) => item.type !== 'file').map(({ type, name, data, mimeType }) => ({ type, name, data, mimeType })),
          agentRuntimeConversationId: agentConversationId,
          localCliConversationId: conversationRecordId,
          temporary: temporaryChat,
          projectId: activeProject?.id,
          projectName: activeProject?.name,
          browserDeviceKey: localCliBrowserDeviceKey(),
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(err?.error ?? `请求失败：${res.status}`)
      }
      type AgentChatResult = {
        content?: string
        trace?: string[]
        agentRuntimeConversationId?: string
        approval?: AgentApproval
        selection?: AgentTaskSelection
        backgroundTask?: AgentBackgroundTask
        attachments?: AgentResultAttachment[]
      }
      const applyAgentResult = (data: AgentChatResult) => {
        if (data.agentRuntimeConversationId) setAgentConversationId(data.agentRuntimeConversationId)
        setMessages((prev) => prev.map((m) => {
          if (m.id === assistantId) {
            return {
              ...m,
              content: data.content ?? '（无回复）',
              trace: data.trace?.length ? data.trace : m.trace,
              traceStatus: 'completed',
              ...(data.approval?.status === 'pending' ? { approval: data.approval } : {}),
              ...(data.selection ? { selection: data.selection } : {}),
              ...(data.backgroundTask ? { backgroundTask: data.backgroundTask } : {}),
              ...(data.attachments?.length ? { attachments: data.attachments } : {}),
            }
          }
          if (data.approval && m.approval?.id === data.approval.id) {
            return { ...m, approval: data.approval }
          }
          if (approvalDecision && m.id === approvalDecision.messageId && m.approval?.id === approvalDecision.approvalId) {
            return {
              ...m,
              approval: data.approval ?? {
                ...m.approval,
                status: 'failed',
                error: 'Agent 没有返回操作结果，请重新生成预览。',
              },
            }
          }
          return m
        }))
      }
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('text/event-stream')) {
        applyAgentResult((await res.json()) as AgentChatResult)
        return
      }
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let streamError = ''
      let receivedResult = false
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') break
          try {
            const event = JSON.parse(payload) as AgentChatResult & {
              type?: 'trace' | 'route' | 'result' | 'error' | 'done'
              status?: 'running' | 'completed'
              error?: string
              t?: string
              commandId?: string
              runtime?: string
              runtimeLabel?: string
            }
            if (event.type === 'trace' && event.trace?.length) {
              setMessages((prev) => prev.map((m) => (
                m.id === assistantId
                  ? { ...m, trace: event.trace, traceStatus: 'running' }
                  : m
              )))
            } else if (event.type === 'route' && event.runtime === 'local-cli' && event.commandId) {
              setActiveLocalCommandId(event.commandId)
            } else if (event.type === 'result') {
              receivedResult = true
              applyAgentResult(event)
            } else if (event.type === 'error') {
              streamError = event.error || 'Agent 请求失败'
            } else if (event.t) {
              setMessages((prev) => prev.map((m) => (
                m.id === assistantId ? { ...m, content: m.content + event.t } : m
              )))
            }
          } catch { /* skip */ }
        }
      }
      if (streamError) throw new Error(streamError)
      if (!receivedResult) {
        setMessages((prev) => prev.map((m) => (
          m.id === assistantId ? { ...m, traceStatus: 'completed' } : m
        )))
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '请求失败，请重试'
      setMessages((prev) => prev.map((m) => {
        if (m.id === assistantId) {
          return {
            ...m,
            content: `⚠️ ${msg}`,
            trace: [...(m.trace ?? []), '执行失败：请检查服务状态后重试'],
            traceStatus: 'failed',
          }
        }
        if (approvalDecision && m.id === approvalDecision.messageId && m.approval?.id === approvalDecision.approvalId) {
          return { ...m, approval: { ...m.approval, status: 'failed', error: msg } }
        }
        return m
      }))
    } finally {
      setLoading(false)
      setActiveLocalCommandId('')
      setIsCancellingLocalCommand(false)
      void refreshAnalysisJobs()
    }
  }

  const stopLocalCliExecution = async () => {
    if (!activeLocalCommandId || isCancellingLocalCommand) return
    setIsCancellingLocalCommand(true)
    try {
      await api.cancelLocalCliCommand(activeLocalCommandId)
      onNotify('正在停止本机 CLI…', 'info')
    } catch (error) {
      setIsCancellingLocalCommand(false)
      onNotify(error instanceof Error ? error.message : '停止本机 CLI 失败', 'error')
    }
  }

  const updatePlan = async (plan: AgentTaskPlan, action: 'pause' | 'resume' | 'cancel' | 'complete_step' | 'reopen_step', stepId?: string) => {
    const busyKey = `${plan.id}:${action}:${stepId || ''}`
    setTaskCenterBusy(busyKey)
    try {
      const result = await api.updateAgentPlan(plan.id, action, stepId)
      setAgentPlans((current) => action === 'cancel'
        ? current.filter((item) => item.id !== plan.id)
        : current.map((item) => item.id === plan.id ? result.plan : item))
      onNotify(action === 'pause' ? '计划已暂停' : action === 'resume' ? '计划已继续' : action === 'cancel' ? '计划已取消' : '计划步骤已更新', 'success')
    } catch (error) {
      onNotify(error instanceof Error ? error.message : '计划更新失败', 'error')
    } finally {
      setTaskCenterBusy('')
    }
  }

  const updateMemory = async (memory: AgentTaskMemory, payload: Parameters<typeof api.updateTaskMemory>[1]) => {
    setTaskCenterBusy(`memory:${memory.taskId}:${payload.action}`)
    try {
      const result = await api.updateTaskMemory(memory.taskId, payload)
      setTaskMemories((current) => current.map((item) => item.taskId === memory.taskId ? result.memory : item))
      if (payload.action === 'add_note') setMemoryNoteDrafts((current) => ({ ...current, [memory.taskId]: '' }))
      onNotify(payload.action === 'set_enabled' && payload.enabled === false ? '已清除并停止该任务记忆' : '任务记忆已更新', 'success')
    } catch (error) {
      onNotify(error instanceof Error ? error.message : '任务记忆更新失败', 'error')
    } finally {
      setTaskCenterBusy('')
    }
  }

  const reminderPrompt = (plan: AgentTaskPlan) => {
    const prefix = plan.taskId ? `任务 #${plan.taskId}` : '这个任务'
    if (plan.goal.includes('验收') || plan.goal.includes('100%')) return `请检查${prefix}当前资料，并生成完整验收草稿；执行前让我确认。`
    if (plan.goal.includes('等待')) return `请检查${prefix}的等待记录和后续进展，判断阻塞是否解除，并给出下一步可确认操作。`
    if (plan.goal.includes('工时')) return `请分析${prefix}实际工时超出预估的原因，并给出可执行的范围调整建议。`
    if (plan.goal.includes('逾期')) return `请检查${prefix}的逾期原因和最新进展，并生成更新进展或调整交付日期的确认草稿。`
    return `请继续处理${prefix}的提醒：${plan.goal}。先核对数据，再生成需要我确认的下一步。`
  }

  const executeReminder = (plan: AgentTaskPlan) => {
    setShowTaskCenter(false)
    void send(reminderPrompt(plan))
  }

  const scopeActive = useKnowledge || useWebSearch
  const activeProviderConfigs = useMemo(
    () => aiProviderConfigs.filter((config) => config.enabled && config.hasApiKey && config.models.includes(config.defaultModel)),
    [aiProviderConfigs],
  )
  const providerModelOptions = activeProviderConfigs.map((config) => {
    const providerLabel = aiProviderDisplayLabel(config.provider)
    return {
      value: `provider:${config.provider}` as ChatModelChoice,
      label: config.defaultModel,
      meta: `${providerLabel} · 手动最高优先级${providerSupportsVision(config.provider) ? ' · 支持识图时图片也优先使用' : ''}`,
      brand: aiBrandForValue(`${config.provider} ${config.defaultModel}`),
    }
  })
  const modelOptions: Array<{ value: ChatModelChoice; label: string; meta: string; brand: AiBrandKey }> = [
    { value: 'auto', label: activeLocalCliRoute ? `自动 · ${activeLocalCliRoute.name}` : '自动路由', meta: activeLocalCliRoute ? '普通问答优先本机 CLI；深度分析、写入和识图自动使用站内 Agent' : '本机 CLI 不可用时由站内 Agent 自动选择模型', brand: activeLocalCliRoute ? aiBrandForValue(activeLocalCliRoute.adapterId) : 'auto' },
    ...providerModelOptions,
  ]
  const usesLocalCli = selectedModelChoice === 'auto' && Boolean(activeLocalCliRoute)
  const activeRuntimeLabel = usesLocalCli ? activeLocalCliRoute!.name : chatModelChoiceLabel(selectedModelChoice, aiModelConfig, aiProviderConfigs)
  const activeRuntimeBrand = usesLocalCli ? aiBrandForValue(activeLocalCliRoute!.adapterId) : aiBrandForValue(`${selectedModelChoice} ${activeRuntimeLabel}`)
  const isModelOptionSelected = (option: (typeof modelOptions)[number]) => {
    if (selectedModelChoice === option.value) return true
    return false
  }
  const taskCenterUnreadCount = analysisJobs.filter((job) => job.unread).length + agentPlans.filter((plan) => plan.unread).length
  const filteredHistoryList = useMemo(() => {
    const keyword = historySearch.trim().toLowerCase()
    return historyList.filter((record) => {
      if (activeProjectId && record.projectId !== activeProjectId) return false
      if (!keyword) return true
      const haystack = [
        record.title,
        record.projectName,
        ...record.messages.map((message) => message.content),
      ].filter(Boolean).join('\n').toLowerCase()
      return haystack.includes(keyword)
    })
  }, [activeProjectId, historyList, historySearch])
  const chooseModel = async (choice: ChatModelChoice) => {
    const previous = selectedModelChoice
    setSelectedModelChoice(choice)
    setShowModelPopup(false)
    try {
      const saved = await api.setActiveAiModelChoice(choice)
      setSelectedModelChoice(normalizeChatModelChoice(saved.choice))
      onNotify(choice === 'auto' ? '已恢复自动模型路由' : `已将 ${chatModelChoiceLabel(choice, aiModelConfig, aiProviderConfigs)} 设为全站 AI 首选`, 'success')
    } catch (error) {
      setSelectedModelChoice(previous)
      onNotify(error instanceof Error ? error.message : '模型优先级保存失败', 'error')
    }
  }

  return (
    <div className="chat-panel" role="dialog" aria-label="爱丽丝">
      {/* header */}
      <div className="chat-panel-header">
        <div className="chat-panel-identity">
          <span className="chat-panel-brand-mark" aria-hidden="true">
            <Sparkles size={16} />
          </span>
          <div className="chat-panel-title">
            <div>
              <span>爱丽丝</span>
              <small>Giverny Agent</small>
            </div>
            <p className="chat-panel-runtime">
              <span aria-hidden="true" />
              {temporaryChat ? '临时对话' : activeProject?.name || activeRuntimeLabel}
              <em>{temporaryChat ? '不保存' : activeProject ? '项目' : usesLocalCli ? '本机' : selectedModelChoice === 'auto' ? '自动路由' : '全站首选'}</em>
            </p>
          </div>
        </div>
        <div className="chat-panel-header-actions">
          <button
            type="button"
            className={`chat-panel-project-btn ${activeProject || showProjectPopup ? 'active' : ''}`}
            onClick={() => {
              setShowProjectPopup((value) => !value)
              setShowHistory(false)
              setShowTaskCenter(false)
              setShowScopePopup(false)
              setShowModelPopup(false)
            }}
            title="新建或切换对话项目"
            aria-label="新建或切换对话项目"
          >
            <Folder size={14} />
            <span>{activeProject?.name || '项目'}</span>
          </button>
          <button type="button" className={`chat-panel-text-btn ${temporaryChat ? 'active' : ''}`} onClick={startTemporaryChat} title="临时对话不进入历史记录">
            临时
          </button>
          <button type="button" className="chat-panel-icon-btn" onClick={newConversation} title="新建对话" aria-label="新建对话">
            <Plus size={15} />
          </button>
          <button
            type="button"
            className={`chat-panel-icon-btn ${taskCenterUnreadCount > 0 ? 'has-unread' : ''}`}
            onClick={openHistory}
            title="对话记录与后台任务"
            aria-label="记录与任务"
          >
            <History size={15} />
            {taskCenterUnreadCount > 0 && <span className="chat-task-unread">{Math.min(9, taskCenterUnreadCount)}</span>}
          </button>
          <button type="button" className="chat-panel-icon-btn" onClick={onClose} aria-label="关闭">
            <X size={15} />
          </button>
        </div>
      </div>

      {showProjectPopup && (
        <div className="chat-project-popup">
          <div className="chat-project-popup-header">
            <strong>对话项目</strong>
            <span>像文件夹一样收纳同一主题的问题</span>
          </div>
          <div className="chat-project-quick-actions">
            <button type="button" className={!activeProjectId && !temporaryChat ? 'active' : ''} onClick={clearConversationProject}>
              全部对话
            </button>
            <button type="button" className={temporaryChat ? 'active' : ''} onClick={startTemporaryChat}>
              临时对话
            </button>
          </div>
          <div className="chat-project-list">
            {projects.length === 0 ? (
              <p>还没有项目，可以先建一个「金额核对」。</p>
            ) : projects.map((project) => (
              <button key={project.id} type="button" className={activeProjectId === project.id ? 'active' : ''} onClick={() => selectConversationProject(project.id)}>
                <Folder size={13} aria-hidden="true" />
                <span>{project.name}</span>
              </button>
            ))}
          </div>
          <div className="chat-project-create">
            <input
              value={projectDraft}
              onChange={(event) => setProjectDraft(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && createConversationProject()}
              placeholder="新建项目，例如：金额核对"
              aria-label="新建对话项目名称"
            />
            <button type="button" onClick={createConversationProject}>新建项目</button>
          </div>
        </div>
      )}

      {/* messages / welcome screen */}
      <div className="chat-panel-messages">
        {isWelcome ? (
          <div className="alice-welcome">
            <div className="alice-welcome-kicker">Giverny Agent</div>
            <h2 className="alice-welcome-title">嗨，来和爱丽丝聊一聊</h2>
            <p className="alice-welcome-sub">查工作数据、分析收入，或者聊聊设计行业问题</p>
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
                {msg.role === 'assistant' && msg.trace?.length ? (
                  <AgentExecutionTimeline trace={msg.trace} status={msg.traceStatus ?? 'completed'} />
                ) : null}
                {msg.content ? <ChatContent content={msg.content} /> : (msg.role === 'assistant' && loading ? <span className="chat-cursor" /> : '…')}
                {msg.role === 'assistant' && msg.approval && (
                  <AgentApprovalCard
                    approval={msg.approval}
                    busy={loading}
                    onRevise={(draft) => reviseApproval(msg.id, msg.approval!.id, draft)}
                    onOpenTask={onOpenTask}
                    onDecision={(decision) => void send(decision === 'confirm' ? '确认执行' : '取消', {
                      messageId: msg.id,
                      approvalId: msg.approval!.id,
                    })}
                  />
                )}
                {msg.role === 'assistant' && msg.selection && (
                  <AgentTaskSelectionCard
                    selection={msg.selection}
                    busy={loading}
                    onSelect={(candidate) => void send(`选择任务 #${candidate.id}：${candidate.title}`)}
                  />
                )}
                {msg.role === 'assistant' && msg.backgroundTask && (
                  <AgentAnalysisTaskCard
                    task={msg.backgroundTask}
                    busy={loading}
                    onCancel={() => void updateAnalysisTask(msg.id, msg.backgroundTask!.id, 'cancel')}
                    onRetry={() => void updateAnalysisTask(msg.id, msg.backgroundTask!.id, 'retry')}
                  />
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

      {/* attachment preview chips */}
      {attachments.length > 0 && (
        <div className="chat-attachments">
          {attachments.map((a) => (
            <div key={a.id} className="chat-attachment-chip">
              {a.type === 'image' && a.preview
                ? <img src={a.preview} className="chat-attachment-thumb" alt={a.name} onClick={() => setLightboxSrc(a.preview ?? null)} style={{ cursor: 'zoom-in' }} />
                : <FileTextIcon size={13} />}
              <span>{a.name}</span>
              <button type="button" className="chat-attachment-remove" onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}>
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* input card */}
      <div className="alice-input-wrap">
        {showScopePopup && (
          <div className="alice-scope-popup">
            <div className="alice-scope-popup-title">内容范围</div>
            <label className="alice-scope-row">
              <BookOpen size={14} />
              <span>个人知识库</span>
              <div className={`alice-toggle ${useKnowledge ? 'on' : ''}`} onClick={() => setUseKnowledge((v) => !v)} role="switch" aria-checked={useKnowledge} />
            </label>
            <label className="alice-scope-row">
              <Globe size={14} />
              <span>全网搜索</span>
              <div className={`alice-toggle ${useWebSearch ? 'on' : ''}`} onClick={() => setUseWebSearch((v) => !v)} role="switch" aria-checked={useWebSearch} />
            </label>
          </div>
        )}
        {showModelPopup && (
          <div className="alice-model-popup">
            {usesLocalCli && activeLocalCliRoute && (
              <div className="alice-runtime-current">
                <AiBrandIcon brand={aiBrandForValue(activeLocalCliRoute.adapterId)} size={22} />
                <span>
                  <strong>{activeLocalCliRoute.name}</strong>
                  <small>当前回答路线 · {activeLocalCliRoute.deviceName}</small>
                </span>
                <em>本机</em>
              </div>
            )}
            <div className="alice-model-popup-section">
              <div className="alice-model-popup-title">回答路线</div>
              {modelOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`alice-model-row ${isModelOptionSelected(option) ? 'active' : ''}`}
                  onClick={() => {
                    void chooseModel(option.value)
                  }}
                >
                  <AiBrandIcon brand={option.brand} size={18} />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.meta}</small>
                  </span>
                  {isModelOptionSelected(option) && <CheckCircle2 className="alice-model-selected" size={16} aria-hidden="true" />}
                </button>
              ))}
            </div>
            <div className="alice-model-popup-section">
              <div className="alice-model-popup-title">更多免费模型</div>
              {isLoadingOpenRouterModels && <p className="alice-model-empty">正在读取 OpenRouter 免费模型…</p>}
              {!isLoadingOpenRouterModels && openRouterModels.length === 0 && (
                <p className="alice-model-empty">暂无可用缓存，可先在设置里扫描 OpenRouter 免费模型。</p>
              )}
              {openRouterModels.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  className={`alice-model-row ${selectedModelChoice === `openrouter:${model.id}` ? 'active' : ''}`}
                  onClick={() => {
                    void chooseModel(`openrouter:${model.id}` as ChatModelChoice)
                  }}
                >
                  <AiBrandIcon brand="openrouter" size={18} />
                  <span>
                    <strong>{model.id}</strong>
                    <small>{[model.vision && '可识图', model.context > 0 && `${Math.round(model.context / 1000)}K 上下文`].filter(Boolean).join(' · ') || 'OpenRouter free'}</small>
                  </span>
                  {selectedModelChoice === `openrouter:${model.id}` && <CheckCircle2 className="alice-model-selected" size={16} aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.txt,.md,.json,.csv,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.mp4,.mov"
          style={{ display: 'none' }}
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <div className="alice-input-card">
          <textarea
            ref={inputRef}
            className="alice-textarea"
            value={input}
            rows={1}
            placeholder="向爱丽丝提问…"
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
            }}
            onPaste={handleInputPaste}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
          />
          <div className="alice-input-toolbar">
            <button type="button" className="alice-tool-btn" onClick={() => fileInputRef.current?.click()} title="添加附件（图片、txt、md…）" aria-label="添加附件">
              <Plus size={17} />
            </button>
            <button
              type="button"
              className={`alice-tool-btn alice-scope-btn ${scopeActive ? 'active' : ''}`}
              onClick={() => setShowScopePopup((v) => !v)}
              title="选择内容范围"
              aria-label="内容范围"
            >
              <SlidersHorizontal size={15} />
              {scopeActive && (
                <span className="alice-scope-badge">
                  {[useKnowledge && '知识库', useWebSearch && '全网'].filter(Boolean).join('+')}
                </span>
              )}
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className={`alice-tool-btn alice-model-btn ${usesLocalCli || selectedModelChoice !== 'auto' ? 'active' : ''}`}
              onClick={openModelPicker}
              title={activeLocalCliRoute ? `当前使用 ${activeLocalCliRoute.name}；点击查看云端回退模型` : '选择模型'}
              aria-label={activeLocalCliRoute ? `当前使用 ${activeLocalCliRoute.name}` : '选择模型'}
            >
              <AiBrandIcon brand={activeRuntimeBrand} size={17} />
              <span className="alice-model-label">{activeRuntimeLabel}</span>
              {activeLocalCliRoute && <span className="alice-runtime-local-tag">本机</span>}
            </button>
            <button
              type="button"
              className="alice-send-btn"
              onClick={() => loading ? void stopLocalCliExecution() : void send()}
              disabled={loading ? !activeLocalCommandId || isCancellingLocalCommand : (!input.trim() && attachments.length === 0)}
              aria-label={loading ? '停止本机 CLI' : '发送'}
              title={loading ? (activeLocalCommandId ? '停止本机 CLI' : 'Agent 正在运行') : '发送'}
            >
              {loading ? <X size={17} /> : <ArrowUp size={17} />}
            </button>
          </div>
        </div>
      </div>

      {lightboxSrc && <ImageLightbox src={lightboxSrc} alt="附件预览" onClose={() => setLightboxSrc(null)} />}
      {agentPreviewAttachment && <AgentResultPreviewModal attachment={agentPreviewAttachment} onClose={() => setAgentPreviewAttachment(null)} />}

      {/* history panel (absolute overlay within chat-panel) */}
      {showHistory && (
        <div className="chat-history-panel">
          <div className="chat-history-header">
            <div className="chat-record-tabs" role="tablist" aria-label="记录与任务">
              <button type="button" role="tab" aria-selected="true" className="active">对话记录</button>
              <button type="button" role="tab" aria-selected="false" onClick={openTaskCenter}>
                后台任务
                {taskCenterUnreadCount > 0 && <span>{Math.min(9, taskCenterUnreadCount)}</span>}
              </button>
            </div>
            <button type="button" className="chat-panel-icon-btn" onClick={() => setShowHistory(false)} aria-label="关闭记录">
              <X size={15} />
            </button>
          </div>
          <div className="chat-history-tools">
            <div className="chat-history-projects" aria-label="对话项目">
              <button type="button" className={!activeProjectId ? 'active' : ''} onClick={() => setActiveProjectId('')}>全部</button>
              {projects.map((project) => (
                <button key={project.id} type="button" className={activeProjectId === project.id ? 'active' : ''} onClick={() => { setActiveProjectId(project.id); setTemporaryChat(false) }}>
                  <Folder size={13} aria-hidden="true" />{project.name}
                </button>
              ))}
            </div>
            <div className="chat-history-create-project">
              <input
                value={projectDraft}
                onChange={(event) => setProjectDraft(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && createConversationProject()}
                placeholder="新建项目，例如：金额核对"
                aria-label="新建对话项目名称"
              />
              <button type="button" onClick={createConversationProject}>新建项目</button>
            </div>
            <label className="chat-history-search">
              <Search size={14} aria-hidden="true" />
              <input
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder={activeProject ? `搜索「${activeProject.name}」里的对话` : '搜索对话标题和内容'}
                aria-label="搜索对话记录"
              />
            </label>
            <button type="button" className="chat-history-temp-btn" onClick={startTemporaryChat}>开始临时对话</button>
          </div>
          <div className="chat-history-list">
            {filteredHistoryList.length === 0 ? (
              <p className="chat-history-empty">暂无历史记录</p>
            ) : filteredHistoryList.map((r) => (
              <div key={r.id} className="chat-history-item" onClick={() => void loadConversation(r)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && void loadConversation(r)}>
                <span className="chat-history-item-title">{r.title}</span>
                <div className="chat-history-item-meta">
                  {r.projectName && <em>{r.projectName}</em>}
                  <span>{new Date(r.savedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  <button
                    type="button"
                    className="chat-history-del"
                    onClick={(e) => { e.stopPropagation(); void deleteHistoryItem(r.id) }}
                    title="删除"
                    aria-label="删除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {showTaskCenter && (
        <div className="chat-history-panel chat-task-center">
          <div className="chat-history-header">
            <div className="chat-record-tabs" role="tablist" aria-label="记录与任务">
              <button type="button" role="tab" aria-selected="false" onClick={openHistory}>对话记录</button>
              <button type="button" role="tab" aria-selected="true" className="active">后台任务</button>
            </div>
            <button type="button" className="chat-panel-icon-btn" onClick={() => setShowTaskCenter(false)} aria-label="关闭记录"><X size={15} /></button>
          </div>
          <div className="chat-task-center-tabs" role="tablist" aria-label="任务中心内容">
            <button type="button" role="tab" aria-selected={taskCenterTab === 'plans'} className={taskCenterTab === 'plans' ? 'active' : ''} onClick={() => setTaskCenterTab('plans')}>计划与提醒</button>
            <button type="button" role="tab" aria-selected={taskCenterTab === 'memories'} className={taskCenterTab === 'memories' ? 'active' : ''} onClick={() => setTaskCenterTab('memories')}>任务记忆</button>
          </div>
          <div className="chat-history-list">
            {taskCenterTab === 'plans' && agentPlans.map((plan) => {
              const expanded = expandedPlanId === plan.id
              const completedSteps = plan.steps.filter((step) => step.status === 'completed').length
              return (
                <article key={plan.id} className={`chat-task-plan ${plan.unread ? 'unread' : ''}`}>
                  <button type="button" className="chat-task-item" onClick={() => void openAgentPlan(plan)} aria-expanded={expanded}>
                    <span className="chat-task-item-main">
                      <strong>{plan.goal}</strong>
                      <small>{plan.kind === 'reminder' ? '主动提醒' : '持续计划'} · {plan.status === 'completed' ? '已完成' : plan.status === 'paused' ? '已暂停' : `${completedSteps}/${plan.steps.length} 步`}</small>
                    </span>
                    <span className="chat-task-item-meta">{new Date(plan.updatedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</span>
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                  {expanded && (
                    <div className="chat-task-plan-detail">
                      <ol className="chat-task-plan-steps">
                        {plan.steps.map((step) => (
                          <li key={step.id} className={step.status}>
                            <button
                              type="button"
                              className="chat-plan-step-toggle"
                              disabled={taskCenterBusy !== '' || plan.status === 'cancelled'}
                              onClick={() => void updatePlan(plan, step.status === 'completed' ? 'reopen_step' : 'complete_step', step.id)}
                              aria-label={step.status === 'completed' ? `重新打开：${step.label}` : `标记完成：${step.label}`}
                            >
                              <CheckCircle2 size={14} />
                            </button>
                            <span>{step.label}</span>
                          </li>
                        ))}
                      </ol>
                      <div className="chat-task-plan-actions">
                        {plan.taskId && <button type="button" className="ghost-button compact-button" onClick={() => onOpenTask(plan.taskId!)}><Eye size={13} />查看任务</button>}
                        {plan.kind === 'reminder' && plan.status === 'active' && <button type="button" className="primary-button compact-button" disabled={loading} onClick={() => executeReminder(plan)}>执行建议</button>}
                        {plan.kind === 'goal' && plan.status === 'active' && <button type="button" className="ghost-button compact-button" disabled={taskCenterBusy !== ''} onClick={() => void updatePlan(plan, 'pause')}>暂停</button>}
                        {plan.kind === 'goal' && (plan.status === 'paused' || plan.status === 'completed') && <button type="button" className="ghost-button compact-button" disabled={taskCenterBusy !== ''} onClick={() => void updatePlan(plan, 'resume')}><RotateCcw size={13} />继续</button>}
                        <button type="button" className="danger-text-button compact-button" disabled={taskCenterBusy !== ''} onClick={() => void updatePlan(plan, 'cancel')}>取消计划</button>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
            {taskCenterTab === 'plans' && analysisJobs.map((job) => (
              <button key={job.id} type="button" className={`chat-task-item ${job.unread ? 'unread' : ''}`} onClick={() => void openAnalysisJob(job)}>
                <span className="chat-task-item-main">
                  <strong>{job.title}</strong>
                  <small>{job.source === 'scheduled' ? '爱丽丝主动生成' : '对话中发起'} · {agentAnalysisStatusLabel(job.status)}</small>
                </span>
                <span className="chat-task-item-meta">{new Date(job.updatedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</span>
              </button>
            ))}
            {taskCenterTab === 'plans' && analysisJobs.length === 0 && agentPlans.length === 0 && <p className="chat-history-empty">暂无持续计划、提醒或后台分析</p>}
            {taskCenterTab === 'memories' && taskMemories.map((memory) => {
              const expanded = expandedMemoryId === memory.taskId
              return (
                <article key={memory.taskId} className={`chat-task-memory ${memory.disabled ? 'disabled' : ''}`}>
                  <button type="button" className="chat-task-item" onClick={() => setExpandedMemoryId((current) => current === memory.taskId ? 0 : memory.taskId)} aria-expanded={expanded}>
                    <span className="chat-task-item-main">
                      <strong>{memory.taskTitle || `任务 #${memory.taskId}`}</strong>
                      <small>{memory.disabled ? '已停止记忆' : `${memory.openItems.length} 项待办 · ${memory.userNotes.length} 条人工纠正`}</small>
                    </span>
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                  {expanded && (
                    <div className="chat-task-memory-detail">
                      {memory.disabled ? (
                        <button type="button" className="primary-button compact-button" disabled={taskCenterBusy !== ''} onClick={() => void updateMemory(memory, { action: 'set_enabled', enabled: true })}>重新启用记忆</button>
                      ) : (
                        <>
                          <p className="chat-memory-summary">{memory.summary || '等待下一次任务活动后生成摘要。'}</p>
                          {memory.openItems.length > 0 && <div className="chat-memory-section"><strong>待处理</strong>{memory.openItems.map((item) => <div key={item}><span>{item}</span><button type="button" className="ghost-button compact-button" onClick={() => void updateMemory(memory, { action: 'ignore_item', item })}>忽略</button></div>)}</div>}
                          {memory.userNotes.length > 0 && <div className="chat-memory-section"><strong>人工纠正</strong>{memory.userNotes.map((note) => <div key={note}><span>{note}</span><button type="button" className="chat-history-del" title="删除纠正" aria-label={`删除纠正：${note}`} onClick={() => void updateMemory(memory, { action: 'delete_note', note })}><Trash2 size={12} /></button></div>)}</div>}
                          <div className="chat-memory-note-form">
                            <textarea rows={2} value={memoryNoteDrafts[memory.taskId] || ''} placeholder="补充偏好或纠正 Agent 的理解" onChange={(event) => setMemoryNoteDrafts((current) => ({ ...current, [memory.taskId]: event.target.value }))} />
                            <button type="button" className="primary-button compact-button" disabled={!memoryNoteDrafts[memory.taskId]?.trim() || taskCenterBusy !== ''} onClick={() => void updateMemory(memory, { action: 'add_note', note: memoryNoteDrafts[memory.taskId] })}>保存纠正</button>
                          </div>
                          <div className="chat-task-plan-actions">
                            <button type="button" className="ghost-button compact-button" onClick={() => onOpenTask(memory.taskId)}><Eye size={13} />查看任务</button>
                            {memory.ignoredItems.length > 0 && <button type="button" className="ghost-button compact-button" onClick={() => void updateMemory(memory, { action: 'restore_items' })}>恢复已忽略待办</button>}
                            {memoryForgetConfirmId === memory.taskId ? <><button type="button" className="ghost-button compact-button" onClick={() => setMemoryForgetConfirmId(0)}>保留</button><button type="button" className="danger-button compact-button" onClick={() => { setMemoryForgetConfirmId(0); void updateMemory(memory, { action: 'set_enabled', enabled: false }) }}>确认清空</button></> : <button type="button" className="danger-text-button compact-button" onClick={() => setMemoryForgetConfirmId(memory.taskId)}>停止并清空记忆</button>}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
            {taskCenterTab === 'memories' && taskMemories.length === 0 && <p className="chat-history-empty">暂无任务记忆；Agent 在读取或更新任务后会自动建立。</p>}
          </div>
        </div>
      )}
    </div>
  )
}
