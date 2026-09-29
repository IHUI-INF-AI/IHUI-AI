// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  BOUNDED_ACK_DEFAULT_LIMIT,
  collectSettledAckIds,
  createBoundedAckSet,
  isLiveAckRow,
  selectAckRows,
  type AckRowLike,
  type StorageLike,
} from './bounded-ack-set'

/**
 * 有界持久化 ack 集合 + 版本谓词行选择 单测(2026-09-30,票 G-977996)。
 *
 * 锁定六条不变量:
 *  1. ack 集合超 256 淘汰最早(插入序 = 确认序)
 *  2. 版本不变时谓词(getUnacknowledged)引用稳定;版本 bump 后引用变化
 *  3. 打开会话整批 ack 已结束行后:已结束行消失、在跑行保留
 *  4. 持久化读写往返一致(淘汰同步落盘)
 *  5. 存储不可用只吞不抛(会话内仍生效)
 *  6. 无变化 ack 不 bump 版本不通知
 */

function createMemoryStorage(): StorageLike & { dump(): string | null; load(raw: string): void } {
  let value: string | null = null
  return {
    getItem: (key) => (key ? value : value),
    setItem: (_key, next) => {
      value = next
    },
    dump: () => value,
    load: (raw) => {
      value = raw
    },
  }
}

describe('有界淘汰', () => {
  it('ack 集合超 256 淘汰最早(插入序 = 确认序)', () => {
    const set = createBoundedAckSet({ storage: null })
    const ids = Array.from({ length: BOUNDED_ACK_DEFAULT_LIMIT + 5 }, (_, index) => `run-${index}`)
    set.acknowledge(ids)
    expect(set.size()).toBe(BOUNDED_ACK_DEFAULT_LIMIT)
    // 最早 5 个被逐出,最新保留
    expect(set.isAcknowledged('run-0')).toBe(false)
    expect(set.isAcknowledged('run-4')).toBe(false)
    expect(set.isAcknowledged('run-5')).toBe(true)
    expect(set.isAcknowledged(`run-${BOUNDED_ACK_DEFAULT_LIMIT + 4}`)).toBe(true)
  })

  it('重复 ack 同一 id 不改变集合、不淘汰', () => {
    const set = createBoundedAckSet({ storage: null })
    set.acknowledge(['a', 'b'])
    set.acknowledge(['a', 'b', 'c'])
    expect(set.size()).toBe(3)
    expect(set.isAcknowledged('a')).toBe(true)
  })
})

describe('版本与谓词引用', () => {
  it('版本不变时谓词引用稳定;版本 bump 后引用变化', () => {
    const set = createBoundedAckSet({ storage: null })
    const p1 = set.getUnacknowledged()
    const p2 = set.getUnacknowledged()
    expect(p2).toBe(p1)
    expect(p1('x')).toBe(true) // 未确认

    set.acknowledge(['x'])
    const p3 = set.getUnacknowledged()
    expect(p3).not.toBe(p1)
    expect(p3('x')).toBe(false) // 已确认
    expect(set.getVersion()).toBe(1)
  })

  it('无变化 ack 不 bump 版本不通知;有变化通知订阅者', () => {
    const set = createBoundedAckSet({ storage: null })
    let notifications = 0
    const dispose = set.subscribe(() => {
      notifications += 1
    })
    set.acknowledge(['a'])
    expect(notifications).toBe(1)
    set.acknowledge(['a'])
    expect(notifications).toBe(1)
    expect(set.getVersion()).toBe(1)
    set.acknowledge(['b'])
    expect(notifications).toBe(2)
    dispose()
    set.acknowledge(['c'])
    expect(notifications).toBe(2) // 退订后不再通知
  })
})

describe('行选择', () => {
  const rows: AckRowLike[] = [
    { id: 'live-1', status: 'running' },
    { id: 'ended-1', status: 'completed' },
    { id: 'ended-2', status: 'error' },
  ]

  it('在跑的永远画;已结束的只画未确认', () => {
    const set = createBoundedAckSet({ storage: null })
    const unacknowledged = set.getUnacknowledged()
    // 全部未确认:全画
    expect(selectAckRows(rows, unacknowledged)).toEqual(rows)
    // 打开会话整批 ack 已结束行:已结束行消失、在跑行保留
    set.acknowledge(collectSettledAckIds(rows))
    expect(selectAckRows(rows, set.getUnacknowledged())).toEqual([rows[0]])
  })

  it('折叠整批 ack:collectSettledAckIds 只收非在跑行', () => {
    expect(collectSettledAckIds(rows)).toEqual(['ended-1', 'ended-2'])
    expect(isLiveAckRow({ id: 'q', status: 'queued' })).toBe(true)
    expect(isLiveAckRow({ id: 'd', status: 'done' })).toBe(false)
  })
})

describe('持久化往返', () => {
  it('读写往返一致;淘汰同步落盘', () => {
    const storage = createMemoryStorage()
    const first = createBoundedAckSet({ storage, storageKey: 'ihui:test-ack' })
    const ids = Array.from({ length: BOUNDED_ACK_DEFAULT_LIMIT + 2 }, (_, index) => `run-${index}`)
    first.acknowledge(ids)
    expect(first.size()).toBe(BOUNDED_ACK_DEFAULT_LIMIT)

    // 新实例(重启/新组件)从同一存储恢复:淘汰过的不再回来
    const second = createBoundedAckSet({ storage, storageKey: 'ihui:test-ack' })
    expect(second.size()).toBe(BOUNDED_ACK_DEFAULT_LIMIT)
    expect(second.isAcknowledged('run-0')).toBe(false)
    expect(second.isAcknowledged('run-1')).toBe(false)
    expect(second.isAcknowledged(`run-${BOUNDED_ACK_DEFAULT_LIMIT + 1}`)).toBe(true)
  })

  it('损坏的持久化数据按空集恢复(不抛)', () => {
    const storage = createMemoryStorage()
    storage.load('not-json{')
    expect(() => createBoundedAckSet({ storage, storageKey: 'ihui:broken' })).not.toThrow()
    const set = createBoundedAckSet({ storage, storageKey: 'ihui:broken' })
    expect(set.size()).toBe(0)
    storage.load(JSON.stringify([1, 'ok', null]))
    const partial = createBoundedAckSet({ storage, storageKey: 'ihui:broken' })
    expect(partial.size()).toBe(1)
    expect(partial.isAcknowledged('ok')).toBe(true)
  })

  it('存储不可用只吞不抛,会话内仍生效', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('storage disabled')
      },
      setItem: () => {
        throw new Error('quota exceeded')
      },
    }
    const set = createBoundedAckSet({ storage: throwing, storageKey: 'ihui:throwing' })
    expect(() => set.acknowledge(['a'])).not.toThrow()
    expect(set.isAcknowledged('a')).toBe(true)
    expect(set.size()).toBe(1)
  })
})
