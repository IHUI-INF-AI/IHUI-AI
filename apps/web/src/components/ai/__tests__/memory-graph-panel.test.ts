// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { ringLayout } from '../memory-graph-panel'

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
