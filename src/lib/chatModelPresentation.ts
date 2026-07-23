import type { AiModelConfig, AiModelProvider, AiModelRouteKey, AiProviderConfig } from './api'
import { aiProviderOptions, aiRouteDefaults } from './aiProviders'
import type { ChatModelChoice } from './conversationCache'

function chatRouteLabel(route: AiModelRouteKey) {
  if (route === 'textPrimary') return '文字主模型'
  if (route === 'textFallback') return '文字备用'
  if (route === 'visionPrimary') return '识图主模型'
  return '识图备用'
}

export function aiProviderDisplayLabel(provider: AiModelProvider) {
  return aiProviderOptions.find((option) => option.value === provider)?.label || provider
}

export function chatModelChoiceLabel(
  choice: ChatModelChoice,
  aiModelConfig: AiModelConfig | null,
  aiProviderConfigs?: AiProviderConfig[],
) {
  if (choice === 'auto') return '自动'
  if (choice === 'workers-ai') return 'Workers AI'
  if (choice === 'doubao-seed-2-1-pro') return '豆包 Seed 2.1 Pro'
  if (choice === 'deepseek-v4-flash') return 'DeepSeek V4 Flash'
  if (choice === 'deepseek-v4-pro') return 'DeepSeek V4 Pro'
  if (choice.startsWith('openrouter:')) {
    return choice.replace(/^openrouter:/, '').replace(/:free$/, '').split('/').pop() || 'OpenRouter'
  }
  if (choice.startsWith('provider:')) {
    const provider = choice.replace(/^provider:/, '') as AiModelProvider
    const config = aiProviderConfigs?.find((item) => item.provider === provider)
    return config?.defaultModel || aiProviderDisplayLabel(provider)
  }
  const route = choice.replace(/^route:/, '') as AiModelRouteKey
  return aiModelConfig?.[route]?.model || aiRouteDefaults[route]?.model || chatRouteLabel(route)
}
