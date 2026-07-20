import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 配置。
 *
 * 本地运行:`pnpm test:e2e`(自动起 dev server)
 * CI 运行:`pnpm test:e2e`(用 build + start,更接近生产)
 * 复用已有 server:`PLAYWRIGHT_REUSE_SERVER=1 pnpm test:e2e`
 */
export default defineConfig({
  // 覆盖默认 testDir + testMatch:同时发现 e2e/ 与 tests/visual/ 两个目录下的 spec。
  // - e2e/ 已有 ~50 case(主 e2e 套件)
  // - tests/visual/ 5 个 visual 回归 spec(login-dialog / model-selector / prompt-templates /
  //   sidebar-height-verify / sidebar-history)。这两个目录之前需要切换不同 config 才能跑,
  //   统一到默认 config 后,`pnpm test:e2e` 与 `playwright test tests/visual/` 都能发现。
  testDir: '.',
  testMatch: ['e2e/**/*.spec.ts', 'e2e/**/*.setup.ts', 'tests/visual/**/*.spec.ts'],
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
    // 登录态 setup：仅匹配 *.setup.ts，预先登录并写入 e2e/.auth/*.json
    // 不挂 dependencies 到 chromium，避免后端不可用时拖垮现有 34 个 spec
    // 需要 storageState 的测试通过 fixtures.ts 的 authenticatedPage/adminPage 使用，
    // 它们在文件缺失时会自动 API 登录兜底
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // 本地用 dev(CI 用 build+start 更接近生产)
    command: process.env.CI ? 'pnpm build && pnpm start' : 'pnpm dev',
    url: 'http://localhost:3000',
    // 本地默认复用已运行的 dev server,避免开发时反复重启;CI 模式下显式设置 PLAYWRIGHT_REUSE_SERVER=1 也可复用
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER
      ? process.env.PLAYWRIGHT_REUSE_SERVER !== '0'
      : !process.env.CI,
    // CI build 较慢,给 240s;本地 dev 启动快,120s 够用
    timeout: process.env.CI ? 240000 : 120000,
  },
})
