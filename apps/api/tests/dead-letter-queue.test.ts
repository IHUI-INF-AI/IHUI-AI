import { describe, it, expect, vi } from 'vitest'
import { DeadLetterQueue, DLQAction } from '../src/utils/dead-letter-queue.js'

describe('DeadLetterQueue push 阈值', () => {
  it('attempts < maxAttempts 时不入队,返回 null', () => {
    const q = new DeadLetterQueue({ maxAttempts: 3 })
    expect(q.push('t1', 'task', {}, 'err', 2)).toBeNull()
    expect(q.stats().size).toBe(0)
  })

  it('attempts >= maxAttempts 时入队,返回 DeadLetter', () => {
    const q = new DeadLetterQueue({ maxAttempts: 3 })
    const item = q.push('t1', 'task', { x: 1 }, 'boom', 3)
    expect(item).not.toBeNull()
    expect(item?.taskId).toBe('t1')
    expect(item?.attempts).toBe(3)
    expect(item?.history).toEqual(['boom'])
    expect(q.stats().size).toBe(1)
  })

  it('重复 push 同 taskId 时更新 attempts/lastError/history', () => {
    const q = new DeadLetterQueue({ maxAttempts: 3 })
    q.push('t1', 'task', {}, 'err1', 3)
    const item = q.push('t1', 'task', {}, 'err2', 5)
    expect(item?.attempts).toBe(5)
    expect(item?.lastError).toBe('err2')
    expect(item?.history).toEqual(['err1', 'err2'])
    expect(q.stats().size).toBe(1)
  })
})

describe('DeadLetterQueue maxSize 淘汰', () => {
  it('超过 maxSize 时按 firstTs 删除最旧', async () => {
    const q = new DeadLetterQueue({ maxAttempts: 1, maxSize: 2 })
    q.push('t1', 'a', {}, 'e1', 1)
    // 用 setTimeout 让 firstTs 递增
    await new Promise((r) => setTimeout(r, 5))
    q.push('t2', 'b', {}, 'e2', 1)
    await new Promise((r) => setTimeout(r, 5))
    q.push('t3', 'c', {}, 'e3', 1)
    expect(q.stats().size).toBe(2)
    // t1 最早被淘汰
    expect(q.get('t1')).toBeUndefined()
    expect(q.get('t2')).toBeDefined()
    expect(q.get('t3')).toBeDefined()
  })
})

describe('DeadLetterQueue replay', () => {
  it('无 replayFn 时返回 QUARANTINE', () => {
    const q = new DeadLetterQueue({ maxAttempts: 1 })
    q.push('t1', 'a', {}, 'e', 1)
    expect(q.replay('t1')).toBe(DLQAction.QUARANTINE)
  })

  it('replayFn 返回 true 时返回 REPLAY 并移除', () => {
    const fn = vi.fn().mockReturnValue(true)
    const q = new DeadLetterQueue({ maxAttempts: 1 }, fn)
    q.push('t1', 'a', {}, 'e', 1)
    expect(q.replay('t1')).toBe(DLQAction.REPLAY)
    expect(q.get('t1')).toBeUndefined()
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ taskId: 't1' }))
  })

  it('replayFn 返回 false 时返回 QUARANTINE 保留', () => {
    const fn = vi.fn().mockReturnValue(false)
    const q = new DeadLetterQueue({ maxAttempts: 1 }, fn)
    q.push('t1', 'a', {}, 'e', 1)
    expect(q.replay('t1')).toBe(DLQAction.QUARANTINE)
    expect(q.get('t1')).toBeDefined()
  })

  it('replayFn 抛错时返回 QUARANTINE 保留', () => {
    const fn = vi.fn().mockImplementation(() => {
      throw new Error('boom')
    })
    const q = new DeadLetterQueue({ maxAttempts: 1 }, fn)
    q.push('t1', 'a', {}, 'e', 1)
    expect(q.replay('t1')).toBe(DLQAction.QUARANTINE)
    expect(q.get('t1')).toBeDefined()
  })

  it('不存在的 taskId 返回 DROP', () => {
    const q = new DeadLetterQueue({ maxAttempts: 1 })
    expect(q.replay('missing')).toBe(DLQAction.DROP)
  })
})

describe('DeadLetterQueue remove/list/exportJSON', () => {
  it('remove 删除指定 taskId', () => {
    const q = new DeadLetterQueue({ maxAttempts: 1 })
    q.push('t1', 'a', {}, 'e', 1)
    expect(q.remove('t1')).toBe(true)
    expect(q.get('t1')).toBeUndefined()
  })

  it('remove 不存在的返回 false', () => {
    const q = new DeadLetterQueue({ maxAttempts: 1 })
    expect(q.remove('missing')).toBe(false)
  })

  it('list 限制返回数量', () => {
    const q = new DeadLetterQueue({ maxAttempts: 1 })
    for (let i = 0; i < 5; i++) q.push(`t${i}`, 'a', {}, 'e', 1)
    expect(q.list(3)).toHaveLength(3)
    expect(q.list()).toHaveLength(5)
  })

  it('exportJSON 包含关键字段且不含 payload', () => {
    const q = new DeadLetterQueue({ maxAttempts: 1 })
    q.push('t1', 'a', { secret: 'hidden' }, 'err', 1)
    const json = q.exportJSON()
    const parsed = JSON.parse(json)
    expect(parsed[0].taskId).toBe('t1')
    expect(parsed[0].lastError).toBe('err')
    expect(JSON.stringify(parsed)).not.toContain('hidden')
  })
})

describe('DeadLetterQueue 默认配置', () => {
  it('maxAttempts=5, maxSize=10000, retentionSec=7d', () => {
    const q = new DeadLetterQueue()
    // 5 次才入队
    expect(q.push('t1', 'a', {}, 'e', 4)).toBeNull()
    expect(q.push('t1', 'a', {}, 'e', 5)).not.toBeNull()
  })
})
