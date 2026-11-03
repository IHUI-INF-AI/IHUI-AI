// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D20 会话置顶接线层(togglePinnedItem)行为测试 —— 无库、无网络:
// setPinned 一律注入 mock,断言的是"调了哪个方法、参数对不对、失败有没有反馈、
// 列表顺序变没变"(AGENTS:断言行为,不断言快照)。
import { describe, expect, it, vi } from 'vitest'
import { togglePinnedItem, type PinStatefulItem } from '../conversation-pin'

interface Row extends PinStatefulItem {
  id?: string
  pinned?: boolean
  name: string
}

const rows = (names: string[]): Row[] => names.map((name) => ({ id: name, name }))

describe('togglePinnedItem — 会话置顶切换(小程序 / RN 共用出口)', () => {
  it('成功置顶:以 (id, true) 调用注入的网络出口,目标行 pinned 翻为 true', async () => {
    const setPinned = vi.fn(async () => ({ conversation: { id: 'b' } }))
    const list = rows(['a', 'b', 'c'])
    const outcome = await togglePinnedItem(list, 'b', true, setPinned)

    expect(setPinned).toHaveBeenCalledTimes(1)
    expect(setPinned).toHaveBeenCalledWith('b', true)
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      const b = outcome.items.find((r) => r.id === 'b')
      expect(b?.pinned).toBe(true)
    }
  })

  it('成功置顶后列表按"置顶优先"重排,非置顶行保持原相对顺序(稳定排序)', async () => {
    const setPinned = vi.fn(async () => undefined)
    const list = rows(['a', 'b', 'c', 'd'])
    const outcome = await togglePinnedItem(list, 'c', true, setPinned)

    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.items.map((r) => r.name)).toEqual(['c', 'a', 'b', 'd'])
    }
  })

  it('取消置顶:以 (id, false) 调用,该行 pinned 落回 false;稳定排序下其余行相对顺序不变', async () => {
    const setPinned = vi.fn(async () => undefined)
    const list = [
      { id: 'x', name: 'plain-1' },
      { id: 'p', name: 'pinned-row', pinned: true },
      { id: 'y', name: 'plain-2' },
    ] satisfies Row[]
    const outcome = await togglePinnedItem(list, 'p', false, setPinned)

    expect(setPinned).toHaveBeenCalledWith('p', false)
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.items.find((r) => r.id === 'p')?.pinned).toBe(false)
      expect(outcome.items.map((r) => r.name)).toEqual(['plain-1', 'pinned-row', 'plain-2'])
    }
  })

  it('多个已置顶行:取消其中一个,其余置顶行仍居前(落排位由下次服务端拉序收敛)', async () => {
    const setPinned = vi.fn(async () => undefined)
    const list: Row[] = [
      { id: 'p1', name: 'p1', pinned: true },
      { id: 'p2', name: 'p2', pinned: true },
      { id: 'n1', name: 'n1' },
    ]
    const outcome = await togglePinnedItem(list, 'p1', false, setPinned)

    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.items.map((r) => r.name)).toEqual(['p2', 'p1', 'n1'])
    }
  })

  it('网络出口失败:ok:false 且携带原因,列表原样返回(调用方必须可见反馈,不得静默)', async () => {
    const boom = new Error('403 forbidden')
    const setPinned = vi.fn(async () => {
      throw boom
    })
    const list = rows(['a', 'b'])
    const outcome = await togglePinnedItem(list, 'a', true, setPinned)

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error).toBe(boom)
      expect(outcome.items).toEqual(list)
    }
  })

  it('不可变性:成功与失败都不改动入参数组与入参行对象', async () => {
    const list = rows(['a', 'b'])
    const snapshot = JSON.stringify(list)

    const okOutcome = await togglePinnedItem(list, 'a', true, async () => undefined)
    expect(okOutcome.ok).toBe(true)
    expect(JSON.stringify(list)).toBe(snapshot)

    const failOutcome = await togglePinnedItem(list, 'a', true, async () => {
      throw new Error('net down')
    })
    expect(failOutcome.ok).toBe(false)
    expect(JSON.stringify(list)).toBe(snapshot)
  })

  it('id 不匹配任何行:调用照常发生,返回列表仅整体按既有 pinned 稳定重排', async () => {
    const setPinned = vi.fn(async () => undefined)
    const list: Row[] = [
      { id: 'a', name: 'a' },
      { id: 'b', name: 'b', pinned: true },
    ]
    const outcome = await togglePinnedItem(list, 'ghost', true, setPinned)

    expect(setPinned).toHaveBeenCalledWith('ghost', true)
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.items.map((r) => r.name)).toEqual(['b', 'a'])
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
