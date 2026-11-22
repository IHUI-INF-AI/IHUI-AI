// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 按用户限流(2026-10-30 立)。
 *
 * 被锁住的行为:认证成功后按 userId 单独计一层额度,阈值内放行、超阈值拒绝;
 * **Redis 不可用时放行** —— 这一层是"补 IP 桶在 NAT/回环下的失真",不是兜底闸,
 * IP 层(server.ts,100/min,fail-closed)仍在外面挡滥用。
 *
 * 为什么成对:
 *  - 「阈值内 true / 越界 false」⇒ 把 `n <= max` 改成恒 true 就翻红;
 *  - 「两个 userId 各算各的」⇒ 把 key 里的 userId 摘掉就翻红(正是当年单 IP 桶的形态);
 *  - 「跨分钟重置」⇒ 把 key 里的时间桶摘掉就翻红(额度永不恢复);
 *  - 「incr 抛错仍放行」⇒ 把 catch 改成 return false 就翻红(一次 Redis 抖动打掉全站已登录用户)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

const state = vi.hoisted(() => ({
  store: new Map<string, { value: string; expiresAt: number }>(),
  calls: [] as Array<{ cmd: string; args: unknown[] }>,
  failures: new Set<string>(),
}))

vi.mock('ioredis', async () => {
  const { makeFakeRedisClass } = await import('./helpers/fake-redis.js')
  return { default: makeFakeRedisClass(state) }
})

// 只覆盖本模块用到的两个键,避免把整份 envSchema 拉进单测。
vi.mock('../src/config/index.js', () => ({
  config: {
    REDIS_URL: 'redis://fake:6379/0',
    USER_RATE_LIMIT_PER_MINUTE: 3,
  },
}))

import { checkUserRateLimit } from '../src/services/user-rate-limit.js'

const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'

beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-30T10:00:05.000Z'))
})

afterAll(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  state.store.clear()
  state.calls.length = 0
  state.failures.clear()
  vi.setSystemTime(new Date('2026-10-30T10:00:05.000Z'))
})

describe('checkUserRateLimit · 额度语义', () => {
  it('阈值内逐次放行,第 N+1 次拒绝', async () => {
    await expect(checkUserRateLimit(USER_A)).resolves.toBe(true)
    await expect(checkUserRateLimit(USER_A)).resolves.toBe(true)
    await expect(checkUserRateLimit(USER_A)).resolves.toBe(true)
    await expect(checkUserRateLimit(USER_A)).resolves.toBe(false)
    // 超限后继续请求仍是拒绝,不会"过一次就重新放行"
    await expect(checkUserRateLimit(USER_A)).resolves.toBe(false)
  })

  it('不同用户各算各的桶(同一 NAT 出口不再互相挤占)', async () => {
    await checkUserRateLimit(USER_A)
    await checkUserRateLimit(USER_A)
    await checkUserRateLimit(USER_A)
    await expect(checkUserRateLimit(USER_A)).resolves.toBe(false)
    await expect(checkUserRateLimit(USER_B)).resolves.toBe(true)
  })

  it('跨分钟自动重置(键里带时间桶)', async () => {
    for (let i = 0; i < 3; i += 1) await checkUserRateLimit(USER_A)
    await expect(checkUserRateLimit(USER_A)).resolves.toBe(false)

    vi.setSystemTime(new Date('2026-10-30T10:01:00.500Z'))
    await expect(checkUserRateLimit(USER_A)).resolves.toBe(true)
  })

  it('TTL 只在首次计数时设置一次(不随每次请求续命)', async () => {
    await checkUserRateLimit(USER_A)
    await checkUserRateLimit(USER_A)
    await checkUserRateLimit(USER_A)
    expect(state.calls.filter((c) => c.cmd === 'expire')).toHaveLength(1)
  })

  it('空 userId 直接放行且不碰 Redis', async () => {
    await expect(checkUserRateLimit('')).resolves.toBe(true)
    expect(state.calls).toHaveLength(0)
  })
})

describe('checkUserRateLimit · 失败方向(fail-open)', () => {
  it('Redis 计数抛错时放行(不因一次抖动把已登录用户挡在门外)', async () => {
    state.failures.add('incr')
    await expect(checkUserRateLimit(USER_A)).resolves.toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
