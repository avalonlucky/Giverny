import { expect, test, type Page } from '@playwright/test'

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

test.beforeEach(async ({ page }) => {
  await login(page)
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: /2026 年 7 月工作台/ })).toBeVisible()
})

test('工作台任务和工作助手可以正常打开', async ({ page }) => {
  await expect(page.getByText('公司产品封套修改', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: '打开工作助手' }).click()
  await expect(page.getByRole('dialog', { name: '爱丽丝' })).toBeVisible()
  await expect(page.getByPlaceholder('向爱丽丝提问…')).toBeEditable()
  await expect(page.getByText('今天完成了哪些工作？', { exact: true })).toBeVisible()
})

test('爱丽丝可以生成日期范围 Excel 结算回单', async ({ page }) => {
  await page.getByRole('button', { name: '打开工作助手' }).click()
  const input = page.getByPlaceholder('向爱丽丝提问…')
  await input.fill('请帮我导出 6 月 1 号到 6 月 10 号的结算回单')
  await input.press('Enter')
  await expect(page.getByText(/已生成.*2026\/06\/01 至 2026\/06\/10.*结算回单/).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('link', { name: '下载 Excel' })).toBeVisible()
  await expect(page.getByRole('link', { name: '在线预览' })).toBeVisible()
})

test('结算预览与下载 Excel 使用同一份正式回单模板', async ({ page }) => {
  await page.getByRole('button', { name: '结算' }).click()
  const receipt = page.getByRole('region', { name: '月度结算回单' })
  await expect(receipt.getByText('Giverny', { exact: true })).toBeVisible()
  await expect(receipt.getByText('让创作在自己的花园里生长', { exact: true })).toBeVisible()
  await expect(receipt.locator('thead th')).toHaveText([
    '序号', '设计类型', '任务', '任务需求', '预计开始日期', '实际完成日期',
    '需求人', '对接人', '状态', '预估工时', '实际工时', '单价', '小计', '验收备注',
  ])

  const initialRowCount = await receipt.locator('tbody tr').count()
  const rangeInputs = page.locator('.report-range-export input')
  expect(await rangeInputs.count()).toBe(2)
  await page.getByRole('button', { name: '选择自定义导出' }).click()
  const startDatePicker = page.getByRole('dialog', { name: '自定义导出选择器' })
  await startDatePicker.getByRole('button', { name: '上个月' }).click()
  await startDatePicker.getByRole('button', { name: '2026-06-01' }).click()
  await expect(receipt.getByText('2026/06/01 至 2026/07/22', { exact: true })).toBeVisible()
  await expect(receipt.getByText('结算日期', { exact: true })).toBeVisible()
  expect(await receipt.locator('tbody tr').count()).toBeGreaterThan(initialRowCount)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载 Excel 回单' }).first().click()
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
  expect((await page.request.patch(`/api/settlement-exports/${record.id}/lock`, { headers: authHeaders, data: { locked: true } })).ok()).toBeTruthy()
  const deniedDelete = await page.request.delete(`/api/settlement-exports/${record.id}`, { headers: authHeaders, data: { password: 'wrong-password' } })
  expect(deniedDelete.status()).toBe(401)
  const acceptedDelete = await page.request.delete(`/api/settlement-exports/${record.id}`, { headers: authHeaders, data: { password: 'eval-admin-key' } })
  expect(acceptedDelete.ok()).toBeTruthy()
})

test('工作助手历史记录合并本地与云端时保留原始时间和消息', async ({ page }) => {
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
  await page.getByRole('button', { name: '记录与任务' }).click()
  await expect(page.getByText('给我一下陈义君的用户画像', { exact: true })).toBeVisible()
  await expect(page.locator('.chat-history-item', { hasText: '给我一下陈义君的用户画像' }).locator('.chat-history-item-meta em')).toHaveText('用户画像')
  await expect(page.getByText(/7\/18 14:57/)).toBeVisible()
  await page.getByText('给我一下陈义君的用户画像', { exact: true }).click()
  await expect(page.getByText('陈义君画像：历史任务 7 个。', { exact: true })).toBeVisible()
})

test('工作助手临时对话不会写入历史记录', async ({ page }) => {
  await page.route('**/api/ai/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: '临时回答', trace: ['临时分析完成'] }),
    })
  })
  await page.route('**/api/ai/conversations', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ conversations: [] }) })
      return
    }
    await route.continue()
  })
  await page.getByRole('button', { name: '打开工作助手' }).click()
  await page.getByRole('button', { name: '临时', exact: true }).click()
  await page.getByPlaceholder('向爱丽丝提问…').fill('这只是临时问题')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.getByText('临时回答', { exact: true })).toBeVisible()
  const saved = await page.evaluate(() => window.localStorage.getItem('alice_chat_history') || '[]')
  expect(saved).not.toContain('这只是临时问题')
})

test('工作助手主面板可以直接新建对话项目', async ({ page }) => {
  await page.getByRole('button', { name: '打开工作助手' }).click()
  const dialog = page.getByRole('dialog', { name: '爱丽丝' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '新建或切换对话项目' }).click()
  await expect(dialog.getByText('对话项目', { exact: true })).toBeVisible()
  await dialog.getByLabel('新建对话项目名称').fill('金额核对')
  await dialog.getByRole('button', { name: '新建项目' }).click()
  await expect(dialog.getByText('金额核对').first()).toBeVisible()
  const projects = await page.evaluate(() => window.localStorage.getItem('alice_chat_projects') || '[]')
  expect(projects).toContain('金额核对')
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
  await page.getByText('公司产品封套延展', { exact: true }).click()
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
  await page.getByText('公司产品封套延展', { exact: true }).click()
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
  await page.getByText('公司产品封套延展', { exact: true }).click()
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
  await page.getByText('公司产品封套延展', { exact: true }).click()
  await page.getByRole('button', { name: /记录进展/ }).last().click()
  await page.getByRole('button', { name: /本次进展为验收进展/ }).click()
  const acceptanceDialog = page.getByRole('dialog', { name: '记录验收进展' })
  const uploadInput = acceptanceDialog.locator('input[type="file"][multiple]')
  await uploadInput.setInputFiles([
    { name: '验收预览.pdf', mimeType: 'application/pdf', buffer: createPdfFixture() },
    {
      name: '验收截图.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAwMDAxMDAwMAAAAwBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64'),
    },
  ])

  await expect(acceptanceDialog.getByRole('button', { name: '预览 验收预览.pdf' }).locator('img')).toBeVisible()
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
  await page.getByText('公司产品封套延展', { exact: true }).click()
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
  await page.getByText('公司产品封套延展', { exact: true }).click()
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

  await page.getByText('公司产品封套修改', { exact: true }).click()
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
  await expect(page.getByRole('heading', { name: 'AI 运行中心' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Agent 执行审计' })).toBeVisible()
  await expect(page.getByText('已验真', { exact: true }).first()).toBeVisible()
  const workspaceSelect = page.getByLabel('切换工作区')
  await expect(workspaceSelect).toHaveValue('default')
  await expect(workspaceSelect.locator('option[value="default"]')).toHaveText('Giverny 默认工作区')
  await expect(page.getByText('浏览器回归后台任务', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '重试' })).toBeVisible()
})
