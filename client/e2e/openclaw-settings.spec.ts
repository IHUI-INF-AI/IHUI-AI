/**
 * OpenClaw 快捷菜单 - 设置入口验证
 * 自动化：打开浮窗 → 打开工具箱 → 确认快捷菜单与「设置」「仪表板」按钮存在。
 * 完整流程（点击设置 → 显示设置面板与「前往系统设置」）请本地手动验证。
 */
import { test, expect } from '@playwright/test'

test.describe('OpenClaw 设置', () => {
  test('打开浮窗 → 打开工具箱 → 快捷菜单含「设置」「仪表板」', async ({ page }) => {
    await page.goto('/about')
    await page.waitForLoadState('networkidle')

    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
    }
    await page.waitForTimeout(400)

    // 触发打开 AI 浮窗事件（App.vue 中 showAIChat 默认 false，需主动触发）
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-ai-chat')))
    await page.waitForTimeout(800)

    const triggerBtn = page.locator('.floating-chat-trigger')
    const dialog = page.locator('.floating-chat-dialog')
    if (await triggerBtn.isVisible().catch(() => false)) {
      await triggerBtn.click()
      await page.waitForTimeout(600)
    }
    await expect(dialog).toBeVisible({ timeout: 12000 })

    const wrapper = page.locator('.floating-chat-dialog-wrapper')
    if (await wrapper.evaluate((el) => el.classList.contains('is-minimized')).catch(() => false)) {
      await page.locator('.floating-chat-dialog .header-btn.minimize-btn').click({ force: true })
      await page.waitForTimeout(600)
    }

    // 等待 input-area 可见后再查找 openclaw-btn
    await expect(page.locator('.floating-chat-dialog .input-area')).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(300)

    const openclawBtn = page.locator('.action-btn.openclaw-btn').first()
    await openclawBtn.waitFor({ state: 'attached', timeout: 8000 })
    await openclawBtn.evaluate((el) => (el as HTMLElement).click())
    await page.waitForTimeout(500)

    const quickMenu = page.locator('.el-popper.openclaw-popover .openclaw-quick-menu')
    await expect(quickMenu).toBeVisible({ timeout: 5000 })

    await expect(quickMenu).toContainText('设置')
    await expect(quickMenu).toContainText('仪表板')
  })
})
