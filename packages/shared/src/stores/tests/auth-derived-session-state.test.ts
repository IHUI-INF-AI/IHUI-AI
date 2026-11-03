// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-456 的常驻尺子(2026-09-28):登录态只能有一个真相 —— 「有没有 token」。
 *
 * 钉的是收口前后都必须成立的四件事:
 *  ① 旧 blob(带 isAuthenticated:true)在**没 hydrate 之前**也不得把 true 渗进 state
 *     —— zustand 默认 merge 是 {...current, ...persisted},不剥键就是把第二份真相
 *     原样请回来,「token 已清而 UI 认为已登录」那型事故照旧;
 *  ② 反向形态不伤人:旧 blob 写 false 而真有 token ⇒ hydrate 后必须是 true
 *     (判成 false = 把用户踢下线,比原病更响);
 *  ③ 新写入的持久化 blob 在**结构位**上不含 isAuthenticated(判结构位,不判字符串 ——
 *     注释/文档里出现这个词是合法的);
 *  ④ 正向链路不破:登录成功能持久 user,登出后 blob 同步干净。
 * 旧形状兼容口径:读到旧键**只当 user 资料收**,登录态一律重派生 —— 不是当场判「没登录」。
 */
import { describe, it, expect } from 'vitest'
import { createAuthStore, createMemoryTransport } from '../index'
import type { TokenStore } from '../../auth/token-store'
import type { AuthUser } from '@ihui/api-client'

const mockUser = {
  id: 'u1',
  nickname: 'Test User',
  email: 'test@aizhs.top',
} as unknown as AuthUser

function createMockTokenStore(
  initial: { token?: string | null; refreshToken?: string | null } = {},
): TokenStore & { _setToken: (t: string | null) => void } {
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
  }
}

/** zustand persist 的落盘格式:{ state, version } */
function seedLegacyBlob(
  transport: ReturnType<typeof createMemoryTransport>,
  key: string,
  state: Record<string, unknown>,
) {
  return transport.setItem(key, JSON.stringify({ state, version: 1 }))
}

const tick = () => new Promise((r) => setTimeout(r, 10))

describe('G-456 登录态单一真相(持久化里不得有 isAuthenticated)', () => {
  it('① 旧 blob 带 true + 无 token ⇒ 未 hydrate 也不得渗进 state;hydrate 后仍 false,user 保留', async () => {
    const transport = createMemoryTransport()
    await seedLegacyBlob(transport, 'ihui-auth-user', {
      user: mockUser,
      isAuthenticated: true,
    })
    const auth = createAuthStore({
      tokenStore: createMockTokenStore(),
      userTransport: transport,
      userPersistKey: 'ihui-auth-user',
    })
    await tick() // 等 persist rehydrate 完成(夹具与既有契约测试同形)
    expect(auth.getState().user).toEqual(mockUser) // user 资料照收
    expect(auth.getState().isAuthenticated).toBe(false) // 第二份真相不得渗入
    auth.hydrate()
    expect(auth.getState().isAuthenticated).toBe(false) // 派生真值:无 token ⇒ 未登录
  })

  it('② 旧 blob 写 false + 真有 token ⇒ hydrate 后必须 true(不得把用户踢下线)', async () => {
    const transport = createMemoryTransport()
    await seedLegacyBlob(transport, 'ihui-auth-user', {
      user: mockUser,
      isAuthenticated: false,
    })
    const auth = createAuthStore({
      tokenStore: createMockTokenStore({ token: 'tk-live' }),
      userTransport: transport,
      userPersistKey: 'ihui-auth-user',
    })
    await tick()
    auth.hydrate()
    expect(auth.getState().isAuthenticated).toBe(true)
    expect(auth.getState().user).toEqual(mockUser)
  })

  it('③ 新写入的 blob 结构位不含 isAuthenticated(判结构位,不判字符串)', async () => {
    const transport = createMemoryTransport()
    const auth = createAuthStore({
      tokenStore: createMockTokenStore(),
      userTransport: transport,
      userPersistKey: 'ihui-auth-user',
    })
    await auth.getState().setAuth({ token: 'tk-1', user: mockUser })
    await tick()
    const raw = await transport.getItem('ihui-auth-user')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!) as { state: Record<string, unknown> }
    expect(Object.keys(parsed.state)).not.toContain('isAuthenticated')
    expect(parsed.state.user).toEqual(mockUser)
  })

  it('④ 正向链路:登出后 blob 同步干净,且同样不含登录态键', async () => {
    const transport = createMemoryTransport()
    const auth = createAuthStore({
      tokenStore: createMockTokenStore(),
      userTransport: transport,
      userPersistKey: 'ihui-auth-user',
    })
    await auth.getState().setAuth({ token: 'tk-1', user: mockUser })
    await tick()
    await auth.getState().logout()
    await tick()
    const raw = await transport.getItem('ihui-auth-user')
    const parsed = JSON.parse(raw!) as { state: Record<string, unknown> }
    expect(Object.keys(parsed.state)).not.toContain('isAuthenticated')
    expect(auth.getState().isAuthenticated).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
