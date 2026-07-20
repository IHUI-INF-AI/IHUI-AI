import { test, expect } from '@playwright/test'

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

const SOURCES_MOCK = {
  code: 0,
  message: 'ok',
  data: {
    sources: [
      { source: 'cc-switch', description: 'cc-switch SQLite 数据库' },
      { source: 'codex++', description: 'codex++ BackendSettings' },
      { source: 'claude-cli', description: 'Claude Code CLI settings.json' },
      { source: 'codex-cli', description: 'Codex CLI config.toml' },
      { source: 'gemini-cli', description: 'Gemini CLI .env / settings.json' },
      { source: 'hermes', description: 'Hermes config.yaml' },
    ],
  },
}

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

const HISTORY_MOCK = {
  code: 0,
  message: 'ok',
  data: {
    list: [
      {
        id: 'imp-1',
        source: 'claude-cli',
        sourcePath: '~/.claude/settings.json',
        importedCount: 1,
        skippedCount: 0,
        failedCount: 0,
        status: 'success',
        importedAt: new Date().toISOString(),
      },
    ],
    total: 1,
  },
}

test.describe('CLI 配置导入', () => {
  test('未登录访问 /settings/import 重定向到登录页', async ({ page }) => {
    await page.goto('/settings/import')
    await expect(page).toHaveURL(/\/(sso\/)?login/, { timeout: 10000 })
  })

  test('settings 主页有 CLI 配置导入入口卡片', async ({ page }) => {
    // mock 已登录
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: { id: '1', roleId: 0 } }),
      }),
    )
    await page.goto('/settings')
    // SUB_PAGES 卡片渲染
    await expect(page.locator('a[href="/settings/import"]')).toBeVisible({ timeout: 10000 })
  })

  test.describe('已登录场景', () => {
    test.beforeEach(async ({ page }) => {
      // mock 认证
      await page.route('**/api/auth/me', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 0,
            data: { id: '1', roleId: 0, nickname: 'tester' },
          }),
        }),
      )
      // mock sources
      await page.route('**/api/user/cli-import/sources', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(SOURCES_MOCK),
        }),
      )
      // mock history
      await page.route('**/api/user/cli-import/history', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(HISTORY_MOCK),
        }),
      )
    })

    test('访问 /settings/import 显示标题与来源选择', async ({ page }) => {
      await page.goto('/settings/import')
      await expect(page.getByRole('heading', { level: 1 })).toContainText(/CLI|配置导入/, {
        timeout: 10000,
      })
      // 6 个来源按钮
      await expect(
        page.getByRole('button', { name: /cc-switch|codex\+\+|Claude|Codex|Gemini|Hermes/ }),
      ).toHaveCount(6, {
        timeout: 5000,
      })
    })

    test('点击来源 cc-switch 高亮选中', async ({ page }) => {
      await page.goto('/settings/import')
      await page
        .getByRole('button', { name: /cc-switch/ })
        .first()
        .click()
      // 选中按钮应有 border-primary 类
      const selected = page.getByRole('button', { name: /cc-switch/ }).first()
      await expect(selected).toHaveClass(/border-primary/)
      // 选中后显示文件上传区域
      await expect(page.getByText(/上传文件|选择文件|拖拽/)).toBeVisible({ timeout: 5000 })
    })

    test('/settings/llm 页面有导入 CLI 配置按钮', async ({ page }) => {
      // mock LLM configs API
      await page.route('**/api/user/llm-configs', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: 0, data: { list: [], total: 0 } }),
        }),
      )
      await page.route('**/api/user/llm-configs/templates', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: 0, data: { templates: [] } }),
        }),
      )
      await page.goto('/settings/llm')
      const importLink = page.locator('a[href="/settings/import"]').first()
      await expect(importLink).toBeVisible({ timeout: 10000 })
    })

    test('mock 解析后显示 preview 与提交按钮', async ({ page }) => {
      // mock parse-file
      await page.route('**/api/user/cli-import/parse-file', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(PARSE_MOCK),
        }),
      )

      await page.goto('/settings/import')
      // 选 claude-cli
      await page
        .getByRole('button', { name: /Claude Code/ })
        .first()
        .click()
      // 上传一个 mock 文件
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles({
        name: 'settings.json',
        mimeType: 'application/json',
        buffer: Buffer.fromString('{"env": {}}'),
      })
      // 点击解析按钮
      await page.getByRole('button', { name: /解析/ }).click()
      // 等 preview 显示
      await expect(page.getByText(/解析预览|解析成功/)).toBeVisible({ timeout: 5000 })
      // 提交按钮可见
      await expect(page.getByRole('button', { name: /确认导入|导入/ })).toBeVisible({
        timeout: 5000,
      })
    })
  })
})
