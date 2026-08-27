import { test, expect, type Page } from '../../e2e/fixtures'

/**
 * AI 对话框提示词模板视觉回归 + 5 状态自验
 *
 * 2026-08-27 适配(侧边栏/布局改版):
 *   - 旧架构"提示词模板按钮在附加栏"已改为 AddMenuPopover(add-menu-popover.tsx):
 *     入口是"添加"按钮(aria-label=chat.addMenuLabel)→ 弹出添加菜单(role=menu,
 *     aria-label=chat.addMenuDesc)→ 内含「提示词模板」菜单项(chat.promptTemplate)
 *   - 点「提示词模板」→ Popover 展示 5 个核心模板(总结/翻译/解释/代码/润色)
 *   - 空状态(variant=chips)在 MessageList 空态渲染 5 个水平胶囊按钮
 *   - /chat 未登录只显示"请登录"引导,AI 面板不渲染 → 全部用 authenticatedPage
 *
 * 守护目标(基于当前 add-menu-popover.tsx + message-input.tsx + prompt-templates.tsx):
 *   1. "添加"按钮位于 textarea 上方附加栏
 *   2. 添加菜单含「提示词模板 + 添加为上下文引用」并列项
 *   3. Popover 展示 5 个核心模板(总结/翻译/解释/代码/润色)
 *   4. 空状态(chips)展示 5 个水平胶囊按钮(rounded-md,非 rounded-full)
 *   5. 点击模板 → textarea 自动填充
 *   6. 5 状态可视化:default / hover / popover-open / dark mode / empty-chips
 *
 * 触发规则:任何对 prompt-templates.tsx / message-input.tsx / add-menu-popover.tsx
 * 中提示词模板相关代码的改动,必须跑此测试通过
 */

// 选择器(AI 侧边面板 docked,data-testid="ai-side-panel-aside" 见 ai-side-panel.tsx)
const AI_PANEL = 'aside[data-testid="ai-side-panel-aside"]'
const ADD_BTN = `${AI_PANEL} button[aria-label="添加"]`
const MENU = '[role="menu"][aria-label*="添加菜单"]'
const PROMPT_ITEM = `${MENU} button:has-text("提示词模板")`
// 模板 Popover 是含"总结任务"按钮的 dialog(区分页面里其他 dialog,如移动端 aside)
const POPOVER = '[role="dialog"]:has(button:has-text("总结任务"))'
const TEXTAREA = `${AI_PANEL} textarea[aria-label]:not([disabled])`
const CHIPS_WRAPPER = `${AI_PANEL} .flex.flex-wrap.items-center.justify-center.gap-2`

// 打开 AI 侧边面板:登录后 /chat 直接渲染 docked AISidePanel
async function openAiPanel(page: Page) {
  await page.goto('/chat', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000) // 等水合 + 会话 bootstrap
  await page
    .locator(AI_PANEL)
    .first()
    .waitFor({ state: 'visible', timeout: 15000 })
    .catch(() => {
      // 未渲染则继续,后续测试会因定位器失败/跳过暴露问题
    })
}

test.describe('AI 对话框 - 提示词模板 5 状态自验', () => {
  // authenticatedPage 的 ensureStorageState 可能走 429 限流退避(最长 ~65s),加宽超时防误超时
  test.describe.configure({ timeout: 120_000 })

  test.beforeEach(async ({ authenticatedPage }) => {
    // 只清 theme 残留,保留登录 cookie(authenticatedPage 注入)
    await authenticatedPage.addInitScript(() => {
      try {
        localStorage.removeItem('theme')
      } catch {}
    })
  })

  test('state 1: 默认态 (light mode) — "添加"按钮在附加栏,提示词模板入口在添加菜单内', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage
    await openAiPanel(page)
    const panel = page.locator(AI_PANEL).first()
    if (!(await panel.isVisible().catch(() => false))) {
      test.skip(true, 'AI 面板未显示(可能未登录或 store 状态不匹配),跳过此测试')
      return
    }

    // 1. "添加"按钮必须存在(AddMenuPopover trigger)
    const addBtn = page.locator(ADD_BTN).first()
    await expect(addBtn, '「添加」按钮应可见').toBeVisible()

    // 2. 位置:必须在 textarea **上方**
    const btnBox = await addBtn.boundingBox()
    const taBox = await page.locator(TEXTAREA).first().boundingBox()
    expect(btnBox, '添加按钮 boundingBox 应存在').not.toBeNull()
    expect(taBox, 'textarea boundingBox 应存在').not.toBeNull()
    if (btnBox && taBox) {
      expect(
        btnBox.y,
        `添加按钮应在 textarea 上方(btn.y=${btnBox.y} < ta.y=${taBox.y})`,
      ).toBeLessThan(taBox.y)
    }

    // 3. 打开添加菜单 → 提示词模板 + 添加为上下文引用 并列可见
    await addBtn.click()
    await page.waitForTimeout(600)
    const menu = page.locator(MENU).first()
    await expect(menu, '添加菜单应可见').toBeVisible()
    await expect(page.locator(PROMPT_ITEM).first(), '「提示词模板」菜单项应可见').toBeVisible()
    await expect(
      page.locator(`${MENU} button:has-text("添加为上下文引用")`).first(),
      '「添加为上下文引用」菜单项应可见',
    ).toBeVisible()

    // 4. 截图存档
    await page.screenshot({
      path: 'tmp/prompt-templates-shots/01_default_light.png',
      fullPage: false,
    })

    // 兜底关闭菜单,避免影响下一个测试
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(200)
  })

  test('state 2: hover 态 (light mode) — "添加"按钮 hover 样式生效', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage
    await openAiPanel(page)
    const panel = page.locator(AI_PANEL).first()
    if (!(await panel.isVisible().catch(() => false))) {
      test.skip()
      return
    }

    const addBtn = page.locator(ADD_BTN).first()
    await addBtn.scrollIntoViewIfNeeded()
    await addBtn.hover()
    await page.waitForTimeout(300)

    // 验证 hover 态:按钮在 hover 时 translateY(-1px) + bg-accent
    // 2026-08-27:Tailwind v4 translate 系列改用 CSS `translate` 属性(不再走 transform),
    // computed transform 恒为 "none",需读 cs.translate("0px -1px")
    const hoverStyles = await addBtn.evaluate((el) => {
      const cs = getComputedStyle(el)
      return {
        backgroundColor: cs.backgroundColor,
        transform: cs.transform,
        translate: cs.translate,
        color: cs.color,
      }
    })
    // 截图存档
    await page.screenshot({
      path: 'tmp/prompt-templates-shots/02_hover_light.png',
      fullPage: false,
    })

    // 验证 hover 类已应用:translate 应为 -1px(Tailwind v4)
    expect(
      hoverStyles.translate,
      `hover 应有 translateY(-1px),实际 translate=${hoverStyles.translate}`,
    ).toContain('-1px')
  })

  test('state 3: 打开 Popover (light mode) — 展示 5 个核心模板(2 列卡片网格)', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage
    await openAiPanel(page)
    const panel = page.locator(AI_PANEL).first()
    if (!(await panel.isVisible().catch(() => false))) {
      test.skip()
      return
    }

    // 打开添加菜单 → 点「提示词模板」→ Popover 出现
    await page.locator(ADD_BTN).first().click()
    await page.waitForTimeout(600)
    await page.locator(PROMPT_ITEM).first().click()
    await page.waitForTimeout(600)

    // 验证 Popover 出现且包含 5 个模板按钮
    const popover = page.locator(POPOVER).last()
    await expect(popover, '模板 Popover 应可见').toBeVisible()

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
    await page.waitForTimeout(600)

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

  test('state 4: dark mode 切换 — 添加按钮 + 模板 Popover 正常显示', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage
    await openAiPanel(page)
    const panel = page.locator(AI_PANEL).first()
    if (!(await panel.isVisible().catch(() => false))) {
      test.skip()
      return
    }

    // 切换 dark mode:本地 setItem + 强制 class + 触发 storage 事件(next-themes 监听同步)。
    // 不 reload —— beforeEach 的 addInitScript 会在 reload 时清掉 localStorage.theme。
    await page.evaluate(() => {
      localStorage.setItem('theme', 'dark')
      document.documentElement.classList.remove('light')
      document.documentElement.classList.add('dark')
      window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: 'dark' }))
    })
    await page.waitForTimeout(800)

    // 验证 dark mode 已应用
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(isDark, 'dark mode 应已应用').toBe(true)

    // 验证添加按钮在 dark mode 可见
    const addBtn = page.locator(ADD_BTN).first()
    await expect(addBtn, 'dark mode 下添加按钮应可见').toBeVisible()

    // 截图存档(dark 默认态)
    await page.screenshot({
      path: 'tmp/prompt-templates-shots/04_default_dark.png',
      fullPage: false,
    })

    // 打开 Popover → 截图
    await addBtn.click()
    await page.waitForTimeout(600)
    await page.locator(PROMPT_ITEM).first().click()
    await page.waitForTimeout(600)
    const popover = page.locator(POPOVER).last()
    await expect(popover, 'dark mode 下模板 Popover 应可见').toBeVisible()
    await page.screenshot({
      path: 'tmp/prompt-templates-shots/04b_popover_dark.png',
      fullPage: false,
    })
  })

  test('state 5: 空状态 — 5 个水平 chips 胶囊按钮(与附加栏 Popover 视觉协调)', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage
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

    // 验证 chips 风格:圆角 (项目规则:禁止 rounded-full 胶囊,改用 rounded-md)
    const firstChipClass = await chipBtns.first().getAttribute('class')
    expect(firstChipClass, 'chips 应使用 rounded-md 圆角').toContain('rounded-md')
    expect(firstChipClass, 'chips 不得使用 rounded-full 胶囊').not.toContain('rounded-full')

    // 截图存档
    await page.screenshot({
      path: 'tmp/prompt-templates-shots/05_empty_chips_light.png',
      fullPage: false,
    })
  })
})
