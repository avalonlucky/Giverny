import type { AiModelConfig, AiModelProvider } from './api'

const AI_GATEWAY_BASE = 'https://gateway.ai.cloudflare.com/v1/ccd312f47f0dca574199fa6e33758c6d/mayeai-gateway'
const DOUBAO_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
const DOUBAO_SEED_PRO_MODEL = 'doubao-seed-2-1-pro-260628'
const QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const QWEN_DEFAULT_MODEL = 'qwen3.7-plus'

export function providerSupportsVision(provider: AiModelProvider) {
  return provider === 'gemini' || provider === 'kimi' || provider === 'doubao' || provider === 'qwen' || provider === 'openai' || provider === 'openrouter' || provider === 'custom-openai'
}

// Providers unsupported by Cloudflare AI Gateway intentionally use direct endpoints.
export function gatewayBaseUrlForProvider(provider: AiModelConfig['provider']): string {
  switch (provider) {
    case 'deepseek':
      return `${AI_GATEWAY_BASE}/deepseek`
    case 'gemini':
      return `${AI_GATEWAY_BASE}/google-ai-studio/v1beta`
    case 'openai':
      return `${AI_GATEWAY_BASE}/openai`
    case 'anthropic':
      return `${AI_GATEWAY_BASE}/anthropic`
    default:
      return ''
  }
}

export function directBaseUrlForProvider(provider: AiModelConfig['provider']): string {
  switch (provider) {
    case 'deepseek':
      return 'https://api.deepseek.com'
    case 'gemini':
      return 'https://generativelanguage.googleapis.com/v1beta'
    case 'openai':
      return 'https://api.openai.com/v1'
    case 'kimi':
      return 'https://api.moonshot.cn/v1'
    case 'doubao':
      return DOUBAO_BASE_URL
    case 'qwen':
      return QWEN_BASE_URL
    case 'openrouter':
      return 'https://openrouter.ai/api/v1'
    case 'anthropic':
      return 'https://api.anthropic.com/v1'
    case 'custom-openai':
    default:
      return ''
  }
}

export function baseUrlForProvider(provider: AiModelConfig['provider']): string {
  return gatewayBaseUrlForProvider(provider) || directBaseUrlForProvider(provider)
}

export function isGatewayBaseUrl(url: string): boolean {
  return url.includes('gateway.ai.cloudflare.com')
}

export function defaultModelForProvider(provider: AiModelConfig['provider']): string {
  switch (provider) {
    case 'deepseek':
      return 'deepseek-v4-flash'
    case 'gemini':
      return 'gemini-3-flash-preview'
    case 'kimi':
      return 'kimi-k2.6'
    case 'doubao':
      return DOUBAO_SEED_PRO_MODEL
    case 'qwen':
      return QWEN_DEFAULT_MODEL
    case 'openai':
      return 'gpt-4o-mini'
    case 'openrouter':
      return 'deepseek/deepseek-chat-v3-0324:free'
    case 'anthropic':
      return 'claude-sonnet-4-6'
    case 'custom-openai':
    default:
      return ''
  }
}

export function officialApiKeyUrlForProvider(provider: AiModelConfig['provider']): string {
  switch (provider) {
    case 'deepseek':
      return 'https://platform.deepseek.com/api_keys'
    case 'gemini':
      return 'https://aistudio.google.com/app/apikey'
    case 'kimi':
      return 'https://platform.moonshot.cn/console/api-keys'
    case 'doubao':
      return 'https://console.volcengine.com/ark/region:ark+cn-beijing/apikey'
    case 'qwen':
      return 'https://bailian.console.aliyun.com/cn-beijing?tab=globalset'
    case 'openai':
      return 'https://platform.openai.com/api-keys'
    case 'openrouter':
      return 'https://openrouter.ai/settings/keys'
    case 'anthropic':
      return 'https://console.anthropic.com/settings/keys'
    default:
      return ''
  }
}
