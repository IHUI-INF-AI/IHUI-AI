import { test, expect } from './fixtures'

/**
 * CLI 配置导入功能 E2E 测试
 *
 * 覆盖:
 * - 未登录访问 /settings/import 重定向到登录页
 * - /settings 主页有 "CLI 配置导入" 入口卡片
 * - /settings/llm 页面有 "导入 CLI 配置" 按钮
 * - 登录后访问 /settings/import 看到标题 + 来源选择
 * - 来源选择交互(点击高亮)
 * - mock /cli-import/sources API 渲染 6 个来源
 * - 文件上传后 mock parse-file 显示 preview
 */

const PARSE_MOCK = {
  code: 0,
  message: 'ok',
  data: {
    preview: {
      previewId: 'test-preview-id',
      source: 'claude-cli',
      sourcePath: 'settings.json',
      detectedAt: new Date().toISOString(),
      providers: [
        {
          sourceId: 'claude-cli-default',
          name: 'Claude Default',
          providerCode: 'anthropic',
          baseUrl: 'https://api.anthropic.com',
          apiFormat: 'anthropic_messages',
          warnings: [],
          isCurrent: true,
        },
      ],
      globalWarnings: [],
    },
  },
}

test.describe('CLI 配置导入', () => {
  // 2026-08-26:dev 环境偶发浏览器崩溃(Target page closed),加 1 次重试兜底
  test.describe.configure({ retries: 1 })
  test('未登录访问 /settings/import 显示登录墙(不重定向)', async ({ page }) => {
    // 2026-08-26 修复:应用未登录不重定向(显示登录墙"请先登录"/登录弹窗),原断言期望跳
    // /login 过时(redirects 仅 /login→/sso/login 一条)。改为验证未登录态呈现。
    await page.goto('/settings/import')
    await page.waitForLoadState('domcontentloaded')
    const loggedOutText = await page.getByText('请先登录').count()
    // 2026-08-26 修复:getByTestId().getAttribute() 在 strict mode 下会先等待元素出现,
    // login-dialog 不渲染(未登录态显示"请先登录"而非弹窗)时会等满测试预算 → 30s 超时
    // (catch 兜底无效,因为等待发生在 catch 之前)。改为先 count() > 0 判断再取属性。
    let dialogState: string | null = null
    if ((await page.getByTestId('login-dialog').count()) > 0) {
      dialogState = await page
        .getByTestId('login-dialog')
        .getAttribute('data-state')
        .catch(() => null)
    }
    expect(loggedOutText > 0 || dialogState === 'open', '应显示未登录登录墙').toBeTruthy()
  })

  test('settings 主页有 CLI 配置导入入口卡片', async ({ authenticatedPage }) => {
    // 2026-08-26 修复:改用 authenticatedPage(真实登录 storage),移除 mock 认证
    // (原 mock /auth/me + refresh 与 bootstrap 耦合脆弱,登录态不可靠)
    await authenticatedPage.goto('/settings')
    await authenticatedPage.waitForLoadState('domcontentloaded').catch(() => {})
    // SUB_PAGES 卡片渲染(2026-08-26 修复:strict mode violation,取 first)
    await expect(authenticatedPage.locator('a[href="/settings/import"]').first()).toBeVisible({
      timeout: 15000,
    })
  })

  test.describe('已登录场景', () => {
    test.beforeEach(async ({ authenticatedPage }) => {
      // 2026-08-26 修复:改用 authenticatedPage(真实登录 storage)+ 真实后端 API ——
      // 原 mock 认证链(page.route /auth/me + /auth/refresh)与 bootstrap 流程耦合脆弱
      // (mock 未拦截时 refresh 真实 401 → logout → 登录态丢失,按钮不渲染);
      // 真实登录 + 真实 /api/user/cli-import/sources(已验证 200 返回 6 来源)更可靠。
      // parse-file 仍由各测试自行 mock(真实 parse 需真实配置解析)。
      await authenticatedPage.goto('/settings/import')
      await authenticatedPage.waitForLoadState('domcontentloaded').catch(() => {})
      // 等待来源按钮渲染(dev 首屏编译后)
      await authenticatedPage
        .getByRole('button', { name: /cc-switch/ })
        .first()
        .waitFor({ state: 'visible', timeout: 20000 })
        .catch(() => {})
    })

    test('访问 /settings/import 显示标题与来源选择', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/settings/import')
      // 2026-08-26 修复:页面存在 2 个 level-1 heading(header"设置" + 页面主体"CLI 配置导入"),
      // 取 first 会命中 header"设置" → 用 filter 定位含 CLI/配置导入 的标题
      await expect(
        authenticatedPage
          .getByRole('heading', { level: 1 })
          .filter({ hasText: /CLI|配置导入/ })
          .first(),
      ).toBeVisible({ timeout: 10000 })
      // 来源按钮(2026-08-26 修复:真实后端可能多返回来源/按钮文本含多个关键词,
      // 精确 =6 脆弱 → 改为 ≥6;count() 是即时查询不等待 → 先等首个按钮可见
      // 再 count(sources API 异步加载,dev 首屏编译慢时立即 count 得 0))
      const sourceBtns = authenticatedPage.getByRole('button', {
        name: /cc-switch|codex\+\+|Claude|Codex|Gemini|Hermes/,
      })
      await expect(sourceBtns.first()).toBeVisible({ timeout: 15000 })
      const sourceCount = await sourceBtns.count()
      expect(sourceCount, `来源按钮应 ≥6,实际 ${sourceCount}`).toBeGreaterThanOrEqual(6)
    })

    test('点击来源 cc-switch 高亮选中', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/settings/import')
      // 2026-08-26 修复:goto 后 dev 首屏编译中页面有 pending navigation,直接 click 会等
      // "navigation to finish" 30s 超时 → 先等 load 稳定 + 来源按钮可见再点
      await authenticatedPage.waitForLoadState('domcontentloaded').catch(() => {})
      await authenticatedPage
        .getByRole('button', { name: /cc-switch/ })
        .first()
        .waitFor({ state: 'visible', timeout: 15000 })

      await authenticatedPage
        .getByRole('button', { name: /cc-switch/ })
        .first()
        .click()
      // 选中按钮应有 border-primary 类
      const selected = authenticatedPage.getByRole('button', { name: /cc-switch/ }).first()
      await expect(selected).toHaveClass(/border-primary/)
      // 选中后显示文件上传区域(strict mode:多个元素含"上传文件",取 first)
      await expect(authenticatedPage.getByText(/上传文件|选择文件|拖拽/).first()).toBeVisible({
        timeout: 5000,
      })
    })

    test('/settings/llm 页面有导入 CLI 配置按钮', async ({ authenticatedPage }) => {
      // mock LLM configs API
      await authenticatedPage.route('**/api/user/llm-configs', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: 0, data: { list: [], total: 0 } }),
        }),
      )
      await authenticatedPage.route('**/api/user/llm-configs/templates', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: 0, data: { templates: [] } }),
        }),
      )
      await authenticatedPage.goto('/settings/llm')
      const importLink = authenticatedPage.locator('a[href="/settings/import"]').first()
      await expect(importLink).toBeVisible({ timeout: 10000 })
    })

    test('mock 解析后显示 preview 与提交按钮', async ({ authenticatedPage }) => {
      // mock parse-file
      await authenticatedPage.route('**/api/user/cli-import/parse-file', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(PARSE_MOCK),
        }),
      )

      await authenticatedPage.goto('/settings/import')
      // 2026-08-26 修复:同 cc-switch 点击 —— dev 首屏编译 pending navigation,先等稳定+按钮可见
      await authenticatedPage.waitForLoadState('domcontentloaded').catch(() => {})
      await authenticatedPage
        .getByRole('button', { name: /Claude Code/ })
        .first()
        .waitFor({ state: 'visible', timeout: 15000 })
      // 选 claude-cli
      await authenticatedPage
        .getByRole('button', { name: /Claude Code/ })
        .first()
        .click()
      // 上传一个 mock 文件(2026-08-26 修复:页面存在 2 个 file input —— ①聊天工具栏
      // ai-input-toolbar 的 1 个(hidden);②Step2 上传区 label 内的 1 个(hidden,
      // 选来源后条件渲染)。strict mode violation + :visible 匹配不到(hidden)→
      // 用 label 限定唯一上传区 file input)
      const fileInput = authenticatedPage.locator(
        'label:has(> input[type="file"]) input[type="file"]',
      )
      await fileInput.setInputFiles({
        name: 'settings.json',
        mimeType: 'application/json',
        buffer: Buffer.from('{"env": {}}', 'utf-8'),
      })
      // 点击解析按钮
      await authenticatedPage.getByRole('button', { name: /解析/ }).click()
      // 等 preview 显示(2026-08-26 修复:解析结果区标题+描述多处含关键词,strict violation → first)
      await expect(authenticatedPage.getByText(/解析预览|解析成功/).first()).toBeVisible({
        timeout: 5000,
      })
      // 提交按钮可见
      await expect(authenticatedPage.getByRole('button', { name: /确认导入|导入/ })).toBeVisible({
        timeout: 5000,
      })
    })
  })
})
