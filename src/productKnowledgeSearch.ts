import { productKnowledgeDocuments } from './generated/productKnowledge.generated'
import { searchProductHelp, type ProductHelpMatch } from './productCapabilities'

const STOP_WORDS = ['这个网站', '网站', '现在', '目前', '请问', '帮我', '一下', '怎么', '如何', '为什么', '哪些', '什么', '可以', '是否', '有没有', '的', '了', '吗']

function normalize(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, '')
}

function meaningfulQuery(value: string) {
  let result = value.normalize('NFKC').toLowerCase()
  for (const stopWord of STOP_WORDS) result = result.replaceAll(stopWord, ' ')
  return normalize(result)
}

function grams(value: string) {
  const normalized = meaningfulQuery(value)
  const result = new Set<string>()
  const latinWords = value.toLowerCase().match(/[a-z0-9][a-z0-9._+-]*/g) || []
  latinWords.forEach((item) => item.length >= 2 && result.add(item))
  for (let index = 0; index < normalized.length - 1; index += 1) result.add(normalized.slice(index, index + 2))
  return result
}

function documentScore(query: string, heading: string, content: string) {
  const normalizedQuery = meaningfulQuery(query)
  if (normalizedQuery.length < 2) return 0
  const normalizedHeading = normalize(heading)
  const normalizedContent = normalize(content)
  let score = 0
  if (normalizedHeading.includes(normalizedQuery)) score += 90
  if (normalizedContent.includes(normalizedQuery)) score += 70
  const queryGrams = grams(query)
  if (!queryGrams.size) return score
  const headingGrams = grams(heading)
  const contentGrams = grams(content)
  let headingHits = 0
  let contentHits = 0
  for (const gram of queryGrams) {
    if (headingGrams.has(gram)) headingHits += 1
    if (contentGrams.has(gram)) contentHits += 1
  }
  const coverage = contentHits / queryGrams.size
  score += headingHits * 12 + contentHits * 4
  if (coverage >= 0.75) score += 35
  else if (coverage >= 0.5) score += 18
  return score
}

function excerpt(content: string, query: string, maxLength = 900) {
  if (content.length <= maxLength) return content
  const normalizedQuery = meaningfulQuery(query)
  const normalizedContent = normalize(content)
  const anchor = normalizedQuery ? normalizedContent.indexOf(normalizedQuery.slice(0, Math.min(6, normalizedQuery.length))) : -1
  const start = Math.max(0, anchor > 0 ? anchor - 180 : 0)
  return `${start > 0 ? '…' : ''}${content.slice(start, start + maxLength)}${start + maxLength < content.length ? '…' : ''}`
}

export function searchProductKnowledge(query: string, limit = 5) {
  const curated = searchProductHelp(query, Math.min(limit, 10)).matches
  const documents = productKnowledgeDocuments
    .map((document) => ({ document, score: documentScore(query, document.heading, document.content) }))
    .filter((item) => item.score >= 24)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(3, limit * 2))
    .map(({ document, score }): ProductHelpMatch => ({
      id: `document.${document.id}`,
      category: document.category,
      title: document.heading,
      summary: excerpt(document.content, query, 260),
      details: [excerpt(document.content, query)],
      route: document.sourcePath,
      sourceLabel: `${document.sourceLabel} · ${document.heading}`,
      evidenceStatus: 'confirmed',
      answer: `**${document.heading}**\n\n${excerpt(document.content, query)}\n\n依据：${document.sourceLabel}（${document.sourcePath}）。`,
      score,
    }))
  const unique = new Map<string, ProductHelpMatch>()
  for (const match of [...curated, ...documents]) {
    if (!unique.has(match.id)) unique.set(match.id, match)
  }
  const matches = [...unique.values()].slice(0, Math.max(1, Math.min(10, limit)))
  return { query, total: matches.length, matches, indexedDocuments: productKnowledgeDocuments.length }
}
