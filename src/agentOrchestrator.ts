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
  const readsAttachment = /(?:附件|交付件|验收文件|文件).*(?:查看|打开|预览|下载|找|内容|文字|错别字|质量|问题|需求|分析)|(?:查看|打开|预览|下载|找|分析).*(?:附件|交付件|验收文件|文件)/.test(value)
  if (readsAttachment) add('attachment')
  const asksWorkflowHelp = /(?:怎么|如何|在哪).*(?:新建任务|记录进展|验收任务|修改任务|上传附件|导出回单|下载回单|设置大模型|切换主题)/.test(value)
  if (asksWorkflowHelp) add('product_help')
  const writeAction = /(?:新建|创建|记录|修改|更新|改成|追加|验收|标记|删除|上传|导出|锁定|提醒|切换|配置|调整)/
  const writeObject = /(?:任务|进展|进度|反馈|等待|字段|文件|附件|工时|交付日期|回单|分享|排期|模型|路由|提醒)/
  const onlyReadsAcceptanceAttachment = readsAttachment
    && !/(?:新建|创建|记录|修改|更新|改成|追加|标记|删除).*(?:附件|文件)|验收(?:任务|了|通过|完成)/.test(value)
  const readsAcceptanceState = /(?:已|待|未)验收|验收(?:了多少|情况|状态)|多少.*验收/.test(value)
  const writesPlanManagement = /(?:暂停|恢复|继续|重试|取消).*(?:执行计划|任务计划|项目计划)|(?:执行计划|任务计划|项目计划).*(?:暂停|恢复|继续|重试|取消)/.test(value)
  const writesBusinessData = writesPlanManagement || (!asksWorkflowHelp && !onlyReadsAcceptanceAttachment && !readsAcceptanceState && (writeAction.test(value) && writeObject.test(value))
    && (/(?:新建|创建|记录|修改|更新|改成|追加|验收|标记|删除).*(?:任务|进展|进度|反馈|等待|字段|文件|工时|交付日期)/.test(value)
      || /(?:任务|进展|进度|反馈|等待|字段|文件|工时|交付日期).*(?:新建|创建|记录|修改|更新|改成|追加|验收|标记|删除)/.test(value)))
  if (writesBusinessData) add('write')
  const asksStoredMemory = /(?:记忆|之前记住|历史决策|组织规则|公司规则|团队规则|项目约定|长期规则)/.test(value)
  if (!asksStoredMemory && /(?:用户|需求人|合作|客户).*(?:画像|特征|偏好|报价|排期建议)|(?:画像).*(?:用户|需求人|合作|客户)/.test(value)) add('person_profile')
  const asksMoneyDisplayHelp = /(?:显示|隐藏|展示|查看).*(?:金额).*(?:快捷键|怎么|如何|是什么)|(?:金额).*(?:显示|隐藏).*(?:快捷键|怎么|如何|是什么)/.test(value)
  if (!asksMoneyDisplayHelp && /(?:金额|收入|工资|结算|计费工时|待验收金额|多少钱|月度工时)/.test(value)) add('finance')
  const productSubject = /(?:Giverny|吉维尼|网站|工作助手|大模型|主题|快捷键|设置页|功能入口|品牌故事)/i.test(value)
  const asksAiFailure = /(?:主模型|备用模型|大模型|模型路由).*(?:不可用|失败|异常|故障|回退|回落|切换)|(?:为什么|为何).*(?:备用模型|模型).*(?:启动|切换|不可用)/.test(value)
  if (!asksAiFailure && ((productSubject && /(?:怎么|如何|在哪|入口|设置|开通|为什么|原因|是什么)/.test(value))
    || /(?:这个网站)?最近更新了?哪些内容/.test(value))) add('product_help')
  const explicitTaskFacts = /(?:列|哪些|所有|全部|多少|汇总|概况|清单|排查|目前|现在|详情|进展|状态|卡在|卡点|等待|延期|逾期|待验收|已验收|没完成|未完成|做到|为什么|有没有|是否)/.test(value)
  const asksAgenda = /(?:日程|安排|空闲|空档|有空|时间槽|时间段|什么时候能安排|哪天能安排|本周计划|今天计划|明天计划)/.test(value)
    && !/(?:安排|计划).*(?:做|制作|设计|新建|创建|新增)/.test(value)
  if (asksAgenda) add('task_data')
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
  if (hasIntent('finance') && !hasDeterministicTool('query_month_finance', 'query_settlement_exports', 'reconcile_settlement_export', 'export_settlement_preview', 'manage_settlement_export_preview')) {
    requiredTools.push('query_month_finance')
    issues.push('金额或工时结论没有经过财务计算工具。')
  }
  if (hasIntent('product_help') && !hasDeterministicTool('search_product_help', 'search_workspace')) {
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
  const asksProactiveWork = /(?:主动事项|风险待办|优先级|最该|优先处理|提醒处理效果|误报率|解决率)/.test(turn.question)
  const asksProjectExecution = /(?:执行计划|任务计划|项目计划|计划步骤|当前步骤|下一步|做到哪一步|为什么.{0,8}(?:卡住|阻塞)|依赖.{0,8}(?:什么|谁)|失败步骤)/.test(turn.question)
  const asksPlanContinuation = !/(?:做到哪一步|当前步骤|为什么.{0,8}(?:卡住|阻塞)|失败步骤|下一步是什么)/.test(turn.question)
    && /(?:继续|接着|续接|往下推进|执行下一步).*(?:计划|项目|任务|执行)|(?:计划|项目|任务|执行).*(?:继续|接着|续接|往下推进|执行下一步)/.test(turn.question)
  const asksWorkspaceSearch = /(?:全站|整个网站|所有地方|到处|跨(?:任务|附件|对话|知识)|不记得.*在哪).*(?:搜|查|找)|(?:统一搜索|全域搜索)/.test(turn.question)
  const asksAgenda = /(?:日程|安排|空闲|空档|有空|时间槽|时间段|什么时候能安排|哪天能安排|本周计划|今天计划|明天计划)/.test(turn.question)
    && !/(?:安排|计划).*(?:做|制作|设计|新建|创建|新增)/.test(turn.question)
  const asksEnterpriseMemory = /(?:组织规则|公司规则|团队规则|合作伙伴.{0,12}(?:偏好|约定|记忆)|项目.{0,12}(?:约定|决策|记忆)|企业记忆|长期规则|之前记住|历史决策)/.test(turn.question)
  const asksAiRoutingDiagnosis = /(?:主模型|备用模型|大模型|模型路由).*(?:不可用|失败|异常|故障|回退|回落|切换)|(?:为什么|为何).*(?:备用模型|模型).*(?:启动|切换|不可用)/.test(turn.question)
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
  if (asksAgenda && !hasDeterministicTool('query_agenda')) {
    requiredTools.push('query_agenda')
    issues.push('日程或可用时间结论没有读取 Agenda。')
  }
  if (asksProactiveWork && !hasDeterministicTool('query_proactive_work')) {
    requiredTools.push('query_proactive_work')
    issues.push('主动工作结论没有读取优先级、证据和处理效果。')
  }
  if (asksPlanContinuation && !hasDeterministicTool('query_plan_continuation')) {
    requiredTools.push('query_plan_continuation')
    issues.push('计划续接没有从真实停顿点生成下一步建议。')
  } else if (asksProjectExecution && !hasDeterministicTool('query_project_execution', 'query_plan_continuation')) {
    requiredTools.push('query_project_execution')
    issues.push('项目执行进度、依赖或下一步结论没有读取已保存的执行计划。')
  }
  if (asksWorkspaceSearch && !hasDeterministicTool('search_workspace')) {
    requiredTools.push('search_workspace')
    issues.push('跨域查找没有经过全域统一搜索。')
  }
  if (asksEnterpriseMemory && !hasDeterministicTool('query_enterprise_memory')) {
    requiredTools.push('query_enterprise_memory')
    issues.push('组织、合作伙伴或项目记忆结论没有读取企业分层记忆及来源。')
  }
  if (asksAiRoutingDiagnosis && !hasDeterministicTool('diagnose_ai_routing')) {
    requiredTools.push('diagnose_ai_routing')
    issues.push('模型主备链路结论没有经过配置、连接状态和近期回退记录诊断。')
  }
  if (hasIntent('attachment') && !hasDeterministicTool('search_attachments', 'search_workspace', 'prepare_attachment_upload', 'inspect_attachment_evidence', 'query_attachment_analysis')) {
    requiredTools.push('search_attachments')
    issues.push('附件结论没有经过真实附件查询。')
  }
  const asksAttachmentContent = hasIntent('attachment') && /(?:内容|文字|OCR|错别字|质量|问题|需求.*(?:一致|匹配)|分析结论)/i.test(turn.question)
  if (asksAttachmentContent && !hasDeterministicTool('inspect_attachment_evidence')) {
    requiredTools.push('inspect_attachment_evidence')
    issues.push('附件内容或质量结论没有读取可引用的文件证据。')
  }
  if (hasIntent('task_data') && !asksPortfolio && !hasDeterministicTool('search_tasks', 'search_workspace', 'get_task_detail', 'query_task_portfolio', 'query_agenda', 'check_schedule_conflicts', 'reschedule_task_preview', 'query_proactive_work', 'query_project_execution', 'query_plan_continuation')) {
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
