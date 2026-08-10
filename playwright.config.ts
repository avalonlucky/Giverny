import { defineConfig, devices } from '@playwright/test'

const appPort = Number(process.env.BROWSER_EVAL_APP_PORT || 8799)

export default defineConfig({
  testDir: './tests/browser',
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  use: {
    baseURL: `http://127.0.0.1:${appPort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'exec node agent-evals/start-browser-eval.mjs',
    url: `http://127.0.0.1:${appPort}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    // 没有这一段时 Playwright 会直接 SIGKILL 整个 webServer 进程组，
    // start-browser-eval 的清理逻辑根本跑不到，workerd 的临时 D1/R2 目录会一直堆积。
    gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 },
  },
})
