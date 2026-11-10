// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ScrollEdgeFades 溢出判据 + 遮罩几何常量单测(2026-11-10 追加票,闭环多端一致淡出方案)。
 * 只测抽出的纯函数(computeEdgeOverflow / buildPureEdgeGradient / EDGE_FADE_HEIGHT_PX),
 * 不渲染组件;Taro/components 以最小桩件顶掉(模块图 import 需要,行为不消费)。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@tarojs/taro', () => {
  const stub = {
    getWindowInfo: () => ({ windowHeight: 800 }),
    getSystemInfoSync: () => ({ windowHeight: 800 }),
    createSelectorQuery: () => undefined,
    createIntersectionObserver: () => undefined,
    getCurrentInstance: () => ({ page: null }),
  }
  return { default: stub, useDidShow: () => undefined, ...stub }
})
vi.mock('@tarojs/components', () => ({
  View: ({ children }: { children?: unknown }) => children ?? null,
}))

import { computeEdgeOverflow } from '@/components/ScrollEdgeFades'
import { buildPureEdgeGradient, EDGE_FADE_HEIGHT_PX } from '@/components/BottomFadeMask'

describe('ScrollEdgeFades · computeEdgeOverflow 溢出判据', () => {
  const viewport = { top: 100, bottom: 600 }

  it('无溢出行 ⇒ 双 false', () => {
    expect(computeEdgeOverflow(viewport, [{ top: 120, bottom: 200 }])).toEqual({
      topOverflow: false,
      bottomOverflow: false,
    })
  })

  it('任一 rect.top < viewport.top - 1 ⇒ topOverflow', () => {
    expect(computeEdgeOverflow(viewport, [{ top: 98, bottom: 200 }]).topOverflow).toBe(true)
    expect(
      computeEdgeOverflow(viewport, [
        { top: 150, bottom: 200 },
        { top: 50, bottom: 90 },
      ]).topOverflow,
    ).toBe(true)
  })

  it('任一 rect.bottom > viewport.bottom + 1 ⇒ bottomOverflow', () => {
    expect(computeEdgeOverflow(viewport, [{ top: 120, bottom: 602 }]).bottomOverflow).toBe(true)
  })

  it('1px 容差:恰在边界(top = viewport.top - 1 / bottom = viewport.bottom + 1)不算溢出', () => {
    const r = computeEdgeOverflow(viewport, [{ top: 99, bottom: 601 }])
    expect(r).toEqual({ topOverflow: false, bottomOverflow: false })
  })

  it('kids 空数组(选择器未命中)⇒ 双 false', () => {
    expect(computeEdgeOverflow(viewport, [])).toEqual({ topOverflow: false, bottomOverflow: false })
  })

  it('kids 为 null/undefined ⇒ 双 false', () => {
    expect(computeEdgeOverflow(viewport, null).topOverflow).toBe(false)
    expect(computeEdgeOverflow(viewport, undefined).bottomOverflow).toBe(false)
  })

  it('尺寸 0 的行(隐藏占位)不计入,即使其坐标在视口外', () => {
    expect(
      computeEdgeOverflow(viewport, [
        { top: 0, bottom: 0 },
        { top: 700, bottom: 700 },
      ]),
    ).toEqual({ topOverflow: false, bottomOverflow: false })
  })

  it('非数值字段的 rect 不计入', () => {
    expect(
      computeEdgeOverflow(viewport, [
        { top: undefined, bottom: 700 },
        { top: 120, bottom: 'x' } as unknown as { top: number; bottom: number },
      ]),
    ).toEqual({ topOverflow: false, bottomOverflow: false })
  })

  it('上下同时溢出可独立命中', () => {
    const r = computeEdgeOverflow(viewport, [{ top: 10, bottom: 900 }])
    expect(r).toEqual({ topOverflow: true, bottomOverflow: true })
  })
})

describe('ScrollEdgeFades · 遮罩几何常量与纯渐变 stops', () => {
  it('EDGE_FADE_HEIGHT_PX = 24(多端一致规格)', () => {
    expect(EDGE_FADE_HEIGHT_PX).toBe(24)
  })

  it('纯渐变:恰两停点,边缘 alpha 1 @0px → 内侧 alpha 0 @heightPx,无实底平台', () => {
    const g = buildPureEdgeGradient('hsl(0 0% 100%)', 'top', EDGE_FADE_HEIGHT_PX)
    const stops = g.match(/rgba\([^)]+\)\s+[\d.]+px/g) ?? []
    expect(stops).toHaveLength(2)
    expect(stops[0]).toMatch(/,\s*1\)\s*0px$/) // 边缘实底色
    expect(stops[1]).toMatch(/,\s*0\)\s*24px$/) // 内侧完全透明,恰在 heightPx
    expect(g).not.toContain('transparent') // 同色 alpha 0,防「透明黑」灰带
  })

  it('edge 方向:top 向内(to bottom),bottom 向内(to top)', () => {
    expect(buildPureEdgeGradient('hsl(0 0% 100%)', 'top', 24)).toContain('to bottom')
    expect(buildPureEdgeGradient('hsl(0 0% 100%)', 'bottom', 24)).toContain('to top')
  })
})
