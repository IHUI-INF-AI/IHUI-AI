// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-715 回归锁:死信队列读路径(get/list/replay)必须惰性淘汰过期条目。
 *
 * 修复前:evictLocked 只在 push 时调用,get/list 看得见过期死信、replay 还能重投,
 * 违反 retentionSec 语义(过期 = 不再消耗重试资源)。
 * 修复后:读路径先淘汰过期条目;未知 id 与过期条目一律 NOOP(F-715 起不再与 DROP 重载),
 */
import { describe, it, expect } from 'vitest'

import { DeadLetterQueue, DLQAction, DEFAULT_DLQ_CONFIG } from '../dead-letter-queue.js'

/** 直接向内部 Map 注入一条指定 lastTs 的死信(绕过 push 的 maxAttempts 闸)。 */
function injectItem(q: DeadLetterQueue, taskId: string, lastTs: number): void {
  q['items'].set(taskId, {
    taskId,
    name: `job-${taskId}`,
    payload: { n: 1 },
    lastError: 'boom',
    attempts: DEFAULT_DLQ_CONFIG.maxAttempts,
    firstTs: lastTs,
    lastTs,
    history: ['boom'],
  })
}

describe('DeadLetterQueue 读路径惰性淘汰 (F-715)', () => {
  it('get: 过期条目返回 undefined 并从队列摘除,未过期条目原样返回', () => {
    const q = new DeadLetterQueue({ retentionSec: 100 })
    const now = Date.now() / 1000
    injectItem(q, 'fresh', now - 10) // 10s 前,未过期
    injectItem(q, 'stale', now - 1000) // 1000s 前,已过期(>100s)

    expect(q.get('fresh')).not.toBeUndefined()
    expect(q.get('fresh')?.taskId).toBe('fresh')
    // 过期条目不可见
    expect(q.get('stale')).toBeUndefined()
    // 且已被真正摘除(不是每次读都重新判)
    expect(q.get('stale')).toBeUndefined()
  })

  it('list: 过期条目先被淘汰再截断,不污染可见集', () => {
    const q = new DeadLetterQueue({ retentionSec: 100 })
    const now = Date.now() / 1000
    injectItem(q, 'a', now - 1)
    injectItem(q, 'b', now - 1000)
    injectItem(q, 'c', now - 2)

    const listed = q.list(100)
    expect(listed.map((i) => i.taskId)).toEqual(['a', 'c'])
  })

  it('replay: 过期条目一律 NOOP 并摘除,不送入重投器', () => {
    const seen: string[] = []
    const q = new DeadLetterQueue({ retentionSec: 100 }, (item) => {
      seen.push(item.taskId)
      return true
    })
    const now = Date.now() / 1000
    injectItem(q, 'fresh', now - 1)
    injectItem(q, 'stale', now - 1000)

    // 过期 → NOOP,重投器不被调用
    expect(q.replay('stale')).toBe(DLQAction.NOOP)
    expect(seen).toEqual([])
    // 未过期 → 正常送入重投器,成功则 REPLAY
    expect(q.replay('fresh')).toBe(DLQAction.REPLAY)
    expect(seen).toEqual(['fresh'])
  })

  it('replay: 未知 id 返回 NOOP(不新建条目、不触发重投器)', () => {
    const q = new DeadLetterQueue({ retentionSec: 100 }, () => true)
    expect(q.replay('nonexistent')).toBe(DLQAction.NOOP)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
