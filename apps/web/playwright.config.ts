// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 配置。
 *
 * 本地运行:`pnpm test:e2e`(自动起 dev server)
 * CI 运行:`pnpm test:e2e`(用 build + start,更接近生产)
 * 复用已有 server:`PLAYWRIGHT_REUSE_SERVER=1 pnpm test:e2e`
 *
 * globalSetup 在所有 spec 前自动 seed test@aizhs.top 用户,globalTeardown 在所有 spec 后
 * 自动 cleanup(回到只有 admin 状态),保证 E2E 自包含、CI 无需手动干预。
 * - 跳过 seed:`E2E_SKIP_SEED=1`(本地复用已 seed 的数据库)
 * - 跳过 cleanup:`E2E_AUTO_CLEANUP=0`(调试时保留 test@aizhs.top)
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
  // 本地默认 workers=undefined 时 Playwright 取 CPU/2(本机 20 线程 → 10 worker),
  // 10 个并发 chromium 压单线程 Turbopack dev server → 每请求 10-15s → 30s 超时雪崩
  // (2026-08-29 实锤,20 用例全部 beforeEach goto 超时)。固定 2 worker,可用
  // PLAYWRIGHT_WORKERS 覆盖;CI 保持 1 保证确定性。
  workers: process.env.CI ? 1 : Number(process.env.PLAYWRIGHT_WORKERS ?? 2),
  // 本地也加 1 次重试兜底环境抖动(dev 模式首访编译/后台进程抢占 CPU 导致
  // 偶发超时;重试时页面 chunk 已编译,基本必过)。CI 保持 2。
  retries: process.env.CI ? 2 : 1,
  forbidOnly: !!process.env.CI,
  reporter: 'html',
  // globalSetup 自动 seed test@aizhs.top,失败只 warn 不 throw(与 fixtures.ts ensureStorageState 兜底兼容);
  // globalTeardown 自动 cleanup,失败只 warn 不阻塞测试报告生成。详见 e2e/global-setup.ts / global-teardown.ts。
  globalSetup: 'e2e/global-setup.ts',
  globalTeardown: 'e2e/global-teardown.ts',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8801',
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
  // webServer: {
  //   // 本地用 dev(CI 用 build+start 更接近生产)
  //   command: process.env.CI ? 'pnpm build && pnpm start' : 'pnpm dev',
  //   url: 'http://localhost:8801',
  //   // 本地默认复用已运行的 dev server,避免开发时反复重启;CI 模式下显式设置 PLAYWRIGHT_REUSE_SERVER=1 也可复用
  //   reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER
  //     ? process.env.PLAYWRIGHT_REUSE_SERVER !== '0'
  //     : !process.env.CI,
  //   // CI build 较慢,给 240s;本地 dev 启动快,120s 够用
  //   timeout: process.env.CI ? 240000 : 120000,
  // },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
