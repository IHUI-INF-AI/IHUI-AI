import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Redis } from 'ioredis'
import { DistributedLock, DistributedLockError } from '../src/utils/distributed-lock'

/** 构造 mock ioredis 客户端 */
function createMockRedis(overrides: Partial<Redis> = {}): Redis {
  return {
    set: vi.fn().mockResolvedValue('OK'),
    eval: vi.fn().mockResolvedValue(1),
    ...overrides,
  } as unknown as Redis
}

describe('DistributedLock tryLock', () => {
  it('获取成功返回 AcquiredLock', async () => {
    const redis = createMockRedis()
    const locker = new DistributedLock(redis)

    const lock = await locker.tryLock('test:lock:1')
    expect(lock).not.toBeNull()
    expect(lock!.name).toBe('test:lock:1')
    expect(lock!.token).toHaveLength(32) // 16 bytes hex
    expect(lock!.ttlMs).toBe(5000)
    expect(lock!.expiresAt).toBeGreaterThan(lock!.acquiredAt)

    // 验证 SET NX PX 调用参数
    expect(redis.set).toHaveBeenCalledWith('test:lock:1', lock!.token, 'PX', 5000, 'NX')
  })

  it('获取失败返回 null (锁已被持有)', async () => {
    const redis = createMockRedis({ set: vi.fn().mockResolvedValue(null) })
    const locker = new DistributedLock(redis)

    const lock = await locker.tryLock('test:lock:2')
    expect(lock).toBeNull()
  })

  it('自定义 TTL 透传到 SET', async () => {
    const redis = createMockRedis()
    const locker = new DistributedLock(redis)

    const lock = await locker.tryLock('test:lock:3', 'owner-1', { ttlMs: 10000 })
    expect(lock!.ttlMs).toBe(10000)
    expect(redis.set).toHaveBeenCalledWith('test:lock:3', lock!.token, 'PX', 10000, 'NX')
  })

  it('自定义 owner 透传到 lock 对象', async () => {
    const redis = createMockRedis()
    const locker = new DistributedLock(redis)

    const lock = await locker.tryLock('test:lock:4', 'my-owner')
    expect(lock!.owner).toBe('my-owner')
  })
})

describe('DistributedLock acquire (阻塞获取)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('首次即成功', async () => {
    const redis = createMockRedis()
    const locker = new DistributedLock(redis)

    const lock = await locker.acquire('test:acquire:1', undefined, { ttlMs: 5000 })
    expect(lock).toBeDefined()
    expect(lock.name).toBe('test:acquire:1')
  })

  it('重试后成功 (首次失败)', async () => {
    const setMock = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('OK')
    const redis = createMockRedis({ set: setMock })
    const locker = new DistributedLock(redis)

    const promise = locker.acquire('test:acquire:2', undefined, {
      ttlMs: 5000,
      waitMs: 1000,
      retryIntervalMs: 100,
    })

    // 推进定时器让重试发生
    await vi.advanceTimersByTimeAsync(150)
    const lock = await promise
    expect(lock).toBeDefined()
    expect(setMock).toHaveBeenCalledTimes(2)
  })

  it('超时抛 DistributedLockError', async () => {
    const redis = createMockRedis({ set: vi.fn().mockResolvedValue(null) })
    const locker = new DistributedLock(redis)

    const promise = locker.acquire('test:acquire:3', undefined, {
      waitMs: 500,
      retryIntervalMs: 100,
    })
    // 提前绑定 catch 防止 unhandled rejection 警告 (advanceTimers 会触发 reject)
    promise.catch(() => {})

    await vi.advanceTimersByTimeAsync(600)
    await expect(promise).rejects.toThrow(DistributedLockError)
  })
})

describe('DistributedLock release', () => {
  it('Lua 返回 1 → RELEASED', async () => {
    const redis = createMockRedis({ eval: vi.fn().mockResolvedValue(1) })
    const locker = new DistributedLock(redis)

    const lock = await locker.tryLock('test:release:1')
    const state = await lock!.release()
    expect(state).toBe('RELEASED')

    // 验证 Lua 脚本调用
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call'),
      1,
      'test:release:1',
      lock!.token,
    )
  })

  it('Lua 返回 0 → EXPIRED (锁已过期或被他人持有)', async () => {
    const redis = createMockRedis({ eval: vi.fn().mockResolvedValue(0) })
    const locker = new DistributedLock(redis)

    const lock = await locker.tryLock('test:release:2')
    const state = await lock!.release()
    expect(state).toBe('EXPIRED')
  })

  it('通过 lock.release() 释放使用正确的 token', async () => {
    const redis = createMockRedis()
    const locker = new DistributedLock(redis)

    const lock = await locker.tryLock('test:release:3')
    await lock!.release()

    expect(redis.eval).toHaveBeenCalledWith(expect.any(String), 1, 'test:release:3', lock!.token)
  })
})

describe('DistributedLock renew', () => {
  it('续约成功返回 true', async () => {
    const redis = createMockRedis({ eval: vi.fn().mockResolvedValue(1) })
    const locker = new DistributedLock(redis)

    const lock = await locker.tryLock('test:renew:1')
    const ok = await lock!.renew()
    expect(ok).toBe(true)
  })

  it('续约失败返回 false (锁已过期)', async () => {
    const redis = createMockRedis({ eval: vi.fn().mockResolvedValue(0) })
    const locker = new DistributedLock(redis)

    const lock = await locker.tryLock('test:renew:2')
    const ok = await lock!.renew(8000)
    expect(ok).toBe(false)
  })

  it('renew 透传新 TTL', async () => {
    const redis = createMockRedis({ eval: vi.fn().mockResolvedValue(1) })
    const locker = new DistributedLock(redis)

    const lock = await locker.tryLock('test:renew:3')
    await lock!.renew(15000)

    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'test:renew:3',
      lock!.token,
      '15000',
    )
  })
})

describe('DistributedLock withLock', () => {
  it('执行 fn 并自动释放', async () => {
    const redis = createMockRedis()
    const locker = new DistributedLock(redis)

    const result = await locker.withLock('test:with:1', 5000, async () => 42)
    expect(result).toBe(42)

    // 验证 release 被调用 (eval 至少调用 1 次：release)
    expect(redis.eval).toHaveBeenCalled()
  })

  it('fn 抛错时仍释放锁', async () => {
    const redis = createMockRedis()
    const locker = new DistributedLock(redis)

    await expect(
      locker.withLock('test:with:2', 5000, async () => {
        throw new Error('business error')
      }),
    ).rejects.toThrow('business error')

    // 确保释放被调用 (eval 用于 release)
    expect(redis.eval).toHaveBeenCalled()
  })

  it('withLock 返回 fn 的返回值 (对象)', async () => {
    const redis = createMockRedis()
    const locker = new DistributedLock(redis)

    const result = await locker.withLock('test:with:3', 5000, async () => ({
      id: 1,
      name: 'test',
    }))
    expect(result).toEqual({ id: 1, name: 'test' })
  })
})

describe('DistributedLock watchdog', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('启用 watchdog 后定时续约', async () => {
    const evalMock = vi.fn().mockResolvedValue(1)
    const redis = createMockRedis({ eval: evalMock })
    const locker = new DistributedLock(redis)

    const lock = await locker.tryLock('test:watchdog:1', undefined, {
      ttlMs: 3000,
      watchdog: true,
      watchdogIntervalMs: 100,
    })

    // 推进时间触发 watchdog 续约
    await vi.advanceTimersByTimeAsync(100)
    expect(evalMock).toHaveBeenCalled()

    await lock!.release()
  })

  it('watchdog 续约失败时自动停止', async () => {
    const evalMock = vi.fn().mockResolvedValue(0) // 续约失败
    const redis = createMockRedis({ eval: evalMock })
    const locker = new DistributedLock(redis)

    const lock = await locker.tryLock('test:watchdog:2', undefined, {
      ttlMs: 3000,
      watchdog: true,
      watchdogIntervalMs: 100,
    })

    await vi.advanceTimersByTimeAsync(100)
    // 续约失败后 watchdog 应停止，不再调用 eval
    const callCountAfterFirst = evalMock.mock.calls.length
    await vi.advanceTimersByTimeAsync(200)
    expect(evalMock.mock.calls.length).toBe(callCountAfterFirst)

    await lock!.release()
  })
})

describe('DistributedLock getStats', () => {
  it('统计 acquired/released/expired/renewed', async () => {
    const redis = createMockRedis()
    const locker = new DistributedLock(redis)

    const lock = await locker.tryLock('test:stats:1')
    await lock!.release()

    const stats = locker.getStats()
    expect(stats.acquired).toBe(1)
    expect(stats.released).toBe(1)
  })
})
