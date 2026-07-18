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

  await page.getByRole('button', { name: /DeepSeek/ }).first().click()
  await expect(page.getByRole('heading', { name: 'DeepSeek 设置' })).toBeVisible()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: '加载模型', exact: true })).toBeVisible()
  await expect(dialog.getByRole('switch')).toBeVisible()
  await dialog.getByRole('button', { name: '取消' }).click()
})
