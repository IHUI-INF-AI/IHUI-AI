/**
 * @ihui/miniapp-taro/stores/storage-adapter runtime 集成测试
 *
 * 验证 createTaroStorageTransport 包装 Taro.storage 同步 API 的实际行为,
 * 以及与 @ihui/shared/stores createAuthStore(zustand persist 中间件)集成时的
 * 端到端持久化 + hydrate 恢复契约。
 *
 * 覆盖场景(共 10 组,1+1+1+1+3+1+1+1 拆分):
 *  1. createTaroStorageTransport 基础读写
 *  2. createTaroStorageTransport 边界值(空串/Unicode/JSON)
 *  3. Taro.storage 同步语义
 *  4. createTaroStorageTransport + zustand persist 集成(setState 持久化 + hydrate 恢复)
 *  5. Taro 全局不可用 fallback(vi.stubGlobal 模拟 globalThis.Taro = undefined)
 *
 * 测试策略:
 *  - vitest 默认 environment=node(见 vitest.config.ts)
 *  - @tarojs/taro 用 vi.mock 模拟,提供可控 taroStorage 内存字典
 *  - 任务场景 4 用 @ihui/shared/stores/createAuthStore + 内存 tokenStore,
 *    每次 beforeEach 重建新 store,避免单例状态污染
 *  - 任务场景 5 用 vi.stubGlobal('Taro', undefined),验证 named import
 *    解耦于 globalThis.Taro(独立于全局变量,transport 不依赖全局对象)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createAuthStore } from '@ihui/shared/stores'
import type { TokenStore } from '@ihui/shared/auth'
import type { PersistTransport } from '@ihui/shared/stores'
import { createTaroStorageTransport } from '../storage-adapter'

// ============ Taro.storage mock ============
// 真实 Taro.storage 行为:getStorageSync 不存在时返回 ''(空串),不是 null;
// setStorageSync/removeStorageSync 同步写底;key 写入后 getStorageSync 同步读出。
const { taroStorage } = vi.hoisted(() => ({
  taroStorage: {} as Record<string, string>,
}))

vi.mock('@tarojs/taro', () => ({
  getStorageSync: (key: string) => {
    // 真实 Taro.storage 语义:key 不存在返回 '';存在返回 string
    return key in taroStorage ? taroStorage[key] : ''
  },
  setStorageSync: (key: string, val: string) => {
    taroStorage[key] = val
  },
  removeStorageSync: (key: string) => {
    delete taroStorage[key]
  },
  default: {
    getStorageSync: (key: string) => (key in taroStorage ? taroStorage[key] : ''),
    setStorageSync: (key: string, val: string) => {
      taroStorage[key] = val
    },
    removeStorageSync: (key: string) => {
      delete taroStorage[key]
    },
  },
}))

// ============ In-memory token store fixture(场景 4 用)============
function createInMemoryTokenStore(): TokenStore & { _clear: () => void } {
  let token: string | null = null
  let refreshToken: string | null = null
  return {
    getToken: () => token,
    getRefreshToken: () => refreshToken,
    setToken: async (t) => {
      token = t
    },
    setRefreshToken: async (t) => {
      refreshToken = t
    },
    clearAll: async () => {
      token = null
      refreshToken = null
    },
    _clear: () => {
      token = null
      refreshToken = null
    },
  }
}

beforeEach(() => {
  // 每个 case 前清空 storage 字典,避免跨测试污染
  Object.keys(taroStorage).forEach((k) => delete taroStorage[k])
  vi.clearAllMocks()
})

afterEach(() => {
  // 清理可能由 vi.stubGlobal 注入的 Taro
  vi.unstubAllGlobals()
})

// ============ 1. createTaroStorageTransport 基础读写 ============

describe('createTaroStorageTransport 基础读写', () => {
  it('setItem 后 getItem 返回原值', () => {
    const transport = createTaroStorageTransport()
    transport.setItem('user-1', 'alice')
    expect(transport.getItem('user-1')).toBe('alice')
  })

  it('getItem 不存在的 key 返回 null(不返回空串)', () => {
    const transport = createTaroStorageTransport()
    // 真实 Taro.storage 底层会返回 '',但 transport 内部归一化为 null
    expect(transport.getItem('not-exist')).toBeNull()
  })

  it('removeItem 后 getItem 返回 null', () => {
    const transport = createTaroStorageTransport()
    transport.setItem('temp', 'value')
    expect(transport.getItem('temp')).toBe('value')
    transport.removeItem('temp')
    expect(transport.getItem('temp')).toBeNull()
  })
})

// ============ 2. createTaroStorageTransport 边界值 ============

describe('createTaroStorageTransport 边界值', () => {
  it('空字符串值正确存取(Taro.storage 返回 "" 时归一化为 null)', () => {
    const transport = createTaroStorageTransport()
    // 先写入空串:setItem 不归一化,落底 string ''
    transport.setItem('blank', '')
    // 底层 mock 走 setStorageSync('blank', '') 写入 taroStorage['blank'] = ''
    // 读取:transport 内部把 '' 视为 null(zustand persist 解析空串会异常)
    expect(transport.getItem('blank')).toBeNull()
  })

  it('中文 / Unicode 值正确存取', () => {
    const transport = createTaroStorageTransport()
    const unicode = '李思涵-🎉-Ω∞-日本語'
    transport.setItem('cn', unicode)
    expect(transport.getItem('cn')).toBe(unicode)
  })

  it('JSON 字符串正确存取(transport 不做 JSON 解析,需调用方自行 JSON.stringify)', () => {
    const transport = createTaroStorageTransport()
    const json = JSON.stringify({ id: 'u1', nickname: 'Alice', tags: ['a', 'b'] })
    transport.setItem('profile', json)
    // transport 只负责 string 透传,JSON.parse 由调用方做
    expect(transport.getItem('profile')).toBe(json)
    expect(JSON.parse(transport.getItem('profile') as string)).toEqual({
      id: 'u1',
      nickname: 'Alice',
      tags: ['a', 'b'],
    })
  })
})

// ============ 3. Taro.storage 同步性 ============

describe('Taro.storage 同步性', () => {
  it('setItem 是同步(返回值不是 Promise)', () => {
    const transport = createTaroStorageTransport()
    const ret = transport.setItem('k', 'v')
    // createSyncTransport 透传 adapter.setItem 同步返回 void
    expect(ret).toBeUndefined()
    // 写入后立即可读,证明同步
    expect(transport.getItem('k')).toBe('v')
  })

  it('getItem 同步返回(string 或 null,不返回 Promise)', () => {
    const transport = createTaroStorageTransport()
    transport.setItem('a', '1')
    const v = transport.getItem('a')
    expect(v).toBe('1')
    // 类型层面同步:getItem 返回类型是 string | null(TS 静态保证)
    // 运行时验证 v 不是 Promise 实例
    expect(typeof v).toBe('string')
    expect(v).not.toBeInstanceOf(Promise)
  })
})

// ============ 4. createTaroStorageTransport + zustand persist 集成 ============

describe('createTaroStorageTransport + zustand persist 集成', () => {
  it('setState 后 getState 通过 transport 持久化', () => {
    const transport = createTaroStorageTransport()
    const useStore = create<{ name: string; setName: (n: string) => void }>()(
      persist(
        (set) => ({
          name: '',
          setName: (n) => set({ name: n }),
        }),
        {
          name: 'demo-user',
          storage: createJSONStorage(() => transport as PersistTransport),
        },
      ),
    )

    expect(useStore.getState().name).toBe('')
    useStore.getState().setName('Bob')
    // 写入后底层 taroStorage['demo-user'] 应有 zustand persist 包装的 JSON
    // zustand persist 存储格式:{ state: <partialized>, version: 0 }
    const persisted = transport.getItem('demo-user')
    expect(persisted).not.toBeNull()
    const parsed = JSON.parse(persisted as string)
    expect(parsed.state).toEqual({ name: 'Bob' })
    expect(parsed.version).toBe(0)
  })

  it('新 store 创建(hydrate)能从 transport 恢复之前状态', () => {
    // 第 1 步:第一个 store 写入,关闭
    const transport1 = createTaroStorageTransport()
    const useStore1 = create<{ count: number; inc: () => void }>()(
      persist(
        (set) => ({
          count: 0,
          inc: () => set((s) => ({ count: s.count + 1 })),
        }),
        {
          name: 'demo-count',
          storage: createJSONStorage(() => transport1 as PersistTransport),
        },
      ),
    )
    useStore1.getState().inc()
    useStore1.getState().inc()
    useStore1.getState().inc()
    expect(useStore1.getState().count).toBe(3)
    // 持久化层已写入(zustand persist 包装格式:{ state, version })
    const persisted1 = JSON.parse(transport1.getItem('demo-count') as string)
    expect(persisted1.state).toEqual({ count: 3 })

    // 第 2 步:新 store 用同一个 transport key hydrate,count 应恢复
    const transport2 = createTaroStorageTransport() // 新 transport 实例,但共享 Taro.storage 后端
    const useStore2 = create<{ count: number; inc: () => void }>()(
      persist(
        () => ({ count: 0, inc: () => {} }),
        {
          name: 'demo-count',
          storage: createJSONStorage(() => transport2 as PersistTransport),
        },
      ),
    )
    // zustand persist 在 store 创建时同步 hydrate(createJSONStorage 默认 sync 行为,
    // 即使 base transport 是 sync,getItem 也可同步返回)
    expect(useStore2.getState().count).toBe(3)
  })

  it('createAuthStore 集成:user 持久化 + 跨 store 实例 hydrate 恢复 isAuthenticated + user', async () => {
    // 第 1 步:用真实 createAuthStore + createTaroStorageTransport 写入登录态
    const tokenStore1 = createInMemoryTokenStore()
    const userTransport1 = createTaroStorageTransport()
    const auth1 = createAuthStore<{ id: string; nickname: string }>({
      tokenStore: tokenStore1,
      userTransport: userTransport1,
      userPersistKey: 'miniapp-auth-user',
    })
    await auth1.getState().setAuth({
      token: 'tk-1',
      refreshToken: 'rt-1',
      expiresIn: 3600,
      user: { id: 'u1', nickname: 'Alice' },
    })

    // token 一定不落盘(安全契约)
    expect(userTransport1.getItem('miniapp-auth-user')).not.toContain('tk-1')
    // user + isAuthenticated 持久化(zustand persist 包装格式:{ state, version })
    const persisted = JSON.parse(userTransport1.getItem('miniapp-auth-user') as string)
    expect(persisted.state).toEqual({
      isAuthenticated: true,
      user: { id: 'u1', nickname: 'Alice' },
    })

    // 第 2 步:新 store 实例(模拟 App 重启)+ 同一 transport 通道,hydrate 后应恢复 user
    const tokenStore2 = createInMemoryTokenStore() // 空的,无 token
    const userTransport2 = createTaroStorageTransport()
    // createAuthStore 内部用 async StateStorage 包装 transport,hydrate 是异步的,
    // 需要等 onRehydrateStorage 回调完成(此回调将 state.ready 置 true)
    const auth2 = createAuthStore<{ id: string; nickname: string }>({
      tokenStore: tokenStore2,
      userTransport: userTransport2,
      userPersistKey: 'miniapp-auth-user',
    })

    // 等 hydrate 完成(ready → true),poll ready 标志
    await new Promise<void>((resolve) => {
      const check = () => {
        if (auth2.getState().ready) {
          resolve()
        } else {
          setTimeout(check, 1)
        }
      }
      check()
    })

    // user 已恢复
    expect(auth2.getState().user).toEqual({ id: 'u1', nickname: 'Alice' })
    expect(auth2.getState().isAuthenticated).toBe(true)
    // token 不持久化 → tokenStore2 仍为空
    expect(tokenStore2.getToken()).toBeNull()
  })
})

// ============ 5. Taro 全局不可用 fallback ============

describe('Taro 全局不可用 fallback(vi.stubGlobal 模拟 globalThis.Taro = undefined)', () => {
  it('globalThis.Taro 不可用时,transport 创建 + 操作不崩溃', () => {
    // storage-adapter 用 named import 引入 getStorageSync/setStorageSync/removeStorageSync,
    // 模块加载时已绑定 vi.mock 返回的函数(内存字典),不依赖 globalThis.Taro。
    // 此 case 验证:即便 globalThis.Taro 缺失,transport 仍能正常 work,语义不依赖全局。
    vi.stubGlobal('Taro', undefined)

    let transport: ReturnType<typeof createTaroStorageTransport>
    expect(() => {
      transport = createTaroStorageTransport()
    }).not.toThrow()

    // transport 三方法均可用,且走 vi.mock 的内存字典(不读 globalThis.Taro)
    expect(() => transport!.setItem('k1', 'v1')).not.toThrow()
    expect(transport!.getItem('k1')).toBe('v1')
    expect(() => transport!.removeItem('k1')).not.toThrow()
    expect(transport!.getItem('k1')).toBeNull()
  })

  it('globalThis.Taro 是空对象时,transport 仍工作(不访问全局 Taro 上的方法)', () => {
    // 模拟"Taro 全局对象存在但没挂 storage 方法"场景
    vi.stubGlobal('Taro', { setStorage: () => undefined, someOther: 'noise' })

    const transport = createTaroStorageTransport()
    transport.setItem('k2', 'v2')
    // 仍然走 named import(vi.mock 的内存字典),不读 globalThis.Taro 上的方法
    expect(transport.getItem('k2')).toBe('v2')
    expect(transport.getItem('missing')).toBeNull()
  })
})
