/**
 * OpenClaw 各子面板 - 自测：打开浮窗 → 工具箱 → 进入各面板，检查横向溢出与关键元素可见
 */
import { test, expect } from '@playwright/test'

async function openFloatingChatAndToolbox(page: import('@playwright/test').Page) {
  await page.goto('/about')
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1000)
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  }
  await page.waitForTimeout(400)

  // 触发打开 AI 浮窗事件（App.vue 中 showAIChat 默认 false，需主动触发）
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-ai-chat')))
  await page.waitForTimeout(800)

  const triggerBtn = page.locator('.floating-chat-trigger')
  if (await triggerBtn.isVisible().catch(() => false)) {
    await triggerBtn.click()
    await page.waitForTimeout(600)
  }
  await expect(page.locator('.floating-chat-dialog')).toBeVisible({ timeout: 12000 })

  const wrapper = page.locator('.floating-chat-dialog-wrapper')
  if (await wrapper.evaluate((el) => el.classList.contains('is-minimized')).catch(() => false)) {
    // 点击「最大化」按钮展开浮窗（单点 header 不会展开，需点 minimize-btn）
    await page.locator('.floating-chat-dialog .header-btn.minimize-btn').click({ force: true })
    await page.waitForTimeout(600)
  }
  // 确保输入区已展开，再点工具箱
  await expect(page.locator('.floating-chat-dialog .input-area')).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(300)

  const openclawBtn = page.locator('.action-btn.openclaw-btn').first()
  await openclawBtn.waitFor({ state: 'attached', timeout: 8000 })
  await openclawBtn.evaluate((el) => (el as HTMLElement).click())
  await page.waitForTimeout(500)
  await expect(page.locator('.el-popper.openclaw-popover .openclaw-quick-menu')).toBeVisible({ timeout: 5000 })
}

/** 点击快捷菜单项并等待面板出现 */
async function clickOpenClawMenuItemAndWaitPanel(
  page: import('@playwright/test').Page,
  menuText: string | RegExp,
  panelSelector: string
) {
  const menuItem = page.locator('.el-popper.openclaw-popover .openclaw-quick-menu .menu-item').filter({
    hasText: menuText,
  }).first()
  await expect(menuItem).toBeVisible({ timeout: 3000 })
  await menuItem.scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  await menuItem.click({ force: true })
  await page.waitForTimeout(600)
  await expect(page.locator(panelSelector)).toBeVisible({ timeout: 8000 })
}

/**
 * 检测面板内容区是否发生横向溢出（scrollWidth > clientWidth）
 */
/** 最小宽度阈值：小于此值的子元素溢出不计入（避免按钮内 span 等小控件误报） */
const MIN_OVERFLOW_WIDTH = 60

async function checkPanelHorizontalOverflow(page: import('@playwright/test').Page): Promise<{ overflow: boolean; details: string[] }> {
  const details: string[] = []
  const overflow = await page.evaluate((minWidth: number) => {
    const panel = document.querySelector('.openclaw-panel-content') || document.querySelector('.openclaw-panel-wrapper')
    if (!panel) return { overflow: false, details: [] as string[] }
    const els: Element[] = [panel as Element, ...Array.from(panel.querySelectorAll('*'))]
    const results: string[] = []
    let hasOverflow = false
    for (const el of els) {
      const html = el as HTMLElement
      if (html.scrollWidth > html.clientWidth && html.clientWidth >= minWidth) {
        hasOverflow = true
        const tag = html.tagName.toLowerCase()
        const cls = html.className && typeof html.className === 'string' ? html.className : ''
        results.push(`${tag}.${cls.slice(0, 60)} scroll=${html.scrollWidth} client=${html.clientWidth}`)
      }
    }
    return { overflow: hasOverflow, details: results }
  }, MIN_OVERFLOW_WIDTH)
  return { overflow: (overflow as { overflow: boolean }).overflow, details: (overflow as { details: string[] }).details }
}

test.describe('OpenClaw 面板自测', () => {
  test.describe.configure({ mode: 'serial' })
  test('打开仪表板面板并检查溢出', async ({ page }) => {
    await openFloatingChatAndToolbox(page)
    await clickOpenClawMenuItemAndWaitPanel(page, '仪表板', '.floating-chat-dialog .openclaw-panel-wrapper')
    const { overflow, details } = await checkPanelHorizontalOverflow(page)
    if (overflow) {
      console.log('Dashboard overflow:', details)
    }
    expect(overflow, `仪表板横向溢出: ${details.join('; ')}`).toBe(false)
  })

  test('打开记忆面板并检查溢出', async ({ page }) => {
    await openFloatingChatAndToolbox(page)
    await page.locator('.el-popper.openclaw-popover .menu-item').filter({ hasText: '记忆' }).first().click()
    await page.waitForTimeout(800)
    await expect(page.locator('.floating-chat-dialog .openclaw-panel-content')).toBeVisible({ timeout: 8000 })
    const { overflow, details } = await checkPanelHorizontalOverflow(page)
    if (overflow) {
      console.log('Memory overflow:', details)
    }
    expect(overflow, `记忆面板横向溢出: ${details.join('; ')}`).toBe(false)
  })

  test('打开技能面板并检查溢出', async ({ page }) => {
    await openFloatingChatAndToolbox(page)
    await clickOpenClawMenuItemAndWaitPanel(page, '技能', '.floating-chat-dialog .openclaw-panel-content')
    const { overflow, details } = await checkPanelHorizontalOverflow(page)
    if (overflow) {
      console.log('Skills overflow:', details)
    }
    expect(overflow, `技能面板横向溢出: ${details.join('; ')}`).toBe(false)
  })

  test('打开模型面板并检查溢出', async ({ page }) => {
    await openFloatingChatAndToolbox(page)
    await clickOpenClawMenuItemAndWaitPanel(page, '模型', '.floating-chat-dialog .openclaw-panel-content')
    const { overflow, details } = await checkPanelHorizontalOverflow(page)
    if (overflow) {
      console.log('Models overflow:', details)
    }
    expect(overflow, `模型面板横向溢出: ${details.join('; ')}`).toBe(false)
  })

  test('打开集成面板并检查溢出', async ({ page }) => {
    await openFloatingChatAndToolbox(page)
    await clickOpenClawMenuItemAndWaitPanel(page, '集成', '.floating-chat-dialog .openclaw-panel-content')
    const { overflow, details } = await checkPanelHorizontalOverflow(page)
    if (overflow) {
      console.log('Integrations overflow:', details)
    }
    expect(overflow, `集成面板横向溢出: ${details.join('; ')}`).toBe(false)
  })

  test('打开自动化面板并检查溢出', async ({ page }) => {
    await openFloatingChatAndToolbox(page)
    await clickOpenClawMenuItemAndWaitPanel(page, '自动化', '.floating-chat-dialog .openclaw-panel-content')
    const { overflow, details } = await checkPanelHorizontalOverflow(page)
    if (overflow) {
      console.log('Automation overflow:', details)
    }
    expect(overflow, `自动化面板横向溢出: ${details.join('; ')}`).toBe(false)
  })

  test('打开浏览器面板并截图留证', async ({ page }) => {
    await openFloatingChatAndToolbox(page)
    const menuItem = page.locator('.el-popper.openclaw-popover .openclaw-quick-menu .menu-item').filter({ hasText: '浏览器' }).first()
    await expect(menuItem).toBeVisible({ timeout: 3000 })
    await menuItem.click({ force: true })
    await page.waitForTimeout(1000)
    await expect(page.locator('.floating-chat-dialog .openclaw-panel-wrapper')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.floating-chat-dialog .openclaw-panel-wrapper').getByText('浏览器').first()).toBeVisible({ timeout: 5000 })
    await page.screenshot({ path: 'test-results/browser-panel-screenshot.png', fullPage: false })
  })

  test('打开浏览器/网页自动化面板并验证在对话中操作', async ({ page }) => {
    await openFloatingChatAndToolbox(page)
    const menuItem = page.locator('.el-popper.openclaw-popover .openclaw-quick-menu .menu-item').filter({
      hasText: '浏览器',
    }).first()
    await expect(menuItem).toBeVisible({ timeout: 3000 })
    await menuItem.scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)
    await menuItem.click({ force: true })
    await page.waitForTimeout(800)
    await expect(page.locator('.floating-chat-dialog .openclaw-panel-wrapper')).toBeVisible({ timeout: 8000 })
    const panel = page.locator('.floating-chat-dialog .openclaw-panel-wrapper')
    await expect(panel.getByText('浏览器').first()).toBeVisible({ timeout: 6000 })
    const useInChatBtn = panel.getByRole('button', { name: /在对话中让 AI 操作|Use in chat/ })
    const hasUseInChatBtn = await useInChatBtn.isVisible().catch(() => false)
    if (hasUseInChatBtn) {
      const hasQuickActions = await panel.getByText(/快速操作|Quick actions/).isVisible().catch(() => false)
      if (hasQuickActions) {
        await expect(panel.locator('.browser-panel__container')).toBeVisible()
      }
      const { overflow, details } = await checkPanelHorizontalOverflow(page)
      expect(overflow, `浏览器面板横向溢出: ${details.join('; ')}`).toBe(false)
      await useInChatBtn.click()
      await page.waitForTimeout(500)
      await expect(page.locator('.floating-chat-dialog .openclaw-panel-wrapper')).not.toBeVisible()
      await expect(page.locator('.floating-chat-dialog .input-area')).toBeVisible()
    } else {
      const { overflow, details } = await checkPanelHorizontalOverflow(page)
      expect(overflow, `浏览器面板横向溢出: ${details.join('; ')}`).toBe(false)
    }
  })

  test('打开设置面板并检查溢出', async ({ page }) => {
    await openFloatingChatAndToolbox(page)
    await clickOpenClawMenuItemAndWaitPanel(
      page,
      '设置',
      '.floating-chat-dialog .openclaw-settings, .floating-chat-dialog .openclaw-panel-content'
    )
    const { overflow, details } = await checkPanelHorizontalOverflow(page)
    if (overflow) {
      console.log('Settings overflow:', details)
    }
    expect(overflow, `设置面板横向溢出: ${details.join('; ')}`).toBe(false)
  })
})
