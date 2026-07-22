import { defineConfig, devices } from '@playwright/test'

/**
 * 侧边栏高度验证专用配置 — 独立于主 e2e 套件
 * 复用已运行的 dev server(localhost:3001 已在线),不重启。
 */
export default defineConfig({
  testDir: './tests/visual',
  testMatch: /sidebar-height-verify\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3001',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
  },
  // 不配置 webServer,复用已在线的 dev server
})
