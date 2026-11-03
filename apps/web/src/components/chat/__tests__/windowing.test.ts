// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-828 代裁(2026-10-23)配套:窗口化纯判据的不变量锁。
 * windowing.ts 的模块注释宣称"三条不变量(测试逐条锁)",但 2026-10-04 立模块时
 * 只接了 windowPaddings 半条腿、测试一格没写 —— 本文件补上判据层的锁,
 * 与 use-message-list-scroll.windowing-mount.test.tsx(接线层)配对。
 */
import { describe, it, expect } from 'vitest'
import {
  ESTIMATED_ITEM_HEIGHT,
  MAX_MOUNTED_ITEMS,
  WINDOW_BUFFER_ITEMS,
  WINDOW_THRESHOLD,
  buildOffsets,
  historyAnchorCandidates,
  resolveVisibleWindow,
  shouldWindow,
  windowPaddings,
} from '../windowing'

function uniformOffsets(count: number, height: number): number[] {
  return Array.from({ length: count + 1 }, (_, i) => i * height)
}

describe('shouldWindow(阈值语义:60 条以下全量渲染)', () => {
  it('恰好等于阈值不窗口化,超过一条才窗口化', () => {
    expect(shouldWindow(WINDOW_THRESHOLD)).toBe(false)
    expect(shouldWindow(WINDOW_THRESHOLD + 1)).toBe(true)
  })
})

describe('buildOffsets(脏测量按单行回落,不毒整链)', () => {
  it('undefined/NaN/Infinity 回落估计高;负高钳 0;量到 0 照用 0', () => {
    const { offsets, total } = buildOffsets(4, (i) => [undefined, NaN, -50, Infinity][i])
    // undefined/NaN/Infinity ⇒ 该行回落估计高 160;-50 ⇒ 钳 0
    expect(offsets[0]).toBe(0)
    expect(offsets[1]).toBe(ESTIMATED_ITEM_HEIGHT)
    expect(offsets[2]).toBe(2 * ESTIMATED_ITEM_HEIGHT)
    expect(offsets[3]).toBe(2 * ESTIMATED_ITEM_HEIGHT)
    expect(total).toBe(3 * ESTIMATED_ITEM_HEIGHT)
  })

  it('末位 offsets[count] = 内容总高', () => {
    const { offsets, total } = buildOffsets(3, (i) => [100, 200, 300][i])
    expect(offsets[3]).toBe(600)
    expect(total).toBe(600)
  })
})

describe('resolveVisibleWindow(视口全覆盖 + 挂载上限恒定)', () => {
  it('正常几何:窗口 = 视口覆盖行 ± 缓冲行', () => {
    const count = 100
    const offsets = uniformOffsets(count, 160)
    const win = resolveVisibleWindow({ count, offsets, scrollTop: 1600, viewportHeight: 640 })
    // 视口覆盖行 10..13(1600..2240;起始恰落在视口底沿的第 14 行按严格小于不计),
    // ±6 缓冲 ⇒ [4..19]
    expect(win).toEqual({ start: 4, end: 19 })
  })

  it('行高塌缩(全 1px):挂载行数不得越过 MAX_MOUNTED_ITEMS —— 窗口化不得退化成整表挂载', () => {
    const count = 1000
    const offsets = uniformOffsets(count, 1)
    const win = resolveVisibleWindow({ count, offsets, scrollTop: 0, viewportHeight: 200 })
    expect(win.end - win.start + 1).toBeLessThanOrEqual(MAX_MOUNTED_ITEMS)
    // 上限咬人时从视口顶部起保留连续行(可见内容不被清空)
    expect(win).toEqual({ start: 0, end: MAX_MOUNTED_ITEMS - 1 })
  })

  it('内容总高量不到(0):退化为"从顶部挂满上限",不是不更新窗口', () => {
    const count = 500
    const offsets = new Array<number>(count + 1).fill(0)
    const win = resolveVisibleWindow({ count, offsets, scrollTop: 0, viewportHeight: 200 })
    expect(win).toEqual({ start: 0, end: MAX_MOUNTED_ITEMS - 1 })
  })

  it('count=0 ⇒ 空窗口(start > end)', () => {
    const win = resolveVisibleWindow({ count: 0, offsets: [0], scrollTop: 0, viewportHeight: 200 })
    expect(win.end).toBeLessThan(win.start)
  })

  it('不变量②:上限不咬人时,窗口完整覆盖视口行', () => {
    const count = 200
    const offsets = uniformOffsets(count, 160)
    const win = resolveVisibleWindow({ count, offsets, scrollTop: 5000, viewportHeight: 800 })
    const coreStart = Math.floor(5000 / 160)
    const coreEnd = Math.ceil((5000 + 800) / 160) - 1
    expect(win.start).toBe(Math.max(0, coreStart - WINDOW_BUFFER_ITEMS))
    expect(win.end).toBe(Math.min(count - 1, coreEnd + WINDOW_BUFFER_ITEMS))
  })
})

describe('windowPaddings(窗口外占位:paddingTop+paddingBottom+窗口行高 = 总高)', () => {
  it('滚动条比例不失真(历史不被裁掉)', () => {
    const count = 100
    const offsets = uniformOffsets(count, 160)
    const { paddingTop, paddingBottom } = windowPaddings({ offsets, count, start: 10, end: 29 })
    expect(paddingTop).toBe(10 * 160)
    expect(paddingBottom).toBe(70 * 160)
  })

  it('窗口贴到两端时对应侧占位为 0', () => {
    const count = 50
    const offsets = uniformOffsets(count, 160)
    expect(windowPaddings({ offsets, count, start: 0, end: 9 }).paddingTop).toBe(0)
    expect(windowPaddings({ offsets, count, start: 40, end: 49 }).paddingBottom).toBe(0)
  })
})

describe('historyAnchorCandidates(补页锚点:窗口首行优先,回落数组首行)', () => {
  it('窗口首行 ≠ 数组首行 ⇒ 两个候选按序', () => {
    expect(historyAnchorCandidates(100, 42)).toEqual([42, 0])
  })
  it('窗口首行 = 数组首行 ⇒ 去重只剩一个', () => {
    expect(historyAnchorCandidates(100, 0)).toEqual([0])
  })
  it('空表 ⇒ 无候选;windowStart 越界 ⇒ 钳到末行', () => {
    expect(historyAnchorCandidates(0, 5)).toEqual([])
    expect(historyAnchorCandidates(10, 999)).toEqual([9, 0])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
