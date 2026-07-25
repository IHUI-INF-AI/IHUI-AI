/**
 * @ihui/extension/stores/storage-adapter 集成测试(2026-07-25 立)
 *
 * 锁定 createChromeStorageTransport 的实际行为:
 * 1. chrome.storage.local 可用时 → 包装 chrome.storage.local(三方法均异步)
 * 2. chrome 全局不可用 → fallback 到内存 transport
 * 3. chrome.storage 缺失 API → fallback 到内存 transport
 * 4. 与 zustand persist 中间件集成正确(写入 + hydrate 恢复)
 *
 * 设计原则:
 * - 用 vi.stubGlobal 模拟 chrome 全局(任务硬性要求,禁止直挂 globalThis)
 * - chrome.storage.local 用 Record<string, unknown> 模拟,显式断言调用参数
 * - zustand persist 通过 createJSONStorage(() => transport) 接入,验证异步接口兼容
 * - 12 场景全覆盖(见任务清单)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createAuthStore, createInMemoryTokenStore } from '@ihui/shared'
import { createChromeStorageTransport } from '../storage-adapter'

// ============ chrome.storage.local mock 工厂 ============

/**
 * 构造一个独立的 chrome mock + 背后 Record 存储
 * 每个测试用独立实例,避免互相污染
 */
function buildChromeMock() {
  const storage: Record<string, unknown> = {}
  const get = vi.fn(async (keys?: string | string[] | Record<string, unknown>) => {
    // 兼容 chrome.storage.local.get() / get('k') / get(['k1','k2']) / get({k: defaultValue})
    if (keys === undefined || keys === null) {
      return { ...storage }
    }
    if (typeof keys === 'string') {
      return keys in storage ? { [keys]: storage[keys] } : {}
    }
    if (Array.isArray(keys)) {
      const result: Record<string, unknown> = {}
      for (const k of keys) if (k in storage) result[k] = storage[k]
      return result
    }
    // 对象形式(带 default):返回实际存在 key
    const result: Record<string, unknown> = {}
    for (const k of Object.keys(keys)) if (k in storage) result[k] = storage[k]
    return result
  })
  const set = vi.fn(async (obj: Record<string, unknown>) => {
    Object.assign(storage, obj)
  })
  const remove = vi.fn(async (keys: string | string[]) => {
    const arr = Array.isArray(keys) ? keys : [keys]
    for (const k of arr) delete storage[k]
  })

  return {
    chrome: {
      storage: {
        local: { get, set, remove },
      },
    },
    storage,
    spies: { get, set, remove },
  }
}

// ============ 1. 基础读写 ============

describe('createChromeStorageTransport 基础读写(chrome.storage.local mock)', () => {
  let mock: ReturnType<typeof buildChromeMock>

  beforeEach(() => {
    mock = buildChromeMock()
    vi.stubGlobal('chrome', mock.chrome)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('setItem 后 getItem 返回原值', async () => {
    const t = createChromeStorageTransport()
    await t.setItem('k1', 'v1')
    expect(await t.getItem('k1')).toBe('v1')
    // chrome.storage.local.set 实际被调用,参数为 { 'k1': 'v1' }
    expect(mock.spies.set).toHaveBeenCalledWith({ k1: 'v1' })
  })

  it('getItem 不存在的 key 返回 null', async () => {
    const t = createChromeStorageTransport()
    const v = await t.getItem('nope')
    expect(v).toBeNull()
    // chrome.storage.local.get 被调用(返回空对象)
    expect(mock.spies.get).toHaveBeenCalledTimes(1)
  })

  it('removeItem 后 getItem 返回 null', async () => {
    const t = createChromeStorageTransport()
    await t.setItem('k2', 'v2')
    expect(await t.getItem('k2')).toBe('v2')
    await t.removeItem('k2')
    expect(await t.getItem('k2')).toBeNull()
    // remove 收到的是单个 key
    expect(mock.spies.remove).toHaveBeenCalledWith('k2')
  })
})

// ============ 2. 边界值 ============

describe('createChromeStorageTransport 边界值', () => {
  let mock: ReturnType<typeof buildChromeMock>

  beforeEach(() => {
    mock = buildChromeMock()
    vi.stubGlobal('chrome', mock.chrome)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('空字符串值正确存取', async () => {
    const t = createChromeStorageTransport()
    await t.setItem('empty', '')
    expect(await t.getItem('empty')).toBe('')
  })

  it('中文/Unicode 值正确存取', async () => {
    const t = createChromeStorageTransport()
    const cn = '{"name":"智谱清言","emoji":"🤖✨"}'
    await t.setItem('cn', cn)
    expect(await t.getItem('cn')).toBe(cn)
  })

  it('JSON 字符串正确存取', async () => {
    const t = createChromeStorageTransport()
    const json = JSON.stringify({ a: 1, b: [2, 3], c: { d: 'x' } })
    await t.setItem('json', json)
    expect(await t.getItem('json')).toBe(json)
    // 反向 parse 验证完整性
    expect(JSON.parse((await t.getItem('json')) as string)).toEqual({ a: 1, b: [2, 3], c: { d: 'x' } })
  })
})

// ============ 3. chrome.storage.local API 行为模拟 ============

describe('chrome.storage.local API 行为模拟', () => {
  let mock: ReturnType<typeof buildChromeMock>

  beforeEach(() => {
    mock = buildChromeMock()
    vi.stubGlobal('chrome', mock.chrome)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('chrome.storage.local.get 返回 Promise<{ [key]: value }>', async () => {
    const t = createChromeStorageTransport()
    await t.setItem('api-k', 'api-v')
    mock.spies.get.mockClear()
    const result = await mock.spies.get('api-k')
    expect(result).toEqual({ 'api-k': 'api-v' })
  })

  it('chrome.storage.local.set 接收 { [key]: value }', async () => {
    const t = createChromeStorageTransport()
    mock.spies.set.mockClear()
    await t.setItem('x', 'y')
    expect(mock.spies.set).toHaveBeenCalledWith({ x: 'y' })
    // 内部存储确实写入
    expect(mock.storage.x).toBe('y')
  })

  it('chrome.storage.local.remove 接收 string | string[]', async () => {
    const t = createChromeStorageTransport()
    await t.setItem('a', '1')
    await t.setItem('b', '2')
    mock.spies.remove.mockClear()
    // removeItem 内部传的是单 key
    await t.removeItem('a')
    expect(mock.spies.remove).toHaveBeenCalledWith('a')
    // 直接验证 chrome.storage.local.remove 接受 string[]
    await mock.spies.remove(['b'])
    expect(mock.storage.b).toBeUndefined()
  })
})

// ============ 4. 与 zustand persist 集成 ============
//
// 策略:不直接 import zustand(避免跨 workspace 解析问题),
// 通过 @ihui/shared 暴露的 createAuthStore(createJSONStorage + persist 内部已封装)
// 间接验证"createChromeStorageTransport 作为 persist storage"的行为。

describe('createChromeStorageTransport 与 zustand persist 集成', () => {
  let mock: ReturnType<typeof buildChromeMock>

  beforeEach(() => {
    mock = buildChromeMock()
    vi.stubGlobal('chrome', mock.chrome)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('用 createChromeStorageTransport 作 zustand persist 的 storage,setState 后 getState 持久化到 chrome.storage.local', async () => {
    const tokenStore = createInMemoryTokenStore()
    const userTransport = createChromeStorageTransport()
    const auth = createAuthStore({
      tokenStore,
      userTransport,
      userPersistKey: 'ihui-auth-user',
    })

    // === 初始态:user=null ===
    expect(auth.getState().user).toBeNull()

    // === setAuth 写入 token + user ===
    await auth.getState().setAuth({
      token: 'tk-1',
      refreshToken: 'rt-1',
      expiresIn: 3600,
      user: { id: 'u1', nickname: 'alice', email: 'a@b.com' } as never,
    })

    expect(auth.getState().user).toEqual({ id: 'u1', nickname: 'alice', email: 'a@b.com' })
    expect(auth.getState().isAuthenticated).toBe(true)

    // 等待 zustand persist 异步落盘
    await vi.waitFor(() => {
      expect(mock.spies.set).toHaveBeenCalled()
    })

    // chrome.storage.local 中应能找到持久化的 JSON(包含 user + isAuthenticated,不含 token)
    const persisted = mock.storage['ihui-auth-user']
    expect(typeof persisted).toBe('string')
    const parsed = JSON.parse(persisted as string)
    expect(parsed.state.user).toEqual({ id: 'u1', nickname: 'alice', email: 'a@b.com' })
    expect(parsed.state.isAuthenticated).toBe(true)
    // 安全:token 永远不应落盘(只持久化 user + isAuthenticated)
    expect(parsed.state.token).toBeUndefined()
  })

  it('模拟新 store 创建(hydrate)能从 chrome.storage.local 恢复之前 user 状态', async () => {
    // === 第一次:创建 store + 写入 user ===
    {
      const tokenStore = createInMemoryTokenStore()
      const userTransport = createChromeStorageTransport()
      const auth = createAuthStore({
        tokenStore,
        userTransport,
        userPersistKey: 'ihui-auth-user',
      })
      await auth.getState().setAuth({
        token: 'tk-x',
        user: { id: 'u1', nickname: 'alice', email: 'a@b.com' } as never,
      })

      // 等待落盘
      await vi.waitFor(() => {
        expect(mock.storage['ihui-auth-user']).toBeDefined()
      })
    }

    // === 验证 transport 层:从 chrome.storage.local 直接读 ===
    const transport = createChromeStorageTransport()
    const raw = await transport.getItem('ihui-auth-user')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string)
    expect(parsed.state.user.nickname).toBe('alice')
    expect(parsed.state.isAuthenticated).toBe(true)

    // === 第二次:新建 store(同 storage key)→ 触发 hydrate 恢复 user ===
    {
      const tokenStore2 = createInMemoryTokenStore()
      const userTransport2 = createChromeStorageTransport()
      const auth2 = createAuthStore({
        tokenStore: tokenStore2,
        userTransport: userTransport2,
        userPersistKey: 'ihui-auth-user',
      })

      // 等待 zustand persist 的 rehydrate 完成
      await vi.waitFor(() => {
        expect(auth2.getState().user).toEqual({
          id: 'u1',
          nickname: 'alice',
          email: 'a@b.com',
        })
        expect(auth2.getState().isAuthenticated).toBe(true)
      })
    }
  })
})

// ============ 5. chrome 全局不可用 fallback ============

describe('chrome 全局不可用 fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('globalThis.chrome = undefined 时 fallback 到内存 transport,不抛错', async () => {
    // 显式 stub chrome 为 undefined(模拟 SSR / Service Worker 启动早期)
    vi.stubGlobal('chrome', undefined)

    const t = createChromeStorageTransport()

    // 三个方法均应可用且不抛错
    expect(await t.getItem('any')).toBeNull()
    await t.setItem('any', 'value')
    expect(await t.getItem('any')).toBe('value')
    await t.removeItem('any')
    expect(await t.getItem('any')).toBeNull()
  })

  it('未 stub 时(原生 node 环境无 chrome)也自动 fallback', async () => {
    // 不调用 vi.stubGlobal,保持 chrome 不存在
    const t = createChromeStorageTransport()
    expect(await t.getItem('k')).toBeNull()
    await t.setItem('k', 'v')
    expect(await t.getItem('k')).toBe('v')
  })
})

// ============ 6. chrome.storage 缺失 API fallback ============

describe('chrome.storage 缺失 API fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('chrome 存在但 chrome.storage === undefined → fallback', async () => {
    vi.stubGlobal('chrome', { storage: undefined })
    const t = createChromeStorageTransport()
    await t.setItem('k', 'v')
    expect(await t.getItem('k')).toBe('v')
  })

  it('chrome.storage 存在但 chrome.storage.local === undefined → fallback', async () => {
    vi.stubGlobal('chrome', { storage: { local: undefined } })
    const t = createChromeStorageTransport()
    await t.setItem('k', 'v')
    expect(await t.getItem('k')).toBe('v')
  })

  it('chrome.storage.local 存在但 get 方法缺失 → fallback', async () => {
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          // 故意不提供 get / set / remove
          someOtherMethod: vi.fn(),
        },
      },
    })
    const t = createChromeStorageTransport()
    await t.setItem('k', 'v')
    expect(await t.getItem('k')).toBe('v')
  })
})
