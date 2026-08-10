export type AgentVersionToken = {
  value: string
  index: number
}

const versionPatterns = [
  /(?<![A-Za-z0-9_-])v\d+(?:\.\d+){1,3}(?![A-Za-z0-9_-])/gi,
  /(?<![A-Za-z0-9_-])\d+\.\d+\.\d+(?:\.\d+)?(?![A-Za-z0-9_-])/g,
  /(?<![A-Za-z0-9_-])(?:B|V|R|REV)[-_ ]?\d{1,3}(?![A-Za-z0-9_-])/gi,
  /第[0-9零〇一二两三四五六七八九十百]+版/g,
  /(?:初稿|一稿|二稿|三稿|终稿|定稿|最终稿)/g,
]

export function normalizeAgentVersion(value: string) {
  return value.normalize('NFKC').replace(/\s+/g, '').toUpperCase()
}

export function extractAgentVersions(text: string): AgentVersionToken[] {
  const matches = versionPatterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => ({
    value: String(match[0] || '').trim(),
    index: match.index || 0,
  })))
  return [...new Map(matches
    .sort((left, right) => left.index - right.index)
    .map((item) => [normalizeAgentVersion(item.value), item])).values()]
}
