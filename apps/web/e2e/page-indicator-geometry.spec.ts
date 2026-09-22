// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 *   - 全部尺寸等比放大一档:激活 36x12 / 非激活 12x12 / 总高 166px
 *
 * 2026-09-14 校准(15a6b7c6e1,2026-08-29 用户反馈"缩小分页指示器并保持圆点正圆比例"):
 *   组件最终形态在 v14/v15 之后又缩小一档,本 spec 未同步导致 5 例几何断言全红。
 *   按组件当前实现(最终用户拍板形态)校准全部数值:
 *     - 激活态 span: 24x10 竖向胶囊 (h-6=24px w-2.5=10px)
 *     - 非激活态 span: 10x10 圆点 (h-2.5 w-2.5)
 *     - hover 态: transform scale-125 → 视觉 12.5x12.5
 *     - 激活态 button: 24x10 (h-6 w-2.5);非激活态 button: 10x10 (h-2.5 w-2.5)
 *     - 容器宽度: 10 + px-0.5×2(4) + border×2(2) = 16px;py-0.5 (2px)
 *     - 总高(7 button): py 2×2 + 24(激活) + 6×10(非激活) + 6×8(gap) + border 2 = 138px
 *
 * 2026-09-23 对齐 float-indicator 单一来源改版(05f049ba09 → ui/float-indicator.tsx):
 *   - 容器不再有 group/indicator 类(样式迁入 floatIndicatorRailCls) → 选择器改
 *     div.fixed[class*="bg-float-indicator-bg"](PageIndicator 是 fixed,QueryThumbRail 是 absolute,
 *     首页上唯一);aria-label 走 i18n 不作定位依据。
 *   - 结构变为 button 即圆点(FloatIndicatorDot 无内层 span) → 几何直接量 button。
 *   - 尺寸按 float-indicator 定稿:激活 16x8(h-4 w-2)/ 非激活 8x8(h-2 w-2)/
 *     hover scale-125 → 视觉 10x10;容器 px-1 py-1(4) + gap-2(8) + border×2。
 *     容器宽 = 8+8+2 = 18px;topPadding = border 1 + py 4 = 5px;
 *     总高(7 button) = 4+4+16+6×8+6×8+2 = 122px。
 *
 * 守门:任何未来改动(包括 className 模板拼接 bug)导致渲染尺寸偏移 → 测试失败 → 阻止部署。
 *
 * 容差:±0.5px(Tailwind px 精度 + DPR 缩放误差)。
 */

// 2026-09-23:group/indicator 类已随样式迁入 floatIndicatorRailCls 移除,
// 改用设计 token 类 + fixed 定位(PageIndicator 独有组合)定位容器
const INDICATOR_SELECTOR = 'div.fixed[class*="bg-float-indicator-bg"]'

async function getDotMetrics(page: import('@playwright/test').Page) {
  return await page.evaluate((selector) => {
    const container = document.querySelector(selector) as HTMLElement | null
    if (!container) return { error: 'indicator not found', dots: [] }
    const buttons = container.querySelectorAll('button')
    const dots = []
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i]
      if (!btn) continue
      // 2026-09-23:FloatIndicatorDot 的 button 本身即圆点,无内层 span;
      // 量 button 几何(getBoundingClientRect + 计算样式)
      const sb = btn.getBoundingClientRect()
      const cs = getComputedStyle(btn)
      dots.push({
        index: i,
        active: btn.getAttribute('aria-current') === 'true',
        w: sb.width,
        h: sb.height,
        borderRadius: cs.borderRadius,
        bgColor: cs.backgroundColor,
        opacity: cs.opacity,
        className: btn.className,
      })
    }
    return { dots }
  }, INDICATOR_SELECTOR)
}

test.describe('PageIndicator 几何守门', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // 等指示器渲染(仅 min-[768px] 可见,1280 视口下必显)
    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(page.locator(INDICATOR_SELECTOR)).toBeVisible({ timeout: 10000 })
    await page.waitForLoadState('domcontentloaded')
  })

  test('激活态:16x8 竖向胶囊(宽度=非激活态直径,高度=2x 放大)', async ({ page }) => {
    const { dots, error } = await getDotMetrics(page)
    if (error) throw new Error(error)
    const active = dots.find((d) => d.active)
    if (!active) throw new Error('No active dot found')
    // h-4 = 16px, w-2 = 8px(宽度=非激活态直径 8,高度=2x 放大)
    expect(active.h).toBeGreaterThanOrEqual(15.5)
    expect(active.h).toBeLessThanOrEqual(16.5)
    expect(active.w).toBeGreaterThanOrEqual(7.5)
    expect(active.w).toBeLessThanOrEqual(8.5)
    // 验证是竖向胶囊:高度 ≥ 宽度 × 2
    expect(active.h).toBeGreaterThanOrEqual(active.w * 2 - 0.5)
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
    // 2026-09-23:button 即圆点,直接量 button
    const hoveredBtn = btns.nth(idx)
    const sb = await hoveredBtn.boundingBox()
    // CSS scale:1.25 → 8x8 视觉膨胀到 10x10
    // 容差:±1px(DPR 误差)
    expect(sb?.width).toBeGreaterThanOrEqual(9)
    expect(sb?.width).toBeLessThanOrEqual(11)
    expect(sb?.height).toBeGreaterThanOrEqual(9)
    expect(sb?.height).toBeLessThanOrEqual(11)
    // 同时断言 hover 后 scale 属性 ≈ 1.25(transition 过程中可能 1.20-1.25)
    const cs = await hoveredBtn.evaluate((el) => {
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

  test('容器宽度(2026-09-23 校准):容器宽度 ≈ 18px (button 8 + px-1×2 + border×2)', async ({
    page,
  }) => {
    const dims = await page.evaluate((selector) => {
      const container = document.querySelector(selector) as HTMLElement | null
      if (!container) return { error: 'indicator not found' as const }
      const r = container.getBoundingClientRect()
      const buttons = container.querySelectorAll('button')
      const firstBtn = buttons[0] as HTMLElement | null
      const firstBr = firstBtn?.getBoundingClientRect()
      // 找激活态 button(active=16) + 一个非激活态 button(inactive=8)
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
        // 容器 top 距首 button top = border 1 + py-1 4 = 5px
        topPadding: firstBtn ? firstBtn.getBoundingClientRect().top - r.top : 0,
      }
    }, INDICATOR_SELECTOR)
    if ('error' in dims) throw new Error(dims.error)

    // 容器宽度:8 (button) + 8 (px-1×2) + 2 (1px border × 2) = 18px,容差 ±1px
    expect(dims.containerW).toBeGreaterThanOrEqual(17)
    expect(dims.containerW).toBeLessThanOrEqual(19)
    // 激活态 button:16x8,容差 ±0.5px
    expect(dims.activeBtnH).toBeGreaterThanOrEqual(15.5)
    expect(dims.activeBtnH).toBeLessThanOrEqual(16.5)
    expect(dims.activeBtnW).toBeGreaterThanOrEqual(7.5)
    expect(dims.activeBtnW).toBeLessThanOrEqual(8.5)
    // 非激活态 button:8x8,容差 ±0.5px
    expect(dims.inactiveBtnH).toBeGreaterThanOrEqual(7.5)
    expect(dims.inactiveBtnH).toBeLessThanOrEqual(8.5)
    expect(dims.inactiveBtnW).toBeGreaterThanOrEqual(7.5)
    expect(dims.inactiveBtnW).toBeLessThanOrEqual(8.5)
    // 顶部 padding: border 1 + py-1 4 = 5px,容差 ±1px
    expect(dims.topPadding).toBeGreaterThanOrEqual(4)
    expect(dims.topPadding).toBeLessThanOrEqual(6)
  })

  test('间距一致(2026-09-23 float-indicator):任意相邻两点间距 ≈ 8px (gap-2)', async ({ page }) => {
    const metrics = await page.evaluate((selector) => {
      const container = document.querySelector(selector) as HTMLElement | null
      if (!container) return { error: 'indicator not found' as const }
      const buttons = container.querySelectorAll('button')
      const out: Array<{ active: boolean; top: number; bottom: number; h: number }> = []
      for (const btn of Array.from(buttons)) {
        const r = btn.getBoundingClientRect()
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

    // float-indicator 设计: 激活态 h-4 (16); 非激活态 h-2 (8); gap-2 (8px)
    // 相邻 button 边界间距即 flex gap = 8px(与各点自身高度无关)
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
        // 差值 ≤ 1px(理论应当相等,都是 8px gap)
        expect(Math.abs(gapAfterActive - gapInactive)).toBeLessThanOrEqual(1)
      }
    }
  })

  test('总高(2026-09-23 校准):7 button 总高 ≈ 122px (含 2px border)', async ({ page }) => {
    const dims = await page.evaluate((selector) => {
      const container = document.querySelector(selector) as HTMLElement | null
      if (!container) return { error: 'indicator not found' as const }
      const r = container.getBoundingClientRect()
      return { containerH: r.height, buttonCount: container.querySelectorAll('button').length }
    }, INDICATOR_SELECTOR)
    if ('error' in dims) throw new Error(dims.error)

    // 总高 = py 4×2 + (1*16 激活 + 6*8 非激活) + 6*8 gap + 2 border = 122px
    // 按实际 button 数动态校验(总页数可能变):H = 8 + 16 + (n-1)*8 + (n-1)*8 + 2
    expect(dims.buttonCount).toBeGreaterThanOrEqual(2)
    const expectedH = 8 + 16 + (dims.buttonCount - 1) * 8 + (dims.buttonCount - 1) * 8 + 2
    // 容差:±5px(Tailwind/DPR 误差)
    expect(dims.containerH).toBeGreaterThanOrEqual(expectedH - 5)
    expect(dims.containerH).toBeLessThanOrEqual(expectedH + 5)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
