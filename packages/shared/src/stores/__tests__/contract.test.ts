/**
 * @ihui/shared/stores contract tests
 *
 * 覆盖范围(2026-07-25 立,18 场景):
 * 1. transport 抽象(5 场景):memory/sync/async/ssr-safe/json-decorator
 * 2. auth-store 工厂(6 场景):初始态/setAuth/setUser/logout/hydrate/persist
 * 3. user-store 工厂(4 场景):初始态/setProfile/updateProfile/persist
 * 4. theme-store 工厂(3 场景):初始态/setTheme/onChange/toggleHighContrast
 *
 * 验证 3 个 store 工厂 + transport 抽象的接口契约,确保 5 端接入时行为一致。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createMemoryTransport,
  createSyncTransport,
  createAsyncTransport,
  createJsonTransport,
  createSSRSafeTransport,
  createAuthStore,
  createUserStore,
  createThemeStore,
  type PersistTransport,
} from '../index'
import type { TokenStore } from '../../auth/token-store'
import type { AuthUser } from '@ihui/api-client'

// ============ Test fixtures ============

const mockUser: AuthUser = {
  id: 'u1',
  nickname: 'Test User',
  email: 'test@ihui.ai',
} as unknown as AuthUser

function createMockTokenStore(initial: { token?: string | null; refreshToken?: string | null } = {}): TokenStore & {
  _setToken: (t: string | null) => void
  _setRefreshToken: (t: string | null) => void
} {
  let token = initial.token ?? null
  let refreshToken = initial.refreshToken ?? null
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
    _setToken: (t) => {
      token = t
    },
    _setRefreshToken: (t) => {
      refreshToken = t
    },
  }
}

// ============ 1. transport 抽象 ============

describe('transport 抽象', () => {
  it('createMemoryTransport:set/get/remove 内存读写', () => {
    const t = createMemoryTransport()
    expect(t.getItem('k')).toBeNull()
    t.setItem('k', 'v')
    expect(t.getItem('k')).toBe('v')
    t.removeItem('k')
    expect(t.getItem('k')).toBeNull()
  })

  it('createSyncTransport:包装同步 storage,签名不变', () => {
    const store = new Map<string, string>()
    const t = createSyncTransport({
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => {
        store.set(k, v)
      },
      removeItem: (k) => {
        store.delete(k)
      },
    })
    t.setItem('k', 'v')
    expect(t.getItem('k')).toBe('v')
    t.removeItem('k')
    expect(t.getItem('k')).toBeNull()
  })

  it('createAsyncTransport:包装异步 storage,getItem 返回 Promise', async () => {
    const store = new Map<string, string>()
    const t = createAsyncTransport({
      getItem: async (k) => store.get(k) ?? null,
      setItem: async (k, v) => {
        store.set(k, v)
      },
      removeItem: async (k) => {
        store.delete(k)
      },
    })
    await t.setItem('k', 'v')
    await expect(t.getItem('k')).resolves.toBe('v')
    await t.removeItem('k')
    await expect(t.getItem('k')).resolves.toBeNull()
  })

  it('createJsonTransport:在 base transport 之上加 JSON 序列化(实际仍透传 string)', async () => {
    const inner = createMemoryTransport()
    const json = createJsonTransport(inner)
    await json.setItem('k', JSON.stringify({ a: 1 }))
    const raw = await json.getItem('k')
    expect(JSON.parse(raw!)).toEqual({ a: 1 })
  })

  it('createSSRSafeTransport:客户端 storage 不可用时 fallback 到内存', () => {
    const safe = createSSRSafeTransport(() => {
      throw new Error('no client storage')
    })
    // 即使 adapter 抛错,也不应 crash,使用内存 fallback
    safe.setItem('k', 'v')
    expect(safe.getItem('k')).toBe('v')
  })
})

// ============ 2. auth-store 工厂 ============

describe('createAuthStore 工厂', () => {
  let tokenStore: ReturnType<typeof createMockTokenStore>
  let userTransport: PersistTransport
  let onLogin: ReturnType<typeof vi.fn>
  let onLogout: ReturnType<typeof vi.fn>

  beforeEach(() => {
    tokenStore = createMockTokenStore()
    userTransport = createMemoryTransport()
    onLogin = vi.fn()
    onLogout = vi.fn()
  })

  it('初始态:token/user 均为 null,isAuthenticated false', () => {
    const auth = createAuthStore({ tokenStore, userTransport })
    const s = auth.getState()
    expect(s.token).toBeNull()
    expect(s.user).toBeNull()
    expect(s.isAuthenticated).toBe(false)
    expect(s.ready).toBe(false)
  })

  it('setAuth:写 tokenStore + 镜像本地 + isAuthenticated 变 true + 触发 onLogin', async () => {
    const auth = createAuthStore({ tokenStore, userTransport, onLogin })
    await auth.getState().setAuth({ token: 'tk-1', refreshToken: 'rt-1', user: mockUser })
    expect(tokenStore.getToken()).toBe('tk-1')
    expect(tokenStore.getRefreshToken()).toBe('rt-1')
    const s = auth.getState()
    expect(s.token).toBe('tk-1')
    expect(s.refreshToken).toBe('rt-1')
    expect(s.isAuthenticated).toBe(true)
    expect(s.user).toEqual(mockUser)
    expect(onLogin).toHaveBeenCalledWith(mockUser)
  })

  it('setUser:仅更新 user 字段,不触发 tokenStore 写入', () => {
    const auth = createAuthStore({ tokenStore, userTransport })
    auth.getState().setUser(mockUser)
    expect(auth.getState().user).toEqual(mockUser)
    expect(tokenStore.getToken()).toBeNull()
  })

  it('logout:清 tokenStore + 清本地 + 触发 onLogout', async () => {
    const auth = createAuthStore({ tokenStore, userTransport, onLogout })
    await auth.getState().setAuth({ token: 'tk-1', user: mockUser })
    await auth.getState().logout()
    expect(tokenStore.getToken()).toBeNull()
    const s = auth.getState()
    expect(s.token).toBeNull()
    expect(s.user).toBeNull()
    expect(s.isAuthenticated).toBe(false)
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('hydrate:从 tokenStore 同步镜像 token/refreshToken', () => {
    tokenStore._setToken('tk-from-storage')
    tokenStore._setRefreshToken('rt-from-storage')
    const auth = createAuthStore({ tokenStore, userTransport })
    auth.hydrate()
    const s = auth.getState()
    expect(s.token).toBe('tk-from-storage')
    expect(s.refreshToken).toBe('rt-from-storage')
    expect(s.isAuthenticated).toBe(true)
  })

  it('持久化:仅持久化 user + isAuthenticated,不持久化 token(安全)', async () => {
    const persistTransport = createMemoryTransport()
    const auth = createAuthStore({
      tokenStore,
      userTransport: persistTransport,
      userPersistKey: 'test-auth',
    })
    await auth.getState().setAuth({ token: 'secret-token', user: mockUser })
    // 触发 persist(zustand persist 是异步的,等待 microtask)
    await new Promise((r) => setTimeout(r, 10))
    const raw = await persistTransport.getItem('test-auth')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    // 关键:不包含 token 字段
    expect(parsed.state.token).toBeUndefined()
    expect(parsed.state.user).toEqual(mockUser)
    expect(parsed.state.isAuthenticated).toBe(true)
  })
})

// ============ 3. user-store 工厂 ============

describe('createUserStore 工厂', () => {
  interface TestProfile {
    id: string
    name: string
  }

  it('初始态:profile/loading/error 均为默认', () => {
    const user = createUserStore<TestProfile>()
    const s = user.getState()
    expect(s.profile).toBeNull()
    expect(s.loading).toBe(false)
    expect(s.error).toBeNull()
  })

  it('setProfile:全量替换 profile', () => {
    const user = createUserStore<TestProfile>()
    user.getState().setProfile({ id: '1', name: 'Alice' })
    expect(user.getState().profile).toEqual({ id: '1', name: 'Alice' })
  })

  it('updateProfile:浅合并(基于现有 profile)', () => {
    const user = createUserStore<TestProfile>()
    user.getState().setProfile({ id: '1', name: 'Alice' })
    user.getState().updateProfile({ name: 'Bob' })
    expect(user.getState().profile).toEqual({ id: '1', name: 'Bob' })
  })

  it('updateProfile:profile 为 null 时不报错(无操作)', () => {
    const user = createUserStore<TestProfile>()
    user.getState().updateProfile({ name: 'Bob' })
    expect(user.getState().profile).toBeNull()
  })

  it('持久化:通过 transport 持久化 profile', async () => {
    const transport = createMemoryTransport()
    const user = createUserStore<TestProfile>({ transport, persistKey: 'test-user' })
    user.getState().setProfile({ id: '1', name: 'Alice' })
    await new Promise((r) => setTimeout(r, 10))
    const raw = await transport.getItem('test-user')
    expect(raw).toBeTruthy()
  })
})

// ============ 4. theme-store 工厂 ============

describe('createThemeStore 工厂', () => {
  it('初始态:theme=system / accentColor=green / fontSize=medium / highContrast=false', () => {
    const theme = createThemeStore()
    const s = theme.getState()
    expect(s.theme).toBe('system')
    expect(s.accentColor).toBe('green')
    expect(s.fontSize).toBe('medium')
    expect(s.highContrast).toBe(false)
  })

  it('setTheme:更新 theme + 触发 onChange', () => {
    const onChange = vi.fn()
    const theme = createThemeStore({ onChange })
    theme.getState().setTheme('dark')
    expect(theme.getState().theme).toBe('dark')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }))
  })

  it('setAccentColor / setFontSize / toggleHighContrast:各自更新对应字段 + 触发 onChange', () => {
    const onChange = vi.fn()
    const theme = createThemeStore({ onChange })
    theme.getState().setAccentColor('blue')
    expect(theme.getState().accentColor).toBe('blue')
    theme.getState().setFontSize('large')
    expect(theme.getState().fontSize).toBe('large')
    theme.getState().toggleHighContrast()
    expect(theme.getState().highContrast).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  it('自定义初始值生效', () => {
    const theme = createThemeStore({
      initialTheme: 'dark',
      initialAccentColor: 'purple',
      initialFontSize: 'large',
    })
    const s = theme.getState()
    expect(s.theme).toBe('dark')
    expect(s.accentColor).toBe('purple')
    expect(s.fontSize).toBe('large')
  })
})
