import { describe, it, expect, vi } from 'vitest'
import { HotConfigCenter } from '../src/utils/hot-config.js'

describe('HotConfigCenter get/set', () => {
  it('未设置时返回默认值', () => {
    const c = new HotConfigCenter()
    expect(c.get('missing')).toBeUndefined()
    expect(c.get('missing', 'fallback')).toBe('fallback')
  })

  it('设置后能读取,version 递增', () => {
    const c = new HotConfigCenter()
    const v0 = c.stats().version
    const ch = c.set('feature.flag', true)
    expect(ch).not.toBeNull()
    expect(c.get('feature.flag')).toBe(true)
    expect(c.stats().version).toBe(v0 + 1)
  })

  it('值未变时返回 null 且不递增 version', () => {
    const c = new HotConfigCenter()
    c.set('a', 1)
    const v1 = c.stats().version
    const ch = c.set('a', 1)
    expect(ch).toBeNull()
    expect(c.stats().version).toBe(v1)
  })

  it('值从 undefined 变为具体值时返回 old=undefined', () => {
    const c = new HotConfigCenter()
    const ch = c.set('a', 1)
    expect(ch?.old).toBeUndefined()
    expect(ch?.new).toBe(1)
  })
})

describe('HotConfigCenter bulkSet', () => {
  it('批量设置只返回有变化的 key', () => {
    const c = new HotConfigCenter()
    c.set('existing', 1)
    const changes = c.bulkSet({ existing: 1, new1: 'x', new2: 'y' })
    expect(changes).toHaveLength(2)
    expect(changes.map((c) => c.key).sort()).toEqual(['new1', 'new2'])
  })
})

describe('HotConfigCenter subscribe (按 key)', () => {
  it('set 触发对应 key 的订阅者', () => {
    const c = new HotConfigCenter()
    const cb = vi.fn()
    c.subscribe('a', cb)
    c.set('a', 1)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb.mock.calls[0][0].key).toBe('a')
    expect(cb.mock.calls[0][0].new).toBe(1)
  })

  it('多个订阅者按注册顺序触发', () => {
    const c = new HotConfigCenter()
    const calls: string[] = []
    c.subscribe('a', () => calls.push('first'))
    c.subscribe('a', () => calls.push('second'))
    c.set('a', 1)
    expect(calls).toEqual(['first', 'second'])
  })

  it('订阅者抛错不影响其他订阅者', () => {
    const c = new HotConfigCenter()
    const after = vi.fn()
    c.subscribe('a', () => {
      throw new Error('boom')
    })
    c.subscribe('a', after)
    c.set('a', 1)
    expect(after).toHaveBeenCalledTimes(1)
  })

  it('未变化的 set 不触发订阅者', () => {
    const c = new HotConfigCenter()
    const cb = vi.fn()
    c.subscribe('a', cb)
    c.set('a', 1)
    cb.mockClear()
    c.set('a', 1)
    expect(cb).not.toHaveBeenCalled()
  })
})

describe('HotConfigCenter subscribeAll (全局)', () => {
  it('任何 key 的 set 都触发', () => {
    const c = new HotConfigCenter()
    const cb = vi.fn()
    c.subscribeAll(cb)
    c.set('a', 1)
    c.set('b', 2)
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('与 key 订阅者合并触发', () => {
    const c = new HotConfigCenter()
    const order: string[] = []
    c.subscribe('a', () => order.push('key'))
    c.subscribeAll(() => order.push('global'))
    c.set('a', 1)
    expect(order).toEqual(['key', 'global'])
  })
})

describe('HotConfigCenter diff', () => {
  it('返回与目标不一致的所有 key', () => {
    const c = new HotConfigCenter()
    c.set('a', 1)
    c.set('b', 2)
    const changes = c.diff({ a: 1, b: 99, c: 'new' })
    expect(changes.map((x) => x.key).sort()).toEqual(['b', 'c'])
    expect(changes.find((x) => x.key === 'b')?.new).toBe(99)
  })

  it('完全一致时返回空数组', () => {
    const c = new HotConfigCenter()
    c.set('a', 1)
    expect(c.diff({ a: 1 })).toEqual([])
  })
})

describe('HotConfigCenter snapshot/stats', () => {
  it('snapshot 返回独立副本(修改原 data 不影响 snapshot)', () => {
    const c = new HotConfigCenter()
    c.set('a', 1)
    const s1 = c.snapshot()
    c.set('a', 2)
    expect(s1.data.a).toBe(1)
  })

  it('stats 准确计数 keys 与 subscribers', () => {
    const c = new HotConfigCenter()
    c.set('a', 1)
    c.set('b', 2)
    c.subscribe('a', () => {})
    c.subscribe('a', () => {})
    c.subscribeAll(() => {})
    const s = c.stats()
    expect(s.keys).toBe(2)
    expect(s.subscribers).toBe(3)
  })
})

describe('HotConfigCenter history 容量', () => {
  it('超过 maxHistory 时丢弃最早的记录', () => {
    const c = new HotConfigCenter()
    // 默认 maxHistory = 200
    for (let i = 0; i < 205; i++) c.set('a', i)
    const snap = c.snapshot()
    expect(snap.history).toHaveLength(200)
    // 最早的是第 5 次设置
    expect(snap.history[0]?.new).toBe(5)
    // 最新的是第 204 次
    expect(snap.history[snap.history.length - 1]?.new).toBe(204)
  })
})
