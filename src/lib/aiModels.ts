export type AiModelCategory = 'text' | 'vision' | 'image' | 'video' | 'audio' | 'omni' | 'embedding'

export const aiModelCategoryLabels: Record<AiModelCategory, string> = {
  text: '文字',
  vision: '视觉',
  image: '图片',
  video: '视频',
  audio: '语音',
  omni: '全模态',
  embedding: '向量',
}

export const aiModelCategoryOrder: AiModelCategory[] = ['text', 'vision', 'image', 'video', 'audio', 'omni', 'embedding']

// Model names are the only metadata consistently returned by every provider.
export function classifyAiModel(model: string): { category: AiModelCategory; note: string } {
  const normalizedModel = model.toLowerCase()
  const has = (pattern: RegExp) => pattern.test(normalizedModel)
  let category: AiModelCategory = 'text'
  if (has(/embedding|embed(?![a-z])|rerank/)) category = 'embedding'
  else if (has(/omni/)) category = 'omni'
  else if (has(/tts|asr|audio|s2s|-vc-|-vd-|livetranslate|realtime|speech|voice/)) category = 'audio'
  else if (has(/video|seedance|veo|keling|kling/)) category = 'video'
  else if (has(/image|seedream|dall|wanx|flux/)) category = 'image'
  else if (has(/-vl|vision|ocr/)) category = 'vision'

  const notes: string[] = []
  if (category === 'text') {
    if (has(/max/)) notes.push('旗舰，能力最强')
    else if (has(/plus|pro(?![a-z])/)) notes.push('均衡，性能成本兼顾')
    else if (has(/turbo|flash|lite|mini|nano/)) notes.push('轻快，响应快成本低')
    if (has(/coder|-code(?![a-z])/)) notes.push('代码专长')
    if (has(/thinking|reason|qwq|deep-research|deep-search|-r\d/)) notes.push('深度推理')
    if (has(/long/)) notes.push('超长上下文')
    if (has(/(^|-)mt-|translate/)) notes.push('翻译')
    if (has(/math/)) notes.push('数学专长')
    if (has(/character/)) notes.push('角色扮演')
  }
  if (category === 'vision') notes.push(has(/ocr/) ? '图片文字识别' : '图片理解')
  if (category === 'image') notes.push(has(/edit/) ? '图片编辑' : '图片生成')
  if (category === 'audio') notes.push(has(/tts/) ? '语音合成' : has(/asr/) ? '语音识别' : has(/livetranslate/) ? '同声传译' : '实时语音')
  if (category === 'video') notes.push('视频生成')
  if (category === 'omni') notes.push('全模态，文字语音图像通吃')
  if (category === 'embedding') notes.push('向量检索，不用于对话')
  if (has(/-(20\d{2}-\d{2}-\d{2}|\d{3,6})$/)) notes.push('历史快照')
  else if (has(/preview/)) notes.push('预览版')
  if (notes.length === 0) notes.push('通用对话')
  return { category, note: notes.slice(0, 2).join(' · ') }
}
