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

test('新建任务支持小数预估工时并可关闭', async ({ page }) => {
  await page.getByRole('button', { name: /新建任务/ }).first().click()
  await expect(page.getByRole('heading', { name: '新建任务' })).toBeVisible()

  const hours = page.getByRole('textbox', { name: '预估工时，可手动输入小数' })
  await hours.fill('1.2')
  await hours.blur()
  await expect(hours).toHaveValue('1.2')

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
  await expect(modal.getByRole('textbox', { name: '预估工时，可手动输入小数' })).toHaveValue('2')
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
  const hours = page.getByRole('textbox', { name: '预估工时，可手动输入小数' })
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
  await page.getByRole('button', { name: '取消' }).click()
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
  await dialog.getByRole('button', { name: '取消' }).click()
})

test('AI 运行中心汇总路由、后台任务和工作区上下文', async ({ page }) => {
  await page.goto('/settings')
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
    background: { failedCount: number; jobs: Array<{ id: string }> }
    learning: { totalSamples: number }
    }
  }
  expect(result.status, JSON.stringify(result.payload)).toBe(200)
  const { payload } = result
  expect(payload.workspace).toMatchObject({ id: 'default', foundationReady: true })
  expect(payload.routing.totalRuns).toBe(0)
  expect(payload.routing.recent).toHaveLength(0)
  expect(payload.background.failedCount).toBeGreaterThan(0)
  expect(payload.background.jobs.some((job) => job.id === 'browser-job-failed')).toBeTruthy()
  expect(payload.learning.totalSamples).toBeGreaterThan(0)

  await expect(page.getByRole('heading', { name: 'AI 运行中心' })).toBeVisible()
  await expect(page.getByText('Giverny 默认工作区', { exact: true })).toBeVisible()
  await expect(page.getByText('浏览器回归后台任务', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '重试' })).toBeVisible()
})
