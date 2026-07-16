import { serve } from '@hono/node-server'
import { ClientRegistry } from '@boundaryml/baml'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { b } from './baml_client/baml_client/index.js'

type AiProvider = 'deepseek' | 'openai' | 'openrouter' | 'anthropic' | 'custom-openai'

type RuntimeModelConfig = {
  provider?: AiProvider
  baseUrl?: string
  model?: string
  apiKey?: string
}

type RuntimeBody = {
  input?: unknown
  model?: RuntimeModelConfig
}

const app = new Hono()

function runtimeKey() {
  return process.env.AI_RUNTIME_KEY?.trim() ?? ''
}

function assertAuthorized(value: string | undefined) {
  const key = runtimeKey()
  return !key || value === key
}

function normalizeModelConfig(model: RuntimeModelConfig | undefined) {
  const provider = model?.provider ?? 'deepseek'
  const defaultBaseUrl = provider === 'deepseek' ? 'https://api.deepseek.com' : provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : ''
  const defaultModel = provider === 'deepseek' ? 'deepseek-v4-flash' : provider === 'openai' ? 'gpt-4.1-mini' : ''
  const requestedModel = model?.model || defaultModel
  return {
    provider,
    baseUrl: (model?.baseUrl || defaultBaseUrl).replace(/\/$/, ''),
    model: provider === 'deepseek' && (requestedModel === 'deepseek-chat' || requestedModel === 'deepseek-reasoner')
      ? 'deepseek-v4-flash'
      : requestedModel,
    apiKey: model?.apiKey || '',
  }
}

function bamlProvider(provider: AiProvider) {
  if (provider === 'anthropic') {
    return 'anthropic'
  }
  if (provider === 'openai') {
    return 'openai'
  }
  return 'openai-generic'
}

function buildRegistry(model: RuntimeModelConfig | undefined) {
  const normalized = normalizeModelConfig(model)
  if (!normalized.apiKey) {
    throw new Error('模型 API Key 为空，请先在主站设置页配置。')
  }
  if (!normalized.model) {
    throw new Error('模型名称为空，请先在主站设置页配置。')
  }

  const registry = new ClientRegistry()
  const options: Record<string, string> = {
    api_key: normalized.apiKey,
    model: normalized.model,
  }
  if (normalized.baseUrl && normalized.provider !== 'openai' && normalized.provider !== 'anthropic') {
    options.base_url = normalized.baseUrl
  }
  registry.addLlmClient('TenantModel', bamlProvider(normalized.provider), options)
  registry.setPrimary('TenantModel')
  return registry
}

async function readBody(c: Context) {
  const body = await c.req.json<RuntimeBody>().catch(() => ({}))
  return {
    input: body.input ?? {},
    registry: buildRegistry(body.model),
  }
}

app.get('/health', (c) => c.json({ ok: true, runtime: 'baml-node', checkedAt: new Date().toISOString() }))

app.use('/v1/*', async (c, next) => {
  if (!assertAuthorized(c.req.header('x-ai-runtime-key'))) {
    return c.json({ error: 'AI Runtime 未授权' }, 401)
  }
  await next()
})

app.post('/v1/suggest-task', async (c) => {
  const { input, registry } = await readBody(c)
  const result = await b.SuggestTaskAssistant(JSON.stringify(input), { clientRegistry: registry })
  return c.json(result)
})

app.post('/v1/optimize-text', async (c) => {
  const { input, registry } = await readBody(c)
  const result = await b.OptimizeTaskText(JSON.stringify(input), { clientRegistry: registry })
  return c.json(result)
})

app.post('/v1/suggest-hours', async (c) => {
  const { input, registry } = await readBody(c)
  const result = await b.SuggestHourEstimate(JSON.stringify(input), { clientRegistry: registry })
  return c.json(result)
})

app.onError((error, c) => {
  console.error(error)
  return c.json({ error: error instanceof Error ? error.message : 'AI Runtime 请求失败' }, 500)
})

const port = Number(process.env.PORT || 8080)

serve({ fetch: app.fetch, port })
console.log(`Giverny AI Runtime listening on :${port}`)
