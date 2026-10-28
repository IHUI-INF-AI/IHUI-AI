import { defineConfig, devices } from '@playwright/test'

/**
 * 流式渲染 e2e 专用配置(2026-10-29 立,档⑦⑧⑨像素守门)。
 * 与默认 playwright.config 的差异是有意的:
 *   - 不含 globalSetup/`setup` 项目依赖:E2E 登录态链要真实 API,而这两个 spec
 *     全部零后端(harness 路由 localStorage 假会话 + page.route 全量 mock /api/**),
 *     让无关的登录 setup 挡路既慢又脆(2026-10-29 实测:共享 dev 半死时 setup 全红,
 *     而这两条 spec 与后端毫无关系)。
 *   - 不自拉 webServer:跑者自备实例(默认复用 8801;多席并发时用
 *     IHUI_DEV_PORT 隔离档 + PLAYWRIGHT_BASE_URL 指向本席端口)。
 * 用法:
 *   PLAYWRIGHT_BASE_URL=http://localhost:8822 pnpm exec playwright test --config playwright.stream-lifecycle.config.ts
 */
export default defineConfig({
  testDir: '.',
  testMatch: ['e2e/streaming-smoothness.spec.ts', 'e2e/streaming-lifecycle.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: 'line',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8801',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    launchOptions: { args: ['--disable-dev-shm-usage'] },
  },
})
