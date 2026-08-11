import { expect, test, type Page } from '@playwright/test'
import { PDF_PREVIEW_TIMEOUT_MS } from '../../src/lib/previewTimeout'

function createPdfFixture() {
  const stream = 'BT /F1 24 Tf 72 720 Td (Giverny acceptance preview) Tj ET'
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += object
  })
  const xrefOffset = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return Buffer.from(pdf)
}

async function login(page: Page) {
  const response = await page.request.post('/api/auth/login', {
    data: { email: 'bh141425@gmail.com', key: 'eval-admin-key' },
  })
  expect(response.ok()).toBeTruthy()
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'designer-worklog-auth',
      JSON.stringify({ email: 'bh141425@gmail.com', role: 'admin' }),
    )
  })
}

async function loginDemo(page: Page) {
  const response = await page.request.post('/api/auth/login', {
    data: { email: 'demo@mayeai.com', key: 'eval-admin-key' },
  })
  expect(response.ok()).toBeTruthy()
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'designer-worklog-auth',
      JSON.stringify({ email: 'demo@mayeai.com', role: 'demo' }),
    )
  })
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: /2026 年 7 月工作台/ })).toBeVisible()
}

test.beforeEach(async ({ page }, testInfo) => {
  // The browser fixtures intentionally model the July 2026 workspace. Keep the
  // app clock aligned with those fixtures so the suite does not drift each month.
  await page.clock.setFixedTime(new Date('2026-07-27T12:00:00+08:00'))
  if (testInfo.title.startsWith('demo ')) return
  await login(page)
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: /2026 年 7 月工作台/ })).toBeVisible()
})

test.describe('基础流程分片', () => {
test('demo 账号可打开验收进展并完成 Excel 回单导出', async ({ page }) => {
  await loginDemo(page)
  const headers = { 'x-auth-email': 'demo@mayeai.com', 'x-auth-key': 'eval-admin-key' }
  const createdResponse = await page.request.post('/api/tasks', {
    headers,
    data: {
      id: 0, date: '2026-07-20 09:00', estimatedDate: '2026-07-27 18:00', settlementMonth: '2026-07',
      type: '数据分析', title: '演示验收进展任务', requirement: '用于验证 demo 账号的验收与结算闭环。',
      requester: '闻舟', contact: '陈望', reviewer: '江屿', stage: '计划中', estimatedHours: 8,
      actualHours: 0, status: '计划中', progress: 0, billable: true, files: [],
    },
  })
  expect(createdResponse.ok()).toBeTruthy()
  const createdTask = await createdResponse.json() as { id: number }
  const preparedResponse = await page.request.patch(`/api/tasks/${createdTask.id}`, {
    headers,
    data: {
      status: '待验收', stage: '等待验收', progress: 92, actualHours: 2.25,
      timeEntries: [{ id: 'demo-browser-acceptance', date: '2026-07-24', start: '14:00', end: '16:15', note: '已提交演示交付件', isAcceptanceProgress: true }],
    },
  })
  expect(preparedResponse.ok()).toBeTruthy()
  await page.reload()

  await page.getByRole('button', { name: /已验收 1 个 展开/ }).click()
  const taskRow = page.locator('.task-row', { hasText: '演示验收进展任务' })
  await expect(taskRow).toBeVisible()
  await taskRow.click()

  const acceptanceEntry = page.locator('.dashboard-side-time-item', { hasText: '验收进展' }).first()
  await expect(acceptanceEntry).toBeVisible()
  await acceptanceEntry.getByRole('button', { name: '编辑' }).click()
  const acceptanceDialog = page.getByRole('dialog').filter({ hasText: '编辑验收进展' })
  await expect(acceptanceDialog.getByRole('heading', { name: '编辑验收进展' })).toBeVisible()
  await acceptanceDialog.getByRole('button', { name: '关闭', exact: true }).click()

  await page.getByRole('button', { name: '切换到结算', exact: true }).click()
  await expect(page).toHaveURL(/\/reports$/)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出范围 Excel' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('结算回单_20260701-20260727.xlsx')
  await expect(page.getByText(/Excel 回单导出失败/)).toHaveCount(0)
})

test('demo Agent 会把整月导出请求转成可下载回单', async ({ page }) => {
  await loginDemo(page)
  await page.getByRole('button', { name: '打开工作助手' }).click()
  const dialog = page.getByRole('dialog', { name: '爱丽丝' })
  const input = dialog.getByPlaceholder('向爱丽丝提问…')
  await input.fill('请导出七月份的任务回单总结。')
  await input.press('Enter')
  await expect(dialog.getByText('已核验结算回单').first()).toBeVisible({ timeout: 30_000 })
  await expect(dialog.getByText(/日期范围：2026-07-01 至 2026-07-31/).first()).toBeVisible()
  await expect(dialog.getByRole('link', { name: '下载' })).toBeVisible()
  await expect(dialog.getByRole('link', { name: '在线预览' })).toBeVisible()
})

test('demo 只开放当前演示工作区的完整数据权限', async ({ page }) => {
  await loginDemo(page)
  const headers = { 'x-auth-email': 'demo@mayeai.com', 'x-auth-key': 'eval-admin-key' }
  const createdTaskResponse = await page.request.post('/api/tasks', {
    headers,
    data: {
      id: 0, date: '2026-07-21 09:00', estimatedDate: '2026-07-28 18:00', settlementMonth: '2026-07',
      type: '产品经理', title: '演示权限边界任务', requirement: '验证 demo 工作区内的完整数据操作。',
      requester: '林知夏', contact: '周序', reviewer: '顾言', stage: '计划中', estimatedHours: 4,
      actualHours: 0, status: '计划中', progress: 0, billable: true, files: [],
    },
  })
  expect(createdTaskResponse.status()).toBe(201)
  const createdTask = await createdTaskResponse.json() as { id: number }
  expect((await page.request.post(`/api/tasks/${createdTask.id}/void`, { headers, data: { reason: '演示权限回归' } })).ok()).toBeTruthy()
  expect((await page.request.post(`/api/tasks/${createdTask.id}/restore`, { headers })).ok()).toBeTruthy()
  await page.request.post(`/api/tasks/${createdTask.id}/void`, { headers, data: { reason: '演示清理' } })
  expect((await page.request.delete(`/api/tasks/${createdTask.id}`, { headers })).ok()).toBeTruthy()

  const exportResponse = await page.request.post('/api/settlement-exports', {
    headers,
    data: { startDate: '2026-07-01', endDate: '2026-07-31' },
  })
  expect(exportResponse.status()).toBe(201)
  const createdExport = await exportResponse.json() as { record: { id: string } }
  expect((await page.request.patch(`/api/settlement-exports/${createdExport.record.id}/access`, {
    headers,
    data: { expiresAt: '2099-07-31T23:59:59.000Z', disabled: false },
  })).ok()).toBeTruthy()
  expect((await page.request.patch(`/api/settlement-exports/${createdExport.record.id}/lock`, { headers, data: { locked: true } })).ok()).toBeTruthy()
  expect((await page.request.delete(`/api/settlement-exports/${createdExport.record.id}`, { headers, data: { password: 'eval-admin-key' } })).ok()).toBeTruthy()

  expect((await page.request.patch('/api/settings/hourly-rate', { headers, data: { hourlyRate: 1 } })).status()).toBe(403)
  expect((await page.request.post('/api/tokens', { headers, data: { scope: 'admin' } })).status()).toBe(403)
  expect((await page.request.put('/api/ai/active-model', { headers, data: { active: 'deepseek' } })).status()).toBe(403)
  expect((await page.request.post('/api/workspaces', { headers, data: { name: '不应创建' } })).status()).toBe(403)
})

test('正式路由树处理重定向、未知地址与任务视图历史', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: /2026 年 7 月工作台/ })).toBeVisible()

  await page.goto('/updates')
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.getByRole('heading', { name: '任务管理' })).toBeVisible()

  await page.goto('/route-that-does-not-exist')
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.getByRole('button', { name: '切换到任务' }).click()
  await page.getByRole('button', { name: '日历视图', exact: true }).click()
  await expect(page).toHaveURL(/\/tasks\?taskView=calendar$/)
  await expect(page.getByRole('heading', { name: '任务日历' })).toBeVisible()
  await page.getByRole('button', { name: '列表视图', exact: true }).click()
  await expect(page).toHaveURL(/\/tasks$/)

  await page.goBack()
  await expect(page).toHaveURL(/\/tasks\?taskView=calendar$/)
  await expect(page.getByRole('heading', { name: '任务日历' })).toBeVisible()
  await page.goForward()
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.getByRole('heading', { name: '任务管理' })).toBeVisible()
})

test('公开分享深链接由独立路由按需加载', async ({ page }) => {
  await page.goto('/share/missing-route-token')
  await expect(page).toHaveURL(/\/share\/missing-route-token$/)
  await expect(page.getByText('无法打开该报告', { exact: true })).toBeVisible()
  await expect(page.locator('.sidebar')).toHaveCount(0)

  await page.goto('/settlement-share/missing-route-token')
  await expect(page).toHaveURL(/\/settlement-share\/missing-route-token$/)
  await expect(page.getByText('无法打开该回单', { exact: true })).toBeVisible()
  await expect(page.locator('.sidebar')).toHaveCount(0)
})

test('工作台任务和工作助手可以正常打开', async ({ page }) => {
  await expect(page.getByText('公司产品封套修改', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: '打开工作助手' }).click()
  await expect(page.getByRole('dialog', { name: '爱丽丝' })).toBeVisible()
  await expect(page.getByPlaceholder('向爱丽丝提问…')).toBeEditable()
  await expect(page.getByText('今天完成了哪些工作？', { exact: true })).toBeVisible()
})

test('工作助手的明确创建指令直接进入业务流程且不虚构字段', async ({ page }) => {
  await page.getByRole('button', { name: '打开工作助手' }).click()
  const dialog = page.getByRole('dialog', { name: '爱丽丝' })
  const input = dialog.getByPlaceholder('向爱丽丝提问…')
  await input.fill('你帮我新建一个任务')
  await input.press('Enter')
  await expect(dialog.getByText(/请补充任务名称、具体需求/).first()).toBeVisible({ timeout: 30_000 })
  const reasoning = dialog.getByText(/已思考 \d+ 步/)
  await expect(reasoning).toBeVisible()
  await reasoning.click()
  await expect(dialog.getByText('已识别用户目标与对象', { exact: true })).toBeVisible()
  await expect(dialog.getByText('只使用当前请求需要的专家与工具', { exact: true })).toBeVisible()
  await expect(dialog.getByLabel('创建任务确认卡片')).toHaveCount(0)
  await expect(dialog.getByText(/快捷键：|产品手册|更新日志|执行编排路径|结构化事实协议|主模型调用/)).toHaveCount(0)
})

test('工作助手思考链展示真实步骤且不暴露框架与工具名', async ({ page }) => {
  await page.getByRole('button', { name: '打开工作助手' }).click()
  const dialog = page.getByRole('dialog', { name: '爱丽丝' })
  const input = dialog.getByPlaceholder('向爱丽丝提问…')
  await input.fill('你帮我新建一个任务')
  await input.press('Enter')
  await expect(dialog.getByText(/请补充任务名称、具体需求/).first()).toBeVisible({ timeout: 30_000 })

  // 流式步骤要真的落进思考链，而不是只有一句静止的占位符。
  const reasoning = dialog.getByText(/已思考 \d+ 步/)
  await expect(reasoning).toBeVisible()
  await reasoning.click()
  await expect(dialog.getByText('正在判断这个问题问的是哪个对象、哪个维度', { exact: true })).toBeVisible()
  await expect(dialog.getByText('正在读取任务详情', { exact: true })).toBeVisible()

  // 底层框架名、主链名称与原始 operationId 一律不得出现在界面上。
  await expect(dialog.getByText(/Google ADK|语义编排|证据审核主链/)).toHaveCount(0)
  await expect(dialog.getByText(/search_attachments|get_task_detail|query_month_finance|transfer_to_agent/)).toHaveCount(0)
})

test('思考链摘要不会把同一句话重复显示两遍', async ({ page }) => {
  await page.getByRole('button', { name: '打开工作助手' }).click()
  const dialog = page.getByRole('dialog', { name: '爱丽丝' })
  const input = dialog.getByPlaceholder('向爱丽丝提问…')
  await input.fill('你帮我新建一个任务')
  await input.press('Enter')
  await expect(dialog.getByText(/请补充任务名称、具体需求/).first()).toBeVisible({ timeout: 30_000 })
  await dialog.getByText(/已思考 \d+ 步/).click()
  // 展开后同一条步骤只能出现一次：摘要预览只在收起状态下补位。
  await expect(dialog.getByText('正在读取任务详情', { exact: true })).toHaveCount(1)
})

test('工作助手展开后提供独立会话侧栏', async ({ page }) => {
  await page.getByRole('button', { name: '打开工作助手' }).click()
  const dialog = page.getByRole('dialog', { name: '爱丽丝' })
  await dialog.getByRole('button', { name: '展开' }).click()
  await dialog.getByRole('button', { name: '显示侧栏' }).click()
  const sidebar = page.locator('aside.chat-sidebar')
  await expect(sidebar.getByRole('button', { name: '新对话' })).toBeVisible()
  await expect(sidebar.getByRole('textbox', { name: '搜索对话' })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: '设置' })).toBeVisible()
  await sidebar.getByTitle('收起侧栏').click()
  await expect(sidebar).toBeHidden()
})

test('企业记忆 API 保留范围、来源、有效期和纠正能力', async ({ page }) => {
  const authHeaders = { 'x-auth-email': 'bh141425@gmail.com', 'x-auth-key': 'eval-admin-key' }
  const createdResponse = await page.request.post('/api/ai/enterprise-memories', { headers: authHeaders, data: { scopeType: 'partner', scopeKey: '浏览器评测合作伙伴', memoryType: 'preference', title: '验收文件偏好', content: '验收时优先提供 PDF。', sourceType: 'manual', sourceLabel: '浏览器评测人工确认', confidence: 'confirmed' } })
  const created = await createdResponse.json() as { memory: { id: string }; error?: string }
  expect(createdResponse.ok(), created.error || '企业记忆创建失败').toBeTruthy()

  const listedResponse = await page.request.get('/api/ai/enterprise-memories?query=' + encodeURIComponent('浏览器评测合作伙伴'), { headers: authHeaders })
  expect(listedResponse.ok()).toBeTruthy()
  const listed = JSON.stringify(await listedResponse.json())
  expect(listed).toContain('浏览器评测合作伙伴')
  expect(listed).toContain('验收文件偏好')
  expect(listed).toContain('浏览器评测人工确认')

  const correctedResponse = await page.request.patch(`/api/ai/enterprise-memories/${created.memory.id}`, {
    headers: authHeaders,
    data: { action: 'correct', content: '验收时优先提供 PDF 和可编辑源文件。', reason: '浏览器评测纠正' },
  })
  expect(correctedResponse.ok()).toBeTruthy()
  expect(JSON.stringify(await correctedResponse.json())).toContain('验收时优先提供 PDF 和可编辑源文件。')

  await page.request.patch(`/api/ai/enterprise-memories/${created.memory.id}`, { headers: authHeaders, data: { action: 'delete', reason: '浏览器评测清理' } })
})

test('文件库按需加载并可打开验收文件详情', async ({ page }) => {
  await page.getByRole('button', { name: '切换到文件库' }).click()
  await expect(page).toHaveURL(/\/files$/)
  await expect(page.getByText('按项目归档 · 点进项目查看验收交付件，AI 已自动解析', { exact: true })).toBeVisible()

  await page.getByText('直播设计', { exact: true }).click()
  const fileCard = page.locator('[data-file-id="101"]')
  await expect(fileCard.getByText('当天邀请V1.0B01.jpg', { exact: true })).toBeVisible()
  await fileCard.click()
  await expect(page.getByRole('complementary', { name: '当天邀请V1.0B01.jpg 文件详情' })).toBeVisible()
})

test('收入页按需加载且年度与月度金额保持对账', async ({ page }) => {
  await page.getByRole('button', { name: '切换到收入' }).click()
  await expect(page).toHaveURL(/\/income$/)

  const stats = page.getByRole('region', { name: '年度收入统计' })
  await expect(stats).toBeVisible()
  const annualGrossText = await stats.locator('.stat-card').filter({ hasText: '年度税前收入' }).locator('strong').innerText()
  const monthlyRows = await page.locator('.income-table-panel').filter({ hasText: '月度收入明细' }).locator('tbody tr').evaluateAll((rows) =>
    rows.map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() ?? '')),
  )

  const amount = (value: string) => Number(value.replace(/[¥,]/g, '')) || 0
  const monthlyGrossTotal = monthlyRows.reduce((sum, row) => sum + amount(row[2]), 0)
  expect(monthlyGrossTotal).toBeCloseTo(amount(annualGrossText), 2)
  monthlyRows.forEach((row) => {
    expect(amount(row[2]) - amount(row[5])).toBeCloseTo(amount(row[6]), 2)
  })
})

test('设置页仅在进入时加载独立分包', async ({ page }) => {
  const settingsLoadedOnDashboard = await page.evaluate(() => (
    performance.getEntriesByType('resource').some((entry) => entry.name.includes('SettingsView-'))
  ))
  expect(settingsLoadedOnDashboard).toBe(false)

  const settingsChunk = page.waitForRequest((request) => request.url().includes('SettingsView-'))
  await page.goto('/settings')
  await settingsChunk
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByRole('heading', { name: '默认模型' })).toBeVisible()
})

test('任务日历仅在切换到日历视图时加载', async ({ page }) => {
  const calendarLoadedOnDashboard = await page.evaluate(() => (
    performance.getEntriesByType('resource').some((entry) => entry.name.includes('CalendarView-'))
  ))
  expect(calendarLoadedOnDashboard).toBe(false)

  const calendarChunk = page.waitForRequest((request) => request.url().includes('CalendarView-'))
  await page.goto('/tasks?taskView=calendar')
  await calendarChunk
  await expect(page.getByRole('heading', { name: '任务日历' })).toBeVisible()
  await expect(page.locator('.google-calendar-panel')).toBeVisible()
  const calendarTaskSegments = page.getByRole('button', { name: '公司产品封套修改', exact: true })
  await expect(calendarTaskSegments.first()).toBeVisible()
})

test('结算页仅在进入时加载独立分包', async ({ page }) => {
  const reportsLoadedOnDashboard = await page.evaluate(() => (
    performance.getEntriesByType('resource').some((entry) => entry.name.includes('ReportsView-'))
  ))
  expect(reportsLoadedOnDashboard).toBe(false)

  const reportsChunk = page.waitForRequest((request) => request.url().includes('ReportsView-'))
  await page.getByRole('button', { name: '切换到结算', exact: true }).click()
  await reportsChunk
  await expect(page).toHaveURL(/\/reports$/)
  await expect(page.getByRole('region', { name: '月度结算回单' })).toBeVisible()
})

test('洞察页仅在进入时加载独立分包', async ({ page }) => {
  const insightsLoadedOnDashboard = await page.evaluate(() => (
    performance.getEntriesByType('resource').some((entry) => entry.name.includes('InsightsView-'))
  ))
  expect(insightsLoadedOnDashboard).toBe(false)

  const insightsChunk = page.waitForRequest((request) => request.url().includes('InsightsView-'))
  await page.getByRole('button', { name: '洞察' }).click()
  await insightsChunk
  await expect(page).toHaveURL(/\/insights$/)
  await expect(page.locator('.insights-view')).toBeVisible()
})

test('爱丽丝可以生成日期范围 Excel 结算回单', async ({ page }) => {
  await page.getByRole('button', { name: '打开工作助手' }).click()
  const input = page.getByPlaceholder('向爱丽丝提问…')
  await input.fill('请帮我导出 6 月 1 号到 6 月 10 号的结算回单')
  await input.press('Enter')
  await expect(page.getByText('已核验结算回单').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/日期范围：2026-06-01 至 2026-06-10/).first()).toBeVisible()
  await expect(page.getByRole('link', { name: '下载' })).toBeVisible()
  const receiptPreviewButton = page.getByRole('button', { name: /预览 结算回单_/ })
  expect(await receiptPreviewButton.count()).toBe(1)
  await receiptPreviewButton.click()
  const receiptPreviewDialog = page.getByRole('dialog', { name: '2026/06/01 至 2026/06/10' })
  await expect(receiptPreviewDialog).toBeVisible()
  await expect(receiptPreviewDialog.getByRole('region', { name: '月度结算回单' })).toBeVisible()
  await expect(receiptPreviewDialog.getByRole('button', { name: '关闭' })).toBeVisible()
  await expect(receiptPreviewDialog.getByRole('button', { name: '缩小' })).toBeVisible()
  await expect(receiptPreviewDialog.getByRole('button', { name: '按 1 比 1 显示' })).toBeVisible()
  await expect(receiptPreviewDialog.getByRole('button', { name: '放大' })).toBeVisible()
  await expect(receiptPreviewDialog.getByRole('button', { name: '适合窗口' })).toBeVisible()
  expect(await receiptPreviewDialog.locator('.agent-receipt-preview-viewport').evaluate((element) => getComputedStyle(element).overflow)).toBe('auto')
  await receiptPreviewDialog.getByRole('button', { name: '按 1 比 1 显示' }).click()
  await expect.poll(async () => receiptPreviewDialog.locator('.agent-receipt-preview-viewport').evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
  await receiptPreviewDialog.getByRole('button', { name: '关闭' }).click()
  await expect(receiptPreviewDialog).toBeHidden()
  const previewLink = page.getByRole('link', { name: '在线预览' })
  await expect(previewLink).toBeVisible()
  const previewHref = await previewLink.getAttribute('href')
  const token = previewHref?.split('/').filter(Boolean).at(-1)
  expect(token).toBeTruthy()
  const sharedResponse = await page.request.get(`/api/shared-settlement/${token}`)
  expect(sharedResponse.ok()).toBeTruthy()
  const sharedPayload = await sharedResponse.json() as {
    exportRecord: { id: string }
    receipt: { rows: Array<{ actualCompletionDate: string }> }
  }
  const completionDates = sharedPayload.receipt.rows.map((row) => row.actualCompletionDate)
  expect(completionDates).toContain('2026/06/03')
  expect(completionDates.every((value) => value === '2026/06/10')).toBe(false)
  const sharedExcelResponse = await page.request.get(`/api/shared-settlement/${token}/excel`)
  expect(sharedExcelResponse.ok()).toBeTruthy()
  const ExcelJsModule = await import('exceljs')
  const ExcelJS = ExcelJsModule.default ?? ExcelJsModule
  const sharedWorkbook = new ExcelJS.Workbook()
  await sharedWorkbook.xlsx.load(await sharedExcelResponse.body())
  const sharedSheet = sharedWorkbook.getWorksheet('结算回单')
  expect(sharedSheet).toBeTruthy()
  const sharedCompletionDates = sharedPayload.receipt.rows.map((_, index) => {
    const value = sharedSheet!.getCell(12 + index, 6).value
    return value instanceof Date
      ? `${value.getFullYear()}/${String(value.getMonth() + 1).padStart(2, '0')}/${String(value.getDate()).padStart(2, '0')}`
      : String(value ?? '')
  })
  expect(sharedCompletionDates).toContain('2026/06/03')
  await page.request.delete(`/api/settlement-exports/${sharedPayload.exportRecord.id}`, {
    headers: { 'x-auth-email': 'bh141425@gmail.com', 'x-auth-key': 'eval-admin-key' },
  })
})

test('结算预览与下载 Excel 使用同一份正式回单模板', async ({ page }) => {
  await page.getByRole('button', { name: '切换到结算', exact: true }).click()
  const receipt = page.getByRole('region', { name: '月度结算回单' })
  const receiptBrand = receipt.locator('.settlement-receipt-brand')
  await expect(receiptBrand.getByText('Giverny', { exact: true })).toBeVisible()
  await expect(receiptBrand.getByText('让创作在自己的花园里生长', { exact: true })).toBeVisible()
  await expect(receipt.locator('thead th')).toHaveText([
    '序号', '设计类型', '任务', '任务需求', '预计开始日期', '实际完成日期',
    '需求人', '对接人', '状态', '预估工时', '实际工时', '单价', '小计', '验收备注',
  ])

  const initialRowCount = await receipt.locator('tbody tr').count()
  const rangeInputs = page.locator('.report-range-export input')
  expect(await rangeInputs.count()).toBe(2)
  const selectedEndDate = await rangeInputs.nth(1).inputValue()
  await page.getByRole('button', { name: '选择自定义导出' }).click()
  const startDatePicker = page.getByRole('dialog', { name: '自定义导出选择器' })
  await startDatePicker.getByRole('button', { name: '上个月' }).click()
  await startDatePicker.getByRole('button', { name: '2026-06-01' }).click()
  await expect(startDatePicker).toBeHidden()
  await expect(receipt.getByText(`2026/06/01 至 ${selectedEndDate.replaceAll('-', '/')}`, { exact: true })).toBeVisible()
  await expect(receipt.getByText('结算日期', { exact: true })).toBeVisible()
  expect(await receipt.locator('tbody tr').count()).toBeGreaterThan(initialRowCount)
  const completionDates = await receipt.locator('tbody tr td:nth-child(6)').allTextContents()
  expect(completionDates).toContain('2026/06/03')
  expect(completionDates).toContain('2026/07/03')
  expect(completionDates.every((value) => value.trim() === selectedEndDate.replaceAll('-', '/'))).toBe(false)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出范围 Excel' }).click()
  const download = await downloadPromise
  const downloadPath = await download.path()
  expect(downloadPath).toBeTruthy()

  const ExcelJsModule = await import('exceljs')
  const ExcelJS = ExcelJsModule.default ?? ExcelJsModule
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(downloadPath!)
  const sheet = workbook.getWorksheet('结算回单')
  expect(sheet).toBeTruthy()
  expect(sheet!.getCell('A1').value).toBe('Giverny')
  expect(sheet!.getCell('A2').value).toBe('让创作在自己的花园里生长')
  expect(sheet!.getRow(11).values).toEqual([
    undefined,
    '序号', '设计类型', '任务', '任务需求', '预计开始日期', '实际完成日期',
    '需求人', '对接人', '状态', '预估工时', '实际工时', '单价', '小计', '验收备注',
  ])
  expect(sheet!.getColumn(4).width).toBe(96)
  expect(sheet!.getColumn(14).width).toBe(96)
  expect(sheet!.getCell('L12').formula).toBe('$K$9')
  expect(sheet!.getCell('M12').formula).toBe('K12*L12')
  const exportedCompletionDates = Array.from({ length: completionDates.length }, (_, index) => {
    const value = sheet!.getCell(12 + index, 6).value
    return value instanceof Date
      ? `${value.getFullYear()}/${String(value.getMonth() + 1).padStart(2, '0')}/${String(value.getDate()).padStart(2, '0')}`
      : String(value ?? '')
  })
  expect(exportedCompletionDates).toContain('2026/07/03')
})

test('日期范围回单支持线上分享、下载和锁定删除校验', async ({ page }) => {
  await login(page)
  const created = await page.request.post('/api/settlement-exports', {
    headers: { 'x-auth-email': 'bh141425@gmail.com', 'x-auth-key': 'eval-admin-key' },
    data: {
      startDate: '2026-06-01',
      endDate: '2026-06-10',
      receipt: {
        fileLabel: '20260601-20260610',
        title: '平面设计兼职服务结算回单',
        receiptNo: 'AK-2026060120260610-001',
        issuedAt: '2026-07-22 10:00',
        companyName: '测试公司',
        serviceName: '平面设计兼职',
        settlementLabelTitle: '结算日期',
        settlementLabel: '2026/06/01 至 2026/06/10',
        hourlyRate: 85,
        rows: [],
        totalHours: 0,
        totalAmount: 0,
      },
    },
  })
  const createdBody = await created.json() as { record?: { id: string; publicToken: string }; error?: string }
  expect(created.ok(), createdBody.error || '创建范围回单失败').toBeTruthy()
  const record = createdBody.record!

  const shared = await page.request.get(`/api/shared-settlement/${record.publicToken}`)
  expect(shared.ok()).toBeTruthy()
  const sharedState = await shared.json() as { receipt: { settlementLabelTitle: string; settlementLabel: string } }
  expect(sharedState.receipt.settlementLabelTitle).toBe('结算日期')
  expect(sharedState.receipt.settlementLabel).toBe('2026/06/01 至 2026/06/10')

  const excel = await page.request.get(`/api/shared-settlement/${record.publicToken}/excel`)
  expect(excel.ok()).toBeTruthy()
  expect(excel.headers()['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

  const authHeaders = { 'x-auth-email': 'bh141425@gmail.com', 'x-auth-key': 'eval-admin-key' }
  const disabled = await page.request.patch(`/api/settlement-exports/${record.id}/access`, {
    headers: authHeaders,
    data: { expiresAt: null, disabled: true },
  })
  expect(disabled.ok()).toBeTruthy()
  expect((await page.request.get(`/api/shared-settlement/${record.publicToken}`)).status()).toBe(403)
  const enabled = await page.request.patch(`/api/settlement-exports/${record.id}/access`, {
    headers: authHeaders,
    data: { expiresAt: '2026-12-31T23:59:59.000Z', disabled: false },
  })
  expect(enabled.ok()).toBeTruthy()
  expect((await page.request.get(`/api/shared-settlement/${record.publicToken}`)).ok()).toBeTruthy()
  expect((await page.request.patch(`/api/settlement-exports/${record.id}/lock`, { headers: authHeaders, data: { locked: true } })).ok()).toBeTruthy()
  const deniedDelete = await page.request.delete(`/api/settlement-exports/${record.id}`, { headers: authHeaders, data: { password: 'wrong-password' } })
  expect(deniedDelete.status()).toBe(401)
  const acceptedDelete = await page.request.delete(`/api/settlement-exports/${record.id}`, { headers: authHeaders, data: { password: 'eval-admin-key' } })
  expect(acceptedDelete.ok()).toBeTruthy()
})

test('合作伙伴回单按项目归档交付文件并支持排序与时间线', async ({ page }, testInfo) => {
  const authHeaders = { 'x-auth-email': 'bh141425@gmail.com', 'x-auth-key': 'eval-admin-key' }
  const created = await page.request.post('/api/settlement-exports', {
    headers: authHeaders,
    data: { startDate: '2026-06-01', endDate: '2026-06-30' },
  })
  const createdBody = await created.json() as { record?: { id: string; publicToken: string }; error?: string }
  expect(created.ok(), createdBody.error || '创建项目归档回单失败').toBeTruthy()
  const record = createdBody.record!

  await page.goto(`/settlement-share/${record.publicToken}`)
  await expect(page.getByRole('heading', { name: '项目与交付' })).toBeVisible()
  if (testInfo.project.name === 'desktop-chromium') {
    const columnCount = await page.locator('.shared-project-list').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)
    expect(columnCount).toBe(4)
  }
  const inviteProject = page.locator('.shared-project-row[data-task-id="13"]')
  await expect(inviteProject.getByRole('heading', { name: '直播设计' })).toBeVisible()
  await expect(inviteProject.getByRole('button', { name: '预览 当天邀请V1.0B01.jpg' })).toBeVisible()
  await expect(inviteProject.getByRole('button', { name: '预览 直播封面V1.0B01.jpg' })).toBeVisible()

  const rows = page.locator('.shared-project-row')
  await expect(rows.first()).toHaveAttribute('data-start-date', /^2026-/)
  const firstAscendingDate = await rows.first().getAttribute('data-start-date')
  await page.getByRole('button', { name: '较新在前' }).click()
  await expect.poll(() => rows.first().getAttribute('data-start-date')).not.toBe(firstAscendingDate)
  const firstDescendingDate = await rows.first().getAttribute('data-start-date')
  expect(firstDescendingDate!.localeCompare(firstAscendingDate!)).toBeGreaterThan(0)

  const countdownProject = page.locator('.shared-project-row[data-task-id="11"]')
  await countdownProject.getByRole('button', { name: /时间线/ }).click()
  const timelineDialog = countdownProject.getByRole('dialog', { name: /时间线/ })
  await expect(timelineDialog).toBeVisible()
  await expect(countdownProject.getByText('完成 6 月 8 日至 6 月 30 日倒计时海报')).toBeVisible()
  await expect(countdownProject.getByText('倒计时1天海报.jpg', { exact: true })).toBeVisible()
  const timelineSummary = await timelineDialog.locator('.shared-project-timeline').evaluate((element) => {
    const items = Array.from(element.querySelectorAll('.shared-project-timeline-item'))
    return {
      kinds: items.map((item) => item.getAttribute('data-timeline-kind')),
      dates: items.map((item) => item.querySelector('time')?.textContent || ''),
      text: items.map((item) => item.textContent || '').join('\n'),
    }
  })
  expect(timelineSummary.kinds[0]).toBe('acceptance')
  expect(timelineSummary.kinds.at(-1)).toBe('created')
  expect(timelineSummary.dates.every((value) => /^\d{4}\/\d{2}\/\d{2}$/.test(value))).toBe(true)
  expect(timelineSummary.text).not.toContain('项目名称：')
  expect(timelineSummary.text).not.toContain('任务名称：')
  expect(await countdownProject.locator('.shared-project-timeline').evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto')
  await expect(countdownProject.getByRole('button', { name: '关闭时间线' })).toBeVisible()

  await page.request.delete(`/api/settlement-exports/${record.id}`, { headers: authHeaders })
})

test('自定义范围分享链接保持未锁定', async ({ page }) => {
  const authHeaders = { 'x-auth-email': 'bh141425@gmail.com', 'x-auth-key': 'eval-admin-key' }
  const readRecords = async () => {
    const response = await page.request.get('/api/settlement-exports', { headers: authHeaders })
    expect(response.ok()).toBeTruthy()
    return (await response.json() as { records: Array<{ id: string; startDate: string; endDate: string; locked: boolean }> }).records
  }

  await page.getByRole('button', { name: '切换到结算', exact: true }).click()
  const beforeIds = new Set((await readRecords()).map((record) => record.id))

  await page.getByRole('button', { name: '分享范围链接' }).click()
  await expect(page.getByText(/已生成.*分享链接/).first()).toBeVisible()
  await expect.poll(async () => (await readRecords()).filter((record) => !beforeIds.has(record.id)).length).toBe(1)
  const afterRangeShare = await readRecords()
  const rangeRecord = afterRangeShare.find((record) => !beforeIds.has(record.id))
  expect(rangeRecord).toBeTruthy()
  expect(rangeRecord!.locked).toBe(false)

  await page.request.delete(`/api/settlement-exports/${rangeRecord!.id}`, { headers: authHeaders })
})

test('工作助手历史记录合并本地与云端时保留原始消息', async ({ page }) => {
  await page.route('**/api/ai/conversations', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [{
            id: 'cloud-profile-chen',
            title: '给我一下陈义君的用户画像',
            lastMessagePreview: '云端摘要',
            messageCount: 2,
            createdAt: '2026-07-21 11:52:00',
            updatedAt: '2026-07-21 11:52:00',
            projectId: 'project-profile',
            projectName: '用户画像',
          }],
        }),
      })
      return
    }
    await route.continue()
  })
  await page.route('**/api/ai/conversations/cloud-profile-chen', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not found' }) })
  })
  await page.evaluate(() => {
    const savedAt = new Date(2026, 6, 18, 14, 57).getTime()
    window.localStorage.setItem('alice_chat_projects', JSON.stringify([{ id: 'project-profile', name: '用户画像', savedAt }]))
    window.localStorage.setItem('alice_chat_history', JSON.stringify([{
      id: 'local-profile-chen',
      agentConversationId: 'cloud-profile-chen',
      title: '给我一下陈义君的用户画像',
      savedAt,
      projectId: 'project-profile',
      projectName: '用户画像',
      messages: [
        { id: 'u1', role: 'user', content: '给我一下陈义君的用户画像' },
        { id: 'a1', role: 'assistant', content: '陈义君画像：历史任务 7 个。' },
      ],
    }]))
  })
  await page.reload()
  await page.getByRole('button', { name: '打开工作助手' }).click()
  const dialog = page.getByRole('dialog', { name: '爱丽丝' })
  await dialog.getByRole('button', { name: '展开' }).click()
  await dialog.getByRole('button', { name: '显示侧栏' }).click()
  const historyItem = page.locator('.chat-sidebar-item', { hasText: '给我一下陈义君的用户画像' })
  await expect(historyItem).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('alice_chat_history') || '[]')[0]?.savedAt)).toBe(new Date(2026, 6, 18, 14, 57).getTime())
  await historyItem.click()
  await expect(page.getByText('陈义君画像：历史任务 7 个。', { exact: true })).toBeVisible()
})

test('工作助手临时请求不会写入云端会话索引', async ({ page }) => {
  const authHeaders = { 'x-auth-email': 'bh141425@gmail.com', 'x-auth-key': 'eval-admin-key' }
  const beforeResponse = await page.request.get('/api/ai/conversations', { headers: authHeaders })
  expect(beforeResponse.ok()).toBeTruthy()
  const before = await beforeResponse.json() as { conversations: Array<{ id: string }> }
  const temporaryId = `browser-temporary-${Date.now()}`
  const chatResponse = await page.request.post('/api/ai/chat', {
    headers: authHeaders,
    data: {
      modelChoice: 'deepseek-v4-flash',
      month: '2026-07',
      temporary: true,
      agentRuntimeConversationId: temporaryId,
      messages: [{ role: 'user', content: '这只是临时问题' }],
    },
  })
  expect(chatResponse.ok(), JSON.stringify(await chatResponse.json())).toBeTruthy()
  const after = await (await page.request.get('/api/ai/conversations', { headers: authHeaders })).json() as { conversations: Array<{ id: string }> }
  expect(after.conversations.some((item) => item.id === temporaryId)).toBe(false)
  expect(after.conversations.length).toBe(before.conversations.length)
})

test('工作助手主面板可以直接新建对话', async ({ page }) => {
  await page.route('**/api/ai/chat', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: '第一个对话的回答', trace: ['回答已核对'] }) })
  })
  await page.getByRole('button', { name: '打开工作助手' }).click()
  const dialog = page.getByRole('dialog', { name: '爱丽丝' })
  await dialog.getByPlaceholder('向爱丽丝提问…').fill('第一个对话问题')
  await dialog.getByRole('button', { name: '发送' }).click()
  await expect(dialog.getByText('第一个对话的回答', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: '展开' }).click()
  await dialog.getByRole('button', { name: '显示侧栏' }).click()
  const sidebar = page.locator('aside.chat-sidebar')
  await sidebar.getByRole('button', { name: '新对话' }).click()
  await expect(dialog.getByRole('heading', { name: '嗨，来和爱丽丝聊一聊' })).toBeVisible()
  await expect(sidebar.getByText('第一个对话问题', { exact: true })).toBeVisible()
})

test('工作助手批量事务使用单张原子确认卡', async ({ page }) => {
  const createdAt = Date.now()
  await page.route('**/api/ai/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: '已整理为一个批量事务，请逐项核对。',
        trace: ['核对批量任务操作', '批量事务草稿已生成'],
        approval: {
          id: `batch_task_operations:${createdAt}`,
          action: 'batch_task_operations',
          label: '批量任务操作',
          status: 'pending',
          createdAt,
          expiresAt: createdAt + 600_000,
          warnings: ['这些操作将在同一个 D1 事务中提交；任一步失败时全部回滚。'],
          draft: {
            batchId: 'browser-batch', operationCount: 2, taskCount: 2, atomic: true,
            operations: [
              { id: 'one', action: 'update_task_fields', taskId: 1, taskTitle: '公司产品封套修改', fields: { contact: '批量对接人' } },
              { id: 'two', action: 'append_waiting', taskId: 2, taskTitle: '公司产品封套延展', entry: { note: '等待补充资料' } },
            ],
            preconditions: [{ taskId: 1, fingerprint: 'hidden' }, { taskId: 2, fingerprint: 'hidden' }],
          },
        },
      }),
    })
  })
  await page.getByRole('button', { name: '打开工作助手' }).click()
  const dialog = page.getByRole('dialog', { name: '爱丽丝' })
  await dialog.getByPlaceholder('向爱丽丝提问…').fill('批量修改两个任务')
  await dialog.getByRole('button', { name: '发送' }).click()
  const card = dialog.getByLabel('批量任务操作确认卡片')
  await expect(card).toBeVisible()
  await expect(card.getByText('原子事务（失败全部回滚）', { exact: true })).toBeVisible()
  await expect(card.getByText(/1\. 公司产品封套修改 · 修改字段/)).toBeVisible()
  await expect(card.getByText(/2\. 公司产品封套延展 · 记录等待/)).toBeVisible()
  await expect(card.getByText('请逐项核对。确认后所有操作将一次提交；任一项失败都会全部回滚。', { exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: '编辑草稿' })).toHaveCount(0)
  await expect(card.getByRole('button', { name: '确认执行' })).toBeVisible()
})

test('进行中的等待记录展示实时已等待时长', async ({ page }) => {
  await page.getByText('公司产品封套修改', { exact: true }).first().click()
  const sidebar = page.locator('.dashboard-task-sidebar')
  await sidebar.getByRole('tab', { name: '等待记录' }).click()
  await expect(sidebar.getByText('等待刘总的建议', { exact: true })).toBeVisible()
  await expect(sidebar.getByText(/已等待 .+ · 不计结算/)).toBeVisible()
})

test('新建任务支持按分钟或小数小时填写预估工时并可关闭', async ({ page }) => {
  await page.getByRole('button', { name: /新建任务/ }).first().click()
  await expect(page.getByRole('heading', { name: '新建任务' })).toBeVisible()

  const hours = page.getByRole('textbox', { name: '预估工时，可输入15分钟、1小时30分钟或小数小时' })
  await hours.fill('1.2')
  await hours.blur()
  await expect(hours).toHaveValue('1 小时 12 分钟')

  await hours.fill('15分钟')
  await hours.blur()
  await expect(hours).toHaveValue('15 分钟')

  await hours.fill('1小时30分钟')
  await hours.blur()
  await expect(hours).toHaveValue('1 小时 30 分钟')

  await page.getByRole('button', { name: '取消' }).click()
  await expect(page.getByRole('heading', { name: '新建任务' })).toBeHidden()
})

test('新建任务默认把图片粘贴到甲方附件，文本粘贴到任务需求', async ({ page }) => {
  await page.getByRole('button', { name: /新建任务/ }).first().click()
  const dialog = page.getByRole('dialog', { name: '新建任务' })

  await page.evaluate(() => {
    const clipboard = new DataTransfer()
    clipboard.items.add(new File([
      Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='), (char) => char.charCodeAt(0)),
    ], '默认粘贴.png', { type: 'image/png' }))
    document.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: clipboard }))
  })
  await expect(dialog.locator('.brief-img-thumb')).toBeVisible()

  await page.evaluate(() => {
    const clipboard = new DataTransfer()
    clipboard.setData('text/plain', '默认文字应写入任务需求')
    document.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: clipboard }))
  })
  await expect(dialog.getByRole('textbox', { name: '任务具体需求' })).toHaveValue('默认文字应写入任务需求')
})

})

test.describe('任务流程分片', () => {

test('新建任务可直接点击采用 AI 的分类、任务名称和文案建议', async ({ page }) => {
  await page.route('**/api/ai/task-assistant', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        suggestedTitle: '文化墙内容设计',
        optimizedRequirement: '1、设计背景：用于展厅文化墙更新。\n2、设计要求：统一信息层级。\n3、输出文件：提供可编辑源文件。',
        suggestedParentType: '传播类',
        suggestedChildType: '文化墙',
        suggestedType: '传播类 / 文化墙',
        categoryExists: true,
        reason: '与现有分类匹配。',
      }),
    })
  })
  await page.getByRole('button', { name: /新建任务/ }).first().click()
  const dialog = page.getByRole('dialog', { name: '新建任务' })
  await dialog.getByRole('textbox', { name: '任务具体需求' }).fill('展厅上墙内容需要更新')
  await dialog.getByRole('button', { name: 'AI 优化任务需求' }).click()
  await dialog.getByRole('button', { name: '采用建议分类：传播类 / 文化墙' }).click()
  await expect(dialog.locator('.new-task-type-picked b')).toHaveText('传播类 / 文化墙')
  await dialog.getByRole('button', { name: '采用建议任务名称' }).click()
  await expect(dialog.getByRole('textbox', { name: '任务名称' })).toHaveValue('文化墙内容设计')
  await dialog.getByRole('button', { name: '采用建议文案' }).click()
  await expect(dialog.getByRole('textbox', { name: '任务具体需求' })).toHaveValue(/1、设计背景：用于展厅文化墙更新。/)
})

test('新建任务支持语音识别排期并确认后自动填写三项', async ({ page }) => {
  await page.addInitScript({
    content: `
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
      });
      window.SpeechRecognition = undefined;
      window.webkitSpeechRecognition = undefined;
      class FakeMediaRecorder {
        static isTypeSupported() { return true; }
        constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm;codecs=opus'; this.ondataavailable = null; this.onstop = null; }
        start() { this.state = 'recording'; }
        stop() {
          this.state = 'inactive';
          if (this.ondataavailable) this.ondataavailable({ data: new Blob(['voice-schedule'], { type: this.mimeType }) });
          if (this.onstop) this.onstop();
        }
      }
      window.MediaRecorder = FakeMediaRecorder;
    `,
  })
  await page.route('**/api/ai/voice-schedule', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        transcript: '预计开始时间是 2026 年 7 月 20 日下午 4 点 10 分，预估工时两小时',
        startAt: '2026-07-20T16:10',
        durationMinutes: 120,
        endAt: '2026-07-20T18:10',
        suppliedFields: ['start', 'hours'],
        derivedField: 'end',
        confidence: 'high',
        warnings: [],
        source: 'browser-eval',
      }),
    })
  })
  await page.reload()
  await page.getByRole('button', { name: /新建任务/ }).first().click()
  await page.getByRole('button', { name: '用语音填写时间与工时' }).click()
  await expect(page.getByText('正在听…', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '采集完成' }).click()
  await expect(page.getByText('识别结果', { exact: true })).toBeVisible()
  await expect(page.getByText('交付 2026/07/20 18:10 · 自动', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '应用到时间与工时' }).click()

  const modal = page.getByRole('dialog', { name: '新建任务' })
  const dateInputs = modal.getByPlaceholder('YYYY/MM/DD HH:mm')
  await expect(dateInputs).toHaveCount(2)
  await expect(dateInputs.nth(0)).toHaveValue('2026/07/20 16:10')
  await expect(modal.getByRole('textbox', { name: '预估工时，可输入15分钟、1小时30分钟或小数小时' })).toHaveValue('2 小时')
  await expect(dateInputs.nth(1)).toHaveValue('2026/07/20 18:10')
})

test('新建任务优先使用实时中文听写并仅提交转写文本', async ({ page }) => {
  await page.addInitScript({
    content: `
      class FakeSpeechRecognition {
        static isActive = null;
        constructor() { this.lang = ''; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1; this.onresult = null; this.onerror = null; this.onend = null; }
        start() {
          FakeSpeechRecognition.isActive = this;
          setTimeout(() => this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: '预计开始时间是明天下午四点，预估工时两小时' } }] }), 40);
        }
        stop() { this.onend?.(); }
        abort() {}
      }
      window.SpeechRecognition = FakeSpeechRecognition;
      window.webkitSpeechRecognition = undefined;
    `,
  })
  let requestBody: Record<string, unknown> | null = null
  await page.route('**/api/ai/voice-schedule', async (route) => {
    requestBody = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        transcript: '预计开始时间是明天下午四点，预估工时两小时',
        startAt: '2026-07-21T16:00',
        durationMinutes: 120,
        endAt: '2026-07-21T18:00',
        suppliedFields: ['start', 'hours'],
        derivedField: 'end',
        confidence: 'high',
        warnings: [],
        source: 'browser-live-transcript',
      }),
    })
  })
  await page.reload()
  await page.getByRole('button', { name: /新建任务/ }).first().click()
  await page.getByRole('button', { name: '用语音填写时间与工时' }).click()
  await expect(page.getByText('正在识别：预计开始时间是明天下午四点，预估工时两小时', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '采集完成' }).click()
  await expect(page.getByText('识别结果', { exact: true })).toBeVisible()
  expect(requestBody).toMatchObject({ transcript: '预计开始时间是明天下午四点，预估工时两小时' })
})

test('语音排期识别中可以立即关闭', async ({ page }) => {
  await page.addInitScript({
    content: `
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
      });
      window.SpeechRecognition = undefined;
      window.webkitSpeechRecognition = undefined;
      class FakeMediaRecorder {
        static isTypeSupported() { return true; }
        constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm;codecs=opus'; this.ondataavailable = null; this.onstop = null; }
        start() { this.state = 'recording'; }
        stop() {
          this.state = 'inactive';
          if (this.ondataavailable) this.ondataavailable({ data: new Blob(['voice-schedule'], { type: this.mimeType }) });
          if (this.onstop) this.onstop();
        }
      }
      window.MediaRecorder = FakeMediaRecorder;
    `,
  })
  await page.route('**/api/ai/voice-schedule', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    try {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          transcript: '预估工时两小时',
          durationMinutes: 120,
          suppliedFields: ['hours'],
          derivedField: null,
          confidence: 'medium',
          warnings: [],
          source: 'browser-eval',
        }),
      })
    } catch {
      // 用户关闭弹窗后请求会被主动取消。
    }
  })
  await page.reload()
  await page.getByRole('button', { name: /新建任务/ }).first().click()
  await page.getByRole('button', { name: '用语音填写时间与工时' }).click()
  await page.getByRole('button', { name: '采集完成' }).click()
  await expect(page.getByText('正在整理时间与工时…', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '关闭语音识别结果' }).click()
  await expect(page.getByText('正在整理时间与工时…', { exact: true })).toBeHidden()
})

test('新建任务预计开始日历超出弹窗时仍可选择日期', async ({ page }) => {
  await page.getByRole('button', { name: /新建任务/ }).first().click()
  const modal = page.getByRole('dialog', { name: '新建任务' })
  await expect(modal).toBeVisible()

  await page.getByRole('button', { name: '选择预计开始' }).click()
  const picker = page.getByRole('dialog', { name: '预计开始选择器' })
  await expect(picker).toBeVisible()
  await picker.getByRole('button', { name: '上个月' }).click()
  await picker.locator('.date-time-days button:not(.muted)').filter({ hasText: /^8$/ }).click()

  const startField = modal.getByPlaceholder('YYYY/MM/DD HH:mm').first()
  await expect(startField).toHaveValue(/^2026\/06\/08 /)
})

test('新建任务附件支持逐张连续拖入', async ({ page }) => {
  await page.getByRole('button', { name: /新建任务/ }).first().click()
  const dropzone = page.getByTestId('new-task-brief-dropzone')
  await expect(dropzone).toBeVisible()

  const dropImage = async (name: string) => {
    const dataTransfer = await page.evaluateHandle((fileName) => {
      const transfer = new DataTransfer()
      transfer.items.add(new File(['giverny-image'], fileName, { type: 'image/png' }))
      return transfer
    }, name)
    await dropzone.dispatchEvent('dragenter', { dataTransfer })
    await dropzone.dispatchEvent('dragover', { dataTransfer })
    await dropzone.dispatchEvent('drop', { dataTransfer })
  }

  await dropImage('第一张.png')
  await expect(dropzone.getByRole('img', { name: '第一张.png' })).toBeVisible()

  await dropImage('第二张.png')
  await expect(dropzone.getByRole('img', { name: '第二张.png' })).toBeVisible()
  await expect(dropzone.getByRole('img')).toHaveCount(2)
})

test('数字键可跳转到今年对应月份且输入时不会误触', async ({ page }) => {
  await page.keyboard.press('3')
  await expect(page.getByRole('heading', { name: '2026 年 3 月工作台' })).toBeVisible()

  await page.keyboard.press('0')
  await expect(page.getByRole('heading', { name: '2026 年 10 月工作台' })).toBeVisible()

  await page.keyboard.press('-')
  await expect(page.getByRole('heading', { name: '2026 年 11 月工作台' })).toBeVisible()

  await page.keyboard.press('=')
  await expect(page.getByRole('heading', { name: '2026 年 12 月工作台' })).toBeVisible()

  await page.getByRole('button', { name: /新建任务/ }).first().click()
  const hours = page.getByRole('textbox', { name: '预估工时，可输入15分钟、1小时30分钟或小数小时' })
  await hours.fill('1.')
  await hours.press('2')
  await expect(hours).toHaveValue('1.2')
  await page.getByRole('button', { name: '取消' }).click()
  await expect(page.getByRole('heading', { name: '2026 年 12 月工作台' })).toBeVisible()
})

test('补录任务显示真实验收动态日期而不是补录操作日期', async ({ page }) => {
  await page.keyboard.press('6')
  await expect(page.getByRole('heading', { name: '2026 年 6 月工作台' })).toBeVisible()

  await page.getByRole('button', { name: /已验收 .*展开/ }).click()
  const taskRow = page.locator('article.task-row').filter({ hasText: '年终冲刺动员令倒计时海报' })
  await expect(taskRow).toHaveCount(1)
  await expect(taskRow).toContainText('06/08')
  await expect(taskRow).toContainText('06/07')
  await expect(taskRow).not.toContainText('07/01')
  await expect(taskRow).not.toContainText('06/30')

  const normalAcceptedRow = page.locator('article.task-row').filter({ hasText: '官网历史验收日期回归' })
  await expect(normalAcceptedRow).toHaveCount(1)
  await expect(normalAcceptedRow).toContainText('06/03')
  await expect(normalAcceptedRow).not.toContainText('06/23')
})

test('计划中任务可直接进入记录进展并切换验收模式', async ({ page }) => {
  await page.locator('article.task-row').filter({ hasText: '公司产品封套延展' }).click()
  const progressButton = page.getByRole('button', { name: /记录进展/ }).last()
  await expect(progressButton).toBeEnabled()
  await progressButton.click()
  await expect(page.getByRole('heading', { name: '记录进展' })).toBeVisible()

  await page.getByRole('button', { name: /本次进展为验收进展/ }).click()
  await expect(page.getByRole('heading', { name: '记录验收进展' })).toBeVisible()

  await page.getByRole('button', { name: '切换本段工时' }).click()
  const segmentDuration = page.getByRole('textbox', { name: '本段工时，可输入15分钟、1小时30分钟或小数小时' })
  await segmentDuration.fill('15分钟')
  await segmentDuration.blur()
  await expect(segmentDuration).toHaveValue('15 分钟')

  await segmentDuration.fill('1小时')
  await segmentDuration.blur()
  await expect(segmentDuration).toHaveValue('1 小时')

  await segmentDuration.fill('30分钟')
  await segmentDuration.blur()
  await expect(segmentDuration).toHaveValue('30 分钟')

  await segmentDuration.fill('1.5小时')
  await segmentDuration.blur()
  await expect(segmentDuration).toHaveValue('1 小时 30 分钟')

  await segmentDuration.fill('0.25')
  await segmentDuration.blur()
  await expect(segmentDuration).toHaveValue('15 分钟')

  await page.getByRole('button', { name: '切换预计工时' }).click()
  const plannedDuration = page.getByRole('textbox', { name: '验收预计工时，可输入15分钟、1小时30分钟或小数小时' })
  await plannedDuration.fill('30分钟')
  await plannedDuration.blur()
  await expect(plannedDuration).toHaveValue('30 分钟')
  await page.getByRole('button', { name: '取消' }).click()
})

test('普通记录进展可展开完整基础信息', async ({ page }) => {
  await page.locator('article.task-row').filter({ hasText: '公司产品封套延展' }).click()
  await page.getByRole('button', { name: /记录进展/ }).last().click()
  const dialog = page.getByRole('dialog', { name: '记录进展' })
  await expect(dialog.getByRole('button', { name: /本次进展为验收进展/ })).not.toHaveClass(/active/)
  const baseToggle = dialog.getByRole('button', { name: /基础信息/ })
  await expect(baseToggle).toBeVisible()
  await baseToggle.click()
  const baseInfo = dialog.locator('.progress-acceptance-basic-grid')
  await expect(baseInfo).toBeVisible()
  await expect(baseInfo.getByText('任务名称', { exact: true })).toBeVisible()
  await expect(baseInfo.getByText('需求描述', { exact: true })).toBeVisible()
  await expect(baseInfo.getByText('预计开始', { exact: true })).toBeVisible()
  await expect(baseInfo.getByText('预计交付', { exact: true })).toBeVisible()
  await expect(baseInfo.getByText('预估工时', { exact: true })).toBeVisible()
  await expect(baseInfo.getByText('实际工时', { exact: true })).toBeVisible()
})

test('反馈来源支持自由输入且使用合作伙伴称呼', async ({ page }) => {
  await page.locator('article.task-row').filter({ hasText: '公司产品封套延展' }).click()
  await page.getByRole('tab', { name: '修改建议' }).click()
  await page.getByRole('button', { name: '记录反馈' }).click()
  const dialog = page.getByRole('dialog', { name: '记录反馈' })
  const sourceInput = dialog.getByLabel('反馈来源')
  await expect(sourceInput).toHaveValue('合作伙伴')
  await sourceInput.fill('李敏波')
  await expect(sourceInput).toHaveValue('李敏波')
  await expect(dialog.getByText('甲方', { exact: false })).toHaveCount(0)
  await dialog.getByLabel('反馈版本').fill('B01')
  await dialog.getByRole('textbox', { name: '修改意见' }).fill('调整信息排序和版式结构')
  await dialog.getByRole('button', { name: '记录反馈' }).click()

  const feedbackPane = page.getByRole('tabpanel')
  await expect(feedbackPane.getByText('李敏波反馈 · 计入改稿轮次', { exact: true }).first()).toBeVisible()
  await expect(feedbackPane.getByText('合作伙伴反馈', { exact: true })).toHaveCount(0)
  await expect(feedbackPane.locator('.dashboard-side-entry-meta', { hasText: '李敏波反馈' })).toHaveCount(0)
})

test('验收附件的 PDF 与图片可在统一阅读器中预览', async ({ page }) => {
  await page.locator('article.task-row').filter({ hasText: '公司产品封套延展' }).click()
  await page.getByRole('button', { name: /记录进展/ }).last().click()
  await page.getByRole('button', { name: /本次进展为验收进展/ }).click()
  const acceptanceDialog = page.getByRole('dialog', { name: '记录验收进展' })
  const uploadInput = acceptanceDialog.locator('input[type="file"][multiple]')
  await uploadInput.setInputFiles([
    { name: '验收预览.pdf', mimeType: 'application/pdf', buffer: createPdfFixture() },
    {
      name: '验收截图.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
    },
  ])

  await expect(acceptanceDialog.getByRole('button', { name: '预览 验收预览.pdf' }).locator('img')).toBeVisible({
    timeout: PDF_PREVIEW_TIMEOUT_MS + 2_000,
  })
  await page.getByRole('button', { name: '预览 验收预览.pdf' }).click()
  const pdfDialog = page.getByRole('dialog', { name: '验收预览.pdf' })
  const pdfCanvas = pdfDialog.locator('canvas[data-pdf-page="1"]')
  await expect(pdfCanvas).toBeVisible()
  await expect.poll(async () => pdfCanvas.evaluate((canvas) => canvas.width > 0 && canvas.height > 0)).toBe(true)
  await pdfDialog.getByRole('button', { name: '关闭' }).click()

  await page.getByRole('button', { name: '预览 验收截图.png' }).click()
  const imageDialog = page.getByRole('dialog', { name: '验收截图.png' })
  await expect(imageDialog.locator('.image-preview-reader img')).toBeVisible()
  await imageDialog.getByRole('button', { name: '关闭' }).click()
})

test('验收面板任意位置可直接粘贴图片到验收附件', async ({ page }) => {
  await page.locator('article.task-row').filter({ hasText: '公司产品封套延展' }).click()
  await page.getByRole('button', { name: /记录进展/ }).last().click()
  await page.getByRole('button', { name: /本次进展为验收进展/ }).click()
  const acceptanceDialog = page.getByRole('dialog', { name: '记录验收进展' })
  const note = acceptanceDialog.getByRole('textbox', { name: '验收备注' })
  await note.focus()

  await note.evaluate((target) => {
    const clipboard = new DataTransfer()
    clipboard.items.add(new File([
      Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='), (char) => char.charCodeAt(0)),
    ], '验收面板直接粘贴.png', { type: 'image/png' }))
    target.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: clipboard }))
  })

  await expect(acceptanceDialog.locator('.progress-attachment-desktop-item')).toHaveCount(1)
  await expect(acceptanceDialog.getByText(/粘贴截图_/).first()).toBeVisible()
  await expect(note).toHaveValue('')
})

test('多张高分辨率验收图后台压缩时备注输入保持响应', async ({ page }) => {
  await page.locator('article.task-row').filter({ hasText: '公司产品封套延展' }).click()
  await page.getByRole('button', { name: /记录进展/ }).last().click()
  await page.getByRole('button', { name: /本次进展为验收进展/ }).click()
  const acceptanceDialog = page.getByRole('dialog', { name: '记录验收进展' })
  const uploadInput = acceptanceDialog.locator('input[type="file"][multiple]')

  await uploadInput.evaluate(async (input) => {
    const canvas = document.createElement('canvas')
    canvas.width = 3200
    canvas.height = 1800
    const context = canvas.getContext('2d')!
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, '#0b4f8a')
    gradient.addColorStop(0.5, '#f8fbff')
    gradient.addColorStop(1, '#245fa8')
    context.fillStyle = gradient
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#ffffff'
    context.font = '120px sans-serif'
    context.fillText('Giverny acceptance board', 260, 900)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('fixture failed')), 'image/png'))
    const transfer = new DataTransfer()
    for (let index = 1; index <= 4; index += 1) {
      transfer.items.add(new File([blob], `研究院展板${index}.png`, { type: 'image/png' }))
    }
    Object.defineProperty(input, 'files', { configurable: true, value: transfer.files })
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })

  await expect(acceptanceDialog.locator('.progress-attachment-desktop-item')).toHaveCount(4)
  const note = acceptanceDialog.getByRole('textbox', { name: '验收备注' })
  const startedAt = Date.now()
  await note.fill('四张验收图已上传，继续填写备注。')
  expect(Date.now() - startedAt).toBeLessThan(2000)
  await expect(note).toHaveValue('四张验收图已上传，继续填写备注。')
  await expect.poll(async () => acceptanceDialog.locator('.progress-attachment-desktop-item img').evaluateAll((images) => (
    images.length === 4 && images.every((image) => image.naturalWidth > 0 && image.naturalWidth <= 480)
  )), { timeout: 20_000 }).toBe(true)
})

test('验收备注 AI 使用弹窗内当前完整工时快照', async ({ page }) => {
  type AcceptanceAiPayload = {
    task: {
      actualHours: number
      timeEntries: Array<{ start: string; end: string; isAcceptanceProgress?: boolean }>
    }
  }
  let resolvePayload: (payload: AcceptanceAiPayload) => void = () => {}
  const payloadPromise = new Promise<AcceptanceAiPayload>((resolve) => { resolvePayload = resolve })
  await page.route('**/api/ai/text-assistant', async (route) => {
    resolvePayload(route.request().postDataJSON() as AcceptanceAiPayload)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        optimizedText: '1、需求达成：已完成任务要求。\n2、完成与完善：已完成视觉统一。',
        summary: '已按当前验收草稿生成。',
      }),
    })
  })

  await page.getByText('公司产品封套修改', { exact: true }).first().click()
  await page.getByRole('button', { name: /记录进展/ }).last().click()
  await page.getByRole('button', { name: /本次进展为验收进展/ }).click()
  const dialog = page.getByRole('dialog', { name: '记录验收进展' })
  const actualSchedule = dialog.locator('.progress-lite-schedule-row:not(.progress-lite-schedule-row-plan)')
  const timeInputs = actualSchedule.getByPlaceholder('YYYY/MM/DD HH:mm')
  await timeInputs.first().fill('2026/07/20 09:00')
  await timeInputs.first().blur()
  await timeInputs.nth(1).fill('2026/07/20 11:00')
  await timeInputs.nth(1).blur()
  await dialog.locator('#progress-lite-note').fill('请按当前全部进展生成验收备注')
  await dialog.getByRole('button', { name: 'AI 汇总项目验收备注' }).click()

  const payload = await payloadPromise
  expect(payload.task.actualHours).toBe(4.52)
  expect(payload.task.timeEntries).toHaveLength(2)
  expect(payload.task.timeEntries.at(-1)).toMatchObject({ start: '09:00', end: '11:00', isAcceptanceProgress: true })
})

test('模型中心展示默认模型和服务商配置入口', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: '默认模型' })).toBeVisible()
  await expect(page.getByText('文字模型服务商', { exact: true })).toBeVisible()

  const deepseekCard = page.locator('button.model-provider-card').filter({ hasText: 'DeepSeek' }).first()
  await expect(deepseekCard).toBeVisible()
  await deepseekCard.click()
  if (!await page.getByRole('heading', { name: 'DeepSeek 设置' }).isVisible().catch(() => false)) {
    await deepseekCard.click()
  }
  await expect(page.getByRole('heading', { name: 'DeepSeek 设置' })).toBeVisible()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: '加载模型', exact: true })).toBeVisible()
  await expect(dialog.getByRole('switch')).toBeVisible()
  await dialog.getByRole('button', { name: '取消' }).click({ force: true })
})

test('每日知识卡片可打开正文并关闭弹窗', async ({ page }) => {
  await page.goto('/dashboard')
  const knowledgeCard = page.locator('button.daily-knowledge-main')
  await expect(knowledgeCard).toBeVisible()
  await knowledgeCard.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('.daily-knowledge-article p').first()).toBeVisible()
  await dialog.getByRole('button', { name: '关闭' }).click()
  await expect(dialog).toBeHidden()
})

test('AI 运行中心汇总路由、后台任务和工作区上下文', async ({ page }) => {
  await page.goto('/settings')
  const chatResult = await page.evaluate(async () => {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        modelChoice: 'deepseek-v4-flash',
        month: '2026-07',
        messages: [{ role: 'user', content: '显示金额和隐藏金额的快捷键是什么？' }],
      }),
    })
    return { status: response.status, payload: await response.json() }
  }) as { status: number; payload: { agentTurn?: { verification?: { passed?: boolean } } } }
  expect(chatResult.status, JSON.stringify(chatResult.payload)).toBe(200)
  expect(chatResult.payload.agentTurn?.verification?.passed, JSON.stringify(chatResult.payload)).toBe(true)
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/ai/operations-center?days=7')
    return {
      status: response.status,
      payload: await response.json(),
    }
  }) as {
    status: number
    payload: {
    workspace: { id: string; foundationReady: boolean }
    routing: { totalRuns: number; recent: Array<{ route: string }> }
    agentTurns: { total: number; recent: Array<{ id: string }> }
    background: { failedCount: number; jobs: Array<{ id: string }> }
    learning: { totalSamples: number }
    }
  }
  expect(result.status, JSON.stringify(result.payload)).toBe(200)
  const { payload } = result
  expect(payload.workspace).toMatchObject({ id: 'default', foundationReady: true })
  expect(payload.routing.totalRuns).toBeGreaterThan(0)
  expect(payload.routing.recent.length).toBeGreaterThan(0)
  expect(payload.agentTurns.total).toBeGreaterThan(0)
  expect(payload.agentTurns.recent.length).toBeGreaterThan(0)
  expect(payload.background.failedCount).toBeGreaterThan(0)
  expect(payload.background.jobs.some((job) => job.id === 'browser-job-failed')).toBeTruthy()
  expect(payload.learning.totalSamples).toBeGreaterThan(0)

  await page.locator('.ai-operations-panel').getByRole('button', { name: '刷新' }).click()
  await expect(page.getByRole('heading', { name: '运行与质量中心' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Agent 执行审计' })).toBeVisible()
  await expect(page.getByText('目标完成率', { exact: true })).toBeVisible()
  await expect(page.getByText('首轮完成率', { exact: true })).toBeVisible()
  await expect(page.getByText('补查恢复率', { exact: true })).toBeVisible()
  await expect(page.getByText('待补充后解决率', { exact: true })).toBeVisible()
  await expect(page.getByText('已完成', { exact: true }).first()).toBeVisible()
  const workspaceSelect = page.getByLabel('切换工作区')
  await expect(workspaceSelect).toHaveValue('default')
  await expect(workspaceSelect.locator('option[value="default"]')).toHaveText('Giverny 默认工作区')
  await expect(page.getByText('浏览器回归后台任务', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '重试' })).toBeVisible()
})

})
