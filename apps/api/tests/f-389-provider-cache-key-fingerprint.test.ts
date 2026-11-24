// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-389 回归锁(2026-11-13)。
 *
 * 病灶:provider-models 的 Redis 缓存键只含 provider(+userId),不含 API Key 指纹。
 * 同一身份下换用另一把上游 key(不同账号/不同可见模型)会命中旧凭据写下的清单,
 * 造成跨凭据串味:用户 A 的模型列表被使用 B key 的请求读到。
 *
 * 本文件锁:
 *   ① 不同 key ⇒ 不同缓存键,写入 A 后 B 不命中 A 的条目;
 *   ② 同一 key ⇒ 同一缓存键,第二次请求命中缓存且不再打上游;
 *   ③ 缓存键与日志中均不得出现明文 key(只允许 sha256 前 16 位指纹);
 *   ④ 无 key(公开档)落固定 `anon` 键,不得误伤到有 key 的档位。
 *
 * 只桩 global.fetch(上游目录)、redis(get/set 内存实现)与 console(日志采集),
 * 不触达真实上游/Redis。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Redis } from 'ioredis'
import { fetchProviderModels, getCacheKey } from '../src/services/provider-models.js'

const KEY_A = 'sk-live-credential-AAA-7f3c91'
const KEY_B = 'sk-live-credential-BBB-2d8e40'

function makeFakeRedis() {
  const store = new Map<string, string>()
  const ops: Array<{ op: 'get' | 'set'; key: string; value?: string }> = []
  const fake = {
    get: async (k: string) => {
      ops.push({ op: 'get', key: k })
      return store.get(k) ?? null
    },
    set: async (k: string, v: string) => {
      ops.push({ op: 'set', key: k, value: v })
      store.set(k, v)
      return 'OK'
    },
  }
  return { store, ops, redis: fake as unknown as Redis }
}

/** 按调用次序返回不同模型清单;记录每次被调 URL */
function stubUpstream(lists: string[][]) {
  const urls: string[] = []
  let n = 0
  vi.stubGlobal('fetch', async (url: string | URL) => {
    urls.push(String(url))
    const ids = lists[Math.min(n, lists.length - 1)] ?? []
    n += 1
    return { ok: true, json: async () => ({ data: ids.map((id) => ({ id })) }) }
  })
  return urls
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('F-389 provider 模型缓存键纳入 API Key 指纹', () => {
  it('① 两个不同 key 产生不同缓存键,同一身份下互不命中', async () => {
    const { store, redis } = makeFakeRedis()
    const urls = stubUpstream([['private-model-of-A'], ['catalog-of-B']])

    const a = await fetchProviderModels('groq', KEY_A, redis, 'user-shared')
    expect(a.source).toBe('live')
    expect(a.models[0]?.id).toBe('private-model-of-A')

    // 同一 userId、不同 key:旧实现会命中 A 的键,新实现必须回源
    const b = await fetchProviderModels('groq', KEY_B, redis, 'user-shared')
    expect(b.source).toBe('live')
    expect(b.models.map((m) => m.id)).not.toContain('private-model-of-A')
    expect(b.models[0]?.id).toBe('catalog-of-B')
    expect(urls.length).toBe(2)

    const kA = getCacheKey('groq', 'user-shared', KEY_A)
    const kB = getCacheKey('groq', 'user-shared', KEY_B)
    expect(kA).not.toBe(kB)
    expect(kA).toMatch(/^provider:models:groq:u:user-shared:k:[0-9a-f]{16}$/)
    expect([...store.keys()].sort()).toEqual([kA, kB].sort())
  })

  it('② 同一 key 命中同一缓存键,第二次请求不再打上游', async () => {
    const { store, redis } = makeFakeRedis()
    const urls = stubUpstream([['m1', 'm2']])

    const first = await fetchProviderModels('groq', KEY_A, redis, 'user-shared')
    expect(first.source).toBe('live')
    const second = await fetchProviderModels('groq', KEY_A, redis, 'user-shared')
    expect(second.source).toBe('cache')
    expect(second.cached).toBe(true)
    expect(second.models.map((m) => m.id)).toEqual(['m1', 'm2'])
    expect(urls.length).toBe(1)

    expect(getCacheKey('groq', 'user-shared', KEY_A)).toBe(
      getCacheKey('groq', 'user-shared', ` ${KEY_A} `),
    )
    expect(store.size).toBe(1)
    expect(store.has(getCacheKey('groq', 'user-shared', KEY_A))).toBe(true)
  })

  it('③ 缓存键与日志中均不含明文 key', async () => {
    const { ops, redis } = makeFakeRedis()
    stubUpstream([['m1'], ['m2']])

    const logs: string[] = []
    const capture = (...args: unknown[]) => {
      logs.push(args.map((a) => String(a)).join(' '))
    }
    vi.spyOn(console, 'log').mockImplementation(capture)
    vi.spyOn(console, 'info').mockImplementation(capture)
    vi.spyOn(console, 'warn').mockImplementation(capture)
    vi.spyOn(console, 'error').mockImplementation(capture)
    vi.spyOn(console, 'debug').mockImplementation(capture)

    await fetchProviderModels('groq', KEY_A, redis, 'user-shared')
    await fetchProviderModels('groq', KEY_B, redis, 'user-shared')

    const keys = [...ops.map((o) => o.key), ...ops.map((o) => o.value ?? '')].join('\n')
    expect(keys).not.toContain(KEY_A)
    expect(keys).not.toContain(KEY_B)
    expect(logs.join('\n')).not.toContain(KEY_A)
    expect(logs.join('\n')).not.toContain(KEY_B)
    // 指纹段仍是 16 位十六进制,而不是被截断成空串
    expect(getCacheKey('groq', 'user-shared', KEY_A)).toMatch(/:k:[0-9a-f]{16}$/)
  })

  it('④ 无 key 时固定落 anon 键,不误伤有 key 的档位', async () => {
    const { store, redis } = makeFakeRedis()
    stubUpstream([['model-of-A'], ['public-catalog']])

    const savedGroqKey = process.env.GROQ_API_KEY
    delete process.env.GROQ_API_KEY
    try {
      await fetchProviderModels('groq', KEY_A, redis, 'user-shared')
      const pub = await fetchProviderModels('groq', undefined, redis, 'user-shared')
      expect(pub.source).toBe('live')
      expect(pub.models[0]?.id).toBe('public-catalog')

      const kAnon = getCacheKey('groq', 'user-shared')
      expect(kAnon).toBe('provider:models:groq:u:user-shared:k:anon')
      expect(kAnon).not.toBe(getCacheKey('groq', 'user-shared', KEY_A))
      expect(store.has(kAnon)).toBe(true)
      expect(getCacheKey('groq', 'user-shared', '')).toBe(kAnon)
      expect(getCacheKey('groq', 'user-shared', '   ')).toBe(kAnon)
    } finally {
      if (savedGroqKey === undefined) delete process.env.GROQ_API_KEY
      else process.env.GROQ_API_KEY = savedGroqKey
    }
  })
})
