import { test, expect } from '@playwright/test'

/**
 * 分页指示器(PageIndicator)几何守门测试 (2026-07-21 立, M-64 类问题配套)
 *
 * 根因(2026-07-21 M-64):className 模板字面量 BASE/BRANCH 多套 size 类冲突,
 * Tailwind 按源序后值覆盖前值 → 非激活态被拉成 16x8 胶囊,所有点都成椭圆。
 * 修复:拆两套完整 className 分支互斥。
 *
 * 此测试用 getBoundingClientRect() 验证实际渲染尺寸与设计意图一致:
 *   - 激活态(span[aria-current=true]):24x8 竖向胶囊 (h-6=24px w-2=8px,宽度=非激活态直径,高度=3x 直径放大)
 *   - 非激活态(span):8x8 圆点 (h-2=8px w-2=8px,1x 直径)
 *   - hover 态:10x10 圆点 (h-2.5=10px w-2.5=10px,1.25x 直径,作为可点击视觉反馈)
 *   - 所有态 rounded-full(borderRadius ≥ 9999px 即 50%)
 *   - 激活态不透明度 1,非激活态 opacity ≈ 0.3(由 bg-foreground/30 控制)
 *
 * 守门:任何未来改动(包括 className 模板拼接 bug)导致渲染尺寸偏移 → 测试失败 → 阻止部署。
 *
 * 容差:±0.5px(Tailwind px 精度 + DPR 缩放误差)。
 */

const INDICATOR_SELECTOR = '.group\\/indicator'

async function getDotMetrics(page: import('@playwright/test').Page) {
  return await page.evaluate((selector) => {
    const container = document.querySelector(selector) as HTMLElement | null
    if (!container) return { error: 'indicator not found', dots: [] }
    const buttons = container.querySelectorAll('button')
    const dots = []
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i]
      if (!btn) continue
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

  test('激活态:24x8 竖向胶囊(宽度=非激活态直径,高度=3x 放大)', async ({ page }) => {
    const { dots, error } = await getDotMetrics(page)
    if (error) throw new Error(error)
    const active = dots.find((d) => d.active)
    if (!active) throw new Error('No active dot found')
    // h-6 = 24px, w-2 = 8px(宽度=非激活态直径 8,高度=3x 直径 24)
    expect(active.h).toBeGreaterThanOrEqual(23.5)
    expect(active.h).toBeLessThanOrEqual(24.5)
    expect(active.w).toBeGreaterThanOrEqual(7.5)
    expect(active.w).toBeLessThanOrEqual(8.5)
    // 验证是竖向胶囊:高度 > 宽度,且 3:1 比例
    expect(active.h).toBeGreaterThan(active.w * 2)
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

  test('所有态 纯圆形(borderRadius ≥ 9999px)', async ({ page }) => {
    const { dots, error } = await getDotMetrics(page)
    if (error) throw new Error(error)
    for (const d of dots) {
      // borderRadius 返回 33554400px ≈ 9999px(50%)
      const brNum = parseFloat(d.borderRadius)
      expect(brNum).toBeGreaterThan(9000)
    }
  })

  test('容器宽度压缩(2026-08-13 v12):容器宽度 ≈ 14px (button 10 + px-0.5×2)', async ({
    page,
  }) => {
    const dims = await page.evaluate((selector) => {
      const container = document.querySelector(selector) as HTMLElement | null
      if (!container) return { error: 'indicator not found' as const }
      const r = container.getBoundingClientRect()
      const firstBtn = container.querySelector('button') as HTMLElement | null
      const br = firstBtn?.getBoundingClientRect()
      return {
        containerW: r.width,
        containerH: r.height,
        buttonW: br?.width ?? 0,
        buttonH: br?.height ?? 0,
        // 容器 top 距首 button top = py-1 (4px)
        topPadding: firstBtn ? firstBtn.getBoundingClientRect().top - r.top : 0,
      }
    }, INDICATOR_SELECTOR)
    if ('error' in dims) throw new Error(dims.error)

    // 容器宽度:10 (button) + 2*2 (px-0.5) = 14px,容差 ±1px
    expect(dims.containerW).toBeGreaterThanOrEqual(13)
    expect(dims.containerW).toBeLessThanOrEqual(15)
    // button:10x24,容差 ±0.5px
    expect(dims.buttonW).toBeGreaterThanOrEqual(9.5)
    expect(dims.buttonW).toBeLessThanOrEqual(10.5)
    expect(dims.buttonH).toBeGreaterThanOrEqual(23.5)
    expect(dims.buttonH).toBeLessThanOrEqual(24.5)
    // 顶部 padding:py-1 (4px),容差 ±1px
    expect(dims.topPadding).toBeGreaterThanOrEqual(3)
    expect(dims.topPadding).toBeLessThanOrEqual(5)
  })

  test('间距一致 + 紧凑(2026-08-13 v11):任意相邻两点间距 ≈ 16px (2x 非激活态直径)', async ({
    page,
  }) => {
    const metrics = await page.evaluate((selector) => {
      const container = document.querySelector(selector) as HTMLElement | null
      if (!container) return { error: 'indicator not found' as const }
      const buttons = container.querySelectorAll('button')
      const out: Array<{ active: boolean; top: number; bottom: number; h: number }> = []
      for (const btn of Array.from(buttons)) {
        const span = btn.querySelector('span') as HTMLElement | null
        if (!span) continue
        const r = span.getBoundingClientRect()
        out.push({
          active: btn.getAttribute('aria-current') === 'true',
          top: r.top,
          bottom: r.bottom,
          h: r.height,
        })
      }
      return { dots: out }
    }, INDICATOR_SELECTOR)
    if ('error' in metrics) throw new Error(metrics.error)
    const dots = metrics.dots
    expect(dots.length).toBeGreaterThanOrEqual(2)

    // 相邻两个 span 的中心间距(= 高度+上下间隙)
    // items-end + gap-0 + h-6 button:
    //   非激活 8x8 在 button 底部 → top = button.bottom - 8
    //   激活 24x8 填满 button → bottom = button.bottom
    //   相邻两点间距 = 16px (= 2x 非激活态直径 8,设计意图:紧凑但清晰)
    // 容差:±1.5px(Tailwind/DPR 误差)
    for (let i = 0; i < dots.length - 1; i++) {
      const a = dots[i]
      const b = dots[i + 1]
      if (!a || !b) continue
      const gap = b.top - a.bottom
      // 期望 16px(2x 8)
      expect(gap).toBeGreaterThanOrEqual(14.5)
      expect(gap).toBeLessThanOrEqual(17.5)
    }

    // 额外断言:激活态底部到下一非激活态顶部 = 非激活态之间间距(一致性)
    // 找到 active 索引,如果它不是最后一个,验证 active.bottom→next.top 与普通间距一致
    const activeIdx = dots.findIndex((d) => d.active)
    if (activeIdx >= 0 && activeIdx < dots.length - 1) {
      const active = dots[activeIdx]
      const next = dots[activeIdx + 1]
      if (active && next) {
        const gapAfterActive = next.top - active.bottom
        // 找一个非 active 之间的间距作为对照
        let gapInactive = 0
        for (let i = 0; i < dots.length - 1; i++) {
          if (i === activeIdx) continue
          const x = dots[i]
          const y = dots[i + 1]
          if (x && y) {
            gapInactive = y.top - x.bottom
            break
          }
        }
        // 差值 ≤ 1px(理论应当相等)
        expect(Math.abs(gapAfterActive - gapInactive)).toBeLessThanOrEqual(1.5)
      }
    }
  })
})
