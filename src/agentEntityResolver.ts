const clauseSeparator = /[，,；;。]\s*|(?:然后|另外|同时|再)(?=(?:帮我|给我|告诉我|查|看|打开|查看|分析|核对|列|说明|把|将|修改|更新))/

export function splitAgentGoalClauses(question: string) {
  const clauses = question
    .split(clauseSeparator)
    .map((item) => item.replace(/^(?:并且|并|以及|还要|还有|再)\s*/, '').trim())
    .filter(Boolean)
  return clauses.length > 0 ? clauses : [question.trim()].filter(Boolean)
}

const toolClausePatterns: Record<string, RegExp> = {
  query_month_finance: /金额|收入|工资|结算|计费工时|待验收金额|多少钱|月度工时/,
  search_product_help: /Giverny|吉维尼|网站|工作助手|大模型|主题|快捷键|设置页|功能入口|品牌故事|品牌理念|Slogan|口号|怎么|如何|在哪/i,
  search_workspace: /全站|整个网站|所有地方|统一搜索|全域搜索|到处|不记得.*在哪|任务|附件|对话|知识|记忆/,
  audit_workspace_consistency: /一致性|数据审计|数据矛盾|附件丢失|快照损坏|对不上/,
  query_formal_deliverables: /正式交付物|项目状态报告|验收报告|审计报告/,
  query_high_risk_actions: /高风险|风险操作|审批证据|撤销.*操作/,
  query_plan_continuation: /继续|接着|续接|往下推进|执行下一步|执行计划|任务计划|项目计划/,
  get_requester_profile: /用户画像|需求人画像|合作画像|客户画像|合作特征|合作偏好|报价建议|排期建议/,
  query_task_portfolio: /哪些|所有|全部|多个|多项|汇总|概况|清单|延期|逾期|等待|未完成|已验收|待验收/,
  get_task_detail: /任务|项目|工作|详情|进展|状态|卡在|卡点|等待|延期|逾期|交付/,
  search_tasks: /任务|项目|工作|进展|状态|补录|交付/,
  search_attachments: /附件|交付件|验收文件|文件|预览|下载/,
}

export function scopedQuestionForAgentTool(question: string, toolName: string) {
  const pattern = toolClausePatterns[toolName]
  if (!pattern) return question.trim()
  const matches = splitAgentGoalClauses(question).filter((clause) => pattern.test(clause))
  return (matches.length > 0 ? matches.join('；') : question).trim()
}

function cleanRequesterName(value: string) {
  return value
    .replace(/^.*(?:不要调工具|凭印象|帮我|给我|查一下|看一下|分析一下|分析|查看|查询|了解|说说)/, '')
    .replace(/^(?:的|一下|下)/, '')
    .trim()
}

export function requesterNameFromQuestion(question: string) {
  const scoped = scopedQuestionForAgentTool(question, 'get_requester_profile')
  const patterns = [
    /([\u4e00-\u9fa5A-Za-z·]{2,20})的(?:用户|需求人|合作|客户)?(?:画像|特征|偏好|报价建议|排期建议)/,
    /(?:需求人|合作伙伴|客户|用户)\s*([\u4e00-\u9fa5A-Za-z·]{2,20})\s*(?:画像|特征|偏好)/,
  ]
  for (const pattern of patterns) {
    const match = scoped.match(pattern)
    if (match?.[1]) return cleanRequesterName(match[1])
  }
  return ''
}

function cleanTaskTitle(value: string) {
  return value
    .replace(/^(?:请|麻烦|帮我|给我|告诉我|查一下|看一下|打开|读取|查看|预览|下载|找到?|搜索|分析)\s*/, '')
    .replace(/^(?:这个|那个|刚才那个|上述|当前|该)\s*/, '')
    .replace(/(?:这个)?任务\s*#\d+[：:]?\s*/, '')
    .replace(/(?:的)?(?:验收附件|验收文件|交付附件|交付件|附件|文件)$/, '')
    .replace(/(?:这个)?任务$/, '')
    .trim()
}

export function taskTitleFromQuestion(question: string) {
  const clauses = splitAgentGoalClauses(question)
  for (const clause of clauses) {
    const attachmentTitle = clause.match(/(?:打开|读取|查看|预览|下载|找到?|搜索)?\s*(.{2,80}?)(?:的)?(?:验收附件|验收文件|交付附件|交付件|附件)/)?.[1]
    const cleaned = attachmentTitle ? cleanTaskTitle(attachmentTitle) : ''
    if (cleaned && !/^(?:这个|那个|当前|该)?任务$/.test(cleaned)) return cleaned
  }
  const scoped = scopedQuestionForAgentTool(question, 'get_task_detail')
  return cleanTaskTitle(scoped
    .split(/(?:目前|现在|做到|的?详情|的?进展|的?状态|卡在|为什么|有哪些|是否)/)[0]
    .split('；')[0])
}
