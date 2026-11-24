// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-708 回归锁:watchdog 续约失败必须通知持有者(onLost),不得静默停表。
 *
 * 修复前:renew 返回 false 或抛异常均只 stopWatchdog + stats.expired++,catch 分支静默,
 * 持有者毫不知情地继续执行 —— 互斥语义已破(别人持锁)而本侧还在跑。
 * 修复后:renew-false / renew-error 两条路径都回调 lock.onLost,携带原因与底层异常。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { DistributedLock } from '../distributed-lock.js'

/** 最小假 Redis:只实现本测试用到的 set / eval(Renew 脚本)/ 命令。 */
function makeFakeRedis(opts: { renewReturns?: number; renewThrows?: Error }) {
  const store = new Map<string, string>()
  const redis = {
    async set(key: string, token: string, _nx: string, _px: string, _ttl: string) {
      if (store.has(key)) return null
      store.set(key, token)
      return 'OK'
    },
    async eval(_script: string, _num: number, _key: string, _token: string, _ttl: string) {
      if (opts.renewThrows) throw opts.renewThrows
      return opts.renewReturns ?? 1
    },
    async del(key: string) {
      return store.delete(key) ? 1 : 0
    },
    // release 走的 Lua 校验 token;这里简化为 del(测试只关心 watchdog,不关心 token 校验)
  }
  return redis as unknown as Parameters<DistributedLock['tryLock']>[0] extends never
    ? never
    : ConstructorParameters<typeof DistributedLock>[0]
}

describe('DistributedLock watchdog 续约失败通知 (F-708)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renew 返回 false(锁已被夺走)⇒ 停表 + 通知 onLost("renew-false")', async () => {
    const onLost = vi.fn()
    const redis = makeFakeRedis({ renewReturns: 0 }) // 续约恒失败
    const lock = new DistributedLock(redis)

    const acquired = await lock.tryLock('lock-a', 'owner-1', {
      ttlMs: 100,
      watchdog: true,
      watchdogIntervalMs: 50,
      onLost,
    })
    expect(acquired).not.toBeNull()

    // 推进时间触发一次 watchdog 续约
    await vi.advanceTimersByTimeAsync(60)
    expect(onLost).toHaveBeenCalledTimes(1)
    expect(onLost).toHaveBeenCalledWith('renew-false', undefined)
  })

  it('renew 抛异常(Redis 抖动)⇒ 停表 + 通知 onLost("renew-error", 异常)', async () => {
    const onLost = vi.fn()
    const boom = new Error('redis down')
    const redis = makeFakeRedis({ renewThrows: boom })
    const lock = new DistributedLock(redis)

    const acquired = await lock.tryLock('lock-b', 'owner-2', {
      ttlMs: 100,
      watchdog: true,
      watchdogIntervalMs: 50,
      // F-708 默认容忍连续 3 次抖动;本用例要钉的是"抛异常这一型会通知",
      // 故显式把容忍数压到 1,一次续约失败即停表通知。
      maxRenewFailures: 1,
      onLost,
    })
    expect(acquired).not.toBeNull()

    await vi.advanceTimersByTimeAsync(60)
    expect(onLost).toHaveBeenCalledTimes(1)
    expect(onLost).toHaveBeenCalledWith('renew-error', boom)
  })

  it('续约成功(renew=1)⇒ 不通知 onLost(锁仍持有)', async () => {
    const onLost = vi.fn()
    const redis = makeFakeRedis({ renewReturns: 1 })
    const lock = new DistributedLock(redis)

    const acquired = await lock.tryLock('lock-c', 'owner-3', {
      ttlMs: 1000,
      watchdog: true,
      watchdogIntervalMs: 50,
      onLost,
    })
    expect(acquired).not.toBeNull()

    await vi.advanceTimersByTimeAsync(200)
    expect(onLost).not.toHaveBeenCalled()
  })

  it('不传 onLost ⇒ 维持旧行为(停表但不抛、不通知),向后兼容', async () => {
    const redis = makeFakeRedis({ renewReturns: 0 })
    const lock = new DistributedLock(redis)

    const acquired = await lock.tryLock('lock-d', 'owner-4', {
      ttlMs: 100,
      watchdog: true,
      watchdogIntervalMs: 50,
    })
    expect(acquired).not.toBeNull()

    // 不应因 onLost 缺失而抛异常(旧行为:静默停表)
    await expect(vi.advanceTimersByTimeAsync(60)).resolves.not.toThrow()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
