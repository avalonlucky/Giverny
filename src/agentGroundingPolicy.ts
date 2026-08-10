import type { AgentDirectorDecision } from './agentIntentDirector'

export type AgentGroundingSubject = {
  label: string
  namespace: 'product' | 'workspace'
  factKind: 'version'
}

const productAliases = /(?:Giverny|吉维尼|这个网站|本站|这个产品|本产品|工作助手|爱丽丝)/i
const versionQuestion = /(?:最新|当前|现在|目前).{0,8}(?:版本|稿|稿次)|(?:版本|稿|稿次).{0,8}(?:最新|当前|现在|目前)/

function cleanSubject(value: string) {
  return value
    .replace(/^(?:你)?(?:帮我|给我|麻烦)?(?:看看|看下|看一下|查查|查下|查一下|告诉我|说一下)?\s*/, '')
    .replace(/(?:的)?(?:现在|目前|如今)?\s*$/, '')
    .replace(/[“”"'《》]/g, '')
    .trim()
}

/**
 * 抽取“具名对象的版本”这类硬事实主体。
 * 这里只识别通用句法，不维护任务名、客户名或项目名白名单。
 */
export function resolveAgentGroundingSubject(question: string): AgentGroundingSubject | null {
  const normalized = question.normalize('NFKC').trim()
  if (!versionQuestion.test(normalized)) return null

  const marker = normalized.search(/(?:最新|当前)/)
  const versionIndex = normalized.search(/(?:版本|稿次|稿)/)
  const boundary = marker >= 0 ? marker : versionIndex
  const label = cleanSubject(boundary > 0 ? normalized.slice(0, boundary) : '')

  if (label && !productAliases.test(label)) {
    return { label: label.slice(0, 80), namespace: 'workspace', factKind: 'version' }
  }
  if (productAliases.test(normalized)) {
    return { label: 'Giverny', namespace: 'product', factKind: 'version' }
  }
  return null
}

/**
 * 模型可以提议意图，但不能决定未经落地的硬事实属于哪个对象。
 * 主体契约在 shortlist 之前收窄能力，避免后续沿着错误主体继续检索和验真。
 */
export function applyAgentGroundingPolicy(decision: AgentDirectorDecision, question: string): AgentDirectorDecision {
  const subject = resolveAgentGroundingSubject(question)
  if (!subject) return decision

  if (subject.namespace === 'product') {
    return {
      ...decision,
      goal: decision.goal || `查询 ${subject.label} 当前版本`,
      domains: ['product_help'],
      operation: 'general',
      requiresBusinessData: false,
      requiresProductKnowledge: true,
      isWrite: false,
      missingInformation: [],
      complexity: 'simple',
      proposedCalls: [{ name: 'search_product_help', args: { query: question, limit: 5 }, reason: '从产品版本单一真源读取。' }],
    }
  }

  return {
    ...decision,
    goal: `确认「${subject.label}」的最新版本`,
    domains: ['workspace_search'],
    operation: 'resolve_workspace_subject',
    requiresBusinessData: true,
    requiresProductKnowledge: false,
    isWrite: false,
    missingInformation: [],
    complexity: 'simple',
    proposedCalls: [{
      name: 'resolve_workspace_subject',
      args: { subject: subject.label, factKind: subject.factKind, limit: 20 },
      reason: '先锁定具名对象，再聚合任务、进展、附件与对话证据。',
    }],
  }
}
