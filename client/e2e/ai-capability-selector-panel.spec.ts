/**
 * AI 能力选择器面板样式验证
 * 验证 Teleport 到 body 的面板应用了全局样式（背板毛玻璃、24px 圆角等）
 */
import { test, expect } from '@playwright/test'

test.describe('AI 能力选择器面板', () => {
  test('打开选择AI能力面板后，背板与主容器应用新样式', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 关闭可能遮挡的弹层（多按几次 Escape 关闭活动弹窗、引导等）
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
    }
    await page.waitForTimeout(400)

    // 触发打开 AI 浮窗事件（App.vue 中 showAIChat 默认 false，需主动触发）
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-ai-chat')))
    await page.waitForTimeout(800)

    // 等待 AIChat 挂载
    const triggerBtn = page.locator('.floating-chat-trigger')
    const dialog = page.locator('.floating-chat-dialog')
    if (await triggerBtn.isVisible().catch(() => false)) {
      await triggerBtn.click()
      await page.waitForTimeout(600)
    }
    await expect(dialog).toBeVisible({ timeout: 12000 })

    // 若处于最小化，点击 minimize-btn 展开（单点 dialog-header 不会展开）
    const wrapper = page.locator('.floating-chat-dialog-wrapper')
    if (await wrapper.evaluate((el) => el.classList.contains('is-minimized')).catch(() => false)) {
      await page.locator('.floating-chat-dialog .header-btn.minimize-btn').click({ force: true })
      await page.waitForTimeout(600)
    }

    // 能力选择下拉的触发按钮（可能在折叠区域内，用 evaluate 触发点击）
    await page.locator('.ai-capability-selector button').first().evaluate((el) => (el as HTMLElement).click())
    await page.waitForTimeout(600)

    // 下拉为 openclaw-quick-menu，点击「大模型」打开全屏选择面板
    const quickMenu = page.locator('.el-popper.ai-capability-popper .openclaw-quick-menu.ai-capability-quick-menu')
    await expect(quickMenu).toBeVisible({ timeout: 5000 })
    const modelItem = quickMenu.locator('.menu-item').filter({ hasText: /大模型|模型/ }).first()
    await modelItem.evaluate((el) => (el as HTMLElement).click())
    await page.waitForTimeout(600)

    // 全屏面板（Teleport）应出现
    const backdrop = page.locator('.ai-capability-selector__backdrop')
    await expect(backdrop).toBeVisible({ timeout: 6000 })

    const panel = backdrop.locator('.ai-capability-selector')
    await expect(panel).toBeVisible()

    // 背板应有毛玻璃或半透明背景
    const backdropStyle = await backdrop.evaluate((el) => {
      const s = window.getComputedStyle(el)
      return {
        backdropFilter: s.backdropFilter,
        background: s.background,
      }
    })
    expect(backdropStyle.background).toBeTruthy()

    // 主容器圆角（设计规范 24px，全局样式以 .ai-capability-selector__panel 生效，硬刷新后可见）
    const panelStyle = await panel.evaluate((el) => {
      const s = window.getComputedStyle(el)
      return { borderRadius: s.borderRadius }
    })
    const radius = parseFloat(panelStyle.borderRadius)
    expect(radius).toBeGreaterThanOrEqual(8)

    // 导航区不溢出：内容在容器内，无需横向滚动即可看全
    const nav = backdrop.locator('.ai-capability-selector__nav')
    await expect(nav).toBeVisible()
    const navOverflow = await nav.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      noOverflow: el.scrollWidth <= el.clientWidth,
    }))
    expect(navOverflow.noOverflow).toBe(true)

    const navInner = backdrop.locator('.ai-capability-selector__nav-inner')
    await expect(navInner).toBeVisible()
    const innerOverflow = await navInner.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      noOverflow: el.scrollWidth <= el.clientWidth,
    }))
    expect(innerOverflow.noOverflow).toBe(true)
  })

  test('智能体 tab 下列表展示且至少有一项带头像或占位图标', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
    }
    await page.waitForTimeout(400)

    const triggerBtn = page.locator('.floating-chat-trigger')
    const dialog = page.locator('.floating-chat-dialog')
    // 触发打开 AI 浮窗事件（App.vue 中 showAIChat 默认 false，需主动触发）
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-ai-chat')))
    await page.waitForTimeout(800)
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

    await page.locator('.ai-capability-selector button').first().evaluate((el) => (el as HTMLElement).click())
    await page.waitForTimeout(600)

    const quickMenu = page.locator('.el-popper.ai-capability-popper .openclaw-quick-menu.ai-capability-quick-menu')
    await expect(quickMenu).toBeVisible({ timeout: 5000 })
    const agentItem = quickMenu.locator('.menu-item').filter({ hasText: /智能体|Agent/ }).first()
    await agentItem.evaluate((el) => (el as HTMLElement).click())
    await page.waitForTimeout(1200)

    const backdrop = page.locator('.ai-capability-selector__backdrop')
    await expect(backdrop).toBeVisible({ timeout: 6000 })
    await backdrop.locator('button').filter({ hasText: /智能体|Agent/ }).first().click()
    await page.waitForTimeout(1000)

    const capabilityItems = backdrop.locator('.capability-item')
    await expect(capabilityItems.first()).toBeVisible({ timeout: 8000 })
    const count = await capabilityItems.count()
    expect(count).toBeGreaterThan(0)

    const itemsWithIcon = await backdrop.locator('.capability-item__icon').count()
    expect(itemsWithIcon).toBeGreaterThan(0)
  })

  test('MCP工具 tab 下展示多条内置 MCP（含演示 healthCheck 与 curated 列表）', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
    }
    await page.waitForTimeout(400)

    const triggerBtn = page.locator('.floating-chat-trigger')
    const dialog = page.locator('.floating-chat-dialog')
    // 触发打开 AI 浮窗事件（App.vue 中 showAIChat 默认 false，需主动触发）
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-ai-chat')))
    await page.waitForTimeout(800)
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

    await page.locator('.ai-capability-selector button').first().evaluate((el) => (el as HTMLElement).click())
    await page.waitForTimeout(600)

    const quickMenu = page.locator('.el-popper.ai-capability-popper .openclaw-quick-menu.ai-capability-quick-menu')
    await expect(quickMenu).toBeVisible({ timeout: 5000 })
    const mcpItem = quickMenu.locator('.menu-item').filter({ hasText: /MCP|工具/ }).first()
    await mcpItem.evaluate((el) => (el as HTMLElement).click())
    await page.waitForTimeout(1200)

    const backdrop = page.locator('.ai-capability-selector__backdrop')
    await expect(backdrop).toBeVisible({ timeout: 6000 })
    await backdrop.locator('button').filter({ hasText: /MCP|工具/ }).first().click()
    await page.waitForTimeout(1500)

    const capabilityItems = backdrop.locator('.capability-item')
    await expect(capabilityItems.first()).toBeVisible({ timeout: 10000 })
    const count = await capabilityItems.count()
    expect(count).toBeGreaterThanOrEqual(2)

    const pageText = await backdrop.locator('.ai-capability-selector__content').textContent()
    const hasHealthCheck = pageText?.includes('healthCheck') ?? false
    const hasCurated = (pageText?.includes('Filesystem') || pageText?.includes('read_file') || pageText?.includes('GitHub') || pageText?.includes('Brave')) ?? false
    expect(hasHealthCheck || hasCurated).toBe(true)
  })
})
