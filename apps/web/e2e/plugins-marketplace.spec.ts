import { test, expect } from '@playwright/test'

/**
 * 插件市场 Codex 10 插件对齐 E2E
 *
 * 验证 /plugins 页面渲染 Codex 必装 10 插件:
 *   browser-use / github-mcp / anthropic-computer-use / build-web-apps /
 *   figma-mcp / documents / presentations / spreadsheets / hyperframes / remotion
 *
 * 不依赖登录态(/plugins 公开可访问,见 middleware.ts 白名单)。
 */
const CODEX_TEN_PLUGINS = [
  { id: 'browser-use', name: 'Browser Use' },
  { id: 'github-mcp', name: 'GitHub MCP' },
  { id: 'anthropic-computer-use', name: 'Anthropic Computer Use' },
  { id: 'build-web-apps', name: 'Build Web Apps' },
  { id: 'figma-mcp', name: 'Figma MCP' },
  { id: 'documents', name: 'Documents' },
  { id: 'presentations', name: 'Presentations' },
  { id: 'spreadsheets', name: 'Spreadsheets' },
  { id: 'hyperframes', name: 'Hyperframes' },
  { id: 'remotion', name: 'Remotion' },
] as const

test.describe('插件市场 Codex 10 插件对齐', () => {
  test('H8.1 /plugins 页面可访问', async ({ page }) => {
    await page.goto('/plugins')
    await expect(page).toHaveTitle(/IHUI|AI|插件/i)
  })

  test('H8.2 10 插件卡片渲染 - 名称可见', async ({ page }) => {
    await page.goto('/plugins')
    await page.waitForLoadState('networkidle')

    for (const plugin of CODEX_TEN_PLUGINS) {
      const card = page.locator('text=' + plugin.name).first()
      await expect(card).toBeVisible({ timeout: 10000 })
    }
  })

  test('H8.3 每张卡片含图标(svg 或 img)', async ({ page }) => {
    await page.goto('/plugins')
    await page.waitForLoadState('networkidle')

    for (const plugin of CODEX_TEN_PLUGINS) {
      const card = page.locator('text=' + plugin.name).first()
      const icon = card
        .locator('xpath=ancestor::*[contains(@class,"card") or contains(@class,"Card")][1]')
        .locator('svg, img')
        .first()
      await expect(icon).toBeVisible({ timeout: 10000 })
    }
  })
})
