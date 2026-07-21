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

function chooseTool(messages) {
  const text = userText(messages)
  const tools = calledTools(messages)
  if (text.includes('工具结果 JSON')) {
    if (/显示金额|隐藏金额/.test(text)) {
      return completion({ role: 'assistant', content: '显示或隐藏金额的快捷键是 **Command + Shift + M**；Windows 是 **Ctrl + Shift + M**。' })
    }
    if (/用户问题：[\s\S]*?(?:卡在哪|为什么一直没有交付)/.test(text)) {
      return completion({ role: 'assistant', content: '这个任务目前卡在等待环节，具体原因是 **等待刘总的建议**。' })
    }
    return completion({ role: 'assistant', content: '已根据站内工具返回的真实数据完成回答。' })
  }
  const isChatPlanner = messages.some((message) => message.role === 'system' && String(message.content || '').includes('Giverny 的聊天智能体规划器'))
    || (text.includes('requestedMonthCandidates') && text.includes('hasAttachments') && text.includes('useKnowledge'))
  if (isChatPlanner) {
    const questionMatch = text.match(/"question"\s*:\s*"((?:\\.|[^"\\])*)"/)
    const plannerQuestion = questionMatch ? JSON.parse(`"${questionMatch[1]}"`) : text
    if (/快捷键|怎么用键盘|功能入口/.test(plannerQuestion)) {
      return completion({ role: 'assistant', content: JSON.stringify({ intent: 'product_help', tools: [{ name: 'search_product_help', args: { query: plannerQuestion }, reason: '用户在询产品用法' }], confidence: 0.99 }) })
    }
    if (/卡在哪|为什么一直没有交付/.test(plannerQuestion)) {
      return completion({ role: 'assistant', content: JSON.stringify({ intent: 'task_data', tools: [{ name: 'get_task_detail', args: { title: '公司产品分套的修改' }, reason: '需要核对具体任务的等待记录' }], confidence: 0.99 }) })
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
      return completion({ role: 'assistant', content: '显示或隐藏金额的快捷键是 **Command + Shift + M**；Windows 是 **Ctrl + Shift + M**。' })
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

  if (/天气|删掉|所有任务都改成|所有密钥/.test(text)) {
    return completion({ role: 'assistant', content: '这个请求不在当前安全工具范围内。' })
  }
  if (/快捷键|怎么用键盘|能直接修改 Giverny 数据库/.test(text)) {
    return toolCall('search_product_help', { query: text, limit: 5 })
  }
  if (/当前网站能做什么/.test(text)) return toolCall('get_giverny_context', {})
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
  if (/删除.*等待记录|编辑.*等待记录|维护.*记录/.test(text)) {
    return toolCall('manage_record_preview', { taskId: 1, recordType: 'waiting', action: 'delete', recordId: 'eval-waiting-record' })
  }
  if (/附件|(?:找|找到|打开|预览|下载).*(?:文件|交付件)|(?:文件|交付件).*(?:找|打开|预览|下载)/.test(text)) {
    return toolCall('search_attachments', { query: text, limit: 30 })
  }
  if (text.includes('最近一次反馈')) return toolCall('search_tasks', { query: '最近任务', month: '2026-07', limit: 5 })
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
  if (/做到哪|所有进展|哪些附件|谁提的需求|几段工时|验收情况|封套项目|封套任务的详情|最近一次反馈|卡在哪|为什么一直没有交付/.test(text)) {
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
