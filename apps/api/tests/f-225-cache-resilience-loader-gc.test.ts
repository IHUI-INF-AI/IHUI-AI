// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-225 回归锁(2026-11-13)。
 *
 * 病灶:cache-resilience 的 loaders(预热回源函数表)只增不减——每次 getOrLoad 回源成功都写一条,
 * 只有显式 invalidate 才删;key 含用户/订单维度时 Map 随历史 key 单调增长,value 是捕获调用上下文的
 * 闭包,常驻内存并阻止回收。
 *
 * 本文件锁:
 *   ① 容量上限 + LRU:超过 max entries 后最久未用的 loader 被淘汰(预热不再触达它);
 *   ①-b LRU 而不是 FIFO:重新回源的 key 刷新位次,被淘汰的是最久未用而非最早登记;
 *   ② 被淘汰 key 再次访问按需重建,不产出错误值,且重新获得预热能力;
 *   ③ 未淘汰 key 的正常命中与雪崩预热逻辑不变(抖动 TTL 区间、命中不回源、窗口外不预热);
 *   ④ 清理联动:invalidate 释放 key 后 loader 不再驻留(下一次 tick 不再调用它)。
 *
 * 只注入假 Redis(Map),不触达真实 PG / Redis。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { cacheResilience } from '../src/plugins/cache-resilience.js'

const KEY = 'ihui:cache:' // 与插件内 KEY_PREFIX 对齐
const MAX_LOADERS = 3

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
    async set(key: string, value: string, _mode?: string, ttlSec?: number) {
      store.set(key, value)
      if (typeof ttlSec === 'number') setTtls.push({ key, ttlSec })
      return 'OK'
    },
    async del(key: string) {
      return store.delete(key) ? 1 : 0
    },
  }
}

let app: FastifyInstance
let fake: FakeRedis

beforeEach(async () => {
  vi.useFakeTimers()
  fake = makeFakeRedis()
  app = Fastify({ logger: false })
  // 用 string 通道 decorate 假 redis / recordCache(插件调用点都有 try/catch 兜底)
  const decorable = app as unknown as { decorate(name: string, value: unknown): void }
  decorable.decorate('redis', fake)
  decorable.decorate('recordCache', () => {})
  await app.register(cacheResilience, { loadersMaxEntries: MAX_LOADERS })
  await app.ready()
})

afterEach(async () => {
  await app.close() // 清雪崩预热定时器(onClose 钩子)
  vi.useRealTimers()
})

/** 推进到插件内置的 10s 预热扫描,并让 tick 里 fire-and-forget 的预热 IIFE 跑完。 */
async function runPreloadScan(): Promise<void> {
  await vi.advanceTimersByTimeAsync(10_000)
  await vi.advanceTimersByTimeAsync(0)
}

/** 计数器 loader:同一 key 的闭包每次被调用(cache 回源 / 预热)都 +1。 */
function makeCountingLoaders(): {
  calls: Map<string, number>
  loader: (key: string, value?: unknown) => () => Promise<unknown>
} {
  const calls = new Map<string, number>()
  const loader =
    (key: string, value: unknown = { k: key }) =>
    async () => {
      calls.set(key, (calls.get(key) ?? 0) + 1)
      return value
    }
  return { calls, loader }
}

describe('F-225 loaders 注册表容量上限 / LRU / 清理联动', () => {
  it('① 超过 max entries 时最久未用的 loader 被淘汰(Map 大小受限)', async () => {
    const { calls, loader } = makeCountingLoaders()
    const keys = ['lru:1', 'lru:2', 'lru:3', 'lru:4']
    for (const k of keys) {
      await app.cacheResilience.getOrLoad(k, 1, loader(k))
    }
    expect(keys.map((k) => calls.get(k))).toEqual([1, 1, 1, 1])

    await runPreloadScan()

    // 上限 3:预热只触达仍登记在表里的 3 条 loader,最久未用的 lru:1 已被淘汰
    expect(keys.map((k) => calls.get(k))).toEqual([1, 2, 2, 2])
  })

  it('①-b LRU 语义:重新回源的 key 刷新位次,淘汰最久未用而非最早登记', async () => {
    const { calls, loader } = makeCountingLoaders()
    for (const k of ['u:1', 'u:2', 'u:3']) {
      await app.cacheResilience.getOrLoad(k, 1, loader(k))
    }
    // u:1 重新回源 ⇒ 登记位次刷新到 MRU,剩下 u:2 最久未用
    fake.store.delete(`${KEY}u:1`)
    await app.cacheResilience.getOrLoad('u:1', 1, loader('u:1'))
    // 第 4 条登记 ⇒ 淘汰 u:2(FIFO 会淘汰 u:1,这里必须不是)
    await app.cacheResilience.getOrLoad('u:4', 1, loader('u:4'))
    expect([...calls.values()]).toEqual([2, 1, 1, 1])

    await runPreloadScan()
    expect(calls.get('u:1')).toBe(3)
    expect(calls.get('u:2')).toBe(1)
    expect(calls.get('u:3')).toBe(2)
    expect(calls.get('u:4')).toBe(2)
  })

  it('② 被淘汰 key 再次访问按需重建,不产出错误值且重新获得预热能力', async () => {
    const { calls, loader } = makeCountingLoaders()
    for (const k of ['r:1', 'r:2', 'r:3', 'r:4']) {
      await app.cacheResilience.getOrLoad(k, 1, loader(k))
    }
    await runPreloadScan()
    expect(calls.get('r:1')).toBe(1) // r:1 的 loader 已出表

    // 模拟缓存条目到期(假 Redis 不做 TTL 淘汰)
    fake.store.delete(`${KEY}r:1`)
    const rebuilt = await app.cacheResilience.getOrLoad('r:1', 1, loader('r:1', { k: 'r:1', v: 2 }))
    expect(rebuilt).toEqual({ k: 'r:1', v: 2 }) // 按需重建,不是 undefined / 旧值
    expect(calls.get('r:1')).toBe(2)
    expect(fake.store.get(`${KEY}r:1`)).toBe('{"k":"r:1","v":2}')

    // 重建后重新登记 ⇒ 重新获得预热能力
    await runPreloadScan()
    expect(calls.get('r:1')).toBe(3)
  })

  it('③ 正常命中与雪崩预热逻辑不变', async () => {
    let calls = 0
    const loader = async () => {
      calls += 1
      return { a: 1 }
    }
    const v1 = await app.cacheResilience.getOrLoad('keep:1', 100, loader)
    expect(v1).toEqual({ a: 1 })

    const v2 = await app.cacheResilience.getOrLoad('keep:1', 100, async () => {
      calls += 1
      throw new Error('must-not-reload')
    })
    expect(v2).toEqual({ a: 1 })
    expect(calls).toBe(1) // 命中不回源

    const lastTtl = fake.setTtls[fake.setTtls.length - 1]
    expect(lastTtl).toBeDefined()
    // 雪崩防护 ±20% 抖动 TTL 不变(100 ∈ [80,120])
    expect(lastTtl!.ttlSec).toBeGreaterThanOrEqual(80)
    expect(lastTtl!.ttlSec).toBeLessThanOrEqual(120)
    expect(app.cacheResilience.avalancheStats().tracked).toBe(1)

    await runPreloadScan()
    // 100s TTL 不在 30s 预热窗口内 ⇒ 不预热、loader 不重复调用
    expect(calls).toBe(1)
    expect(app.cacheResilience.avalancheStats().tracked).toBe(1)
  })

  it('④ invalidate 释放 key 后 loader 不再驻留', async () => {
    let calls = 0
    await app.cacheResilience.getOrLoad('gone:1', 1, async () => {
      calls += 1
      return { ok: 1 }
    })
    expect(app.cacheResilience.avalancheStats().tracked).toBe(1)

    await app.cacheResilience.invalidate('gone:1')
    expect(app.cacheResilience.avalancheStats().tracked).toBe(0)
    expect(fake.store.has(`${KEY}gone:1`)).toBe(false)

    await runPreloadScan()
    expect(calls).toBe(1) // 已出表,不再被预热调用
  })
})
