// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-227 回归锁(2026-11-13)。
 *
 * 病灶:Redis 故障期的兜底表是**每路由一份** 20000 条 Map(每路由 child() 各 new 一份),
 * 超限时按插入序删最旧 1000 条:内存按「路由数 × 20000」放大,且被删的可能是仍活跃的窗口;
 * 攻击者轮换源 IP 即可把他人计数挤掉、自己永远落进新键 ⇒ 故障窗口内限流 fail-open。
 *
 * 本文件锁:
 *   ① 全局共享容量:多个路由(含 child)写入合计不超过同一 cap,不再每路由一份;
 *   ② 淘汰按 LRU:被命中过的键(即便插入最早)保留,最久未用且已过期的键才被淘汰;
 *   ③ 容量满且无过期条目:新 key 按 fail-closed 拒绝(current = max + 1 ⇒ 调用方 429),
 *      不静默丢弃任何活跃窗口;
 *   ④ 正常计数 / 窗口重置语义不变。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Redis } from 'ioredis'
import {
  createFailSafeRateLimitStore,
  getFailSafeLocalFallbackStats,
  resetFailSafeLocalFallbackForTests,
  type FailSafeRateLimitStore,
} from '../src/plugins/rate-limit-failsafe-store.js'

type RawCb = (err: Error | null, res?: [number, number]) => void

/** Redis 全故障:每个命令立刻失败,存储必然回退到进程内兜底表。 */
function failingRedis(): Redis {
  return {
    defineCommand: () => {},
    ihuiRateLimit: (_key: string, _tw: string, _max: string, _c: string, _e: string, cb: RawCb) =>
      cb(new Error('ECONNREFUSED')),
    ihuiRateLimitRead: (_key: string, cb: RawCb) => cb(new Error('ECONNREFUSED')),
  } as unknown as Redis
}

/** 回调是同步的,调用返回后结果一定已就位。 */
function incrOnce(
  store: FailSafeRateLimitStore,
  key: string,
  timeWindow = 60_000,
  max = 5,
): { current: number; ttl: number } {
  let out: { current: number; ttl: number } | undefined
  store.incr(
    key,
    (err, res) => {
      if (err) throw err
      out = res
    },
    timeWindow,
    max,
  )
  return out!
}

function readOnce(
  store: FailSafeRateLimitStore,
  key: string,
  timeWindow = 60_000,
): { current: number; ttl: number } {
  let out: { current: number; ttl: number } | undefined
  store.read(
    key,
    (err, res) => {
      if (err) throw err
      out = res
    },
    timeWindow,
    5,
  )
  return out!
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('F-227 兜底存储全局共享容量 + LRU', () => {
  beforeEach(() => {
    resetFailSafeLocalFallbackForTests()
  })

  it('① 多个路由(含 child)共享同一总容量', () => {
    const Store = createFailSafeRateLimitStore(failingRedis(), 'ihui:rl:')
    const root = new Store()
    const routeA = root.child({ routeInfo: { method: 'POST', url: '/api/f227/a' } })
    const routeB = root.child({ routeInfo: { method: 'POST', url: '/api/f227/b' } })
    const stores = [root, routeA, routeB]
    const { cap } = getFailSafeLocalFallbackStats()

    // 三个路由合计写入 3×perRoute(> cap) 个不同 IP:若仍是每路由一份 cap,总量会达到 3×cap
    const perRoute = Math.floor(cap / 2) + 100
    for (let i = 0; i < perRoute * stores.length; i++) {
      incrOnce(stores[i % stores.length]!, `10.${i}.0.1`)
    }

    const stats = getFailSafeLocalFallbackStats()
    expect(stats.size).toBe(cap)
    expect(stats.size).toBeLessThan(perRoute * stores.length)
  })

  it('② 淘汰按 LRU(命中过的键保留),而不是插入序', async () => {
    const Store = createFailSafeRateLimitStore(failingRedis(), 'ihui:rl:')
    const route = new Store().child({ routeInfo: { method: 'GET', url: '/api/f227/lru' } })
    const { cap } = getFailSafeLocalFallbackStats()

    // 全部用短窗口写入,稍后统一过期;插入序 = 20.0 → 20.(cap-1)
    for (let i = 0; i < cap; i++) incrOnce(route, `20.${i}.0.1`, 20, cap)
    expect(getFailSafeLocalFallbackStats().size).toBe(cap)

    await sleep(40) // 全部过期
    // 重新命中「插入最早」的键:拿到新的长窗口并移到 LRU 尾部
    expect(incrOnce(route, '20.0.0.1', 60_000, cap).current).toBe(1)

    // 容量满 + 存在过期条目 ⇒ 淘汰 LRU 头部(20.1.0.1),插入新键
    expect(incrOnce(route, '21.0.0.1', 60_000, cap).current).toBe(1)
    expect(getFailSafeLocalFallbackStats().size).toBe(cap)

    // 最早插入但被命中过的活跃窗口必须保留(旧的插入序 FIFO 会把它当最旧删掉)
    expect(readOnce(route, '20.0.0.1').current).toBe(1)
    // 最久未用的 20.1.0.1 已过期,读出为 0
    expect(readOnce(route, '20.1.0.1').current).toBe(0)
  })

  it('③ 容量满且无过期条目:新 key fail-closed,不丢弃活跃窗口', () => {
    const Store = createFailSafeRateLimitStore(failingRedis(), 'ihui:rl:')
    const route = new Store()
    const { cap } = getFailSafeLocalFallbackStats()

    for (let i = 0; i < cap; i++) incrOnce(route, `30.${i}.0.1`, 60_000, 5)
    expect(getFailSafeLocalFallbackStats().size).toBe(cap)
    const before = getFailSafeLocalFallbackStats().capacityRejections

    // IP 轮换进来的新 key:必须被判超限(调用方据此 429),而不是挤掉别人的活跃计数
    const rejected = incrOnce(route, '31.0.0.1', 60_000, 5)
    expect(rejected.current).toBe(6) // max + 1
    expect(rejected.ttl).toBe(60_000)

    const after = getFailSafeLocalFallbackStats()
    expect(after.size).toBe(cap)
    expect(after.capacityRejections).toBe(before + 1)
    // 原有活跃窗口未被静默丢弃
    expect(readOnce(route, '30.0.0.1').current).toBe(1)
  })

  it('④ 正常计数与窗口重置语义不变', async () => {
    const Store = createFailSafeRateLimitStore(failingRedis(), 'ihui:rl:')
    const route = new Store().child({ routeInfo: { method: 'POST', url: '/api/f227/login' } })

    const seen = [1, 2, 3].map(() => incrOnce(route, '40.0.0.1', 30, 5).current)
    expect(seen).toEqual([1, 2, 3])
    expect(readOnce(route, '40.0.0.1', 30).current).toBe(3)
    // 不同 IP 独立计数
    expect(incrOnce(route, '40.0.0.2', 30, 5).current).toBe(1)

    await sleep(45) // 跨过窗口
    expect(readOnce(route, '40.0.0.1', 30)).toEqual({ current: 0, ttl: 0 })
    expect(incrOnce(route, '40.0.0.1', 30, 5).current).toBe(1)
    // 超过 max 后仍继续增长(交给调用方判 429,不 fail-open)
    expect(incrOnce(route, '40.0.0.1', 30, 1).current).toBe(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
