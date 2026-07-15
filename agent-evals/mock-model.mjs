import http from 'node:http'

const port = Number(process.env.MOCK_MODEL_PORT || 8898)

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
  if (tools.length > 0) {
    if (text.includes('最近一次反馈') && !tools.includes('get_task_detail')) {
      return toolCall('get_task_detail', { taskId: 1 })
    }
    return completion({ role: 'assistant', content: '评测工具已经返回，我会严格按照工具结果回答。' })
  }

  if (/天气|删掉|所有任务都改成|所有密钥/.test(text)) {
    return completion({ role: 'assistant', content: '这个请求不在当前安全工具范围内。' })
  }
  if (/当前网站能做什么/.test(text)) return toolCall('get_giverny_context', {})
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
  if (/做到哪|所有进展|哪些附件|谁提的需求|几段工时|验收情况|封套项目|封套任务的详情|最近一次反馈/.test(text)) {
    const title = text.includes('封套任务的详情') ? '封套' : ''
    return toolCall('get_task_detail', title ? { title } : { taskId: 1 })
  }
  return toolCall('search_tasks', { query: text, month: /6月|2026-06/.test(text) ? '2026-06' : '2026-07', limit: 30 })
}

const server = http.createServer((request, response) => {
  let body = ''
  request.on('data', (chunk) => { body += chunk })
  request.on('end', () => {
    try {
      const payload = JSON.parse(body || '{}')
      const result = chooseTool(Array.isArray(payload.messages) ? payload.messages : [])
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify(result))
    } catch (error) {
      response.writeHead(400, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    }
  })
})

server.listen(port, '127.0.0.1', () => process.stdout.write(`Eval model ready on ${port}\n`))
