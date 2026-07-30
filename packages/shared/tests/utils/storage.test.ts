/**
 * 跨端 storage 抽象工厂测试(2026-07-30 立)
 *
 * 覆盖范围:
 * 1. createJsonStorage:基础读写 + JSON 序列化 + 错误兜底
 * 2. createStringStorage:字符串读写 + 空串归一
 * 3. createHistoryStorage:LRU 去重 + maxItems 截断 + clear/remove
 * 4. createFlagStorage:布尔 flag 读写('1' / '0' 编码)
 * 5. 与 createSyncTransport/createAsyncTransport/createMemoryTransport 集成
 *    (用 mock 模拟 5 端 storage 行为,验证 transport 注入路径)
 *
 * 依赖:vitest(本包已声明,pnpm --filter @ihui/shared test 可直接跑)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createJsonStorage,
  createStringStorage,
  createHistoryStorage,
  createFlagStorage,
  type JsonStorage,
} from '../../src/utils/storage'
import {
  createSyncTransport,
  createAsyncTransport,
  createMemoryTransport,
  type PersistTransport,
} from '../../src/stores/transport'

/** 通用 mock:用 Map 模拟 transport 行为,可同时跑 sync/async */
function makeMockTransport(): { transport: PersistTransport; store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    store,
    transport: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => {
        store.set(k, v)
      },
      removeItem: (k) => {
        store.delete(k)
      },
    },
  }
}

describe('createJsonStorage', () => {
  let storage: JsonStorage<{ account: string; password: string }>
  let store: Map<string, string>

  beforeEach(() => {
    const mock = makeMockTransport()
    store = mock.store
    storage = createJsonStorage<{ account: string; password: string }>(mock.transport, 'cred')
  })

  it('set 后 get 返回原值', async () => {
    await storage.set({ account: 'alice', password: 'pw' })
    expect(await storage.get()).toEqual({ account: 'alice', password: 'pw' })
  })

  it('get 不存在的 key 返回 null', async () => {
    expect(await storage.get()).toBeNull()
  })

  it('remove 后 get 返回 null', async () => {
    await storage.set({ account: 'a', password: 'b' })
    await storage.remove()
    expect(await storage.get()).toBeNull()
  })

  it('底层存的是 JSON 字符串(可被 raw transport 读取)', async () => {
    await storage.set({ account: 'alice', password: 'pw' })
    expect(store.get('cred')).toBe(JSON.stringify({ account: 'alice', password: 'pw' }))
  })

  it('底层存的是损坏 JSON 时,get 返回 null 不抛错', async () => {
    store.set('cred', '{not-valid-json')
    expect(await storage.get()).toBeNull()
  })

  it('transport 抛错时静默(不向上抛)', async () => {
    const brokenTransport: PersistTransport = {
      getItem: () => {
        throw new Error('storage unavailable')
      },
      setItem: () => {
        throw new Error('storage unavailable')
      },
      removeItem: () => {
        throw new Error('storage unavailable')
      },
    }
    const s = createJsonStorage<{ x: number }>(brokenTransport, 'k')
    // 不应抛错
    expect(await s.get()).toBeNull()
    await s.set({ x: 1 })
    await s.remove()
  })
})

describe('createStringStorage', () => {
  it('set/get 字符串原值(不 JSON 序列化)', async () => {
    const { transport, store } = makeMockTransport()
    const s = createStringStorage(transport, 'k')
    await s.set('hello')
    expect(store.get('k')).toBe('hello') // 原文,非 JSON
    expect(await s.get()).toBe('hello')
  })

  it('空串视为不存在(get 返回 null)', async () => {
    const { transport, store } = makeMockTransport()
    store.set('k', '')
    const s = createStringStorage(transport, 'k')
    expect(await s.get()).toBeNull()
  })
})

describe('createHistoryStorage', () => {
  it('空 storage → get 返回 []', async () => {
    const { transport } = makeMockTransport()
    const h = createHistoryStorage<string>({ transport, key: 'h', maxItems: 5 })
    expect(await h.get()).toEqual([])
  })

  it('push 后 get 返回 [新条目]', async () => {
    const { transport } = makeMockTransport()
    const h = createHistoryStorage<string>({ transport, key: 'h', maxItems: 5 })
    await h.push('alice')
    await h.push('bob')
    expect(await h.get()).toEqual(['bob', 'alice']) // 最新在前
  })

  it('push 重复值时去重 + unshift(老条目前移)', async () => {
    const { transport } = makeMockTransport()
    const h = createHistoryStorage<string>({ transport, key: 'h', maxItems: 5 })
    await h.push('alice')
    await h.push('bob')
    await h.push('alice') // 重复 → 移除旧的,unshift 到头
    expect(await h.get()).toEqual(['alice', 'bob'])
  })

  it('超出 maxItems 时截断尾部', async () => {
    const { transport } = makeMockTransport()
    const h = createHistoryStorage<string>({ transport, key: 'h', maxItems: 3 })
    await h.push('a')
    await h.push('b')
    await h.push('c')
    await h.push('d')
    expect(await h.get()).toEqual(['d', 'c', 'b']) // a 被截断
  })

  it('remove 删除指定条目(全部匹配)', async () => {
    const { transport } = makeMockTransport()
    const h = createHistoryStorage<{ id: number }>({
      transport,
      key: 'h',
      maxItems: 5,
      equals: (a, b) => a.id === b.id,
    })
    await h.push({ id: 1 })
    await h.push({ id: 2 })
    await h.remove({ id: 1 })
    expect(await h.get()).toEqual([{ id: 2 }])
  })

  it('clear 后列表为空 + storage key 被删除', async () => {
    const { transport, store } = makeMockTransport()
    const h = createHistoryStorage<string>({ transport, key: 'h', maxItems: 5 })
    await h.push('a')
    expect(store.get('h')).toBeDefined()
    await h.clear()
    expect(await h.get()).toEqual([])
    expect(store.has('h')).toBe(false) // 空数组不持久化
  })

  it('isValid 拒绝空字符串/无效条目', async () => {
    const { transport } = makeMockTransport()
    const h = createHistoryStorage<string>({ transport, key: 'h', maxItems: 5 })
    await h.push('')
    await h.push('valid')
    expect(await h.get()).toEqual(['valid'])
  })

  it('损坏 JSON 持久化时,get 返回 [] 不抛错', async () => {
    const { transport, store } = makeMockTransport()
    store.set('h', '{not-valid-json')
    const h = createHistoryStorage<string>({ transport, key: 'h', maxItems: 5 })
    expect(await h.get()).toEqual([])
  })
})

describe('createFlagStorage', () => {
  it('set(true) 写 "1",get 返回 true', async () => {
    const { transport, store } = makeMockTransport()
    const f = createFlagStorage(transport, 'flag')
    await f.set(true)
    expect(store.get('flag')).toBe('1')
    expect(await f.get()).toBe(true)
  })

  it('set(false) 删除 key,get 返回 false', async () => {
    const { transport, store } = makeMockTransport()
    const f = createFlagStorage(transport, 'flag')
    store.set('flag', '1')
    await f.set(false)
    expect(store.has('flag')).toBe(false)
    expect(await f.get()).toBe(false)
  })

  it('clear 等价于 set(false)', async () => {
    const { transport, store } = makeMockTransport()
    const f = createFlagStorage(transport, 'flag')
    store.set('flag', '1')
    await f.clear()
    expect(store.has('flag')).toBe(false)
  })

  it('底层值为 "0" 时 get 返回 false', async () => {
    const { transport, store } = makeMockTransport()
    store.set('flag', '0')
    const f = createFlagStorage(transport, 'flag')
    expect(await f.get()).toBe(false)
  })
})

describe('storage 工厂 + 5 端 transport 集成', () => {
  const endpoints: Array<{ name: string; factory: () => PersistTransport }> = [
    {
      name: 'web (sync localStorage)',
      factory: () =>
        createSyncTransport({
          getItem: (k) => (mockStore.get(k) ?? null) as string | null,
          setItem: (k, v) => {
            mockStore.set(k, v)
          },
          removeItem: (k) => {
            mockStore.delete(k)
          },
        }),
    },
    {
      name: 'memory',
      factory: () => createMemoryTransport(),
    },
    {
      name: 'mobile-rn (async AsyncStorage)',
      factory: () =>
        createAsyncTransport({
          getItem: async (k) => mockStore.get(k) ?? null,
          setItem: async (k, v) => {
            mockStore.set(k, v)
          },
          removeItem: async (k) => {
            mockStore.delete(k)
          },
        }),
    },
  ]

  let mockStore: Map<string, string>

  beforeEach(() => {
    mockStore = new Map()
  })

  for (const ep of endpoints) {
    describe(`端到端 — ${ep.name}`, () => {
      it('createJsonStorage 完整生命周期(set → get → remove)', async () => {
        const s = createJsonStorage<{ a: number }>(ep.factory(), 'k')
        await s.set({ a: 42 })
        expect(await s.get()).toEqual({ a: 42 })
        await s.remove()
        expect(await s.get()).toBeNull()
      })

      it('createHistoryStorage LRU + 截断行为', async () => {
        const h = createHistoryStorage<string>({ transport: ep.factory(), key: 'h', maxItems: 2 })
        await h.push('x')
        await h.push('y')
        await h.push('z')
        expect(await h.get()).toEqual(['z', 'y'])
      })

      it('createFlagStorage 布尔读写', async () => {
        const f = createFlagStorage(ep.factory(), 'flag')
        expect(await f.get()).toBe(false)
        await f.set(true)
        expect(await f.get()).toBe(true)
        await f.set(false)
        expect(await f.get()).toBe(false)
      })
    })
  }
})

describe('storage 工厂错误边界', () => {
  it('JSON 序列化抛错(循环引用)时静默', async () => {
    const { transport } = makeMockTransport()
    const s = createJsonStorage<Record<string, unknown>>(transport, 'k')
    const circular: Record<string, unknown> = {}
    circular.self = circular
    // 不抛错,静默失败
    await s.set(circular)
    expect(await s.get()).toBeNull()
  })

  it('transport.getItem 返回 null 时 get 返回 null', async () => {
    const transport: PersistTransport = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    }
    const s = createJsonStorage<{ x: number }>(transport, 'k')
    expect(await s.get()).toBeNull()
  })

  it('transport.getItem 返回 Promise<null> 时 await 后返回 null', async () => {
    const transport: PersistTransport = {
      getItem: vi.fn(async () => null),
      setItem: vi.fn(async () => undefined),
      removeItem: vi.fn(async () => undefined),
    }
    const s = createJsonStorage<{ x: number }>(transport, 'k')
    expect(await s.get()).toBeNull()
  })
})
