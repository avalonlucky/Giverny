import type { FileAsset, Task, TaskUpdate, TaxMode } from '../types/domain'
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

export type AuthRole = 'admin' | 'member'

export type AccessToken = {
  id: string
  token: string
  label: string
  expiresAt: string
  disabled: boolean
  expired: boolean
  createdAt: string
  lastUsedAt: string
}

export type BackendState = {
  role: AuthRole
  tasks: Task[]
  updates: TaskUpdate[]
  files: FileAsset[]
  settings: {
    hourlyRate: number
    pdfTitle: string
    serviceCompanyName: string
    taxMode: TaxMode
    designTypes: string[]
    designTypeGroups: DesignTypeGroup[]
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

const authStorageKey = 'designer-worklog-auth'
const legacyTokenStorageKey = 'designer-worklog-admin-token'

export type StoredAuth = {
  email: string
  key: string
}

export function getStoredAuth(): StoredAuth | null {
  // 清理旧版单口令存储
  window.localStorage.removeItem(legacyTokenStorageKey)
  try {
    const raw = window.localStorage.getItem(authStorageKey)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as StoredAuth
    return parsed.key ? { email: parsed.email ?? '', key: parsed.key } : null
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

/** 给 <img> 等无法携带 header 的请求附加登录凭证 */
export function authedPreviewUrl(url: string | undefined) {
  if (!url) {
    return undefined
  }
  const auth = getStoredAuth()
  if (!auth || url.includes('auth=') || url.includes('token=')) {
    return url
  }
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}auth=${encodeURIComponent(auth.key)}&email=${encodeURIComponent(auth.email)}`
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
    const auth = getStoredAuth()
    if (auth) {
      xhr.setRequestHeader('x-auth-key', auth.key)
      xhr.setRequestHeader('x-auth-email', auth.email)
    }
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
  if (withAuth) {
    const auth = getStoredAuth()
    if (auth) {
      headers.set('x-auth-key', auth.key)
      headers.set('x-auth-email', auth.email)
    }
  }
  const response = await fetch(input, { ...init, headers })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(body?.error ?? `请求失败：${response.status}`, response.status)
  }
  return response.json() as Promise<T>
}

export const api = {
  login: (email: string, key: string) =>
    requestJson<{ role: AuthRole }>(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, key }),
      },
      false,
    ),
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
  getSharedReport: (token: string) => requestJson<SharedReportState>(`/api/shared/${token}`, undefined, false),
  createAccessToken: (payload: { label: string; expiresInDays: number | null }) =>
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
      file: File
      preview?: File
      type: string
      size: string
      final: boolean
      visible: boolean
      tag?: string
    },
    onProgress?: (ratio: number) => void,
  ): Promise<FileAsset> => {
    const { file } = payload
    const singleShotLimit = 90 * 1024 * 1024

    if (file.size <= singleShotLimit) {
      const form = new FormData()
      form.set('taskId', String(payload.taskId))
      form.set('file', file)
      form.set('type', payload.type)
      form.set('size', payload.size)
      form.set('final', String(payload.final))
      form.set('visible', String(payload.visible))
      form.set('tag', payload.tag ?? '')
      if (payload.preview) {
        form.set('preview', payload.preview)
      }
      return xhrJson<FileAsset>('POST', '/api/files', form, (loaded, total) => onProgress?.(loaded / total))
    }

    // 大文件：R2 分片上传
    const init = await requestJson<{ fileId: string; key: string; uploadId: string }>('/api/files/multipart/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ taskId: payload.taskId, fileName: file.name, contentType: file.type }),
    })

    const partSize = 40 * 1024 * 1024
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
    completeForm.set('name', file.name)
    completeForm.set('type', payload.type)
    completeForm.set('size', payload.size)
    completeForm.set('fileSize', String(file.size))
    completeForm.set('contentType', file.type)
    completeForm.set('final', String(payload.final))
    completeForm.set('visible', String(payload.visible))
    completeForm.set('tag', payload.tag ?? '')
    if (payload.preview) {
      completeForm.set('preview', payload.preview)
    }
    const saved = await requestJson<FileAsset>('/api/files/multipart/complete', { method: 'POST', body: completeForm })
    onProgress?.(1)
    return saved
  },
  updateFile: (fileId: number, payload: { name?: string; tag?: string }) =>
    requestJson<FileAsset>(`/api/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteFile: (fileId: number) =>
    requestJson<{ ok: true }>(`/api/files/${fileId}`, {
      method: 'DELETE',
    }),
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
  suggestTaskAssistant: (payload: { title: string; requirement: string; selectedType: string; designTypeGroups: DesignTypeGroup[] }) =>
    requestJson<TaskAssistantSuggestion>('/api/ai/task-assistant', {
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
}
