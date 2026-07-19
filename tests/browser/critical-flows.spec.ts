import { expect, test, type Page } from '@playwright/test'

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
