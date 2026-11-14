// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-204 回归锁(2026-11-13)。
 *
 * 病灶:Redis 不可用时 acquireWorkspaceLock 的 catch 静默回退到进程内 Map 锁 ——
 * 无告警、无 TTL、无 owner 语义,多实例下等于没有互斥,进程崩溃后锁还永不清理。
 *
 * 本文件锁:
 *  ① Redis 每次调用都抛错 → 内存锁仍可用,且每次降级都 warn 留痕 + 计数 +1;
 *  ② 同一 owner 重入/续期:token 不变、心跳前推;其他 owner 抢不到;
 *  ③ 非 owner(token 不匹配)不能释放 / 续期;
 *  ④ 超过 TTL 自动失效:他人可抢、旧 token 不能释放新锁、过期锁不可续命;
 *  ⑤ fail-fast 开关打开时抛 WORKSPACE_LOCK_REDIS_UNAVAILABLE,不降级。
 *
 * 只 mock ioredis / config / logger,不连真实 Redis、PG。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const client = {
    // Redis 全挂:每个命令都抛错
    get: vi.fn(async () => {
      throw new Error('redis down')
    }),
    set: vi.fn(async () => {
      throw new Error('redis down')
    }),
    del: vi.fn(async () => {
      throw new Error('redis down')
    }),
    eval: vi.fn(async () => {
      throw new Error('redis down')
    }),
    on: vi.fn(),
    quit: vi.fn(async () => 'OK'),
  }
  return {
    client,
    warn: vi.fn(),
    error: vi.fn(),
    config: { REDIS_URL: 'redis://localhost:8811', WORKSPACE_LOCK_FAIL_FAST: false },
  }
})

vi.mock('ioredis', () => ({
  default: vi.fn(function () {
    return mocks.client
  }),
}))

vi.mock('../src/config/index.js', () => ({ config: mocks.config }))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: mocks.warn, error: mocks.error, debug: vi.fn() },
}))

import {
  acquireWorkspaceLock,
  getWorkspaceLock,
  releaseWorkspaceLock,
  renewWorkspaceLock,
  forceReleaseWorkspaceLock,
  getWorkspaceLockDegradeCount,
  _resetMemoryLocks,
  _resetWorkspaceLockDegradeStats,
} from '../src/services/workspace-lock.js'

const WS = '/repo/f204'

beforeEach(() => {
  mocks.config.WORKSPACE_LOCK_FAIL_FAST = false
  mocks.warn.mockClear()
  _resetMemoryLocks()
  _resetWorkspaceLockDegradeStats()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('F-204 Redis 故障降级:内存锁可用且必须可观测', () => {
  it('① Redis 全挂 → acquire 仍返回内存锁,warn 留痕且降级计数 +1', async () => {
    const info = await acquireWorkspaceLock(WS, 'owner-a')

    expect(info).not.toBeNull()
    expect(info?.holder).toBe('owner-a')
    expect(typeof info?.token).toBe('string')
    expect(getWorkspaceLockDegradeCount()).toBe(1)
    expect(mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('降级'),
      expect.objectContaining({ operation: 'acquire', workspace: WS, degradeCount: 1 }),
    )

    // 降级后的查询也读内存锁(而不是一律报"无锁")
    const held = await getWorkspaceLock(WS)
    expect(held?.token).toBe(info?.token)
  })

  it('② 同一 owner 重入/续期 token 不变;其他 owner 抢不到', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-13T00:00:00.000Z'))

    const first = await acquireWorkspaceLock(WS, 'owner-a', 10)
    expect(first).not.toBeNull()
    const firstHeartbeatAt = first!.heartbeatAt // 重入返回同一对象,先快照

    vi.setSystemTime(new Date('2026-11-13T00:00:05.000Z'))
    const again = await acquireWorkspaceLock(WS, 'owner-a', 10)
    expect(again?.token).toBe(first?.token)
    expect(again?.heartbeatAt).toBeGreaterThan(firstHeartbeatAt)

    // 不同 owner 不能进入临界区
    expect(await acquireWorkspaceLock(WS, 'owner-b', 10)).toBeNull()
    // 续期同样校验 owner
    expect(await renewWorkspaceLock(WS, 'not-owner-token', 10)).toBe(false)
    expect(await renewWorkspaceLock(WS, String(first?.token), 10)).toBe(true)
  })

  it('③ 非 owner 不能释放,owner 释放后锁消失', async () => {
    const info = await acquireWorkspaceLock(WS, 'owner-a')

    expect(await releaseWorkspaceLock(WS, 'bogus-token')).toBe(false)
    expect(await getWorkspaceLock(WS)).not.toBeNull()

    expect(await releaseWorkspaceLock(WS, String(info?.token))).toBe(true)
    expect(await getWorkspaceLock(WS)).toBeNull()
  })

  it('④ 超过 TTL 自动失效:他人可抢、旧 token 不能释放新锁、过期不可续命', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-13T00:00:00.000Z'))

    const info = await acquireWorkspaceLock(WS, 'owner-a', 10)
    expect(info).not.toBeNull()

    vi.setSystemTime(new Date('2026-11-13T00:00:11.000Z')) // 已过 TTL
    expect(await getWorkspaceLock(WS)).toBeNull()
    expect(await renewWorkspaceLock(WS, String(info?.token), 10)).toBe(false)

    const taken = await acquireWorkspaceLock(WS, 'owner-b', 10)
    expect(taken).not.toBeNull()
    expect(taken?.holder).toBe('owner-b')

    // 旧 owner 的 token 不能释放新锁
    expect(await releaseWorkspaceLock(WS, String(info?.token))).toBe(false)
    expect((await getWorkspaceLock(WS))?.holder).toBe('owner-b')

    // 强制释放(运维)仍可越过 owner
    expect(await forceReleaseWorkspaceLock(WS)).toBe(true)
    expect(await getWorkspaceLock(WS)).toBeNull()
  })

  it('⑤ 每次降级都留痕:计数与 warn 次数随降级操作同步增长', async () => {
    await acquireWorkspaceLock(WS, 'owner-a')
    await releaseWorkspaceLock(WS, 'owner-a') // token 不匹配,但同样先经历一次降级

    expect(getWorkspaceLockDegradeCount()).toBe(2)
    expect(mocks.warn).toHaveBeenCalledTimes(2)
    expect(mocks.warn).toHaveBeenLastCalledWith(
      expect.stringContaining('降级'),
      expect.objectContaining({ operation: 'release', degradeCount: 2 }),
    )
  })
})

describe('F-204 fail-fast 开关', () => {
  it('⑥ WORKSPACE_LOCK_FAIL_FAST=true → 抛错而非降级', async () => {
    mocks.config.WORKSPACE_LOCK_FAIL_FAST = true

    await expect(acquireWorkspaceLock(WS, 'owner-a')).rejects.toThrow(
      'WORKSPACE_LOCK_REDIS_UNAVAILABLE',
    )
    await expect(releaseWorkspaceLock(WS, 'tok')).rejects.toThrow(
      'WORKSPACE_LOCK_REDIS_UNAVAILABLE',
    )
    await expect(renewWorkspaceLock(WS, 'tok')).rejects.toThrow(
      'WORKSPACE_LOCK_REDIS_UNAVAILABLE',
    )

    expect(getWorkspaceLockDegradeCount()).toBe(3)
    expect(mocks.warn).toHaveBeenCalledTimes(3)

    // 关掉开关(默认档)后确认没有静默留下内存锁:此时查询走降级、结果为无锁
    mocks.config.WORKSPACE_LOCK_FAIL_FAST = false
    expect(await getWorkspaceLock(WS)).toBeNull()
  })
})
