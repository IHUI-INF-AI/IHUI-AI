// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node
/**
 * `clampImagePreviewOffset` 的纯函数用例(G-853 验收项「钳制的越界两向各一条」)。
 *
 * 断言打在**共享层这一个出口**上,而不是打在某一端的渲染上 —— 因为 web 与 mobile-rn
 * 两端的平移量都由它给值(§3),它错则两端同错,它对则两端不可能各说各话。
 * 写法照同目录 `clamp-percent.test.ts`(相对 `.js` 说明符 = ESM 解析口径)。
 */
import { describe, it, expect } from 'vitest'
import {
  clampImagePreviewOffset,
  imagePreviewPanApplies,
  type ImagePreviewPanGeometry,
} from '../image-preview-offset.js'

/**
 * 图片 800×600 放大一倍 = 1600×1200,视口 800×600
 * ⇒ x 溢出 1600−800 = 800、y 溢出 1200−600 = 600
 * ⇒ 中心锚点下每侧各分到一半:上限 400 / 300。
 */
const ZOOMED: ImagePreviewPanGeometry = {
  offsetX: 0,
  offsetY: 0,
  scaledWidth: 1600,
  scaledHeight: 1200,
  viewportWidth: 800,
  viewportHeight: 600,
}

const geo = (over: Partial<ImagePreviewPanGeometry>): ImagePreviewPanGeometry => ({
  ...ZOOMED,
  ...over,
})

describe('clampImagePreviewOffset(G-853 平移钳制唯一出口)', () => {
  it('正向越界被钳到 +上限(向右 / 向下各拖过头)', () => {
    expect(clampImagePreviewOffset(geo({ offsetX: 9999 })).x).toBe(400)
    expect(clampImagePreviewOffset(geo({ offsetY: 9999 })).y).toBe(300)
  })

  it('负向越界被钳到 −上限(向左 / 向上拖过头)—— 与上一条是两向各一条,不是同一条的两个断言', () => {
    expect(clampImagePreviewOffset(geo({ offsetX: -9999 })).x).toBe(-400)
    expect(clampImagePreviewOffset(geo({ offsetY: -9999 })).y).toBe(-300)
  })

  it('正好压在上限上不动(边界同值不抖)', () => {
    expect(clampImagePreviewOffset(geo({ offsetX: 400, offsetY: -300 }))).toEqual({
      x: 400,
      y: -300,
    })
  })

  it('范围内逐字不动(钳制不是量化)', () => {
    expect(clampImagePreviewOffset(geo({ offsetX: -37.5, offsetY: 12.25 }))).toEqual({
      x: -37.5,
      y: 12.25,
    })
  })

  it('未放大(图片小于视口)⇒ 两轴恒 0,不吃拖拽', () => {
    const out = clampImagePreviewOffset(
      geo({ scaledWidth: 400, scaledHeight: 300, offsetX: 80, offsetY: 60 }),
    )
    expect(out).toEqual({ x: 0, y: 0 })
  })

  it('单轴放大时只钳那一轴:另一轴仍 0(不得按最大轴统一放行)', () => {
    const out = clampImagePreviewOffset(geo({ scaledHeight: 300, offsetX: 500, offsetY: 500 }))
    expect(out).toEqual({ x: 400, y: 0 })
  })

  it('视口没量到(0/负/NaN)⇒ 回 0,不得把"未测"读成"可以拖"', () => {
    for (const viewportWidth of [0, -800, Number.NaN]) {
      expect(clampImagePreviewOffset(geo({ viewportWidth, offsetX: 500 })).x).toBe(0)
    }
    expect(clampImagePreviewOffset(geo({ viewportHeight: 0, offsetY: 500 })).y).toBe(0)
  })

  it('非有限的期望值 ⇒ 0,不把 NaN/Infinity 递进 transform(NaN 会让整棵子树不渲染)', () => {
    expect(clampImagePreviewOffset(geo({ offsetX: Number.NaN, offsetY: Number.POSITIVE_INFINITY }))).toEqual(
      { x: 0, y: 0 },
    )
    expect(clampImagePreviewOffset(geo({ scaledWidth: Number.NaN, offsetX: 500 })).x).toBe(0)
  })
})

describe('imagePreviewPanApplies(手势入口谓词必须与钳制同源)', () => {
  it('放大态为真', () => {
    expect(imagePreviewPanApplies(ZOOMED)).toBe(true)
  })

  it('未放大为假 —— 这一档决定 web 不吃页面滚动', () => {
    expect(imagePreviewPanApplies(geo({ scaledWidth: 400, scaledHeight: 300 }))).toBe(false)
  })

  it('量不到视口为假(与钳制的 fail-safe 同一结论,两处不得互相打脸)', () => {
    expect(imagePreviewPanApplies(geo({ viewportWidth: 0, viewportHeight: 0 }))).toBe(false)
  })

  it('只有一轴溢出也算真,与 clamp 只钳那一轴相配', () => {
    // 纵轴 300 < 视口 600 ⇒ 纵向不溢出;横轴 1600 > 800 ⇒ 横向溢出(限幅 ±400)。
    // 两轴**都**喂 500 的越界偏移,这条用例才真的同时钉住两件事:
    //   ① 溢出轴被钳到边界 400(而不是保留 500);
    //   ② 未溢出轴被**归零**(而不是跟着保留 500)—— 上一版把 offsetX 落在基准 ZOOMED 的 0 上,
    //      于是 ① 从未被量到、断言只是恰好对上 ②,红被误读成"实现错"。
    const oneAxis = geo({ scaledHeight: 300, offsetX: 500, offsetY: 500 })
    expect(imagePreviewPanApplies(oneAxis)).toBe(true)
    expect(clampImagePreviewOffset(oneAxis)).toEqual({ x: 400, y: 0 })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
