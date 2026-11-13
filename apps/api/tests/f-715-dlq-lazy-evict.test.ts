__F715_HEADER_PLACEHOLDER__

/**
 * F-715 回归锁(2026-11-13).
 *
 * 病灶:TTL/容量清理 evictLocked 只挂在 push 写路径, get()/list()/stats()/exportJSON()
 * 直接读 Map ⇒ 过期死信在无新写入时仍可见、仍可被 replay 重投;
 * 且 replay('不存在的id') 返回 DROP, 把"未知 id"与"主动丢弃"两种语义重载。
 * 修法:读路径先惰性淘汰; 未知/已过期 id 返回新增的 DLQAction.NOOP。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DeadLetterQueue, DLQAction } from '../src/utils/dead-letter-queue.js'

const T0 = new Date('2026-11-13T00:00:00.000Z').getTime()
const RETENTION = 60

describe('F-715 DLQ 读路径惰性淘汰', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('超过 retentionSec 后 list/get/stats/exportJSON 不再暴露过期死信', () => {
    const q = new DeadLetterQueue({ maxAttempts: 1, retentionSec: RETENTION })
    q.push('t1', 'task', {}, 'boom', 1)
    expect(q.list()).toHaveLength(1)
    expect(q.stats().size).toBe(1)

    vi.setSystemTime(T0 + (RETENTION + 1) * 1000)

    expect(q.get('t1')).toBeUndefined()
    expect(q.list()).toHaveLength(0)
    expect(q.stats().size).toBe(0)
    expect(JSON.parse(q.exportJSON())).toHaveLength(0)
  })

  it('未过期死信在读路径上仍然可见 (不做过度淘汰)', () => {
    const q = new DeadLetterQueue({ maxAttempts: 1, retentionSec: RETENTION })
    q.push('t1', 'task', {}, 'boom', 1)
    vi.setSystemTime(T0 + (RETENTION - 1) * 1000)
    expect(q.get('t1')?.taskId).toBe('t1')
    expect(q.list()).toHaveLength(1)
    expect(q.stats().size).toBe(1)
  })

  it('replay 过期死信不得重投, 返回 NOOP', () => {
    const fn = vi.fn().mockReturnValue(true)
    const q = new DeadLetterQueue({ maxAttempts: 1, retentionSec: RETENTION }, fn)
    q.push('t1', 'task', {}, 'boom', 1)
    vi.setSystemTime(T0 + (RETENTION + 1) * 1000)
    expect(q.replay('t1')).toBe(DLQAction.NOOP)
    expect(fn).not.toHaveBeenCalled()
  })

  it('replay 不存在的 id 返回 NOOP 而非 DROP', () => {
    const q = new DeadLetterQueue({ maxAttempts: 1 })
    expect(q.replay('missing')).toBe(DLQAction.NOOP)
    expect(q.replay('missing')).not.toBe(DLQAction.DROP)
  })

  it('push 容量上限与最旧优先淘汰语义不变', () => {
    const q = new DeadLetterQueue({ maxAttempts: 2, maxSize: 2, retentionSec: RETENTION })
    expect(q.push('t0', 'a', {}, 'e0', 1)).toBeNull()
    q.push('t1', 'a', {}, 'e1', 2)
    vi.setSystemTime(T0 + 1000)
    q.push('t2', 'a', {}, 'e2', 2)
    vi.setSystemTime(T0 + 2000)
    q.push('t3', 'a', {}, 'e3', 2)
    expect(q.stats().size).toBe(2)
    expect(q.get('t1')).toBeUndefined()
    expect(q.get('t2')).toBeDefined()
    expect(q.get('t3')).toBeDefined()
  })
})
