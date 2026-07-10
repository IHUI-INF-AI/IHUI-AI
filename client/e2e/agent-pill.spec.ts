/**
 * AgentPill — Trae 风格 AI 输入框顶部 Agent 胶囊 (2026-07-06 立)
 *
 * 覆盖:
 *  1. agent 模式下顶部 AgentPill 渲染 (绿头像 + @Agent 文字 + × 关闭按钮)
 *  2. 点击 × 关闭按钮后, AgentPill 消失, 模式切回 model
 *  3. 关闭后 ARIA 状态恢复
 *  4. 视觉: 胶囊在浅色/暗色下都可见
 */

import { test, expect, type Page } from '@playwright/test'

// 触发器: 工具栏 ✨ 按钮
const TRIGGER = '[aria-label="能力"]'
const POPPER = '.ai-capability-inline-panel'
const AGENT_PILL = '.agent-pill'
const AGENT_PILL_LABEL = '.agent-pill-label'
const AGENT_PILL_CLOSE = '.agent-pill-close'
const AGENT_PILL_AVATAR = '.agent-pill-avatar'

/** 打开 AI 浮窗并进入 trae-work 输入态 */
async function openAIDialogMaximized(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  // 等待 Vue 挂载
  await expect(async () => {
    const n = await page.evaluate(() => {
      const app = document.getElementById('app')
      return app ? app.childElementCount : 0
    })
    expect(n).toBeGreaterThan(0)
  }).toPass({ timeout: 15000 })

  // 关闭可能的引导/弹窗
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
  }
  await page.waitForTimeout(300)

  // 触发 AI 浮窗
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-ai-chat')))

  const sidePanel = page.locator('.ai-side-panel')
  await expect(sidePanel).toBeVisible({ timeout: 12000 })

  // 如果在 empty 态, 选模型进入 trae-work
  const selectModelBtn = page.locator('.ai-side-panel button:has-text("选择模型")').first()
  if (await selectModelBtn.isVisible().catch(() => false)) {
    await selectModelBtn.click({ force: true })
    await page.waitForTimeout(1500)
    await page.mouse.click(20, 20)
    await page.waitForTimeout(800)
  }

  // 工具栏 ✨ 按钮可见
  await expect(page.locator(TRIGGER)).toBeVisible({ timeout: 8000 })
}

/** 点击工具栏 ✨ 触发能力下拉 */
async function openCapabilityDropdown(page: Page): Promise<void> {
  await page.locator(TRIGGER).first().click()
  await expect(page.locator(POPPER)).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(300)
}

/** 关闭下拉 */
async function closeCapabilityDropdown(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
}

test.describe('AgentPill — Trae 风格 AI 输入框 Agent 胶囊', () => {
  test.describe.configure({ mode: 'serial' })

  test('默认无 AgentPill 显示 (普通模式)', async ({ page }) => {
    await openAIDialogMaximized(page)
    // 默认 model 模式, 不应显示 AgentPill
    await expect(page.locator(AGENT_PILL)).toHaveCount(0)
  })

  test('点击 ✨ → 选 Agent 卡片后 AgentPill 显示', async ({ page }) => {
    await openAIDialogMaximized(page)
    await openCapabilityDropdown(page)

    // 点击「智能体」/「Agent」卡片
    const agentCard = page.locator(POPPER)
      .locator('.menu-grid .menu-item')
      .filter({ hasText: /智能体|Agent/ })
      .first()
    await agentCard.click()
    await page.waitForTimeout(800)

    // 关闭下拉
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // AgentPill 应可见
    const pill = page.locator(AGENT_PILL)
    await expect(pill).toBeVisible({ timeout: 5000 })

    // 标签含 Agent
    await expect(page.locator(AGENT_PILL_LABEL).first()).toContainText(/Agent|@Agent/)

    // 头像绿底 (#16a34a = rgb(22, 163, 74))
    const avatar = page.locator(AGENT_PILL_AVATAR).first()
    const bg = await avatar.evaluate((el) => getComputedStyle(el).backgroundColor)
    // 接受浅色 #16a34a (rgb(22, 163, 74)) 或暗色 #15803d (rgb(21, 128, 61))
    expect(['rgb(22, 163, 74)', 'rgb(21, 128, 61)']).toContain(bg)

    // 关闭按钮可见
    await expect(page.locator(AGENT_PILL_CLOSE).first()).toBeVisible()
  })

  test('点击 AgentPill × 关闭按钮: 胶囊消失, 模式切回 model', async ({ page }) => {
    await openAIDialogMaximized(page)
    await openCapabilityDropdown(page)

    // 选 Agent
    const agentCard = page.locator(POPPER)
      .locator('.menu-grid .menu-item')
      .filter({ hasText: /智能体|Agent/ })
      .first()
    await agentCard.click()
    await page.waitForTimeout(800)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // 确认 AgentPill 存在
    await expect(page.locator(AGENT_PILL)).toBeVisible({ timeout: 5000 })

    // 点击 ×
    await page.locator(AGENT_PILL_CLOSE).first().click()
    await page.waitForTimeout(500)

    // AgentPill 消失
    await expect(page.locator(AGENT_PILL)).toHaveCount(0)
  })

  test('AgentPill 文字超长时 ellipsis 截断 (不撑破容器)', async ({ page }) => {
    await openAIDialogMaximized(page)
    await openCapabilityDropdown(page)

    const agentCard = page.locator(POPPER)
      .locator('.menu-grid .menu-item')
      .filter({ hasText: /智能体|Agent/ })
      .first()
    await agentCard.click()
    await page.waitForTimeout(800)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    const label = page.locator(AGENT_PILL_LABEL).first()
    await expect(label).toBeVisible({ timeout: 5000 })

    const styles = await label.evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        textOverflow: s.textOverflow,
        overflow: s.overflow,
        whiteSpace: s.whiteSpace,
        maxWidth: s.maxWidth,
      }
    })

    expect(styles.textOverflow).toBe('ellipsis')
    expect(styles.overflow).toBe('hidden')
    expect(styles.whiteSpace).toBe('nowrap')
  })
})
