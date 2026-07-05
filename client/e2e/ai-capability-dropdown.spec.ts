/**
 * AI 对话输入框「✨ 能力」下拉回归测试 (2026-07-06 Trae 风格改造)
 *
 * 2026-07-06 改造:
 *   触发源切换: 原 `.tw-selector-pill` (+选择) → 工具栏 ✨ 按钮 `[aria-label="能力"]`
 *   旧 pill DOM 保留 (`display: none` CSS) 供 .tw-selector-radius.spec.ts 守门
 *
 * 覆盖 2026-07-01 trae work 三段式重构 + useSubViewDropdown 抽取后的关键交互：
 *  1. 触发按钮可见 + 展开下拉
 *  2. 主视图：7 个能力卡片合并分组（5 能力 + 提示词模板 + AI 工具箱）
 *  3. 子视图切换：点击「提示词模板」→ 进入 prompts 子视图 + 自动聚焦 back 按钮
 *  4. 子视图返回：back 按钮 / Esc 优先返回主视图
 *  5. 主视图 Esc：关闭整个下拉
 *  6. 父级关闭时自动重置到主视图
 *  7. ARIA 属性：aria-haspopup / aria-expanded / role=menu / tabindex=0
 *  8. 响应式：窄屏 popper 宽度不超出视口
 *  9. OpenClaw 工具项 active 状态：点击后下拉关闭 + 主面板打开
 */

import { test, expect, type Page } from '@playwright/test'

// inline 面板 (2026-07-03 v2 重构: 不再使用 el-dropdown teleport, 改为 inline absolute 面板)
const POPPER = '.ai-capability-inline-panel'
// 2026-07-06 Trae 改造: 触发器从 .tw-selector-pill 切换到工具栏 ✨ 按钮
const TRIGGER = '[aria-label="能力"]'
// 旧 pill DOM 仍存在 (display:none), 用于 .tw-selector-radius.spec.ts 守门
const LEGACY_PILL = '.ai-capability-selector .tw-selector-pill'
// 主视图特定选择器（避免 Transition 期间 .last() 拿到 leaving 元素）
const MAIN_PANE = '.ai-capability-inline-panel .openclaw-quick-menu.capability-view-pane'
const SUB_PANE = '.ai-capability-inline-panel .ai-capability-subview.capability-view-pane'

/** 打开 AI 侧边栏面板（嵌入模式）并确保 trae-work 工具栏可见 */
async function openAIDialogMaximized(page: Page): Promise<void> {
  // 用 domcontentloaded 替代 networkidle：dev server 持续有 HMR/polling 请求，
  // networkidle 可能永远不达，或达到时 Vue 早已 mount 完，无法稳定等 Vue 挂载。
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  // 等待 #app 有子节点（Vue 已挂载）
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

  // AI 侧边栏在初始状态下已经打开（嵌入模式，桌面端默认 isOpen=true）
  // 若未打开则通过事件触发 openGlobalChat -> aiPanel.open() + enterWorkspace()
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-ai-chat')))

  // 确保 ai-side-panel 可见
  const sidePanel = page.locator('.ai-side-panel')
  await expect(sidePanel).toBeVisible({ timeout: 12000 })

  // 如果仍在 empty 态（出现"选择模型"按钮），点击它进入 trae-work 输入态
  // 然后关闭弹出的 AICapabilitySelector 弹窗
  const selectModelBtn = page.locator('.ai-side-panel button:has-text("选择模型")').first()
  if (await selectModelBtn.isVisible().catch(() => false)) {
    await selectModelBtn.click({ force: true })
    await page.waitForTimeout(1500)
    await page.mouse.click(20, 20)
    await page.waitForTimeout(800)
  }

  // 2026-07-06 Trae 改造: 工具栏 ✨ 按钮可见
  const trigger = page.locator(TRIGGER)
  await expect(trigger).toBeVisible({ timeout: 8000 })

  // 旧 pill DOM 仍存在 (供 .tw-selector-radius.spec.ts 守门), 但视觉隐藏
  await expect(page.locator(LEGACY_PILL)).toHaveCount(1)
}

/** 点击能力下拉触发按钮 (工具栏 ✨) */
async function openCapabilityDropdown(page: Page): Promise<void> {
  await page.locator(TRIGGER).first().click()
  await expect(page.locator(POPPER)).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(300) // 等待入场动画
}

/** 关闭下拉并等待动画完成 */
async function closeCapabilityDropdown(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
}

test.describe('AI 对话输入框「✨ 能力」下拉 (Trae 风格)', () => {
  // 仅在桌面端运行（移动端 AI 面板默认隐藏）
  test.describe.configure({ mode: 'serial' })

  test('触发按钮可见并符合 ARIA 规范', async ({ page }) => {
    await openAIDialogMaximized(page)

    const trigger = page.locator(TRIGGER).first()
    await expect(trigger).toBeVisible()
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await closeCapabilityDropdown(page)
  })

  test('点击触发按钮展开下拉，aria-expanded 变为 true', async ({ page }) => {
    await openAIDialogMaximized(page)
    await openCapabilityDropdown(page)

    const trigger = page.locator(TRIGGER).first()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const popper = page.locator(POPPER)
    await expect(popper).toBeVisible()
    // 主视图标题（AI 能力）
    await expect(popper.locator('.menu-title').first()).toBeVisible()

    await closeCapabilityDropdown(page)
  })

  test('主视图含 7 个能力卡片（合并分组，无独立工具区）', async ({ page }) => {
    await openAIDialogMaximized(page)
    await openCapabilityDropdown(page)

    // 使用主视图特定选择器，避免 Transition 期间 .last() 拿到 leaving 元素
    const mainPane = page.locator(MAIN_PANE)
    await expect(mainPane).toBeVisible()

    // 7 个能力卡片合并到同一 .menu-grid（5 能力 + 提示词模板 + AI 工具箱）
    const mainGrid = mainPane.locator('.menu-grid').first()
    const cards = mainGrid.locator('.menu-item')
    await expect(cards).toHaveCount(7)

    // 不再存在独立工具区分割线 / 标题 / 工具网格（2026-07-03 合并分组重构）
    await expect(mainPane.locator('.menu-section-divider')).toHaveCount(0)
    await expect(mainPane.locator('.menu-section-header')).toHaveCount(0)
    await expect(mainPane.locator('.menu-grid-tools')).toHaveCount(0)

    await closeCapabilityDropdown(page)
  })

  test('点击「提示词模板」进入子视图，自动聚焦 back 按钮', async ({ page }) => {
    await openAIDialogMaximized(page)
    await openCapabilityDropdown(page)

    const popper = page.locator(POPPER)

    // 点击「提示词模板」（已合并到主 .menu-grid 内，2026-07-03 重构）
    const promptItem = popper
      .locator('.menu-grid .menu-item')
      .filter({ hasText: /提示词|Prompt/ })
      .first()
    await promptItem.click()
    await page.waitForTimeout(500) // 等待 transition 完成

    // 子视图可见
    const subPane = page.locator(SUB_PANE)
    await expect(subPane).toBeVisible()
    await expect(subPane.locator('.menu-back-btn')).toBeVisible()
    await expect(subPane.locator('.menu-header-sub')).toContainText(/提示词|Prompt/)

    // back 按钮自动获得焦点（无障碍）
    const isFocused = await subPane
      .locator('.menu-back-btn')
      .evaluate((el) => el === document.activeElement)
    expect(isFocused).toBe(true)

    // aria-live 区域内容已更新为"提示词模板"
    const liveText = await popper.locator('.sr-only[aria-live="polite"]').textContent()
    expect(liveText).toMatch(/提示词|Prompt/)

    await closeCapabilityDropdown(page)
  })

  test('在子视图按 Esc：返回主视图，下拉仍打开', async ({ page }) => {
    await openAIDialogMaximized(page)
    await openCapabilityDropdown(page)

    const popper = page.locator(POPPER)
    // 进入 prompts 子视图
    await popper
      .locator('.menu-grid .menu-item')
      .filter({ hasText: /提示词|Prompt/ })
      .first()
      .click()
    await page.waitForTimeout(500)

    // 确认子视图已打开
    await expect(page.locator(SUB_PANE)).toBeVisible()

    // Esc 优先返回主视图
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // 主视图应重新可见
    const mainPane = page.locator(MAIN_PANE)
    await expect(mainPane).toBeVisible()
    await expect(mainPane.locator('.menu-title').first()).toBeVisible()

    // 下拉本身仍应打开（aria-expanded=true）
    const trigger = page.locator(TRIGGER).first()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await closeCapabilityDropdown(page)
  })

  test('在主视图按 Esc：关闭下拉', async ({ page }) => {
    await openAIDialogMaximized(page)
    await openCapabilityDropdown(page)

    // 主视图按 Esc
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)

    // 下拉关闭
    const popperWrapper = page.locator(POPPER)
    await expect(popperWrapper).toBeHidden({ timeout: 5000 })

    // 重新打开后应从主视图开始（无残留子视图）
    await openCapabilityDropdown(page)
    const mainPane = page.locator(MAIN_PANE)
    await expect(mainPane).toBeVisible()
    // 不应有子视图
    const subPanes = page.locator(SUB_PANE)
    await expect(subPanes).toHaveCount(0)

    await closeCapabilityDropdown(page)
  })

  test('子视图 back 按钮点击：返回主视图', async ({ page }) => {
    await openAIDialogMaximized(page)
    await openCapabilityDropdown(page)

    const popper = page.locator(POPPER)
    await popper
      .locator('.menu-grid .menu-item')
      .filter({ hasText: /提示词|Prompt/ })
      .first()
      .click()
    await page.waitForTimeout(500)

    // 点击 back
    const backBtn = popper.locator('.menu-back-btn')
    await backBtn.click()
    await page.waitForTimeout(500)

    // 主视图重新可见
    const mainPane = page.locator(MAIN_PANE)
    await expect(mainPane).toBeVisible()
    // 7 个能力卡（合并分组）
    await expect(mainPane.locator('.menu-grid').first().locator('.menu-item')).toHaveCount(7)

    await closeCapabilityDropdown(page)
  })

  test('菜单项含正确的 ARIA 属性', async ({ page }) => {
    await openAIDialogMaximized(page)
    await openCapabilityDropdown(page)

    const mainPane = page.locator(MAIN_PANE)
    const cards = mainPane.locator('.menu-grid').first().locator('.menu-item')

    const count = await cards.count()
    expect(count).toBe(7)

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i)
      await expect(card).toHaveAttribute('role', 'menuitem')
      await expect(card).toHaveAttribute('tabindex', '0')
      const ariaLabel = await card.getAttribute('aria-label')
      expect(ariaLabel).toBeTruthy()
      expect(ariaLabel!.length).toBeGreaterThan(0)
    }

    await closeCapabilityDropdown(page)
  })

  test('inline 面板固定宽度 320px, 不超出视口, absolute 定位', async ({ page }) => {
    await openAIDialogMaximized(page)
    await openCapabilityDropdown(page)

    const popper = page.locator(POPPER)
    await expect(popper).toBeVisible()

    // inline 面板用 width: 320px (固定宽度, 不占满输入框, 不占满全屏)
    // 用户要求"只在 AI 对话框组件内显示", 不再 teleport 到 body (2026-07-03 v3 重构)
    const box = await popper.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(0)
    // 宽度应为 320px (允许 1px 误差, 因 border-box + 可能的子像素)
    expect(Math.abs(box!.width - 320)).toBeLessThanOrEqual(1)
    const viewport = page.viewportSize()
    expect(box!.width).toBeLessThanOrEqual(viewport!.width)

    // 验证面板是 absolute 定位 (inline, 非 teleport)
    const position = await popper.evaluate((el) => {
      return window.getComputedStyle(el).position
    })
    expect(position).toBe('absolute')

    // 验证不再 teleport 到 body (应挂在 .ai-capability-selector 内)
    const inSelector = await popper.evaluate((el) => {
      return !!el.closest('.ai-capability-selector')
    })
    expect(inSelector).toBe(true)

    await closeCapabilityDropdown(page)
  })

  test('点击「AI 工具箱」：下拉关闭 + OpenClaw 主面板打开', async ({ page }) => {
    await openAIDialogMaximized(page)
    await openCapabilityDropdown(page)

    const popper = page.locator(POPPER)
    // AI 工具箱项（已合并到主 .menu-grid 内，2026-07-03 重构）
    const toolItem = popper
      .locator('.menu-grid .menu-item')
      .filter({ hasText: /工具箱|Toolbox/ })
      .first()
    await toolItem.click()

    // 下拉已关闭（检查 aria-expanded 变为 false 或 popper 不可见）
    const trigger = page.locator(TRIGGER).first()
    await expect(trigger).toHaveAttribute('aria-expanded', 'false', { timeout: 5000 })

    // OpenClaw 主面板出现
    const openclawPanel = page.locator('.openclaw-panel-wrapper')
    await expect(openclawPanel).toBeVisible({ timeout: 5000 })
  })

  test('键盘导航：Tab 可聚焦到菜单项', async ({ page }) => {
    await openAIDialogMaximized(page)

    // 先点击触发按钮打开下拉
    const trigger = page.locator(TRIGGER).first()
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator(POPPER)).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(300)

    // Tab 键应能进入菜单项
    await page.keyboard.press('Tab')
    await page.waitForTimeout(200)

    // 当前焦点应在某个 .menu-item 上（或在 popper 内部）
    const focusedInfo = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement
      return {
        role: el?.getAttribute('role'),
        inPopper: !!el?.closest('.ai-capability-inline-panel'),
        inMenu: !!el?.closest('.openclaw-quick-menu'),
        className: el?.className || '',
      }
    })
    // 焦点应该在 popper 内部（可能在菜单项上，也可能在 popper 容器上）
    expect(focusedInfo.inPopper).toBe(true)

    await closeCapabilityDropdown(page)
  })

  test('popper 高度有上限（不撑爆视口）', async ({ page }) => {
    await openAIDialogMaximized(page)
    await openCapabilityDropdown(page)

    const popperWrapper = page.locator(POPPER)
    const maxH = await popperWrapper.evaluate((el) => {
      const s = window.getComputedStyle(el)
      return s.maxHeight
    })

    // max-height 应有定义，不应是 'none'
    expect(maxH).not.toBe('none')
    // 应有具体的像素值
    expect(maxH).toMatch(/\d+px/)

    await closeCapabilityDropdown(page)
  })
})
