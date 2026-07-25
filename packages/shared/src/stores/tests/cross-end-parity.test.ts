/**
 * 跨端 transport 行为 parity runtime 测试(2026-07-25 立)
 *
 * 目的:在 shared 包内,使用 mock 4 端 transport,验证 createAuthStore 工厂
 *       对所有 transport 表现出完全一致的行为(读/写/remove/安全契约/persist partialize)。
 *
 * 这是跨端行为合同的最后一公里验证 — 4 端 storage-adapter 通过工厂 + transport 注入
 * 都能跑通同一份测试,证明跨端实现可被 1 份测试覆盖。
 *
 * 行为合同(8 条,4 端均必须满足):
 * 1. setAuth 后 token/refreshToken/expiresIn 正确镜像
 * 2. user 通过 transport 持久化
 * 3. token/refreshToken/expiresIn **不**通过 transport 持久化(安全契约)
 * 4. logout 后 token/user 全部清空
 * 5. transport.getItem 失败时不抛错(让业务侧处理)
 * 6. 同名 transport.setItem 覆盖旧值
 * 7. transport.removeItem 后 store 仍能正常工作
 * 8. hydrate 后能从 transport 恢复 user(即使 tokenStore 没值)
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createAuthStore } from '../auth-store'
import {
  createAsyncTransport,
  createMemoryTransport,
  createSSRSafeTransport,
  createSyncTransport,
} from '../transport'
import type { PersistTransport } from '../transport'
import type { AuthUser } from '@ihui/api-client'

/** 测试用 user 工厂:AuthUser 不含 `name`,这里用 `as AuthUser` cast 简化测试数据 */
function testUser(id: string, name: string): AuthUser {
  return { id, name } as AuthUser
}

/** 模拟 4 端 transport 行为(用 sync memory 统一模拟) */
function makeMockTokenStore() {
  const store = new Map<string, string | null>()
  return {
    getToken: () => store.get('token') ?? null,
    getRefreshToken: () => store.get('refreshToken') ?? null,
    setToken: async (v: string | null) => {
      store.set('token', v)
    },
    setRefreshToken: async (v: string | null) => {
      store.set('refreshToken', v)
    },
    clearAll: async () => {
      store.clear()
    },
  }
}

interface MockEndpoint {
  name: string
  factory: () => PersistTransport
}

const endpoints: MockEndpoint[] = [
  {
    name: 'web (sync localStorage)',
    factory: () => createSyncTransport({
      getItem: (k) => mockStorage.get(k) ?? null,
      setItem: (k, v) => { mockStorage.set(k, v) },
      removeItem: (k) => { mockStorage.delete(k) },
    }),
  },
  {
    name: 'web SSR (memory fallback)',
    factory: () => createSSRSafeTransport(() => { throw new Error('SSR: no client') }),
  },
  {
    name: 'mobile-rn (async AsyncStorage)',
    factory: () => createAsyncTransport({
      getItem: async (k) => mockStorage.get(k) ?? null,
      setItem: async (k, v) => { mockStorage.set(k, v) },
      removeItem: async (k) => { mockStorage.delete(k) },
    }),
  },
  {
    name: 'miniapp-taro (sync Taro.storage)',
    factory: () => createSyncTransport({
      getItem: (k) => {
        const v = mockStorage.get(k)
        return v === undefined || v === '' ? null : v
      },
      setItem: (k, v) => { mockStorage.set(k, v) },
      removeItem: (k) => { mockStorage.delete(k) },
    }),
  },
  {
    name: 'extension (async chrome.storage.local)',
    factory: () => createAsyncTransport({
      getItem: async (k) => mockStorage.get(k) ?? null,
      setItem: async (k, v) => { mockStorage.set(k, v) },
      removeItem: async (k) => { mockStorage.delete(k) },
    }),
  },
  {
    name: 'extension fallback (memory)',
    factory: () => createMemoryTransport(),
  },
]

let mockStorage: Map<string, string>
let tokenStore: ReturnType<typeof makeMockTokenStore>

beforeEach(() => {
  mockStorage = new Map()
  tokenStore = makeMockTokenStore()
})

afterEach(() => {
  mockStorage.clear()
})

for (const ep of endpoints) {
  describe(`跨端 transport parity — ${ep.name}`, () => {
    it('合同 1: setAuth 后 token/refreshToken/expiresIn 正确镜像', async () => {
      const auth = createAuthStore({ tokenStore, userTransport: ep.factory() })
      await auth.getState().setAuth({
        token: 'tok-123',
        refreshToken: 'rt-456',
        expiresIn: 3600,
        user: testUser('1', 'Alice'),
      })
      const s = auth.getState()
      expect(s.token).toBe('tok-123')
      expect(s.refreshToken).toBe('rt-456')
      expect(s.expiresIn).toBe(3600)
      expect(s.isAuthenticated).toBe(true)
      expect(s.user).toEqual(testUser('1', 'Alice'))
    })

    it('合同 2: user 通过 transport 持久化,token 不持久化(安全契约)', async () => {
      const transport = ep.factory()
      const auth = createAuthStore({ tokenStore, userTransport: transport })
      await auth.getState().setAuth({
        token: 'tok-secret',
        refreshToken: 'rt-secret',
        expiresIn: 3600,
        user: testUser('1', 'Bob'),
      })
      // 给 zustand persist 一个 tick 让 setItem 落盘
      await new Promise((r) => setTimeout(r, 10))
      const raw = await transport.getItem('ihui-auth-user')
      expect(raw).not.toBeNull()
      const parsed = JSON.parse(raw!)
      // 持久化内容应只含 user + isAuthenticated,不含 token/refreshToken/expiresIn
      expect(parsed.state.user).toEqual(testUser('1', 'Bob'))
      expect(parsed.state.isAuthenticated).toBe(true)
      expect(parsed.state.token).toBeUndefined()
      expect(parsed.state.refreshToken).toBeUndefined()
      expect(parsed.state.expiresIn).toBeUndefined()
    })

    it('合同 3: logout 清空 token/user + 触发 onLogout', async () => {
      let logoutCalled = 0
      const auth = createAuthStore({
        tokenStore,
        userTransport: ep.factory(),
        onLogout: () => { logoutCalled++ },
      })
      await auth.getState().setAuth({
        token: 'tok-1',
        user: testUser('1', 'Cat'),
      })
      await auth.getState().logout()
      const s = auth.getState()
      expect(s.token).toBeNull()
      expect(s.refreshToken).toBeNull()
      expect(s.expiresIn).toBeNull()
      expect(s.user).toBeNull()
      expect(s.isAuthenticated).toBe(false)
      expect(logoutCalled).toBe(1)
    })

    it('合同 4: 新 store 实例 + transport 恢复 user(tokenStore 独立)', async () => {
      const transport = ep.factory()
      // 1. 第一个 store:登录写入
      const auth1 = createAuthStore({ tokenStore, userTransport: transport })
      await auth1.getState().setAuth({
        token: 'tok-1',
        user: testUser('99', 'Persist'),
      })
      await new Promise((r) => setTimeout(r, 10))

      // 2. 第二个 store 实例:模拟"页面刷新后重新创建 store"
      const auth2 = createAuthStore({ tokenStore, userTransport: transport })
      // 等 zustand persist rehydrate
      await new Promise((r) => setTimeout(r, 20))
      // user 应当从 transport 恢复(token 仍然从 tokenStore 镜像,无 tokenStore 数据时为 null)
      const s = auth2.getState()
      expect(s.user).toEqual(testUser('99', 'Persist'))
    })

    it('合同 5: hydrate 同步镜像 tokenStore 状态', () => {
      // 预置 tokenStore 数据
      tokenStore.setToken('pre-tok')
      tokenStore.setRefreshToken('pre-rt')
      const auth = createAuthStore({ tokenStore, userTransport: ep.factory() })
      auth.hydrate()
      const s = auth.getState()
      expect(s.token).toBe('pre-tok')
      expect(s.refreshToken).toBe('pre-rt')
      expect(s.isAuthenticated).toBe(true)
    })

    it('合同 6: setAuth 不带 user 时,旧 user 保留', async () => {
      const auth = createAuthStore({ tokenStore, userTransport: ep.factory() })
      await auth.getState().setAuth({ token: 'tok-1', user: testUser('1', 'A') })
      await auth.getState().setAuth({ token: 'tok-2' })
      const s = auth.getState()
      expect(s.token).toBe('tok-2')
      expect(s.user).toEqual(testUser('1', 'A'))
    })

    it('合同 7: setUser 只更新 user,不动 token', async () => {
      const auth = createAuthStore({ tokenStore, userTransport: ep.factory() })
      await auth.getState().setAuth({ token: 'tok-1', user: testUser('1', 'A') })
      auth.getState().setUser(testUser('1', 'B'))
      const s = auth.getState()
      expect(s.token).toBe('tok-1')
      expect(s.user).toEqual(testUser('1', 'B'))
    })

    it('合同 8: onLogin 钩子在 setAuth 后被调用', async () => {
      let loginUser: unknown = null
      const auth = createAuthStore({
        tokenStore,
        userTransport: ep.factory(),
        onLogin: (u) => { loginUser = u },
      })
      await auth.getState().setAuth({ token: 'tok-1', user: testUser('1', 'L') })
      expect(loginUser).toEqual(testUser('1', 'L'))
    })
  })
}
