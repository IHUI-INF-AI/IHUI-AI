import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 配置。
 *
 * 本地运行:`pnpm test:e2e`(自动起 dev server)
 * CI 运行:`pnpm test:e2e`(用 build + start,更接近生产)
 * 复用已有 server:`PLAYWRIGHT_REUSE_SERVER=1 pnpm test:e2e`
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // 本地用 dev(CI 用 build+start 更接近生产)
    command: process.env.CI ? 'pnpm build && pnpm start' : 'pnpm dev',
    url: 'http://localhost:3000',
    // 本地默认复用已运行的 dev server,避免开发时反复重启
    reuseExistingServer: process.env.CI ? false : process.env.PLAYWRIGHT_REUSE_SERVER !== '0',
    // CI build 较慢,给 240s;本地 dev 启动快,120s 够用
    timeout: process.env.CI ? 240000 : 120000,
  },
})
