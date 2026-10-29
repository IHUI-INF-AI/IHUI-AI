// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { ACTIVITY_WINDOW_LIMIT, windowActivities } from '../activity-window'

function makeItems(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index)
}

describe('windowActivities — 未越限', () => {
  it('总数小于上限:全量返回且不改引用(不做无谓拷贝)', () => {
    const items = makeItems(3)
    const result = windowActivities(items)
    expect(result.visible).toBe(items)
    expect(result.hiddenCount).toBe(0)
  })

  it('空集:返回空数组同一引用,hiddenCount 为 0', () => {
    const items: number[] = []
    const result = windowActivities(items)
    expect(result.visible).toBe(items)
    expect(result.visible).toHaveLength(0)
    expect(result.hiddenCount).toBe(0)
  })

  it('边界:总数恰好等于上限 ⇒ 不折叠(严格大于才窗口化)', () => {
    const items = makeItems(ACTIVITY_WINDOW_LIMIT)
    const result = windowActivities(items)
    expect(result.visible).toBe(items)
    expect(result.hiddenCount).toBe(0)
  })
})

describe('windowActivities — 越限', () => {
  it('未展开:只返回前 limit 条,hiddenCount = 总数 - limit', () => {
    const items = makeItems(ACTIVITY_WINDOW_LIMIT + 1)
    const result = windowActivities(items)
    expect(result.visible).toHaveLength(ACTIVITY_WINDOW_LIMIT)
    expect(result.visible[0]).toBe(0)
    expect(result.visible[ACTIVITY_WINDOW_LIMIT - 1]).toBe(ACTIVITY_WINDOW_LIMIT - 1)
    expect(result.hiddenCount).toBe(1)
  })

  it('未展开:大量条目也只切前 limit 条,不修改入参', () => {
    const items = makeItems(100)
    const snapshot = [...items]
    const result = windowActivities(items)
    expect(result.visible).toHaveLength(ACTIVITY_WINDOW_LIMIT)
    expect(result.hiddenCount).toBe(100 - ACTIVITY_WINDOW_LIMIT)
    expect(items).toEqual(snapshot)
  })

  it('已展开:全量返回(同一引用),hiddenCount 归零', () => {
    const items = makeItems(ACTIVITY_WINDOW_LIMIT + 5)
    const result = windowActivities(items, ACTIVITY_WINDOW_LIMIT, true)
    expect(result.visible).toBe(items)
    expect(result.hiddenCount).toBe(0)
  })

  it('自定义 limit:越限判定与切片同用这一档', () => {
    const items = makeItems(5)
    const result = windowActivities(items, 2)
    expect(result.visible).toEqual([0, 1])
    expect(result.hiddenCount).toBe(3)
  })

  it('limit 边界 0:全部折叠,可见集为空', () => {
    const items = makeItems(3)
    const result = windowActivities(items, 0)
    expect(result.visible).toHaveLength(0)
    expect(result.hiddenCount).toBe(3)
  })

  it('limit 大于总数:等价于未越限', () => {
    const items = makeItems(2)
    const result = windowActivities(items, 10)
    expect(result.visible).toBe(items)
    expect(result.hiddenCount).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
