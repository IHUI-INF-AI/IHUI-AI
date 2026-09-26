// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 格① 「未命中不是事实，不得缓存」回归 —— apps/api/src/plugins/cache-resilience.ts
 *
 * 判据(对旧实现是阳性对照，旧实现在 ①/③ 两例必红):
 *  - loader 返回 null ⇒ 不得回填;旁路建行(不经 doubleDelete 直接写库)后下一次读必须回源读到;
 *  - 非空值仍按抖动 TTL 回填、singleflight/双删逻辑不变(回归);
 *  - 观测面区分「空值条目(显式 null TTL 档)」「无条目」「实际值命中」三态。
 * 零连库:假 Redis(Map)注入，不触生产 8810/8811。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { cacheResilience } from '../src/plugins/cache-resilience.js'

interface FakeRedis {
  store: Map<string, string>
  setTtls: Array<{ key: string; ttlSec: number }>
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode?: string, ttlSec?: number): Promise<string>
  del(key: string): Promise<number>
}

function makeFakeRedis(): FakeRedis {
  const store = new Map<string, string>()
  const setTtls: Array<{ key: string; ttlSec: number }> = []
  return {
    store,
    setTtls,
    async get(key: string) {
      const v = store.get(key)
      return v === undefined ? null : v
    },
    async set(key: string, value: string, mode?: string, ttlSec?: number) {
      store.set(key, value)
      if (typeof ttlSec === 'number') setTtls.push({ key, ttlSec })
      return 'OK'
    },
    async del(key: string) {
      return store.delete(key) ? 1 : 0
    },
  }
}

const KEY = 'ihui:cache:' // 与插件内 KEY_PREFIX 对齐(断言直接拼完整键名)

let app: FastifyInstance
let fake: FakeRedis

beforeEach(async () => {
  fake = makeFakeRedis()
  app = Fastify({ logger: false })
  // 用 string 通道 decorate 假 redis / recordCache(插件在调用点都有 try/catch 兜底)
  const decorable = app as unknown as { decorate(name: string, value: unknown): void }
  decorable.decorate('redis', fake)
  decorable.decorate('recordCache', () => {})
  await app.register(cacheResilience)
  await app.ready()
})

afterEach(async () => {
  await app.close() // 清雪崩预热定时器(onClose 钩子)
})

describe('格① 未命中不是事实，不得缓存', () => {
  it('① loader 返回 null 不回填;旁路建行后下一次读回源读到(阳性对照:旧实现必红)', async () => {
    let row: { id: number } | null = null
    const first = await app.cacheResilience.getOrLoad('user:1', 60, async () => row)
    expect(first).toBeNull()
    // 阳性对照:旧实现在这里 set('ihui:cache:user:1', 'null') —— 下面这条在旧实现上必红
    expect(fake.store.has(`${KEY}user:1`)).toBe(false)
    // 旁路建行(不经 doubleDelete，缓存失效链救不到这一型)
    row = { id: 42 }
    const second = await app.cacheResilience.getOrLoad('user:1', 60, async () => row)
    expect(second).toEqual({ id: 42 })
    expect(app.cacheResilience.cacheQualityStats().emptySkipped).toBe(1)
  })

  it('② 非空值仍按抖动 TTL 回填、二次读命中不回源;doubleDelete 照常失效(回归)', async () => {
    let calls = 0
    const v = await app.cacheResilience.getOrLoad('agent:1', 100, async () => {
      calls += 1
      return { a: 1 }
    })
    expect(v).toEqual({ a: 1 })
    expect(fake.store.get(`${KEY}agent:1`)).toBe('{"a":1}')
    const last = fake.setTtls[fake.setTtls.length - 1]
    expect(last).toBeDefined()
    // 雪崩防护 ±20% 抖动 TTL 不变(94 的 100 ∈ [80,120])
    expect(last!.ttlSec).toBeGreaterThanOrEqual(80)
    expect(last!.ttlSec).toBeLessThanOrEqual(120)
    const v2 = await app.cacheResilience.getOrLoad('agent:1', 100, async () => {
      calls += 1
      throw new Error('must-not-reload')
    })
    expect(v2).toEqual({ a: 1 })
    expect(calls).toBe(1)
    // doubleDelete 写路径失效照旧
    await app.cacheResilience.doubleDelete('agent:1', async () => 'written', 5)
    await new Promise((r) => setTimeout(r, 40))
    expect(fake.store.has(`${KEY}agent:1`)).toBe(false)
    const v3 = await app.cacheResilience.getOrLoad('agent:1', 100, async () => {
      calls += 1
      return { a: 1 }
    })
    expect(v3).toEqual({ a: 1 })
    expect(calls).toBe(2)
  })

  it('③ 观测面三态可区分:空值哨兵条目(显式 null TTL 档) vs 无条目 vs 实际值', async () => {
    let calls = 0
    const r1 = await app.cacheResilience.getOrLoad<string | null>(
      'agent:x',
      60,
      async () => {
        calls += 1
        return null
      },
      { nullTtlSec: 30 },
    )
    expect(r1).toBeNull()
    // 哨兵条目在存储层可辨识(与 JSON.stringify(null) 的 'null' 不同形态)
    expect(fake.store.get(`${KEY}agent:x`)).toBe('{"__ihuiCacheNull__":1}')
    const r2 = await app.cacheResilience.getOrLoad<string | null>(
      'agent:x',
      60,
      async () => {
        calls += 1
        return 'fresh'
      },
      { nullTtlSec: 30 },
    )
    expect(r2).toBeNull() // 命中空值条目，不回源
    expect(calls).toBe(1)
    const stats = app.cacheResilience.cacheQualityStats()
    expect(stats.nullEntryWrites).toBe(1)
    expect(stats.nullEntryHits).toBe(1)
    // 对照组:另一键无条目(默认不缓存空值) ⇒ 照常回源，且计入 emptySkipped 而非 nullEntryHits
    const r3 = await app.cacheResilience.getOrLoad<string | null>('agent:y', 60, async () => null)
    expect(r3).toBeNull()
    expect(fake.store.has(`${KEY}agent:y`)).toBe(false)
    const stats2 = app.cacheResilience.cacheQualityStats()
    expect(stats2.emptySkipped).toBe(1)
    expect(stats2.nullEntryHits).toBe(1) // 没有被"无条目回源"污染成空值命中
  })

  it('singleflight 回归:同 key 并发只回源一次(行为不变)', async () => {
    let calls = 0
    const loader = () =>
      new Promise<{ n: number }>((resolve) => {
        calls += 1
        setTimeout(() => resolve({ n: 1 }), 10)
      })
    const [a, b] = await Promise.all([
      app.cacheResilience.getOrLoad('agent:c', 60, loader),
      app.cacheResilience.getOrLoad('agent:c', 60, loader),
    ])
    expect(a).toEqual({ n: 1 })
    expect(b).toEqual({ n: 1 })
    expect(calls).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
