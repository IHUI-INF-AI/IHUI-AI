// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-708 回归锁(2026-11-13)。
 *
 * 病灶:watchdog 续约时任何异常都 `catch { this.stopWatchdog(lock.name) }` ——
 * 一次 Redis 抖动即永久停止续约，且不通知持有者；TTL 到期后其它副本可获取锁，
 * 导致临界区双持有。
 *
 * 本文件锁:
 *   ① 单次网络/Redis 异常不停表，连续 maxRenewFailures(默认 3) 次才停表；
 *   ② 停表时通过 lock.lost (AbortSignal, reason=LockLostReason) 通知持有者；
 *   ③ renew 返回 false(锁已不属于我) 属于确定丢失，立即停表并通知；
 *   ④ 正常续约不停表、不误报丢失；
 *   ⑤ 续约挂死时超时计为一次异常，watchdog interval 不被冻结。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Redis } from 'ioredis'
import { DistributedLock } from '../src/utils/distributed-lock'

const LOCK_NAME = 'f708:watchdog:lock'
const INTERVAL_MS = 100

function createMockRedis(overrides: Partial<Redis> = {}): Redis {
  return {
    set: vi.fn().mockResolvedValue('OK'),
    eval: vi.fn().mockResolvedValue(1),
    ...overrides,
  } as unknown as Redis
}

describe('F-708 watchdog 续约失败重试与丢失通知', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // logger 未注入 Fastify 时回退 console.warn，避免测试输出噪音
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('单次网络异常不停表，后续续约成功则清零失败计数', async () => {
    let calls = 0
    const evalMock = vi.fn(async () => {
      calls++
      if (calls === 1) throw new Error('ECONNRESET')
      return 1
    })
    const locker = new DistributedLock(
      createMockRedis({ eval: evalMock as unknown as Redis['eval'] }),
    )
    const lock = await locker.tryLock(LOCK_NAME, undefined, {
      ttlMs: 3000,
      watchdog: true,
      watchdogIntervalMs: INTERVAL_MS,
    })
    expect(lock).not.toBeNull()

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(evalMock).toHaveBeenCalledTimes(1)
    // 单次异常必须保留 watchdog，且不得误报丢失
    expect(lock!.lost.aborted).toBe(false)

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(evalMock).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3)
    expect(evalMock).toHaveBeenCalledTimes(5)
    expect(lock!.lost.aborted).toBe(false)

    await lock!.release()
  })

  it('连续 3 次异常才停表，并通过 lost 通知持有者', async () => {
    const evalMock = vi.fn().mockRejectedValue(new Error('Redis connection lost'))
    const locker = new DistributedLock(
      createMockRedis({ eval: evalMock as unknown as Redis['eval'] }),
    )
    const lock = await locker.tryLock(LOCK_NAME, undefined, {
      ttlMs: 3000,
      watchdog: true,
      watchdogIntervalMs: INTERVAL_MS,
    })

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(evalMock).toHaveBeenCalledTimes(1)
    expect(lock!.lost.aborted).toBe(false)

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(evalMock).toHaveBeenCalledTimes(2)
    expect(lock!.lost.aborted).toBe(false)

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(evalMock).toHaveBeenCalledTimes(3)
    expect(lock!.lost.aborted).toBe(true)
    expect(lock!.lost.reason).toBe('renew-failed')

    // 停表后不再续约
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3)
    expect(evalMock).toHaveBeenCalledTimes(3)
  })

  it('renew 返回非本持有者时立即停表并通知', async () => {
    const evalMock = vi.fn().mockResolvedValue(0)
    const locker = new DistributedLock(
      createMockRedis({ eval: evalMock as unknown as Redis['eval'] }),
    )
    const lock = await locker.tryLock(LOCK_NAME, undefined, {
      ttlMs: 3000,
      watchdog: true,
      watchdogIntervalMs: INTERVAL_MS,
    })

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(evalMock).toHaveBeenCalledTimes(1)
    expect(lock!.lost.aborted).toBe(true)
    expect(lock!.lost.reason).toBe('not-owner')

    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3)
    expect(evalMock).toHaveBeenCalledTimes(1)
  })

  it('正常续约持续进行且不触发丢失通知', async () => {
    const evalMock = vi.fn().mockResolvedValue(1)
    const locker = new DistributedLock(
      createMockRedis({ eval: evalMock as unknown as Redis['eval'] }),
    )
    const lock = await locker.tryLock(LOCK_NAME, undefined, {
      ttlMs: 3000,
      watchdog: true,
      watchdogIntervalMs: INTERVAL_MS,
    })

    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 5)
    expect(evalMock).toHaveBeenCalledTimes(5)
    expect(lock!.lost.aborted).toBe(false)

    await lock!.release()
  })

  it('续约挂死时超时计为一次异常，watchdog interval 不被冻结', async () => {
    const evalMock = vi.fn().mockReturnValue(new Promise<number>(() => undefined))
    const locker = new DistributedLock(
      createMockRedis({ eval: evalMock as unknown as Redis['eval'] }),
    )
    const lock = await locker.tryLock(LOCK_NAME, undefined, {
      ttlMs: 3000,
      watchdog: true,
      watchdogIntervalMs: INTERVAL_MS,
      renewTimeoutMs: 30,
    })

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(evalMock).toHaveBeenCalledTimes(1)

    // 超时 → 记一次失败，但未达阈值，不停表
    await vi.advanceTimersByTimeAsync(30)
    expect(lock!.lost.aborted).toBe(false)

    // 下一个 interval 仍会发起续约，说明 interval 没被挂死的 renew 冻结
    await vi.advanceTimersByTimeAsync(70)
    expect(evalMock).toHaveBeenCalledTimes(2)
    expect(lock!.lost.aborted).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
