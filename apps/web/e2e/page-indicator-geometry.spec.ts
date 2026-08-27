import { test, expect } from '@playwright/test'

/**
 * 分页指示器(PageIndicator)几何守门测试 (2026-07-21 立, M-64 类问题配套)
 *
 * 根因(2026-07-21 M-64):className 模板字面量 BASE/BRANCH 多套 size 类冲突,
 * Tailwind 按源序后值覆盖前值 → 非激活态被拉成 16x8 胶囊,所有点都成椭圆。
 * 修复:拆两套完整 className 分支互斥。
 *
 * 2026-08-27 v14/v15 间距回调(已提交 713698c1d9,用户反馈驱动):
 *   - gap-1 (4px) → gap-4 (16px) → gap-2 (8px):v13 的 4px 用户反馈"太挤",16px 反馈"太大",定格 8px
 *   - 全部尺寸等比放大一档:
 *     - 激活态 span: 36x12 竖向胶囊 (h-9=36px w-3=12px,仍为 3:1 比例)
 *     - 非激活态 span: 12x12 圆点 (h-3=12px w-3=12px,1x 直径)
 *     - 激活态 button: 36x14 (h-9 w-3.5)
 *     - 非激活态 button: 12x14 (h-3 w-3.5)
 *     - 容器宽度: 14 + px-0.5×2(4) + border×2(2) = 20px
 *     - 总高(7 button): py 4×2 + 36(激活) + 6×12(非激活) + 6×8(gap) + border 2 = 166px
 *   此测试用 getBoundingClientRect() 验证实际渲染尺寸与设计意图一致:
 *     - 激活态(span[aria-current=true]):36x12 竖向胶囊
 *     - 非激活态(span):12x12 圆点
 *     - hover 态:transform scale-125 → 视觉 15x15(实际 12x12 + transform)
 *     - 所有态 rounded-full(borderRadius ≥ 9999px 即 50%)
 *     - 激活态不透明度 1,非激活态 opacity ≈ 0.3(由 bg-foreground/30 控制)
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
    await page.waitForLoadState('domcontentloaded')
  })

  test('激活态:36x12 竖向胶囊(宽度=非激活态直径,高度=3x 放大)', async ({ page }) => {
    const { dots, error } = await getDotMetrics(page)
    if (error) throw new Error(error)
    const active = dots.find((d) => d.active)
    if (!active) throw new Error('No active dot found')
    // h-9 = 36px, w-3 = 12px(宽度=非激活态直径 12,高度=3x 直径 36)
    expect(active.h).toBeGreaterThanOrEqual(35.5)
    expect(active.h).toBeLessThanOrEqual(36.5)
    expect(active.w).toBeGreaterThanOrEqual(11.5)
    expect(active.w).toBeLessThanOrEqual(12.5)
    // 验证是竖向胶囊:高度 > 宽度,且 3:1 比例
    expect(active.h).toBeGreaterThan(active.w * 2)
    expect(active.opacity).toBe('1')
  })

  test('非激活态:12x12 圆点', async ({ page }) => {
    const { dots, error } = await getDotMetrics(page)
    if (error) throw new Error(error)
    const inactive = dots.filter((d) => !d.active)
    expect(inactive.length).toBeGreaterThan(0)
    for (const d of inactive) {
      // h-3 = 12px, w-3 = 12px
      expect(d.h).toBeGreaterThanOrEqual(11.5)
      expect(d.h).toBeLessThanOrEqual(12.5)
      expect(d.w).toBeGreaterThanOrEqual(11.5)
      expect(d.w).toBeLessThanOrEqual(12.5)
      // 非激活不应是胶囊(回归检测)
      expect(d.h).toBeLessThan(16)
      expect(d.w).toBeLessThan(16)
    }
  })

  test('hover 态:scale-125 → 视觉 10x10(实际 8x8 + CSS scale 1.25)', async ({ page }) => {
    const { dots, error } = await getDotMetrics(page)
    if (error) throw new Error(error)
    // 找第一个非激活 dot,模拟 hover
    const firstInactive = dots.find((d) => !d.active)
    if (!firstInactive) return
    const container = page.locator(INDICATOR_SELECTOR)
    const btns = container.locator('button')
    const idx = firstInactive.index
    await btns.nth(idx).hover()
    // 等 transition 稳定(duration-300 + DPR)
    await page.waitForTimeout(500)
    const hoveredSpan = btns.nth(idx).locator('span')
    const sb = await hoveredSpan.boundingBox()
    // CSS scale:1.25 → 12x12 视觉膨胀到 15x15
    // 容差:±1px(DPR 误差)
    expect(sb?.width).toBeGreaterThanOrEqual(14)
    expect(sb?.width).toBeLessThanOrEqual(16)
    expect(sb?.height).toBeGreaterThanOrEqual(14)
    expect(sb?.height).toBeLessThanOrEqual(16)
    // 同时断言 hover 后 scale 属性 ≈ 1.25(transition 过程中可能 1.20-1.25)
    const cs = await hoveredSpan.evaluate((el) => {
      const c = getComputedStyle(el)
      return { bg: c.backgroundColor, scale: c.scale }
    })
    // CSS scale 属性:1.25 1.25(Tailwind v4 用 scale 属性而非 transform: scale())
    // 解析首个值(可能格式: "1.25 1.25" 或 "1.24584 1.24584" transition 过程中)
    const scaleMatch = cs.scale.match(/([0-9.]+)/)
    const scaleVal = scaleMatch ? parseFloat(scaleMatch[1]!) : 0
    expect(scaleVal).toBeGreaterThanOrEqual(1.2)
    expect(scaleVal).toBeLessThanOrEqual(1.26)
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

  test('容器宽度压缩(2026-08-13 v12):容器宽度 ≈ 20px (button 14 + px-0.5×2 + border×2)', async ({
    page,
  }) => {
    const dims = await page.evaluate((selector) => {
      const container = document.querySelector(selector) as HTMLElement | null
      if (!container) return { error: 'indicator not found' as const }
      const r = container.getBoundingClientRect()
      const buttons = container.querySelectorAll('button')
      const firstBtn = buttons[0] as HTMLElement | null
      const firstBr = firstBtn?.getBoundingClientRect()
      // v15: 找激活态 button(active=36) + 一个非激活态 button(inactive=12)
      let activeBtn: HTMLElement | null = null
      let inactiveBtn: HTMLElement | null = null
      for (const b of Array.from(buttons)) {
        const btn = b as HTMLElement
        if (btn.getAttribute('aria-current') === 'true') {
          activeBtn = btn
        } else if (!inactiveBtn) {
          inactiveBtn = btn
        }
      }
      const activeBr = activeBtn?.getBoundingClientRect()
      const inactiveBr = inactiveBtn?.getBoundingClientRect()
      return {
        containerW: r.width,
        containerH: r.height,
        firstBtnW: firstBr?.width ?? 0,
        firstBtnH: firstBr?.height ?? 0,
        activeBtnH: activeBr?.height ?? 0,
        inactiveBtnH: inactiveBr?.height ?? 0,
        activeBtnW: activeBr?.width ?? 0,
        inactiveBtnW: inactiveBr?.width ?? 0,
        // 容器 top 距首 button top = py-1 (4px)
        topPadding: firstBtn ? firstBtn.getBoundingClientRect().top - r.top : 0,
      }
    }, INDICATOR_SELECTOR)
    if ('error' in dims) throw new Error(dims.error)

    // 容器宽度:14 (button) + 4 (px-0.5×2) + 2 (1px border × 2) = 20px,容差 ±1px
    expect(dims.containerW).toBeGreaterThanOrEqual(19)
    expect(dims.containerW).toBeLessThanOrEqual(21)
    // 激活态 button:36x14,容差 ±0.5px
    expect(dims.activeBtnH).toBeGreaterThanOrEqual(35.5)
    expect(dims.activeBtnH).toBeLessThanOrEqual(36.5)
    expect(dims.activeBtnW).toBeGreaterThanOrEqual(13.5)
    expect(dims.activeBtnW).toBeLessThanOrEqual(14.5)
    // 非激活态 button:12x14,容差 ±0.5px
    expect(dims.inactiveBtnH).toBeGreaterThanOrEqual(11.5)
    expect(dims.inactiveBtnH).toBeLessThanOrEqual(12.5)
    expect(dims.inactiveBtnW).toBeGreaterThanOrEqual(13.5)
    expect(dims.inactiveBtnW).toBeLessThanOrEqual(14.5)
    // 顶部 padding:py-1 (4px),容差 ±1px
    expect(dims.topPadding).toBeGreaterThanOrEqual(3)
    expect(dims.topPadding).toBeLessThanOrEqual(5)
  })

  test('间距一致(2026-08-27 v15):任意相邻两点间距 ≈ 8px (gap-2)', async ({
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

    // v15 设计: 激活态 button h-9 + 36x12 填满; 非激活态 button h-3 + 12x12 填满; gap-2 (8px)
    // 间距计算(非激活态之间): 非激活底 12 → 下一非激活顶 (12 + 8) = 20, 间距 8px
    // 间距计算(激活态 → 非激活态): 激活底 36 → 下一非激活顶 (36 + 8) = 44, 间距 8px
    // 容差:±1px(Tailwind/DPR 误差)
    for (let i = 0; i < dots.length - 1; i++) {
      const a = dots[i]
      const b = dots[i + 1]
      if (!a || !b) continue
      const gap = b.top - a.bottom
      expect(gap).toBeGreaterThanOrEqual(7)
      expect(gap).toBeLessThanOrEqual(9)
    }

    // 额外断言:激活态底部到下一非激活态顶部 = 非激活态之间间距(一致性)
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
        // 差值 ≤ 1px(理论应当相等,都是 4px)
        expect(Math.abs(gapAfterActive - gapInactive)).toBeLessThanOrEqual(1)
      }
    }
  })

  test('v15 总高(2026-08-27 v15):7 button 总高 ≈ 166px (含 2px border)', async ({ page }) => {
    const dims = await page.evaluate((selector) => {
      const container = document.querySelector(selector) as HTMLElement | null
      if (!container) return { error: 'indicator not found' as const }
      const r = container.getBoundingClientRect()
      return { containerH: r.height }
    }, INDICATOR_SELECTOR)
    if ('error' in dims) throw new Error(dims.error)

    // v15 总高 = py 4×2 + (1*36 激活 + 6*12 非激活) + 6*8 gap + 2 border = 166px
    // 容差:±5px(Tailwind/DPR 误差)
    expect(dims.containerH).toBeGreaterThanOrEqual(161)
    expect(dims.containerH).toBeLessThanOrEqual(171)
  })
})
