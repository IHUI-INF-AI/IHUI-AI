// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 静态长文档块级虚拟化判据(对标 Qoder §6.6)。
 *
 * 本表刻意**六条让位判据各给一例**:只测"正常情况算对窗口"证不出"算不出时不会
 * 白屏"—— 而那正是窗口化最危险的失效方向(挂空 = 正文消失)。
 */
import { describe, expect, it } from 'vitest'

import {
  STATIC_BLOCK_ESTIMATED_HEIGHT,
  STATIC_BLOCK_MAX_MOUNTED,
  STATIC_BLOCK_OVERSCAN,
  STATIC_BLOCK_VIRTUALIZE_MIN_CHARS,
  buildStaticBlockOffsets,
  resolveStaticBlockWindow,
  sliceBlocksForWindow,
  __test__,
} from '../markdown-block-window'

const { firstIndexCovering } = __test__

/** 造 n 块、每块高 200px 的偏移表 */
function offsetsOf(n: number, height = 200): number[] {
  return Array.from({ length: n + 1 }, (_, i) => i * height)
}

const BASE = {
  totalChars: STATIC_BLOCK_VIRTUALIZE_MIN_CHARS,
  isStreaming: false,
  scrollTop: 0,
  viewportHeight: 800,
}

describe('静态长文档块级虚拟化判据', () => {
  it('常量取值与 Qoder 同档(16384 / overscan 4),且上限有界', () => {
    expect(STATIC_BLOCK_VIRTUALIZE_MIN_CHARS).toBe(16384)
    expect(STATIC_BLOCK_OVERSCAN).toBe(4)
    expect(STATIC_BLOCK_MAX_MOUNTED).toBeGreaterThan(STATIC_BLOCK_OVERSCAN * 2)
  })

  it('正常态:顶部可见 4 块 + overscan ⇒ 只挂前几块,下占位撑住余高', () => {
    const blocks = 20
    const w = resolveStaticBlockWindow({
      ...BASE,
      blockCount: blocks,
      offsets: offsetsOf(blocks),
    })
    expect(w.enabled).toBe(true)
    expect(w.start).toBe(0)
    // 视口 800px / 每块 200px ⇒ 可见 4 块(index 0..3),+ overscan 4 ⇒ end=7
    expect(w.end).toBe(7)
    expect(w.paddingTop).toBe(0)
    // 总高 4000,已挂到第 8 块末尾(1600)⇒ 下方占位 2400
    expect(w.paddingBottom).toBe(2400)
  })

  it('滚动到中段:上下占位都不为 0,挂载区间跟随', () => {
    const blocks = 20
    const w = resolveStaticBlockWindow({
      ...BASE,
      blockCount: blocks,
      offsets: offsetsOf(blocks),
      scrollTop: 2000,
    })
    expect(w.enabled).toBe(true)
    expect(w.paddingTop).toBeGreaterThan(0)
    expect(w.paddingBottom).toBeGreaterThan(0)
    expect(w.start).toBeLessThanOrEqual(10)
    expect(w.end).toBeGreaterThanOrEqual(10)
  })

  it('让位①仍在流式 ⇒ 全量挂载(窗口化会让 active 块反复重挂)', () => {
    const w = resolveStaticBlockWindow({
      ...BASE,
      blockCount: 20,
      offsets: offsetsOf(20),
      isStreaming: true,
    })
    expect(w.enabled).toBe(false)
    expect(w.reason).toBe('streaming')
    expect(w.start).toBe(0)
    expect(w.end).toBe(19)
  })

  it('让位②字符不足门槛 ⇒ 全量挂载', () => {
    const w = resolveStaticBlockWindow({
      ...BASE,
      totalChars: STATIC_BLOCK_VIRTUALIZE_MIN_CHARS - 1,
      blockCount: 20,
      offsets: offsetsOf(20),
    })
    expect(w.enabled).toBe(false)
    expect(w.reason).toBe('below-threshold')
  })

  it('让位③单块 ⇒ 无可窗口对象', () => {
    const w = resolveStaticBlockWindow({ ...BASE, blockCount: 1, offsets: offsetsOf(1) })
    expect(w.enabled).toBe(false)
    expect(w.reason).toBe('single-block')
  })

  it('让位④偏移表未量 ⇒ 不猜几何', () => {
    const w = resolveStaticBlockWindow({ ...BASE, blockCount: 20, offsets: [] })
    expect(w.enabled).toBe(false)
    expect(w.reason).toBe('offsets-unmeasured')
  })

  it('让位⑤总高为 0 ⇒ 全量挂载(块级窗口没有"从顶部挂满上限"这一档可用)', () => {
    const w = resolveStaticBlockWindow({
      ...BASE,
      blockCount: 20,
      offsets: Array.from({ length: 21 }, () => 0),
    })
    expect(w.enabled).toBe(false)
    expect(w.reason).toBe('total-height-unknown')
  })

  it('让位⑥视口高未知 ⇒ 全量挂载', () => {
    const w = resolveStaticBlockWindow({
      ...BASE,
      blockCount: 20,
      offsets: offsetsOf(20),
      viewportHeight: 0,
    })
    expect(w.enabled).toBe(false)
    expect(w.reason).toBe('viewport-unknown')
  })

  it('上限兜底:块高塌成一像素时不圈住全部块', () => {
    const blocks = 500
    const w = resolveStaticBlockWindow({
      totalChars: 100_000,
      isStreaming: false,
      scrollTop: 0,
      viewportHeight: 800,
      blockCount: blocks,
      offsets: offsetsOf(blocks, 1),
    })
    expect(w.enabled).toBe(true)
    expect(w.end - w.start + 1).toBeLessThanOrEqual(STATIC_BLOCK_MAX_MOUNTED)
  })

  it('sliceBlocksForWindow:未启用 ⇒ 全量(不是空数组)', () => {
    const blocks = ['a', 'b', 'c']
    const r = sliceBlocksForWindow(blocks, {
      enabled: false,
      start: 0,
      end: 2,
      paddingTop: 0,
      paddingBottom: 0,
      reason: 'streaming',
    })
    expect(r.mounted).toEqual(blocks)
    expect(r.above).toBe(0)
    expect(r.below).toBe(0)
  })

  it('sliceBlocksForWindow:启用 ⇒ 三段切分且块一个不丢', () => {
    const blocks = Array.from({ length: 10 }, (_, i) => `b${i}`)
    const r = sliceBlocksForWindow(blocks, {
      enabled: true,
      start: 3,
      end: 5,
      paddingTop: 600,
      paddingBottom: 800,
      reason: null,
    })
    expect(r.above).toBe(3)
    expect(r.mounted).toEqual(['b3', 'b4', 'b5'])
    expect(r.below).toBe(4)
    expect(r.above + r.mounted.length + r.below).toBe(blocks.length)
  })

  it('firstIndexCovering:单调偏移上的二分边界', () => {
    const offsets = offsetsOf(5) // [0,200,400,600,800,1000]
    expect(firstIndexCovering(offsets, 0)).toBe(0)
    expect(firstIndexCovering(offsets, 199)).toBe(0)
    expect(firstIndexCovering(offsets, 200)).toBe(1)
    expect(firstIndexCovering(offsets, 999)).toBe(4)
  })
})

describe('buildStaticBlockOffsets:实测 + 估计的偏移拼装', () => {
  it('全实测 ⇒ 偏移就是累加,一个不差', () => {
    const r = buildStaticBlockOffsets({ blockCount: 3, measured: [100, 200, 300] })
    expect(r.offsets).toEqual([0, 100, 300, 600])
    expect(r.measuredCount).toBe(3)
  })

  it('部分实测 ⇒ 未测块用**已测均值**填,不用全局常量', () => {
    // 已测两块 100 / 300 ⇒ 均值 200;第三块未测 ⇒ 按 200 估
    const r = buildStaticBlockOffsets({ blockCount: 4, measured: [100, 300, undefined, undefined] })
    expect(r.measuredCount).toBe(2)
    expect(r.offsets).toEqual([0, 100, 400, 600, 800])
  })

  it('零实测 ⇒ 用兜底常量(不除零、不返回 NaN)', () => {
    const r = buildStaticBlockOffsets({
      blockCount: 2,
      measured: [],
      fallback: STATIC_BLOCK_ESTIMATED_HEIGHT,
    })
    expect(r.measuredCount).toBe(0)
    expect(r.offsets).toEqual([0, STATIC_BLOCK_ESTIMATED_HEIGHT, STATIC_BLOCK_ESTIMATED_HEIGHT * 2])
  })

  it('脏实测值(0 / 负数 / NaN / Infinity)一律按未测处理', () => {
    const r = buildStaticBlockOffsets({
      blockCount: 5,
      measured: [0, -5, Number.NaN, Number.POSITIVE_INFINITY, 100],
    })
    expect(r.measuredCount).toBe(1)
    // 唯一有效样本 100 ⇒ 其余四块按 100 估
    expect(r.offsets).toEqual([0, 100, 200, 300, 400, 500])
  })

  it('偏移表长度恒为 blockCount + 1(窗口判据的长度前置)', () => {
    for (const n of [0, 1, 7, 40]) {
      const r = buildStaticBlockOffsets({ blockCount: n, measured: [] })
      expect(r.offsets.length).toBe(n + 1)
    }
  })

  it('估计值也能让窗口判据成立(死锁反例:不挂就量不到,量不到就不挂)', () => {
    const blocks = 40
    const { offsets } = buildStaticBlockOffsets({
      blockCount: blocks,
      measured: [200, 200],
    })
    const w = resolveStaticBlockWindow({
      totalChars: 100_000,
      isStreaming: false,
      scrollTop: 0,
      viewportHeight: 800,
      blockCount: blocks,
      offsets,
    })
    // 若要求全量实测才能算窗口,这里会因 offsets 长度不足而恒 enabled=false
    expect(w.enabled).toBe(true)
    expect(w.end).toBeLessThan(blocks - 1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
