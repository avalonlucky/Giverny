import { defaultDesignTypeGroups, defaultDesignTypes, defaultHourlyRate, defaultPdfTitle, defaultServiceCompanyName, type DesignTypeGroup } from './config/appConfig'
import JSZip from 'jszip'
import type { AttachmentAnalysis, FileAsset, InsightDiagnosis, InsightHistoryItem, InsightHistoryStatus, InsightPeriodType, Task, TaskFeedbackRating, TaskFeedbackTag, TaskStatus, TaskUpdate, TaxMode, TimeEntry, WaitingEntry, WaitingReason } from './types/domain'

type D1Result<T = unknown> = { results?: T[]; success: boolean; meta?: { changes?: number } }
type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement
  first: <T = unknown>() => Promise<T | null>
  run: () => Promise<D1Result>
  all: <T = unknown>() => Promise<D1Result<T>>
}
type D1Database = {
  prepare: (query: string) => D1PreparedStatement
  batch: (statements: D1PreparedStatement[]) => Promise<D1Result[]>
}
type R2ObjectBody = { body: ReadableStream; httpMetadata?: { contentType?: string } }
type R2UploadedPart = { partNumber: number; etag: string }
type R2MultipartUpload = {
  key: string
  uploadId: string
  uploadPart: (partNumber: number, value: ArrayBuffer) => Promise<R2UploadedPart>
  complete: (parts: R2UploadedPart[]) => Promise<unknown>
  abort: () => Promise<void>
}
type R2Bucket = {
  get: (key: string) => Promise<R2ObjectBody | null>
  put: (key: string, value: ReadableStream | ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string } }) => Promise<unknown>
  delete: (key: string) => Promise<void>
  createMultipartUpload: (key: string, options?: { httpMetadata?: { contentType?: string } }) => Promise<R2MultipartUpload>
  resumeMultipartUpload: (key: string, uploadId: string) => R2MultipartUpload
}

type Env = {
  DB: D1Database
  UPLOADS: R2Bucket
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  ADMIN_TOKEN?: string
  DEEPSEEK_API_KEY?: string
  DEEPSEEK_BASE_URL?: string
  DEEPSEEK_MODEL?: string
  GEMINI_API_KEY?: string
  GEMINI_BASE_URL?: string
  GEMINI_VISION_MODEL?: string
  KIMI_API_KEY?: string
  KIMI_BASE_URL?: string
  KIMI_MODEL?: string
  AI_PROVIDER?: string
  AI_RUNTIME_URL?: string
  AI_RUNTIME_KEY?: string
  AI_SETTINGS_SECRET?: string
  RESEND_API_KEY?: string
  RESET_EMAIL_FROM?: string
}

type WorkerExecutionContext = {
  waitUntil: (promise: Promise<unknown>) => void
}

// 管理员账号：该邮箱 + 平台密码拥有最高权限（含口令管理）
const ADMIN_EMAIL = 'bh141425@gmail.com'
const ADMIN_PASSWORD_SETTING = 'adminPasswordHash'
const ADMIN_RESET_SETTING = 'adminPasswordReset'
const AI_MODEL_SETTING = 'aiModelConfig'
const PASSWORD_ITERATIONS = 100000

type AiModelProvider = 'deepseek' | 'gemini' | 'kimi' | 'openai' | 'openrouter' | 'anthropic' | 'custom-openai'

type AiModelMode = 'deepseek-direct' | 'baml-runtime'

type AiModelRouteKey = 'textPrimary' | 'textFallback' | 'visionPrimary' | 'visionFallback'

type StoredAiModelEndpointConfig = {
  provider: AiModelProvider
  baseUrl: string
  model: string
  apiKeyEncrypted?: string
  apiKeyPreview?: string
}

type PublicAiModelEndpointConfig = {
  provider: AiModelProvider
  baseUrl: string
  model: string
  apiKeyPreview?: string
  hasApiKey: boolean
  keySource: 'environment' | 'setting' | 'missing'
}

type StoredAiModelConfig = {
  mode: AiModelMode
  provider: AiModelProvider
  baseUrl: string
  model: string
  runtimeUrl: string
  apiKeyEncrypted?: string
  apiKeyPreview?: string
  updatedAt?: string
  routes?: Partial<Record<AiModelRouteKey, StoredAiModelEndpointConfig>>
}

type PublicAiModelConfig = {
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
  textPrimary: PublicAiModelEndpointConfig
  textFallback: PublicAiModelEndpointConfig
  visionPrimary: PublicAiModelEndpointConfig
  visionFallback: PublicAiModelEndpointConfig
}

type AuthRole = 'admin' | 'member'

type DbAccessToken = {
  id: string
  token: string
  label: string | null
  expires_at: string | null
  disabled: number
  created_at: string
  last_used_at: string | null
}

type DbTask = {
  id: string
  title: string
  requirement: string | null
  design_type: string | null
  start_date: string | null
  estimated_delivery_date: string | null
  actual_delivery_date: string | null
  settlement_month: string | null
  is_supplemental: number
  estimated_hours: number
  actual_hours: number
  hourly_rate: number
  requester: string | null
  contact_person: string | null
  reviewer: string | null
  stage: string | null
  status: Task['status']
  progress: number
  suspend_reason: string | null
  terminate_reason: string | null
  supplemental_note: string | null
  acceptance_note: string | null
  feedback_rating: TaskFeedbackRating | null
  feedback_tags_json: string | null
  feedback_note: string | null
  time_entries_json: string | null
  waiting_entries_json: string | null
  is_billable: number
  deleted_at?: string | null
  voided_at?: string | null
  void_reason?: string | null
}

type DbUpdate = {
  id: string
  task_id: string
  update_date: string
  title: string
  body: string
  hours: number
  visible_to_client: number
}

type DbAttachment = {
  id: string
  task_id: string
  entry_id: string | null
  attachment_scope: 'progress' | 'acceptance'
  file_name: string
  file_type: string | null
  mime_type: string | null
  r2_key: string
  preview_r2_key: string | null
  file_size: number | null
  display_size: string | null
  is_final: number
  visible_to_client: number
  file_tag: string | null
  uploaded_at: string
  deleted_at: string | null
  task_title: string | null
}

type DbAttachmentAnalysis = {
  attachment_id: string
  task_id: string
  file_name: string
  file_type: string | null
  status: AttachmentAnalysis['status']
  attempt_count: number
  parser_kind: string | null
  provider: string | null
  model: string | null
  summary: string | null
  content_type: string | null
  extracted_text: string | null
  findings_json: string | null
  quality_issues_json: string | null
  requirement_matches_json: string | null
  risks_json: string | null
  suggestions_json: string | null
  confidence: AttachmentAnalysis['confidence'] | null
  error_message: string | null
  requested_at: string
  completed_at: string | null
}

type DbInsightDiagnosis = {
  id: string
  period_key: string
  period_type: InsightPeriodType
  data_fingerprint: string
  result_json: string
  created_at: string
}

type DbInsightHistory = {
  id: string
  generated_at: string
  insight_type: InsightHistoryItem['insightType']
  finding: string
  recommendation: string
  data_snapshot: string
  status: InsightHistoryStatus
  trigger_key: string | null
  trigger_fingerprint: string | null
}

type DbReport = {
  id: string
  month: string
  total_hours: number
  billable_hours: number
  total_amount: number
  status: string
  public_token: string | null
  generated_at: string | null
  viewed_at: string | null
  view_count: number
}

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' }

const ok = (data: unknown, status = 200) => Response.json(data, { status, headers: jsonHeaders })

const fail = (message: string, status = 400) => ok({ error: message }, status)

const encoder = new TextEncoder()

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

const base64ToBytes = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0))

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) {
    return false
  }
  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= a[index] ^ b[index]
  }
  return diff === 0
}

async function hashSecret(secret: string, salt = crypto.getRandomValues(new Uint8Array(16)), iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  )
  return `pbkdf2-sha256$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`
}

function getSecretHashIterations(storedHash: string | null | undefined) {
  if (!storedHash) {
    return null
  }
  const [method, iterationsRaw] = storedHash.split('$')
  const iterations = Number(iterationsRaw)
  if (method !== 'pbkdf2-sha256' || !Number.isInteger(iterations) || iterations < 1) {
    return null
  }
  return iterations
}

async function verifySecret(secret: string, storedHash: string | null | undefined) {
  if (!secret || !storedHash) {
    return false
  }
  const [method, iterationsRaw, saltRaw, hashRaw] = storedHash.split('$')
  const iterations = Number(iterationsRaw)
  if (
    method !== 'pbkdf2-sha256' ||
    !Number.isInteger(iterations) ||
    iterations < 1 ||
    iterations > PASSWORD_ITERATIONS ||
    !saltRaw ||
    !hashRaw
  ) {
    return false
  }
  const candidate = await hashSecret(secret, base64ToBytes(saltRaw), iterations)
  const candidateHash = candidate.split('$')[3] ?? ''
  return timingSafeEqual(base64ToBytes(candidateHash), base64ToBytes(hashRaw))
}

async function getSettingValue(env: Env, key: string) {
  const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?').bind(key).first<{ value: string }>()
  return row?.value ?? null
}

async function setSettingValue(env: Env, key: string, value: string) {
  await env.DB.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(key, value)
    .run()
}

async function deleteSettingValue(env: Env, key: string) {
  await env.DB.prepare('DELETE FROM app_settings WHERE key = ?').bind(key).run()
}

function defaultAiModelConfig(env: Env): StoredAiModelConfig {
  return {
    mode: 'deepseek-direct',
    provider: 'deepseek',
    baseUrl: (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
    model: env.DEEPSEEK_MODEL || 'deepseek-chat',
    runtimeUrl: (env.AI_RUNTIME_URL || '').replace(/\/$/, ''),
    routes: defaultAiModelRoutes(env),
  }
}

function normalizeAiProvider(value: unknown): AiModelProvider {
  return value === 'deepseek' ||
    value === 'gemini' ||
    value === 'kimi' ||
    value === 'openai' ||
    value === 'openrouter' ||
    value === 'anthropic' ||
    value === 'custom-openai'
    ? value
    : 'deepseek'
}

function normalizeAiMode(value: unknown): AiModelMode {
  return value === 'baml-runtime' ? 'baml-runtime' : 'deepseek-direct'
}

function defaultAiModelRoutes(env: Env): Record<AiModelRouteKey, StoredAiModelEndpointConfig> {
  return {
    textPrimary: {
      provider: 'deepseek',
      baseUrl: (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
      model: env.DEEPSEEK_MODEL || 'deepseek-chat',
    },
    textFallback: {
      provider: 'kimi',
      baseUrl: (env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1').replace(/\/$/, ''),
      model: env.KIMI_MODEL || 'kimi-k2.6',
    },
    visionPrimary: {
      provider: 'gemini',
      baseUrl: (env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, ''),
      model: env.GEMINI_VISION_MODEL || 'gemini-3-flash-preview',
    },
    visionFallback: {
      provider: 'kimi',
      baseUrl: (env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1').replace(/\/$/, ''),
      model: env.KIMI_MODEL || 'kimi-k2.6',
    },
  }
}

function normalizeAiEndpoint(route: AiModelRouteKey, value: Partial<StoredAiModelEndpointConfig> | undefined, env: Env): StoredAiModelEndpointConfig {
  const fallback = defaultAiModelRoutes(env)[route]
  return {
    ...fallback,
    ...value,
    provider: normalizeAiProvider(value?.provider ?? fallback.provider),
    baseUrl: String(value?.baseUrl || fallback.baseUrl).trim().replace(/\/$/, ''),
    model: String(value?.model || fallback.model).trim(),
    apiKeyEncrypted: value?.apiKeyEncrypted,
    apiKeyPreview: value?.apiKeyPreview,
  }
}

function providerEnvironmentKey(env: Env, provider: AiModelProvider) {
  if (provider === 'gemini') {
    return env.GEMINI_API_KEY || ''
  }
  if (provider === 'kimi') {
    return env.KIMI_API_KEY || ''
  }
  if (provider === 'deepseek') {
    return env.DEEPSEEK_API_KEY || ''
  }
  return ''
}

function publicAiEndpointConfig(env: Env, endpoint: StoredAiModelEndpointConfig): PublicAiModelEndpointConfig {
  const hasSettingKey = Boolean(endpoint.apiKeyEncrypted)
  const hasEnvironmentKey = Boolean(providerEnvironmentKey(env, endpoint.provider))
  return {
    provider: endpoint.provider,
    baseUrl: endpoint.baseUrl,
    model: endpoint.model,
    apiKeyPreview: endpoint.apiKeyPreview || (hasEnvironmentKey ? '环境变量' : undefined),
    hasApiKey: hasSettingKey || hasEnvironmentKey,
    keySource: hasSettingKey ? 'setting' : hasEnvironmentKey ? 'environment' : 'missing',
  }
}

function publicAiModelConfig(env: Env, config: StoredAiModelConfig): PublicAiModelConfig {
  const routes = {
    ...defaultAiModelRoutes(env),
    ...(config.routes ?? {}),
  }
  const textPrimary = normalizeAiEndpoint('textPrimary', routes.textPrimary, env)
  const textFallback = normalizeAiEndpoint('textFallback', routes.textFallback, env)
  const visionPrimary = normalizeAiEndpoint('visionPrimary', routes.visionPrimary, env)
  const visionFallback = normalizeAiEndpoint('visionFallback', routes.visionFallback, env)
  return {
    mode: config.mode,
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    runtimeUrl: config.runtimeUrl || (env.AI_RUNTIME_URL || '').replace(/\/$/, ''),
    apiKeyPreview: config.apiKeyPreview,
    updatedAt: config.updatedAt,
    hasApiKey: Boolean(config.apiKeyEncrypted),
    encryptionReady: Boolean(env.AI_SETTINGS_SECRET),
    runtimeConfigured: Boolean(config.runtimeUrl || env.AI_RUNTIME_URL),
    textPrimary: publicAiEndpointConfig(env, textPrimary),
    textFallback: publicAiEndpointConfig(env, textFallback),
    visionPrimary: publicAiEndpointConfig(env, visionPrimary),
    visionFallback: publicAiEndpointConfig(env, visionFallback),
  }
}

async function getStoredAiModelConfig(env: Env) {
  const fallback = defaultAiModelConfig(env)
  const raw = await getSettingValue(env, AI_MODEL_SETTING)
  if (!raw) {
    return fallback
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAiModelConfig>
    const parsedRoutes = parsed.routes ?? {}
    return {
      ...fallback,
      ...parsed,
      mode: normalizeAiMode(parsed.mode),
      provider: normalizeAiProvider(parsed.provider),
      baseUrl: String(parsed.baseUrl || fallback.baseUrl).replace(/\/$/, ''),
      model: String(parsed.model || fallback.model),
      runtimeUrl: String(parsed.runtimeUrl || fallback.runtimeUrl).replace(/\/$/, ''),
      routes: {
        textPrimary: normalizeAiEndpoint('textPrimary', parsedRoutes.textPrimary, env),
        textFallback: normalizeAiEndpoint('textFallback', parsedRoutes.textFallback, env),
        visionPrimary: normalizeAiEndpoint('visionPrimary', parsedRoutes.visionPrimary, env),
        visionFallback: normalizeAiEndpoint('visionFallback', parsedRoutes.visionFallback, env),
      },
    }
  } catch {
    return fallback
  }
}

async function importSecretAesKey(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function encryptSettingSecret(env: Env, value: string) {
  if (!env.AI_SETTINGS_SECRET) {
    throw new Error('AI_SETTINGS_SECRET 尚未配置，无法安全保存模型 API Key。')
  }
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await importSecretAesKey(env.AI_SETTINGS_SECRET)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(value))
  return `v1.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`
}

async function decryptSettingSecret(env: Env, value: string | undefined) {
  if (!value || !env.AI_SETTINGS_SECRET) {
    return ''
  }
  const [version, ivRaw, encryptedRaw] = value.split('.')
  if (version !== 'v1' || !ivRaw || !encryptedRaw) {
    return ''
  }
  try {
    const key = await importSecretAesKey(env.AI_SETTINGS_SECRET)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(ivRaw) }, key, base64ToBytes(encryptedRaw))
    return new TextDecoder().decode(decrypted)
  } catch {
    return ''
  }
}

async function resolveAiEndpoint(env: Env, route: AiModelRouteKey) {
  const config = await getStoredAiModelConfig(env)
  const endpoint = normalizeAiEndpoint(route, config.routes?.[route], env)
  const settingKey = await decryptSettingSecret(env, endpoint.apiKeyEncrypted)
  const apiKey = settingKey || providerEnvironmentKey(env, endpoint.provider)
  return { ...endpoint, apiKey, keySource: settingKey ? 'setting' : apiKey ? 'environment' : 'missing' as const }
}

function parseAiRouteKey(value: unknown): AiModelRouteKey | null {
  return value === 'textPrimary' || value === 'textFallback' || value === 'visionPrimary' || value === 'visionFallback' ? value : null
}

function kimiTemperature(provider: AiModelProvider, model: string) {
  return provider === 'kimi' && model.includes('k2.6') ? 1 : 0.2
}

function extractGeminiText(data: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null) {
  return data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim() || ''
}

type OpenAiMessageContent = string | Array<{ type?: string; text?: string }> | null

type OpenAiCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: OpenAiMessageContent
      tool_calls?: Array<{ function?: { arguments?: string } }>
    }
  }>
}

function extractOpenAiText(data: OpenAiCompletionResponse | null) {
  const message = data?.choices?.[0]?.message
  if (typeof message?.content === 'string') {
    return message.content.trim()
  }
  if (Array.isArray(message?.content)) {
    const content = message.content.map((part) => part.text || '').join('').trim()
    if (content) {
      return content
    }
  }
  return message?.tool_calls?.map((item) => item.function?.arguments || '').join('').trim() || ''
}

async function callAiEndpointText(
  endpoint: Awaited<ReturnType<typeof resolveAiEndpoint>>,
  prompt: string,
  maxOutputTokens = 64,
  signal?: AbortSignal,
) {
  if (!endpoint.apiKey) {
    throw new Error('模型 API Key 未配置')
  }
  if (endpoint.provider === 'gemini') {
    const response = await fetch(`${endpoint.baseUrl}/models/${endpoint.model}:generateContent`, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': endpoint.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens },
      }),
    })
    const data = (await response.json().catch(() => null)) as { error?: { message?: string }; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null
    if (!response.ok || data?.error) {
      throw new Error(data?.error?.message || `模型请求失败：${response.status}`)
    }
    return extractGeminiText(data)
  }

  const response = await fetch(`${endpoint.baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      authorization: `Bearer ${endpoint.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: endpoint.model,
      temperature: kimiTemperature(endpoint.provider, endpoint.model),
      max_tokens: maxOutputTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = (await response.json().catch(() => null)) as { error?: { message?: string }; choices?: Array<{ message?: { content?: string } }> } | null
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || `模型请求失败：${response.status}`)
  }
  return extractOpenAiText(data)
}

async function callTextFallbackJson<T extends object>(env: Env, systemPrompt: string, payload: unknown, outputShape: string): Promise<T | null> {
  const endpoint = await resolveAiEndpoint(env, 'textFallback')
  if (!endpoint.apiKey) {
    return null
  }
  const prompt = `${systemPrompt}

请只返回一个 JSON 对象，不要解释，不要使用 Markdown 代码块。
JSON 字段要求：${outputShape}

输入数据：
${JSON.stringify(payload)}`
  try {
    const output = await callAiEndpointText(endpoint, prompt)
    const parsed = parseLooseJsonObject(output)
    return Object.keys(parsed).length > 0 ? (parsed as T) : null
  } catch {
    return null
  }
}

async function callAiEndpointVision(
  endpoint: Awaited<ReturnType<typeof resolveAiEndpoint>>,
  prompt: string,
  imageBase64: string,
  mimeType = 'image/png',
  maxOutputTokens = 96,
  signal?: AbortSignal,
  structuredJson = false,
) {
  if (!endpoint.apiKey) {
    throw new Error('模型 API Key 未配置')
  }
  if (endpoint.provider === 'gemini') {
    const response = await fetch(`${endpoint.baseUrl}/models/${endpoint.model}:generateContent`, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': endpoint.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
        generationConfig: {
          maxOutputTokens,
          ...(structuredJson ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    })
    const data = (await response.json().catch(() => null)) as { error?: { message?: string }; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null
    if (!response.ok || data?.error) {
      throw new Error(data?.error?.message || `识图请求失败：${response.status}`)
    }
    return extractGeminiText(data)
  }

  const outputTokenBudget = endpoint.provider === 'kimi' && endpoint.model.includes('k2.6')
    ? Math.max(maxOutputTokens, 2048)
    : maxOutputTokens
  const requestBody: Record<string, unknown> = {
    model: endpoint.model,
    temperature: kimiTemperature(endpoint.provider, endpoint.model),
    max_tokens: outputTokenBudget,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      },
    ],
  }
  if (structuredJson) {
    requestBody.response_format = { type: 'json_object' }
  }
  const response = await fetch(`${endpoint.baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      authorization: `Bearer ${endpoint.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })
  const data = (await response.json().catch(() => null)) as ({ error?: { message?: string } } & OpenAiCompletionResponse) | null
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || `识图请求失败：${response.status}`)
  }
  return extractOpenAiText(data)
}

type MultimodalAsset = {
  base64: string
  mimeType: string
}

async function callAiEndpointMultimodal(
  endpoint: Awaited<ReturnType<typeof resolveAiEndpoint>>,
  prompt: string,
  assets: MultimodalAsset[],
) {
  if (!endpoint.apiKey) {
    throw new Error('模型 API Key 未配置')
  }
  if (assets.length === 0) {
    return callAiEndpointText(endpoint, prompt)
  }
  if (endpoint.provider === 'gemini') {
    const response = await fetch(`${endpoint.baseUrl}/models/${endpoint.model}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': endpoint.apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            ...assets.map((asset) => ({ inline_data: { mime_type: asset.mimeType, data: asset.base64 } })),
          ],
        }],
        generationConfig: { maxOutputTokens: 1800, temperature: 0.2 },
      }),
    })
    const data = (await response.json().catch(() => null)) as { error?: { message?: string }; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null
    if (!response.ok || data?.error) {
      throw new Error(data?.error?.message || `识图请求失败：${response.status}`)
    }
    return extractGeminiText(data)
  }

  const imageAssets = assets.filter((asset) => asset.mimeType.startsWith('image/'))
  if (imageAssets.length === 0) {
    throw new Error('备用模型需要图片预览，当前文件没有可用预览')
  }
  const response = await fetch(`${endpoint.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${endpoint.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: endpoint.model,
      temperature: kimiTemperature(endpoint.provider, endpoint.model),
      max_tokens: 1800,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...imageAssets.map((asset) => ({ type: 'image_url', image_url: { url: `data:${asset.mimeType};base64,${asset.base64}` } })),
        ],
      }],
    }),
  })
  const data = (await response.json().catch(() => null)) as { error?: { message?: string }; choices?: Array<{ message?: { content?: string } }> } | null
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || `识图请求失败：${response.status}`)
  }
  return extractOpenAiText(data)
}

const analysisJsonArray = (value: string | null) => {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
  } catch {
    return []
  }
}

const toAttachmentAnalysis = (row: DbAttachmentAnalysis): AttachmentAnalysis => ({
  attachmentId: Number(row.attachment_id),
  taskId: Number(row.task_id),
  fileName: row.file_name,
  fileType: row.file_type || 'FILE',
  status: row.status,
  attemptCount: Number(row.attempt_count) || 0,
  parserKind: row.parser_kind || '',
  provider: row.provider || '',
  model: row.model || '',
  summary: row.summary || '',
  contentType: row.content_type || '',
  extractedText: row.extracted_text || '',
  findings: analysisJsonArray(row.findings_json),
  qualityIssues: analysisJsonArray(row.quality_issues_json),
  requirementMatches: analysisJsonArray(row.requirement_matches_json),
  risks: analysisJsonArray(row.risks_json),
  suggestions: analysisJsonArray(row.suggestions_json),
  confidence: row.confidence || '',
  errorMessage: row.error_message || '',
  requestedAt: formatBeijing(row.requested_at),
  completedAt: formatBeijing(row.completed_at),
})

type AnalysisPayload = {
  summary: string
  contentType: string
  extractedText: string
  findings: string[]
  qualityIssues: string[]
  requirementMatches: string[]
  risks: string[]
  suggestions: string[]
  confidence: '低' | '中' | '高'
}

type AnalysisSource = {
  parserKind: string
  extractedText: string
  assets: MultimodalAsset[]
}

const imageMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const officeExtensions = new Set(['pptx', 'docx', 'xlsx'])
const maxDirectAnalysisBytes = 18 * 1024 * 1024
const maxOfficeAnalysisBytes = 35 * 1024 * 1024

function decodeXmlText(value: string) {
  return value
    .replace(/<a:br\s*\/>/g, '\n')
    .replace(/<w:tab\s*\/>/g, '\t')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

async function extractOfficeSource(buffer: ArrayBuffer, extension: string): Promise<AnalysisSource> {
  const zip = await JSZip.loadAsync(buffer)
  const textPatterns =
    extension === 'pptx'
      ? [/^ppt\/slides\/slide\d+\.xml$/]
      : extension === 'docx'
        ? [/^word\/document\.xml$/, /^word\/header\d+\.xml$/, /^word\/footer\d+\.xml$/]
        : [/^xl\/sharedStrings\.xml$/, /^xl\/worksheets\/sheet\d+\.xml$/]
  const mediaPrefix = extension === 'pptx' ? 'ppt/media/' : extension === 'docx' ? 'word/media/' : 'xl/media/'
  const textEntries = Object.values(zip.files)
    .filter((entry) => !entry.dir && textPatterns.some((pattern) => pattern.test(entry.name)))
    .slice(0, 60)
  const textParts: string[] = []
  for (const entry of textEntries) {
    const text = decodeXmlText(await entry.async('text'))
    if (text) {
      textParts.push(text)
    }
  }

  const assets: MultimodalAsset[] = []
  const mediaEntries = Object.values(zip.files)
    .filter((entry) => !entry.dir && entry.name.startsWith(mediaPrefix) && /\.(png|jpe?g|webp|gif)$/i.test(entry.name))
    .slice(0, 6)
  for (const entry of mediaEntries) {
    const bytes = await entry.async('uint8array')
    if (bytes.byteLength > 4 * 1024 * 1024) {
      continue
    }
    const extensionName = entry.name.split('.').pop()?.toLowerCase()
    const mimeType = extensionName === 'jpg' || extensionName === 'jpeg' ? 'image/jpeg' : `image/${extensionName || 'png'}`
    assets.push({ base64: bytesToBase64(bytes), mimeType })
  }
  return {
    parserKind: `${extension}-xml-media`,
    extractedText: textParts.join('\n').slice(0, 24000),
    assets,
  }
}

async function r2ObjectBytes(env: Env, key: string) {
  const object = await env.UPLOADS.get(key)
  if (!object) {
    throw new Error('R2 文件不存在')
  }
  return new Uint8Array(await new Response(object.body).arrayBuffer())
}

async function buildAnalysisSource(env: Env, row: DbAttachment & { requirement: string | null }) {
  const extension = (row.file_name.split('.').pop() || row.file_type || '').toLowerCase()
  const mimeType = row.mime_type || ''
  const originalSize = Number(row.file_size) || 0

  if (imageMimeTypes.has(mimeType) || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) {
    if (originalSize > maxDirectAnalysisBytes) {
      throw new Error('图片超过 18MB，暂不进入自动识别')
    }
    const bytes = await r2ObjectBytes(env, row.r2_key)
    return {
      parserKind: 'image-direct',
      extractedText: '',
      assets: [{ base64: bytesToBase64(bytes), mimeType: mimeType || (extension === 'jpg' ? 'image/jpeg' : `image/${extension}`) }],
    } satisfies AnalysisSource
  }

  if (mimeType === 'application/pdf' || extension === 'pdf') {
    if (originalSize > maxDirectAnalysisBytes) {
      throw new Error('PDF 超过 18MB，暂不进入自动识别')
    }
    const bytes = await r2ObjectBytes(env, row.r2_key)
    return {
      parserKind: 'pdf-native',
      extractedText: '',
      assets: [{ base64: bytesToBase64(bytes), mimeType: 'application/pdf' }],
    } satisfies AnalysisSource
  }

  if (officeExtensions.has(extension)) {
    if (originalSize > maxOfficeAnalysisBytes) {
      throw new Error(`${extension.toUpperCase()} 超过 35MB，暂不进入自动识别`)
    }
    const bytes = await r2ObjectBytes(env, row.r2_key)
    return extractOfficeSource(bytes.buffer, extension)
  }

  if (row.preview_r2_key) {
    const previewBytes = await r2ObjectBytes(env, row.preview_r2_key)
    return {
      parserKind: 'uploaded-preview',
      extractedText: '',
      assets: [{ base64: bytesToBase64(previewBytes), mimeType: 'image/png' }],
    } satisfies AnalysisSource
  }

  return null
}

function normalizeAnalysisPayload(value: Record<string, unknown>): AnalysisPayload {
  const list = (key: string) => (Array.isArray(value[key]) ? (value[key] as unknown[]).map(String).filter(Boolean).slice(0, 8) : [])
  const confidence = value.confidence === '高' || value.confidence === '中' || value.confidence === '低' ? value.confidence : '中'
  return {
    summary: String(value.summary || '').trim(),
    contentType: String(value.contentType || '').trim(),
    extractedText: String(value.extractedText || '').trim().slice(0, 12000),
    findings: list('findings'),
    qualityIssues: list('qualityIssues'),
    requirementMatches: list('requirementMatches'),
    risks: list('risks'),
    suggestions: list('suggestions'),
    confidence,
  }
}

function attachmentAnalysisPrompt(
  row: DbAttachment & { requirement: string | null; supplemental_note: string | null; acceptance_note: string | null },
  source: AnalysisSource,
) {
  return `你是 Giverny 的资深设计交付件审查与工作复盘助手。请基于文件内容和站内任务事实做分析，不要编造客户反馈、交付结果或文件中不存在的信息。

任务名称：${row.task_title || '未命名任务'}
设计类型：${row.file_tag || row.file_type || '未分类'}
原始任务需求：${row.requirement || '未填写'}
补录说明：${row.supplemental_note || '无'}
验收备注：${row.acceptance_note || '未填写'}
文件名：${row.file_name}
是否终稿：${row.is_final ? '是' : '否'}
解析出的文档文字：
${source.extractedText || '无，需直接读取文件视觉内容'}

请检查：
1. 文件是什么交付件，主要内容和信息结构是什么。
2. 与原始任务需求、验收备注是否吻合，只写有依据的匹配点。
3. 版式、可读性、层级、清晰度、素材完整性、明显错漏等质量问题。
4. 对进度、交付、复用和后续效率的风险与建议。

只返回 JSON 对象，不要 Markdown：
{
  "summary": "80-160字中文总结",
  "contentType": "交付件类型",
  "extractedText": "关键文字/OCR摘要，最多1000字",
  "findings": ["内容与视觉发现"],
  "qualityIssues": ["明确质量问题，没有则空数组"],
  "requirementMatches": ["与需求吻合或不吻合的依据"],
  "risks": ["风险，没有则空数组"],
  "suggestions": ["可执行建议"],
  "confidence": "低|中|高"
}`
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function isRetryableVisionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /(high demand|temporar|429|500|502|503|504|overloaded|quota)/i.test(message)
}

async function createAttachmentAnalysisJob(env: Env, attachmentId: string, taskId: string, reset = false) {
  await env.DB.prepare(
    `INSERT INTO attachment_analyses (attachment_id, task_id, status, requested_at, updated_at)
     VALUES (?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(attachment_id) DO UPDATE SET
       status = CASE WHEN ? THEN 'pending' ELSE attachment_analyses.status END,
       attempt_count = CASE WHEN ? THEN 0 ELSE attachment_analyses.attempt_count END,
       error_message = CASE WHEN ? THEN NULL ELSE attachment_analyses.error_message END,
       parser_kind = CASE WHEN ? THEN NULL ELSE attachment_analyses.parser_kind END,
       provider = CASE WHEN ? THEN NULL ELSE attachment_analyses.provider END,
       model = CASE WHEN ? THEN NULL ELSE attachment_analyses.model END,
       summary = CASE WHEN ? THEN NULL ELSE attachment_analyses.summary END,
       content_type = CASE WHEN ? THEN NULL ELSE attachment_analyses.content_type END,
       extracted_text = CASE WHEN ? THEN NULL ELSE attachment_analyses.extracted_text END,
       findings_json = CASE WHEN ? THEN NULL ELSE attachment_analyses.findings_json END,
       quality_issues_json = CASE WHEN ? THEN NULL ELSE attachment_analyses.quality_issues_json END,
       requirement_matches_json = CASE WHEN ? THEN NULL ELSE attachment_analyses.requirement_matches_json END,
       risks_json = CASE WHEN ? THEN NULL ELSE attachment_analyses.risks_json END,
       suggestions_json = CASE WHEN ? THEN NULL ELSE attachment_analyses.suggestions_json END,
       confidence = CASE WHEN ? THEN NULL ELSE attachment_analyses.confidence END,
       completed_at = CASE WHEN ? THEN NULL ELSE attachment_analyses.completed_at END,
       requested_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE attachment_analyses.requested_at END,
       updated_at = CURRENT_TIMESTAMP`,
  ).bind(
    attachmentId,
    taskId,
    reset ? 1 : 0,
    reset ? 1 : 0,
    reset ? 1 : 0,
    reset ? 1 : 0,
    reset ? 1 : 0,
    reset ? 1 : 0,
    reset ? 1 : 0,
    reset ? 1 : 0,
    reset ? 1 : 0,
    reset ? 1 : 0,
    reset ? 1 : 0,
    reset ? 1 : 0,
    reset ? 1 : 0,
    reset ? 1 : 0,
    reset ? 1 : 0,
    reset ? 1 : 0,
    reset ? 1 : 0,
  ).run()
}

async function markAnalysisFailure(env: Env, attachmentId: string, error: unknown, unsupported = false) {
  const message = error instanceof Error ? error.message : '附件分析失败'
  await env.DB.prepare(
    `UPDATE attachment_analyses
     SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE attachment_id = ?`,
  ).bind(unsupported ? 'unsupported' : 'failed', message.slice(0, 500), attachmentId).run()
}

async function processAttachmentAnalysis(env: Env, attachmentId: string) {
  const claimed = await env.DB.prepare(
    `UPDATE attachment_analyses
     SET status = 'processing', attempt_count = attempt_count + 1, started_at = CURRENT_TIMESTAMP, error_message = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE attachment_id = ? AND (
       status = 'pending'
       OR (status = 'failed' AND attempt_count < 3)
       OR (status = 'processing' AND updated_at < datetime('now', '-20 minutes'))
     )`,
  ).bind(attachmentId).run()
  if (!claimed.success || !claimed.meta?.changes) {
    return
  }

  const row = await env.DB.prepare(
    `SELECT attachments.*, tasks.title AS task_title, tasks.requirement, tasks.supplemental_note, tasks.acceptance_note
     FROM attachments
     INNER JOIN tasks ON tasks.id = attachments.task_id
     WHERE attachments.id = ? AND attachments.deleted_at IS NULL AND tasks.deleted_at IS NULL`,
  ).bind(attachmentId).first<DbAttachment & { requirement: string | null; supplemental_note: string | null; acceptance_note: string | null }>()
  if (!row) {
    await markAnalysisFailure(env, attachmentId, new Error('附件或关联任务不存在'), true)
    return
  }

  try {
    const source = await buildAnalysisSource(env, row)
    if (!source) {
      await markAnalysisFailure(env, attachmentId, new Error(`暂不支持自动解析 ${row.file_type || '该'} 格式，上传 PNG/JPG 预览后可重新分析`), true)
      return
    }
    const prompt = attachmentAnalysisPrompt(row, source)
    let endpoint = await resolveAiEndpoint(env, 'visionPrimary')
    let output = ''
    try {
      output = await callAiEndpointMultimodal(endpoint, prompt, source.assets)
    } catch (primaryError) {
      if (isRetryableVisionError(primaryError)) {
        await wait(1500)
        try {
          output = await callAiEndpointMultimodal(endpoint, prompt, source.assets)
        } catch {
          output = ''
        }
      }
      if (!output) {
        endpoint = await resolveAiEndpoint(env, 'visionFallback')
        try {
          output = await callAiEndpointMultimodal(endpoint, prompt, source.assets)
        } catch (fallbackError) {
          const primaryMessage = primaryError instanceof Error ? primaryError.message : '主模型失败'
          const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : '备用模型失败'
          throw new Error(`主模型：${primaryMessage}；备用模型：${fallbackMessage}`, { cause: fallbackError })
        }
      }
    }
    const payload = normalizeAnalysisPayload(parseLooseJsonObject(output))
    if (!payload.summary) {
      throw new Error('模型返回内容缺少有效摘要')
    }
    await env.DB.prepare(
      `UPDATE attachment_analyses SET
        status = 'completed', parser_kind = ?, provider = ?, model = ?, summary = ?, content_type = ?,
        extracted_text = ?, findings_json = ?, quality_issues_json = ?, requirement_matches_json = ?,
        risks_json = ?, suggestions_json = ?, confidence = ?, error_message = NULL,
        completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE attachment_id = ?`,
    ).bind(
      source.parserKind,
      endpoint.provider,
      endpoint.model,
      payload.summary,
      payload.contentType,
      payload.extractedText,
      JSON.stringify(payload.findings),
      JSON.stringify(payload.qualityIssues),
      JSON.stringify(payload.requirementMatches),
      JSON.stringify(payload.risks),
      JSON.stringify(payload.suggestions),
      payload.confidence,
      attachmentId,
    ).run()
    await audit(env, 'complete', 'attachment_analysis', attachmentId, {
      provider: endpoint.provider,
      model: endpoint.model,
      parserKind: source.parserKind,
      confidence: payload.confidence,
    })
  } catch (error) {
    await markAnalysisFailure(env, attachmentId, error)
  }
}

async function processPendingAttachmentAnalyses(env: Env, limit = 2) {
  const rows = await env.DB.prepare(
    `SELECT attachment_analyses.attachment_id
     FROM attachment_analyses
     INNER JOIN attachments ON attachments.id = attachment_analyses.attachment_id
     WHERE attachments.deleted_at IS NULL
       AND (
         attachment_analyses.status = 'pending'
         OR (attachment_analyses.status = 'failed' AND attachment_analyses.attempt_count < 3)
         OR (attachment_analyses.status = 'processing' AND attachment_analyses.updated_at < datetime('now', '-20 minutes'))
       )
     ORDER BY attachment_analyses.requested_at ASC
     LIMIT ?`,
  ).bind(limit).all<{ attachment_id: string }>()
  for (const row of rows.results ?? []) {
    await processAttachmentAnalysis(env, row.attachment_id)
  }
}

type InsightTypeMetrics = {
  type: string
  taskCount: number
  acceptedCount: number
  actualHours: number
  estimatedHours: number
  cycleHours: number
  opportunityWaitHours: number
  explicitWaitingHours: number
  waitingRatioPercent: number | null
  estimateVariancePercent: number | null
  revisionSignals: number
  revisionSignalsPerTask: number | null
  weightedHourlyRate: number | null
  averageCycleDays: number | null
  deliveryRiskCount: number
  attachmentQualityIssueCount: number
  feedbackIssueCount: number
  feedbackRatings: Record<string, number>
  feedbackTags: Record<string, number>
}

type InsightDiagnosisResult = Omit<InsightDiagnosis, 'generatedAt'>

type InsightEventTrigger = {
  insightType: InsightHistoryItem['insightType']
  triggerKey: string
  finding: string
  recommendationHint: string
  dataSnapshot: Record<string, unknown>
  severity: 'low' | 'medium' | 'high'
}

type InsightDataSet = {
  tasks: DbTask[]
  updatesByTask: Map<string, DbUpdate[]>
  analysesByTask: Map<string, DbAttachmentAnalysis[]>
}

function dateKey(value: Date) {
  return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`
}

function beijingNowDate() {
  return new Date(Date.now() + 8 * 3_600_000)
}

function monthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, monthNumber - 1, 1))
  const end = new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999))
  return { start: dateKey(start), end: dateKey(end) }
}

function monthOffset(month: string, offset: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`
}

function insightDateRange(period: InsightPeriodType, month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const now = beijingNowDate()
  const anchorYear = Number.isFinite(year) ? year : now.getUTCFullYear()
  const anchorMonth = Number.isFinite(monthNumber) ? monthNumber - 1 : now.getUTCMonth()
  let start: Date
  let end: Date
  if (period === 'day') {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    end = new Date(start.getTime() + 86400000 - 1)
  } else if (period === 'week') {
    const mondayOffset = (now.getUTCDay() + 6) % 7
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - mondayOffset))
    end = new Date(start.getTime() + 7 * 86400000 - 1)
  } else if (period === 'month') {
    start = new Date(Date.UTC(anchorYear, anchorMonth, 1))
    end = new Date(Date.UTC(anchorYear, anchorMonth + 1, 0, 23, 59, 59, 999))
  } else if (period === 'quarter') {
    const quarterMonth = Math.floor(anchorMonth / 3) * 3
    start = new Date(Date.UTC(anchorYear, quarterMonth, 1))
    end = new Date(Date.UTC(anchorYear, quarterMonth + 3, 0, 23, 59, 59, 999))
  } else if (period === 'half') {
    const halfMonth = anchorMonth < 6 ? 0 : 6
    start = new Date(Date.UTC(anchorYear, halfMonth, 1))
    end = new Date(Date.UTC(anchorYear, halfMonth + 6, 0, 23, 59, 59, 999))
  } else {
    start = new Date(Date.UTC(anchorYear, 0, 1))
    end = new Date(Date.UTC(anchorYear, 11, 31, 23, 59, 59, 999))
  }
  const previousEnd = new Date(start.getTime() - 1)
  const previousStart = new Date(previousEnd.getTime() - (end.getTime() - start.getTime()))
  return {
    current: { start: dateKey(start), end: dateKey(end) },
    previous: { start: dateKey(previousStart), end: dateKey(previousEnd) },
  }
}

function inDateRange(value: string | null | undefined, range: { start: string; end: string }) {
  const date = String(value || '').slice(0, 10)
  return Boolean(date && date >= range.start && date <= range.end)
}

function entryMinuteStamp(dateValue: string | undefined, timeValue: string | undefined) {
  const dateMatch = String(dateValue || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const timeMatch = String(timeValue || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!dateMatch || !timeMatch) {
    return Number.NaN
  }
  const [, year, month, day] = dateMatch.map(Number)
  const [, hour, minute] = timeMatch.map(Number)
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return Number.NaN
  }
  return Math.round(Date.UTC(year, month - 1, day, hour, minute) / 60000)
}

function dateFromMinuteStamp(stamp: number) {
  return Number.isFinite(stamp) ? new Date(stamp * 60000).toISOString().slice(0, 10) : ''
}

function entryBounds(entry: Pick<TimeEntry, 'date' | 'endDate' | 'start' | 'end'>, fallbackDate?: string | null) {
  const startDate = entry.date || String(fallbackDate || '').slice(0, 10)
  const endDate = entry.endDate || entry.date || startDate
  const start = entryMinuteStamp(startDate, entry.start)
  const end = entryMinuteStamp(endDate, entry.end)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null
  }
  return { start, end }
}

function taskLifecycleBounds(task: DbTask) {
  if (task.status === '计划中') {
    return null
  }
  const entries = parseTimeEntries(task.time_entries_json)
    .map((entry) => ({ entry, bounds: entryBounds(entry, task.start_date) }))
    .filter((item): item is { entry: TimeEntry; bounds: { start: number; end: number } } => Boolean(item.bounds))
  if (entries.length === 0) {
    return null
  }
  const start = Math.min(...entries.map((item) => item.bounds.start))
  const acceptanceEntries = entries.filter((item) => item.entry.isAcceptanceProgress)
  const endSource = acceptanceEntries.length > 0 ? acceptanceEntries : entries
  const end = Math.max(...endSource.map((item) => item.bounds.end))
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null
  }
  return {
    start,
    end,
    hours: Math.round(((end - start) / 60) * 100) / 100,
    startDate: dateFromMinuteStamp(start),
    endDate: dateFromMinuteStamp(end),
  }
}

function taskInsightDate(task: DbTask) {
  if (task.status === '计划中') {
    return ''
  }
  return taskLifecycleBounds(task)?.endDate || task.start_date || (task.settlement_month ? `${task.settlement_month}-01` : '')
}

function taskCycleDays(task: DbTask) {
  const lifecycle = taskLifecycleBounds(task)
  if (!lifecycle) {
    return null
  }
  return Math.max(1, Math.round((lifecycle.end - lifecycle.start) / 1440))
}

function entriesHours(entries: TimeEntry[], fallbackDate?: string | null) {
  const minutes = entries.reduce((sum, entry) => {
    const bounds = entryBounds(entry, fallbackDate)
    return sum + (bounds ? Math.max(0, bounds.end - bounds.start) : 0)
  }, 0)
  return Math.round((minutes / 60) * 100) / 100
}

function parseAnalysisItems(value: string | null) {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function loadInsightData(env: Env): Promise<InsightDataSet> {
  const [taskRows, updateRows, analysisRows] = await Promise.all([
    env.DB.prepare("SELECT * FROM tasks WHERE deleted_at IS NULL AND voided_at IS NULL AND is_billable = 1").all<DbTask>(),
    env.DB.prepare(`SELECT task_updates.* FROM task_updates INNER JOIN tasks ON tasks.id = task_updates.task_id WHERE tasks.deleted_at IS NULL AND tasks.voided_at IS NULL`).all<DbUpdate>(),
    env.DB.prepare(`SELECT attachment_analyses.* FROM attachment_analyses INNER JOIN attachments ON attachments.id = attachment_analyses.attachment_id INNER JOIN tasks ON tasks.id = attachment_analyses.task_id WHERE attachments.deleted_at IS NULL AND tasks.deleted_at IS NULL AND tasks.voided_at IS NULL AND attachment_analyses.status = 'completed'`).all<DbAttachmentAnalysis>(),
  ])
  const updatesByTask = new Map<string, DbUpdate[]>()
  for (const update of updateRows.results ?? []) {
    updatesByTask.set(update.task_id, [...(updatesByTask.get(update.task_id) ?? []), update])
  }
  const analysesByTask = new Map<string, DbAttachmentAnalysis[]>()
  for (const analysis of analysisRows.results ?? []) {
    analysesByTask.set(analysis.task_id, [...(analysesByTask.get(analysis.task_id) ?? []), analysis])
  }
  return { tasks: taskRows.results ?? [], updatesByTask, analysesByTask }
}

function aggregateInsightMetrics(source: DbTask[], dataSet: Pick<InsightDataSet, 'updatesByTask' | 'analysesByTask'>): InsightTypeMetrics[] {
  const groups = new Map<string, DbTask[]>()
  for (const task of source.filter((item) => item.status !== '计划中')) {
    const type = task.design_type || '未分类'
    groups.set(type, [...(groups.get(type) ?? []), task])
  }
  return [...groups.entries()].map(([type, items]) => {
    const actualHours = items.reduce((sum, task) => sum + (Number(task.actual_hours) || 0), 0)
    const estimatedHours = items.reduce((sum, task) => sum + (Number(task.estimated_hours) || 0), 0)
    const cycleHours = items.reduce((sum, task) => sum + (taskLifecycleBounds(task)?.hours ?? 0), 0)
    const explicitWaitingHours = items.reduce((sum, task) => sum + entriesHours(parseWaitingEntries(task.waiting_entries_json), task.start_date), 0)
    const opportunityWaitHours = explicitWaitingHours
    const revisionSignals = items.reduce(
      (sum, task) => sum + (dataSet.updatesByTask.get(task.id) ?? []).filter((update) => /修改|调整|改稿|反馈|返工|revision/i.test(`${update.title} ${update.body}`)).length,
      0,
    )
    const cycles = items.map(taskCycleDays).filter((value): value is number => value !== null)
    const analyses = items.flatMap((task) => dataSet.analysesByTask.get(task.id) ?? [])
    const attachmentQualityIssueCount = analyses.reduce((sum, analysis) => sum + parseAnalysisItems(analysis.quality_issues_json).length, 0)
    const feedbackRatings = items.reduce<Record<string, number>>((map, task) => {
      const rating = normalizeFeedbackRating(task.feedback_rating)
      if (rating) {
        map[rating] = (map[rating] ?? 0) + 1
      }
      return map
    }, {})
    const feedbackTagsByType = items.reduce<Record<string, number>>((map, task) => {
      parseFeedbackTags(task.feedback_tags_json).forEach((tag) => {
        map[tag] = (map[tag] ?? 0) + 1
      })
      return map
    }, {})
    const deliveryRiskCount =
      analyses.reduce((sum, analysis) => sum + parseAnalysisItems(analysis.risks_json).length, 0) +
      items.filter((task) => task.status !== '已验收' && Boolean(task.estimated_delivery_date) && task.estimated_delivery_date! < nowIso()).length
    return {
      type,
      taskCount: items.length,
      acceptedCount: items.filter((task) => task.status === '已验收').length,
      actualHours: Number(actualHours.toFixed(1)),
      estimatedHours: Number(estimatedHours.toFixed(1)),
      cycleHours: Number(cycleHours.toFixed(1)),
      opportunityWaitHours: Number(opportunityWaitHours.toFixed(1)),
      explicitWaitingHours: Number(explicitWaitingHours.toFixed(1)),
      waitingRatioPercent: explicitWaitingHours > 0 ? Math.round((explicitWaitingHours / Math.max(actualHours + explicitWaitingHours, explicitWaitingHours)) * 100) : 0,
      estimateVariancePercent: estimatedHours > 0 ? Math.round(((actualHours - estimatedHours) / estimatedHours) * 100) : null,
      revisionSignals,
      revisionSignalsPerTask: items.length > 0 ? Number((revisionSignals / items.length).toFixed(2)) : null,
      weightedHourlyRate: actualHours > 0 ? Number((items.reduce((sum, task) => sum + (Number(task.actual_hours) || 0) * (Number(task.hourly_rate) || 0), 0) / actualHours).toFixed(2)) : null,
      averageCycleDays: cycles.length > 0 ? Number(average(cycles).toFixed(1)) : null,
      deliveryRiskCount,
      attachmentQualityIssueCount,
      feedbackIssueCount: (feedbackRatings['一般'] ?? 0) + (feedbackRatings['有问题'] ?? 0),
      feedbackRatings,
      feedbackTags: feedbackTagsByType,
    }
  }).sort((left, right) => right.actualHours - left.actualHours || right.taskCount - left.taskCount)
}

async function fingerprintInsightData(value: unknown) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(value)))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function normalizeInsightDiagnosis(value: Record<string, unknown>, periodKey: string, periodType: InsightPeriodType, comparedWith: string): InsightDiagnosisResult {
  const rawInsights = Array.isArray(value.insights) ? value.insights : []
  const insights = rawInsights
    .map((item, index) => {
      const record = typeof item === 'object' && item ? item as Record<string, unknown> : {}
      const signal = String(record.signal || '').trim()
      const evidence = String(record.evidence || '').trim()
      const action = String(record.action || '').trim()
      const key = String(record.key || `signal-${index + 1}`).trim().slice(0, 80)
      const state = record.state === 'persisting' || record.state === 'improved' ? record.state : 'new'
      return signal && evidence && action ? { key, signal, evidence, action, state } : null
    })
    .filter((item): item is InsightDiagnosis['insights'][number] => Boolean(item))
    .slice(0, 5)
  const dataNotes = Array.isArray(value.dataNotes) ? value.dataNotes.map(String).filter(Boolean).slice(0, 4) : []
  return { periodKey, periodType, status: insights.length > 0 ? 'anomalies' : 'clear', comparedWith, insights, dataNotes }
}

function normalizeInsightHistoryStatus(value: unknown): InsightHistoryStatus {
  return value === 'improved' || value === 'resolved' || value === 'ignored' ? value : 'open'
}

function toInsightHistoryItem(row: DbInsightHistory): InsightHistoryItem {
  try {
    const parsed = JSON.parse(row.data_snapshot || '{}')
    const dataSnapshot = typeof parsed === 'object' && parsed ? parsed as Record<string, unknown> : {}
    return {
      id: row.id,
      generatedAt: formatBeijing(row.generated_at),
      insightType: row.insight_type,
      finding: row.finding,
      recommendation: row.recommendation,
      dataSnapshot,
      status: normalizeInsightHistoryStatus(row.status),
      triggerKey: row.trigger_key ?? '',
    }
  } catch {
    return {
      id: row.id,
      generatedAt: formatBeijing(row.generated_at),
      insightType: row.insight_type,
      finding: row.finding,
      recommendation: row.recommendation,
      dataSnapshot: {},
      status: normalizeInsightHistoryStatus(row.status),
      triggerKey: row.trigger_key ?? '',
    }
  }
}

function classifyInsightType(signal: string, action: string): InsightHistoryItem['insightType'] {
  const text = `${signal} ${action}`
  if (/时薪|价格|报价|低于均值|客户价值|需求人|对接人/.test(text)) {
    return 'pricing'
  }
  if (/空缺|缺少|拓展|闲置|类型/.test(text)) {
    return 'gap'
  }
  if (/客户|需求人|对接人|沟通|修改|反馈|返工/.test(text)) {
    return 'client'
  }
  return 'efficiency'
}

async function insertInsightHistory(env: Env, item: Omit<InsightHistoryItem, 'id' | 'generatedAt'> & { triggerFingerprint?: string }) {
  await env.DB.prepare(
    `INSERT INTO insights_history (id, insight_type, finding, recommendation, data_snapshot, status, trigger_key, trigger_fingerprint)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      item.insightType,
      item.finding.slice(0, 240),
      item.recommendation.slice(0, 500),
      JSON.stringify(item.dataSnapshot),
      item.status,
      item.triggerKey,
      item.triggerFingerprint ?? '',
    )
    .run()
}

async function saveDiagnosisToHistory(env: Env, diagnosis: InsightDiagnosisResult, metricPayload: Record<string, unknown>, fingerprint: string) {
  if (diagnosis.insights.length === 0) {
    return
  }
  const existingRows = await env.DB.prepare('SELECT * FROM insights_history WHERE trigger_key LIKE ? ORDER BY generated_at DESC LIMIT 20')
    .bind(`manual:${diagnosis.periodType}:${diagnosis.periodKey}:%`)
    .all<DbInsightHistory>()
  const existingKeys = new Set((existingRows.results ?? []).map((row) => row.trigger_key))
  await Promise.all(diagnosis.insights.map(async (insight) => {
    const triggerKey = `manual:${diagnosis.periodType}:${diagnosis.periodKey}:${insight.key}`
    if (existingKeys.has(triggerKey)) {
      return
    }
    await insertInsightHistory(env, {
      insightType: classifyInsightType(insight.signal, insight.action),
      finding: insight.signal,
      recommendation: insight.action,
      dataSnapshot: {
        evidence: insight.evidence,
        state: insight.state,
        periodKey: diagnosis.periodKey,
        periodType: diagnosis.periodType,
        comparedWith: diagnosis.comparedWith,
        metrics: metricPayload,
      },
      status: insight.state === 'improved' ? 'improved' : 'open',
      triggerKey,
      triggerFingerprint: fingerprint,
    })
  }))
}

async function getInsightHistory(env: Env) {
  const rows = await env.DB.prepare('SELECT * FROM insights_history ORDER BY generated_at DESC LIMIT 40').all<DbInsightHistory>()
  return ok((rows.results ?? []).map(toInsightHistoryItem))
}

function findMetric(metrics: InsightTypeMetrics[], type: string) {
  return metrics.find((item) => item.type === type)
}

function monthTasks(dataSet: InsightDataSet, month: string) {
  const range = monthRange(month)
  return dataSet.tasks.filter((task) => inDateRange(taskInsightDate(task), range))
}

function taskMonthValue(task: DbTask) {
  return monthPart(taskInsightDate(task))
}

function buildInsightEventTriggers(dataSet: InsightDataSet, month: string): InsightEventTrigger[] {
  const currentMonth = month
  const previousMonth = monthOffset(month, -1)
  const currentTasks = monthTasks(dataSet, currentMonth)
  const previousTasks = monthTasks(dataSet, previousMonth)
  const currentMetrics = aggregateInsightMetrics(currentTasks, dataSet)
  const previousMetrics = aggregateInsightMetrics(previousTasks, dataSet)
  const historicalMetrics = aggregateInsightMetrics(dataSet.tasks.filter((task) => taskMonthValue(task) < currentMonth), dataSet)
  const triggers: InsightEventTrigger[] = []

  for (const current of currentMetrics) {
    const previous = findMetric(previousMetrics, current.type)
    const baseline = findMetric(historicalMetrics, current.type)
    if (current.taskCount >= 3 && (current.revisionSignalsPerTask ?? 0) > 2 && (!baseline || (current.revisionSignalsPerTask ?? 0) > (baseline.revisionSignalsPerTask ?? 0) * 1.25)) {
      triggers.push({
        insightType: 'client',
        triggerKey: `revision:${current.type}`,
        finding: `${current.type} 修改信号偏高`,
        recommendationHint: '检查接单前需求锁定、尺寸确认、色板确认或客户反馈入口是否前置。',
        severity: (current.revisionSignalsPerTask ?? 0) >= 3 ? 'high' : 'medium',
        dataSnapshot: { currentMonth, previousMonth, current, previous, historicalBaseline: baseline ?? null },
      })
    }
    if (
      current.acceptedCount >= 2 &&
      (current.waitingRatioPercent ?? 0) >= 70 &&
      current.opportunityWaitHours >= 12 &&
      (!baseline || (current.waitingRatioPercent ?? 0) > ((baseline.waitingRatioPercent ?? 0) + 10))
    ) {
      triggers.push({
        insightType: 'efficiency',
        triggerKey: `waiting-ratio:${current.type}`,
        finding: `${current.type} 等待占比偏高`,
        recommendationHint: '复盘该类型任务是否经常等待甲方确认、资料补齐或反馈排期；下次接单时提前约定反馈时限，或把长等待任务拆成阶段交付。',
        severity: (current.waitingRatioPercent ?? 0) >= 85 ? 'high' : 'medium',
        dataSnapshot: { currentMonth, previousMonth, current, previous, historicalBaseline: baseline ?? null },
      })
    }
  }

  const currentHours = currentMetrics.reduce((sum, item) => sum + item.actualHours, 0)
  const previousHours = previousMetrics.reduce((sum, item) => sum + item.actualHours, 0)
  if (previousHours >= 8 && currentHours < previousHours * 0.8) {
    triggers.push({
      insightType: 'efficiency',
      triggerKey: 'hours-drop',
      finding: '本月实际工时较上月明显下降',
      recommendationHint: '判断是接单量减少、任务未及时记录，还是任务类型结构变化导致投入下降。',
      severity: currentHours < previousHours * 0.65 ? 'high' : 'medium',
      dataSnapshot: { currentMonth, previousMonth, currentHours: Number(currentHours.toFixed(1)), previousHours: Number(previousHours.toFixed(1)), dropPercent: Math.round((1 - currentHours / previousHours) * 100), currentByType: currentMetrics, previousByType: previousMetrics },
    })
  }

  const requesters = [...new Set(dataSet.tasks.map((task) => task.requester || '').filter(Boolean))]
  const historicalRatedTasks = dataSet.tasks.filter((task) => (Number(task.actual_hours) || 0) > 0 && (Number(task.hourly_rate) || 0) > 0)
  const globalHourlyRate =
    historicalRatedTasks.reduce((sum, task) => sum + (Number(task.actual_hours) || 0) * (Number(task.hourly_rate) || 0), 0) /
    Math.max(1, historicalRatedTasks.reduce((sum, task) => sum + (Number(task.actual_hours) || 0), 0))
  for (const requester of requesters) {
    const rateForMonth = (targetMonth: string) => {
      const items = monthTasks(dataSet, targetMonth).filter((task) => (task.requester || '') === requester && (Number(task.actual_hours) || 0) > 0)
      const hours = items.reduce((sum, task) => sum + (Number(task.actual_hours) || 0), 0)
      const rate = hours > 0 ? items.reduce((sum, task) => sum + (Number(task.actual_hours) || 0) * (Number(task.hourly_rate) || 0), 0) / hours : null
      return { taskCount: items.length, hours: Number(hours.toFixed(1)), rate: rate === null ? null : Number(rate.toFixed(2)) }
    }
    const current = rateForMonth(currentMonth)
    const previous = rateForMonth(previousMonth)
    if ((current.rate ?? globalHourlyRate) < globalHourlyRate * 0.9 && (previous.rate ?? globalHourlyRate) < globalHourlyRate * 0.9 && current.taskCount > 0 && previous.taskCount > 0) {
      triggers.push({
        insightType: 'pricing',
        triggerKey: `requester-rate:${requester}`,
        finding: `${requester} 的任务综合时薪连续低于均值`,
        recommendationHint: '评估该需求人的需求决策成本、修改风险和报价结构，必要时提高报价或限制低价值任务占比。',
        severity: (current.rate ?? 0) < globalHourlyRate * 0.75 ? 'high' : 'medium',
        dataSnapshot: { currentMonth, previousMonth, requester, current, previous, baselineHourlyRate: Number(globalHourlyRate.toFixed(2)) },
      })
    }
    const currentRequesterTasks = monthTasks(dataSet, currentMonth).filter((task) => (task.requester || '') === requester)
    const subjectiveIssues = currentRequesterTasks
      .filter((task) => normalizeFeedbackRating(task.feedback_rating) === '一般' || normalizeFeedbackRating(task.feedback_rating) === '有问题')
    const tagCounts = subjectiveIssues.reduce<Record<string, number>>((map, task) => {
      parseFeedbackTags(task.feedback_tags_json).forEach((tag) => {
        map[tag] = (map[tag] ?? 0) + 1
      })
      return map
    }, {})
    const dominantTag = Object.entries(tagCounts).sort((left, right) => right[1] - left[1])[0]
    if (subjectiveIssues.length >= 2 && dominantTag) {
      triggers.push({
        insightType: 'client',
        triggerKey: `feedback-requester:${requester}:${dominantTag[0]}`,
        finding: `${requester} 的任务主观反馈集中在「${dominantTag[0]}」`,
        recommendationHint: '复盘该需求人的需求输入、决策路径和报价边界，把体感问题转成下次接单前的明确约束。',
        severity: subjectiveIssues.length >= 3 || dominantTag[1] >= 3 ? 'high' : 'medium',
        dataSnapshot: { currentMonth, requester, issueTaskCount: subjectiveIssues.length, tagCounts, tasks: subjectiveIssues.map((task) => ({ id: task.id, title: task.title, type: task.design_type, rating: task.feedback_rating, tags: parseFeedbackTags(task.feedback_tags_json), note: task.feedback_note ?? '' })) },
      })
    }
  }

  const typeLastMonths = new Map<string, string>()
  for (const task of dataSet.tasks) {
    const type = task.design_type || '未分类'
    const value = taskMonthValue(task)
    if (value && (!typeLastMonths.has(type) || value > typeLastMonths.get(type)!)) {
      typeLastMonths.set(type, value)
    }
  }
  const threeMonthsAgo = monthOffset(currentMonth, -3)
  for (const [type, lastMonth] of typeLastMonths.entries()) {
    const historical = findMetric(historicalMetrics, type)
    if (lastMonth <= threeMonthsAgo && historical && historical.taskCount >= 2) {
      triggers.push({
        insightType: 'gap',
        triggerKey: `type-gap:${type}`,
        finding: `${type} 已超过 3 个月没有新任务`,
        recommendationHint: '判断这是自然淡季、客户需求断层，还是该能力没有被主动展示；必要时补作品样例或主动推荐。',
        severity: 'low',
        dataSnapshot: { currentMonth, type, lastTaskMonth: lastMonth, historicalBaseline: historical },
      })
    }
  }

  return triggers.sort((left, right) => {
    const weight = { high: 3, medium: 2, low: 1 }
    return weight[right.severity] - weight[left.severity]
  }).slice(0, 6)
}

function normalizeEventInsight(value: Record<string, unknown>, trigger: InsightEventTrigger): Pick<InsightHistoryItem, 'finding' | 'recommendation' | 'status'> {
  const finding = String(value.finding || trigger.finding).trim().slice(0, 240)
  const recommendation = String(value.recommendation || trigger.recommendationHint).trim().slice(0, 500)
  return {
    finding: finding || trigger.finding,
    recommendation: recommendation || trigger.recommendationHint,
    status: normalizeInsightHistoryStatus(value.status),
  }
}

async function runEventDrivenInsights(env: Env, limit = 2) {
  const dataSet = await loadInsightData(env)
  const currentMonth = dateKey(beijingNowDate()).slice(0, 7)
  const triggers = buildInsightEventTriggers(dataSet, currentMonth)
  let created = 0
  for (const trigger of triggers) {
    if (created >= limit) {
      break
    }
    const fingerprint = await fingerprintInsightData(trigger.dataSnapshot)
    const previousRows = await env.DB.prepare('SELECT * FROM insights_history WHERE trigger_key = ? ORDER BY generated_at DESC LIMIT 3')
      .bind(trigger.triggerKey)
      .all<DbInsightHistory>()
    const latest = previousRows.results?.[0]
    if (latest?.trigger_fingerprint === fingerprint) {
      continue
    }
    const previousAdvice = (previousRows.results ?? []).map((row) => ({
      generatedAt: row.generated_at,
      finding: row.finding,
      recommendation: row.recommendation,
      status: row.status,
      dataSnapshot: row.data_snapshot,
    }))
    const prompt = [
      '你是 Giverny 的事件型洞察顾问。当前 SQL 规则已经确认出现异常，你只负责基于数据变化生成专项洞察。',
      '硬规则：1. 不写正面总结；2. 不重复上次建议，而是评估上次建议是否改善；3. 只能引用输入数据；4. 计划中和系统流水时间不算真实生命周期；5. 等待只能来自显式等待记录，不得用自然日差推断；6. 返回一个简短 finding 和一个具体 recommendation。',
      'status 规则：仍未改善为 open；轻微改善但未回到基线为 improved；已经回到基线或异常消失为 resolved。',
      '只返回 JSON：{"finding":"本次发现","recommendation":"具体动作","status":"open|improved|resolved"}',
      `事件触发：${JSON.stringify(trigger)}`,
      `历史追踪：${JSON.stringify(previousAdvice)}`,
    ].join('\n\n')
    let output: string
    try {
      output = await callAiEndpointText(await resolveAiEndpoint(env, 'textPrimary'), prompt, 900)
    } catch {
      output = await callAiEndpointText(await resolveAiEndpoint(env, 'textFallback'), prompt, 900)
    }
    const insight = normalizeEventInsight(parseLooseJsonObject(output), trigger)
    if (insight.status === 'resolved') {
      await env.DB.prepare("UPDATE insights_history SET status = 'resolved' WHERE trigger_key = ? AND status IN ('open', 'improved')")
        .bind(trigger.triggerKey)
        .run()
    }
    await insertInsightHistory(env, {
      insightType: trigger.insightType,
      finding: insight.finding,
      recommendation: insight.recommendation,
      dataSnapshot: trigger.dataSnapshot,
      status: insight.status,
      triggerKey: trigger.triggerKey,
      triggerFingerprint: fingerprint,
    })
    created += 1
  }
  return created
}

async function diagnoseInsights(env: Env, request: Request) {
  const body = (await request.json().catch(() => ({}))) as { month?: string; period?: InsightPeriodType }
  const period: InsightPeriodType = ['day', 'week', 'month', 'quarter', 'half', 'year'].includes(String(body.period)) ? body.period as InsightPeriodType : 'month'
  const month = /^\d{4}-\d{2}$/.test(String(body.month)) ? String(body.month) : monthPart(nowIso())
  const ranges = insightDateRange(period, month)
  const periodKey = `${ranges.current.start}_${ranges.current.end}`
  const comparedWith = `${ranges.previous.start} 至 ${ranges.previous.end}`
  const [dataSet, previousRows, historyRows] = await Promise.all([
    loadInsightData(env),
    env.DB.prepare('SELECT * FROM insight_diagnoses WHERE period_type = ? ORDER BY created_at DESC LIMIT 6').bind(period).all<DbInsightDiagnosis>(),
    env.DB.prepare("SELECT * FROM insights_history WHERE status IN ('open', 'improved') ORDER BY generated_at DESC LIMIT 16").all<DbInsightHistory>(),
  ])
  const tasks = dataSet.tasks
  const currentTasks = tasks.filter((task) => inDateRange(taskInsightDate(task), ranges.current))
  const previousTasks = tasks.filter((task) => inDateRange(taskInsightDate(task), ranges.previous))
  const currentIds = new Set(currentTasks.map((task) => task.id))
  const metricPayload = {
    currentPeriod: { key: periodKey, range: ranges.current, byType: aggregateInsightMetrics(currentTasks, dataSet) },
    previousPeriod: { range: ranges.previous, byType: aggregateInsightMetrics(previousTasks, dataSet) },
    historicalBaseline: { byType: aggregateInsightMetrics(tasks.filter((task) => !currentIds.has(task.id)), dataSet) },
    definitions: {
      lifecycleRule: '计划中不计入任务真实生命周期。真实生命周期只从进入进行中后的有效分段进展开始，到验收进展的时间段结束；补录任务的系统更新/创建/验收流水时间只是审计日志，不代表真实执行或交付时间。',
      revisionSignals: '进展记录标题或内容含修改、调整、改稿、反馈、返工或 revision 的次数；这是可追溯代理指标，不等于人工确认的精确修改轮次。',
      weightedHourlyRate: '按任务实际工时加权的任务结算时薪；若任务均使用同一费率，该指标不会产生可用差异。',
      feedbackRatings: '验收时设计师主观体感：顺利、一般、有问题；这是客观工时无法覆盖的痛苦度信号。',
      feedbackTags: '验收时设计师可选原因标签：需求不清晰、沟通成本高、定价偏低、技术挑战大。',
      feedbackNote: '验收时设计师填写的主观体感评价，用于补充等待、沟通、返工等客观字段无法表达的背景。',
      cycleHours: '基于分段进展计时推导的真实执行生命周期小时，排除计划中阶段和系统补录/编辑流水时间；优先以验收进展作为结束点。',
      opportunityWaitHours: '显式等待小时，等同于设计师手动记录的等待/非计费时间；不得用自然日周期减计费工时推断等待。',
      explicitWaitingHours: '设计师手动记录的等待/非计费时间段，例如等待甲方意见、等待资料、等待确认；不进入结算工时。',
      waitingRatioPercent: '显式等待小时占（计费工时 + 显式等待小时）的百分比。没有等待记录时为 0，不能推断为长等待。',
    },
  }
  const fingerprint = await fingerprintInsightData(metricPayload)
  const latest = previousRows.results?.[0]
  if (latest?.period_key === periodKey && latest.data_fingerprint === fingerprint) {
    try {
      const saved = JSON.parse(latest.result_json) as InsightDiagnosisResult
      return ok({ ...saved, generatedAt: formatBeijing(latest.created_at) })
    } catch {
      // Rebuild a corrupt historical response instead of returning a partial diagnosis.
    }
  }
  const diagnosisAdvice = (previousRows.results ?? []).flatMap((row) => {
    try {
      const result = JSON.parse(row.result_json) as InsightDiagnosisResult
      return result.insights.map((insight) => ({ periodKey: row.period_key, key: insight.key, signal: insight.signal, action: insight.action, state: insight.state }))
    } catch {
      return []
    }
  }).slice(0, 18)
  const trackedAdvice = (historyRows.results ?? []).map((row) => ({
    generatedAt: row.generated_at,
    insightType: row.insight_type,
    finding: row.finding,
    recommendation: row.recommendation,
    status: row.status,
    dataSnapshot: row.data_snapshot,
  }))
  const previousAdvice = { trackedHistory: trackedAdvice, recentDiagnoses: diagnosisAdvice }
  const prompt = [
    '你是 Giverny 的经营与交付数据侦探，不是汇报员。你的任务是找异常、找矛盾、找被忽略且可行动的问题。',
    '硬规则：1. 禁止“整体表现良好”“继续保持”等正面总结，直接进入异常；没有明显异常时只返回 status 为 clear 和 dataNotes，不要凑字数。',
    '2. 每条 insight 必须同时包含异常信号、明确数据证据和一个可执行动作；没有三者不得输出。',
    '3. 只能引用输入数据中的数值和事实，不能编造客户反馈、利润、修改轮次或附件内容。',
    '4. 修改信号是进展文案代理指标，不得写成精确人工修改轮次。',
    '5. 不得重复历史诊断记忆里已经出现的建议，除非当前数据证明该问题仍未解决；此时 state 必须为 persisting。若数据表明改善，state 为 improved 且动作改为巩固或停止措施。',
    '6. 计划中阶段不是执行周期；系统更新、创建、确认验收流水只用于审计，尤其补录任务不能用这些时间推断真实开始或交付。',
    '7. 等待只能来自 explicitWaitingHours / waiting_entries_json；没有等待记录时不得用自然日差、cycleHours - actualHours 或交付跨度推断等待。',
    '8. 最多输出 5 条，优先输出变化幅度大、与历史基线矛盾、交付风险或质量风险。',
    '只返回 JSON：{"status":"anomalies|clear","insights":[{"key":"稳定短键","signal":"异常信号","evidence":"含当前/上期/历史对照的具体数据","action":"一个可执行动作","state":"new|persisting|improved"}],"dataNotes":["数据不足或口径提醒"]}',
    `当前对照数据：${JSON.stringify(metricPayload)}`,
    `历史诊断记忆：${JSON.stringify(previousAdvice)}`,
  ].join('\n\n')
  let output: string
  try {
    output = await callAiEndpointText(await resolveAiEndpoint(env, 'textPrimary'), prompt, 1800)
  } catch {
    try {
      output = await callAiEndpointText(await resolveAiEndpoint(env, 'textFallback'), prompt, 1800)
    } catch (error) {
      return fail(error instanceof Error ? `洞察诊断暂不可用：${error.message}` : '洞察诊断暂不可用', 502)
    }
  }
  const diagnosis = normalizeInsightDiagnosis(parseLooseJsonObject(output), periodKey, period, comparedWith)
  await env.DB.prepare('INSERT INTO insight_diagnoses (id, period_key, period_type, data_fingerprint, result_json) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), periodKey, period, fingerprint, JSON.stringify(diagnosis)).run()
  await saveDiagnosisToHistory(env, diagnosis, metricPayload, fingerprint)
  await audit(env, 'create', 'insight_diagnosis', periodKey, { period, insightCount: diagnosis.insights.length, fingerprint })
  return ok({ ...diagnosis, generatedAt: formatBeijing(nowIso()) })
}

function maskApiKey(value: string) {
  const trimmed = value.trim()
  if (trimmed.length <= 8) {
    return '已保存'
  }
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`
}

async function getAiModelConfig(env: Env) {
  return ok(publicAiModelConfig(env, await getStoredAiModelConfig(env)))
}

async function testAiModelRoute(env: Env, request: Request) {
  const body = (await request.json().catch(() => ({}))) as { route?: string; capability?: string }
  const route = parseAiRouteKey(body.route)
  if (!route) {
    return fail('未知的模型路由')
  }
  const capability = body.capability === 'vision' ? 'vision' : 'text'
  if (capability === 'vision' && route !== 'visionPrimary' && route !== 'visionFallback') {
    return fail('请选择识图模型路由')
  }
  if (capability === 'text' && route !== 'textPrimary' && route !== 'textFallback') {
    return fail('请选择文字模型路由')
  }
  const endpoint = await resolveAiEndpoint(env, route)
  try {
    const output =
      capability === 'vision'
        ? await callAiEndpointVision(
            endpoint,
            '这张图片主要是什么颜色？只回复颜色。',
            'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAZklEQVR4nO3PQQ3AIADAwDFT/53UBoM4ICgm5O5cttV7vQGeTQ/AaAQYjUaD0Wg0Go1Go9FoNBqNRqPRaDQajUaj0Wg0Go1Go9FoNBqNRqPRaDQajUaj0Wg0Go1Go9FoNBqNRqPRaDQaDcbxAHy3AUGOk0s8AAAAAElFTkSuQmCC',
          )
        : await callAiEndpointText(endpoint, '请只回复：OK')
    if (!output) {
      return fail('模型已响应，但没有返回可读文本', 502)
    }
    await audit(env, 'test', 'ai_model_route', route, {
      capability,
      provider: endpoint.provider,
      model: endpoint.model,
      keySource: endpoint.keySource,
    })
    return ok({ ok: true, route, provider: endpoint.provider, model: endpoint.model, output })
  } catch (error) {
    return fail(error instanceof Error ? error.message : '模型测试失败', 502)
  }
}

async function setAiModelConfig(env: Env, request: Request) {
  const existing = await getStoredAiModelConfig(env)
  const body = (await request.json().catch(() => ({}))) as {
    mode?: string
    provider?: string
    baseUrl?: string
    model?: string
    runtimeUrl?: string
    apiKey?: string
    clearApiKey?: boolean
    routes?: Partial<Record<AiModelRouteKey, Partial<StoredAiModelEndpointConfig>>>
    routeApiKeys?: Partial<Record<AiModelRouteKey, string>>
    clearRouteApiKeys?: AiModelRouteKey[]
  }
  const routeKeys: AiModelRouteKey[] = ['textPrimary', 'textFallback', 'visionPrimary', 'visionFallback']
  const existingRoutes = {
    ...defaultAiModelRoutes(env),
    ...(existing.routes ?? {}),
  }
  const nextRoutes = routeKeys.reduce(
    (map, route) => ({
      ...map,
      [route]: normalizeAiEndpoint(route, { ...existingRoutes[route], ...(body.routes?.[route] ?? {}) }, env),
    }),
    {} as Record<AiModelRouteKey, StoredAiModelEndpointConfig>,
  )
  const next: StoredAiModelConfig = {
    ...existing,
    mode: normalizeAiMode(body.mode),
    provider: normalizeAiProvider(body.provider),
    baseUrl: String(body.baseUrl ?? existing.baseUrl).trim().replace(/\/$/, ''),
    model: String(body.model ?? existing.model).trim(),
    runtimeUrl: String(body.runtimeUrl ?? existing.runtimeUrl).trim().replace(/\/$/, ''),
    updatedAt: nowIso(),
    routes: nextRoutes,
  }

  if (!next.model) {
    return fail('模型名称不能为空')
  }
  if (body.clearApiKey) {
    delete next.apiKeyEncrypted
    delete next.apiKeyPreview
  } else if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
    try {
      next.apiKeyEncrypted = await encryptSettingSecret(env, body.apiKey.trim())
      next.apiKeyPreview = maskApiKey(body.apiKey)
    } catch (error) {
      return fail(error instanceof Error ? error.message : '模型 API Key 保存失败', 503)
    }
  }

  const clearRouteApiKeys = new Set(body.clearRouteApiKeys ?? [])
  for (const route of routeKeys) {
    if (clearRouteApiKeys.has(route)) {
      delete nextRoutes[route].apiKeyEncrypted
      delete nextRoutes[route].apiKeyPreview
      continue
    }
    const routeApiKey = body.routeApiKeys?.[route]
    if (typeof routeApiKey === 'string' && routeApiKey.trim()) {
      try {
        nextRoutes[route].apiKeyEncrypted = await encryptSettingSecret(env, routeApiKey.trim())
        nextRoutes[route].apiKeyPreview = maskApiKey(routeApiKey)
      } catch (error) {
        return fail(error instanceof Error ? error.message : '模型 API Key 保存失败', 503)
      }
    }
  }

  await setSettingValue(env, AI_MODEL_SETTING, JSON.stringify(next))
  await audit(env, 'update', 'setting', AI_MODEL_SETTING, {
    mode: next.mode,
    provider: next.provider,
    model: next.model,
    runtimeConfigured: Boolean(next.runtimeUrl || env.AI_RUNTIME_URL),
    hasApiKey: Boolean(next.apiKeyEncrypted),
    routes: routeKeys.reduce(
      (map, route) => ({
        ...map,
        [route]: {
          provider: nextRoutes[route].provider,
          model: nextRoutes[route].model,
          hasApiKey: Boolean(nextRoutes[route].apiKeyEncrypted) || Boolean(providerEnvironmentKey(env, nextRoutes[route].provider)),
        },
      }),
      {},
    ),
  })
  return ok(publicAiModelConfig(env, next))
}

async function getAdminPasswordHash(env: Env) {
  const existing = await getSettingValue(env, ADMIN_PASSWORD_SETTING)
  if (existing) {
    const iterations = getSecretHashIterations(existing)
    if (iterations && iterations > PASSWORD_ITERATIONS && env.ADMIN_TOKEN) {
      const remigrated = await hashSecret(env.ADMIN_TOKEN)
      await setSettingValue(env, ADMIN_PASSWORD_SETTING, remigrated)
      await audit(env, 'migrate', 'setting', ADMIN_PASSWORD_SETTING, { source: 'ADMIN_TOKEN', reason: 'pbkdf2_iteration_cap' })
      return remigrated
    }
    return existing
  }
  if (!env.ADMIN_TOKEN) {
    return null
  }
  const migrated = await hashSecret(env.ADMIN_TOKEN)
  await setSettingValue(env, ADMIN_PASSWORD_SETTING, migrated)
  await audit(env, 'migrate', 'setting', ADMIN_PASSWORD_SETTING, { source: 'ADMIN_TOKEN' })
  return migrated
}

async function verifyAdminPassword(env: Env, password: string) {
  return verifySecret(password, await getAdminPasswordHash(env))
}

async function setAdminPassword(env: Env, password: string) {
  await setSettingValue(env, ADMIN_PASSWORD_SETTING, await hashSecret(password))
}

const toId = (id: string | number) => String(id)

const nowIso = () => new Date().toISOString()

const pad2 = (value: number) => String(value).padStart(2, '0')

const monthPart = (value: string | null | undefined) => String(value || '').slice(0, 7)

/** 把 UTC 时间（ISO 或 SQLite CURRENT_TIMESTAMP 格式）转成北京时间 'YYYY-MM-DD HH:MM' 用于展示 */
function formatBeijing(value: string | null) {
  if (!value) {
    return ''
  }
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const withZone = /Z$|[+-]\d\d:?\d\d$/.test(normalized) ? normalized : `${normalized}Z`
  const date = new Date(withZone)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  const beijing = new Date(date.getTime() + 8 * 3600 * 1000)
  return `${beijing.getUTCFullYear()}-${pad2(beijing.getUTCMonth() + 1)}-${pad2(beijing.getUTCDate())} ${pad2(beijing.getUTCHours())}:${pad2(beijing.getUTCMinutes())}`
}

const toTask = (row: DbTask, files: string[] = []): Task => ({
  id: Number(row.id),
  date: row.start_date ?? '',
  estimatedDate: row.estimated_delivery_date ?? '',
  actualDeliveryDate: row.actual_delivery_date ?? '',
  settlementMonth: row.settlement_month || '',
  isSupplemental: Boolean(row.is_supplemental),
  type: row.design_type ?? '',
  title: row.title,
  requirement: row.requirement ?? '',
  requester: row.requester ?? '',
  contact: row.contact_person ?? '',
  reviewer: row.reviewer ?? '',
  stage: row.stage ?? row.status,
  estimatedHours: Number(row.estimated_hours) || 0,
  actualHours: Number(row.actual_hours) || 0,
  status: row.status,
  progress: Number(row.progress) || 0,
  billable: Number(row.is_billable) !== 0,
  suspendReason: row.suspend_reason ?? '',
  terminateReason: row.terminate_reason ?? '',
  supplementalNote: row.supplemental_note ?? '',
  acceptanceNote: row.acceptance_note ?? '',
  feedbackRating: normalizeFeedbackRating(row.feedback_rating),
  feedbackTags: parseFeedbackTags(row.feedback_tags_json),
  feedbackNote: row.feedback_note ?? '',
  timeEntries: parseTimeEntries(row.time_entries_json),
  waitingEntries: parseWaitingEntries(row.waiting_entries_json),
  voidedAt: row.voided_at ?? '',
  voidReason: row.void_reason ?? '',
  files,
})

const parseTimeEntries = (value: string | null): TimeEntry[] => {
  if (!value) {
    return []
  }
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed
          .map((entry) => ({
            id: String((entry as TimeEntry).id ?? crypto.randomUUID()),
            date: String((entry as TimeEntry).date ?? ''),
            endDate: String((entry as TimeEntry).endDate ?? (entry as TimeEntry).date ?? ''),
            start: String((entry as TimeEntry).start ?? ''),
            end: String((entry as TimeEntry).end ?? ''),
            note: String((entry as TimeEntry).note ?? ''),
            isAcceptanceProgress: Boolean((entry as TimeEntry).isAcceptanceProgress),
            isRevision: Boolean((entry as TimeEntry).isRevision),
            isUncounted: Boolean((entry as TimeEntry).isUncounted),
            reason: String((entry as WaitingEntry).reason ?? '') as WaitingReason,
          }))
          .filter((entry) => entry.start && entry.end)
      : []
  } catch {
    return []
  }
}

const parseWaitingEntries = (value: string | null): WaitingEntry[] => parseTimeEntries(value)

const feedbackRatings: TaskFeedbackRating[] = ['顺利', '一般', '有问题']
const feedbackTags: TaskFeedbackTag[] = ['需求不清晰', '沟通成本高', '定价偏低', '技术挑战大']

function normalizeFeedbackRating(value: unknown): TaskFeedbackRating | '' {
  return feedbackRatings.includes(value as TaskFeedbackRating) ? value as TaskFeedbackRating : ''
}

function normalizeFeedbackTags(value: unknown): TaskFeedbackTag[] {
  const list = Array.isArray(value) ? value : []
  return Array.from(new Set(list.filter((item): item is TaskFeedbackTag => feedbackTags.includes(item as TaskFeedbackTag))))
}

function parseFeedbackTags(value: string | null): TaskFeedbackTag[] {
  try {
    return normalizeFeedbackTags(JSON.parse(value || '[]'))
  } catch {
    return []
  }
}

const toUpdate = (row: DbUpdate, files: string[] = []): TaskUpdate => ({
  id: Number(row.id),
  taskId: Number(row.task_id),
  date: row.update_date,
  title: row.title,
  body: row.body,
  hours: Number(row.hours) || 0,
  visible: Boolean(row.visible_to_client),
  files,
})

const toFile = (row: DbAttachment): FileAsset => ({
  id: Number(row.id),
  taskId: Number(row.task_id),
  entryId: row.entry_id ?? '',
  scope: row.attachment_scope === 'acceptance' ? 'acceptance' : 'progress',
  name: row.file_name,
  task: row.task_title ?? '未关联任务',
  type: row.file_type ?? 'FILE',
  size: row.display_size ?? `${row.file_size ?? 0} B`,
  uploadedAt: formatBeijing(row.uploaded_at),
  final: Boolean(row.is_final),
  visible: Boolean(row.visible_to_client),
  tag: row.file_tag ?? '',
  deletedAt: row.deleted_at ?? '',
  previewUrl: row.preview_r2_key ? `/api/files/${row.id}/preview` : undefined,
  sourceUrl: `/api/files/${row.id}/source`,
})

const toReport = (row: DbReport) => ({
  id: row.id,
  month: row.month,
  totalHours: Number(row.total_hours) || 0,
  billableHours: Number(row.billable_hours) || 0,
  totalAmount: Number(row.total_amount) || 0,
  status: row.status,
  publicToken: row.public_token ?? '',
  generatedAt: formatBeijing(row.generated_at),
  viewedAt: formatBeijing(row.viewed_at),
  viewCount: Number(row.view_count) || 0,
})

async function getHourlyRate(env: Env) {
  const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?').bind('hourlyRate').first<{ value: string }>()
  return Number(row?.value) || defaultHourlyRate
}

async function getPdfTitle(env: Env) {
  const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?').bind('pdfTitle').first<{ value: string }>()
  const value = String(row?.value ?? '').trim()
  return value || defaultPdfTitle
}

async function getServiceCompanyName(env: Env) {
  const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?').bind('serviceCompanyName').first<{ value: string }>()
  const value = String(row?.value ?? '').trim()
  return value || defaultServiceCompanyName
}

async function isLockedReportMonth(env: Env, month: string | null | undefined) {
  if (!month) {
    return false
  }
  const row = await env.DB.prepare("SELECT id FROM monthly_reports WHERE month = ? AND status = 'locked'").bind(month).first<{ id: string }>()
  return Boolean(row)
}

async function getTaxMode(env: Env): Promise<TaxMode> {
  const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?').bind('taxMode').first<{ value: string }>()
  return row?.value === 'labor' ? 'labor' : 'salary'
}

const normalizeDesignTypes = (values: unknown) => {
  const items = Array.isArray(values) ? values : []
  const unique = [...new Set(items.map((item) => String(item).trim()).filter(Boolean))]
  return unique.length > 0 ? unique : defaultDesignTypes
}

const normalizeDesignTypeItems = (values: unknown) => {
  const items = Array.isArray(values) ? values : []
  return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))]
}

const flattenDesignTypeGroups = (groups: DesignTypeGroup[]) => groups.flatMap((group) => group.items.map((item) => `${group.name} / ${item}`))

const normalizeDesignTypeGroups = (values: unknown): DesignTypeGroup[] => {
  if (Array.isArray(values) && values.every((item) => typeof item === 'string')) {
    return [{ name: '常用类型', items: normalizeDesignTypes(values) }]
  }

  const groups = Array.isArray(values) ? values : []
  const normalized = groups
    .map((group) => {
      const name = String((group as { name?: unknown }).name ?? '').trim()
      const items = normalizeDesignTypeItems((group as { items?: unknown }).items)
      return name ? { name, items } : null
    })
    .filter((group): group is DesignTypeGroup => Boolean(group))

  return normalized.length > 0 ? normalized : defaultDesignTypeGroups
}

type TaskAssistantToolArgs = {
  optimizedRequirement?: string
  suggestedParentType?: string
  suggestedChildType?: string
  reason?: string
}

type TextAssistantToolArgs = {
  optimizedText?: string
  summary?: string
}

type HourEstimateToolArgs = {
  suggestedHours?: number
  confidence?: string
  basis?: string[]
  historicalSummary?: string
}

type DailyKnowledgeToolArgs = {
  category?: string
  title?: string
  teaser?: string
  body?: string[]
}

type HourEstimateSample = {
  title: string
  requirement: string
  designType: string
  estimatedHours: number
  actualHours: number
  startDate: string
  estimatedDeliveryDate: string
  actualDeliveryDate: string
  acceptanceNote: string
  status: string
  deliveryCycleHours: number
}

function toTaskAssistantSuggestion(args: TaskAssistantToolArgs, groups: DesignTypeGroup[]) {
  const parent = String(args.suggestedParentType ?? '').trim()
  const child = String(args.suggestedChildType ?? '').trim()
  const fallbackParent = groups[0]?.name ?? '常用类型'
  const fallbackChild = groups[0]?.items[0] ?? defaultDesignTypes[0]
  const suggestedParentType = parent || fallbackParent
  const suggestedChildType = child || fallbackChild
  const matchedGroup = groups.find((group) => group.name === suggestedParentType)
  const categoryExists = Boolean(matchedGroup?.items.includes(suggestedChildType))
  return {
    optimizedRequirement: String(args.optimizedRequirement ?? '').trim(),
    suggestedParentType,
    suggestedChildType,
    suggestedType: `${suggestedParentType} / ${suggestedChildType}`,
    categoryExists,
    reason: String(args.reason ?? '').trim(),
    missingCategory: categoryExists ? undefined : { parent: suggestedParentType, child: suggestedChildType },
  }
}

function parseToolArguments(value: unknown): TaskAssistantToolArgs {
  if (!value) {
    return {}
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as TaskAssistantToolArgs
    } catch {
      return {}
    }
  }
  return typeof value === 'object' ? (value as TaskAssistantToolArgs) : {}
}

function parseLooseJsonObject(value: string) {
  const raw = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
      } catch {
        return {}
      }
    }
    return {}
  }
}

function parseTextToolArguments(value: unknown): TextAssistantToolArgs {
  if (!value) {
    return {}
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as TextAssistantToolArgs
    } catch {
      return {}
    }
  }
  return typeof value === 'object' ? (value as TextAssistantToolArgs) : {}
}

function parseHourEstimateToolArguments(value: unknown): HourEstimateToolArgs {
  if (!value) {
    return {}
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as HourEstimateToolArgs
    } catch {
      return {}
    }
  }
  return typeof value === 'object' ? (value as HourEstimateToolArgs) : {}
}

function numberListMedian(values: number[]) {
  if (values.length === 0) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function roundToHalfHour(value: number) {
  return Math.max(0.5, Math.round(value * 2) / 2)
}

function hoursBetweenDates(startValue: string | null, endValue: string | null) {
  if (!startValue || !endValue) {
    return 0
  }
  const start = new Date(startValue).getTime()
  const end = new Date(endValue).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0
  }
  return Math.round(((end - start) / 3_600_000) * 100) / 100
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function toHourEstimateSample(task: DbTask): HourEstimateSample {
  return {
    title: task.title,
    requirement: task.requirement ?? '',
    designType: task.design_type ?? '',
    estimatedHours: Number(task.estimated_hours) || 0,
    actualHours: Number(task.actual_hours) || 0,
    startDate: task.start_date ?? '',
    estimatedDeliveryDate: task.estimated_delivery_date ?? '',
    actualDeliveryDate: task.actual_delivery_date ?? '',
    acceptanceNote: task.acceptance_note ?? '',
    status: task.status,
    deliveryCycleHours: hoursBetweenDates(task.start_date, task.actual_delivery_date || task.estimated_delivery_date),
  }
}

async function getDesignTypeGroups(env: Env) {
  const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?').bind('designTypes').first<{ value: string }>()
  if (!row?.value) {
    return defaultDesignTypeGroups
  }
  try {
    return normalizeDesignTypeGroups(JSON.parse(row.value))
  } catch {
    return defaultDesignTypeGroups
  }
}

const toAccessToken = (row: DbAccessToken) => ({
  id: row.id,
  token: row.token,
  label: row.label ?? '',
  expiresAt: formatBeijing(row.expires_at),
  disabled: Boolean(row.disabled),
  expired: Boolean(row.expires_at && row.expires_at < nowIso()),
  createdAt: formatBeijing(row.created_at),
  lastUsedAt: formatBeijing(row.last_used_at),
})

/** 校验登录凭证：管理员邮箱 + 平台密码 → admin；有效的访问口令 → member */
async function resolveRole(env: Env, key: string, email: string): Promise<AuthRole | null> {
  const normalizedEmail = email.trim().toLowerCase()
  const trimmedKey = key.trim()
  if (!trimmedKey) {
    return null
  }
  if (normalizedEmail === ADMIN_EMAIL) {
    return (await verifyAdminPassword(env, trimmedKey)) ? 'admin' : null
  }

  const row = await env.DB.prepare('SELECT * FROM access_tokens WHERE token = ?').bind(trimmedKey).first<DbAccessToken>()
  if (!row || row.disabled) {
    return null
  }
  if (row.expires_at && row.expires_at < nowIso()) {
    return null
  }
  await env.DB.prepare('UPDATE access_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').bind(row.id).run()
  return 'member'
}

async function login(env: Env, request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string; key?: string }
  const role = await resolveRole(env, body.key ?? '', body.email ?? '')
  if (!role) {
    return fail('账号或密码不正确', 401)
  }
  await audit(env, 'login', 'auth', role, { email: body.email ?? '' })
  return ok({ role })
}

async function changeAdminPassword(env: Env, request: Request) {
  const body = (await request.json().catch(() => ({}))) as { currentPassword?: string; newPassword?: string }
  const currentPassword = String(body.currentPassword ?? '')
  const newPassword = String(body.newPassword ?? '')
  if (newPassword.length < 8) {
    return fail('新密码至少需要 8 位', 400)
  }
  if (!(await verifyAdminPassword(env, currentPassword))) {
    return fail('当前密码不正确', 401)
  }
  await setAdminPassword(env, newPassword)
  await deleteSettingValue(env, ADMIN_RESET_SETTING)
  await audit(env, 'update', 'setting', ADMIN_PASSWORD_SETTING, { method: 'change_password' })
  return ok({ ok: true })
}

async function sendPasswordResetEmail(env: Env, request: Request, email: string, token: string) {
  if (!env.RESEND_API_KEY) {
    return false
  }
  const origin = new URL(request.url).origin
  const resetUrl = `${origin}/?resetToken=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESET_EMAIL_FROM || 'Giverny <onboarding@resend.dev>',
      to: email,
      subject: 'Giverny 管理员密码重置',
      html: `<p>点击下面的链接重置 Giverny 管理员密码：</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>链接 30 分钟内有效。如果不是你本人操作，请忽略这封邮件。</p>`,
    }),
  })
  return response.ok
}

async function requestPasswordReset(env: Env, request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string }
  const email = String(body.email ?? '').trim().toLowerCase()
  if (email !== ADMIN_EMAIL) {
    return ok({ ok: true })
  }
  if (!env.RESEND_API_KEY) {
    return fail('邮件找回功能还没有配置发信服务，请先在设置页登录后修改密码，或配置 RESEND_API_KEY。', 501)
  }
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32))
  const token = bytesToBase64(tokenBytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  await setSettingValue(env, ADMIN_RESET_SETTING, JSON.stringify({ tokenHash: await hashSecret(token), expiresAt }))
  const sent = await sendPasswordResetEmail(env, request, email, token)
  if (!sent) {
    return fail('重置邮件发送失败，请稍后重试。', 502)
  }
  await audit(env, 'request', 'password_reset', ADMIN_EMAIL, { expiresAt })
  return ok({ ok: true })
}

async function confirmPasswordReset(env: Env, request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string; token?: string; newPassword?: string }
  const email = String(body.email ?? '').trim().toLowerCase()
  const token = String(body.token ?? '').trim()
  const newPassword = String(body.newPassword ?? '')
  if (email !== ADMIN_EMAIL || !token) {
    return fail('重置链接无效', 400)
  }
  if (newPassword.length < 8) {
    return fail('新密码至少需要 8 位', 400)
  }
  const raw = await getSettingValue(env, ADMIN_RESET_SETTING)
  if (!raw) {
    return fail('重置链接已失效，请重新申请。', 400)
  }
  const reset = JSON.parse(raw) as { tokenHash?: string; expiresAt?: string }
  if (!reset.expiresAt || reset.expiresAt < nowIso() || !(await verifySecret(token, reset.tokenHash))) {
    return fail('重置链接已失效，请重新申请。', 400)
  }
  await setAdminPassword(env, newPassword)
  await deleteSettingValue(env, ADMIN_RESET_SETTING)
  await audit(env, 'confirm', 'password_reset', ADMIN_EMAIL, null)
  return ok({ ok: true })
}

async function listAccessTokens(env: Env) {
  const rows = await env.DB.prepare('SELECT * FROM access_tokens ORDER BY created_at DESC').all<DbAccessToken>()
  return (rows.results ?? []).map(toAccessToken)
}

async function createAccessToken(env: Env, request: Request) {
  const body = (await request.json().catch(() => ({}))) as { label?: string; expiresInDays?: number | null }
  const id = crypto.randomUUID()
  const randomBytes = crypto.getRandomValues(new Uint8Array(16))
  const token = `wk_${Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
  const days = Number(body.expiresInDays)
  const expiresAt = Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null

  await env.DB.prepare(
    `INSERT INTO access_tokens (id, token, label, expires_at, disabled) VALUES (?, ?, ?, ?, 0)`,
  )
    .bind(id, token, (body.label ?? '').trim() || '未命名口令', expiresAt)
    .run()

  await audit(env, 'create', 'access_token', id, { label: body.label ?? '', expiresInDays: body.expiresInDays ?? null })
  const row = await env.DB.prepare('SELECT * FROM access_tokens WHERE id = ?').bind(id).first<DbAccessToken>()
  return ok(row ? toAccessToken(row) : { id, token }, 201)
}

async function updateAccessToken(env: Env, id: string, request: Request) {
  const body = (await request.json().catch(() => ({}))) as { disabled?: boolean }
  const row = await env.DB.prepare('SELECT * FROM access_tokens WHERE id = ?').bind(id).first<DbAccessToken>()
  if (!row) {
    return fail('口令不存在', 404)
  }
  await env.DB.prepare('UPDATE access_tokens SET disabled = ? WHERE id = ?').bind(body.disabled ? 1 : 0, id).run()
  await audit(env, body.disabled ? 'disable' : 'enable', 'access_token', id, null)
  const saved = await env.DB.prepare('SELECT * FROM access_tokens WHERE id = ?').bind(id).first<DbAccessToken>()
  return ok(saved ? toAccessToken(saved) : toAccessToken(row))
}

async function deleteAccessToken(env: Env, id: string) {
  await env.DB.prepare('DELETE FROM access_tokens WHERE id = ?').bind(id).run()
  await audit(env, 'delete', 'access_token', id, null)
  return ok({ ok: true })
}

async function purgeExpiredProgressAttachments(env: Env, limit = 50) {
  const rows = await env.DB.prepare(
    `SELECT id, task_id, file_name, r2_key, preview_r2_key
     FROM attachments
     WHERE attachment_scope = 'progress'
       AND datetime(uploaded_at) < datetime('now', '-2 months')
     ORDER BY uploaded_at ASC
     LIMIT ?`,
  ).bind(limit).all<{
    id: string
    task_id: string
    file_name: string
    r2_key: string
    preview_r2_key: string | null
  }>()

  for (const row of rows.results ?? []) {
    await audit(env, 'expire', 'attachment', row.id, {
      taskId: Number(row.task_id),
      fileName: row.file_name,
      retention: '2 months',
    })
    await env.DB.batch([
      env.DB.prepare('DELETE FROM attachment_analyses WHERE attachment_id = ?').bind(row.id),
      env.DB.prepare('DELETE FROM attachments WHERE id = ?').bind(row.id),
    ])
    await env.UPLOADS.delete(row.r2_key)
    if (row.preview_r2_key && row.preview_r2_key !== row.r2_key) {
      await env.UPLOADS.delete(row.preview_r2_key)
    }
  }

  return rows.results?.length ?? 0
}

async function audit(env: Env, action: string, entityType: string, entityId: string, payload: unknown) {
  await env.DB.prepare('INSERT INTO audit_log (id, action, entity_type, entity_id, payload_json) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), action, entityType, entityId, JSON.stringify(payload ?? null))
    .run()
}

async function ensureSeedData(env: Env) {
  await env.DB.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)').bind('hourlyRate', String(defaultHourlyRate)).run()
  await env.DB.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)').bind('pdfTitle', defaultPdfTitle).run()
  await env.DB.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)').bind('serviceCompanyName', defaultServiceCompanyName).run()
  await env.DB.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)').bind('taxMode', 'salary').run()
  await env.DB.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)')
    .bind('designTypes', JSON.stringify(defaultDesignTypeGroups))
    .run()
}

async function getState(env: Env, role: AuthRole) {
  await ensureSeedData(env)

  const [taskRows, updateRows, fileRows, analysisRows, rateRow, pdfTitle, serviceCompanyName, taxMode, designTypeGroups, aiModelConfig, reportRows] = await Promise.all([
    env.DB.prepare(`SELECT * FROM tasks WHERE deleted_at IS NULL ${role === 'admin' ? '' : 'AND voided_at IS NULL'} ORDER BY settlement_month DESC, start_date DESC, created_at DESC`).all<DbTask>(),
    env.DB.prepare(
      `SELECT task_updates.*
       FROM task_updates
       INNER JOIN tasks ON tasks.id = task_updates.task_id
       WHERE tasks.deleted_at IS NULL ${role === 'admin' ? '' : 'AND tasks.voided_at IS NULL'}
       ORDER BY task_updates.update_date DESC, task_updates.created_at DESC`,
    ).all<DbUpdate>(),
    env.DB.prepare(
      `SELECT attachments.*, tasks.title AS task_title
       FROM attachments
       LEFT JOIN tasks ON tasks.id = attachments.task_id
       WHERE attachments.deleted_at IS NULL AND tasks.deleted_at IS NULL ${role === 'admin' ? '' : 'AND tasks.voided_at IS NULL AND attachments.visible_to_client = 1'}
       ORDER BY uploaded_at DESC`,
    ).all<DbAttachment>(),
    role === 'admin'
      ? env.DB.prepare(
          `SELECT attachment_analyses.*, attachments.file_name, attachments.file_type
           FROM attachment_analyses
           INNER JOIN attachments ON attachments.id = attachment_analyses.attachment_id
           INNER JOIN tasks ON tasks.id = attachment_analyses.task_id
           WHERE attachments.deleted_at IS NULL AND tasks.deleted_at IS NULL
           ORDER BY attachment_analyses.requested_at DESC`,
        ).all<DbAttachmentAnalysis>()
      : Promise.resolve({ success: true, results: [] } as D1Result<DbAttachmentAnalysis>),
    env.DB.prepare('SELECT value FROM app_settings WHERE key = ?').bind('hourlyRate').first<{ value: string }>(),
    getPdfTitle(env),
    getServiceCompanyName(env),
    getTaxMode(env),
    getDesignTypeGroups(env),
    getStoredAiModelConfig(env),
    env.DB.prepare('SELECT * FROM monthly_reports ORDER BY month DESC').all<DbReport>(),
  ])

  const filesByTask = new Map<string, string[]>()
  for (const row of fileRows.results ?? []) {
    filesByTask.set(row.task_id, [row.file_name, ...(filesByTask.get(row.task_id) ?? [])])
  }

  return ok({
    role,
    tasks: (taskRows.results ?? []).map((task) => toTask(task, filesByTask.get(task.id) ?? [])),
    updates: (updateRows.results ?? []).map((update) => toUpdate(update)),
    files: (fileRows.results ?? []).map(toFile),
    attachmentAnalyses: (analysisRows.results ?? []).map(toAttachmentAnalysis),
    settings: {
      hourlyRate: Number(rateRow?.value) || defaultHourlyRate,
      pdfTitle,
      serviceCompanyName,
      taxMode,
      designTypes: flattenDesignTypeGroups(designTypeGroups),
      designTypeGroups,
      aiModel: role === 'admin' ? publicAiModelConfig(env, aiModelConfig) : undefined,
    },
    reports: (reportRows.results ?? []).map(toReport),
    accessTokens: role === 'admin' ? await listAccessTokens(env) : undefined,
  })
}

async function getSharedReport(env: Env, token: string) {
  const report = await env.DB.prepare('SELECT * FROM monthly_reports WHERE public_token = ?').bind(token).first<DbReport>()
  if (!report) {
    return fail('分享链接无效或已失效', 404)
  }

  // 记录甲方查看回执（时间 + 次数），月报页结算历史里可见
  await env.DB.prepare('UPDATE monthly_reports SET viewed_at = CURRENT_TIMESTAMP, view_count = view_count + 1 WHERE id = ?')
    .bind(report.id)
    .run()

  const [taskRows, updateRows, fileRows, pdfTitle, serviceCompanyName] = await Promise.all([
    env.DB.prepare("SELECT * FROM tasks WHERE settlement_month = ? AND status != '不计费' AND deleted_at IS NULL AND voided_at IS NULL ORDER BY start_date ASC").bind(report.month).all<DbTask>(),
    env.DB.prepare(
      `SELECT task_updates.* FROM task_updates
       INNER JOIN tasks ON tasks.id = task_updates.task_id
       WHERE task_updates.visible_to_client = 1
         AND (task_updates.update_date LIKE ? OR tasks.settlement_month = ?)
         AND tasks.deleted_at IS NULL
         AND tasks.voided_at IS NULL
       ORDER BY task_updates.update_date DESC`,
    ).bind(`${report.month}%`, report.month).all<DbUpdate>(),
    env.DB.prepare(
      `SELECT attachments.*, tasks.title AS task_title
       FROM attachments
       INNER JOIN tasks ON tasks.id = attachments.task_id
       WHERE attachments.deleted_at IS NULL
         AND attachments.visible_to_client = 1
         AND attachments.attachment_scope = 'acceptance'
         AND (attachments.uploaded_at LIKE ? OR tasks.settlement_month = ?)
         AND tasks.deleted_at IS NULL
         AND tasks.voided_at IS NULL
       ORDER BY uploaded_at DESC`,
    ).bind(`${report.month}%`, report.month).all<DbAttachment>(),
    getPdfTitle(env),
    getServiceCompanyName(env),
  ])

  return ok({
    report: toReport(report),
    tasks: (taskRows.results ?? []).map((task) => toTask(task)),
    updates: (updateRows.results ?? []).map((update) => toUpdate(update)),
    files: (fileRows.results ?? []).map((file) => {
      const mapped = toFile(file)
      return {
        ...mapped,
        previewUrl: mapped.previewUrl ? `${mapped.previewUrl}?token=${token}` : undefined,
        sourceUrl: `${mapped.sourceUrl}?token=${token}`,
      }
    }),
    settings: { pdfTitle, serviceCompanyName },
  })
}

async function createTask(env: Env, request: Request) {
  const task = (await request.json()) as Task
  const id = toId(task.id || Date.now())
  const hourlyRate = await getHourlyRate(env)
  // 所有任务都从「计划中」开始；是否计费由独立的 billable 标记决定（不随状态变化），
  // 这样「不计费任务」即便后续走完整验收流程，也始终不计费。
  const initialStatus: TaskStatus = task.status === '不计费' ? '不计费' : '计划中'
  const initialBillable = task.billable === false ? 0 : initialStatus === '不计费' ? 0 : 1
  await env.DB.prepare(
    `INSERT INTO tasks (
      id, title, requirement, design_type, start_date, estimated_delivery_date, actual_delivery_date, settlement_month, is_supplemental,
      estimated_hours, actual_hours, hourly_rate, requester, contact_person, reviewer, stage, status, progress,
      suspend_reason, terminate_reason, supplemental_note, acceptance_note, feedback_rating, feedback_tags_json, feedback_note, time_entries_json, waiting_entries_json, is_billable
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      task.title,
      task.requirement,
      task.type,
      task.date,
      task.estimatedDate || task.date,
      null,
      task.settlementMonth || monthPart(nowIso()),
      task.isSupplemental ? 1 : 0,
      task.estimatedHours,
      task.actualHours,
      hourlyRate,
      task.requester ?? '',
      task.contact,
      task.reviewer,
      task.stage,
      initialStatus,
      0,
      task.suspendReason ?? '',
      task.terminateReason ?? '',
      task.supplementalNote ?? '',
      task.acceptanceNote ?? '',
      normalizeFeedbackRating(task.feedbackRating),
      JSON.stringify(normalizeFeedbackTags(task.feedbackTags)),
      task.feedbackNote ?? '',
      JSON.stringify(task.timeEntries ?? []),
      JSON.stringify(task.waitingEntries ?? []),
      initialBillable,
    )
    .run()

  const updateId = `${id}-created`
  await env.DB.prepare(
    `INSERT INTO task_updates (id, task_id, update_date, title, body, hours, visible_to_client)
     VALUES (?, ?, ?, ?, ?, 0, 1)`,
  )
    .bind(
      updateId,
      id,
      task.date,
      `项目名称：${task.type || '未分类项目'}`,
      `任务名称：${task.title || '未命名设计任务'}`,
    )
    .run()

  await audit(env, 'create', 'task', id, task)
  return ok({ ...task, id: Number(id), status: initialStatus, progress: 0, files: [] }, 201)
}

async function updateTask(env: Env, id: string, request: Request) {
  const changes = (await request.json()) as Partial<Task>
  const current = await env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL').bind(id).first<DbTask>()
  if (!current) {
    return fail('任务不存在', 404)
  }
  if (await isLockedReportMonth(env, current.settlement_month)) {
    return fail('该任务所属月份已锁定结算，不能再修改任务明细', 409)
  }
  const allowAcceptedTimeEdit = Boolean((changes as { allowAcceptedTimeEdit?: boolean }).allowAcceptedTimeEdit)
  const allowAcceptanceRollback = Boolean((changes as { allowAcceptanceRollback?: boolean }).allowAcceptanceRollback)
  if (current.status === '已验收') {
    if (changes.status && changes.status !== '已验收' && !allowAcceptanceRollback) {
      return fail('已验收任务状态已锁定，不能直接改回其他状态', 409)
    }
    if (!allowAcceptedTimeEdit && (Object.prototype.hasOwnProperty.call(changes, 'actualHours') || Object.prototype.hasOwnProperty.call(changes, 'timeEntries'))) {
      return fail('已验收任务的工时已锁定，不能再修改实际工时', 409)
    }
  }

  const next = {
    title: changes.title ?? current.title,
    requirement: changes.requirement ?? current.requirement ?? '',
    type: changes.type ?? current.design_type ?? '',
    date: changes.date ?? current.start_date ?? '',
    estimatedDate: changes.estimatedDate ?? current.estimated_delivery_date ?? '',
    settlementMonth: changes.settlementMonth ?? current.settlement_month ?? monthPart(nowIso()),
    isSupplemental: Object.prototype.hasOwnProperty.call(changes, 'isSupplemental')
      ? Boolean(changes.isSupplemental)
      : Boolean(current.is_supplemental),
    estimatedHours: changes.estimatedHours ?? current.estimated_hours,
    actualHours: changes.actualHours ?? current.actual_hours,
    requester: changes.requester ?? current.requester ?? '',
    contact: changes.contact ?? current.contact_person ?? '',
    reviewer: changes.reviewer ?? current.reviewer ?? '',
    stage: changes.stage ?? current.stage ?? '',
    status: changes.status ?? current.status,
    progress: changes.progress ?? current.progress,
    suspendReason: changes.suspendReason ?? current.suspend_reason ?? '',
    terminateReason: changes.terminateReason ?? current.terminate_reason ?? '',
    supplementalNote: changes.supplementalNote ?? current.supplemental_note ?? '',
    acceptanceNote: changes.acceptanceNote ?? current.acceptance_note ?? '',
    feedbackRating: Object.prototype.hasOwnProperty.call(changes, 'feedbackRating') ? normalizeFeedbackRating(changes.feedbackRating) : normalizeFeedbackRating(current.feedback_rating),
    feedbackTags: Object.prototype.hasOwnProperty.call(changes, 'feedbackTags') ? normalizeFeedbackTags(changes.feedbackTags) : parseFeedbackTags(current.feedback_tags_json),
    feedbackNote: Object.prototype.hasOwnProperty.call(changes, 'feedbackNote') ? String(changes.feedbackNote ?? '') : current.feedback_note ?? '',
    timeEntries: changes.timeEntries ?? parseTimeEntries(current.time_entries_json),
    waitingEntries: changes.waitingEntries ?? parseWaitingEntries(current.waiting_entries_json),
    actualDeliveryDate: Object.prototype.hasOwnProperty.call(changes, 'actualDeliveryDate')
      ? String(changes.actualDeliveryDate ?? '')
      : changes.status === '已验收' && current.status !== '已验收'
        ? nowIso()
        : current.actual_delivery_date,
  }

  await env.DB.prepare(
    `UPDATE tasks SET
      title = ?, requirement = ?, design_type = ?, start_date = ?, estimated_delivery_date = ?, actual_delivery_date = ?, settlement_month = ?, is_supplemental = ?, estimated_hours = ?, actual_hours = ?,
      requester = ?, contact_person = ?, reviewer = ?, stage = ?, status = ?, progress = ?,
      suspend_reason = ?, terminate_reason = ?, supplemental_note = ?, acceptance_note = ?, feedback_rating = ?, feedback_tags_json = ?, feedback_note = ?, time_entries_json = ?, waiting_entries_json = ?, is_billable = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  )
    .bind(
      next.title,
      next.requirement,
      next.type,
      next.date,
      next.estimatedDate || null,
      next.actualDeliveryDate,
      next.settlementMonth || monthPart(nowIso()),
      next.isSupplemental ? 1 : 0,
      next.estimatedHours,
      next.actualHours,
      next.requester,
      next.contact,
      next.reviewer,
      next.stage,
      next.status,
      next.progress,
      next.suspendReason,
      next.terminateReason,
      next.supplementalNote,
      next.acceptanceNote,
      next.feedbackRating,
      JSON.stringify(next.feedbackTags),
      next.feedbackNote,
      JSON.stringify(next.timeEntries),
      JSON.stringify(next.waitingEntries),
      // 计费标记是独立的、持久的：默认保留原值；状态变化（含验收）不会改变它。
      // 仅当本次更新显式带 billable，或状态被设为「不计费」时才改写。
      Object.prototype.hasOwnProperty.call(changes, 'billable')
        ? ((changes as { billable?: boolean }).billable === false ? 0 : 1)
        : next.status === '不计费'
          ? 0
          : Number(current.is_billable),
      id,
    )
    .run()

  await audit(env, 'update', 'task', id, changes)
  const saved = await env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL').bind(id).first<DbTask>()
  return ok(saved ? toTask(saved) : toTask(current))
}

async function voidTask(env: Env, id: string, request: Request) {
  const body = (await request.json().catch(() => ({}))) as { reason?: string }
  const current = await env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL AND voided_at IS NULL').bind(id).first<DbTask>()
  if (!current) {
    return fail('任务不存在或已作废', 404)
  }
  await env.DB.prepare('UPDATE tasks SET voided_at = CURRENT_TIMESTAMP, void_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind((body.reason ?? '').trim() || '管理员作废', id)
    .run()
  await audit(env, 'void', 'task', id, { reason: body.reason ?? '' })
  return ok({ ok: true })
}

async function restoreTask(env: Env, id: string) {
  const current = await env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL AND voided_at IS NOT NULL').bind(id).first<DbTask>()
  if (!current) {
    return fail('任务不存在或未作废', 404)
  }
  await env.DB.prepare('UPDATE tasks SET voided_at = NULL, void_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(id).run()
  await audit(env, 'restore', 'task', id, {})
  return ok({ ok: true })
}

async function deleteTask(env: Env, id: string) {
  // 真删除仅允许作用于已作废任务，避免误删正常任务。
  const current = await env.DB.prepare('SELECT id, title, settlement_month FROM tasks WHERE id = ? AND voided_at IS NOT NULL').bind(id).first<{
    id: string
    title: string
    settlement_month: string | null
  }>()
  if (!current) {
    return fail('只有已作废的任务才能永久删除', 405)
  }
  if (await isLockedReportMonth(env, current.settlement_month)) {
    return fail('该任务所属月份已锁定结算，不能永久删除', 409)
  }
  await env.DB.prepare('UPDATE tasks SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(id).run()
  await audit(env, 'delete', 'task', id, { title: current.title })
  return ok({ ok: true })
}

async function createUpdate(env: Env, request: Request) {
  const update = (await request.json()) as TaskUpdate
  const id = toId(update.id || Date.now())
  const task = await env.DB.prepare('SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL').bind(toId(update.taskId)).first<{ id: string }>()
  if (!task) {
    return fail('任务不存在或已删除', 404)
  }
  await env.DB.prepare(
    `INSERT INTO task_updates (id, task_id, update_date, title, body, hours, visible_to_client)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, toId(update.taskId), update.date, update.title, update.body, update.hours, update.visible ? 1 : 0)
    .run()

  await env.DB.prepare(
    `UPDATE tasks SET
      actual_hours = ROUND((actual_hours + ?), 1),
      progress = CASE WHEN ? = 1 THEN MAX(progress, MIN(98, progress + 8)) ELSE progress END,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  )
    .bind(update.hours, update.visible ? 1 : 0, toId(update.taskId))
    .run()

  await audit(env, 'create', 'update', id, update)
  return ok({ ...update, id: Number(id) }, 201)
}

async function updateUpdate(env: Env, id: string, request: Request) {
  const changes = (await request.json()) as Partial<TaskUpdate>
  const current = await env.DB.prepare('SELECT * FROM task_updates WHERE id = ?').bind(id).first<DbUpdate>()
  if (!current) {
    return fail('进展记录不存在', 404)
  }

  const next = {
    date: changes.date ?? current.update_date,
    title: changes.title ?? current.title,
    body: changes.body ?? current.body,
    hours: changes.hours ?? Number(current.hours),
    visible: changes.visible ?? Boolean(current.visible_to_client),
  }

  await env.DB.prepare(
    `UPDATE task_updates SET update_date = ?, title = ?, body = ?, hours = ?, visible_to_client = ? WHERE id = ?`,
  )
    .bind(next.date, next.title, next.body, next.hours, next.visible ? 1 : 0, id)
    .run()

  // 工时变化时同步调整任务累计工时
  const delta = Number(next.hours) - Number(current.hours)
  if (delta !== 0) {
    await env.DB.prepare(
      `UPDATE tasks SET actual_hours = ROUND(MAX(0, actual_hours + ?), 1), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
      .bind(delta, current.task_id)
      .run()
  }

  await audit(env, 'update', 'update', id, { ...changes, taskId: Number(current.task_id) })
  const saved = await env.DB.prepare('SELECT * FROM task_updates WHERE id = ?').bind(id).first<DbUpdate>()
  return ok(saved ? toUpdate(saved) : toUpdate(current))
}

async function deleteUpdate(env: Env, id: string) {
  const current = await env.DB.prepare('SELECT * FROM task_updates WHERE id = ?').bind(id).first<DbUpdate>()
  if (!current) {
    return fail('进展记录不存在', 404)
  }
  await env.DB.prepare('DELETE FROM task_updates WHERE id = ?').bind(id).run()
  await env.DB.prepare(
    `UPDATE tasks SET actual_hours = ROUND(MAX(0, actual_hours - ?), 1), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  )
    .bind(Number(current.hours), current.task_id)
    .run()
  await audit(env, 'delete', 'update', id, { taskId: Number(current.task_id), hours: Number(current.hours), title: current.title })
  return ok({ ok: true })
}

async function getTaskActivity(env: Env, taskId: string) {
  const [rows, activeAttachmentRows] = await Promise.all([
    env.DB.prepare(
      `SELECT * FROM audit_log
       WHERE (entity_type = 'task' AND entity_id = ?) OR entity_type IN ('attachment', 'update')
       ORDER BY created_at DESC LIMIT 400`,
    )
      .bind(taskId)
      .all<{ id: string; action: string; entity_type: string; entity_id: string; payload_json: string | null; created_at: string }>(),
    env.DB.prepare(
      'SELECT id FROM attachments WHERE task_id = ? AND deleted_at IS NULL',
    ).bind(taskId).all<{ id: string }>(),
  ])
  const activeAttachmentIds = new Set((activeAttachmentRows.results ?? []).map((row) => row.id))

  const items = []
  for (const row of rows.results ?? []) {
    let payload: Record<string, unknown> | null
    try {
      payload = row.payload_json ? (JSON.parse(row.payload_json) as Record<string, unknown>) : null
    } catch {
      payload = null
    }
    if (row.entity_type !== 'task' && String(payload?.taskId ?? '') !== String(taskId)) {
      continue
    }
    if (row.entity_type === 'attachment' && row.action !== 'delete' && !activeAttachmentIds.has(row.entity_id)) {
      continue
    }
    items.push({
      id: row.id,
      action: row.action,
      entityId: row.entity_id,
      entityType: row.entity_type,
      payload,
      createdAt: formatBeijing(row.created_at),
    })
    if (items.length >= 60) {
      break
    }
  }
  return ok({ items })
}

async function deleteActivity(env: Env, id: string) {
  const current = await env.DB.prepare('SELECT id FROM audit_log WHERE id = ?').bind(id).first<{ id: string }>()
  if (!current) {
    return fail('动态不存在或已删除', 404)
  }
  await env.DB.prepare('DELETE FROM audit_log WHERE id = ?').bind(id).run()
  return ok({ ok: true })
}

async function createFile(env: Env, request: Request, ctx?: WorkerExecutionContext) {
  const form = await request.formData()
  const file = form.get('file')
  const preview = form.get('preview')
  if (!(file instanceof File)) {
    return fail('缺少上传文件')
  }

  const id = String(Date.now())
  const taskId = String(form.get('taskId') ?? '')
  const entryId = String(form.get('entryId') ?? '').trim()
  const scope = form.get('scope') === 'acceptance' ? 'acceptance' : 'progress'
  const type = String(form.get('type') || file.name.split('.').pop()?.toUpperCase() || 'FILE')
  const task = await env.DB.prepare('SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL').bind(taskId).first<{ id: string }>()
  if (!task) {
    return fail('任务不存在或已删除', 404)
  }
  const r2Key = `uploads/${taskId}/${id}/${sanitizeFileName(file.name)}`
  await env.UPLOADS.put(r2Key, file.stream(), { httpMetadata: { contentType: file.type || 'application/octet-stream' } })

  let previewKey: string | null = null
  if (preview instanceof File && preview.size > 0) {
    previewKey = `previews/${taskId}/${id}/${sanitizeFileName(preview.name)}`
    await env.UPLOADS.put(previewKey, preview.stream(), { httpMetadata: { contentType: preview.type || 'application/octet-stream' } })
  } else if (file.type.startsWith('image/')) {
    previewKey = r2Key
  }

  const saved = await insertAttachment(env, {
    id,
    taskId,
    entryId,
    scope,
    fileName: file.name,
    fileType: type,
    mimeType: file.type || null,
    r2Key,
    previewKey,
    fileSize: file.size,
    displaySize: String(form.get('size') || `${file.size} B`),
    final: form.get('final') === 'true',
    visible: form.get('visible') !== 'false',
    tag: String(form.get('tag') ?? ''),
    analyze: form.get('analyze') !== 'false',
  })
  if (saved instanceof Response) {
    return saved
  }
  if (form.get('analyze') !== 'false') {
    ctx?.waitUntil(processAttachmentAnalysis(env, id))
  }
  return ok(saved, 201)
}

const sanitizeFileName = (name: string) => name.replace(/[^\w.\-一-龥]/g, '_')

async function insertAttachment(
  env: Env,
  payload: {
    id: string
    taskId: string
    entryId?: string
    scope: 'progress' | 'acceptance'
    fileName: string
    fileType: string
    mimeType: string | null
    r2Key: string
    previewKey: string | null
    fileSize: number | null
    displaySize: string
    final: boolean
    visible: boolean
    tag?: string
    analyze?: boolean
  },
) {
  const uploadedAt = nowIso()
  const task = await env.DB.prepare('SELECT title FROM tasks WHERE id = ? AND deleted_at IS NULL').bind(payload.taskId).first<{ title: string }>()
  if (!task) {
    return fail('任务不存在或已删除', 404)
  }
  await env.DB.prepare(
    `INSERT INTO attachments (
      id, task_id, entry_id, attachment_scope, file_name, file_type, mime_type, r2_key, preview_r2_key, file_size, display_size, is_final, visible_to_client, file_tag, uploaded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      payload.id,
      payload.taskId,
      payload.entryId || null,
      payload.scope,
      payload.fileName,
      payload.fileType,
      payload.mimeType,
      payload.r2Key,
      payload.previewKey,
      payload.fileSize,
      payload.displaySize,
      payload.final ? 1 : 0,
      payload.visible ? 1 : 0,
      payload.tag ?? '',
      uploadedAt,
    )
    .run()

  await audit(env, 'create', 'attachment', payload.id, {
    taskId: Number(payload.taskId),
    entryId: payload.entryId ?? '',
    scope: payload.scope,
    fileName: payload.fileName,
    fileSize: payload.fileSize,
    final: payload.final,
    visible: payload.visible,
    tag: payload.tag ?? '',
  })
  if (payload.analyze) {
    await createAttachmentAnalysisJob(env, payload.id, payload.taskId)
  }

  return {
    id: Number(payload.id),
    taskId: Number(payload.taskId),
    entryId: payload.entryId ?? '',
    scope: payload.scope,
    name: payload.fileName,
    task: task.title,
    type: payload.fileType,
    size: payload.displaySize,
    uploadedAt: formatBeijing(uploadedAt),
    final: payload.final,
    visible: payload.visible,
    tag: payload.tag ?? '',
    previewUrl: payload.previewKey ? `/api/files/${payload.id}/preview` : undefined,
    sourceUrl: `/api/files/${payload.id}/source`,
  }
}

async function initMultipartUpload(env: Env, request: Request) {
  const body = (await request.json()) as { taskId: number; entryId?: string; fileName: string; contentType?: string }
  if (!body.fileName || !body.taskId) {
    return fail('缺少文件名或关联任务')
  }
  const task = await env.DB.prepare('SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL').bind(toId(body.taskId)).first<{ id: string }>()
  if (!task) {
    return fail('任务不存在或已删除', 404)
  }
  const fileId = String(Date.now())
  const key = `uploads/${body.taskId}/${fileId}/${sanitizeFileName(body.fileName)}`
  const upload = await env.UPLOADS.createMultipartUpload(key, {
    httpMetadata: { contentType: body.contentType || 'application/octet-stream' },
  })
  return ok({ fileId, key, uploadId: upload.uploadId })
}

async function uploadMultipartPart(env: Env, request: Request) {
  const url = new URL(request.url)
  const key = url.searchParams.get('key') ?? ''
  const uploadId = url.searchParams.get('uploadId') ?? ''
  const partNumber = Number(url.searchParams.get('partNumber'))
  if (!key || !uploadId || !Number.isFinite(partNumber)) {
    return fail('分片参数不完整')
  }
  const data = await request.arrayBuffer()
  const upload = env.UPLOADS.resumeMultipartUpload(key, uploadId)
  const part = await upload.uploadPart(partNumber, data)
  return ok(part)
}

async function completeMultipartUpload(env: Env, request: Request, ctx?: WorkerExecutionContext) {
  const form = await request.formData()
  const key = String(form.get('key') ?? '')
  const uploadId = String(form.get('uploadId') ?? '')
  const fileId = String(form.get('fileId') ?? Date.now())
  const taskId = String(form.get('taskId') ?? '')
  const entryId = String(form.get('entryId') ?? '').trim()
  const scope = form.get('scope') === 'acceptance' ? 'acceptance' : 'progress'
  const parts = JSON.parse(String(form.get('parts') ?? '[]')) as R2UploadedPart[]
  if (!key || !uploadId || parts.length === 0) {
    return fail('分片信息不完整')
  }
  const task = await env.DB.prepare('SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL').bind(taskId).first<{ id: string }>()
  if (!task) {
    return fail('任务不存在或已删除', 404)
  }

  const upload = env.UPLOADS.resumeMultipartUpload(key, uploadId)
  await upload.complete(parts)

  let previewKey: string | null = null
  const preview = form.get('preview')
  if (preview instanceof File && preview.size > 0) {
    previewKey = `previews/${taskId}/${fileId}/${sanitizeFileName(preview.name)}`
    await env.UPLOADS.put(previewKey, preview.stream(), { httpMetadata: { contentType: preview.type || 'application/octet-stream' } })
  }

  const fileName = String(form.get('name') ?? '未命名文件')
  const saved = await insertAttachment(env, {
    id: fileId,
    taskId,
    entryId,
    scope,
    fileName,
    fileType: String(form.get('type') ?? fileName.split('.').pop()?.toUpperCase() ?? 'FILE'),
    mimeType: String(form.get('contentType') ?? '') || null,
    r2Key: key,
    previewKey,
    fileSize: Number(form.get('fileSize')) || null,
    displaySize: String(form.get('size') ?? ''),
    final: form.get('final') === 'true',
    visible: form.get('visible') !== 'false',
    tag: String(form.get('tag') ?? ''),
    analyze: form.get('analyze') !== 'false',
  })
  if (saved instanceof Response) {
    return saved
  }
  if (form.get('analyze') !== 'false') {
    ctx?.waitUntil(processAttachmentAnalysis(env, fileId))
  }
  return ok(saved, 201)
}

async function canReadSharedFile(env: Env, fileId: string, shareToken: string) {
  if (!shareToken) {
    return false
  }
  const row = await env.DB.prepare(
    `SELECT monthly_reports.id
     FROM monthly_reports
     INNER JOIN attachments ON attachments.id = ?
     LEFT JOIN tasks ON tasks.id = attachments.task_id
     WHERE monthly_reports.public_token = ?
       AND attachments.deleted_at IS NULL
       AND attachments.visible_to_client = 1
       AND attachments.attachment_scope = 'acceptance'
       AND (
         attachments.uploaded_at LIKE monthly_reports.month || '%'
         OR tasks.settlement_month = monthly_reports.month
       )
       AND (tasks.id IS NULL OR tasks.deleted_at IS NULL)
     LIMIT 1`,
  )
    .bind(fileId, shareToken)
    .first<{ id: string }>()
  return Boolean(row)
}

// 为已上传但缺少预览图的文件（如早期上传的 PDF）补一张预览图。前端客户端渲染 PDF 首页后回传。
async function setFilePreview(env: Env, id: string, request: Request) {
  const row = await env.DB.prepare('SELECT id, task_id FROM attachments WHERE id = ? AND deleted_at IS NULL').bind(id).first<{ id: string; task_id: string }>()
  if (!row) {
    return fail('文件不存在或已删除', 404)
  }
  const form = await request.formData()
  const preview = form.get('preview')
  if (!(preview instanceof File) || preview.size === 0) {
    return fail('缺少预览图')
  }
  const previewKey = `previews/${row.task_id}/${id}/${sanitizeFileName(preview.name || 'preview.png')}`
  await env.UPLOADS.put(previewKey, preview.stream(), { httpMetadata: { contentType: preview.type || 'image/png' } })
  await env.DB.prepare('UPDATE attachments SET preview_r2_key = ? WHERE id = ?').bind(previewKey, id).run()
  return ok({ previewUrl: `/api/files/${id}/preview` })
}

async function getFilePreview(env: Env, id: string, request: Request) {
  const row = await env.DB.prepare('SELECT preview_r2_key, mime_type, visible_to_client FROM attachments WHERE id = ? AND deleted_at IS NULL').bind(id).first<{
    preview_r2_key: string | null
    mime_type: string | null
    visible_to_client: number
  }>()
  if (!row?.preview_r2_key) {
    return fail('没有预览图', 404)
  }

  // 权限：登录凭证（header 或 auth/email 参数）可看全部；甲方分享 token 只能看「甲方可见」文件
  if (env.ADMIN_TOKEN || (await getSettingValue(env, ADMIN_PASSWORD_SETTING))) {
    const url = new URL(request.url)
    const headerRole = await resolveRole(env, request.headers.get('x-auth-key') ?? '', request.headers.get('x-auth-email') ?? '')
    const queryRole = headerRole ?? (await resolveRole(env, url.searchParams.get('auth') ?? '', url.searchParams.get('email') ?? ''))
    if (!queryRole) {
      const shareToken = url.searchParams.get('token') ?? ''
      const canRead = await canReadSharedFile(env, id, shareToken)
      if (!canRead) {
        return fail('没有权限查看该文件', 401)
      }
    }
  }

  const object = await env.UPLOADS.get(row.preview_r2_key)
  if (!object) {
    return fail('预览文件不存在', 404)
  }
  return new Response(object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType ?? row.mime_type ?? 'application/octet-stream',
      'cache-control': 'private, max-age=3600',
    },
  })
}

async function getFileSource(env: Env, id: string, request: Request) {
  const url = new URL(request.url)
  const row = await env.DB.prepare('SELECT file_name, r2_key, mime_type, visible_to_client FROM attachments WHERE id = ? AND deleted_at IS NULL').bind(id).first<{
    file_name: string
    r2_key: string
    mime_type: string | null
    visible_to_client: number
  }>()
  if (!row?.r2_key) {
    return fail('文件不存在', 404)
  }

  if (env.ADMIN_TOKEN || (await getSettingValue(env, ADMIN_PASSWORD_SETTING))) {
    const headerRole = await resolveRole(env, request.headers.get('x-auth-key') ?? '', request.headers.get('x-auth-email') ?? '')
    const queryRole = headerRole ?? (await resolveRole(env, url.searchParams.get('auth') ?? '', url.searchParams.get('email') ?? ''))
    if (!queryRole) {
      const shareToken = url.searchParams.get('token') ?? ''
      const canRead = await canReadSharedFile(env, id, shareToken)
      if (!canRead) {
        return fail('没有权限查看该文件', 401)
      }
    }
  }

  const object = await env.UPLOADS.get(row.r2_key)
  if (!object) {
    return fail('源文件不存在', 404)
  }

  const encodedName = encodeURIComponent(row.file_name)
  const forcedContentType = url.searchParams.get('as') === 'pdf' ? 'application/pdf' : null
  return new Response(object.body, {
    headers: {
      'content-type': forcedContentType ?? object.httpMetadata?.contentType ?? row.mime_type ?? 'application/octet-stream',
      'content-disposition': `inline; filename*=UTF-8''${encodedName}`,
      'cache-control': 'private, max-age=3600',
    },
  })
}

async function updateFileMetadata(env: Env, id: string, request: Request) {
  const body = (await request.json()) as { name?: string; tag?: string }
  const current = await env.DB.prepare('SELECT file_name, file_tag FROM attachments WHERE id = ? AND deleted_at IS NULL').bind(id).first<{ file_name: string; file_tag: string | null }>()
  if (!current) {
    return fail('文件不存在', 404)
  }

  const nextName = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 120) : current.file_name
  const nextTag = typeof body.tag === 'string' ? body.tag.trim().slice(0, 240) : (current.file_tag ?? '')
  await env.DB.prepare('UPDATE attachments SET file_name = ?, file_tag = ? WHERE id = ?').bind(nextName, nextTag, id).run()
  await audit(env, 'update', 'attachment', id, { fileName: nextName, tag: nextTag })

  const row = await env.DB.prepare(`
    SELECT a.*, t.title AS task_title
    FROM attachments a
    LEFT JOIN tasks t ON t.id = a.task_id
    WHERE a.id = ? AND a.deleted_at IS NULL
  `).bind(id).first<DbAttachment>()
  return ok(row ? toFile(row) : { ok: true })
}

async function deleteFile(env: Env, id: string) {
  const row = await env.DB.prepare(`
    SELECT attachments.task_id, attachments.file_name, attachments.r2_key, attachments.preview_r2_key, tasks.settlement_month
    FROM attachments
    LEFT JOIN tasks ON tasks.id = attachments.task_id
    WHERE attachments.id = ? AND attachments.deleted_at IS NULL
  `).bind(id).first<{
    task_id: string
    file_name: string
    r2_key: string
    preview_r2_key: string | null
    settlement_month: string | null
  }>()
  if (!row) {
    return fail('文件不存在', 404)
  }
  if (await isLockedReportMonth(env, row.settlement_month)) {
    return fail('该文件所属月份已锁定结算，不能删除', 409)
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM attachment_analyses WHERE attachment_id = ?').bind(id),
    env.DB.prepare('DELETE FROM attachments WHERE id = ?').bind(id),
  ])
  const deleteResults = await Promise.allSettled([
    env.UPLOADS.delete(row.r2_key),
    ...(row.preview_r2_key && row.preview_r2_key !== row.r2_key ? [env.UPLOADS.delete(row.preview_r2_key)] : []),
  ])
  const failedDeletes = deleteResults.filter((result) => result.status === 'rejected').length
  await audit(env, 'delete', 'attachment', id, {
    taskId: Number(row.task_id),
    fileName: row.file_name,
    storageCleanup: failedDeletes > 0 ? 'failed' : 'ok',
  })
  return ok({ ok: true, storageCleanupFailed: failedDeletes > 0 })
}

async function setEntryAttachmentsArchived(env: Env, taskId: string, request: Request) {
  const body = (await request.json()) as { entryId?: string; archived?: boolean }
  const entryId = String(body.entryId ?? '').trim()
  if (!entryId) {
    return fail('缺少分段记录 ID')
  }
  const task = await env.DB.prepare(
    'SELECT id, settlement_month FROM tasks WHERE id = ? AND deleted_at IS NULL',
  ).bind(taskId).first<{ id: string; settlement_month: string | null }>()
  if (!task) {
    return fail('任务不存在或已删除', 404)
  }
  if (await isLockedReportMonth(env, task.settlement_month)) {
    return fail('该任务所属月份已锁定结算，不能调整关联附件', 409)
  }
  const result = body.archived
    ? await env.DB.prepare(
        `UPDATE attachments
         SET deleted_at = CURRENT_TIMESTAMP
         WHERE task_id = ? AND entry_id = ? AND deleted_at IS NULL`,
      ).bind(taskId, entryId).run()
    : await env.DB.prepare(
        `UPDATE attachments
         SET deleted_at = NULL
         WHERE task_id = ? AND entry_id = ? AND deleted_at IS NOT NULL`,
      ).bind(taskId, entryId).run()
  const affected = Number(result.meta?.changes ?? 0)
  await audit(env, body.archived ? 'archive' : 'restore', 'entry_attachment', entryId, {
    taskId: Number(taskId),
    affected,
  })
  return ok({ ok: true, affected })
}

async function retryAttachmentAnalysis(env: Env, attachmentId: string, ctx?: WorkerExecutionContext) {
  const row = await env.DB.prepare('SELECT task_id FROM attachments WHERE id = ? AND deleted_at IS NULL').bind(attachmentId).first<{ task_id: string }>()
  if (!row) {
    return fail('附件不存在', 404)
  }
  await createAttachmentAnalysisJob(env, attachmentId, row.task_id, true)
  ctx?.waitUntil(processAttachmentAnalysis(env, attachmentId))
  return ok({ ok: true, attachmentId: Number(attachmentId) })
}

async function backfillAttachmentAnalyses(env: Env, ctx?: WorkerExecutionContext) {
  const rows = await env.DB.prepare(
    `SELECT attachments.id, attachments.task_id
     FROM attachments
     LEFT JOIN attachment_analyses ON attachment_analyses.attachment_id = attachments.id
     INNER JOIN tasks ON tasks.id = attachments.task_id
     WHERE attachment_analyses.attachment_id IS NULL AND attachments.deleted_at IS NULL AND tasks.deleted_at IS NULL
     ORDER BY attachments.uploaded_at DESC`,
  ).all<{ id: string; task_id: string }>()
  for (const row of rows.results ?? []) {
    await createAttachmentAnalysisJob(env, row.id, row.task_id)
  }
  ctx?.waitUntil(processPendingAttachmentAnalyses(env, 2))
  return ok({ ok: true, created: rows.results?.length ?? 0 })
}

async function setHourlyRate(env: Env, request: Request) {
  const body = (await request.json()) as { hourlyRate?: number }
  const hourlyRate = Math.max(0, Number(body.hourlyRate) || 0)
  await env.DB.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('hourlyRate', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(String(hourlyRate))
    .run()
  await audit(env, 'update', 'setting', 'hourlyRate', { hourlyRate })
  return ok({ hourlyRate })
}

async function setPdfTitle(env: Env, request: Request) {
  const body = (await request.json().catch(() => ({}))) as { pdfTitle?: string }
  const pdfTitle = String(body.pdfTitle ?? '').trim() || defaultPdfTitle
  await env.DB.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('pdfTitle', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(pdfTitle)
    .run()
  await audit(env, 'update', 'setting', 'pdfTitle', { pdfTitle })
  return ok({ pdfTitle })
}

async function setServiceCompanyName(env: Env, request: Request) {
  const body = (await request.json().catch(() => ({}))) as { serviceCompanyName?: string }
  const serviceCompanyName = String(body.serviceCompanyName ?? '').trim() || defaultServiceCompanyName
  await env.DB.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('serviceCompanyName', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(serviceCompanyName)
    .run()
  await audit(env, 'update', 'setting', 'serviceCompanyName', { serviceCompanyName })
  return ok({ serviceCompanyName })
}

async function setTaxMode(env: Env, request: Request) {
  const body = (await request.json().catch(() => ({}))) as { taxMode?: TaxMode }
  const taxMode: TaxMode = body.taxMode === 'labor' ? 'labor' : 'salary'
  await env.DB.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('taxMode', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(taxMode)
    .run()
  await audit(env, 'update', 'setting', 'taxMode', { taxMode })
  return ok({ taxMode })
}

async function setDesignTypes(env: Env, request: Request) {
  const body = (await request.json().catch(() => ({}))) as { designTypes?: string[] }
  const designTypeGroups = normalizeDesignTypeGroups(body.designTypes)
  await env.DB.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('designTypes', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(JSON.stringify(designTypeGroups))
    .run()
  await audit(env, 'update', 'setting', 'designTypes', { designTypeGroups })
  return ok({ designTypes: flattenDesignTypeGroups(designTypeGroups), designTypeGroups })
}

async function setDesignTypeGroups(env: Env, request: Request) {
  const body = (await request.json().catch(() => ({}))) as { designTypeGroups?: DesignTypeGroup[] }
  const designTypeGroups = normalizeDesignTypeGroups(body.designTypeGroups)
  await env.DB.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('designTypes', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(JSON.stringify(designTypeGroups))
    .run()
  await audit(env, 'update', 'setting', 'designTypeGroups', { designTypeGroups })
  return ok({ designTypes: flattenDesignTypeGroups(designTypeGroups), designTypeGroups })
}

async function callBamlRuntime<T>(env: Env, endpoint: 'suggest-task' | 'optimize-text' | 'suggest-hours', input: unknown): Promise<T | null> {
  const config = await getStoredAiModelConfig(env)
  if (config.mode !== 'baml-runtime') {
    return null
  }
  const runtimeUrl = (config.runtimeUrl || env.AI_RUNTIME_URL || '').replace(/\/$/, '')
  if (!runtimeUrl) {
    return null
  }
  const apiKey = await decryptSettingSecret(env, config.apiKeyEncrypted)
  if (!apiKey) {
    return null
  }

  const response = await fetch(`${runtimeUrl}/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(env.AI_RUNTIME_KEY ? { 'x-ai-runtime-key': env.AI_RUNTIME_KEY } : {}),
    },
    body: JSON.stringify({
      input,
      model: {
        provider: config.provider,
        baseUrl: config.baseUrl,
        model: config.model,
        apiKey,
      },
    }),
  })

  if (!response.ok) {
    return null
  }
  return (await response.json().catch(() => null)) as T | null
}

// AI 估算任务整体进度：只依据进展记录文字，弱化预计时间权重。返回 10 的倍数(0-100)。
async function estimateTaskProgressWithAi(env: Env, request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    title?: string
    requirement?: string
    status?: string
    entries?: Array<{ date?: string; note?: string; isAcceptance?: boolean }>
  }
  const entries = (Array.isArray(body.entries) ? body.entries : [])
    .map((entry) => ({
      date: String(entry?.date ?? '').slice(0, 40),
      note: String(entry?.note ?? '').replace(/\s+/g, ' ').trim().slice(0, 400),
      isAcceptance: Boolean(entry?.isAcceptance),
    }))
    .filter((entry) => entry.note)
    .slice(0, 40)
  if (entries.length === 0) {
    return ok({ progress: 0, reason: '暂无进展记录' })
  }
  const status = String(body.status ?? '').trim()
  if (status === '已验收') {
    return ok({ progress: 100, reason: '任务已验收' })
  }
  const payload = {
    taskTitle: String(body.title ?? '').slice(0, 120),
    requirement: String(body.requirement ?? '').slice(0, 1000),
    status,
    progressEntries: entries,
  }
  const systemPrompt =
    '你是设计任务进度评估助手。请只依据「进展记录」(progressEntries，按时间从新到旧或从旧到新均可，每条是一段工作记录文字) 估算这条任务的整体完成度，输出 0-100 的整数且必须是 10 的倍数。\n\n判断依据(按权重从高到低)：\n1. 进展记录的语义：出现「初稿完成/第一版完成/已完成第一版」约 50-60；之后每完成一轮甲方反馈修改再加 10-20；出现「定稿/终稿/最终版/已上传最终文件/准备验收/待验收」约 85-95；出现「验收通过/已验收」为 100。\n2. 任务状态 status：计划中通常 0，但若已有实质进展记录则按记录推断（不要因为状态是计划中就判 0）；进行中按记录推断；待验收≥85。\n3. 修改轮次越多、且最近的记录越接近定稿，完成度越高；只有零星几条早期记录则给中低值。\n\n不要参考预计开始/预计工时/预计交付等计划时间——它们权重极低、常不准，本输入也不提供。\n请给出一个 progress 整数和一句简短中文理由。'
  const parsed = await callTextFallbackJson<{ progress?: number; reason?: string }>(env, systemPrompt, payload, 'progress:number(0-100,10的倍数), reason:string')
  if (!parsed || typeof parsed.progress !== 'number' || Number.isNaN(parsed.progress)) {
    return fail('AI 进度评估暂时不可用', 503)
  }
  const progress = Math.max(0, Math.min(100, Math.round(parsed.progress / 10) * 10))
  await audit(env, 'suggest', 'ai_progress_estimate', payload.taskTitle || 'untitled', { progress, entryCount: entries.length })
  return ok({ progress, reason: String(parsed.reason ?? '').slice(0, 200) })
}

async function suggestTaskWithAi(env: Env, request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    title?: string
    requirement?: string
    selectedType?: string
    designTypeGroups?: DesignTypeGroup[]
    attachmentText?: string
    attachmentName?: string
  }
  const title = String(body.title ?? '').trim()
  const requirement = String(body.requirement ?? '').trim()
  // 甲方附件文案（Word/PDF/txt 等，前端就地抽取的纯文本，截断以控制 token）
  const attachmentText = String(body.attachmentText ?? '').trim().slice(0, 8000)
  const attachmentName = String(body.attachmentName ?? '').trim().slice(0, 120)
  if (!title && !requirement && !attachmentText) {
    return fail('请先填写项目名称、任务需求，或上传甲方文案附件')
  }

  const storedGroups = await getDesignTypeGroups(env)
  const designTypeGroups = normalizeDesignTypeGroups(body.designTypeGroups?.length ? body.designTypeGroups : storedGroups)
  const aiPayload = {
    taskTitle: title,
    rawRequirement: requirement,
    selectedType: body.selectedType ?? '',
    availableDesignTypeGroups: designTypeGroups,
    // 甲方提供的文案附件内容：需求为空时直接据此分析；需求非空时与之结合
    attachmentName,
    attachmentText,
  }

  const runtimeSuggestion = await callBamlRuntime<TaskAssistantToolArgs>(env, 'suggest-task', aiPayload)
  if (runtimeSuggestion) {
    const suggestion = toTaskAssistantSuggestion(runtimeSuggestion, designTypeGroups)
    if (suggestion.optimizedRequirement) {
      await audit(env, 'suggest', 'ai_task_assistant', title || 'untitled', {
        title,
        suggestedType: suggestion.suggestedType,
        categoryExists: suggestion.categoryExists,
        provider: 'baml-runtime',
      })
      return ok(suggestion)
    }
  }

  const callFallback = async () => {
    const fallbackParsed = await callTextFallbackJson<TaskAssistantToolArgs>(
      env,
      '你是一个平面设计兼职任务助理。请把用户的原始需求改写成专业、可执行、可直接写入任务单的中文描述，并从已有设计类型中选择最贴近的大类和子类。输入可能带 attachmentText（甲方提供的文案附件，已抽取为纯文本）：rawRequirement 为空时直接据 attachmentText 分析，非空时与之结合（以用户需求为主）。不要编造用户和附件都没有提供的事实。',
      aiPayload,
      'optimizedRequirement:string, suggestedParentType:string, suggestedChildType:string, reason:string',
    )
    const suggestion = toTaskAssistantSuggestion(fallbackParsed ?? {}, designTypeGroups)
    if (!suggestion.optimizedRequirement) {
      return null
    }
    await audit(env, 'suggest', 'ai_task_assistant', title || 'untitled', {
      title,
      suggestedType: suggestion.suggestedType,
      categoryExists: suggestion.categoryExists,
      provider: 'text-fallback',
    })
    return ok(suggestion)
  }

  if (!env.DEEPSEEK_API_KEY) {
    const fallback = await callFallback()
    return fallback ?? fail('DeepSeek API Key 尚未配置，备用文字模型也不可用。', 503)
  }

  const model = env.DEEPSEEK_MODEL || 'deepseek-chat'
  const baseUrl = (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
  const toolName = 'suggest_task_requirement_and_design_type'
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            '你是一个平面设计兼职任务助理。请把用户的原始需求改写成专业、可执行、可直接写入任务单的中文描述，并从已有设计类型中选择最贴近的大类和子类。若确实没有合适分类，可以建议新分类，但不要编造不必要的新分类。\n\n【附件文案】输入里可能带 attachmentText（甲方以 Word/PDF 等形式提供的文案，已抽取为纯文本）：\n- 若 rawRequirement 为空：直接依据 attachmentText 分析出设计背景、设计要求、输出文件。\n- 若 rawRequirement 非空：把 rawRequirement 与 attachmentText 结合分析，以用户写的需求为主导意图，用附件补全背景/必须包含的文案要点/交付物，二者冲突时以用户需求为准。\n- attachmentText 只是甲方原始文案，不要把整段文案照抄进结果，要提炼成任务单语言；不要编造附件里没有的交付物或规范。\n\n改写目标：不是只排版，而是把口语化表达改成专业任务单语言；把模糊描述整理成可执行要求；把散乱信息归并到对应模块。\n\n允许：修正语病；归并重复信息；把用户已经表达的需求整理成明确动作；基于原文/附件把“用途/场景/对接背景/必须包含内容/输出清单”补全到对应模块。\n禁止：凭空编造用户和附件都没提过的交付物、尺寸、品牌规范、交付承诺或验收标准；丢失用户或附件提到的背景、约束、文件名、版本号、数量；写客套话或解释你做了什么。\n\n输出必须严格使用以下三段固定模板，段标题一字不改，用换行 \\n 分隔：\n1、设计背景：[项目用途/场景/对接背景]\n2、设计要求：[风格/调性/必须包含的元素/区域]\n3、输出文件：[交付物清单]\n\n方括号只是提示含义，最终不要保留方括号。用户和附件都没有提供的信息写“未明确，可在对接时确认”，不要自己编。整体读起来像一条专业的内部设计任务单。',
        },
        {
          role: 'user',
          content: JSON.stringify(aiPayload),
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: toolName,
            description: '返回优化后的任务需求文案和推荐设计类型',
            parameters: {
              type: 'object',
              properties: {
                optimizedRequirement: {
                  type: 'string',
                  description: '优化后的中文任务需求。必须严格使用三段：1、设计背景；2、设计要求；3、输出文件。把口语化表达改为专业可执行任务单语言；模糊处基于用户原文整理，不明确的信息写“未明确，可在对接时确认”；不要凭空编造交付物、尺寸、品牌规范或验收承诺。',
                },
                suggestedParentType: {
                  type: 'string',
                  description: '推荐的大类名称，优先从 availableDesignTypeGroups.name 中选择。',
                },
                suggestedChildType: {
                  type: 'string',
                  description: '推荐的子类名称，优先从对应大类 items 中选择。',
                },
                reason: {
                  type: 'string',
                  description: '一句话说明为什么推荐该类型。',
                },
              },
              required: ['optimizedRequirement', 'suggestedParentType', 'suggestedChildType', 'reason'],
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: toolName } },
    }),
  })

  if (!response.ok) {
    const fallback = await callFallback()
    if (fallback) {
      return fallback
    }
    const errorText = await response.text().catch(() => '')
    return fail(`AI 助手请求失败：${response.status}${errorText ? ` ${errorText.slice(0, 160)}` : ''}`, 502)
  }

  const data = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>; content?: string } }>
  } | null
  const message = data?.choices?.[0]?.message
  const toolCall = message?.tool_calls?.find((item) => item.function?.name === toolName)
  let parsed = parseToolArguments(toolCall?.function?.arguments)
  if (!parsed.optimizedRequirement && message?.content) {
    parsed = parseToolArguments(message.content)
  }

  const suggestion = toTaskAssistantSuggestion(parsed, designTypeGroups)
  if (!suggestion.optimizedRequirement) {
    const fallback = await callFallback()
    return fallback ?? fail('AI 助手没有返回有效建议，请稍后重试。', 502)
  }

  await audit(env, 'suggest', 'ai_task_assistant', title || 'untitled', {
    title,
    suggestedType: suggestion.suggestedType,
    categoryExists: suggestion.categoryExists,
    provider: 'deepseek-direct',
  })
  return ok(suggestion)
}

async function optimizeTaskTextWithAi(env: Env, request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    mode?: string
    text?: string
    task?: Record<string, unknown>
    files?: Array<Record<string, unknown>>
    activity?: Array<{ createdAt?: string; summary?: string }>
    uploadedFileNames?: string[]
  }
  const mode = body.mode === 'acceptance' ? 'acceptance' : 'progress'
  const text = String(body.text ?? '').trim()
  const files = Array.isArray(body.files) ? body.files.slice(0, 40) : []
  const uploadedFileNames = Array.isArray(body.uploadedFileNames) ? body.uploadedFileNames.slice(0, 20).map(String) : []
  const activity = Array.isArray(body.activity) ? body.activity.slice(0, 12) : []
  const taskTitle = String(body.task?.title ?? '').trim()

  if (!text && files.length === 0 && uploadedFileNames.length === 0 && activity.length === 0) {
    return fail(mode === 'acceptance' ? '请先填写验收备注或上传验收文件' : '请先填写进展内容或上传过程附件')
  }

  const aiPayload = {
    mode,
    currentText: text,
    task: body.task ?? {},
    relatedFiles: files,
    currentUploadedFileNames: uploadedFileNames,
    recentActivity: activity,
  }

  const runtimeSuggestion = await callBamlRuntime<TextAssistantToolArgs>(env, 'optimize-text', aiPayload)
  if (runtimeSuggestion?.optimizedText) {
    await audit(env, 'suggest', 'ai_text_assistant', taskTitle || mode, {
      mode,
      taskTitle,
      fileCount: files.length,
      uploadedFileCount: uploadedFileNames.length,
      provider: 'baml-runtime',
    })
    return ok({
      optimizedText: String(runtimeSuggestion.optimizedText).trim(),
      summary: String(runtimeSuggestion.summary ?? '').trim(),
    })
  }

  const callFallback = async () => {
    const fallbackParsed = await callTextFallbackJson<TextAssistantToolArgs>(
      env,
      '你是一个设计兼职任务管理助手。请基于任务信息、进展记录、文件/交付件名称和用户已写文本，优化成可直接写入系统的中文记录。必须用「1、」「2、」「3、」中文序号分点排列（每点一行，一行一件事），不要写成一大段。保留事实，不要编造文件内容、交付物、客户确认或验收结果。',
      aiPayload,
      'optimizedText:string, summary:string',
    )
    const optimizedText = String(fallbackParsed?.optimizedText ?? '').trim()
    if (!optimizedText) {
      return null
    }
    await audit(env, 'suggest', 'ai_text_assistant', taskTitle || mode, {
      mode,
      taskTitle,
      fileCount: files.length,
      uploadedFileCount: uploadedFileNames.length,
      provider: 'text-fallback',
    })
    return ok({ optimizedText, summary: String(fallbackParsed?.summary ?? '').trim() })
  }

  if (!env.DEEPSEEK_API_KEY) {
    const fallback = await callFallback()
    return fallback ?? fail('DeepSeek API Key 尚未配置，备用文字模型也不可用。', 503)
  }

  const model = env.DEEPSEEK_MODEL || 'deepseek-chat'
  const baseUrl = (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
  const toolName = 'optimize_task_worklog_text'
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            '你是一个设计兼职任务管理助手。请基于任务信息、进展记录、文件/交付件名称和用户已写文本，优化成可直接写入系统的中文记录。\n\n要求：保留事实；不要编造文件内容、未出现的交付物、验收结果、客户反馈或承诺；如果只能从文件名判断，请使用“已上传/已补充”这类稳妥表达；语言要专业、简洁、像内部工作记录。\n\n【结构化输出】必须把内容拆成分点，用「1、」「2、」「3、」这样的中文序号逐条排列，每点单独一行、一行说清一件事，不要写成一大段。只有一件事时也用「1、」开头。\n\nprogress 模式：分点列出当前完成到哪一步、做了哪些具体改动、已上传哪些过程附件、下一步（仅在有明确事实时写）。不要写成正式验收结论。\nacceptance 模式：分点列出交付/补传了哪些文件、关键进展、结算/补录说明。不要改变验收状态，不要凭空说客户已确认。\n\n只返回优化后的文本（分点序号格式）和一句简短摘要。',
        },
        {
          role: 'user',
          content: JSON.stringify(aiPayload),
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: toolName,
            description: '返回优化后的任务进展或验收备注',
            parameters: {
              type: 'object',
              properties: {
                optimizedText: {
                  type: 'string',
                  description: '优化后的中文文本，必须用「1、」「2、」「3、」中文序号分点排列（每点一行，一行一件事），不要写成一大段。可直接写入进展记录或验收备注；保留事实，不编造文件内容、交付物、客户确认或验收结果。',
                },
                summary: {
                  type: 'string',
                  description: '一句话说明本次优化依据，例如结合了备注、文件名和进展记录。',
                },
              },
              required: ['optimizedText', 'summary'],
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: toolName } },
    }),
  })

  if (!response.ok) {
    const fallback = await callFallback()
    if (fallback) {
      return fallback
    }
    const errorText = await response.text().catch(() => '')
    return fail(`AI 助手请求失败：${response.status}${errorText ? ` ${errorText.slice(0, 160)}` : ''}`, 502)
  }

  const data = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>; content?: string } }>
  } | null
  const message = data?.choices?.[0]?.message
  const toolCall = message?.tool_calls?.find((item) => item.function?.name === toolName)
  let parsed = parseTextToolArguments(toolCall?.function?.arguments)
  if (!parsed.optimizedText && message?.content) {
    parsed = parseTextToolArguments(message.content)
  }

  const optimizedText = String(parsed.optimizedText ?? '').trim()
  if (!optimizedText) {
    const fallback = await callFallback()
    return fallback ?? fail('AI 助手没有返回有效建议，请稍后重试。', 502)
  }

  await audit(env, 'suggest', 'ai_text_assistant', taskTitle || mode, {
    mode,
    taskTitle,
    fileCount: files.length,
    uploadedFileCount: uploadedFileNames.length,
    provider: 'deepseek-direct',
  })
  return ok({ optimizedText, summary: String(parsed.summary ?? '').trim() })
}

async function suggestAttachmentNameWithAi(env: Env, request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    fileName?: string
    mimeType?: string
    imageBase64?: string
    note?: string
    recentFileNames?: string[]
    task?: {
      id?: number
      title?: string
      type?: string
      requirement?: string
      contact?: string
      requester?: string
      reviewer?: string
    }
  }
  const fileName = String(body.fileName ?? '').trim()
  if (!fileName) {
    return fail('请先添加需要命名的附件')
  }
  const dotIndex = fileName.lastIndexOf('.')
  const extension = dotIndex > 0 && dotIndex < fileName.length - 1 ? fileName.slice(dotIndex).toLowerCase() : ''
  const imageBase64 = String(body.imageBase64 ?? '').trim()
  const mimeType = String(body.mimeType ?? '').trim() || 'image/png'
  const recentFileNames = Array.isArray(body.recentFileNames)
    ? body.recentFileNames.map((item) => String(item).trim()).filter(Boolean).slice(-12)
    : []
  const payload = {
    currentFileName: fileName,
    requiredExtension: extension,
    progressNote: String(body.note ?? '').trim(),
    task: body.task ?? {},
    recentFileNames,
  }
  const prompt = `你是 Giverny 的设计交付文件命名助手。请分析附件内容和业务上下文，为设计师给出一个可直接使用的中文文件名。

分析优先级：
1. 如果提供了图片，先识别图片中的标题、项目名、版本、页面类型；企微/微信聊天截图、反馈截图、审批截图等，要准确描述其场景。
2. 结合任务名称、设计类型、任务需求和当前进展备注，避免只复述原始随机文件名。
3. 参考 recentFileNames 的真实命名习惯，但不要照抄无意义的截图时间戳。
4. 文件名必须简洁、可检索，主体建议 8-20 个中文字符，最多不超过 28 个中文字符；不要把任务标题全文、聊天原文、时间句子或失败原因塞进文件名。
5. 必须保留 requiredExtension；去掉 / \\ : * ? " < > | 等非法字符。
6. 如果确实无法识别附件内容，请返回空 suggestedName，不要编造兜底文件名。
7. 只返回 JSON，不要 Markdown，不要额外解释。

JSON 结构：
{"suggestedName":"包含扩展名的文件名，无法识别则为空字符串","reason":"不超过36字的命名依据","confidence":"低|中|高"}

输入：
${JSON.stringify(payload)}`

  const normalizeSuggestion = (output: string, fallbackUsed: boolean) => {
    const parsed = parseLooseJsonObject(output)
    const cleanedOutput = output
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
    const directName = cleanedOutput
      .split('\n')
      .map((line) => line
        .replace(/^[-*#\d.\s]+/, '')
        .replace(/^(建议文件名|文件名|名称)\s*[：:]\s*/i, '')
        .trim())
      .find((line) => line && line.length <= 70 && !line.includes('{') && !line.includes('}'))
    const extensionPattern = extension
      ? new RegExp(`([^\\n"'{}]{2,64})${extension.replace('.', '\\.')}\\b`, 'i')
      : null
    const matchedName = extensionPattern?.exec(cleanedOutput)?.[0]
    const rawName = String(
      parsed.suggestedName
      ?? parsed.fileName
      ?? parsed.filename
      ?? parsed.name
      ?? matchedName
      ?? directName
      ?? '',
    ).trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    if (!rawName) {
      return null
    }
    const parsedDotIndex = rawName.lastIndexOf('.')
    const rawBase = parsedDotIndex > 0 ? rawName.slice(0, parsedDotIndex) : rawName
    const safeBase = rawBase
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/[.\s-]+$/g, '')
      .trim()
    const invalidNamePattern = /(视觉模型|暂时不可用|响应超时|API\s*Key|已按任务|备用视觉|主视觉|没有返回|无法识别|建议：|建议:|命名暂时|失败|超时)/i
    const punctuationCount = (safeBase.match(/[，。；;、：:「」“”"']/g) ?? []).length
    if (
      !safeBase
      || invalidNamePattern.test(safeBase)
      || safeBase.length > 28
      || punctuationCount > 2
      || safeBase.includes('\n')
    ) {
      return null
    }
    const confidence = parsed.confidence === '高' || parsed.confidence === '中' || parsed.confidence === '低'
      ? parsed.confidence
      : imageBase64 ? '中' : '低'
    const reason = String(parsed.reason ?? parsed.basis ?? '已结合附件内容与任务上下文整理').trim()
    return {
      suggestedName: `${safeBase}${extension}`,
      reason: invalidNamePattern.test(reason) ? '已结合附件内容与任务上下文整理' : reason.slice(0, 36),
      confidence,
      fallbackUsed,
    }
  }

  const routes: AiModelRouteKey[] = ['visionPrimary', 'visionFallback']
  const attachmentNameTimeoutMs = 30_000
  let lastError = ''
  let configuredRouteCount = 0
  for (let index = 0; index < routes.length; index += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort('AI 命名请求超时'), attachmentNameTimeoutMs)
    try {
      const endpoint = await resolveAiEndpoint(env, routes[index])
      if (!endpoint.apiKey) {
        continue
      }
      configuredRouteCount += 1
      const output = imageBase64
        ? await callAiEndpointVision(endpoint, prompt, imageBase64, mimeType, 1024, controller.signal, true)
        : await callAiEndpointText(endpoint, prompt, 1024, controller.signal)
      const suggestion = normalizeSuggestion(output, index > 0)
      if (!suggestion) {
        lastError = `${endpoint.model} 返回内容无法解析为短文件名`
        console.warn(JSON.stringify({
          event: 'ai_attachment_name_unparseable',
          provider: endpoint.provider,
          model: endpoint.model,
          outputLength: output.length,
          usedImage: Boolean(imageBase64),
        }))
        continue
      }
      await audit(env, 'suggest', 'ai_attachment_name', String(body.task?.id ?? fileName), {
        originalName: fileName,
        suggestedName: suggestion.suggestedName,
        provider: endpoint.provider,
        model: endpoint.model,
        fallbackUsed: index > 0,
        usedImage: Boolean(imageBase64),
      })
      return ok(suggestion)
    } catch (error) {
      lastError = controller.signal.aborted
        ? `${routes[index] === 'visionPrimary' ? '主视觉模型' : '备用视觉模型'}响应超时`
        : error instanceof Error ? error.message : '模型请求失败'
    } finally {
      clearTimeout(timeout)
    }
  }
  if (configuredRouteCount === 0) {
    return fail('视觉模型尚未配置可用的 API Key', 503)
  }
  return fail(lastError ? `AI 命名暂时不可用：${lastError}` : '视觉模型没有返回可用命名建议，请稍后重试或手动命名。', 503)
}

async function suggestDailyKnowledgeWithAi(env: Env, request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    currentMonth?: string
    taskThemes?: string[]
    recentTitles?: string[]
  }
  const currentMonth = String(body.currentMonth ?? '').trim().slice(0, 7)
  const taskThemes = Array.isArray(body.taskThemes)
    ? [...new Set(body.taskThemes.map((item) => String(item).trim()).filter(Boolean))].slice(0, 12)
    : []
  const recentTitles = Array.isArray(body.recentTitles)
    ? [...new Set(body.recentTitles.map((item) => String(item).trim()).filter(Boolean))].slice(-30)
    : []
  const payload = {
    currentMonth,
    currentTaskThemes: taskThemes,
    recentlyShownTitles: recentTitles,
  }
  const prompt = `你是 Giverny 工作台的每日知识编辑。请生成一条适合成年人在工作间隙快速阅读的中文知识卡片；它不是“设计知识专栏”，而是一个有广度的内容池。

内容方向要像“工作间隙随手翻到的一页杂志”，广而有趣，不要自我限制。可以在以下栏目之间轮换，也可以自由扩展出同等质量的新栏目，尽量让连续几次的 category 不同：
- 视觉 / 艺术：人物・设计师、人物・画家、名画故事（如莫奈创作《睡莲》）、画作介绍、摄影史、建筑・工艺、博物馆冷知识、色彩科普、品牌故事
- 人文 / 人物：名人介绍（生平与传说故事，古今中外皆可，如黄仁勋、居里夫人）、作家小传、每天一本好书、哲学、神话、宗教故事、语言与文化、冷门历史人物
- 世界 / 历史：历史・冷知识、世界未解之谜、考古发现、古文明、各国国别史与王朝故事、战争冷知识、城市与旅行、地图故事、奇怪地名、民俗传说、历史上的今天
- 科学 / 自然：视觉科学、自然・植物、动物冷知识、天文小知识、心理学、科技冷知识、生活物理、人体小知识
- 财经 / 商业：股票与投资常识、金融冷知识、商业故事、公司与品牌兴衰、经济学小科普、商务礼仪、谈判与沟通技巧、职场观察
- 情感 / 关系：爱情故事、关系心理学、约会小技巧与小理由、沟通的艺术、社交礼仪、共情与表达
- 生活 / 风味：咖啡冷知识、茶・冷知识、食物史、香水故事、服饰史、节日由来、日用品来历
- 声音 / 表演：乐器科普、乐器・历史、音乐家故事、电影冷知识、戏剧故事、声音与声学
- 治愈 / 日常：治愈系小故事、温暖瞬间、解压与正念、生活美学、自然疗愈、慢生活
- 轻松 / 奇怪：冷笑话、乙方语言学、奇怪小知识、荒诞事实、脑洞问题、误解澄清、工作方法、沟通观察

可以偶尔借当前任务主题选择方向，但不要每次都回到设计，不要泄露、复述或猜测具体客户信息。

硬性规则：
1. 不得与 recentlyShownTitles 中的标题或核心观点重复。
2. 不要写空泛鸡汤、名人语录或无法核实的夸张结论；不要编造具体的实时新闻、当日热点或可被证伪的时效性事实（“历史上的今天”这类确有定论的内容可以）。
3. 标题不超过 18 个汉字；摘要不超过 42 个汉字。
4. 正文 2-5 段，每段约 40-180 个汉字。值得展开的题材（人物生平、传说故事、历史脉络等）可以写得更充实、更长，把故事讲完整；不必强行联系工作或设计。阅读弹窗支持滚动，不用怕长。
5. 正文每段最多用一次 **重点短语** 标记真正需要强调的关键词；不要整句加粗。
6. category 为 2-8 个汉字，例如“名画故事”“世界未解之谜”“股票冷知识”“商务礼仪”“爱情故事”“约会小技巧”“治愈系”“历史上的今天”。
7. 只返回 JSON，不要额外解释。

JSON 结构：
{"category":"string","title":"string","teaser":"string","body":["string","string","string"]}

输入：
${JSON.stringify(payload)}`

  const callRoute = async (route: AiModelRouteKey) => {
    const endpoint = await resolveAiEndpoint(env, route)
    if (!endpoint.apiKey) {
      return null
    }
    const output = await callAiEndpointText(endpoint, prompt, 1600)
    const parsed = parseLooseJsonObject(output) as DailyKnowledgeToolArgs
    const title = String(parsed.title ?? '').trim()
    const category = String(parsed.category ?? '').trim()
    const teaser = String(parsed.teaser ?? '').trim()
    const paragraphs = Array.isArray(parsed.body)
      ? parsed.body.map((item) => String(item).trim()).filter(Boolean).slice(0, 5)
      : []
    if (!title || !category || !teaser || paragraphs.length < 2 || recentTitles.includes(title)) {
      return null
    }
    return {
      category: category.slice(0, 12),
      source: `AI · ${endpoint.model}`,
      title: title.slice(0, 36),
      teaser: teaser.slice(0, 90),
      body: paragraphs,
    }
  }

  try {
    const suggestion = await callRoute('textPrimary')
    if (suggestion) {
      return ok(suggestion)
    }
  } catch {
    // Primary failures fall through to the configured text backup.
  }

  try {
    const fallback = await callRoute('textFallback')
    if (fallback) {
      return ok(fallback)
    }
  } catch {
    // The frontend has a curated fallback pool, so keep this endpoint concise.
  }

  return fail('AI 暂时没有生成可用内容', 503)
}

async function suggestHourEstimateWithAi(env: Env, request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    title?: string
    requirement?: string
    selectedType?: string
    startDate?: string
    estimatedDate?: string
  }
  const title = String(body.title ?? '').trim()
  const requirement = String(body.requirement ?? '').trim()
  const selectedType = String(body.selectedType ?? '').trim()
  if (!selectedType && !title && !requirement) {
    return fail('请先填写设计类型、项目名称或任务具体需求')
  }

  const exactRows = selectedType
    ? await env.DB.prepare(
        `SELECT * FROM tasks
         WHERE deleted_at IS NULL AND voided_at IS NULL
           AND actual_hours > 0
           AND design_type = ?
         ORDER BY CASE WHEN status = '已验收' THEN 0 ELSE 1 END, updated_at DESC
         LIMIT 24`,
      )
        .bind(selectedType)
        .all<DbTask>()
    : { results: [] as DbTask[], success: true }

  let tasks = exactRows.results ?? []
  let usedFallback = false
  const parentType = selectedType.split('/')[0]?.trim()
  if (tasks.length < 3 && parentType) {
    const fallbackRows = await env.DB.prepare(
      `SELECT * FROM tasks
       WHERE deleted_at IS NULL AND voided_at IS NULL
         AND actual_hours > 0
         AND design_type LIKE ?
       ORDER BY CASE WHEN status = '已验收' THEN 0 ELSE 1 END, updated_at DESC
       LIMIT 24`,
    )
      .bind(`${parentType}%`)
      .all<DbTask>()
    const knownIds = new Set(tasks.map((task) => task.id))
    tasks = [...tasks, ...((fallbackRows.results ?? []).filter((task) => !knownIds.has(task.id)))]
    usedFallback = tasks.some((task) => task.design_type !== selectedType)
  }

  if (tasks.length === 0) {
    const fallbackRows = await env.DB.prepare(
      `SELECT * FROM tasks
       WHERE deleted_at IS NULL AND voided_at IS NULL
         AND actual_hours > 0
       ORDER BY CASE WHEN status = '已验收' THEN 0 ELSE 1 END, updated_at DESC
       LIMIT 12`,
    ).all<DbTask>()
    tasks = fallbackRows.results ?? []
    usedFallback = true
  }

  const samples = tasks.map(toHourEstimateSample).filter((sample) => sample.actualHours > 0)
  const actualHours = samples.map((sample) => sample.actualHours)
  const deliveryCycles = samples.map((sample) => sample.deliveryCycleHours).filter((value) => value > 0)
  const sampleCount = samples.length
  const averageHours = Math.round(average(actualHours) * 100) / 100
  const medianHours = Math.round(numberListMedian(actualHours) * 100) / 100
  const minHours = actualHours.length ? Math.min(...actualHours) : 0
  const maxHours = actualHours.length ? Math.max(...actualHours) : 0
  const averageDeliveryDays = Math.round((average(deliveryCycles) / 24) * 10) / 10
  const currentPlanHours = roundToHalfHour(hoursBetweenDates(String(body.startDate ?? ''), String(body.estimatedDate ?? '')) || 2)
  const deterministicSuggestion = roundToHalfHour(sampleCount ? (medianHours * 0.6 + averageHours * 0.4) : currentPlanHours)

  if (sampleCount === 0) {
    return ok({
      suggestedHours: currentPlanHours,
      confidence: '低',
      basis: ['暂无可用历史实际工时，暂按当前预计开始与交付时间推算。'],
      historicalSummary: '还没有可用于同类工时分析的已记录实际工时。',
      sampleCount,
      averageHours,
      medianHours,
      minHours,
      maxHours,
      averageDeliveryDays,
      matchedType: selectedType,
      usedFallback,
    })
  }

  const aiPayload = {
    currentTask: {
      title,
      requirement,
      selectedType,
      startDate: body.startDate ?? '',
      estimatedDate: body.estimatedDate ?? '',
      currentPlanHours,
    },
    statistics: {
      sampleCount,
      averageHours,
      medianHours,
      minHours,
      maxHours,
      averageDeliveryDays,
      deterministicSuggestion,
      usedFallback,
    },
    historicalSamples: samples.slice(0, 12),
  }

  const runtimeSuggestion = await callBamlRuntime<HourEstimateToolArgs>(env, 'suggest-hours', aiPayload)
  if (runtimeSuggestion) {
    const parsedHours = Number(runtimeSuggestion.suggestedHours)
    const suggestedHours = roundToHalfHour(Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : deterministicSuggestion)
    const confidence = sampleCount < 3 ? '低' : runtimeSuggestion.confidence === '高' || runtimeSuggestion.confidence === '中' || runtimeSuggestion.confidence === '低' ? runtimeSuggestion.confidence : '中'
    const basis = Array.isArray(runtimeSuggestion.basis) ? runtimeSuggestion.basis.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 5) : []
    const historicalSummary = String(runtimeSuggestion.historicalSummary ?? '').trim() || `已参考 ${sampleCount} 条历史任务，实际工时中位数 ${medianHours} h，平均 ${averageHours} h。`
    await audit(env, 'suggest', 'ai_hour_estimate', title || selectedType || 'untitled', {
      selectedType,
      sampleCount,
      suggestedHours,
      confidence,
      usedFallback,
      provider: 'baml-runtime',
    })
    return ok({
      suggestedHours,
      confidence,
      basis: basis.length ? basis : [`历史实际工时中位数 ${medianHours} h，平均 ${averageHours} h。`],
      historicalSummary,
      sampleCount,
      averageHours,
      medianHours,
      minHours,
      maxHours,
      averageDeliveryDays,
      matchedType: selectedType,
      usedFallback,
    })
  }

  const normalizeHourSuggestion = async (parsed: HourEstimateToolArgs | null, provider: string) => {
    if (!parsed) {
      return null
    }
    const parsedHours = Number(parsed.suggestedHours)
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      return null
    }
    const suggestedHours = roundToHalfHour(parsedHours)
    const confidence = sampleCount < 3 ? '低' : parsed.confidence === '高' || parsed.confidence === '中' || parsed.confidence === '低' ? parsed.confidence : '中'
    const basis = Array.isArray(parsed.basis) ? parsed.basis.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 5) : []
    const historicalSummary = String(parsed.historicalSummary ?? '').trim() || `已参考 ${sampleCount} 条历史任务，实际工时中位数 ${medianHours} h，平均 ${averageHours} h。`
    await audit(env, 'suggest', 'ai_hour_estimate', title || selectedType || 'untitled', {
      selectedType,
      sampleCount,
      suggestedHours,
      confidence,
      usedFallback,
      provider,
    })
    return ok({
      suggestedHours,
      confidence,
      basis: basis.length ? basis : [`历史实际工时中位数 ${medianHours} h，平均 ${averageHours} h。`],
      historicalSummary,
      sampleCount,
      averageHours,
      medianHours,
      minHours,
      maxHours,
      averageDeliveryDays,
      matchedType: selectedType,
      usedFallback,
    })
  }

  const callFallback = async () =>
    normalizeHourSuggestion(
      await callTextFallbackJson<HourEstimateToolArgs>(
        env,
        '你是一个设计兼职任务的工时分析助理。请只基于系统提供的历史任务样本、实际工时、交付周期、验收备注和当前任务需求，给出新任务的预估工时建议。不要编造不存在的历史数据；样本少于 3 条时必须降低置信度。',
        aiPayload,
        'suggestedHours:number, confidence:"低"|"中"|"高", basis:string[], historicalSummary:string',
      ),
      'text-fallback',
    )

  if (!env.DEEPSEEK_API_KEY) {
    const fallback = await callFallback()
    return fallback ?? fail('DeepSeek API Key 尚未配置，备用文字模型也不可用。', 503)
  }

  const model = env.DEEPSEEK_MODEL || 'deepseek-chat'
  const baseUrl = (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
  const toolName = 'suggest_task_hour_estimate'
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      messages: [
        {
          role: 'system',
          content:
            '你是一个设计兼职任务的工时分析助理。请只基于系统提供的历史任务样本、实际工时、交付周期、验收备注和当前任务需求，给出新任务的预估工时建议。\n\n要求：不要编造不存在的历史数据；样本少于 3 条时必须降低置信度；需要结合验收备注判断返工、补传、尺寸/交付物复杂度；建议工时用小时数，优先参考历史实际工时的平均数和中位数，可以根据当前任务复杂度微调；依据要短、具体、可解释。',
        },
        {
          role: 'user',
          content: JSON.stringify(aiPayload),
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: toolName,
            description: '返回基于历史任务数据的工时建议',
            parameters: {
              type: 'object',
              properties: {
                suggestedHours: {
                  type: 'number',
                  description: '建议预估工时，单位小时。必须基于历史实际工时和当前任务复杂度。',
                },
                confidence: {
                  type: 'string',
                  enum: ['低', '中', '高'],
                  description: '置信度。样本少于 3 条时只能为低。',
                },
                basis: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '2-5 条中文依据，说明参考了哪些历史工时、交付周期、验收备注或当前需求因素。',
                },
                historicalSummary: {
                  type: 'string',
                  description: '一句中文总结历史同类任务表现。',
                },
              },
              required: ['suggestedHours', 'confidence', 'basis', 'historicalSummary'],
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: toolName } },
    }),
  })

  if (!response.ok) {
    const fallback = await callFallback()
    if (fallback) {
      return fallback
    }
    const errorText = await response.text().catch(() => '')
    return fail(`AI 工时建议请求失败：${response.status}${errorText ? ` ${errorText.slice(0, 160)}` : ''}`, 502)
  }

  const data = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>; content?: string } }>
  } | null
  const message = data?.choices?.[0]?.message
  const toolCall = message?.tool_calls?.find((item) => item.function?.name === toolName)
  let parsed = parseHourEstimateToolArguments(toolCall?.function?.arguments)
  if (!parsed.suggestedHours && message?.content) {
    parsed = parseHourEstimateToolArguments(message.content)
  }
  const fallbackResult = !parsed.suggestedHours ? await callFallback() : null
  if (fallbackResult) {
    return fallbackResult
  }

  const parsedHours = Number(parsed.suggestedHours)
  const suggestedHours = roundToHalfHour(Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : deterministicSuggestion)
  const confidence = sampleCount < 3 ? '低' : parsed.confidence === '高' || parsed.confidence === '中' || parsed.confidence === '低' ? parsed.confidence : '中'
  const basis = Array.isArray(parsed.basis) ? parsed.basis.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 5) : []
  const historicalSummary = String(parsed.historicalSummary ?? '').trim() || `已参考 ${sampleCount} 条历史任务，实际工时中位数 ${medianHours} h，平均 ${averageHours} h。`

  await audit(env, 'suggest', 'ai_hour_estimate', title || selectedType || 'untitled', {
    selectedType,
    sampleCount,
    suggestedHours,
    confidence,
    usedFallback,
    provider: 'deepseek-direct',
  })

  return ok({
    suggestedHours,
    confidence,
    basis: basis.length ? basis : [`历史实际工时中位数 ${medianHours} h，平均 ${averageHours} h。`],
    historicalSummary,
    sampleCount,
    averageHours,
    medianHours,
    minHours,
    maxHours,
    averageDeliveryDays,
    matchedType: selectedType,
    usedFallback,
  })
}

async function generateMonthlyReport(env: Env, request: Request) {
  const body = (await request.json()) as { month: string; hourlyRate: number; importedHours?: number }
  const rows = await env.DB.prepare("SELECT * FROM tasks WHERE settlement_month = ? AND deleted_at IS NULL AND voided_at IS NULL").bind(body.month).all<DbTask>()
  const tasks = rows.results ?? []
  const importedHours = Number(body.importedHours) || 0
  const hourlyRate = Number(body.hourlyRate) || defaultHourlyRate
  const roundCents = (value: number) => Math.round(value * 100) / 100
  const totalHours = tasks.reduce((sum, task) => sum + Number(task.actual_hours), importedHours)
  const billableHours = tasks.filter((task) => task.is_billable).reduce((sum, task) => sum + Number(task.actual_hours), importedHours)
  // 每行取真实金额（精确到分，不取整到元），再求和，保证回单「明细金额之和 === 总额」（与前端 sumBillableAmount 一致）
  const totalAmount = roundCents(
    tasks
      .filter((task) => task.is_billable && Number(task.actual_hours) > 0)
      .reduce((sum, task) => sum + roundCents(Number(task.actual_hours) * hourlyRate), 0)
    + (importedHours > 0 ? roundCents(importedHours * hourlyRate) : 0),
  )

  // 每月只保留一条结算记录：重复锁定时更新数据但保留原 token，已发给甲方的链接不会失效
  const existing = await env.DB.prepare('SELECT id, public_token FROM monthly_reports WHERE month = ?').bind(body.month).first<{
    id: string
    public_token: string | null
  }>()

  const id = existing?.id ?? `report-${body.month}-${Date.now()}`
  const publicToken = existing?.public_token ?? crypto.randomUUID()

  if (existing) {
    await env.DB.prepare(
      `UPDATE monthly_reports SET total_hours = ?, billable_hours = ?, total_amount = ?, status = 'locked',
         public_token = ?, generated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
      .bind(totalHours, billableHours, totalAmount, publicToken, id)
      .run()
  } else {
    await env.DB.prepare(
      `INSERT INTO monthly_reports (id, month, total_hours, billable_hours, total_amount, status, public_token, generated_at)
       VALUES (?, ?, ?, ?, ?, 'locked', ?, CURRENT_TIMESTAMP)`,
    )
      .bind(id, body.month, totalHours, billableHours, totalAmount, publicToken)
      .run()
  }

  await audit(env, 'lock', 'monthly_report', id, { month: body.month, totalHours, billableHours, totalAmount })
  return ok({ id, month: body.month, totalHours, billableHours, totalAmount, publicToken })
}

async function rotateMonthlyReportToken(env: Env, reportId: string) {
  const existing = await env.DB.prepare('SELECT * FROM monthly_reports WHERE id = ?').bind(reportId).first<DbReport>()
  if (!existing) {
    return fail('结算记录不存在', 404)
  }

  const publicToken = crypto.randomUUID()
  await env.DB.prepare('UPDATE monthly_reports SET public_token = ?, viewed_at = NULL, view_count = 0 WHERE id = ?')
    .bind(publicToken, reportId)
    .run()
  const updated = await env.DB.prepare('SELECT * FROM monthly_reports WHERE id = ?').bind(reportId).first<DbReport>()
  await audit(env, 'rotate_share_token', 'monthly_report', reportId, { month: existing.month })
  return ok({ report: toReport(updated ?? { ...existing, public_token: publicToken, viewed_at: null, view_count: 0 }) })
}

async function handleApi(request: Request, env: Env, ctx?: WorkerExecutionContext) {
  const url = new URL(request.url)
  const path = url.pathname
  const isGet = request.method === 'GET' || request.method === 'HEAD'

  // 公开接口：健康检查、登录、甲方分享页、文件预览（预览内部自行校验权限）
  const isPublic =
    path === '/api/health' ||
    path === '/api/auth/login' ||
    path === '/api/auth/password-reset/request' ||
    path === '/api/auth/password-reset/confirm' ||
    (isGet && path.startsWith('/api/shared/')) ||
    (isGet && path.startsWith('/api/files/') && (path.endsWith('/preview') || path.endsWith('/source')))

  // 读取接口默认允许游客以只读成员身份访问；写入接口仍需管理员邮箱 + 平台密码。
  let role: AuthRole = 'member'
  const authEnabled = Boolean(env.ADMIN_TOKEN || (await getSettingValue(env, ADMIN_PASSWORD_SETTING)))
  if (authEnabled && !isPublic) {
    const resolved = await resolveRole(
      env,
      request.headers.get('x-auth-key') ?? '',
      request.headers.get('x-auth-email') ?? '',
    )
    if (resolved) {
      role = resolved
    } else if (!isGet) {
      return fail('登录已失效，请重新登录', 401)
    }
  }

  // 口令管理只对管理员开放
  if (path.startsWith('/api/tokens') && role !== 'admin') {
    return fail('需要管理员权限', 403)
  }
  if (
    (
      path === '/api/settings/design-types' ||
      path === '/api/settings/design-type-groups' ||
      path === '/api/settings/ai-model' ||
      path === '/api/ai/model-test' ||
      path === '/api/insights/attachment-analyses/backfill' ||
      path === '/api/insights/diagnose' ||
      path === '/api/insights/history' ||
      path.endsWith('/analysis/retry')
    ) &&
    role !== 'admin'
  ) {
    return fail('需要管理员权限', 403)
  }
  if (!isPublic && !isGet && role !== 'admin') {
    return fail('需要管理员权限', 403)
  }

  if (path === '/api/health') {
    return ok({ ok: true, storage: 'D1/R2', checkedAt: nowIso() })
  }
  if (path === '/api/auth/login' && request.method === 'POST') {
    return login(env, request)
  }
  if (path === '/api/auth/password-reset/request' && request.method === 'POST') {
    return requestPasswordReset(env, request)
  }
  if (path === '/api/auth/password-reset/confirm' && request.method === 'POST') {
    return confirmPasswordReset(env, request)
  }
  if (path === '/api/auth/password' && request.method === 'POST') {
    return changeAdminPassword(env, request)
  }
  if (path.startsWith('/api/shared/') && isGet) {
    return getSharedReport(env, path.split('/').pop() ?? '')
  }
  if (path === '/api/tokens' && request.method === 'POST') {
    return createAccessToken(env, request)
  }
  if (path.startsWith('/api/tokens/') && request.method === 'PATCH') {
    return updateAccessToken(env, path.split('/').pop() ?? '', request)
  }
  if (path.startsWith('/api/tokens/') && request.method === 'DELETE') {
    return deleteAccessToken(env, path.split('/').pop() ?? '')
  }
  if (path === '/api/state' && request.method === 'GET') {
    return getState(env, role)
  }
  if (path === '/api/tasks' && request.method === 'POST') {
    return createTask(env, request)
  }
  if (path.startsWith('/api/tasks/') && path.endsWith('/entry-attachments') && request.method === 'PATCH') {
    return setEntryAttachmentsArchived(env, path.split('/')[3], request)
  }
  if (path.startsWith('/api/tasks/') && request.method === 'PATCH') {
    return updateTask(env, path.split('/').pop() ?? '', request)
  }
  if (path.startsWith('/api/tasks/') && path.endsWith('/void') && request.method === 'POST') {
    return voidTask(env, path.split('/')[3], request)
  }
  if (path.startsWith('/api/tasks/') && path.endsWith('/restore') && request.method === 'POST') {
    return restoreTask(env, path.split('/')[3])
  }
  if (path.startsWith('/api/tasks/') && request.method === 'DELETE') {
    return deleteTask(env, path.split('/').pop() ?? '')
  }
  if (path === '/api/updates' && request.method === 'POST') {
    return createUpdate(env, request)
  }
  if (path.startsWith('/api/updates/') && request.method === 'PATCH') {
    return updateUpdate(env, path.split('/').pop() ?? '', request)
  }
  if (path.startsWith('/api/updates/') && request.method === 'DELETE') {
    return deleteUpdate(env, path.split('/').pop() ?? '')
  }
  if (path.startsWith('/api/tasks/') && path.endsWith('/activity') && request.method === 'GET') {
    return getTaskActivity(env, path.split('/')[3])
  }
  if (path.startsWith('/api/activity/') && request.method === 'DELETE') {
    return deleteActivity(env, path.split('/').pop() ?? '')
  }
  if (path === '/api/files/multipart/init' && request.method === 'POST') {
    return initMultipartUpload(env, request)
  }
  if (path === '/api/files/multipart/part' && request.method === 'PUT') {
    return uploadMultipartPart(env, request)
  }
  if (path === '/api/files/multipart/complete' && request.method === 'POST') {
    return completeMultipartUpload(env, request, ctx)
  }
  if (path === '/api/files' && request.method === 'POST') {
    return createFile(env, request, ctx)
  }
  if (path.startsWith('/api/files/') && path.endsWith('/analysis/retry') && request.method === 'POST') {
    return retryAttachmentAnalysis(env, path.split('/')[3], ctx)
  }
  if (path.startsWith('/api/files/') && path.endsWith('/preview') && request.method === 'POST') {
    return setFilePreview(env, path.split('/')[3], request)
  }
  if (path.startsWith('/api/files/') && path.endsWith('/preview') && request.method === 'GET') {
    return getFilePreview(env, path.split('/')[3], request)
  }
  if (path.startsWith('/api/files/') && path.endsWith('/source') && request.method === 'GET') {
    return getFileSource(env, path.split('/')[3], request)
  }
  if (path.startsWith('/api/files/') && request.method === 'PATCH') {
    return updateFileMetadata(env, path.split('/').pop() ?? '', request)
  }
  if (path.startsWith('/api/files/') && request.method === 'DELETE') {
    return deleteFile(env, path.split('/').pop() ?? '')
  }
  if (path === '/api/ai/task-assistant' && request.method === 'POST') {
    return suggestTaskWithAi(env, request)
  }
  if (path === '/api/ai/text-assistant' && request.method === 'POST') {
    return optimizeTaskTextWithAi(env, request)
  }
  if (path === '/api/ai/attachment-name' && request.method === 'POST') {
    return suggestAttachmentNameWithAi(env, request)
  }
  if (path === '/api/ai/hour-estimate' && request.method === 'POST') {
    return suggestHourEstimateWithAi(env, request)
  }
  if (path === '/api/ai/progress-estimate' && request.method === 'POST') {
    return estimateTaskProgressWithAi(env, request)
  }
  if (path === '/api/ai/daily-knowledge' && request.method === 'POST') {
    return suggestDailyKnowledgeWithAi(env, request)
  }
  if (path === '/api/ai/model-test' && request.method === 'POST') {
    return testAiModelRoute(env, request)
  }
  if (path === '/api/insights/attachment-analyses/backfill' && request.method === 'POST') {
    return backfillAttachmentAnalyses(env, ctx)
  }
  if (path === '/api/insights/diagnose' && request.method === 'POST') {
    return diagnoseInsights(env, request)
  }
  if (path === '/api/insights/history' && request.method === 'GET') {
    return getInsightHistory(env)
  }
  if (path === '/api/settings/ai-model' && request.method === 'GET') {
    return getAiModelConfig(env)
  }
  if (path === '/api/settings/ai-model' && request.method === 'PATCH') {
    return setAiModelConfig(env, request)
  }
  if (path === '/api/settings/hourly-rate' && request.method === 'PATCH') {
    return setHourlyRate(env, request)
  }
  if (path === '/api/settings/pdf-title' && request.method === 'PATCH') {
    return setPdfTitle(env, request)
  }
  if (path === '/api/settings/service-company' && request.method === 'PATCH') {
    return setServiceCompanyName(env, request)
  }
  if (path === '/api/settings/tax-mode' && request.method === 'PATCH') {
    return setTaxMode(env, request)
  }
  if (path === '/api/settings/design-types' && request.method === 'PATCH') {
    return setDesignTypes(env, request)
  }
  if (path === '/api/settings/design-type-groups' && request.method === 'PATCH') {
    return setDesignTypeGroups(env, request)
  }
  if (path === '/api/reports/monthly' && request.method === 'POST') {
    return generateMonthlyReport(env, request)
  }
  if (path.startsWith('/api/reports/') && path.endsWith('/token') && request.method === 'POST') {
    return rotateMonthlyReportToken(env, path.split('/')[3] ?? '')
  }

  return fail('接口不存在', 404)
}

export default {
  async fetch(request: Request, env: Env, ctx: WorkerExecutionContext) {
    const url = new URL(request.url)
    if (url.protocol === 'http:') {
      url.protocol = 'https:'
      return Response.redirect(url.toString(), 301)
    }

    const withSecurityHeaders = (response: Response) => {
      const headers = new Headers(response.headers)
      headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains; preload')
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
    }

    if (url.pathname.startsWith('/api/')) {
      try {
        return withSecurityHeaders(await handleApi(request, env, ctx))
      } catch (error) {
        const message = error instanceof Error ? error.message : '后端服务异常'
        return withSecurityHeaders(fail(message, 500))
      }
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request))
  },
  async scheduled(_controller: unknown, env: Env) {
    await purgeExpiredProgressAttachments(env).catch((error) => {
      console.error('progress attachment retention cleanup failed', error)
    })
    await processPendingAttachmentAnalyses(env, 1)
    await runEventDrivenInsights(env, 1).catch((error) => {
      console.error('insight event trigger failed', error)
    })
  },
}
