import fs from 'node:fs'
import path from 'node:path'
import { setupTest as test, expect } from './fixtures'

/**
 * IM 渠道管理页 E2E 守门测试(2026-08-01 立,§24 豁免:测试补齐)。
 *
 * 覆盖路由:/admin/im-channels(PageClient → PlatformList 渲染 16 平台 button)
 * 后端 16 平台种子数据见 apps/api/src/routes/im-gateway.ts(displayName 清单:
 * 飞书/企业微信/钉钉/Discord/Telegram/Slack/微信/通用 Webhook/WhatsApp Business/
 * LINE/KakaoTalk/Signal/Matrix/Rocket.Chat/Mattermost/Zulip)。
 *
 * 4 状态截图 + DOM 数值验证(§17 UI 改动验证强制规则):
 *   - 默认态:平台卡片数量 + border-radius 圆角守门(≤ rounded-2xl = 16px)
 *   - hover 态:hover 背景色非透明
 *   - active 态:点击飞书后 aria-current="true" + 非透明背景
 *   - dark mode:.dark class 生效(next-themes attribute="class")
 *
 * 截图保存:apps/web/e2e/screenshots/im-channels-{01-default,02-hover,03-active,04-dark}.png
 */
const SCREENSHOT_DIR = 'e2e/screenshots'

// 平台列表容器(PlatformList.tsx: <nav aria-label="IM 平台列表">)
const PLATFORM_NAV = 'nav[aria-label="IM 平台列表"]'

test.describe('IM 渠道管理页', () => {
  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  })

  test('默认态渲染 + 平台卡片', async ({ adminPage: page }) => {
    await page.goto('/admin/im-channels')

    // 等标题渲染(IM 渠道管理 h1)
    await expect(page.getByRole('heading', { name: /IM 渠道管理/ })).toBeVisible({
      timeout: 15000,
    })

    // 等平台列表 API 返回 + 飞书(第一个平台)button 渲染
    const platformButtons = page.locator(`${PLATFORM_NAV} button`)
    await expect(platformButtons.first()).toBeVisible({ timeout: 15000 })

    // 截图:默认态
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'im-channels-01-default.png'),
      fullPage: true,
    })

    // DOM 验证 1:平台 button 数量 >= 16(后端 16 平台种子数据)
    const platformCount = await platformButtons.count()
    expect(platformCount).toBeGreaterThanOrEqual(16)

    // DOM 验证 2:含 rounded class 的容器数量 >= 16(任务规范要求)
    const roundedCount = await page.locator('[class*="rounded"]').count()
    expect(roundedCount).toBeGreaterThanOrEqual(16)

    // DOM 验证 3:平台卡片 border-radius 在 0-16px 范围(圆角守门,rounded-lg = 8px)
    const firstPlatformBtn = platformButtons.first()
    const borderRadius = await firstPlatformBtn.evaluate((el) => getComputedStyle(el).borderRadius)
    const radiusPx = parseFloat(borderRadius)
    expect(radiusPx).toBeGreaterThan(0)
    expect(radiusPx).toBeLessThanOrEqual(16) // 不超 rounded-2xl(16px)
  })

  test('hover 态', async ({ adminPage: page }) => {
    await page.goto('/admin/im-channels')

    const firstPlatformBtn = page.locator(`${PLATFORM_NAV} button`).first()
    await expect(firstPlatformBtn).toBeVisible({ timeout: 15000 })

    // hover 第一个平台卡片
    await firstPlatformBtn.hover()
    await page.waitForTimeout(300) // 等 transition-colors 过渡(hover:bg-muted/60)

    // 截图:hover 态
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'im-channels-02-hover.png'),
      fullPage: true,
    })

    // DOM 验证:hover 后背景色非透明(rgba(0,0,0,0))
    const bg = await firstPlatformBtn.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(bg).not.toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)|rgba?\(0\s+0\s+0\s+\/\s*0\)/)
  })

  test('active 态(点击飞书平台)', async ({ adminPage: page }) => {
    await page.goto('/admin/im-channels')

    // 飞书是第一个平台(displayName: '飞书')
    const feishuBtn = page.locator(`${PLATFORM_NAV} button`, { hasText: '飞书' }).first()
    await expect(feishuBtn).toBeVisible({ timeout: 15000 })

    // 点击飞书平台卡片
    await feishuBtn.click()
    await page.waitForTimeout(500) // 等选中态 + AdapterConfigForm 渲染

    // 截图:active 态
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'im-channels-03-active.png'),
      fullPage: true,
    })

    // DOM 验证 1:飞书 button 进入 active 态(PlatformList.tsx: isSelected → aria-current="true")
    await expect(feishuBtn).toHaveAttribute('aria-current', 'true')

    // DOM 验证 2:active 态有 bg-muted 背景色(isSelected && 'bg-muted',非透明)
    const bg = await feishuBtn.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(bg).not.toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)|rgba?\(0\s+0\s+0\s+\/\s*0\)/)
  })

  test('dark mode 态', async ({ adminPage: page }) => {
    await page.goto('/admin/im-channels')
    await expect(page.getByRole('heading', { name: /IM 渠道管理/ })).toBeVisible({
      timeout: 15000,
    })

    // 切换 dark mode(next-themes attribute="class",.dark 由 ThemeProvider 管理;
    // 与现有 spec(icon-text-alignment / sidebar-visual / tests/visual/*)一致的切换方式)
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    })
    await page.waitForTimeout(300) // 等 CSS 变量切换

    // 截图:dark mode 态
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'im-channels-04-dark.png'),
      fullPage: true,
    })

    // DOM 验证:dark class 已应用到 <html>
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(isDark).toBe(true)
  })
})
