/**
 * 工具栏位置计算单元测试。
 * 覆盖:
 * - 基本 placement(top / bottom 切换)
 * - viewport 边缘自动 flip
 * - 横向 clamp
 * - 同选区防抖(jitter guard)
 * - 不可见 selection rect
 * - 滚动偏移感知
 */
import { describe, it, expect } from 'vitest'
import {
  computePositionWithMemory,
  clampHorizontal,
  isNearbyRect,
  type RectLike,
  type ViewportLike,
} from '../src/content/position-memory'

const viewport: ViewportLike = { width: 1200, height: 800 }

function rect(opts: Partial<RectLike> = {}): RectLike {
  return {
    top: 100,
    left: 100,
    right: 200,
    bottom: 120,
    width: 100,
    height: 20,
    ...opts,
  }
}

describe('position-memory', () => {
  describe('clampHorizontal', () => {
    it('居中位置不 clamp', () => {
      const left = clampHorizontal(400, 200, viewport)
      expect(left).toBe(400)
    })
    it('左越界夹到 margin', () => {
      const left = clampHorizontal(-100, 200, viewport)
      expect(left).toBe(8)
    })
    it('右越界夹到 viewport 内', () => {
      const left = clampHorizontal(2000, 200, viewport)
      expect(left).toBe(viewport.width - 200 - 8)
    })
  })

  describe('isNearbyRect', () => {
    it('完全相同判定为附近', () => {
      const a = rect({ top: 100, left: 100 })
      const b = rect({ top: 100, left: 100 })
      expect(isNearbyRect(a, b)).toBe(true)
    })
    it('相差 10px 仍判定为附近(默认 threshold 24)', () => {
      const a = rect({ top: 100, left: 100 })
      const b = rect({ top: 110, left: 105 })
      expect(isNearbyRect(a, b)).toBe(true)
    })
    it('相差 50px 判定为不附近', () => {
      const a = rect({ top: 100, left: 100 })
      const b = rect({ top: 200, left: 200 })
      expect(isNearbyRect(a, b)).toBe(false)
    })
  })

  describe('computePositionWithMemory', () => {
    it('rect 退化时不可见', () => {
      const r = rect({ top: 100, left: 100, width: 0, height: 0, right: 100, bottom: 100 })
      const pos = computePositionWithMemory(r, 200, 32, viewport)
      expect(pos.visible).toBe(false)
      expect(pos.visibilityRatio).toBe(0)
    })

    it('空间足够时优先放上方', () => {
      const r = rect({ top: 200, left: 100, right: 300, bottom: 220, width: 200, height: 20 })
      const pos = computePositionWithMemory(r, 200, 32, viewport)
      expect(pos.placement).toBe('top')
      expect(pos.visible).toBe(true)
      expect(pos.top).toBeLessThan(200)
      expect(pos.visibilityRatio).toBe(1)
    })

    it('上方空间不足时自动 flip 到下方', () => {
      // rect 紧贴 viewport 顶部,上方无空间
      const r = rect({ top: 5, left: 100, right: 300, bottom: 25, width: 200, height: 20 })
      const pos = computePositionWithMemory(r, 200, 32, viewport)
      expect(pos.placement).toBe('bottom')
      expect(pos.top).toBeGreaterThan(25)
      expect(pos.visible).toBe(true)
    })

    it('横向越界自动 clamp', () => {
      const r = rect({ top: 400, left: 1100, right: 1200, bottom: 420, width: 100, height: 20 })
      const pos = computePositionWithMemory(r, 200, 32, viewport)
      expect(pos.left).toBeLessThanOrEqual(viewport.width - 8 - 200)
      expect(pos.left).toBeGreaterThanOrEqual(8)
    })

    it('同 anchor 选区 left 抖动 < threshold 时沿用 anchor.left', () => {
      // 先放置一次建立 anchor
      const r1 = rect({ top: 200, left: 100, right: 300, bottom: 220 })
      const first = computePositionWithMemory(r1, 200, 32, viewport)
      expect(first.visible).toBe(true)
      // 再次放置,只左移 2px(< threshold 4),left 应保持
      const r2 = rect({ top: 200, left: 102, right: 302, bottom: 220 })
      const second = computePositionWithMemory(r2, 200, 32, viewport, {
        anchor: { placement: first.placement, left: first.left },
        jitterThreshold: 4,
      })
      expect(second.left).toBe(first.left)
    })

    it('同 anchor 选区 left 移动 > threshold 时不沿用 anchor', () => {
      const r1 = rect({ top: 200, left: 100, right: 300, bottom: 220 })
      const first = computePositionWithMemory(r1, 200, 32, viewport)
      const r2 = rect({ top: 200, left: 200, right: 400, bottom: 220 })
      const second = computePositionWithMemory(r2, 200, 32, viewport, {
        anchor: { placement: first.placement, left: first.left },
        jitterThreshold: 4,
      })
      expect(second.left).not.toBe(first.left)
    })

    it('rect 完全在 viewport 外(下方)时部分可见', () => {
      // rect 在视口下方 100px
      const r = rect({ top: 900, left: 100, right: 300, bottom: 920, width: 200, height: 20 })
      const pos = computePositionWithMemory(r, 200, 32, viewport)
      expect(pos.visibilityRatio).toBeLessThan(1)
    })

    it('scrollX 影响横向 clamp 边界', () => {
      const r = rect({ top: 400, left: 50, right: 250, bottom: 420 })
      // 无 scroll:理想 left = 0,clamp 到 8
      const noScroll = computePositionWithMemory(r, 200, 32, viewport)
      expect(noScroll.left).toBe(8)
      // scrollX=500:理想 left = 500,viewport 左边界 = 508
      const scrolled = computePositionWithMemory(r, 200, 32, { ...viewport, scrollX: 500 })
      expect(scrolled.left).toBe(508)
    })

    it('scrollY 不影响 viewport 坐标系内的 placement(因为 rect.top 本身在 viewport 坐标)', () => {
      const r = rect({ top: 5, left: 100, right: 300, bottom: 25 })
      const pos = computePositionWithMemory(r, 200, 32, { ...viewport, scrollY: 1000 })
      // 上方空间不足 → flip 到下方
      expect(pos.placement).toBe('bottom')
    })

    it('上方/下方都不可见时,仍返回 best-effort placement', () => {
      // 一个非常高的 toolbar + 紧贴边缘的 rect
      const r = rect({ top: 1, left: 100, right: 300, bottom: 5 })
      const pos = computePositionWithMemory(r, 200, 800, { width: 1200, height: 10 })
      // 视口仅 10px 高,toolbar 高 800,必然放不下 → visible=false
      expect(pos.visible).toBe(false)
    })
  })
})
