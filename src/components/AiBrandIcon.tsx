import { Bot, Sparkles } from 'lucide-react'
import antigravityBrandIcon from '@lobehub/icons-static-svg/icons/antigravity-color.svg?url'
import anthropicBrandIcon from '@lobehub/icons-static-svg/icons/anthropic.svg?url'
import claudeBrandIcon from '@lobehub/icons-static-svg/icons/claude-color.svg?url'
import cloudflareBrandIcon from '@lobehub/icons-static-svg/icons/cloudflare-color.svg?url'
import codexBrandIcon from '@lobehub/icons-static-svg/icons/codex-color.svg?url'
import deepseekBrandIcon from '@lobehub/icons-static-svg/icons/deepseek-color.svg?url'
import doubaoBrandIcon from '@lobehub/icons-static-svg/icons/doubao-color.svg?url'
import geminiBrandIcon from '@lobehub/icons-static-svg/icons/gemini-color.svg?url'
import grokBrandIcon from '@lobehub/icons-static-svg/icons/grok.svg?url'
import kimiBrandIcon from '@lobehub/icons-static-svg/icons/kimi.svg?url'
import openaiBrandIcon from '@lobehub/icons-static-svg/icons/openai.svg?url'
import openrouterBrandIcon from '@lobehub/icons-static-svg/icons/openrouter-color.svg?url'
import qwenBrandIcon from '@lobehub/icons-static-svg/icons/qwen-color.svg?url'
import type { AiBrandKey } from '../lib/aiBrands'

const aiBrandIcons: Partial<Record<AiBrandKey, string>> = {
  antigravity: antigravityBrandIcon,
  anthropic: anthropicBrandIcon,
  claude: claudeBrandIcon,
  cloudflare: cloudflareBrandIcon,
  codex: codexBrandIcon,
  openai: openaiBrandIcon,
  deepseek: deepseekBrandIcon,
  doubao: doubaoBrandIcon,
  gemini: geminiBrandIcon,
  grok: grokBrandIcon,
  kimi: kimiBrandIcon,
  openrouter: openrouterBrandIcon,
  qwen: qwenBrandIcon,
}

export function AiBrandIcon({ brand, size = 18 }: { brand: AiBrandKey; size?: number }) {
  if (brand === 'auto') return <Sparkles className="ai-brand-icon" size={size} aria-hidden="true" />
  const src = aiBrandIcons[brand]
  return src
    ? <img className="ai-brand-icon" src={src} width={size} height={size} alt="" aria-hidden="true" />
    : <Bot className="ai-brand-icon" size={size} aria-hidden="true" />
}
