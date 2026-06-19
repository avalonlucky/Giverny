import { defaultDesignTypeGroups, defaultDesignTypes, defaultHourlyRate, defaultPdfTitle, defaultServiceCompanyName, type DesignTypeGroup } from './config/appConfig'
import type { FileAsset, Task, TaskUpdate, TaxMode, TimeEntry } from './types/domain'

type D1Result<T = unknown> = { results?: T[]; success: boolean }
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
  acceptance_note: string | null
  time_entries_json: string | null
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
  task_title: string | null
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

const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))

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

function extractOpenAiText(data: { choices?: Array<{ message?: { content?: string } }> } | null) {
  return data?.choices?.[0]?.message?.content?.trim() || ''
}

async function callAiEndpointText(endpoint: Awaited<ReturnType<typeof resolveAiEndpoint>>, prompt: string) {
  if (!endpoint.apiKey) {
    throw new Error('模型 API Key 未配置')
  }
  if (endpoint.provider === 'gemini') {
    const response = await fetch(`${endpoint.baseUrl}/models/${endpoint.model}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': endpoint.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 64 },
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
    headers: {
      authorization: `Bearer ${endpoint.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: endpoint.model,
      temperature: kimiTemperature(endpoint.provider, endpoint.model),
      max_tokens: 64,
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

async function callAiEndpointVision(endpoint: Awaited<ReturnType<typeof resolveAiEndpoint>>, prompt: string, imageBase64: string, mimeType = 'image/png') {
  if (!endpoint.apiKey) {
    throw new Error('模型 API Key 未配置')
  }
  if (endpoint.provider === 'gemini') {
    const response = await fetch(`${endpoint.baseUrl}/models/${endpoint.model}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': endpoint.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
        generationConfig: { maxOutputTokens: 64 },
      }),
    })
    const data = (await response.json().catch(() => null)) as { error?: { message?: string }; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null
    if (!response.ok || data?.error) {
      throw new Error(data?.error?.message || `识图请求失败：${response.status}`)
    }
    return extractGeminiText(data)
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
      max_tokens: 96,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
    }),
  })
  const data = (await response.json().catch(() => null)) as { error?: { message?: string }; choices?: Array<{ message?: { content?: string } }> } | null
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || `识图请求失败：${response.status}`)
  }
  return extractOpenAiText(data)
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
  settlementMonth: row.settlement_month || '',
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
  suspendReason: row.suspend_reason ?? '',
  terminateReason: row.terminate_reason ?? '',
  acceptanceNote: row.acceptance_note ?? '',
  timeEntries: parseTimeEntries(row.time_entries_json),
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
            start: String((entry as TimeEntry).start ?? ''),
            end: String((entry as TimeEntry).end ?? ''),
            note: String((entry as TimeEntry).note ?? ''),
          }))
          .filter((entry) => entry.start && entry.end)
      : []
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
  name: row.file_name,
  task: row.task_title ?? '未关联任务',
  type: row.file_type ?? 'FILE',
  size: row.display_size ?? `${row.file_size ?? 0} B`,
  uploadedAt: formatBeijing(row.uploaded_at),
  final: Boolean(row.is_final),
  visible: Boolean(row.visible_to_client),
  tag: row.file_tag ?? '',
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

  const [taskRows, updateRows, fileRows, rateRow, pdfTitle, serviceCompanyName, taxMode, designTypeGroups, aiModelConfig, reportRows] = await Promise.all([
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
       WHERE tasks.deleted_at IS NULL ${role === 'admin' ? '' : 'AND tasks.voided_at IS NULL AND attachments.visible_to_client = 1'}
       ORDER BY uploaded_at DESC`,
    ).all<DbAttachment>(),
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
       WHERE attachments.visible_to_client = 1
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
  await env.DB.prepare(
    `INSERT INTO tasks (
      id, title, requirement, design_type, start_date, estimated_delivery_date, actual_delivery_date, settlement_month,
      estimated_hours, actual_hours, hourly_rate, requester, contact_person, reviewer, stage, status, progress,
      suspend_reason, terminate_reason, acceptance_note, time_entries_json, is_billable
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      task.title,
      task.requirement,
      task.type,
      task.date,
      task.estimatedDate || task.date,
      task.status === '已验收' ? nowIso() : null,
      task.settlementMonth || monthPart(nowIso()),
      task.estimatedHours,
      task.actualHours,
      hourlyRate,
      task.requester ?? '',
      task.contact,
      task.reviewer,
      task.stage,
      task.status,
      task.progress,
      task.suspendReason ?? '',
      task.terminateReason ?? '',
      task.acceptanceNote ?? '',
      JSON.stringify(task.timeEntries ?? []),
      task.status === '不计费' ? 0 : 1,
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
  return ok({ ...task, id: Number(id), files: [] }, 201)
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
  if (current.status === '已验收') {
    if (changes.status && changes.status !== '已验收') {
      return fail('已验收任务状态已锁定，不能直接改回其他状态', 409)
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'actualHours') || Object.prototype.hasOwnProperty.call(changes, 'timeEntries')) {
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
    acceptanceNote: changes.acceptanceNote ?? current.acceptance_note ?? '',
    timeEntries: changes.timeEntries ?? parseTimeEntries(current.time_entries_json),
  }

  await env.DB.prepare(
    `UPDATE tasks SET
      title = ?, requirement = ?, design_type = ?, start_date = ?, estimated_delivery_date = ?, settlement_month = ?, estimated_hours = ?, actual_hours = ?,
      requester = ?, contact_person = ?, reviewer = ?, stage = ?, status = ?, progress = ?,
      suspend_reason = ?, terminate_reason = ?, acceptance_note = ?, time_entries_json = ?, is_billable = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  )
    .bind(
      next.title,
      next.requirement,
      next.type,
      next.date,
      next.estimatedDate || null,
      next.settlementMonth || monthPart(nowIso()),
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
      next.acceptanceNote,
      JSON.stringify(next.timeEntries),
      next.status === '不计费' ? 0 : 1,
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
  const rows = await env.DB.prepare(
    `SELECT * FROM audit_log
     WHERE (entity_type = 'task' AND entity_id = ?) OR entity_type IN ('attachment', 'update')
     ORDER BY created_at DESC LIMIT 400`,
  )
    .bind(taskId)
    .all<{ id: string; action: string; entity_type: string; entity_id: string; payload_json: string | null; created_at: string }>()

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

async function createFile(env: Env, request: Request) {
  const form = await request.formData()
  const file = form.get('file')
  const preview = form.get('preview')
  if (!(file instanceof File)) {
    return fail('缺少上传文件')
  }

  const id = String(Date.now())
  const taskId = String(form.get('taskId') ?? '')
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
  })
  if (saved instanceof Response) {
    return saved
  }
  return ok(saved, 201)
}

const sanitizeFileName = (name: string) => name.replace(/[^\w.\-一-龥]/g, '_')

async function insertAttachment(
  env: Env,
  payload: {
    id: string
    taskId: string
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
  },
) {
  const uploadedAt = nowIso()
  const task = await env.DB.prepare('SELECT title FROM tasks WHERE id = ? AND deleted_at IS NULL').bind(payload.taskId).first<{ title: string }>()
  if (!task) {
    return fail('任务不存在或已删除', 404)
  }
  await env.DB.prepare(
    `INSERT INTO attachments (
      id, task_id, file_name, file_type, mime_type, r2_key, preview_r2_key, file_size, display_size, is_final, visible_to_client, file_tag, uploaded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      payload.id,
      payload.taskId,
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
    fileName: payload.fileName,
    fileSize: payload.fileSize,
    final: payload.final,
    visible: payload.visible,
    tag: payload.tag ?? '',
  })

  return {
    id: Number(payload.id),
    taskId: Number(payload.taskId),
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
  const body = (await request.json()) as { taskId: number; fileName: string; contentType?: string }
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

async function completeMultipartUpload(env: Env, request: Request) {
  const form = await request.formData()
  const key = String(form.get('key') ?? '')
  const uploadId = String(form.get('uploadId') ?? '')
  const fileId = String(form.get('fileId') ?? Date.now())
  const taskId = String(form.get('taskId') ?? '')
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
  })
  if (saved instanceof Response) {
    return saved
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
       AND attachments.visible_to_client = 1
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

async function getFilePreview(env: Env, id: string, request: Request) {
  const row = await env.DB.prepare('SELECT preview_r2_key, mime_type, visible_to_client FROM attachments WHERE id = ?').bind(id).first<{
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
  const row = await env.DB.prepare('SELECT file_name, r2_key, mime_type, visible_to_client FROM attachments WHERE id = ?').bind(id).first<{
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
  const current = await env.DB.prepare('SELECT file_name, file_tag FROM attachments WHERE id = ?').bind(id).first<{ file_name: string; file_tag: string | null }>()
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
    WHERE a.id = ?
  `).bind(id).first<DbAttachment>()
  return ok(row ? toFile(row) : { ok: true })
}

async function deleteFile(env: Env, id: string) {
  const row = await env.DB.prepare(`
    SELECT attachments.task_id, attachments.file_name, attachments.r2_key, attachments.preview_r2_key, tasks.settlement_month
    FROM attachments
    LEFT JOIN tasks ON tasks.id = attachments.task_id
    WHERE attachments.id = ?
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
  await env.DB.prepare('DELETE FROM attachments WHERE id = ?').bind(id).run()
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

async function suggestTaskWithAi(env: Env, request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    title?: string
    requirement?: string
    selectedType?: string
    designTypeGroups?: DesignTypeGroup[]
  }
  const title = String(body.title ?? '').trim()
  const requirement = String(body.requirement ?? '').trim()
  if (!title && !requirement) {
    return fail('请先填写项目名称或任务具体需求')
  }

  const storedGroups = await getDesignTypeGroups(env)
  const designTypeGroups = normalizeDesignTypeGroups(body.designTypeGroups?.length ? body.designTypeGroups : storedGroups)
  const aiPayload = {
    taskTitle: title,
    rawRequirement: requirement,
    selectedType: body.selectedType ?? '',
    availableDesignTypeGroups: designTypeGroups,
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
      '你是一个平面设计兼职任务助理。请把用户的原始需求改写成专业、可执行、可直接写入任务单的中文描述，并从已有设计类型中选择最贴近的大类和子类。不要编造用户没有提供的事实。',
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
            '你是一个平面设计兼职任务助理。请把用户的原始需求改写成专业、可执行、可直接写入任务单的中文描述，并从已有设计类型中选择最贴近的大类和子类。若确实没有合适分类，可以建议新分类，但不要编造不必要的新分类。\n\n改写目标：不是只排版，而是把口语化表达改成专业任务单语言；把模糊描述整理成可执行要求；把散乱信息归并到对应模块。\n\n允许：修正语病；归并重复信息；把用户已经表达的需求整理成明确动作；基于原文把“用途/场景/对接背景/必须包含内容/输出清单”补全到对应模块。\n禁止：凭空编造用户没提过的交付物、尺寸、品牌规范、交付承诺或验收标准；丢失用户提到的背景、约束、文件名、版本号、数量；写客套话或解释你做了什么。\n\n输出必须严格使用以下三段固定模板，段标题一字不改，用换行 \\n 分隔：\n1、设计背景：[项目用途/场景/对接背景]\n2、设计要求：[风格/调性/必须包含的元素/区域]\n3、输出文件：[交付物清单]\n\n方括号只是提示含义，最终不要保留方括号。用户没有提供的信息写“未明确，可在对接时确认”，不要自己编。整体读起来像一条专业的内部设计任务单。',
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
      '你是一个设计兼职任务管理助手。请基于任务信息、进展记录、文件/交付件名称和用户已写文本，优化成可直接写入系统的中文记录。保留事实，不要编造文件内容、交付物、客户确认或验收结果。',
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
            '你是一个设计兼职任务管理助手。请基于任务信息、进展记录、文件/交付件名称和用户已写文本，优化成可直接写入系统的中文记录。\n\n要求：保留事实；不要编造文件内容、未出现的交付物、验收结果、客户反馈或承诺；如果只能从文件名判断，请使用“已上传/已补充”这类稳妥表达；语言要专业、简洁、像内部工作记录。\n\nprogress 模式：输出 1-3 句进展记录，说明当前完成到哪一步、已上传哪些过程附件、下一步如有明确事实可写。不要写成正式验收结论。\nacceptance 模式：输出验收备注，说明交付/补传文件、关键进展和结算/补录说明。不要改变验收状态，不要凭空说客户已确认。\n\n只返回优化后的文本和一句简短摘要。',
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
                  description: '优化后的中文文本。必须可直接写入进展记录或验收备注；保留事实，不编造文件内容、交付物、客户确认或验收结果。',
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
  const totalHours = tasks.reduce((sum, task) => sum + Number(task.actual_hours), importedHours)
  const billableHours = tasks.filter((task) => task.is_billable).reduce((sum, task) => sum + Number(task.actual_hours), importedHours)
  const totalAmount = Math.round(billableHours * (Number(body.hourlyRate) || defaultHourlyRate))

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

async function handleApi(request: Request, env: Env) {
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
    const resolved = await resolveRole(env, request.headers.get('x-auth-key') ?? '', request.headers.get('x-auth-email') ?? '')
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
  if ((path === '/api/settings/design-types' || path === '/api/settings/design-type-groups' || path === '/api/settings/ai-model' || path === '/api/ai/model-test') && role !== 'admin') {
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
    return completeMultipartUpload(env, request)
  }
  if (path === '/api/files' && request.method === 'POST') {
    return createFile(env, request)
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
  if (path === '/api/ai/hour-estimate' && request.method === 'POST') {
    return suggestHourEstimateWithAi(env, request)
  }
  if (path === '/api/ai/model-test' && request.method === 'POST') {
    return testAiModelRoute(env, request)
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
  async fetch(request: Request, env: Env) {
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
        return withSecurityHeaders(await handleApi(request, env))
      } catch (error) {
        const message = error instanceof Error ? error.message : '后端服务异常'
        return withSecurityHeaders(fail(message, 500))
      }
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request))
  },
}
