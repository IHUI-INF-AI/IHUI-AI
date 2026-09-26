// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * provider-models 缓存键身份维度回归测试(2026-09-26 跨用户数据暴露修复票)。
 *
 * 缺陷:旧 getCacheKey 调用点不传 userId ⇒ 缓存键退化为 `provider:models:<provider>`,
 * 用户 A 带自己账号 key 拉回的私有模型清单写进共享键,用户 B 在 24h TTL 内直接读到。
 *
 * 全部断言以**未打桩的真实 getCacheKey** 为判据对象(不 mock 键计算本身),
 * 只桩 global.fetch(上游目录)与 redis(get/set 内存实现)。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Redis } from 'ioredis'
import { fetchProviderModels, getCacheKey } from '../src/services/provider-models.js'

const __dirnameStr = dirname(fileURLToPath(import.meta.url))

function makeFakeRedis() {
  const store = new Map<string, string>()
  const fake = {
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: string) => {
      store.set(k, v)
      return 'OK'
    },
  }
  return { store, redis: fake as unknown as Redis }
}

/** 按调用次序返回不同的模型清单;记录每次被调 URL */
function stubFetchByCalls(listsPerCall: string[][]) {
  const urls: string[] = []
  let n = 0
  vi.stubGlobal('fetch', async (url: string | URL) => {
    urls.push(String(url))
    const ids = listsPerCall[Math.min(n, listsPerCall.length - 1)] ?? []
    n += 1
    return { ok: true, json: async () => ({ data: ids.map((id) => ({ id })) }) }
  })
  return urls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('provider-models 缓存键纳入身份维度', () => {
  it('① 正证:用户 A 写入后,用户 B 读不到 A 的条目(真实键计算)', async () => {
    const { store, redis } = makeFakeRedis()
    const urls = stubFetchByCalls([['private-model-of-A'], ['catalog-visible-to-B']])

    const a = await fetchProviderModels('groq', 'key-of-A', redis, 'user-A')
    expect(a.source).toBe('live')
    expect(a.models[0]?.id).toBe('private-model-of-A')
    const keyA = getCacheKey('groq', 'user-A')
    expect(store.has(keyA)).toBe(true)

    // B 带自己的 key 请求:不得命中 A 的缓存(旧写法下这里会返回 source=cache 且拿到 A 的私有清单)
    const b = await fetchProviderModels('groq', 'key-of-B', redis, 'user-B')
    expect(b.source).toBe('live')
    expect(b.models.map((m) => m.id)).not.toContain('private-model-of-A')
    expect(b.models[0]?.id).toBe('catalog-visible-to-B')
    expect(urls.length).toBe(2)
    expect(getCacheKey('groq', 'user-B')).not.toBe(keyA)
    expect([...store.keys()].sort()).toEqual([keyA, getCacheKey('groq', 'user-B')].sort())
  })

  it('② 反例防呆:同一用户第二次请求仍命中缓存(不得改成永远 miss 的假修复)', async () => {
    const { redis } = makeFakeRedis()
    const urls = stubFetchByCalls([['m1']])

    const first = await fetchProviderModels('groq', 'key-of-A', redis, 'user-A')
    expect(first.source).toBe('live')
    const second = await fetchProviderModels('groq', 'key-of-A', redis, 'user-A')
    expect(second.source).toBe('cache')
    expect(second.cached).toBe(true)
    expect(second.models[0]?.id).toBe('m1')
    expect(urls.length).toBe(1) // 第二次没再打上游
  })

  it('③ 无身份请求落独立 :public 命名空间,与任何真实用户键不同', async () => {
    const { store, redis } = makeFakeRedis()
    stubFetchByCalls([['private-model-of-A'], ['public-catalog']])

    await fetchProviderModels('groq', 'key-of-A', redis, 'user-A')
    const pub = await fetchProviderModels('groq', undefined, redis, undefined)
    expect(pub.source).toBe('live') // 没读到 A 的条目
    expect(pub.models[0]?.id).toBe('public-catalog')

    const keyPub = getCacheKey('groq')
    expect(keyPub).toBe('provider:models:groq:public')
    expect(keyPub).not.toBe(getCacheKey('groq', 'user-A'))
    // null/undefined/空白 都是"无身份"的形态,统一收敛到 :public,且都不与任何真实用户键同串
    expect(getCacheKey('groq', null)).toBe(keyPub)
    expect(getCacheKey('groq', null)).not.toBe(getCacheKey('groq', 'user-A'))
    expect(getCacheKey('groq', '   ')).toBe(keyPub)
    expect(store.has(keyPub)).toBe(true)
    expect(store.has('provider:models:groq')).toBe(false)
  })

  it('④ 变异对照:键若退回旧写法(忽略身份/裸拼 undefined)本条必红', () => {
    const legacyShape = 'provider:models:groq'
    const kA = getCacheKey('groq', 'user-A')
    const kB = getCacheKey('groq', 'user-B')
    const kPub = getCacheKey('groq')
    // 旧实现下三者全等且等于 legacyShape ⇒ 这四条断言同时翻红(判据有牙,非恒真)
    expect(kA).not.toBe(legacyShape)
    expect(kB).not.toBe(legacyShape)
    expect(kPub).not.toBe(legacyShape)
    expect(new Set([kA, kB, kPub]).size).toBe(3)
    // 空串/空白/undefined 一律收敛到 public 档,不得产生 `...:undefined` / `...:` 这类可撞键
    expect(getCacheKey('groq', undefined)).toBe(kPub)
    expect(getCacheKey('groq', '')).toBe(kPub)
    expect(kA).toBe('provider:models:groq:u:user-A')
  })

  it('⑤ 结构判据:该文件所有 getCacheKey 调用点必须传身份参数', () => {
    const src = readFileSync(resolve(__dirnameStr, '../src/services/provider-models.ts'), 'utf8')
    const calls = [...src.matchAll(/(?<!function\s)getCacheKey\s*\(([^)]*)\)/g)].map((m) => m[1]!)
    expect(calls.length).toBeGreaterThanOrEqual(1)
    for (const args of calls) {
      const parts = args
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '')
      // 每个调用点至少两个实参,且第二个是身份实参(userId)
      expect(parts.length).toBeGreaterThanOrEqual(2)
      expect(parts[1]).toMatch(/userId/)
    }
    // 反向锁:裸 `getCacheKey(provider)`(旧调用形态)不得回到本文件
    expect(src).not.toMatch(/getCacheKey\(\s*provider\s*\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
