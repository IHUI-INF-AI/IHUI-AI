// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { forceLayout, ringLayout } from '../memory-graph-panel'

/**
 * P3 #41 阶段3 记忆图谱环形布局测试(2026-09-16 立)
 */
describe('ringLayout', () => {
  it('空输入返回空数组', () => {
    expect(ringLayout(0, 130)).toEqual([])
  })

  it('节点数与坐标数一致', () => {
    expect(ringLayout(5, 130)).toHaveLength(5)
  })

  it('所有节点都在半径圆上(距圆心 = radius,容差 1e-6)', () => {
    const R = 130
    for (const p of ringLayout(8, R)) {
      const d = Math.hypot(p.x - R, p.y - R)
      expect(Math.abs(d - R)).toBeLessThan(1e-6)
    }
  })

  it('第一个节点在正上方(x=圆心, y=圆心-radius)', () => {
    const R = 100
    const [first] = ringLayout(4, R)
    expect(first?.x).toBeCloseTo(R, 6)
    expect(first?.y).toBeCloseTo(0, 6)
  })

  it('坐标确定(同输入同输出,布局可测不抖动)', () => {
    expect(ringLayout(3, 50)).toEqual(ringLayout(3, 50))
  })
})

describe('forceLayout(P1 #41 力导向增强,确定性模拟)', () => {
  const ids = ['a', 'b', 'c', 'd', 'e']
  const edges = [
    { source: 'a', target: 'b' },
    { source: 'a', target: 'c' },
    { source: 'b', target: 'd' },
  ]

  it('节点数正确;空输入返回空数组', () => {
    expect(forceLayout(ids, edges)).toHaveLength(5)
    expect(forceLayout([], [])).toHaveLength(0)
  })

  it('坐标确定:同输入两次调用逐位相同', () => {
    expect(forceLayout(ids, edges)).toEqual(forceLayout(ids, edges))
  })

  it('无 NaN/Infinity,坐标在画布边界内', () => {
    for (const p of forceLayout(ids, edges, 300, 300)) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(300)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(300)
    }
  })

  it('相连节点被拉近:力导向后边两端平均距离 < 环形初始平均距离', () => {
    const ring = ringLayout(ids.length, 130)
    const posById = new Map(ids.map((id, i) => [id, ring[i]!]))
    const ringDist =
      edges.reduce(
        (s, e) =>
          s +
          Math.hypot(
            posById.get(e.source)!.x - posById.get(e.target)!.x,
            posById.get(e.source)!.y - posById.get(e.target)!.y,
          ),
        0,
      ) / edges.length
    const force = forceLayout(ids, edges, 300, 300, 200)
    const fmap = new Map(ids.map((id, i) => [id, force[i]!]))
    const forceDist =
      edges.reduce(
        (s, e) =>
          s +
          Math.hypot(
            fmap.get(e.source)!.x - fmap.get(e.target)!.x,
            fmap.get(e.source)!.y - fmap.get(e.target)!.y,
          ),
        0,
      ) / edges.length
    expect(forceDist).toBeLessThan(ringDist)
  })
})
