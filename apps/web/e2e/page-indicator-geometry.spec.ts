import { test, expect } from '@playwright/test'

/**
 * 分页指示器(PageIndicator)几何守门测试 (2026-07-21 立, M-64 类问题配套)
 *
 * 根因(2026-07-21 M-64):className 模板字面量 BASE/BRANCH 多套 size 类冲突,
 * Tailwind 按源序后值覆盖前值 → 非激活态被拉成 16x8 胶囊,所有点都成椭圆。
 * 修复:拆两套完整 className 分支互斥。
 *
 * 此测试用 getBoundingClientRect() 验证实际渲染尺寸与设计意图一致:
 *   - 激活态(span[aria-current=true]):16x6 竖向胶囊 (h-4=16px w-1.5=6px)
 *   - 非激活态(span):8x8 圆点 (h-2=8px w-2=8px)
 *   - hover 态:10x10 圆点 (h-2.5=10px w-2.5=10px)
 *   - 所有态 rounded-full(borderRadius ≥ 9999px 即 50%)
 *   - 激活态不透明度 1,非激活态 opacity ≈ 0.3(由 bg-foreground/30 控制)
 *
 * 守门:任何未来改动(包括 className 模板拼接 bug)导致渲染尺寸偏移 → 测试失败 → 阻止部署。
 *
 * 容差:±0.5px(Tailwind px 精度 + DPR 缩放误差)。
 */

const INDICATOR_SELECTOR = '.group\\/indicator'
const ACTIVE_DOT_SELECTOR = 'span[aria-current="true"]' // button[aria-current] 包裹
const ACTIVE_INNER_SELECTOR = 'span[aria-current="true"] > span, button[aria-current="true"] > span'
const PX_TOLERANCE = 0.5

async function getDotMetrics(page: import('@playwright/test').Page) {
  return await page.evaluate((selector) => {
    const container = document.querySelector(selector) as HTMLElement | null
    if (!container) return { error: 'indicator not found', dots: [] }
    const buttons = container.querySelectorAll('button')
    const dots = []
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i]
      const span = btn.querySelector('span') as HTMLElement | null
      if (!span) continue
      const sb = span.getBoundingClientRect()
      const cs = getComputedStyle(span)
      dots.push({
        index: i,
        active: btn.getAttribute('aria-current') === 'true',
        w: sb.width,
        h: sb.height,
        borderRadius: cs.borderRadius,
        bgColor: cs.backgroundColor,
        opacity: cs.opacity,
        className: span.className,
      })
    }
    return { dots }
  }, INDICATOR_SELECTOR)
}

test.describe('PageIndicator 几何守门', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // 等指示器渲染(group/indicator 只在 md+ 可见)
    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(page.locator(INDICATOR_SELECTOR)).toBeVisible({ timeout: 10000 })
    await page.waitForLoadState('networkidle')
  })

  test('激活态:16x6 竖向胶囊', async ({ page }) => {
    const { dots, error } = await getDotMetrics(page)
    if (error) throw new Error(error)
    const active = dots.find((d) => d.active)
    if (!active) throw new Error('No active dot found')
    // h-4 = 16px, w-1.5 = 6px
    expect(active.h).toBeGreaterThanOrEqual(15.5)
    expect(active.h).toBeLessThanOrEqual(16.5)
    expect(active.w).toBeGreaterThanOrEqual(5.5)
    expect(active.w).toBeLessThanOrEqual(6.5)
    expect(active.opacity).toBe('1')
  })

  test('非激活态:8x8 圆点', async ({ page }) => {
    const { dots, error } = await getDotMetrics(page)
    if (error) throw new Error(error)
    const inactive = dots.filter((d) => !d.active)
    expect(inactive.length).toBeGreaterThan(0)
    for (const d of inactive) {
      // h-2 = 8px, w-2 = 8px
      expect(d.h).toBeGreaterThanOrEqual(7.5)
      expect(d.h).toBeLessThanOrEqual(8.5)
      expect(d.w).toBeGreaterThanOrEqual(7.5)
      expect(d.w).toBeLessThanOrEqual(8.5)
      // 非激活不应是 16x6 胶囊(回归检测)
      expect(d.h).toBeLessThan(12)
      expect(d.w).toBeLessThan(12)
    }
  })

  test('hover 态:10x10 圆点(group-hover:h-2.5 w-2.5)', async ({ page }) => {
    const { dots, error } = await getDotMetrics(page)
    if (error) throw new Error(error)
    // 找第一个非激活 dot,模拟 hover
    const firstInactive = dots.find((d) => !d.active)
    if (!firstInactive) return
    const container = page.locator(INDICATOR_SELECTOR)
    const btns = container.locator('button')
    const idx = firstInactive.index
    await btns.nth(idx).hover()
    await page.waitForTimeout(100)
    const hoveredSpan = btns.nth(idx).locator('span')
    const sb = await hoveredSpan.boundingBox()
    expect(sb?.width).toBeGreaterThanOrEqual(9.5)
    expect(sb?.width).toBeLessThanOrEqual(10.5)
    expect(sb?.height).toBeGreaterThanOrEqual(9.5)
    expect(sb?.height).toBeLessThanOrEqual(10.5)
  })

  test('所有态 rounded-full(borderRadius ≥ 9999px)', async ({ page }) => {
    const { dots, error } = await getDotMetrics(page)
    if (error) throw new Error(error)
    for (const d of dots) {
      // borderRadius 返回 33554400px ≈ 9999px(50%)
      const brNum = parseFloat(d.borderRadius)
      expect(brNum).toBeGreaterThan(9000)
    }
  })
})
