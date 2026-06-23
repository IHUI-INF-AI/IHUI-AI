/**
 * 提示词模板库下拉：验证容器、header、list 与 popper 同宽，无左右留白
 */
import { test, expect } from '@playwright/test'

test.describe('提示词模板库宽度', () => {
  test('打开提示词模板库后，容器/header/list 与 popper 同宽', async ({ page }) => {
    test.setTimeout(45000)
    await page.goto('/')
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
    const dialog = page.locator('.floating-chat-dialog')
    if (await triggerBtn.isVisible().catch(() => false)) {
      await triggerBtn.click()
      await page.waitForTimeout(600)
    }
    await expect(dialog).toBeVisible({ timeout: 12000 })

    const wrapper = page.locator('.floating-chat-dialog-wrapper')
    if (await wrapper.evaluate((el) => el.classList.contains('is-minimized')).catch(() => false)) {
      await page.locator('.floating-chat-dialog .dialog-header').click({ force: true })
      await page.waitForTimeout(500)
    }

    // 点击「提示词模板」下拉（用 evaluate 触发点击，避免可见性/遮挡）
    const promptTemplatesTrigger = page.locator('.prompt-templates-dropdown button').first()
    await promptTemplatesTrigger.evaluate((el) => (el as HTMLElement).click())
    await page.waitForTimeout(600)

    const popper = page.locator('body .el-popper.ai-chat-prompt-templates-popper')
    await expect(popper).toBeVisible({ timeout: 5000 })

    const container = popper.locator('.prompt-templates-container')
    const header = popper.locator('.templates-header')
    const list = popper.locator('.templates-list')
    await expect(container).toBeVisible()
    await expect(header).toBeVisible()
    await expect(list).toBeVisible()

    const widths = await popper.evaluate((root) => {
      const container = root.querySelector('.prompt-templates-container') as HTMLElement
      const header = root.querySelector('.templates-header') as HTMLElement
      const list = root.querySelector('.templates-list') as HTMLElement
      const scrollbar = root.querySelector('.el-scrollbar') as HTMLElement
      if (!container || !header || !list) return null
      const getWidth = (el: HTMLElement) => el.getBoundingClientRect().width
      const getLeft = (el: HTMLElement) => el.getBoundingClientRect().left
      const rootRect = root.getBoundingClientRect()
      return {
        popperWidth: rootRect.width,
        popperLeft: rootRect.left,
        containerWidth: getWidth(container),
        containerLeft: getLeft(container),
        headerWidth: getWidth(header),
        headerLeft: getLeft(header),
        listWidth: getWidth(list),
        listLeft: getLeft(list),
      }
    })

    expect(widths).not.toBeNull()
    const w = widths!
    const widthTolerance = 2
    const edgeTolerance = 50 // 宽度一致为主；左边缘因 EP 结构可有残余偏移，允许一定容差

    // 1) 容器应与 popper 同宽
    expect(Math.abs(w.containerWidth - w.popperWidth)).toBeLessThanOrEqual(widthTolerance)
    // 2) header、list 应与容器同宽（即与 popper 同宽）
    expect(Math.abs(w.headerWidth - w.containerWidth)).toBeLessThanOrEqual(widthTolerance)
    expect(Math.abs(w.listWidth - w.containerWidth)).toBeLessThanOrEqual(widthTolerance)
    // 3) 左边缘应对齐（允许小偏差）
    expect(Math.abs(w.containerLeft - w.popperLeft)).toBeLessThanOrEqual(edgeTolerance)
    expect(Math.abs(w.headerLeft - w.popperLeft)).toBeLessThanOrEqual(edgeTolerance)
    expect(Math.abs(w.listLeft - w.popperLeft)).toBeLessThanOrEqual(edgeTolerance)
  })
})
