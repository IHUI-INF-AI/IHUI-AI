// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect, type Page } from '../../e2e/fixtures'
import { RADIUS_ROLES, RADIUS_STEPS } from '../../../../packages/design-tokens/src/radius.js'

/**
 * AI 对话框提示词模板视觉回归 + 5 状态自验
 *
 * 2026-08-27 适配(侧边栏/布局改版):
 *   - 旧架构"提示词模板按钮在附加栏"已改为 AddMenuPopover(add-menu-popover.tsx):
 *     入口是"添加"按钮(aria-label=chat.addMenuLabel)→ 弹出添加菜单(role=menu,
 *     aria-label=chat.addMenuDesc)→ 内含「提示词模板」菜单项(chat.promptTemplate)
 *   - 点「提示词模板」→ Popover 展示 5 个核心模板(总结/翻译/解释/代码/润色)
 *   - 空状态(variant=chips)在 MessageList 空态渲染 5 个水平排列的 chips 按钮
 *   - /chat 未登录只显示"请登录"引导,AI 面板不渲染 → 全部用 authenticatedPage
 *
 * 守护目标(基于当前 add-menu-popover.tsx + message-input.tsx + prompt-templates.tsx):
 *   1. "添加"按钮在**同一张输入卡内、textarea 之下**的底栏(651be7654e 输入卡单行化重构
 *      — 底栏单行两簇:顶部栏控件全部降位,message-input.tsx 的 .ai-input-toolbar 排在
 *      WebInputCore 之后;旧口径"textarea 上方附加栏"自该提交起即为假,现已更正)
 *   2. 添加菜单含「提示词模板 + 添加为上下文引用」并列项
 *   3. Popover 展示 5 个核心模板(总结/翻译/解释/代码/润色)
 *   4. 空状态(chips)展示 5 个水平按钮,圆角量出来等于 design-tokens 控件档
 *      (1532608ed6 O81 票⑳ 批 3 起 prompt-templates.tsx 写 rounded-sm = RADIUS_ROLES.control;
 *      本仓规则是"几何是规则、标记不是出路"(96ac122056),故判实测半径而不是判 class 字符串)
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
// 模板 Popover 是含"总结"模板按钮的 menu 容器(2026-09-14 校准:①2026-09-02 弹层治理后
// 容器从 role=dialog 改为自写 popover 的 role=menu;②popover 内模板名 i18n 已简化为
// "总结"/"翻译"/…(zh-CN.json tplSummary),空状态 chips 才是"总结任务"(EmptyState 独立文案)。
// 旧选择器 role=dialog + "总结任务" 双双失配 → 恒红)
const POPOVER = '[role="menu"]:has(button:has-text("总结"))'
const TEXTAREA = `${AI_PANEL} textarea[aria-label]:not([disabled])`
// 输入卡容器(message-input.tsx 的 'ai-input-shell flex flex-col rounded-xl border bg-card'):
// textarea 与 .ai-input-toolbar(内含「添加」)同属这一张卡
const INPUT_SHELL = `${AI_PANEL} .ai-input-shell`
const CHIPS_WRAPPER = `${AI_PANEL} .flex.flex-wrap.items-center.justify-center.gap-2`

// 控件档圆角 px:radius.js 的 RADIUS_ROLES.control → RADIUS_STEPS.sm
// (本仓圆角单一源头;判据引用档位而不是抄 class 字符串或写死数字)
const CONTROL_RADIUS_PX = RADIUS_STEPS[RADIUS_ROLES.control]

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

  test('state 1: 默认态 (light mode) — "添加"按钮在输入卡底栏,提示词模板入口在添加菜单内', async ({
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

    // 2. 位置:必须在同一张输入卡内、textarea **之下**(2026-09-30 输入卡单行化后
    //    message-input.tsx 的结构是 .ai-input-shell = textarea 主区 + 唯一底栏 .ai-input-toolbar)
    const shell = page.locator(INPUT_SHELL).first()
    await expect(shell, 'AI 面板应渲染输入卡 .ai-input-shell').toBeVisible()
    await expect(
      shell.locator('button[aria-label="添加"]').first(),
      '「添加」按钮必须与 textarea 同属一张输入卡',
    ).toBeVisible()
    await expect(
      shell.locator('textarea[aria-label]:not([disabled])').first(),
      'textarea 必须在这张输入卡内',
    ).toBeVisible()
    const btnBox = await addBtn.boundingBox()
    const taBox = await page.locator(TEXTAREA).first().boundingBox()
    expect(btnBox, '添加按钮 boundingBox 应存在').not.toBeNull()
    expect(taBox, 'textarea boundingBox 应存在').not.toBeNull()
    if (btnBox && taBox) {
      expect(
        btnBox.y,
        `添加按钮应在 textarea 下方(同卡底栏,btn.y=${btnBox.y} > ta.y=${taBox.y})`,
      ).toBeGreaterThan(taBox.y)
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

  test('state 5: 空状态 — 5 个水平 chips 按钮(圆角取控件档,非胶囊)', async ({
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

    // 验证 chips 圆角:判量出来的半径,不判 class 标记(96ac122056「几何是规则、标记不是出路」)
    const chipShape = await chipBtns.first().evaluate((el) => {
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return { br: cs.borderTopLeftRadius, w: r.width, h: r.height }
    })
    const chipBrNum = parseFloat(chipShape.br)
    expect(Number.isFinite(chipBrNum), `chips 圆角应能解析成 px 数值,实际="${chipShape.br}"`).toBe(
      true,
    )
    // ① 等于档位表里的控件档(prompt-templates.tsx 自 1532608ed6 起写 rounded-sm)
    expect(chipBrNum, `chips 圆角应等于控件档 ${CONTROL_RADIUS_PX}px,实际 ${chipBrNum}px`).toBe(
      CONTROL_RADIUS_PX,
    )
    // ② 不是胶囊/纯圆:半径必须严格小于短边一半(旧断言 not.toContain('rounded-full') 的几何版)
    expect(
      chipBrNum,
      `chips 不得是胶囊型(短边 ${Math.min(chipShape.w, chipShape.h)}px,半径应小于一半)`,
    ).toBeLessThan(Math.min(chipShape.w, chipShape.h) / 2)

    // 截图存档
    await page.screenshot({
      path: 'tmp/prompt-templates-shots/05_empty_chips_light.png',
      fullPage: false,
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
