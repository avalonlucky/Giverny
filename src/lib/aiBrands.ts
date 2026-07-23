export type AiBrandKey = 'antigravity' | 'anthropic' | 'claude' | 'cloudflare' | 'codex' | 'custom' | 'deepseek' | 'doubao' | 'gemini' | 'grok' | 'kimi' | 'openai' | 'openrouter' | 'qwen' | 'auto'

export function aiBrandForValue(value: string): AiBrandKey {
  const normalized = value.toLowerCase()
  if (normalized.includes('antigravity')) return 'antigravity'
  if (normalized.includes('anthropic')) return 'anthropic'
  if (normalized.includes('claude')) return 'claude'
  if (normalized.includes('cloudflare') || normalized.includes('workers-ai')) return 'cloudflare'
  if (normalized.includes('codex')) return 'codex'
  if (normalized.includes('openai') || normalized.includes('gpt-')) return 'openai'
  if (normalized.includes('deepseek')) return 'deepseek'
  if (normalized.includes('doubao') || normalized.includes('豆包')) return 'doubao'
  if (normalized.includes('gemini')) return 'gemini'
  if (normalized.includes('grok')) return 'grok'
  if (normalized.includes('kimi') || normalized.includes('moonshot')) return 'kimi'
  if (normalized.includes('openrouter')) return 'openrouter'
  if (normalized.includes('qwen') || normalized.includes('通义') || normalized.includes('dashscope')) return 'qwen'
  return 'auto'
}
