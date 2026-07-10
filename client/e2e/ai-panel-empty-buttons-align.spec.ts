/**
 * AI 侧栏空态 - 选择模型 / 选择智能体 按钮对齐回归测试
 *
 * 防回归目标：_buttons.scss 全局规则
 *   :root .el-button:not(.hero-cta-btn)+.el-button { margin-left: 12px }
 * 在 column flex 容器中错误生效，导致第二个按钮被推右 12px。
 *
 * 防御：
 * - 任何 column flex 容器里 ≥2 个 el-button，必须打 .el-button-stack 标记
 * - 全局重置规则：:root .el-button-stack .el-button + .el-button { margin-left: 0 }
 * - 移动端断点 column flex：需在组件 SCSS 媒体查询内本地重置
 *
 * 验证项：
 * 1. 两个按钮 boundingBox.x 完全一致
 * 2. 两个按钮 width 完全一致
 * 3. 两个按钮 margin-left 均为 0（不被全局规则污染）
 * 4. 第二个按钮 relative 左偏 = 0
 * 5. 亮色 / 暗色两种主题下都通过
 */
import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8888'

async function gotoAiPanelEmpty(page: Page): Promise<void> {
  // addInitScript 在页面 JS 执行前运行，确保 useAiPanel.loadPersisted()
  // 读取到正确的 ai-panel-open / ai-panel-entered 值
  await page.addInitScript(() => {
    localStorage.setItem('ai-panel-open', 'true')
    localStorage.setItem('ai-panel-entered', 'false')
  })
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
  // .ai-side-panel 默认 display:none，.is-open 时才显示
  await page.waitForSelector('.ai-side-panel.is-open', { state: 'visible', timeout: 15000 })
  await page.waitForSelector('.ai-side-panel-empty-actions', { state: 'visible', timeout: 15000 })
  await page.waitForTimeout(500)
}

async function measureButtons(page: Page) {
  return page.evaluate(() => {
    const btns = Array.from(
      document.querySelectorAll('.ai-side-panel-empty-actions .el-button'),
    )
    if (btns.length < 2) return null
    return btns.map((b) => {
      const r = b.getBoundingClientRect()
      const cs = getComputedStyle(b)
      return {
        text: (b.textContent || '').trim(),
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        left: r.left,
        right: r.right,
        marginLeft: cs.marginLeft,
      }
    })
  })
}

test.describe('AI 侧栏空态按钮对齐', () => {
  // Mobile 视口下 AI 面板由 AIChat 浮窗接管，侧栏 .ai-side-panel 永不渲染
  // (useAiPanel.checkMobile() 强制 isOpen=false)，故只测桌面端
  test.skip(({ isMobile }) => isMobile === true, 'Mobile 视口下侧栏被浮窗接管，无 .ai-side-panel')

  test('亮色模式: 两个按钮 x/width/left/right 全部对齐, margin-left=0', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })

    await gotoAiPanelEmpty(page)
    const data = await measureButtons(page)
    expect(data, '应至少有 2 个按钮').not.toBeNull()
    const [a, b] = data!
    expect(a.text).toContain('选择模型')
    expect(b.text).toContain('选择智能体')

    // 1. x 完全一致
    expect(b.x, '第二个按钮 x 应与第一个相同').toBe(a.x)
    // 2. width 完全一致
    expect(b.w, '第二个按钮 width 应与第一个相同').toBe(a.w)
    // 3. left/right 一致
    expect(b.left).toBe(a.left)
    expect(b.right).toBe(a.right)
    // 4. margin-left 必须是 0（不被全局 12px 规则污染）
    expect(b.marginLeft, '第二个按钮 margin-left 应为 0').toBe('0px')
    expect(a.marginLeft, '第一个按钮 margin-left 也应为 0').toBe('0px')

    // 5. 没有 JS 错误
    expect(errors, `页面有错误: ${errors.join('; ')}`).toEqual([])
  })

  test('暗色模式: 两个按钮 x/width/left/right 全部对齐, margin-left=0', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ihui-theme', 'dark')
    })
    await gotoAiPanelEmpty(page)

    // 切到暗色
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    await page.waitForTimeout(300)

    const data = await measureButtons(page)
    expect(data).not.toBeNull()
    const [a, b] = data!
    expect(b.x).toBe(a.x)
    expect(b.w).toBe(a.w)
    expect(b.left).toBe(a.left)
    expect(b.right).toBe(a.right)
    expect(b.marginLeft).toBe('0px')
    expect(a.marginLeft).toBe('0px')
  })

  test('el-button-stack 标记必须存在（防遗漏打标）', async ({ page }) => {
    await gotoAiPanelEmpty(page)
    const has = await page.evaluate(() => {
      const el = document.querySelector('.ai-side-panel-empty-actions')
      return el ? el.classList.contains('el-button-stack') : false
    })
    expect(has, '.ai-side-panel-empty-actions 必须有 .el-button-stack class').toBe(true)
  })

  test('全局重置规则必须存在（防 _buttons.scss 规则被误删）', async ({ page }) => {
    await gotoAiPanelEmpty(page)
    const ruleExists = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          const rules = sheet.cssRules || sheet.rules
          if (!rules) continue
          for (const rule of rules) {
            const text = rule.cssText || ''
            if (
              text.includes('el-button-stack') &&
              text.includes('margin-left') &&
              text.includes('0')
            ) {
              return true
            }
          }
        } catch {
          // CORS blocked
        }
      }
      return false
    })
    expect(ruleExists, '_buttons.scss 中 .el-button-stack 重置规则必须存在').toBe(true)
  })
})
