// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * 活动级几何虚拟化 · 纯判据锁(2026-10-29 立,对标 Qoder 0.4.11)。
 *
 * 咬四件事(全部经生产出口断言,判据不在测试里复制一份):
 *  ① 揭示对齐成对:显式揭示 ⇒ center;仅新条目到达 ⇒ 贴底(end);
 *  ② 降级成对:条目数 ≤ 阈值 ⇒ 全量;几何量不到(视口 0 / NaN / 行高全塌缩)⇒ 全量;
 *  ③ 虚拟化档的三条不变量:窗口完整覆盖可见行、挂载行数受上限约束、占位高度守恒;
 *  ④ 窗口数学**不复制**:本文件 import 的是 `activity-virtual-window`,它自己 import
 *     `@/components/chat/windowing` —— 断言"改 windowing 的常量会同时改这边的读数"。
 */
import { describe, expect, it } from 'vitest'
import {
  ESTIMATED_ITEM_HEIGHT,
  MAX_MOUNTED_ITEMS,
  buildOffsets,
  resolveVisibleWindow,
} from '@/components/chat/windowing'
import {
  ACTIVITY_OVERSCAN,
  ACTIVITY_ROW_HEIGHT,
  ACTIVITY_VIRTUAL_THRESHOLD,
  planActivityWindow,
  resolveRevealScrollTop,
  resolveRevealTarget,
} from '../activity-virtual-window'

const uniform = () => ACTIVITY_ROW_HEIGHT

describe('resolveRevealTarget — 揭示对齐成对判据', () => {
  it('revealItemIndex >= 0 ⇒ 该行居中(用户显式点某条)', () => {
    expect(resolveRevealTarget({ count: 100, revealItemIndex: 42 })).toEqual({
      target: 42,
      align: 'center',
      explicit: true,
    })
  })

  it('对照:没有揭示输入 ⇒ 末行 + 贴底(仅因新条目到达)', () => {
    expect(resolveRevealTarget({ count: 100 })).toEqual({
      target: 99,
      align: 'end',
      explicit: false,
    })
  })

  it('itemKey 命中 ⇒ 命中行居中(键比下标稳)', () => {
    const itemKeys = ['a', 'b', 'c', 'd']
    expect(resolveRevealTarget({ count: 4, revealItemKey: 'c', itemKeys })).toEqual({
      target: 2,
      align: 'center',
      explicit: true,
    })
  })

  it('itemKey 查不到 / 空串 ⇒ 回落贴底,绝不猜中间某行', () => {
    const itemKeys = ['a', 'b']
    expect(resolveRevealTarget({ count: 4, revealItemKey: 'zzz', itemKeys }).align).toBe('end')
    expect(resolveRevealTarget({ count: 4, revealItemKey: '', itemKeys }).align).toBe('end')
    expect(resolveRevealTarget({ count: 4, revealItemKey: 'a' }).align).toBe('end')
  })

  it('下标越界钳到末行;负下标按"没有揭示输入"处理', () => {
    expect(resolveRevealTarget({ count: 5, revealItemIndex: 99 }).target).toBe(4)
    expect(resolveRevealTarget({ count: 5, revealItemIndex: -1 }).target).toBe(4)
    expect(resolveRevealTarget({ count: 5, revealItemIndex: -1 }).explicit).toBe(false)
  })

  it('空列表 ⇒ target -1(调用方据此不滚动)', () => {
    expect(resolveRevealTarget({ count: 0, revealItemIndex: 0 }).target).toBe(-1)
  })
})

describe('resolveRevealScrollTop — 揭示滚动位置(center vs 贴底)', () => {
  const offsets = buildOffsets(100, uniform, ACTIVITY_ROW_HEIGHT)

  it('center:目标行居中(视口 400,行高 40 ⇒ 目标顶部 - 180)', () => {
    const top = resolveRevealScrollTop({
      offsets: offsets.offsets,
      total: offsets.total,
      target: 50,
      viewportHeight: 400,
      align: 'center',
      rowHeight: ACTIVITY_ROW_HEIGHT,
    })
    expect(top).toBe(50 * ACTIVITY_ROW_HEIGHT - (400 - ACTIVITY_ROW_HEIGHT) / 2)
  })

  it('end:目标行贴底(视口 400 ⇒ 目标底部对齐视口底沿)', () => {
    const top = resolveRevealScrollTop({
      offsets: offsets.offsets,
      total: offsets.total,
      target: 99,
      viewportHeight: 400,
      align: 'end',
      rowHeight: ACTIVITY_ROW_HEIGHT,
    })
    // 末行贴底必然撞到最大滚动位置(内容总高 - 视口高)
    expect(top).toBe(offsets.total - 400)
  })

  it('钳在 [0, total - viewport]:首行贴底不会滚成负值,末行居中不会越界', () => {
    expect(
      resolveRevealScrollTop({
        offsets: offsets.offsets,
        total: offsets.total,
        target: 0,
        viewportHeight: 400,
        align: 'end',
        rowHeight: ACTIVITY_ROW_HEIGHT,
      }),
    ).toBe(0)
    const last = resolveRevealScrollTop({
      offsets: offsets.offsets,
      total: offsets.total,
      target: 99,
      viewportHeight: 400,
      align: 'center',
      rowHeight: ACTIVITY_ROW_HEIGHT,
    })
    expect(last).toBe(offsets.total - 400)
  })

  it('target -1 ⇒ 0(不滚动)', () => {
    expect(
      resolveRevealScrollTop({
        offsets: offsets.offsets,
        total: offsets.total,
        target: -1,
        viewportHeight: 400,
        align: 'end',
      }),
    ).toBe(0)
  })
})

describe('planActivityWindow — 三态降级(条目少 / 几何量不到 ⇒ 全量)', () => {
  it('阳性对照:条目数 ≤ 阈值 ⇒ 未虚拟化 + 全量区间', () => {
    const plan = planActivityWindow({
      count: ACTIVITY_VIRTUAL_THRESHOLD,
      readMeasuredHeight: () => undefined,
      scrollTop: 0,
      viewportHeight: 360,
    })
    expect(plan.virtualized).toBe(false)
    expect(plan.start).toBe(0)
    expect(plan.end).toBe(ACTIVITY_VIRTUAL_THRESHOLD - 1)
    expect(plan.paddingTop).toBe(0)
    expect(plan.paddingBottom).toBe(0)
    expect(plan.offsets).toEqual([])
  })

  it('视口量不到(clientHeight = 0)⇒ 全量挂载,不得猜区间', () => {
    const plan = planActivityWindow({
      count: 500,
      readMeasuredHeight: () => undefined,
      scrollTop: 0,
      viewportHeight: 0,
    })
    expect(plan.virtualized).toBe(false)
    expect(plan.end).toBe(499)
    expect(plan.offsets).toEqual([])
  })

  it('视口是 NaN / Infinity 同样判"量不到" ⇒ 全量', () => {
    for (const viewportHeight of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const plan = planActivityWindow({
        count: 500,
        readMeasuredHeight: () => undefined,
        scrollTop: 0,
        viewportHeight,
      })
      expect(plan.virtualized).toBe(false)
      expect(plan.end).toBe(499)
    }
  })

  it('行高全塌缩(每行都量到 0)⇒ 几何不可用 ⇒ 全量', () => {
    const plan = planActivityWindow({
      count: 500,
      readMeasuredHeight: () => 0,
      scrollTop: 0,
      viewportHeight: 360,
    })
    expect(plan.virtualized).toBe(false)
    expect(plan.end).toBe(499)
  })

  it('几何可用 ⇒ 只挂可见行 ± overscan,占位守恒', () => {
    const plan = planActivityWindow({
      count: 500,
      readMeasuredHeight: () => undefined,
      scrollTop: 4000,
      viewportHeight: 360,
    })
    expect(plan.virtualized).toBe(true)
    expect(plan.start).toBe(100 - ACTIVITY_OVERSCAN)
    expect(plan.end - plan.start + 1).toBeLessThanOrEqual(MAX_MOUNTED_ITEMS)
    // 占位守恒:顶部 + 窗口内实测/估计高 + 底部 = 内容总高
    const insideHeight = (plan.end - plan.start + 1) * ACTIVITY_ROW_HEIGHT
    expect(plan.paddingTop + insideHeight + plan.paddingBottom).toBe(plan.total)
  })

  it('不变量:窗口完整覆盖视口行(可见内容永不被裁剪)', () => {
    const plan = planActivityWindow({
      count: 500,
      readMeasuredHeight: () => undefined,
      scrollTop: 2000,
      viewportHeight: 400,
    })
    const coreStart = Math.floor(2000 / ACTIVITY_ROW_HEIGHT)
    const coreEnd = Math.ceil((2000 + 400) / ACTIVITY_ROW_HEIGHT) - 1
    expect(plan.start).toBeLessThanOrEqual(coreStart)
    expect(plan.end).toBeGreaterThanOrEqual(coreEnd)
  })

  it('窗口数学与 windowing.ts 同源:改该文件的估计高常量,本层读数跟着变', () => {
    // 本层传活动行档 40;若某天 windowing 的 buildOffsets 不再吃注入行高(第二套数学),
    // 这条会当场红 —— 它是"没重写第二套窗口数学"的机器证据。
    const mine = planActivityWindow({
      count: 100,
      readMeasuredHeight: () => undefined,
      scrollTop: 0,
      viewportHeight: 360,
    })
    const theirs = resolveVisibleWindow({
      count: 100,
      offsets: buildOffsets(100, () => undefined, ACTIVITY_ROW_HEIGHT).offsets,
      scrollTop: 0,
      viewportHeight: 360,
      bufferItems: ACTIVITY_OVERSCAN,
    })
    expect(mine.start).toBe(theirs.start)
    expect(mine.end).toBe(theirs.end)
    // 活动行档与消息行档必须是两个值(否则"分档"是假的)
    expect(ACTIVITY_ROW_HEIGHT).toBeLessThan(ESTIMATED_ITEM_HEIGHT)
  })

  it('count = 0 ⇒ 空窗口(start > end)', () => {
    const plan = planActivityWindow({
      count: 0,
      readMeasuredHeight: () => undefined,
      scrollTop: 0,
      viewportHeight: 360,
    })
    expect(plan.end).toBeLessThan(plan.start)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
