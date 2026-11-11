// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** SDB-06:限流计数器的「INCR + 首次 EXPIRE」必须是原子的一批。
 *
 * 旧实现先 `incr` 再按返回值 `=== 1` 补 `expire`,两步之间崩溃/断连就会留下
 * 永不过期的计数键 ⇒ 该 IP/用户被永久限流。这里用假 Redis 记录实际下发到
 * Redis 的调用批次:只要「两档窗口的 INCR 与 TTL 设置」仍然分散在多次交互里,
 * 用例就会红。
 */

import { describe, it, expect } from 'vitest'
import type IORedis from 'ioredis'

import { RateLimiter } from '../src/services/security-service.js'

interface Entry {
  count: number
  /** null = 无 TTL(旧版本遗留的坏键 / 尚未设置) */
  ttl: number | null
  ttlSetCount: number
}

interface EvalCall {
  script: string
  keys: string[]
  argv: string[]
}

/** 只实现 RateLimiter 用到的那一小面:一次 eval 覆盖两档窗口。
 *  行为对齐脚本语义 —— 每个 key 先自增,首次计数或 TTL 缺失时补 EXPIRE。 */
class FakeRedis {
  readonly store = new Map<string, Entry>()
  readonly evalCalls: EvalCall[] = []
  error: Error | null = null

  seed(key: string, count: number, ttl: number | null): void {
    this.store.set(key, { count, ttl, ttlSetCount: ttl === null ? 0 : 1 })
  }

  async eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<number[]> {
    if (this.error) throw this.error
    const keys = args.slice(0, numKeys).map(String)
    const argv = args.slice(numKeys).map(String)
    this.evalCalls.push({ script, keys, argv })

    return keys.map((key, i) => {
      const entry = this.store.get(key) ?? { count: 0, ttl: null, ttlSetCount: 0 }
      entry.count += 1
      if (entry.count === 1 || entry.ttl === null) {
        entry.ttl = Number(argv[i])
        entry.ttlSetCount += 1
      }
      this.store.set(key, entry)
      return entry.count
    })
  }
}

const asRedis = (fake: FakeRedis): IORedis => fake as unknown as IORedis

describe('SDB-06 RateLimiter 计数与 TTL 原子化', () => {
  it('① 首次请求:INCR 与 EXPIRE 落在同一次 EVAL(单批),两档窗口都有 TTL', async () => {
    const fake = new FakeRedis()
    const limiter = new RateLimiter(asRedis(fake))

    const result = await limiter.isAllowed('1.2.3.4')
    expect(result).toEqual({ allowed: true })

    // 一批 = 一次交互:分钟档与小时档的 INCR + EXPIRE 不可能被拆开
    expect(fake.evalCalls).toHaveLength(1)
    expect(fake.evalCalls[0]?.keys).toEqual(['rl:m:1.2.3.4', 'rl:h:1.2.3.4'])
    expect(fake.evalCalls[0]?.argv).toEqual(['60', '3600'])

    expect(fake.store.get('rl:m:1.2.3.4')).toMatchObject({ count: 1, ttl: 60, ttlSetCount: 1 })
    expect(fake.store.get('rl:h:1.2.3.4')).toMatchObject({ count: 1, ttl: 3600, ttlSetCount: 1 })
  })

  it('② 窗口内第二次请求只加计数,不重置 TTL', async () => {
    const fake = new FakeRedis()
    const limiter = new RateLimiter(asRedis(fake))

    await limiter.isAllowed('1.2.3.4')
    await limiter.isAllowed('1.2.3.4')

    expect(fake.store.get('rl:m:1.2.3.4')).toMatchObject({ count: 2, ttl: 60, ttlSetCount: 1 })
    expect(fake.store.get('rl:h:1.2.3.4')).toMatchObject({ count: 2, ttl: 3600, ttlSetCount: 1 })
  })

  it('②b 修复前遗留的无 TTL 键会被补上 TTL(不再永久累积)', async () => {
    const fake = new FakeRedis()
    fake.seed('rl:m:9.9.9.9', 120, null)
    fake.seed('rl:h:9.9.9.9', 120, null)
    const limiter = new RateLimiter(asRedis(fake))

    await limiter.isAllowed('9.9.9.9')

    expect(fake.store.get('rl:m:9.9.9.9')).toMatchObject({ count: 121, ttl: 60, ttlSetCount: 1 })
    expect(fake.store.get('rl:h:9.9.9.9')).toMatchObject({ count: 121, ttl: 3600, ttlSetCount: 1 })
  })

  it('③ 超阈值仍拒绝:分钟档 retryAfter=60,小时档 retryAfter=3600', async () => {
    const perMinute = new RateLimiter(asRedis(new FakeRedis()), 2, 1000)
    expect((await perMinute.isAllowed('ip')).allowed).toBe(true)
    expect((await perMinute.isAllowed('ip')).allowed).toBe(true)
    expect(await perMinute.isAllowed('ip')).toEqual({
      allowed: false,
      message: '超过每分钟请求限制(2)',
      retryAfter: 60,
    })

    const perHour = new RateLimiter(asRedis(new FakeRedis()), 100, 1)
    expect((await perHour.isAllowed('ip')).allowed).toBe(true)
    expect(await perHour.isAllowed('ip')).toEqual({
      allowed: false,
      message: '超过每小时请求限制(1)',
      retryAfter: 3600,
    })
  })

  it('④ Redis 报错时行为与改前一致:错误向上抛出,不静默放行', async () => {
    const fake = new FakeRedis()
    fake.error = new Error('redis down')
    const limiter = new RateLimiter(asRedis(fake))

    await expect(limiter.isAllowed('1.2.3.4')).rejects.toThrow('redis down')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
