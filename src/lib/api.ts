import type { AttachmentAnalysis, FileAsset, InsightDiagnosis, InsightHistoryItem, InsightPeriodType, Task, TaskUpdate, TaxMode } from '../types/domain'
import type { DesignTypeGroup } from '../config/appConfig'

export type ReportRecord = {
  id: string
  month: string
  totalHours: number
  billableHours: number
  totalAmount: number
  status: string
  publicToken: string
  generatedAt: string
  viewedAt: string
  viewCount: number
}

export type ActivityItem = {
  id: string
  action: string
  entityId: string
  entityType: string
  payload: Record<string, unknown> | null
  createdAt: string
}

export type AuthRole = 'admin' | 'collaborator' | 'viewer' | 'client' | 'guest'

export type TokenScope = 'collaborator' | 'viewer' | 'client' | 'guest'

export type OpenRouterFreeModel = {
  id: string
  name: string
  context: number
  vision: boolean
  status: 'ok' | 'limited' | 'unavailable' | 'error'
}
export type OpenRouterFreeModelsResult = { scannedAt: string; models: OpenRouterFreeModel[] }

export type AccessToken = {
  id: string
  token: string
  label: string
  scope: TokenScope
  expiresAt: string
  disabled: boolean
  expired: boolean
  createdAt: string
  lastUsedAt: string
}

export type AiModelProvider = 'deepseek' | 'gemini' | 'kimi' | 'doubao' | 'openai' | 'openrouter' | 'anthropic' | 'custom-openai'

export type AiModelMode = 'deepseek-direct' | 'baml-runtime'

export type AiModelRouteKey = 'textPrimary' | 'textFallback' | 'visionPrimary' | 'visionFallback'

export type AiModelEndpointConfig = {
  provider: AiModelProvider
  baseUrl: string
  model: string
  apiKeyPreview?: string
  hasApiKey: boolean
  keySource: 'environment' | 'setting' | 'missing'
}

export type AiModelConfig = {
  mode: AiModelMode
  provider: AiModelProvider
  baseUrl: string
  model: string
  runtimeUrl: string
  apiKeyPreview?: string
  updatedAt?: string
  hasApiKey: boolean
  encryptionReady: boolean
  runtimeConfigured: boolean
  textPrimary: AiModelEndpointConfig
  textFallback: AiModelEndpointConfig
  visionPrimary: AiModelEndpointConfig
  visionFallback: AiModelEndpointConfig
}

export type BackendState = {
  role: AuthRole
  tasks: Task[]
  updates: TaskUpdate[]
  files: FileAsset[]
  attachmentAnalyses: AttachmentAnalysis[]
  settings: {
    hourlyRate: number
    pdfTitle: string
    serviceCompanyName: string
    taxMode: TaxMode
    designTypes: string[]
    designTypeGroups: DesignTypeGroup[]
    aiModel?: AiModelConfig
  }
  reports: ReportRecord[]
  accessTokens?: AccessToken[]
}

export type SharedReportState = {
  report: ReportRecord
  tasks: Task[]
  updates: TaskUpdate[]
  files: FileAsset[]
  settings?: {
    pdfTitle: string
    serviceCompanyName: string
  }
}

export type TaskAssistantSuggestion = {
  suggestedTitle: string
  optimizedRequirement: string
  suggestedParentType: string
  suggestedChildType: string
  suggestedType: string
  categoryExists: boolean
  reason: string
  missingCategory?: {
    parent?: string
    child?: string
  }
}

export type TextAssistantMode = 'acceptance' | 'progress'
export type TextLearningContext = TextAssistantMode | 'attachment_name'

export type TextAssistantSuggestion = {
  optimizedText: string
  summary: string
}

export type TextAssistantProgressHistoryItem = {
  sequence: number
  date: string
  endDate: string
  start: string
  end: string
  note: string
  kind: 'progress' | 'revision' | 'client_feedback'
  counted: boolean
  attachments: string[]
}

export type TextAssistantPayload = {
  mode: TextAssistantMode
  text: string
  task: Pick<Task, 'id' | 'title' | 'type' | 'requirement' | 'contact' | 'requester' | 'reviewer' | 'date' | 'estimatedDate' | 'status' | 'progress' | 'actualHours' | 'supplementalNote' | 'acceptanceNote' | 'acceptanceFiles' | 'files'>
  files: Array<Pick<FileAsset, 'name' | 'type' | 'tag' | 'final' | 'visible' | 'uploadedAt'>>
  activity?: Array<{ createdAt: string; summary: string }>
  uploadedFileNames?: string[]
  progressHistory?: TextAssistantProgressHistoryItem[]
}

export type AttachmentNamePayload = {
  fileName: string
  mimeType?: string
  imageBase64?: string
  note?: string
  recentFileNames?: string[]
  task?: Pick<Task, 'id' | 'title' | 'type' | 'requirement' | 'contact' | 'requester' | 'reviewer'>
}

export type AttachmentNameSuggestion = {
  suggestedName: string
  reason: string
  confidence: '低' | '中' | '高'
  fallbackUsed?: boolean
}

export type HourEstimateSuggestion = {
  suggestedHours: number
  confidence: '低' | '中' | '高'
  basis: string[]
  historicalSummary: string
  sampleCount: number
  averageHours: number
  medianHours: number
  minHours: number
  maxHours: number
  averageDeliveryDays: number
  matchedType: string
  usedFallback: boolean
}

export type HourEstimatePayload = {
  title: string
  requirement: string
  selectedType: string
  startDate: string
  estimatedDate: string
}

export type DailyKnowledgeSuggestion = {
  category: string
  source: string
  title: string
  teaser: string
  body: string[]
}

export type DailyKnowledgePayload = {
  currentMonth: string
  taskThemes: string[]
  recentTitles: string[]
}

const authStorageKey = 'designer-worklog-auth'
const legacyTokenStorageKey = 'designer-worklog-admin-token'

export type StoredAuth = {
  email: string
  /** 登录时拿到的角色，用于在重新加载时检测「管理员凭证已失效被降级」 */
  role?: AuthRole
}

export function getStoredAuth(): StoredAuth | null {
  // 清理旧版单口令存储
  window.localStorage.removeItem(legacyTokenStorageKey)
  try {
    const raw = window.localStorage.getItem(authStorageKey)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as StoredAuth & { key?: unknown }
    const sanitized = parsed.email || parsed.role ? { email: parsed.email ?? '', role: parsed.role } : null
    if (sanitized) {
      window.localStorage.setItem(authStorageKey, JSON.stringify(sanitized))
    }
    return sanitized
  } catch {
    return null
  }
}

export function setStoredAuth(auth: StoredAuth) {
  window.localStorage.setItem(authStorageKey, JSON.stringify(auth))
}

export function clearStoredAuth() {
  window.localStorage.removeItem(authStorageKey)
  window.localStorage.removeItem(legacyTokenStorageKey)
}

/** 文件请求与普通 API 统一使用同源 HttpOnly 会话 Cookie。 */
export function authedPreviewUrl(url: string | undefined) {
  return url
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** XHR 请求：用于需要上传进度回调的场景 */
function xhrJson<T>(method: string, url: string, body: XMLHttpRequestBodyInit, onProgress?: (loaded: number, total: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, url)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(event.loaded, event.total)
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T)
        } catch {
          reject(new ApiError('响应解析失败', xhr.status))
        }
        return
      }
      let message = `请求失败：${xhr.status}`
      try {
        message = (JSON.parse(xhr.responseText) as { error?: string }).error ?? message
      } catch {
        /* keep default */
      }
      reject(new ApiError(message, xhr.status))
    }
    xhr.onerror = () => reject(new ApiError('网络错误，请重试', 0))
    xhr.send(body)
  })
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit, withAuth = true): Promise<T> {
  const headers = new Headers(init?.headers)
  void withAuth
  const response = await fetch(input, { ...init, headers })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(body?.error ?? `请求失败：${response.status}`, response.status)
  }
  return response.json() as Promise<T>
}

export const api = {
  login: (email: string, key: string, turnstileToken?: string) =>
    requestJson<{ role: AuthRole }>(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, key, turnstileToken }),
      },
      false,
    ),
  logout: () => requestJson<{ ok: true }>('/api/auth/logout', { method: 'POST' }, false),
  changeAdminPassword: (payload: { currentPassword: string; newPassword: string }) =>
    requestJson<{ ok: true }>('/api/auth/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  requestPasswordReset: (email: string) =>
    requestJson<{ ok: true }>(
      '/api/auth/password-reset/request',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      },
      false,
    ),
  confirmPasswordReset: (payload: { email: string; token: string; newPassword: string }) =>
    requestJson<{ ok: true }>(
      '/api/auth/password-reset/confirm',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      },
      false,
    ),
  getState: () => requestJson<BackendState>('/api/state'),
  searchTasks: (q: string) =>
    requestJson<{ results: Array<{ taskId: number; score: number; title: string; month: string; type: string }> }>(
      `/api/search?q=${encodeURIComponent(q)}`,
    ),
  reindexSearch: () => requestJson<{ ok: boolean; indexed: number; total: number }>('/api/search/reindex', { method: 'POST' }),
  exportReportPdf: async (month: string): Promise<Blob> => {
    const response = await fetch(`/api/reports/${month}/pdf`)
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      throw new ApiError(body?.error ?? `PDF 导出失败：${response.status}`, response.status)
    }
    return response.blob()
  },
  getSharedReport: (token: string) => requestJson<SharedReportState>(`/api/shared/${token}`, undefined, false),
  createAccessToken: (payload: { label: string; expiresInDays: number | null; scope: TokenScope }) =>
    requestJson<AccessToken>('/api/tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  setAccessTokenDisabled: (tokenId: string, disabled: boolean) =>
    requestJson<AccessToken>(`/api/tokens/${tokenId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ disabled }),
    }),
  deleteAccessToken: (tokenId: string) =>
    requestJson<{ ok: true }>(`/api/tokens/${tokenId}`, {
      method: 'DELETE',
    }),
  createTask: (task: Task) =>
    requestJson<Task>('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(task),
    }),
  updateTask: (taskId: number, changes: Partial<Task>) =>
    requestJson<Task>(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(changes),
    }),
  deleteTask: (taskId: number) =>
    requestJson<{ ok: true }>(`/api/tasks/${taskId}`, {
      method: 'DELETE',
    }),
  voidTask: (taskId: number, reason: string) =>
    requestJson<{ ok: true }>(`/api/tasks/${taskId}/void`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    }),
  restoreTask: (taskId: number) =>
    requestJson<{ ok: true }>(`/api/tasks/${taskId}/restore`, {
      method: 'POST',
    }),
  createUpdate: (update: TaskUpdate) =>
    requestJson<TaskUpdate>('/api/updates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(update),
    }),
  updateUpdate: (updateId: number, changes: Partial<TaskUpdate>) =>
    requestJson<TaskUpdate>(`/api/updates/${updateId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(changes),
    }),
  deleteUpdate: (updateId: number) =>
    requestJson<{ ok: true }>(`/api/updates/${updateId}`, {
      method: 'DELETE',
    }),
  getTaskActivity: (taskId: number) => requestJson<{ items: ActivityItem[] }>(`/api/tasks/${taskId}/activity`),
  deleteActivity: (activityId: string) =>
    requestJson<{ ok: true }>(`/api/activity/${activityId}`, {
      method: 'DELETE',
    }),
  /**
   * 智能上传：90MB 以内整体上传，超过则自动走 R2 分片上传（绕开 Workers 请求体上限）。
   * onProgress 回调 0–1 的总体进度。
   */
  uploadFile: async (
    payload: {
      taskId: number
      entryId?: string
      scope: 'progress' | 'acceptance'
      file: File
      preview?: File
      type: string
      size: string
      final: boolean
      visible: boolean
      tag?: string
      analyze?: boolean
    },
    onProgress?: (ratio: number) => void,
  ): Promise<FileAsset> => {
    const { file } = payload
    const singleShotLimit = 12 * 1024 * 1024

    if (file.size <= singleShotLimit) {
      const form = new FormData()
      form.set('taskId', String(payload.taskId))
      form.set('entryId', payload.entryId ?? '')
      form.set('scope', payload.scope)
      form.set('file', file)
      form.set('type', payload.type)
      form.set('size', payload.size)
      form.set('final', String(payload.final))
      form.set('visible', String(payload.visible))
      form.set('tag', payload.tag ?? '')
      form.set('analyze', String(payload.analyze ?? true))
      if (payload.preview) {
        form.set('preview', payload.preview)
      }
      return xhrJson<FileAsset>('POST', '/api/files', form, (loaded, total) => onProgress?.(loaded / total))
    }

    // 大文件：R2 分片上传
    const init = await requestJson<{ fileId: string; key: string; uploadId: string }>('/api/files/multipart/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ taskId: payload.taskId, entryId: payload.entryId ?? '', fileName: file.name, contentType: file.type }),
    })

    try {
      const partSize = 8 * 1024 * 1024
      const totalParts = Math.ceil(file.size / partSize)
      const parts: { partNumber: number; etag: string }[] = []
      for (let index = 0; index < totalParts; index += 1) {
        const start = index * partSize
        const chunk = file.slice(start, Math.min(start + partSize, file.size))
        const part = await xhrJson<{ partNumber: number; etag: string }>(
          'PUT',
          `/api/files/multipart/part?key=${encodeURIComponent(init.key)}&uploadId=${encodeURIComponent(init.uploadId)}&partNumber=${index + 1}`,
          chunk,
          (loaded) => onProgress?.(Math.min(0.99, (start + loaded) / file.size)),
        )
        parts.push(part)
      }

      const completeForm = new FormData()
      completeForm.set('key', init.key)
      completeForm.set('uploadId', init.uploadId)
      completeForm.set('fileId', init.fileId)
      completeForm.set('parts', JSON.stringify(parts))
      completeForm.set('taskId', String(payload.taskId))
      completeForm.set('entryId', payload.entryId ?? '')
      completeForm.set('scope', payload.scope)
      completeForm.set('name', file.name)
      completeForm.set('type', payload.type)
      completeForm.set('size', payload.size)
      completeForm.set('fileSize', String(file.size))
      completeForm.set('contentType', file.type)
      completeForm.set('final', String(payload.final))
      completeForm.set('visible', String(payload.visible))
      completeForm.set('tag', payload.tag ?? '')
      completeForm.set('analyze', String(payload.analyze ?? true))
      if (payload.preview) {
        completeForm.set('preview', payload.preview)
      }
      const saved = await requestJson<FileAsset>('/api/files/multipart/complete', { method: 'POST', body: completeForm })
      onProgress?.(1)
      return saved
    } catch (error) {
      await requestJson<{ ok: true }>('/api/files/multipart/abort', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: init.key, uploadId: init.uploadId }),
      }).catch(() => null)
      throw error
    }
  },
  updateFile: (fileId: number, payload: { name?: string; tag?: string; scope?: 'acceptance' | 'progress' }) =>
    requestJson<FileAsset>(`/api/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteFile: (fileId: number) =>
    requestJson<{ ok: true }>(`/api/files/${fileId}`, {
      method: 'DELETE',
    }),
  // 为缺少预览图的文件补一张（前端渲染 PDF 首页后回传）
  setFilePreview: (fileId: number, preview: File): Promise<{ previewUrl?: string }> => {
    const form = new FormData()
    form.set('preview', preview)
    return xhrJson<{ previewUrl?: string }>('POST', `/api/files/${fileId}/preview`, form)
  },
  setEntryAttachmentsArchived: (taskId: number, entryId: string, archived: boolean) =>
    requestJson<{ ok: true; affected: number }>(`/api/tasks/${taskId}/entry-attachments`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entryId, archived }),
    }),
  retryAttachmentAnalysis: (fileId: number) =>
    requestJson<{ ok: true; attachmentId: number }>(`/api/files/${fileId}/analysis/retry`, {
      method: 'POST',
    }),
  backfillAttachmentAnalyses: () =>
    requestJson<{ ok: true; created: number }>('/api/insights/attachment-analyses/backfill', {
      method: 'POST',
    }),
  diagnoseInsights: (payload: { month: string; period: InsightPeriodType }) =>
    requestJson<InsightDiagnosis>('/api/insights/diagnose', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  getInsightHistory: () => requestJson<InsightHistoryItem[]>('/api/insights/history'),
  setHourlyRate: (hourlyRate: number) =>
    requestJson<{ hourlyRate: number }>('/api/settings/hourly-rate', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hourlyRate }),
    }),
  setPdfTitle: (pdfTitle: string) =>
    requestJson<{ pdfTitle: string }>('/api/settings/pdf-title', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pdfTitle }),
    }),
  setServiceCompanyName: (serviceCompanyName: string) =>
    requestJson<{ serviceCompanyName: string }>('/api/settings/service-company', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ serviceCompanyName }),
    }),
  setTaxMode: (taxMode: TaxMode) =>
    requestJson<{ taxMode: TaxMode }>('/api/settings/tax-mode', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ taxMode }),
    }),
  setDesignTypes: (designTypes: string[]) =>
    requestJson<{ designTypes: string[] }>('/api/settings/design-types', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ designTypes }),
    }),
  setDesignTypeGroups: (designTypeGroups: DesignTypeGroup[]) =>
    requestJson<{ designTypes: string[]; designTypeGroups: DesignTypeGroup[] }>('/api/settings/design-type-groups', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ designTypeGroups }),
    }),
  setAiModelConfig: (
    payload: Partial<Pick<AiModelConfig, 'mode' | 'provider' | 'baseUrl' | 'model' | 'runtimeUrl'>> & {
      apiKey?: string
      clearApiKey?: boolean
      routes?: Partial<Record<AiModelRouteKey, Partial<Pick<AiModelEndpointConfig, 'provider' | 'baseUrl' | 'model'>>>>
      routeApiKeys?: Partial<Record<AiModelRouteKey, string>>
      clearRouteApiKeys?: AiModelRouteKey[]
    },
  ) =>
    requestJson<AiModelConfig>('/api/settings/ai-model', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  testAiModelRoute: (payload: { route: AiModelRouteKey; capability: 'text' | 'vision' }) =>
    requestJson<{ ok: boolean; route: AiModelRouteKey; provider: AiModelProvider; model: string; output: string; fallbackUsed?: boolean }>('/api/ai/model-test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  listAiModels: (route: AiModelRouteKey) =>
    requestJson<{ provider: AiModelProvider; models: string[] }>(`/api/ai/models?route=${encodeURIComponent(route)}`),
  getOpenRouterFreeModels: () =>
    requestJson<OpenRouterFreeModelsResult>('/api/ai/openrouter/free-models'),
  scanOpenRouterFreeModels: () =>
    requestJson<OpenRouterFreeModelsResult>('/api/ai/openrouter/free-models/scan', { method: 'POST' }),
  estimateTaskProgress: (payload: { title: string; requirement: string; status: string; entries: Array<{ date: string; note: string; isAcceptance: boolean }> }) =>
    requestJson<{ progress: number; reason: string }>('/api/ai/progress-estimate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  suggestTaskAssistant: (payload: { title: string; requirement: string; selectedType: string; designTypeGroups: DesignTypeGroup[]; attachmentText?: string; attachmentName?: string; attachmentImages?: Array<{ base64: string; mimeType: string; name: string }> }) =>
    requestJson<TaskAssistantSuggestion>('/api/ai/task-assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  recordTaskEditPair: (payload: { aiOutput: string; userFinal: string; designType?: string }) =>
    fetch('/api/ai/task-edits', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => null),
  recordTaskTitleEditPair: (payload: { aiOutput: string; userFinal: string; designType?: string }) =>
    fetch('/api/ai/task-title-edits', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => null),
  recordTaskTypeChoice: (payload: { requirement: string; title: string; finalType: string; aiSuggestedType?: string }) =>
    fetch('/api/ai/task-type-choices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => null),
  recordTextEditPair: (payload: { context: TextLearningContext; aiOutput: string; userFinal: string; designType?: string; taskId?: number; taskTitle?: string }) =>
    fetch('/api/ai/text-edits', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => null),
  optimizeTaskTextAssistant: (payload: TextAssistantPayload) =>
    requestJson<TextAssistantSuggestion>('/api/ai/text-assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  suggestAttachmentName: (payload: AttachmentNamePayload) =>
    requestJson<AttachmentNameSuggestion>('/api/ai/attachment-name', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  suggestHourEstimate: (payload: HourEstimatePayload) =>
    requestJson<HourEstimateSuggestion>('/api/ai/hour-estimate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  suggestDailyKnowledge: (payload: DailyKnowledgePayload) =>
    requestJson<DailyKnowledgeSuggestion>('/api/ai/daily-knowledge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  lockMonthlyReport: (payload: { month: string; hourlyRate: number; importedHours: number }) =>
    requestJson<{ id: string; month: string; totalHours: number; billableHours: number; totalAmount: number; publicToken: string }>(
      '/api/reports/monthly',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      },
    ),
  rotateMonthlyReportToken: (reportId: string) =>
    requestJson<{ report: ReportRecord }>(`/api/reports/${reportId}/token`, {
      method: 'POST',
    }),
}
