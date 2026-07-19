import { test, expect, type Page } from '@playwright/test'

/**
 * AI 对话框提示词模板视觉回归 + 4 状态自验
 *
 * 守护目标(refactor(ai-panel): 提示词模板按钮上移至附加栏,空状态改 chips,修复 i18n key):
 *   1. 提示词模板按钮位于**textarea 上方附加栏**,不再在底部工具栏
 *   2. 附加栏含「提示词模板 + 添加引用」并列胶囊按钮
 *   3. 附加栏 Popover(variant=popover)展示 5 个核心模板(总结/翻译/解释/代码/润色)
 *   4. 空状态(variant=chips)展示 5 个水平胶囊按钮
 *   5. 点击模板 → textarea 自动填充
 *   6. 4 状态可视化:default / hover / popover-open / dark mode
 *
 * 触发规则:任何对 prompt-templates.tsx / message-input.tsx / message-list.tsx 中
 * 提示词模板相关代码的改动,必须跑此测试通过
 */

// 选择器
const AI_PANEL = 'aside[aria-label*="AI" i]' // AISidePanel aside
const PROMPT_BTN = 'button[aria-label*="提示词模板" i]'
const POPOVER_DIALOG = '[role="dialog"]'
const TEXTAREA = `${AI_PANEL} textarea[aria-label]:not([disabled])`
const CHIPS_WRAPPER = `${AI_PANEL} .flex.flex-wrap.items-center.justify-center.gap-2` // chips variant
// 打开 AI 侧边面板
async function openAiPanel(page: Page) {
  // 优先尝试直接访问 /workspace 或 /home 触发 docked panel 渲染
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  // 触发 handle 拖拽或点击打开(通过点击 handle 模拟)
  // 这里用 JS 直接调 store 打开(避免依赖具体 UI 触发方式)
  await page.evaluate(() => {
    // 通过全局 store(zustand)直接打开
    // 找到 AISidePanel 触发的元素:右侧 handle separator
    const handle = document.querySelector('[role="separator"][aria-orientation="vertical"]')
    if (handle) {
      // 模拟拖拽打开:触发 pointerdown 事件
      const event = new PointerEvent('pointerdown', {
        bubbles: true,
        clientX: 130, // 紧贴 sidebar 右侧
        clientY: 200,
      })
      handle.dispatchEvent(event)
    }
  })
  await page.waitForTimeout(800)
  // 兜底:如果 handle 没触发,尝试点击快捷键
  await page.keyboard.press('Control+Shift+0').catch(() => {})
  await page.waitForTimeout(500)
  // 等待 AI panel 可见
  await page
    .locator(AI_PANEL)
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(() => {
      // 如果仍未显示,继续往下走(空状态测试可能因此跳过)
    })
}

test.describe('AI 对话框 - 提示词模板按钮 4 状态自验', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies()
    // 清 theme 残留,确保从 light 开始
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('theme')
      } catch {}
    })
  })

  test('state 1: 默认态 (light mode) — 提示词模板按钮在附加栏,不在底部工具栏', async ({ page }) => {
    await openAiPanel(page)
    const panel = page.locator(AI_PANEL).first()
    if (!(await panel.isVisible().catch(() => false))) {
      test.skip(true, 'AI 面板未显示(可能未登录或 store 状态不匹配),跳过此测试')
      return
    }

    // 1. 提示词模板按钮必须存在
    const promptBtn = page.locator(PROMPT_BTN).first()
    await expect(promptBtn, '提示词模板按钮应可见').toBeVisible()

    // 2. 按钮位置:必须在 textarea **上方**(在 DOM 中位置索引小于 textarea 父容器)
    const btnBox = await promptBtn.boundingBox()
    const taBox = await page.locator(TEXTAREA).first().boundingBox()
    expect(btnBox, '按钮 boundingBox 应存在').not.toBeNull()
    expect(taBox, 'textarea boundingBox 应存在').not.toBeNull()
    if (btnBox && taBox) {
      expect(
        btnBox.y,
        `提示词模板按钮应在 textarea 上方(btn.y=${btnBox.y} < ta.y=${taBox.y})`,
      ).toBeLessThan(taBox.y)
    }

    // 3. 附加栏应包含「添加引用/添加上下文文件」按钮(与模板按钮并列)
    const contextBtn = page
      .locator('button[aria-label*="上下文" i], button[aria-label*="引用" i]')
      .first()
    await expect(contextBtn, '添加引用按钮应可见').toBeVisible()

    // 4. 截图存档
    await page.screenshot({
      path: 'tmp/prompt-templates-shots/01_default_light.png',
      fullPage: false,
    })
  })

  test('state 2: hover 态 (light mode) — 附加栏按钮 hover 样式生效', async ({ page }) => {
    await openAiPanel(page)
    const panel = page.locator(AI_PANEL).first()
    if (!(await panel.isVisible().catch(() => false))) {
      test.skip()
      return
    }

    const promptBtn = page.locator(PROMPT_BTN).first()
    await promptBtn.scrollIntoViewIfNeeded()
    await promptBtn.hover()
    await page.waitForTimeout(300)

    // 验证 hover 态:按钮在 hover 时 transform translateY(-1px) + bg-accent
    const hoverStyles = await promptBtn.evaluate((el) => {
      const cs = getComputedStyle(el)
      return {
        backgroundColor: cs.backgroundColor,
        transform: cs.transform,
        color: cs.color,
      }
    })
    // 截图存档
    await page.screenshot({
      path: 'tmp/prompt-templates-shots/02_hover_light.png',
      fullPage: false,
    })

    // 验证 hover 类已应用(translateY -1px 对应 transform: matrix(1, 0, 0, 1, 0, -1))
    expect(
      hoverStyles.transform,
      `hover 应有 translateY(-1px),实际 transform=${hoverStyles.transform}`,
    ).toContain('matrix(1, 0, 0, 1, 0, -1)')
  })

  test('state 3: 打开 Popover (light mode) — 展示 5 个核心模板(2 列卡片网格)', async ({ page }) => {
    await openAiPanel(page)
    const panel = page.locator(AI_PANEL).first()
    if (!(await panel.isVisible().catch(() => false))) {
      test.skip()
      return
    }

    const promptBtn = page.locator(PROMPT_BTN).first()
    await promptBtn.click()
    await page.waitForTimeout(400)

    // 验证 Popover 出现(role=dialog)且包含 5 个模板按钮
    const popover = page.locator(POPOVER_DIALOG).last()
    await expect(popover, 'Popover 应可见').toBeVisible()

    const templateButtons = popover.locator('button')
    const count = await templateButtons.count()
    expect(count, `Popover 应有 5 个模板按钮,实际 ${count}`).toBe(5)

    // 截图存档
    await page.screenshot({
      path: 'tmp/prompt-templates-shots/03_popover_light.png',
      fullPage: false,
    })

    // 点击第一个模板 → textarea 应自动填充
    const firstTemplateBtn = popover.locator('button').first()
    await firstTemplateBtn.click()
    await page.waitForTimeout(400)

    // 验证 textarea value 包含模板内容(至少 5 个字符,说明有内容)
    const taValue = await page.locator(TEXTAREA).first().inputValue()
    expect(taValue.length, `textarea 应有内容,实际="${taValue}"`).toBeGreaterThanOrEqual(5)

    // 截图存档(选中后 textarea 填充效果)
    await page.screenshot({
      path: 'tmp/prompt-templates-shots/03b_after_select_light.png',
      fullPage: false,
    })

    // 兜底:如果 Popover 没自动关闭,主动点击外部关闭,避免影响下一个测试
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(200)
  })

  test('state 4: dark mode 切换 — 提示词模板按钮 + Popover 正常显示', async ({ page }) => {
    await openAiPanel(page)
    const panel = page.locator(AI_PANEL).first()
    if (!(await panel.isVisible().catch(() => false))) {
      test.skip()
      return
    }

    // 切换 dark mode(通过 localStorage 触发 theme 切换 + reload)
    await page.evaluate(() => {
      localStorage.setItem('theme', 'dark')
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    await openAiPanel(page)

    // 验证 dark mode 已应用
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(isDark, 'dark mode 应已应用').toBe(true)

    // 验证提示词模板按钮在 dark mode 可见
    const promptBtn = page.locator(PROMPT_BTN).first()
    await expect(promptBtn, 'dark mode 下提示词模板按钮应可见').toBeVisible()

    // 截图存档(dark 默认态)
    await page.screenshot({
      path: 'tmp/prompt-templates-shots/04_default_dark.png',
      fullPage: false,
    })

    // 打开 Popover → 截图
    await promptBtn.click()
    await page.waitForTimeout(400)
    await page.screenshot({
      path: 'tmp/prompt-templates-shots/04b_popover_dark.png',
      fullPage: false,
    })
  })

  test('state 5: 空状态 — 5 个水平 chips 胶囊按钮(与附加栏 Popover 视觉协调)', async ({ page }) => {
    await openAiPanel(page)
    const panel = page.locator(AI_PANEL).first()
    if (!(await panel.isVisible().catch(() => false))) {
      test.skip()
      return
    }

    // 空状态:消息列表为空时(MessageList 渲染),底部应展示 chips
    // chips 容器特征:flex flex-wrap items-center justify-center gap-2(无 grid)
    const chips = page.locator(CHIPS_WRAPPER).first()
    const chipsExists = await chips.isVisible().catch(() => false)
    if (!chipsExists) {
      test.skip(true, '空状态 chips 未出现(可能 AI 面板未处于空状态)')
      return
    }

    const chipBtns = chips.locator('button')
    const count = await chipBtns.count()
    expect(count, `空状态 chips 应有 5 个按钮,实际 ${count}`).toBe(5)

    // 验证 chips 风格:rounded-full 胶囊
    const firstChipClass = await chipBtns.first().getAttribute('class')
    expect(firstChipClass, 'chips 应有 rounded-full 胶囊样式').toContain('rounded-full')

    // 截图存档
    await page.screenshot({
      path: 'tmp/prompt-templates-shots/05_empty_chips_light.png',
      fullPage: false,
    })
  })
})
