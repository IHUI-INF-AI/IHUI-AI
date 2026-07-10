/**
 * AI 面板 embedded 模式 - 标题栏不溢出父容器回归测试 (2026-07-01)
 *
 * 防回归目标：AIChat.vue 中 .floating-chat-dialog .dialog-header 的浮窗专属样式
 *   width: calc(100% + 16px);
 *   margin: -8px -8px 0 -8px;
 * 是为抵消浮窗 .floating-chat-dialog 的 8px*2 padding 让标题栏贴边设计。
 * 但在 embedded 模式下，_sidebar-layout.scss 已把 .floating-chat-dialog.is-embedded
 * 的 padding 显式设为 0，这个负 margin 反而把标题栏推出父容器 16px（左侧 -8px、右侧 +8px），
 * 与 ai-side-panel (#6a6d77 暗色背景) 形成视觉错位。
 *
 * 修复：AIChat.vue 在 .dialog-header 浮窗规则后追加
 *   &.is-embedded .dialog-header { width: 100%; margin: 0; border-radius: 0; }
 * 强制 embedded 模式重置为标准 100% 宽，不再溢出。
 *
 * 验证项（多轨）：
 * 1) 源码级：AIChat.vue 必须含 &.is-embedded .dialog-header { width: 100%; margin: 0; } 覆盖
 * 2) 浏览器级（亮色）：embedded 模式下 dialog-header.x == dialog.x、right == dialog.right
 * 3) 浏览器级（暗色）：同上
 * 4) 浏览器级（窄面板 280px）：即使父容器被拖窄到 280px，header 也不溢出
 * 5) 浏览器级（窄面板 320px 即默认最小宽度）：边界值
 * 6) computed style 守门：header.margin 必须为 0px、header.width 必须等于父容器
 *
 * CI 入口：npm run e2e / npx playwright test ai-panel-header-no-overflow.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8888'

/**
 * 进入 AI 面板 embedded 模式（非空态，AIChat 已挂载）
 * localStorage：
 *   - ai-panel-open=true：面板打开
 *   - ai-panel-entered=true：工作区已进入（不是空态）
 */
async function gotoAiPanelEmbedded(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('ai-panel-open', 'true')
    localStorage.setItem('ai-panel-entered', 'true')
  })
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
  // 等面板可见 + AIChat 已挂载
  await page.waitForSelector('.ai-side-panel.is-open', { state: 'visible', timeout: 15000 })
  await page.waitForSelector('.floating-chat-dialog.is-embedded', { state: 'visible', timeout: 15000 })
  await page.waitForSelector('.floating-chat-dialog.is-embedded .dialog-header', { state: 'visible', timeout: 15000 })
  // 等 CSS 变量 + scoped style 完全应用
  await page.waitForTimeout(500)
}

/**
 * 实测 dialog 与 header 的几何关系 + computed style
 */
async function measureOverflow(page: Page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('.floating-chat-dialog.is-embedded') as HTMLElement | null
    const header = dialog?.querySelector('.dialog-header') as HTMLElement | null
    if (!dialog || !header) return null
    const dr = dialog.getBoundingClientRect()
    const hr = header.getBoundingClientRect()
    const dcs = getComputedStyle(dialog)
    const hcs = getComputedStyle(header)
    return {
      // 几何
      dialog: { x: dr.x, w: dr.width, right: dr.right, paddingLeft: dcs.paddingLeft, paddingRight: dcs.paddingRight },
      header: { x: hr.x, w: hr.width, right: hr.right },
      // 溢出量
      overflowLeft: hr.x - dr.x,
      overflowRight: dr.right - hr.right,
      // computed style
      headerWidth: hcs.width,
      headerMargin: hcs.margin,
      headerBoxSizing: hcs.boxSizing,
      headerMinWidth: hcs.minWidth,
      headerBorderRadius: hcs.borderRadius,
      headerDisplay: hcs.display,
    }
  })
}

test.describe('AI 面板 embedded 模式标题栏无溢出 (2026-07-01)', () => {
  // ===================================================================
  // 1) 源码级：AIChat.vue 必须含 is-embedded 覆盖规则
  // ===================================================================
  test('源码级：AIChat.vue 必须含 &.is-embedded .dialog-header 覆盖', () => {
    const src = readFileSync(join(ROOT, 'src/components/ai/AIChat.vue'), 'utf8')

    // 必须有 is-embedded 覆盖选择器（精确锚点：同一 {} 块内）
    expect(
      src,
      'AIChat.vue 缺少 "&.is-embedded .dialog-header" 覆盖规则。\n' +
        '应在 .floating-chat-dialog .dialog-header 浮窗规则后追加：\n' +
        '  &.is-embedded .dialog-header { width: 100%; margin: 0; border-radius: 0; }\n' +
        '否则 embedded 模式会被浮窗的 width:calc(100% + 16px) / margin:-8px 负 margin 反向推出父容器 16px。'
    ).toMatch(/&\.is-embedded\s+\.dialog-header\s*\{[^}]*width:\s*100%[^}]*margin:\s*0/)

    // 块内必须显式重置 border-radius
    expect(
      src,
      'AIChat.vue 中 &.is-embedded .dialog-header 块内必须 border-radius: 0 重置浮窗专属圆角'
    ).toMatch(/&\.is-embedded\s+\.dialog-header\s*\{[^}]*border-radius:\s*0/)
  })

  // ===================================================================
  // 1b) 源码级：AIChat.vue 必须用 --fcd-padding 变量驱动反向贴边
  // ===================================================================
  test('源码级：AIChat.vue 必须用 --fcd-padding 变量统一管理 padding/反向 margin', () => {
    const src = readFileSync(join(ROOT, 'src/components/ai/AIChat.vue'), 'utf8')

    // .floating-chat-dialog 必须定义 --fcd-padding: 8px 基础值
    expect(
      src,
      'AIChat.vue 中 .floating-chat-dialog 必须定义 --fcd-padding: 8px 基础值。\n' +
        '改 padding 时只改 --fcd-padding，标题栏自动跟随。'
    ).toMatch(/\.floating-chat-dialog\s*\{[^}]*--fcd-padding:\s*8px/)

    // .floating-chat-dialog 必须用 var(--fcd-padding) 作为 padding 值
    expect(
      src,
      'AIChat.vue 中 .floating-chat-dialog padding 必须用 var(--fcd-padding) 而非硬编码 8px。\n' +
        '这样 embedded 模式 --fcd-padding: 0 重置时 padding 自动归零。'
    ).toMatch(/\.floating-chat-dialog\s*\{[^}]*padding:\s*var\(--fcd-padding\)/)

    // .dialog-header 必须用 var(--fcd-padding) 计算 width 和 margin
    expect(
      src,
      'AIChat.vue 中 .dialog-header width/margin 必须通过 var(--fcd-padding) 计算而非硬编码 16px/-8px。\n' +
        '否则 --fcd-padding 重置为 0 时反向贴边仍按 16px 算，会继续溢出。'
    ).toMatch(/\.dialog-header\s*\{[^}]*width:\s*calc\(100%\s*\+\s*var\(--fcd-padding\)\s*\*\s*2\)/)
    expect(
      src,
      'AIChat.vue 中 .dialog-header margin 必须使用 calc(-1 * var(--fcd-padding))'
    ).toMatch(/\.dialog-header\s*\{[^}]*margin:\s*calc\(-1\s*\*\s*var\(--fcd-padding\)\)/)

    // &.is-embedded 必须显式重置 --fcd-padding 为 0
    expect(
      src,
      'AIChat.vue 中 &.is-embedded 必须重置 --fcd-padding: 0。\n' +
        '这是让标题栏在 embedded 模式自动恢复 100% 宽的核心机制。'
    ).toMatch(/&\.is-embedded\s*\{[^}]*--fcd-padding:\s*0/)
  })

  // ===================================================================
  // 2) 源码级：_sidebar-layout.scss 必须把 is-embedded padding 设为 0
  // ===================================================================
  test('源码级：_sidebar-layout.scss 必须将 .floating-chat-dialog.is-embedded padding 设为 0', () => {
    const src = readFileSync(
      join(ROOT, 'src/styles/_sidebar-layout.scss'),
      'utf8'
    )
    // 精确锚点：.floating-chat-dialog.is-embedded 块内必须含 padding: 0
    // 选择器可能是 .ai-side-panel-body .floating-chat-dialog.is-embedded 或类似
    expect(
      src,
      '_sidebar-layout.scss 缺少 .floating-chat-dialog.is-embedded { padding: 0 } 规则。' +
        '\n这是 AIChat.vue 中 is-embedded 覆盖生效的前置条件——如果父容器还有 padding，' +
        '标题栏 width:100% 会和内容 padding 一起溢出。'
    ).toMatch(/[^{}]*\.floating-chat-dialog\.is-embedded\s*\{[^}]*padding:\s*0/)
  })

  // ===================================================================
  // 3) 浏览器级：亮色模式 embedded 面板不溢出
  // ===================================================================
  test('亮色模式：embedded 面板 dialog-header x/right 严格对齐 dialog 边界', async ({ page }, testInfo) => {
    // 移动端 viewport (Pixel 5) 下 AI 面板不渲染，浏览器级测试仅在 Desktop Chrome 跑
    test.skip(testInfo.project.name === 'Mobile Chrome', 'AI 面板在移动端 viewport 不渲染，仅 Desktop Chrome 验收')
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => {
      if (m.type() !== 'error') return
      const text = m.text()
      // 过滤掉测试环境下的非业务错误：
      // - 401: 未登录用户调需鉴权 API 的预期行为，不算 bug
      // - Failed to load resource: 网络层错误，UI 渲染可能不受影响
      if (text.includes('401') || text.includes('Failed to load resource')) return
      errors.push(text)
    })

    await gotoAiPanelEmbedded(page)
    const data = await measureOverflow(page)
    expect(data, '.floating-chat-dialog.is-embedded .dialog-header 必须存在').not.toBeNull()
    const d = data!

    // 父容器 padding 必须为 0（前置条件）
    expect(
      d.dialog.paddingLeft,
      'embedded 模式下父容器 .floating-chat-dialog padding-left 必须为 0'
    ).toBe('0px')
    expect(d.dialog.paddingRight, 'embedded 模式下父容器 padding-right 必须为 0').toBe('0px')

    // 几何对齐
    expect(d.overflowLeft, 'header.x 不应超出 dialog.x（左侧）').toBeLessThanOrEqual(0.5)
    expect(d.overflowRight, 'header.right 不应超出 dialog.right（右侧）').toBeGreaterThanOrEqual(-0.5)
    expect(d.header.w, 'header.width 必须等于 dialog.width').toBeCloseTo(d.dialog.w, 0)

    // computed style 守门
    expect(d.headerMargin, 'header.margin 必须为 0（不允许 -8px 负 margin）').toBe('0px')
    expect(d.headerBoxSizing, 'header.box-sizing 必须为 border-box').toBe('border-box')
    expect(d.headerDisplay, 'header.display 必须为 flex').toBe('flex')

    // 浮窗专属 border-radius 必须被重置（embedded 模式贴齐面板顶边，不需要圆角）
    expect(d.headerBorderRadius, 'embedded 模式 header.border-top-radius 应为 0').toBe('0px')

    // CSS 变量 --fcd-padding 在 embedded 模式下必须为 0
    // 注意：CSS 自定义属性 --foo: 0 不带单位时，getPropertyValue 返回 "0"；
    // 用在 padding/width 等上下文里才补单位。两种写法都算 0。
    const fcdPadding = await page.evaluate(() => {
      const dialog = document.querySelector('.floating-chat-dialog.is-embedded') as HTMLElement | null
      if (!dialog) return null
      return getComputedStyle(dialog).getPropertyValue('--fcd-padding').trim()
    })
    expect(
      fcdPadding === '0' || fcdPadding === '0px',
      `embedded 模式 .floating-chat-dialog.is-embedded 的 --fcd-padding CSS 变量必须为 0。\n` +
        `实际值: "${fcdPadding}"。\n` +
        '这是让标题栏自动恢复 100% 宽的核心机制。'
    ).toBe(true)
    // 进一步验证 padding computed style 实际是 0px
    expect(
      d.dialog.paddingLeft,
      'embedded 模式父容器 .floating-chat-dialog padding-left 必须为 0（CSS 变量实际生效）'
    ).toBe('0px')

    expect(errors, `页面有 JS 错误: ${errors.join('; ')}`).toEqual([])
  })

  // ===================================================================
  // 4) 浏览器级：暗色模式同样不溢出
  // ===================================================================
  test('暗色模式：embedded 面板 dialog-header 同样不溢出', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'Mobile Chrome', 'AI 面板在移动端 viewport 不渲染')
    await page.addInitScript(() => {
      localStorage.setItem('ihui-theme', 'dark')
    })
    await gotoAiPanelEmbedded(page)

    // 切到暗色
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    await page.waitForTimeout(300)

    const data = await measureOverflow(page)
    expect(data).not.toBeNull()
    const d = data!

    expect(d.overflowLeft, '暗色模式 header.x 不应超出 dialog.x').toBeLessThanOrEqual(0.5)
    expect(d.overflowRight, '暗色模式 header.right 不应超出 dialog.right').toBeGreaterThanOrEqual(-0.5)
    expect(d.header.w).toBeCloseTo(d.dialog.w, 0)
    expect(d.headerMargin).toBe('0px')
  })

  // ===================================================================
  // 5) 浏览器级：中等宽度面板（500px）也不溢出
  // ===================================================================
  // 注：panel 受 --ai-panel-min-width: 320px 约束，物理上无法缩到 280px。
  // 这里测 500px（用户拖动调整到中间宽度的典型场景）确认 header 仍精准对齐。
  test('中等面板 (500px)：header 仍严格对齐 dialog 边界', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'Mobile Chrome', 'AI 面板在移动端 viewport 不渲染')
    await gotoAiPanelEmbedded(page)

    // 强制改 panel 的内联 style="--ai-panel-width: 500px"
    // 注意：panel 自身的内联 style 会覆盖 :root 上的 CSS 变量，所以必须改 panel 自己
    await page.evaluate(() => {
      const panel = document.querySelector('.ai-side-panel') as HTMLElement | null
      if (panel) panel.style.setProperty('--ai-panel-width', '500px')
    })
    await page.waitForTimeout(300)

    const data = await measureOverflow(page)
    expect(data).not.toBeNull()
    const d = data!

    // 父容器应该已经扩到 ~500px
    expect(d.dialog.w, '强制 --ai-panel-width=500px 后 dialog 宽度应约 500px').toBeGreaterThanOrEqual(495)
    expect(d.dialog.w).toBeLessThanOrEqual(505)

    // header 仍要对齐
    expect(d.overflowLeft, '500px 中等面板 header.x 仍不应超出 dialog.x').toBeLessThanOrEqual(0.5)
    expect(d.overflowRight, '500px 中等面板 header.right 仍不应超出 dialog.right').toBeGreaterThanOrEqual(-0.5)
    expect(d.header.w).toBeCloseTo(d.dialog.w, 0)
  })

  // ===================================================================
  // 5b) 浏览器级：最窄边界（320px = --ai-panel-min-width 实际可达到值）
  // ===================================================================
  test('最窄边界 (320px)：header 仍严格对齐 dialog 边界', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'Mobile Chrome', 'AI 面板在移动端 viewport 不渲染')
    await gotoAiPanelEmbedded(page)

    // 强制把 --ai-panel-width 设为 280px，但 panel min-width: 320px 会将其夹到 320px
    // 验证即使在 min-width 边界（panel 可达到的最窄值），header 也不溢出
    await page.evaluate(() => {
      const panel = document.querySelector('.ai-side-panel') as HTMLElement | null
      if (panel) panel.style.setProperty('--ai-panel-width', '280px')
    })
    await page.waitForTimeout(300)

    const data = await measureOverflow(page)
    expect(data).not.toBeNull()
    const d = data!

    // 受 min-width: 320px 约束，dialog 应被夹到 320px
    expect(d.dialog.w, '--ai-panel-width=280px 但 min-width:320px 应夹到 320px').toBe(320)

    // header 仍要对齐
    expect(d.overflowLeft, '320px min-width 边界 header.x 不应超出 dialog.x').toBeLessThanOrEqual(0.5)
    expect(d.overflowRight, '320px min-width 边界 header.right 不应超出 dialog.right').toBeGreaterThanOrEqual(-0.5)
    expect(d.header.w).toBeCloseTo(d.dialog.w, 0)
  })

  // ===================================================================
  // 6) 浏览器级：默认最小宽度 320px 边界
  // ===================================================================
  test('默认 320px 边界：header 对齐 dialog 边界', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'Mobile Chrome', 'AI 面板在移动端 viewport 不渲染')
    await gotoAiPanelEmbedded(page)

    const data = await measureOverflow(page)
    expect(data).not.toBeNull()
    const d = data!

    // 默认 ai-panel-min-width 是 320px
    expect(d.dialog.w, '默认状态下 dialog 宽度应 ≥ 320px（--ai-panel-min-width）').toBeGreaterThanOrEqual(320)

    expect(d.overflowLeft).toBeLessThanOrEqual(0.5)
    expect(d.overflowRight).toBeGreaterThanOrEqual(-0.5)
    expect(d.header.w).toBeCloseTo(d.dialog.w, 0)
    expect(d.headerMargin).toBe('0px')
  })

  // ===================================================================
  // 7) 浏览器级：中等面板下 header-right 3 个按钮全部在 dialog 边界内
  // ===================================================================
  test('中等面板 (500px)：header-right 3 个按钮全部在 dialog 边界内', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'Mobile Chrome', 'AI 面板在移动端 viewport 不渲染')
    await gotoAiPanelEmbedded(page)

    await page.evaluate(() => {
      const panel = document.querySelector('.ai-side-panel') as HTMLElement | null
      if (panel) panel.style.setProperty('--ai-panel-width', '500px')
    })
    await page.waitForTimeout(300)

    const result = await page.evaluate(() => {
      const dialog = document.querySelector('.floating-chat-dialog.is-embedded') as HTMLElement | null
      const right = dialog?.querySelector('.dialog-header .header-right') as HTMLElement | null
      if (!dialog || !right) return null
      const dr = dialog.getBoundingClientRect()
      const rr = right.getBoundingClientRect()
      return { dialogRight: dr.right, headerRightRight: rr.right, overflow: rr.right - dr.right }
    })
    expect(result).not.toBeNull()
    const r = result!
    // 允许 0.5px sub-pixel 误差，不允许溢出
    expect(
      r.overflow,
      `header-right.right (${r.headerRightRight}) 不应超出 dialog.right (${r.dialogRight})`
    ).toBeLessThanOrEqual(0.5)
  })
})
