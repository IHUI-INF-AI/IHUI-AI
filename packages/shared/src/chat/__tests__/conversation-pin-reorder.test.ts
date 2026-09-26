// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D20 尾票:取消置顶后条目"立刻落到真实排位"的判据(共享出口侧)。
//
// 与同目录 conversation-pin.test.ts 的分工:那份锁"调用/翻转/稳定重排"的整体行为,
// 本票把判据打在**目标行的落排 index** 上,并且把"应有 index"用**组合计数公式**独立算出
// (remainingPinned + restBefore),而不是再调一次 sortPinnedFirst —— 若期望值也由被测
// 排序函数产出,用例就退化成恒等式(§22c"镜像测试只复读实现就是复读机"同型)。
// 两把尺子(计数公式 vs 实现内部分区扫描)语义相同而形态不同,错位必被差分抓到。
//
// 覆盖两种错位形态(§报告③):
//   · 原地不动型:取消后仍停在置顶区首位 —— 由「pinned 优先不变量」+ index 公式抓到;
//   · 追加末尾型:splice+push 到列表尾 —— 不变量仍成立,单靠它抓不到,由 index 公式抓到。
// 因此本票同时保留两条判据,并各配一条反向对照(坏实现必被同一把尺子判负)。

import { describe, expect, it, vi } from 'vitest'
import { togglePinnedItem } from '../conversation-pin'

interface PinRow {
  id: string
  pinned?: boolean
}

/**
 * 「取消置顶后该行应落在哪个 index」的独立公式(组合计数,不走被测实现):
 * 置顶优先分区稳定排序下,行 X 的落位 = 其余置顶行数量(它们恒在 X 前)
 * + 原列表里排在 X 之前的非置顶行数量(非置顶组保持既有相对次序,X 插进它们之间)。
 */
function trueIndexOfUnpin(items: readonly PinRow[], id: string): number {
  const targetIndex = items.findIndex((r) => r.id === id)
  if (targetIndex < 0) throw new Error(`夹具错误:${id} 不在列表里`)
  const remainingPinned = items.filter((r) => r.id !== id && r.pinned === true).length
  const restBefore = items
    .slice(0, targetIndex)
    .filter((r) => r.id !== id && !r.pinned)
    .length
  return remainingPinned + restBefore
}

/** pinned 优先不变量:一旦出现"未置顶行之后又跟着置顶行",列表就是坏的 */
function pinnedFirstIntact(items: readonly PinRow[]): boolean {
  let seenUnpinned = false
  for (const row of items) {
    if (row.pinned && seenUnpinned) return false
    if (!row.pinned) seenUnpinned = true
  }
  return true
}

describe('取消置顶落位判据 —— 打在 index 上,不打在数组长度上', () => {
  it('多置顶形态:取消首位置顶,落位 index == 计数公式值(1),既不原地也不追加末尾', async () => {
    const initial: PinRow[] = [
      { id: 'A', pinned: true },
      { id: 'B', pinned: true },
      { id: 'C' },
      { id: 'D' },
    ]
    const outcome = await togglePinnedItem(initial, 'A', false, vi.fn(async () => undefined))

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    const ids = outcome.items.map((r) => r.id)
    const landed = ids.indexOf('A')
    // 判据一:index 与独立公式全等(公式值 = 1:剩 1 条置顶 B,C/D 都不在 A 之前)
    expect(landed).toBe(trueIndexOfUnpin(initial, 'A'))
    expect(landed).toBe(1)
    // 判据二:整表满足置顶优先不变量(B 顶在 0 位,A 落到未置顶区头部,C/D 相对次序不变)
    expect(pinnedFirstIntact(outcome.items)).toBe(true)
    expect(ids).toEqual(['B', 'A', 'C', 'D'])
  })

  it('非置顶行在前也有落次可判:混合形态下 A 的落位由 restBefore 项参与(防公式退化为恒 0)', async () => {
    // C 在 A 之前 ⇒ 取消后 A 必须插在 C 之后([C, A, D]),而不是顶格
    const initial: PinRow[] = [{ id: 'C' }, { id: 'A', pinned: true }, { id: 'D' }]
    const outcome = await togglePinnedItem(initial, 'A', false, vi.fn(async () => undefined))

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    const ids = outcome.items.map((r) => r.id)
    expect(ids.indexOf('A')).toBe(trueIndexOfUnpin(initial, 'A'))
    expect(ids).toEqual(['C', 'A', 'D'])
    expect(pinnedFirstIntact(outcome.items)).toBe(true)
  })

  it('反向对照(判据有牙):两种坏实现都过不了上面同一把尺子', async () => {
    const initial: PinRow[] = [
      { id: 'A', pinned: true },
      { id: 'B', pinned: true },
      { id: 'C' },
      { id: 'D' },
    ]
    const expected = trueIndexOfUnpin(initial, 'A')

    // 坏实现一:原地翻标记不重排(取消后仍停在置顶区首位)
    const badInPlace: PinRow[] = initial.map((r) => (r.id === 'A' ? { ...r, pinned: false } : r))
    // 它违反置顶优先不变量(A 已非置顶却排在仍置顶的 B 之前)……
    expect(pinnedFirstIntact(badInPlace)).toBe(false)
    // ……且落位 index 与公式不符。
    expect(badInPlace.map((r) => r.id).indexOf('A')).not.toBe(expected)

    // 坏实现二:摘出后追加到列表末尾
    const target = initial.find((r) => r.id === 'A') as PinRow
    const badPushTail: PinRow[] = [
      ...initial.filter((r) => r.id !== 'A'),
      { ...target, pinned: false },
    ]
    // 注意:push 到末尾**满足**置顶优先不变量 —— 单靠不变量抓不到它,必须靠 index 公式;
    // 这正是本票"两种错位形态各配一把尺"的理由。
    expect(pinnedFirstIntact(badPushTail)).toBe(true)
    expect(badPushTail.map((r) => r.id).indexOf('A')).not.toBe(expected)

    // 真出口对同一夹具的输出必须同时过两把尺子(与上面构成差分对照)。
    const outcome = await togglePinnedItem(initial, 'A', false, vi.fn(async () => undefined))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(pinnedFirstIntact(outcome.items)).toBe(true)
    expect(outcome.items.map((r) => r.id).indexOf('A')).toBe(expected)
  })

  it('服务端失败逐字回滚:返回行与入参行同一对象引用,序与置顶态一动不动(无"UI/数据分叉"半区)', async () => {
    const initial: PinRow[] = [
      { id: 'A', pinned: true },
      { id: 'B', pinned: true },
      { id: 'C' },
    ]
    const boom = new Error('PATCH 500')
    const outcome = await togglePinnedItem(initial, 'A', false, vi.fn(async () => {
      throw boom
    }))

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error).toBe(boom)
    // "逐字回滚"的强判据:不是"看起来一样的新列表",而是**同一批行对象**(引用全等),
    // 于是结构上不存在"数据已变而 UI 说没变"或反之的可能。
    expect(outcome.items).toHaveLength(initial.length)
    initial.forEach((row, i) => {
      expect(outcome.items[i]).toBe(row)
    })
    expect(outcome.items.map((r) => r.id)).toEqual(['A', 'B', 'C'])
    expect(outcome.items[0]?.pinned).toBe(true)
    expect(pinnedFirstIntact(outcome.items)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
