import type { AgentEvidence } from './agentOrchestrator'

const taskStatuses = ['计划中', '进行中', '挂起', '待验收', '已验收', '终止', '不计费'] as const

type NumericFactKind = 'hours' | 'money' | 'percent' | 'taskId' | 'count'

export type AgentFactClaim = {
  kind: NumericFactKind | 'date' | 'status'
  value: number | string
  sourceTool: string
  path: string
}

export type AgentFactSection = {
  sourceTool: string
  markdown: string
}

export type AgentFactSnapshot = {
  fallbackAnswer: string
  numbers: Record<NumericFactKind, number[]>
  dates: string[]
  statuses: string[]
  sources: string[]
  claims: AgentFactClaim[]
  sections: AgentFactSection[]
}

export type AgentFactVerification = {
  passed: boolean
  issues: string[]
  checkedClaims: number
  coveredSources: string[]
  missingSources: string[]
}

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function list(value: unknown) {
  return Array.isArray(value) ? value : []
}

function number(value: unknown) {
  const parsed = Number(typeof value === 'string' ? value.replace(/,/g, '') : value)
  return Number.isFinite(parsed) ? parsed : 0
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values.filter(Number.isFinite).map((value) => Math.round(value * 10000) / 10000))]
}

function normalizeDate(value: string) {
  const match = value.match(/(20\d{2})[-年/.](\d{1,2})(?:[-月/.](\d{1,2}))?/)
  if (!match) return ''
  return `${match[1]}-${String(Number(match[2])).padStart(2, '0')}${match[3] ? `-${String(Number(match[3])).padStart(2, '0')}` : ''}`
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(number(value))
}

function collectFacts(value: unknown, key: string, facts: AgentFactSnapshot, sourceTool: string, path = '') {
  if (Array.isArray(value)) {
    if (/^(?:files|tasks|results|updates|attachments)$/i.test(key)) {
      facts.numbers.count.push(value.length)
      facts.claims.push({ kind: 'count', value: value.length, sourceTool, path })
    }
    value.forEach((item, index) => collectFacts(item, key, facts, sourceTool, `${path}[${index}]`))
    return
  }
  if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([childKey, child]) => collectFacts(child, childKey, facts, sourceTool, path ? `${path}.${childKey}` : childKey))
    return
  }
  if (typeof value === 'number') {
    const append = (kind: NumericFactKind) => {
      facts.numbers[kind].push(value)
      facts.claims.push({ kind, value, sourceTool, path })
    }
    if (/(?:hours?|estimatedHours|actualHours|billableHours|totalHours|waitingHours|avgHoursPerProject)$/i.test(key)) append('hours')
    if (/(?:amount|hourlyRate|income|salary|cost)$/i.test(key)) append('money')
    if (/(?:progress|acceptanceRate|onTimeRate|hourDeviationRate)$/i.test(key)) append('percent')
    if (/^(?:id|taskId)$/i.test(key)) append('taskId')
    if (/(?:count|total|matched|returned|projects)$/i.test(key)) append('count')
    return
  }
  if (typeof value !== 'string') return
  if (sourceTool === 'get_requester_profile' && /^profile\.(?:traits|advice)\[\d+\]$/.test(path)) {
    const embeddedHours = [...value.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:小时|h\b)/gi)].map((match) => number(match[1]))
    embeddedHours.forEach((embedded) => {
      facts.numbers.hours.push(embedded)
      facts.claims.push({ kind: 'hours', value: embedded, sourceTool, path })
    })
  }
  if (/(?:date|month|startAt|endAt)$/i.test(key)) {
    const normalized = normalizeDate(value)
    if (normalized) {
      facts.dates.push(normalized)
      facts.claims.push({ kind: 'date', value: normalized, sourceTool, path })
    }
  }
  if (/status/i.test(key) && taskStatuses.includes(value as typeof taskStatuses[number])) {
    facts.statuses.push(value)
    facts.claims.push({ kind: 'status', value, sourceTool, path })
  }
}

function renderFinance(payload: Record<string, unknown>) {
  const stats = list(payload.stats).map(record)
  const totalBillableHours = payload.totalBillableHours ?? stats.reduce((sum, item) => sum + number(item.billableHours), 0)
  const totalAmount = payload.totalAmount ?? stats.reduce((sum, item) => sum + number(item.amount), 0)
  const lines = stats.map((item) => `- ${String(item.month || '未指定月份')}：计费 ${formatNumber(item.billableHours)} 小时，金额 ¥${formatNumber(item.amount)}，任务 ${formatNumber(item.taskCount)} 项`)
  return [
    '**已核验财务数据**',
    `- 合计计费工时：${formatNumber(totalBillableHours)} 小时`,
    `- 合计结算金额：¥${formatNumber(totalAmount)}`,
    `- 当前小时单价：¥${formatNumber(payload.hourlyRate)}/小时`,
    ...lines,
  ].join('\n')
}

function normalizedTaskRows(value: unknown) {
  return list(value).map(record).map((item) => {
    const task = record(item.task)
    return Object.keys(task).length ? { ...task, waitingRecords: item.waitingRecords } : item
  })
}

function renderTaskRows(title: string, rows: Record<string, unknown>[], summary?: Record<string, unknown>) {
  const lines = rows.slice(0, 30).map((task) => {
    const id = number(task.id || task.taskId)
    const status = String(task.status || '未记录')
    const hours = task.actualHours === undefined ? '' : `，实际 ${formatNumber(task.actualHours)} 小时`
    const date = String(task.actualDeliveryDate || task.estimatedDeliveryDate || task.estimatedDate || task.startDate || '')
    return `- 任务 #${id} ${String(task.title || '未命名')}：${status}${hours}${date ? `，日期 ${date.slice(0, 10)}` : ''}`
  })
  const matched = summary && summary.matched !== undefined ? `，匹配 ${formatNumber(summary.matched)} 项` : ''
  return [`**${title}**${matched}`, ...(lines.length ? lines : ['- 没有找到符合条件的任务。'])].join('\n')
}

function renderTaskDetail(payload: Record<string, unknown>) {
  const legacyResult = normalizedTaskRows(payload.results)[0] || {}
  const task = Object.keys(record(payload.task)).length ? record(payload.task) : legacyResult
  const hasFiles = Array.isArray(payload.files) || Array.isArray(task.files)
  const files = Array.isArray(payload.files) ? payload.files : list(task.files)
  const waitingSource = list(payload.waitingRecords).length ? payload.waitingRecords : task.waitingRecords
  const waiting = list(waitingSource).map(record).filter((item) => item.active === true)
  const hasEstimatedHours = task.estimatedHours !== undefined
  const hasActualHours = task.actualHours !== undefined
  const dates = [
    task.date ? `开始 ${String(task.date).slice(0, 10)}` : '',
    task.estimatedDate ? `预计交付 ${String(task.estimatedDate).slice(0, 10)}` : '',
    task.actualDeliveryDate ? `实际完成 ${String(task.actualDeliveryDate).slice(0, 10)}` : '',
  ].filter(Boolean).join('，')
  return [
    `**任务 #${number(task.id)} ${String(task.title || '未命名')}**`,
    `- 状态：${String(task.status || '未记录')}，进度 ${formatNumber(task.progress)}%`,
    hasEstimatedHours || hasActualHours
      ? `- 工时：${hasEstimatedHours ? `预估 ${formatNumber(task.estimatedHours)} 小时` : ''}${hasEstimatedHours && hasActualHours ? '，' : ''}${hasActualHours ? `实际 ${formatNumber(task.actualHours)} 小时` : ''}`
      : '',
    dates ? `- 日期：${dates}` : '',
    hasFiles ? `- 附件：${files.length} 个` : '',
    ...waiting.map((item) => `- 正在等待：${String(item.note || item.reason || '未填写原因')}（自 ${String(item.startAt || '未记录').replace('T', ' ')}${item.elapsedMinutes === undefined ? '' : `，已等待 ${formatNumber(item.elapsedMinutes)} 分钟`}）`),
  ].filter(Boolean).join('\n')
}

function renderProfile(payload: Record<string, unknown>) {
  const profile = record(payload.profile)
  if (payload.found !== true || !profile.name) return `当前工作区没有找到“${String(payload.searchedName || payload.name || '')}”的需求人历史数据。`
  return [
    `**${String(profile.name)} 的需求人画像**`,
    `- 项目：${formatNumber(profile.projects)} 个，累计工时 ${formatNumber(profile.hours)} 小时`,
    `- 验收通过率：${formatNumber(profile.acceptanceRate)}%`,
    `- 准时率：${formatNumber(profile.onTimeRate)}%`,
    `- 工时偏差：${formatNumber(profile.hourDeviationRate)}%`,
    `- 平均改稿：${formatNumber(profile.avgRevisionCount)} 轮/项目，累计等待 ${formatNumber(profile.waitingHours)} 小时`,
    ...list(profile.traits).map((item) => `- ${String(item)}`),
    ...list(profile.advice).map((item) => `- 建议：${String(item)}`),
  ].join('\n')
}

function renderAttachments(payload: Record<string, unknown>) {
  const files = list(payload.files).map(record)
  return [
    `**已核验附件：${formatNumber(payload.count ?? files.length)} 个**`,
    ...(files.length ? files.slice(0, 30).map((file) => `- ${String(file.name || '未命名文件')}（任务 #${number(file.taskId)} ${String(file.taskTitle || '')}）`) : ['- 没有找到符合条件的附件。']),
  ].join('\n')
}

function renderProductHelp(payload: Record<string, unknown>) {
  const matches = list(payload.matches).map(record).slice(0, 5)
  return [
    '**已核验产品说明**',
    ...(matches.length ? matches.map((item) => {
      const title = String(item.title || item.heading || '产品说明')
      const content = String(item.answer || item.content || item.summary || item.description || '').trim().slice(0, 800)
      return `- **${title}**${content ? `：${content}` : ''}`
    }) : ['- 产品知识库没有找到足够明确的说明。']),
  ].join('\n')
}

function renderSettlement(payload: Record<string, unknown>) {
  const receipt = record(payload.receipt)
  const recordData = record(payload.record)
  return [
    '**已核验结算回单**',
    `- 日期范围：${String(recordData.startDate || recordData.start_date || '')} 至 ${String(recordData.endDate || recordData.end_date || '')}`,
    `- 任务：${formatNumber(receipt.taskCount)} 项`,
    `- 工时：${formatNumber(receipt.totalHours)} 小时`,
    `- 金额：¥${formatNumber(receipt.totalAmount)}`,
    '- Excel 已生成，可使用结果卡下载或打开线上预览。',
  ].join('\n')
}

function renderContext(payload: Record<string, unknown>) {
  return [
    `**${String(payload.name || 'Giverny 工作助手')}能力边界**`,
    ...list(payload.capabilities).map((item) => `- ${String(item)}`),
    ...list(payload.constraints).map((item) => `- 限制：${String(item)}`),
  ].join('\n')
}

function renderTaskMemory(payload: Record<string, unknown>) {
  const memory = record(payload.memory)
  return [
    `**任务 #${number(memory.taskId)} ${String(memory.taskTitle || '任务记忆')}**`,
    String(memory.summary || '').trim() ? `- 摘要：${String(memory.summary).trim()}` : '',
    ...list(memory.openItems).map((item) => `- 未解决：${String(item)}`),
    ...list(memory.preferences).map((item) => `- 合作偏好：${String(item)}`),
    ...list(memory.userNotes).map((item) => `- 人工纠正：${String(item)}`),
  ].filter(Boolean).join('\n')
}

function renderTaskPlan(payload: Record<string, unknown>) {
  const plan = record(payload.plan)
  return [
    `**持续计划：${String(plan.goal || '未命名目标')}**`,
    ...list(plan.steps).map((item, index) => {
      const step = record(item)
      return `${index + 1}. ${String(step.label || step.action || '未命名步骤')}（${String(step.status || 'pending')}）`
    }),
  ].join('\n')
}

function renderSettlementExports(payload: Record<string, unknown>) {
  const records = list(payload.records).map(record)
  return ['**已核验结算导出记录**', ...(records.length ? records.map((item) => `- ${String(item.startDate || '')} 至 ${String(item.endDate || '')}：${item.locked ? '已锁定' : '未锁定'}，金额 ¥${formatNumber(item.totalAmount)}，分享${item.disabled ? '已停用' : '可用'}${item.expiresAt ? `，有效期至 ${String(item.expiresAt)}` : ''}`) : ['- 当前范围没有导出记录。'])].join('\n')
}

function renderScheduleConflicts(payload: Record<string, unknown>) {
  const conflicts = list(payload.conflicts).map(record)
  return ['**已核验排期冲突**', `- 查询范围：${String(payload.startDate || '')} 至 ${String(payload.endDate || '')}`, `- 重叠任务：${formatNumber(payload.conflictCount ?? conflicts.length)} 项，现有预估工时 ${formatNumber(payload.scheduledHours)} 小时`, ...(conflicts.length ? conflicts.map((item) => `- 任务 #${formatNumber(item.taskId)} ${String(item.title || '')}：${String(item.startDate || '')} 至 ${String(item.endDate || '')}`) : ['- 没有发现时间重叠任务。'])].join('\n')
}

function renderUploadHandoff(payload: Record<string, unknown>) {
  const handoff = record(payload.handoff)
  return [`**附件上传接力已核验**`, `- 目标任务：#${formatNumber(handoff.taskId)} ${String(handoff.taskTitle || '')}`, `- 附件范围：${handoff.scope === 'acceptance' ? '验收附件' : '进展附件'}`, `- 文件：${list(handoff.files).map((item) => String(record(item).name || '')).filter(Boolean).join('、')}`, '- 文件由当前已登录浏览器直接上传 R2，不经过模型上下文。'].join('\n')
}

function renderAttachmentEvidence(payload: Record<string, unknown>) {
  const items = list(payload.evidence).map(record)
  return ['**已核验附件证据**', ...(items.length ? items.map((item) => {
    const file = record(item.file)
    const task = record(item.task)
    const analysis = record(item.analysis)
    const analysisRef = String(item.analysisRef || item.evidenceRef || '')
    const textRef = String(item.extractedTextRef || item.evidenceRef || '')
    return [
      `- ${String(item.evidenceRef || '')} ${String(file.name || '未命名文件')}（任务 #${formatNumber(task.id)} ${String(task.title || '')}）`,
      `  - 分析状态：${String(analysis.status || 'missing')}，解析方式：${String(analysis.parserKind || '未解析')}`,
      analysis.summary ? `  - 分析摘要：${String(analysis.summary)} ${analysisRef}` : '',
      analysis.extractedText ? `  - 提取文字：${String(analysis.extractedText).slice(0, 1200)} ${textRef}` : '',
      ...list(analysis.qualityIssues).slice(0, 8).map((issue) => `  - 质量问题：${String(issue)} ${analysisRef}`),
      ...list(analysis.requirementMatches).slice(0, 6).map((match) => `  - 需求核对：${String(match)} ${analysisRef}`),
    ].filter(Boolean).join('\n')
  }) : ['- 没有找到可读取的附件证据。'])].join('\n')
}

function renderAttachmentAnalysisQueue(payload: Record<string, unknown>) {
  const items = list(payload.items).map(record)
  return ['**已核验附件分析状态**', ...(items.length ? items.map((item) => {
    const file = record(item.file)
    return `- ${String(item.evidenceRef || '')} ${String(file.name || '未命名文件')}：${String(item.status || 'missing')}，尝试 ${formatNumber(item.attemptCount)} 次${item.errorMessage ? `，原因：${String(item.errorMessage)}` : ''}`
  }) : ['- 当前范围没有附件分析记录。'])].join('\n')
}

function renderAiSettings(payload: Record<string, unknown>) {
  const routes = record(payload.routes)
  return ['**已核验模型设置（已脱敏）**', `- 当前选择：${String(payload.activeChoice || 'auto')}`, ...Object.entries(routes).map(([route, value]) => { const endpoint = record(value); return `- ${route}：${String(endpoint.provider || '')} / ${String(endpoint.model || '')}（${endpoint.hasApiKey ? '凭证可用' : '缺少凭证'}）` }), '- API Key 未进入 Agent 上下文。'].join('\n')
}

function renderAiRouteTest(payload: Record<string, unknown>) {
  return ['**模型路由测试结果**', `- 路由：${String(payload.route || '')}`, `- 模型：${String(payload.provider || '')} / ${String(payload.model || '')}`, `- 状态：${payload.ok ? '可用' : '不可用'}`, '- API Key 未显示。'].join('\n')
}

function renderAiRoutingDiagnosis(payload: Record<string, unknown>) {
  const selected = record(payload.selectedModel)
  const policy = record(payload.fallbackPolicy)
  const routes = list(payload.routes).map(record)
  const recentFallbacks = list(payload.recentFallbacks).map(record)
  return [
    '**已核验模型主备链路**',
    `- 总体状态：${String(payload.status || 'unknown')}；当前选择：${String(payload.activeChoice || 'auto')}`,
    `- 当前首选模型：${String(selected.provider || selected.kind || '')} / ${String(selected.model || '')}（${selected.ok ? '可用' : `不可用：${String(selected.error || '未知原因')}`}）`,
    ...routes.map((route) => `- ${String(route.route || '')}：${String(route.provider || '')} / ${String(route.model || '')}（${route.ok ? '可用' : `不可用：${String(route.error || route.category || '未知原因')}`}）`),
    `- 回退规则：主模型目标 ${formatNumber(policy.targetPrimaryModelRate)}%；一般故障先由同一模型尝试 ${formatNumber(policy.sameModelAttemptsBeforeFallback)} 次；用户取消不触发备用模型。`,
    `- 近期回退：${recentFallbacks.length} 条${recentFallbacks.length ? `；其中不符合策略 ${recentFallbacks.filter((item) => item.policyCompliant === false).length} 条` : ''}`,
    ...list(payload.recommendations).map((item) => `- 建议：${String(item)}`),
    '- API Key 未进入 Agent 上下文。',
  ].join('\n')
}

function renderProactiveWork(payload: Record<string, unknown>) {
  const items = list(payload.items).map(record)
  const summary = record(payload.summary)
  return [
    '**已核验主动事项**',
    `- 待处理：${formatNumber(summary.open)} 项；紧急 ${formatNumber(summary.critical)} 项，高优先级 ${formatNumber(summary.high)} 项`,
    `- 历史处理：${formatNumber(summary.handledTotal)} 项；解决率 ${formatNumber(summary.resolutionRate)}%，忽略率 ${formatNumber(summary.dismissalRate)}%，平均响应 ${formatNumber(summary.averageResponseMinutes)} 分钟`,
    ...(items.length ? items.map((item) => `- [${String(item.priority || 'medium')}] ${String(item.title || '')}（任务 #${formatNumber(item.taskId)}）\n  - 证据：${list(item.evidence).map(String).join('；')}\n  - 建议：${String(item.recommendation || '')}`) : ['- 当前没有待处理主动事项。']),
  ].join('\n')
}

function renderEnterpriseMemory(payload: Record<string, unknown>) {
  const memories = list(payload.memories).map(record)
  const summary = record(payload.summary)
  const scopeLabels: Record<string, string> = { organization: '组织', partner: '合作伙伴', project: '项目' }
  return [
    '**已核验企业记忆**',
    `- 当前有效：${formatNumber(summary.active)} 条；组织 ${formatNumber(summary.organization)} 条，合作伙伴 ${formatNumber(summary.partner)} 条，项目 ${formatNumber(summary.project)} 条`,
    ...(memories.length ? memories.map((memory) => {
      const scope = scopeLabels[String(memory.scopeType || '')] || String(memory.scopeType || '')
      const scopeKey = String(memory.scopeKey || '')
      const expiry = memory.expiresAt ? `；有效至 ${String(memory.expiresAt).slice(0, 10)}` : '；长期有效'
      return `- [${scope}${scopeKey ? `：${scopeKey}` : ''}] ${String(memory.title || '')}（v${formatNumber(memory.version)}）\n  - ${String(memory.content || '')}\n  - 来源：${String(memory.sourceLabel || '未标注')}${expiry}`
    }) : ['- 当前查询范围没有有效记忆。']),
  ].join('\n')
}

function renderWorkspaceSearch(payload: Record<string, unknown>) {
  const results = list(payload.results).map(record)
  return [
    '**全域搜索结果**',
    `- 查询：${String(payload.query || '')}；共找到 ${formatNumber(payload.count)} 条；模式：${String(payload.searchMode || 'keyword')}`,
    ...(results.length ? results.map((item) => `- [${String(item.sourceLabel || item.source || '结果')}] ${String(item.title || '')}${item.taskId ? `（任务 #${formatNumber(item.taskId)}）` : ''}\n  - ${String(item.snippet || '')}`) : ['- 当前工作区没有找到匹配内容。']),
  ].join('\n')
}

function renderPlanContinuation(payload: Record<string, unknown>) {
  const items = list(payload.continuations).map(record)
  return [
    '**执行计划续接建议**',
    ...(items.length ? items.map((item) => {
      const nextStep = record(item.nextStep)
      const confirmation = record(item.confirmation)
      return `- ${String(item.goal || '')}：${String(item.reason || '')}${nextStep.label ? `\n  - 下一步：${String(nextStep.label)}` : ''}${confirmation.label ? `\n  - 需要确认：${String(confirmation.label)}` : ''}`
    }) : ['- 当前没有需要续接的开放计划。']),
    `- 安全边界：${String(payload.guardrail || '')}`,
  ].join('\n')
}

function renderConsistencyAudit(payload: Record<string, unknown>) {
  const summary = record(payload.summary)
  const findings = list(payload.findings).map(record)
  return ['**全站数据一致性审计**', `- 结论：${String(payload.integrity || '')}；错误 ${formatNumber(summary.errorCount)} 项，提醒 ${formatNumber(summary.warningCount)} 项；审计编号：${String(payload.id || '')}`, ...(findings.length ? findings.slice(0, 20).map((item) => `- [${String(item.severity || '')}] ${String(item.message || '')}（${String(item.entityType || '')} ${String(item.entityId || '')}）`) : ['- 未发现一致性差异。']), `- 安全边界：${String(payload.guardrail || '')}`].join('\n')
}

function renderFormalDeliverables(payload: Record<string, unknown>) {
  const items = list(payload.deliverables).map(record)
  return ['**正式交付物**', ...(items.length ? items.map((item) => `- ${String(item.title || '')}：HTML ${String(item.htmlUrl || '')}；PDF ${String(item.pdfUrl || '')}；校验值 ${String(item.checksum || '')}`) : ['- 当前没有符合条件的正式交付物。'])].join('\n')
}

function renderHighRiskActions(payload: Record<string, unknown>) {
  const items = list(payload.cases).map(record)
  return ['**高风险操作案件**', ...(items.length ? items.map((item) => `- ${String(item.action || '')}：${String(item.status || '')} · ${String(item.riskLevel || '')}；证据保留至 ${String(item.retentionUntil || '')}`) : ['- 当前没有高风险操作案件。'])].join('\n')
}

function renderEvidence(evidence: AgentEvidence) {
  const payload = record(evidence.payload)
  if (evidence.toolName === 'query_month_finance') return renderFinance(payload)
  if (evidence.toolName === 'query_task_portfolio') return renderTaskRows('已核验任务概况', normalizedTaskRows(payload.tasks), record(payload.summary))
  if (evidence.toolName === 'search_tasks') return renderTaskRows('已核验任务结果', normalizedTaskRows(payload.results))
  if (evidence.toolName === 'get_task_detail') return renderTaskDetail(payload)
  if (evidence.toolName === 'get_requester_profile') return renderProfile(payload)
  if (evidence.toolName === 'search_attachments') return renderAttachments(payload)
  if (evidence.toolName === 'search_product_help') return renderProductHelp(payload)
  if (evidence.toolName === 'search_workspace') return renderWorkspaceSearch(payload)
  if (evidence.toolName === 'audit_workspace_consistency') return renderConsistencyAudit(payload)
  if (evidence.toolName === 'query_formal_deliverables') return renderFormalDeliverables(payload)
  if (evidence.toolName === 'query_high_risk_actions') return renderHighRiskActions(payload)
  if (evidence.toolName === 'get_giverny_context') return renderContext(payload)
  if (evidence.toolName === 'export_settlement_receipt') return renderSettlement(payload)
  if (evidence.toolName === 'get_task_memory') return renderTaskMemory(payload)
  if (evidence.toolName === 'create_task_plan') return renderTaskPlan(payload)
  if (evidence.toolName === 'query_settlement_exports') return renderSettlementExports(payload)
  if (evidence.toolName === 'check_schedule_conflicts') return renderScheduleConflicts(payload)
  if (evidence.toolName === 'prepare_attachment_upload') return renderUploadHandoff(payload)
  if (evidence.toolName === 'inspect_attachment_evidence') return renderAttachmentEvidence(payload)
  if (evidence.toolName === 'query_attachment_analysis') return renderAttachmentAnalysisQueue(payload)
  if (evidence.toolName === 'inspect_ai_settings') return renderAiSettings(payload)
  if (evidence.toolName === 'test_ai_route') return renderAiRouteTest(payload)
  if (evidence.toolName === 'diagnose_ai_routing') return renderAiRoutingDiagnosis(payload)
  if (evidence.toolName === 'query_proactive_work') return renderProactiveWork(payload)
  if (evidence.toolName === 'query_plan_continuation') return renderPlanContinuation(payload)
  if (evidence.toolName === 'query_enterprise_memory') return renderEnterpriseMemory(payload)
  return ''
}

export function buildAgentFactSnapshot(evidence: AgentEvidence[]): AgentFactSnapshot {
  const deterministic = evidence.filter((item) => item.deterministic)
  const sections = deterministic
    .map((item) => ({ sourceTool: item.toolName, markdown: renderEvidence(item) }))
    .filter((item) => item.markdown)
  const snapshot: AgentFactSnapshot = {
    fallbackAnswer: sections.map((item) => item.markdown).join('\n\n'),
    numbers: { hours: [], money: [], percent: [], taskId: [], count: [] },
    dates: [],
    statuses: [],
    sources: deterministic.map((item) => item.toolName),
    claims: [],
    sections,
  }
  deterministic.forEach((item) => collectFacts(item.payload, '', snapshot, item.toolName))
  snapshot.numbers.hours = uniqueNumbers(snapshot.numbers.hours)
  snapshot.numbers.money = uniqueNumbers(snapshot.numbers.money)
  snapshot.numbers.percent = uniqueNumbers(snapshot.numbers.percent)
  snapshot.numbers.taskId = uniqueNumbers(snapshot.numbers.taskId)
  snapshot.numbers.count = uniqueNumbers(snapshot.numbers.count)
  snapshot.dates = [...new Set(snapshot.dates)]
  snapshot.statuses = [...new Set(snapshot.statuses)]
  snapshot.claims = [...new Map(snapshot.claims.map((claim) => [`${claim.kind}:${claim.value}:${claim.sourceTool}:${claim.path}`, claim])).values()]
  return snapshot
}

function containsNumber(allowed: number[], candidate: number) {
  return allowed.some((value) => Math.abs(value - candidate) < 0.0001)
}

const chineseDigits: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
const chineseUnits: Record<string, number> = { 十: 10, 百: 100, 千: 1000, 万: 10000 }

function chineseNumber(value: string) {
  const [integerPart, decimalPart = ''] = value.split('点')
  let integer = 0
  if (/[十百千万]/.test(integerPart)) {
    let current = 0
    let section = 0
    for (const character of integerPart) {
      if (character in chineseDigits) current = chineseDigits[character]
      else if (character === '万') {
        section = (section + current) * 10000
        integer += section
        section = 0
        current = 0
      } else if (character in chineseUnits) {
        section += (current || 1) * chineseUnits[character]
        current = 0
      }
    }
    integer += section + current
  } else {
    integer = Number([...integerPart].map((character) => chineseDigits[character]).join(''))
  }
  const decimal = decimalPart
    ? Number(`0.${[...decimalPart].map((character) => chineseDigits[character]).join('')}`)
    : 0
  return Number.isFinite(integer + decimal) ? integer + decimal : 0
}

function numericClaims(answer: string, pattern: RegExp) {
  return [...answer.matchAll(pattern)].map((match) => number(match[1] ?? match[2]))
}

function chineseClaims(answer: string, pattern: RegExp) {
  return [...answer.matchAll(pattern)].map((match) => chineseNumber(String(match[1] || '')))
}

export function verifyAgentFactClaims(answer: string, snapshot: AgentFactSnapshot): AgentFactVerification {
  const issues: string[] = []
  const answerOutsideCanonicalSections = snapshot.sections.reduce(
    (remaining, section) => remaining.replace(section.markdown, ''),
    answer,
  )
  const checks: Array<[NumericFactKind, number[]]> = [
    ['hours', [...numericClaims(answerOutsideCanonicalSections, /(-?\d+(?:\.\d+)?)\s*(?:个)?(?:小时|h\b)/gi), ...chineseClaims(answerOutsideCanonicalSections, /([零〇一二两三四五六七八九十百千万点]+)\s*(?:个)?小时/g)]],
    ['money', [...numericClaims(answerOutsideCanonicalSections, /(?:[¥￥]\s*(-?\d[\d,]*(?:\.\d+)?)|(-?\d[\d,]*(?:\.\d+)?)\s*元)/g), ...chineseClaims(answerOutsideCanonicalSections, /([零〇一二两三四五六七八九十百千万点]+)\s*元/g)]],
    ['percent', [...numericClaims(answerOutsideCanonicalSections, /(-?\d+(?:\.\d+)?)\s*%/g), ...chineseClaims(answerOutsideCanonicalSections, /([零〇一二两三四五六七八九十百千万点]+)\s*%/g)]],
    ['taskId', numericClaims(answerOutsideCanonicalSections, /(?:任务\s*#\s*(\d+)|任务(?:ID|编号)[：:\s#]*(\d+))/gi)],
    ['count', [...numericClaims(answerOutsideCanonicalSections, /(\d+(?:\.\d+)?)\s*(?:个|项|份|张|条)(?:任务|项目|附件|文件)?/g), ...chineseClaims(answerOutsideCanonicalSections, /([零〇一二两三四五六七八九十百千万点]+)\s*(?:个|项|份|张|条)(?:任务|项目|附件|文件)?/g)]],
  ]
  checks.forEach(([kind, claims]) => {
    claims.forEach((claim) => {
      if (!containsNumber(snapshot.numbers[kind], claim)) issues.push(`${kind}=${claim} 缺少工具证据`)
    })
  })
  const dates = [...answerOutsideCanonicalSections.matchAll(/20\d{2}[-年/.]\d{1,2}(?:[-月/.]\d{1,2})?/g)].map((match) => normalizeDate(match[0])).filter(Boolean)
  dates.forEach((date) => {
    if (!snapshot.dates.includes(date) && !snapshot.dates.some((allowed) => allowed.startsWith(date) || date.startsWith(allowed))) issues.push(`date=${date} 缺少工具证据`)
  })
  taskStatuses.forEach((status) => {
    if (answerOutsideCanonicalSections.includes(status) && !snapshot.statuses.includes(status)) issues.push(`status=${status} 缺少工具证据`)
  })
  const coveredSources = snapshot.sections.filter((section) => answer.includes(section.markdown)).map((section) => section.sourceTool)
  const missingSources = snapshot.sections.filter((section) => !coveredSources.includes(section.sourceTool)).map((section) => section.sourceTool)
  missingSources.forEach((source) => issues.push(`source=${source} 的权威事实区块缺失`))
  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    checkedClaims: snapshot.claims.length,
    coveredSources: [...new Set(coveredSources)],
    missingSources: [...new Set(missingSources)],
  }
}

export function runAgentFactProtocolSelfTest() {
  const evidence: AgentEvidence[] = [
    {
      id: 'self-test-finance',
      toolCallId: 'self-test-finance',
      toolName: 'query_month_finance',
      source: 'd1',
      deterministic: true,
      payload: {
        hourlyRate: 300,
        totalBillableHours: 5,
        totalAmount: 1500,
        stats: [{ month: '2026-06', billableHours: 5, totalHours: 5, amount: 1500, taskCount: 2 }],
      },
    },
    {
      id: 'self-test-task',
      toolCallId: 'self-test-task',
      toolName: 'get_task_detail',
      source: 'd1',
      deterministic: true,
      payload: {
        task: { id: 12, title: '事实协议自检任务', status: '已验收', progress: 100, estimatedHours: 4, actualHours: 5, date: '2026-06-01', actualDeliveryDate: '2026-06-03' },
        waitingRecords: [],
        files: [],
      },
    },
  ]
  const snapshot = buildAgentFactSnapshot(evidence)
  const valid = verifyAgentFactClaims(snapshot.fallbackAnswer, snapshot)
  const invalid = verifyAgentFactClaims(`错误结论：实际投入 3 小时。\n\n${snapshot.fallbackAnswer}`, snapshot)
  return {
    ok: valid.passed && !invalid.passed && valid.coveredSources.length === 2 && valid.checkedClaims > 0,
    checkedClaims: valid.checkedClaims,
    coveredSources: valid.coveredSources,
    rejectedInvalidAnswer: !invalid.passed,
  }
}
