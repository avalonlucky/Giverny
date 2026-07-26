import http from 'node:http'

const port = Number(process.env.MOCK_MODEL_PORT || 8898)
const requestLog = []
let strictJsonRepairAttempts = 0

function completion(message, finishReason = 'stop') {
  return {
    id: `eval-${crypto.randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'giverny-eval-model',
    choices: [{ index: 0, message, finish_reason: finishReason }],
    usage: { prompt_tokens: 20, completion_tokens: 12, total_tokens: 32 },
  }
}

function toolCall(name, args) {
  return completion({
    role: 'assistant',
    content: null,
    tool_calls: [{
      id: `call-${crypto.randomUUID()}`,
      type: 'function',
      function: { name, arguments: JSON.stringify(args) },
    }],
  }, 'tool_calls')
}

function userText(messages) {
  const value = [...messages].reverse().find((message) => message.role === 'user')?.content
  return typeof value === 'string' ? value : JSON.stringify(value || '')
}

function calledTools(messages) {
  return messages.flatMap((message) => {
    if (message.role === 'tool') return message.name ? [String(message.name)] : []
    if (message.role !== 'assistant' || !Array.isArray(message.tool_calls)) return []
    return message.tool_calls.map((call) => String(call.function?.name || '')).filter(Boolean)
  })
}

function ambiguousTitle(text) {
  if (text.includes('公司产品封套修改')) return '公司产品封套修改'
  for (const keyword of ['封套', '海报', '视频', '设计', '产品']) {
    if (text.includes(keyword)) return keyword
  }
  return ''
}

function productHelpAnswer(text) {
  const questionMatch = text.match(/用户问题：\s*([\s\S]*?)\s*工具结果 JSON：/)
    || text.match(/当前问题：\s*([\s\S]*?)\s*已核验事实：/)
  const subject = questionMatch?.[1]?.trim() || text
  if (/显示金额|隐藏金额/.test(subject)) {
    return '显示或隐藏金额的快捷键是 **Command + Shift + M**；Windows 是 **Ctrl + Shift + M**。'
  }
  if (/最近更新|更新了哪些|更新了什么|最新版本/.test(subject)) {
    const verifiedFacts = text.split('已核验事实：').at(-1)?.trim() || ''
    const latestSection = verifiedFacts.split(/\n(?=\*\*已核验|\*\*[^*]+\*\*)/)[0]?.trim()
    return latestSection || '已按当前产品知识库中的最新版本记录整理更新内容。'
  }
  if (/为什么叫.*(?:Giverny|吉维尼)|(?:Giverny|吉维尼).*由来|品牌故事/i.test(subject)) {
    return 'Giverny 的名字是作者为致敬莫奈而取。莫奈晚年居住在法国小镇吉维尼；网站以“莫奈花园”为主题，四季配色取自《睡莲》。品牌理念是让产品加入艺术成分、让创作成为乐趣，Slogan 是“让创作在自己的花园里生长”。'
  }
  if (/Giverny\s*主题|吉维尼(?:主题|模式)|开通.*主题|开启.*主题/i.test(subject)) {
    return '进入 **设置 → 外观 → 吉维尼模式**，打开开关即可启用；季节可跟随当前日期或手动锁定。'
  }
  if (/怎么设置大模型|如何设置大模型|配置大模型|模型设置|API\s*Key/i.test(subject)) {
    return '进入 **设置 → 模型**，配置并启用服务商，填写 API Key 后加载模型、选择供应商默认模型，最后在页面上方设置全站文字模型和图片模型。'
  }
  return '已根据站内产品知识工具返回的官方资料完成回答。'
}

function toolResultText(text) {
  const marker = '工具结果 JSON：'
  const index = text.indexOf(marker)
  return index >= 0 ? text.slice(index + marker.length) : text
}

function hasToolResult(text, toolName) {
  const resultText = toolResultText(text)
  const escapedName = toolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`"name"\\s*:\\s*"${escapedName}"|"tool"\\s*:\\s*"${escapedName}"`).test(resultText)
}

function structuredInput(text) {
  const marker = '输入数据：'
  const index = text.lastIndexOf(marker)
  if (index < 0) return {}
  try { return JSON.parse(text.slice(index + marker.length).trim()) } catch { return {} }
}

function plannedCallFromCompletion(value) {
  const call = value?.choices?.[0]?.message?.tool_calls?.[0]?.function
  if (!call?.name) return null
  let args = {}
  try { args = JSON.parse(call.arguments || '{}') } catch { /* Keep empty args for schema validation. */ }
  return { name: String(call.name), args, reason: '隔离评测按完整语义选择的必要能力。' }
}

function directorMetadata(toolName, question) {
  const product = toolName === 'search_product_help' || toolName === 'get_giverny_context'
  const web = toolName === 'search_web'
  const workspaceSearch = toolName === 'search_workspace'
  const isWrite = toolName.endsWith('_preview') || ['create_task_plan', 'prepare_attachment_upload', 'generate_settlement_receipt'].includes(toolName)
  const operation = toolName === 'create_task_preview' ? 'create_task'
    : toolName.includes('feedback') ? 'feedback'
      : toolName.includes('waiting') ? 'waiting'
        : toolName.includes('progress') ? 'progress'
          : toolName.includes('acceptance') ? 'acceptance'
            : toolName.includes('settlement') || toolName.includes('month_finance') ? 'settlement_export'
          : toolName === 'inspect_attachment_evidence' ? 'attachment_inspect'
            : toolName.includes('attachment') ? 'attachment_manage'
              : toolName.includes('formal_deliverable') ? 'formal_deliverable'
                : toolName.includes('agenda') || toolName.includes('schedule') || toolName.includes('reminder') ? 'schedule'
                  : toolName.includes('ai_') || toolName.includes('route') ? 'model_config'
                    : toolName.includes('enterprise_memory') ? 'enterprise_memory'
                      : toolName.includes('plan') || toolName.includes('project_execution') ? 'task_plan'
                        : 'general'
  const domain = product ? 'product_help'
    : web ? 'web'
    : workspaceSearch ? 'workspace_search'
      : /finance|settlement/.test(toolName) ? 'finance'
        : /attachment/.test(toolName) ? 'files'
          : /agenda|schedule|reminder/.test(toolName) ? 'calendar'
            : /memory/.test(toolName) ? 'memory'
              : /analysis|audit|deliverable|monthly_review/.test(toolName) ? 'analysis'
                : /risk|security|diagnose_ai/.test(toolName) ? 'security'
                  : toolName ? 'tasks' : 'conversation'
  const complex = /(?:再|同时|另外|然后|并且|以及)/.test(question) || /最近一次反馈/.test(question)
  const planned = plannedCallFromCompletion(chooseTool([{ role: 'user', content: question }]))
  if (planned?.name?.endsWith('_preview') && !/^\s*你?帮我新建一个任务[\s。！!]*$/.test(question)) {
    planned.grounding = Object.fromEntries(Object.keys(planned.args).map((field) => [field, question]))
  }
  return {
    goal: question.slice(0, 120), domains: [domain], operation,
    requiresBusinessData: Boolean(toolName) && !product && !web,
    requiresProductKnowledge: product, isWrite,
    missingInformation: [], confidence: 0.98,
    rationale: product ? '这是产品使用问题。' : isWrite ? '这是站内业务操作。' : toolName ? '需要核对真实业务数据。' : '可以直接回答。',
    complexity: complex ? 'complex' : 'simple',
    proposedCalls: !complex && planned ? [planned] : [],
  }
}

function chooseTool(messages) {
  const text = userText(messages)
  const tools = calledTools(messages)
  if (text.includes('已经由程序核验的事实')) {
    if (/当前问题：[\s\S]*?(?:最近|最新).*(?:导出|结算|回单)/.test(text)) {
      const range = text.match(/(20\d{2}-\d{2}-\d{2})\s*至\s*(20\d{2}-\d{2}-\d{2})/)
      if (range) return completion({ role: 'assistant', content: `最近一次导出的结算报表范围是 **${range[1]} 至 ${range[2]}**。` })
    }
    if (text.includes('已复核结算快照')) {
      const amount = text.match(/逐行合计：[^\n]*?(¥[\d,.]+)/)?.[1] || '核验金额'
      const range = text.match(/日期范围：(20\d{2}-\d{2}-\d{2})\s*至\s*(20\d{2}-\d{2}-\d{2})/)
      return completion({ role: 'assistant', content: `重新核对后，${range ? `${range[1]} 至 ${range[2]} 的` : ''}结算金额是 **${amount}**，逐行小计与快照汇总一致。` })
    }
    if (/显示金额|隐藏金额|Giverny\s*主题|吉维尼|大模型|模型设置|最近更新|更新了哪些|更新了什么|品牌故事/i.test(text)) {
      return completion({ role: 'assistant', content: productHelpAnswer(text) })
    }
    if (text.includes('等待刘总的建议')) return completion({ role: 'assistant', content: '这个任务目前在等待 **刘总的建议**，因此还没有继续交付。' })
    const facts = text.split('已核验事实：').at(-1)?.trim() || '已完成核对。'
    return completion({ role: 'assistant', content: facts })
  }
  if (text.includes('工具结果 JSON')) {
    if (hasToolResult(text, 'get_requester_profile')) {
      return completion({ role: 'assistant', content: '陈义君的需求人画像：共 4 个项目、13.6h，验收通过率 50%，可据此安排报价和排期。' })
    }
    if (/显示金额|隐藏金额|Giverny\s*主题|吉维尼|大模型|模型设置|最近更新|更新了哪些|更新了什么|品牌故事/i.test(text)) {
      return completion({ role: 'assistant', content: productHelpAnswer(text) })
    }
    if (/用户问题：[\s\S]*?(?:卡在哪|为什么一直没有交付)/.test(text)) {
      return completion({ role: 'assistant', content: '这个任务目前卡在等待环节，具体原因是 **等待刘总的建议**。' })
    }
    if (hasToolResult(text, 'inspect_attachment_evidence')) {
      return completion({ role: 'assistant', content: '附件 OCR 识别到活动主题与日期，任务需求匹配。 [attachment:101:extracted-text] [attachment:101:analysis]' })
    }
    if (hasToolResult(text, 'query_attachment_analysis')) {
      return completion({ role: 'assistant', content: '已按附件分析状态返回失败记录和重试次数。' })
    }
    return completion({ role: 'assistant', content: '已根据站内工具返回的真实数据完成回答。' })
  }
  const isIntentDirector = text.includes('Giverny Agent 的意图导演')
    || messages.some((message) => message.role === 'system' && String(message.content || '').includes('Giverny Agent 的意图导演'))
  if (isIntentDirector) {
    const input = structuredInput(text)
    const question = String(input.question || '')
    const planned = plannedCallFromCompletion(chooseTool([{ role: 'user', content: question }]))
    const decision = directorMetadata(planned?.name || '', question)
    if (process.env.MOCK_MODEL_DEBUG === '1') console.error('[director]', { question, planned: planned?.name, decision })
    return completion({ role: 'assistant', content: JSON.stringify(decision) })
  }
  const isDirectedPlanner = text.includes('Giverny Agent 的工具规划器')
    || messages.some((message) => message.role === 'system' && String(message.content || '').includes('Giverny Agent 的工具规划器'))
  if (isDirectedPlanner) {
    const input = structuredInput(text)
    const question = String(input.question || '')
    const allowed = new Set((input.capabilities || []).map((item) => String(item.name || '')))
    const planned = plannedCallFromCompletion(chooseTool([{ role: 'user', content: question }]))
    let calls = planned && allowed.has(planned.name) ? [planned] : []
    if (/最近一次反馈/.test(question)) {
      calls = [
        { name: 'search_tasks', args: { query: '最近任务', month: '2026-07', limit: 5 }, reason: '先定位最近任务。' },
        { name: 'get_task_detail', args: {}, reason: '读取上一步定位到的最近任务反馈。' },
      ].filter((call) => allowed.has(call.name))
    } else if (/(?:所有|全部|概况|没闭环|负责人和最近进展).*(?:项目|任务|工作)|(?:项目|任务|工作).*(?:正在等待|概况|没闭环|负责人和最近进展)|哪些项目正在等待/.test(question)) {
      calls = allowed.has('query_task_portfolio') ? [{ name: 'query_task_portfolio', args: { scope: question.includes('等待') ? 'waiting' : 'all', limit: 100 }, reason: '需要跨任务聚合，不能用标题搜索代替。' }] : []
    } else if (/^\s*你?帮我新建一个任务[\s。！!]*$/.test(question)) {
      calls = allowed.has('create_task_preview') ? [{ name: 'create_task_preview', args: {}, reason: '进入新任务草稿并由后端返回缺失字段。' }] : []
    } else if (/平均每个任务.*(?:多久|时间)|每个任务.*平均/.test(question)) {
      calls = allowed.has('query_month_finance') ? [{ name: 'query_month_finance', args: { question, currentMonth: '2026-07', months: '2026-07' }, reason: '需要用确定性工时统计计算任务均值。' }] : []
    } else if (/(?:生成|制作).*(?:项目状态报告|验收报告|一致性审计报告)/.test(question)) {
      calls = allowed.has('generate_formal_deliverable_preview') ? [{ name: 'generate_formal_deliverable_preview', args: { type: question.includes('验收报告') ? 'acceptance_report' : question.includes('审计报告') ? 'consistency_audit' : 'project_status', taskId: question.includes('审计报告') ? undefined : 1, title: '隔离评测正式报告' }, reason: '生成绑定权威快照的正式交付物草稿。' }] : []
    }
    if (process.env.MOCK_MODEL_DEBUG === '1') console.error('[planner]', { question, allowed: [...allowed], planned: planned?.name, calls: calls.map((call) => call.name) })
    return completion({ role: 'assistant', content: JSON.stringify({ calls, needsInput: false, followUpQuestion: '', answerIfNoTools: calls.length ? '' : '请补充需要处理的具体信息。' }) })
  }
  const isChatPlanner = messages.some((message) => message.role === 'system' && String(message.content || '').includes('Giverny 的聊天智能体规划器'))
    || (text.includes('requestedMonthCandidates') && text.includes('hasAttachments') && text.includes('useKnowledge'))
  if (isChatPlanner) {
    const questionMatch = text.match(/"question"\s*:\s*"((?:\\.|[^"\\])*)"/)
    const plannerQuestion = questionMatch ? JSON.parse(`"${questionMatch[1]}"`) : text
    if (/快捷键|怎么用键盘|功能入口|网站怎么用|怎么设置|如何设置|配置大模型|模型设置|最近更新|更新了哪些|更新了什么|为什么叫.*(?:Giverny|吉维尼)|品牌故事|品牌理念|Slogan|口号/i.test(plannerQuestion)) {
      return completion({ role: 'assistant', content: JSON.stringify({ intent: 'product_help', tools: [{ name: 'search_product_help', args: { query: plannerQuestion }, reason: '用户在询产品用法' }], confidence: 0.99 }) })
    }
    if (/(?:组织规则|合作伙伴|项目).*(?:记忆|长期偏好|历史决策|之前记住)/.test(plannerQuestion)) {
      return completion({ role: 'assistant', content: JSON.stringify({ intent: 'knowledge', tools: [{ name: 'query_enterprise_memory', args: { query: plannerQuestion, limit: 30 }, reason: '需要读取有来源和有效期的企业记忆' }], confidence: 0.99 }) })
    }
    if (/画像|需求人.*(?:特征|偏好|分析)|合作.*(?:画像|特征|偏好|建议)/.test(plannerQuestion)) {
      return completion({ role: 'assistant', content: JSON.stringify({ intent: 'person_profile', tools: [{ name: 'get_requester_profile', args: { name: '陈义君' }, reason: '需要聚合需求人历史任务画像' }], confidence: 0.99 }) })
    }
    if (/卡在哪|为什么一直没有交付/.test(plannerQuestion)) {
      return completion({ role: 'assistant', content: JSON.stringify({ intent: 'task_data', tools: [{ name: 'get_task_detail', args: { title: '公司产品分套的修改' }, reason: '需要核对具体任务的等待记录' }], confidence: 0.99 }) })
    }
    if (/(?:日程|安排|空闲|空档|有空|时间槽|什么时候能安排|本周计划|今天计划|明天计划)/.test(plannerQuestion) && !/(?:安排|计划).*(?:做|制作|设计|新建|创建|新增)/.test(plannerQuestion)) {
      return completion({ role: 'assistant', content: JSON.stringify({ intent: 'task_data', tools: [{ name: 'query_agenda', args: { startDate: '2026-07-25', endDate: '2026-07-31', durationMinutes: /两小时|2小时/.test(plannerQuestion) ? 120 : undefined }, reason: '需要读取任务、提醒和可用时间' }], confidence: 0.99 }) })
    }
    if (/(?:导出|生成|下载).*(?:结算回单|Excel|excel)/.test(plannerQuestion)) {
      return completion({ role: 'assistant', content: JSON.stringify({ intent: 'finance', tools: [{ name: 'generate_settlement_receipt', args: { startDate: '2026-06-01', endDate: '2026-06-10' }, reason: '需要生成可下载的正式回单' }], confidence: 0.99 }) })
    }
    if (/收入|金额|工时|结算|工资/.test(plannerQuestion)) {
      return completion({ role: 'assistant', content: JSON.stringify({ intent: 'finance', tools: [{ name: 'query_month_finance', args: { months: /6月/.test(plannerQuestion) ? ['2026-06'] : ['2026-07'] }, reason: '需要读取确定性结算数据' }], confidence: 0.98 }) })
    }
    if (/任务|工作|项目/.test(plannerQuestion)) {
      return completion({ role: 'assistant', content: JSON.stringify({ intent: 'task_data', tools: [{ name: 'search_tasks', args: { query: plannerQuestion, limit: 12 }, reason: '需要查询真实任务数据' }], confidence: 0.9 }) })
    }
    return completion({ role: 'assistant', content: JSON.stringify({ intent: 'general', tools: [{ name: 'none', args: {}, reason: '不需要站内数据' }], confidence: 0.9 }) })
  }
  if (text.includes('STRICT_JSON_REPAIR_EVAL')) {
    strictJsonRepairAttempts += 1
    if (strictJsonRepairAttempts === 1) {
      return completion({ role: 'assistant', content: '{"optimizedText":' })
    }
    return completion({
      role: 'assistant',
      content: JSON.stringify({
        optimizedText: '1、已使用当前选择的 DeepSeek 完成同模型结构修复。',
        summary: '同模型修复完成',
      }),
    })
  }
  if (text.includes('EMERGENCY_FALLBACK_EVAL')) {
    return completion({
      role: 'assistant',
      content: JSON.stringify({
        optimizedText: '1、所选模型连续故障后，由应急备用模型保障本次工作继续完成。',
        summary: '应急备用完成',
      }),
    })
  }
  if (text.includes('Giverny 的工作分析师')) {
    if (!text.includes('"type":"monthly_review"')) {
      return completion({
        role: 'assistant',
        content: '## 分析结论\n- 已按结构化数据完成专题分析。\n## 关键发现\n- 所有判断均来自任务与附件快照。\n## 建议动作\n- 优先处理明确风险并持续跟踪。',
      })
    }
    return completion({
      role: 'assistant',
      content: '## 本月结论\n- 隔离评测月度数据已核对。\n## 完成与产出\n- 任务结果以结构化快照为准。\n## 未完成与风险\n- 无额外编造。\n## 工作模式\n- 已汇总工时和进展。\n## 下月动作\n- 优先跟进未完成任务。',
    })
  }
  if (text.includes('附件命名偏好分析助手')) {
    return completion({
      role: 'assistant',
      content: '聊天记录、验收确认和审批通过截图优先使用短语义名，如“验收通过截图”；避免复述完整任务标题或项目通用名称。',
    })
  }
  if (text.includes('"currentFileName":"next-chat-proof.png"') && text.includes('验收通过截图')) {
    return completion({
      role: 'assistant',
      content: JSON.stringify({
        suggestedName: '验收通过截图.png',
        reason: '沿用已确认的验收截图命名',
        confidence: '高',
      }),
    })
  }
  if (tools.length > 0) {
    if (tools.includes('search_product_help')) {
      return completion({ role: 'assistant', content: productHelpAnswer(text) })
    }
    if (tools.includes('get_requester_profile')) {
      return completion({ role: 'assistant', content: '陈义君的需求人画像：共 4 个项目、13.6h，验收通过率 50%，可据此安排报价和排期。' })
    }
    if (tools.includes('get_task_detail') && /卡在哪|为什么一直没有交付/.test(text)) {
      return completion({ role: 'assistant', content: '这个任务目前卡在等待环节，具体原因是 **等待刘总的建议**。' })
    }
    if (text.includes('最近一次反馈') && !tools.includes('get_task_detail')) {
      return toolCall('get_task_detail', { taskId: 1 })
    }
    if (tools.includes('search_attachments')) {
      return completion({
        role: 'assistant',
        content: '已找到相关附件，可以直接在下方预览或打开。\n\n| 任务 | 文件数 | 主要类型 |\n| --- | ---: | --- |\n| 直播设计 | 2 | JPG 验收文件 |',
      })
    }
    return completion({ role: 'assistant', content: '评测工具已经返回，我会严格按照工具结果回答。' })
  }

  if (/批量事务|同时把任务\s*#1.*任务\s*#2/.test(text)) {
    return toolCall('batch_task_operations_preview', {
      reason: '隔离评测批量操作',
      operations: [
        { action: 'update_task_fields', taskId: 1, fields: { contact: '批量评测对接人' } },
        { action: 'append_waiting', taskId: 2, note: '等待批量评测资料', waitingReason: '等待补充资料', startDateTime: '2026-07-18T10:00', endDateTime: '2026-07-18T10:00' },
      ],
    })
  }

  if (/删掉|所有任务都改成|所有密钥/.test(text)) {
    return completion({ role: 'assistant', content: '这个请求不在当前安全工具范围内。' })
  }
  if (/天气|新闻|实时消息/.test(text)) return toolCall('search_web', { query: text })
  if (/(?:主模型|备用模型|大模型|模型路由).*(?:不可用|失败|异常|故障|回退|回落|切换)|(?:为什么|为何).*(?:备用模型|模型).*(?:启动|切换|不可用)/.test(text)) return toolCall('diagnose_ai_routing', { scope: 'all', includeRecentFallbacks: true })
  if (/(?:恢复|撤销).*(?:模型路由|模型配置|上一次配置)/.test(text)) return toolCall('restore_ai_routing_preview', {})
  if (/(?:全站|整个网站|所有地方|统一搜索|全域搜索|不记得.*在哪).*(?:搜|查|找)|(?:统一搜索|全域搜索)/.test(text)) return toolCall('search_workspace', { query: text, limit: 20 })
  if (/(?:生成|制作).*(?:项目状态报告|验收报告|一致性审计报告)/.test(text)) return toolCall('generate_formal_deliverable_preview', { type: text.includes('验收报告') ? 'acceptance_report' : text.includes('审计报告') ? 'consistency_audit' : 'project_status', taskId: text.includes('审计报告') ? undefined : 1, title: '隔离评测正式报告' })
  if (/(?:一致性审计|数据一致性|数据.*(?:矛盾|对不上)|附件.*丢失|结算快照.*损坏)/.test(text)) return toolCall('audit_workspace_consistency', { trigger: 'manual', includeR2: false, limit: 200 })
  if (/(?:查询|查看|哪些|有没有).*(?:高风险操作|风险案件|审批证据)/.test(text)) return toolCall('query_high_risk_actions', { status: 'all', limit: 30 })
  if (/快捷键|怎么用键盘|能直接修改 Giverny 数据库|Giverny\s*主题|吉维尼(?:主题|模式)|怎么设置大模型|如何设置大模型|配置大模型|模型设置|最近更新|更新了哪些|更新了什么|为什么叫.*(?:Giverny|吉维尼)|品牌故事|品牌理念|Slogan|口号/i.test(text)) {
    return toolCall('search_product_help', { query: text, limit: 5 })
  }
  if (/(?:组织规则|合作伙伴|项目).*(?:记忆|长期偏好|历史决策|之前记住)/.test(text)) return toolCall('query_enterprise_memory', { query: text, limit: 30 })
  if (/(?:记住|保存为).*(?:组织规则|合作伙伴|项目|偏好|约定)/.test(text)) return toolCall('manage_enterprise_memory_preview', { action: 'create', scopeType: 'partner', scopeKey: '昂楷', memoryType: 'preference', title: '验收文件偏好', content: '验收时优先提供 PDF。', sourceType: 'conversation', sourceLabel: '用户在当前对话中确认', confidence: 'confirmed' })
  if (/画像|需求人.*(?:特征|偏好|分析)|合作.*(?:画像|特征|偏好|建议)/.test(text)) {
    return toolCall('get_requester_profile', { name: /陈义君/.test(text) ? '陈义君' : '黄媚' })
  }
  if (/当前网站能做什么/.test(text)) return toolCall('get_giverny_context', {})
  if (/最该.*处理|风险待办|主动事项|提醒处理效果|解决率|误报率/.test(text)) return toolCall('query_proactive_work', { status: 'active', limit: 50 })
  if (/(?:调整|修订|修改).*(?:执行计划|任务计划|项目计划).*(?:后续|未来|未执行|步骤)/.test(text)) return toolCall('manage_task_plan_preview', { planId: 'eval-plan', action: 'revise_steps', reason: '调整后续执行方式', steps: [{ key: 'progress-v2', label: '补充两版进展', action: 'append_progress', dependsOn: ['research'] }, { key: 'accept', label: '完成最终验收', action: 'complete_acceptance', dependsOn: ['progress-v2'] }] })
  if (/(?:暂停|恢复|重试|取消).*(?:执行计划|任务计划|项目计划)/.test(text)) return toolCall('manage_task_plan_preview', { planId: 'eval-plan', action: text.includes('恢复') ? 'resume' : text.includes('重试') ? 'retry_step' : text.includes('取消') ? 'cancel' : 'pause', stepId: text.includes('重试') ? 'eval-plan:progress' : undefined })
  if (/(?:继续|接着|续接|往下推进|执行下一步).*(?:执行计划|任务计划|项目计划|这个计划)|(?:执行计划|任务计划|项目计划).*(?:继续|接着|续接|往下推进|执行下一步)/.test(text)) return toolCall('query_plan_continuation', { taskId: 1, limit: 10 })
  if (/(?:执行计划|任务计划|项目计划|计划步骤|当前步骤|下一步|做到哪一步|为什么.{0,8}(?:卡住|阻塞)|失败步骤)/.test(text)) return toolCall('query_project_execution', { taskId: 1, status: 'open', limit: 20 })
  if (/(?:日程|安排|空闲|空档|有空|时间槽|什么时候能安排|本周计划|今天计划|明天计划)/.test(text) && !/(?:安排|计划).*(?:做|制作|设计|新建|创建|新增)/.test(text)) return toolCall('query_agenda', { startDate: '2026-07-25', endDate: '2026-07-31', durationMinutes: /两小时|2小时/.test(text) ? 120 : undefined, workingDayStart: '09:00', workingDayEnd: '18:00', slotStepMinutes: 30 })
  if (/月度复盘|工作复盘|复盘|整月.*分析|后台分析.*月|本月工作总结/.test(text)) {
    return toolCall('start_monthly_review', { month: /6\s*月|2026-06/.test(text) ? '2026-06' : '2026-07' })
  }
  if (/本周工作摘要|周报/.test(text)) return toolCall('start_deep_analysis', { type: 'weekly_digest', month: '2026-07' })
  if (/风险扫描|风险提示/.test(text)) return toolCall('start_deep_analysis', { type: 'risk_digest', month: '2026-07' })
  if (/跨任务|对比.*任务/.test(text)) return toolCall('start_deep_analysis', { type: 'cross_task_analysis', month: '2026-07', query: text })
  if (/批量附件|附件.*汇总/.test(text)) return toolCall('start_deep_analysis', { type: 'batch_attachment_analysis', month: '2026-07', query: text })
  if (/趋势分析|几个月.*趋势/.test(text)) return toolCall('start_deep_analysis', { type: 'trend_analysis', month: '2026-07' })
  if (/持续推进|从新建.*验收|全流程跟进|制定.*计划/.test(text)) {
    return toolCall('create_task_plan', {
      goal: '持续推进任务从创建到验收',
      taskId: 1,
      steps: [
        { label: '核对任务需求', action: 'update_task_fields' },
        { label: '记录制作进展', action: 'append_progress' },
        { label: '整理验收材料', action: 'mark_acceptance_files' },
        { label: '完成最终验收', action: 'complete_acceptance' },
      ],
    })
  }
  if (/长期记忆|未解决问题|历史脉络|甲方偏好/.test(text)) return toolCall('get_task_memory', { taskId: 1 })
  if (!/暂停|改成.*状态|状态改成/.test(text) && /记录等待|等待记录|等甲方|等待甲方|等待资料/.test(text)) {
    return toolCall('append_waiting_preview', { taskId: 1, note: '等待甲方补充资料', reason: '等待补充资料', startDateTime: '2026-07-16T10:00', endDateTime: '2026-07-16T12:00' })
  }
  if (/完整验收|确认验收|完成验收/.test(text)) {
    return toolCall('complete_acceptance_preview', { taskId: 1, acceptanceNote: '已完成全部设计修改并交付最终文件。', progressNote: '完成终稿整理与交付。', endDateTime: '2026-07-16T18:00', countTime: false, attachmentIds: [104] })
  }
  if (/标记.*验收文件|设为验收文件/.test(text)) {
    return toolCall('mark_acceptance_files_preview', { taskId: 1, attachmentIds: [104] })
  }
  if (/附件\s*101.*(?:具体内容|OCR|错别字|质量|需求匹配)/i.test(text)) {
    return toolCall('inspect_attachment_evidence', { attachmentIds: [101], includeExtractedText: true })
  }
  if (/(?:哪些附件|附件).*(?:分析失败|未分析|分析状态)/.test(text)) {
    return toolCall('query_attachment_analysis', { taskId: 13, statuses: ['missing', 'failed', 'unsupported'], limit: 30 })
  }
  if (/(?:重新分析|重试分析).*附件\s*102/.test(text)) {
    return toolCall('manage_attachment_analysis_preview', { attachmentIds: [102], action: 'retry' })
  }
  if (/附件\s*105.*(?:改名|重命名)/.test(text)) {
    return toolCall('update_attachment_metadata_preview', { attachmentId: 105, name: '内部策略留档', tag: '内部证据', scope: 'progress', visibleToClient: false })
  }
  if (/删除.*等待记录|编辑.*等待记录|维护.*记录/.test(text)) {
    return toolCall('manage_record_preview', { taskId: 1, recordType: 'waiting', action: 'delete', recordId: 'eval-waiting-record' })
  }
  if (/附件|(?:找|找到|打开|预览|下载).*(?:文件|交付件)|(?:文件|交付件).*(?:找|打开|预览|下载)/.test(text)) {
    return toolCall('search_attachments', { query: text, limit: 30 })
  }
  if (text.includes('最近一次反馈')) return toolCall('search_tasks', { query: '最近任务', month: '2026-07', limit: 5 })
  if (/(?:最近|最新).*(?:导出|结算报表|结算回单).*(?:几号|日期|范围)|(?:最近|最新).*(?:导出|结算报表|结算回单)/.test(text)) return toolCall('query_settlement_exports', { limit: 1 })
  if (/(?:导出|生成|下载|给我).*(?:结算回单|结算报表|Excel|excel)|(?:结算回单|结算报表).*(?:导出|生成|下载)/i.test(text)) {
    return toolCall('generate_settlement_receipt', { startDate: '2026-06-01', endDate: '2026-06-10' })
  }
  if (/预计收入|总工时|计费工时|收入|结算趋势|不计费工时|平均每个任务|最高|待验收金额|结算多少钱/.test(text)) {
    return toolCall('query_month_finance', {
      question: text,
      currentMonth: '2026-07',
      months: text.includes('5月和6月') ? '2026-05,2026-06' : /6月|37\.5/.test(text) ? '2026-06' : '2026-07',
    })
  }
  if (/新建|创建|帮我建|新任务|安排下周|记录一个补录任务|我要加个任务/.test(text)) {
    return toolCall('create_task_preview', {
      title: text.includes('Logo') ? 'Logo提案' : '评测创建任务',
      requirement: '隔离评测创建任务需求',
      type: '画册',
      startDate: '2026-07-16T09:00',
      estimatedDate: '2026-07-20T18:00',
      settlementMonth: '2026-07',
      estimatedHours: 4,
      requester: '评测需求人',
      billable: !text.includes('不计入结算'),
      isSupplemental: text.includes('补录'),
    })
  }
  if (/反馈|字号再放大/.test(text)) {
    const title = ambiguousTitle(text)
    return toolCall('record_feedback_preview', {
      ...(text.includes('#1') ? { taskId: 1 } : { taskTitle: title || '公司产品封套修改' }),
      note: '甲方要求调整当前设计内容',
      feedbackVersion: 'B02',
    })
  }
  if (/预计交付时间改|预估工时改|需求人改|交付日期延后/.test(text)) {
    const title = ambiguousTitle(text)
    return toolCall('update_task_fields_preview', {
      ...(text.includes('#1') ? { taskId: 1 } : { taskTitle: title || '公司产品封套修改' }),
      fields: text.includes('工时') ? { estimatedHours: 6 } : { estimatedDate: '2026-07-20T18:00' },
    })
  }
  if (/改成待验收|暂停|进度改成/.test(text)) {
    const title = ambiguousTitle(text)
    return toolCall('update_task_status_preview', {
      ...(text.includes('#1') ? { taskId: 1 } : { taskTitle: title || '公司产品封套修改' }),
      status: text.includes('暂停') ? '挂起' : '待验收',
      progress: text.includes('80') ? 80 : 100,
      reason: '隔离评测状态修改',
    })
  }
  if (/记录进展|记录一条.*进展|追加验收进展|改稿一轮|加一条进展/.test(text)) {
    const title = ambiguousTitle(text)
    return toolCall('append_progress_preview', {
      ...(text.includes('#1') ? { taskId: 1 } : { taskTitle: title || '公司产品封套修改' }),
      note: '隔离评测进展内容',
      startDateTime: '2026-07-15T14:00',
      endDateTime: '2026-07-15T16:00',
      isUncounted: text.includes('不计时'),
      isRevision: text.includes('改稿'),
      isAcceptanceProgress: text.includes('验收进展'),
    })
  }
  if (/做到哪|任务详情|所有进展|哪些附件|谁提的需求|几段工时|验收情况|封套项目|封套任务的详情|最近一次反馈|卡在哪|为什么一直没有交付/.test(text)) {
    const title = text.includes('封套任务的详情') ? '封套' : ''
    return toolCall('get_task_detail', title ? { title } : { taskId: 1 })
  }
  return toolCall('search_tasks', { query: text, month: /6月|2026-06/.test(text) ? '2026-06' : '2026-07', limit: 30 })
}

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/test/requests') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ requests: requestLog }))
    return
  }
  if (request.method === 'GET' && request.url === '/legacy-qwen/models') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ data: [{ id: 'qwen-1.8b-chat' }] }))
    return
  }
  if (request.method === 'GET' && request.url === '/legacy-qwen-denied/models') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ data: [{ id: 'qwen-1.8b-chat' }] }))
    return
  }
  if (request.method === 'POST' && request.url === '/legacy-qwen-denied/chat/completions') {
    response.writeHead(403, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: { message: 'workspace API host mismatch' } }))
    return
  }
  if (request.method === 'GET' && request.url?.endsWith('/models')) {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({
      data: [
        { id: 'deepseek-v4-flash' },
        { id: 'doubao-seed-eval' },
        { id: 'qwen3.7-plus' },
      ],
    }))
    return
  }
  let body = ''
  request.on('data', (chunk) => { body += chunk })
  request.on('end', () => {
    try {
      const payload = JSON.parse(body || '{}')
      requestLog.push({
        model: String(payload.model || ''),
        text: userText(Array.isArray(payload.messages) ? payload.messages : []).slice(0, 500),
        maxTokens: Number(payload.max_tokens || 0),
        thinking: payload.thinking?.type || '',
        responseFormat: payload.response_format?.type || '',
      })
      const requestedToolNames = Array.isArray(payload.tools)
        ? payload.tools.map((item) => String(item.function?.name || '')).filter(Boolean)
        : []
      const requestText = userText(Array.isArray(payload.messages) ? payload.messages : [])
      if (requestText.includes('EMERGENCY_FALLBACK_EVAL') && String(payload.model || '').includes('doubao')) {
        response.writeHead(503, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ error: { message: 'simulated selected provider outage' } }))
        return
      }
      if (requestText.includes('fallback-name-eval.png')) {
        response.writeHead(429, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ error: { message: 'simulated provider quota exhausted' } }))
        return
      }
      const result = requestedToolNames.includes('optimize_task_worklog_text')
        ? toolCall('optimize_task_worklog_text', {
            optimizedText: '1、完成与交付概况：已完成任务要求并交付《验收预览.pdf》。\n2、主要更新和修改：补充版式整理与视觉统一。\n3、反馈响应与版本迭代：项目实际投入 3 小时，一次交付，未产生改稿轮次；建议在最终稿修改 2026 年未来日期并清理画布边缘。\n4、最终文件：验收文件为《验收预览.pdf》。',
            summary: '隔离评测故意返回包含内部噪音与重复附件的验收备注。',
          })
        : chooseTool(Array.isArray(payload.messages) ? payload.messages : [])
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify(result))
    } catch (error) {
      response.writeHead(400, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    }
  })
})

server.listen(port, '127.0.0.1', () => process.stdout.write(`Eval model ready on ${port}\n`))
