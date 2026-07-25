import type { AgentReadToolName } from './agentToolRegistry'
import type { AgentPrincipalContext } from './agentScope'

export type AgentTurnPhase = 'understand' | 'plan' | 'authorize' | 'execute' | 'analyze' | 'verify' | 'complete' | 'needs_input' | 'failed'
export type AgentIntent = 'finance' | 'task_data' | 'person_profile' | 'attachment' | 'product_help' | 'knowledge' | 'write' | 'general' | 'unknown'
export type AgentRiskLevel = 'read' | 'write' | 'sensitive'
export type AgentToolExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'denied' | 'skipped'

export type AgentPlannedToolCall = {
  id: string
  name: AgentReadToolName | string
  args: Record<string, unknown>
  reason: string
  risk: AgentRiskLevel
  status?: AgentToolExecutionStatus
  attempt?: number
  error?: string
  durationMs?: number
}

export type AgentEvidence = {
  id: string
  toolCallId: string
  toolName: string
  source: 'd1' | 'r2' | 'product_registry' | 'knowledge' | 'web' | 'model'
  deterministic: boolean
  payload: unknown
}

export type AgentVerification = {
  passed: boolean
  issues: string[]
  requiredTools: string[]
  detectedIntents: AgentIntent[]
  correctedAnswer?: string
}

export type AgentTurn = {
  id: string
  principal: AgentPrincipalContext
  question: string
  intent: AgentIntent
  phase: AgentTurnPhase
  plan: AgentPlannedToolCall[]
  evidence: AgentEvidence[]
  answer: string
  verification: AgentVerification
  attempts: number
  startedAt: string
  completedAt?: string
}

export type AgentReplanDecision = {
  shouldReplan: boolean
  requiredTools: string[]
  reason: string
}

export function createAgentTurn(input: {
  principal: AgentPrincipalContext
  question: string
  intent?: AgentIntent
}): AgentTurn {
  return {
    id: input.principal.runId || crypto.randomUUID(),
    principal: input.principal,
    question: input.question.trim(),
    intent: input.intent || 'unknown',
    phase: 'understand',
    plan: [],
    evidence: [],
    answer: '',
    verification: { passed: false, issues: [], requiredTools: [], detectedIntents: [] },
    attempts: 0,
    startedAt: new Date().toISOString(),
  }
}

export function normalizeAgentIntent(value: unknown): AgentIntent {
  const intent = String(value || '') as AgentIntent
  return ['finance', 'task_data', 'person_profile', 'attachment', 'product_help', 'knowledge', 'write', 'general', 'unknown'].includes(intent)
    ? intent
    : 'unknown'
}

export function requiresBusinessEvidence(intent: AgentIntent) {
  return intent === 'finance' || intent === 'task_data' || intent === 'person_profile' || intent === 'attachment' || intent === 'write'
}

export function inferAgentIntents(question: string, modelIntent: AgentIntent = 'unknown'): AgentIntent[] {
  const value = question.trim()
  const intents: AgentIntent[] = []
  const add = (intent: AgentIntent) => {
    if (!intents.includes(intent)) intents.push(intent)
  }
  const readsAttachment = /(?:附件|交付件|验收文件|文件).*(?:查看|打开|预览|下载|找)|(?:查看|打开|预览|下载|找).*(?:附件|交付件|验收文件|文件)/.test(value)
  if (readsAttachment) add('attachment')
  const asksWorkflowHelp = /(?:怎么|如何|在哪).*(?:新建任务|记录进展|验收任务|修改任务|上传附件|导出回单|下载回单|设置大模型|切换主题)/.test(value)
  if (asksWorkflowHelp) add('product_help')
  const writeAction = /(?:新建|创建|记录|修改|更新|改成|追加|验收|标记|删除|上传|导出|锁定|提醒|切换|配置|调整)/
  const writeObject = /(?:任务|进展|进度|反馈|等待|字段|文件|附件|工时|交付日期|回单|分享|排期|模型|路由|提醒)/
  const onlyReadsAcceptanceAttachment = readsAttachment
    && !/(?:新建|创建|记录|修改|更新|改成|追加|标记|删除).*(?:附件|文件)|验收(?:任务|了|通过|完成)/.test(value)
  const readsAcceptanceState = /(?:已|待|未)验收|验收(?:了多少|情况|状态)|多少.*验收/.test(value)
  const writesBusinessData = !asksWorkflowHelp && !onlyReadsAcceptanceAttachment && !readsAcceptanceState && (writeAction.test(value) && writeObject.test(value))
    && (/(?:新建|创建|记录|修改|更新|改成|追加|验收|标记|删除).*(?:任务|进展|进度|反馈|等待|字段|文件|工时|交付日期)/.test(value)
      || /(?:任务|进展|进度|反馈|等待|字段|文件|工时|交付日期).*(?:新建|创建|记录|修改|更新|改成|追加|验收|标记|删除)/.test(value))
  if (writesBusinessData) add('write')
  if (/(?:用户|需求人|合作|客户).*(?:画像|特征|偏好|报价|排期建议)|(?:画像).*(?:用户|需求人|合作|客户)/.test(value)) add('person_profile')
  const asksMoneyDisplayHelp = /(?:显示|隐藏|展示|查看).*(?:金额).*(?:快捷键|怎么|如何|是什么)|(?:金额).*(?:显示|隐藏).*(?:快捷键|怎么|如何|是什么)/.test(value)
  if (!asksMoneyDisplayHelp && /(?:金额|收入|工资|结算|计费工时|待验收金额|多少钱|月度工时)/.test(value)) add('finance')
  const productSubject = /(?:Giverny|吉维尼|网站|工作助手|大模型|主题|快捷键|设置页|功能入口|品牌故事)/i.test(value)
  if ((productSubject && /(?:怎么|如何|在哪|入口|设置|开通|为什么|原因|是什么)/.test(value))
    || /(?:这个网站)?最近更新了?哪些内容/.test(value)) add('product_help')
  const explicitTaskFacts = /(?:列|哪些|所有|全部|多少|汇总|概况|清单|排查|目前|现在|详情|进展|状态|卡在|卡点|等待|延期|逾期|待验收|已验收|没完成|未完成|做到|为什么|有没有|是否)/.test(value)
  const readsTaskData = /(?:任务|项目|工作|进展|等待|延期|逾期|待验收|已验收|卡点|交付)/.test(value)
    && (explicitTaskFacts || (!readsAttachment && /(?:查|看|告诉)/.test(value)))
  if (readsTaskData && (!writesBusinessData || /(?:查|看|告诉|列|哪些|所有|全部|多少|目前|现在|为什么|有没有|是否)/.test(value))) add('task_data')
  if (intents.length === 0) add(modelIntent === 'unknown' ? 'general' : modelIntent)
  return intents
}

export function inferAgentIntent(question: string, modelIntent: AgentIntent = 'unknown'): AgentIntent {
  return inferAgentIntents(question, modelIntent)[0]
}

export function verifyAgentAnswer(turn: AgentTurn): AgentVerification {
  const issues: string[] = []
  const requiredTools: string[] = []
  const detectedIntents = inferAgentIntents(turn.question, turn.intent)
  const hasIntent = (intent: AgentIntent) => detectedIntents.includes(intent)
  const hasDeterministicTool = (...names: string[]) => turn.evidence.some((item) => item.deterministic && names.includes(item.toolName))
  if (detectedIntents.some(requiresBusinessEvidence) && !turn.evidence.some((item) => item.deterministic)) {
    issues.push('业务事实回答缺少确定性工具证据。')
  }
  if (hasIntent('finance') && !hasDeterministicTool('query_month_finance', 'query_settlement_exports', 'export_settlement_preview', 'manage_settlement_export_preview')) {
    requiredTools.push('query_month_finance')
    issues.push('金额或工时结论没有经过财务计算工具。')
  }
  if (hasIntent('product_help') && !hasDeterministicTool('search_product_help')) {
    requiredTools.push('search_product_help')
    issues.push('产品说明没有经过官方产品知识工具核对。')
  }
  if (hasIntent('person_profile') && !hasDeterministicTool('get_requester_profile')) {
    requiredTools.push('get_requester_profile')
    issues.push('需求人画像没有读取当前工作区的历史任务证据。')
  }
  const hasExplicitTaskId = /(?:任务|项目)\s*#\s*\d+/.test(turn.question)
  const asksExplicitTaskDetail = hasExplicitTaskId
    && /(?:查|看|打开|读取|详情|进展|状态|等待|卡在|未解决)/.test(turn.question)
  const asksReferencedTaskDetail = hasIntent('task_data')
    && /(?:这个任务|那个任务|这个项目|那个项目|刚才那个|上述任务|当前任务).*(?:详情|进展|状态|等|卡|为什么|现在)/.test(turn.question)
  const hasPortfolioSubject = /(?:任务|项目|工作|等待|延期|逾期|待验收|已验收|未完成|没闭环)/.test(turn.question)
  const hasPortfolioScope = /(?:列|哪些|所有|全部|多个|多项|多少|各有|谁|汇总|概况|清单|排查)|(?:从|\d{1,2}月\d{1,2}日).*(?:到|至)/.test(turn.question)
  const stateKinds = ['已验收', '未完成', '逾期', '延期', '等待中', '待验收'].filter((value) => turn.question.includes(value)).length
  const asksPortfolio = !hasExplicitTaskId && hasPortfolioSubject && (hasPortfolioScope || stateKinds > 1)
  if ((asksExplicitTaskDetail || asksReferencedTaskDetail) && !hasDeterministicTool('get_task_detail')) {
    requiredTools.push('get_task_detail')
    issues.push('显式任务 ID 的详情问题没有读取对应任务详情。')
  }
  if (asksPortfolio && !hasDeterministicTool('query_task_portfolio')) {
    requiredTools.push('query_task_portfolio')
    issues.push('跨任务结论没有经过工作概况聚合工具。')
  } else if (/卡在|卡点|等待|为什么.*(?:没|未).*交付|延期/.test(turn.question)
    && !hasDeterministicTool('get_task_detail', 'query_task_portfolio')) {
    requiredTools.push('get_task_detail')
    issues.push('任务阻塞问题没有读取任务详情或跨任务等待记录。')
  }
  if (hasIntent('attachment') && !hasDeterministicTool('search_attachments', 'prepare_attachment_upload')) {
    requiredTools.push('search_attachments')
    issues.push('附件结论没有经过真实附件查询。')
  }
  if (hasIntent('task_data') && !asksPortfolio && !hasDeterministicTool('search_tasks', 'get_task_detail', 'query_task_portfolio', 'check_schedule_conflicts', 'reschedule_task_preview')) {
    const singular = /(?:任务\s*#\d+|这个|那个|刚才|详情|进展|卡在|为什么)/.test(turn.question)
    requiredTools.push(singular ? 'get_task_detail' : 'search_tasks')
    issues.push('任务事实回答没有读取当前工作区任务。')
  }
  const hasWritePlan = turn.plan.some((item) => item.risk !== 'read')
  const hasSuccessfulWritePreview = turn.plan.some((item) => item.risk !== 'read' && item.status === 'success' && item.name.endsWith('_preview'))
  if (hasWritePlan && !hasSuccessfulWritePreview) {
    issues.push('写入动作没有进入人工确认流程。')
  }
  const successfulTools = new Set(turn.plan.filter((item) => item.status === 'success').map((item) => item.name))
  const failedTools = turn.plan
    .filter((item) => (item.status === 'failed' || item.status === 'pending') && !successfulTools.has(item.name))
    .map((item) => item.name)
  if (failedTools.length) {
    issues.push(`工具执行失败：${[...new Set(failedTools)].join('、')}。`)
    failedTools.forEach((name) => requiredTools.push(String(name)))
  }
  return { passed: issues.length === 0, issues, requiredTools: [...new Set(requiredTools)], detectedIntents }
}

export function decideAgentReplan(turn: AgentTurn, maxAttempts = 3): AgentReplanDecision {
  const verification = verifyAgentAnswer(turn)
  const requiredTools = verification.requiredTools.filter((toolName) => {
    const attempts = turn.plan.filter((item) => item.name === toolName).length
    return attempts < maxAttempts
  })
  return {
    shouldReplan: !verification.passed && requiredTools.length > 0 && turn.attempts < maxAttempts,
    requiredTools,
    reason: verification.issues.join(' '),
  }
}

export function sanitizeAgentTurnAudit(turn: AgentTurn) {
  return {
    id: turn.id,
    phase: turn.phase,
    intent: turn.intent,
    attempts: turn.attempts,
    plan: turn.plan.map((item) => ({
      name: String(item.name),
      taskId: Number(item.args.taskId) > 0 ? Number(item.args.taskId) : undefined,
      risk: item.risk,
      status: item.status || 'pending',
      attempt: item.attempt || 1,
      durationMs: Math.max(0, Number(item.durationMs) || 0),
      error: String(item.error || '').slice(0, 240),
    })),
    evidence: turn.evidence.map((item) => ({
      toolName: item.toolName,
      source: item.source,
      deterministic: item.deterministic,
    })),
    verification: turn.verification,
  }
}

export function completeAgentTurn(turn: AgentTurn, answer: string): AgentTurn {
  const next = { ...turn, answer: answer.trim(), phase: 'verify' as AgentTurnPhase }
  const verification = verifyAgentAnswer(next)
  return {
    ...next,
    verification,
    phase: verification.passed ? 'complete' : 'needs_input',
    completedAt: new Date().toISOString(),
  }
}
