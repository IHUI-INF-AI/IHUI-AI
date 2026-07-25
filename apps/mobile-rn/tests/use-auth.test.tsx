/**
 * useAuth 跨端共享 hook 集成测试(阶段 6 验证)
 *
 * 验证 @ihui/shared/hooks/useAuth + @ihui/shared/auth/createInMemoryTokenStore
 * 在 mobile-rn 端消费的真实可用性。
 *
 * 覆盖场景:
 * 1. ready 状态:autoBind=true 时 hook 挂载后 ready=true
 * 2. login:写 token + 可选拉 profile(newUser 已传则跳过 fetchProfile)
 * 3. logout:调 logoutApi(失败不阻塞)+ clearAll + 清 state
 * 4. refresh:默认实现返回 false
 * 5. setUser:直接更新 user
 * 6. autoBind=false:不调 bindTransport,ready 仍变 true
 * 7. fetchProfile 失败:user 保持 null
 * 8. logoutApi 抛异常:本地清理仍执行
 *
 * 测试策略:
 * - 用 createInMemoryTokenStore(共享层工厂)作为 mock store,真实测试 hook + factory 组合
 * - 用 renderHook + act + waitFor 模拟 React 组件生命周期
 * - 不 mock 任何 RN / SecureStore API,纯 React hooks 行为验证
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuth } from '@ihui/shared/hooks'
import { createInMemoryTokenStore } from '@ihui/shared/auth'
import type { TokenStore } from '@ihui/shared/auth'

// 测试用 mock user 类型
interface TestUser {
  id: string
  nickname: string
}

const mockUser: TestUser = { id: 'u-1', nickname: 'tester' }

describe('useAuth 跨端共享 hook — 集成测试', () => {
  let store: TokenStore
  let bindTransport: ReturnType<typeof vi.fn>
  let fetchProfile: ReturnType<typeof vi.fn>
  let logoutApi: ReturnType<typeof vi.fn>

  beforeEach(() => {
    store = createInMemoryTokenStore()
    bindTransport = vi.fn()
    fetchProfile = vi.fn()
    logoutApi = vi.fn()
  })

  it('挂载后 ready=true,初始 token 为 null,isAuthenticated=false', async () => {
    const { result } = renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.token).toBeNull()
    expect(result.current.refreshToken).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('autoBind=true 时挂载后调用 bindTransport(store)', async () => {
    const { result } = renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi, autoBind: true }),
    )

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(bindTransport).toHaveBeenCalledTimes(1)
    expect(bindTransport).toHaveBeenCalledWith(store)
  })

  it('autoBind=false 时不调 bindTransport,ready 仍变 true', async () => {
    const { result } = renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi, autoBind: false }),
    )

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(bindTransport).not.toHaveBeenCalled()
  })

  it('login 传 newUser 时:写 token + setUser,不调 fetchProfile', async () => {
    const { result } = renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )

    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.login('at-001', 'rt-001', mockUser)
    })

    expect(store.getToken()).toBe('at-001')
    expect(store.getRefreshToken()).toBe('rt-001')
    expect(result.current.token).toBe('at-001')
    expect(result.current.refreshToken).toBe('rt-001')
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toEqual(mockUser)
    expect(fetchProfile).not.toHaveBeenCalled()
  })

  it('login 不传 newUser 时:写 token + 调 fetchProfile 拉取 user', async () => {
    fetchProfile.mockResolvedValue({ success: true, data: mockUser })
    const { result } = renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )

    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.login('at-002', 'rt-002')
    })

    expect(store.getToken()).toBe('at-002')
    expect(fetchProfile).toHaveBeenCalledTimes(1)
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('login 不传 newUser 且 fetchProfile 失败时:user 保持 null,token 仍写入', async () => {
    fetchProfile.mockResolvedValue({ success: false, error: 'profile fetch failed' })
    const { result } = renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )

    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.login('at-003')
    })

    expect(store.getToken()).toBe('at-003')
    expect(fetchProfile).toHaveBeenCalledTimes(1)
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('login 不传 refreshToken 时:不调 setRefreshToken,refreshToken 保持 null', async () => {
    const { result } = renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )

    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.login('at-004', undefined, mockUser)
    })

    expect(store.getToken()).toBe('at-004')
    expect(store.getRefreshToken()).toBeNull()
    expect(result.current.token).toBe('at-004')
    expect(result.current.refreshToken).toBeNull()
  })

  it('logout:调 logoutApi(refreshToken) + clearAll + 清 user', async () => {
    const { result } = renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )

    await waitFor(() => expect(result.current.ready).toBe(true))

    // 先 login
    await act(async () => {
      await result.current.login('at-005', 'rt-005', mockUser)
    })
    expect(result.current.isAuthenticated).toBe(true)

    // logout
    await act(async () => {
      await result.current.logout()
    })

    expect(logoutApi).toHaveBeenCalledTimes(1)
    expect(logoutApi).toHaveBeenCalledWith('rt-005')
    expect(store.getToken()).toBeNull()
    expect(store.getRefreshToken()).toBeNull()
    expect(result.current.token).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('logoutApi 抛异常:本地清理仍执行,token/user 都清空', async () => {
    logoutApi.mockRejectedValue(new Error('network error'))
    const { result } = renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )

    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.login('at-006', 'rt-006', mockUser)
    })

    await act(async () => {
      await result.current.logout()
    })

    expect(logoutApi).toHaveBeenCalledTimes(1)
    expect(store.getToken()).toBeNull()
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('logout 无 refreshToken 时:不调 logoutApi', async () => {
    const { result } = renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )

    await waitFor(() => expect(result.current.ready).toBe(true))

    // login 只传 token 不传 refreshToken
    await act(async () => {
      await result.current.login('at-007', undefined, mockUser)
    })

    await act(async () => {
      await result.current.logout()
    })

    expect(logoutApi).not.toHaveBeenCalled()
    expect(store.getToken()).toBeNull()
    expect(result.current.user).toBeNull()
  })

  it('logout 不传 logoutApi 时:跳过后端调用,直接清本地', async () => {
    const { result } = renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile }), // 不传 logoutApi
    )

    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.login('at-008', 'rt-008', mockUser)
    })

    await act(async () => {
      await result.current.logout()
    })

    expect(store.getToken()).toBeNull()
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('refresh 默认实现返回 false', async () => {
    const { result } = renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )

    await waitFor(() => expect(result.current.ready).toBe(true))

    let refreshResult: boolean | undefined
    await act(async () => {
      refreshResult = await result.current.refresh()
    })

    expect(refreshResult).toBe(false)
  })

  it('setUser:直接更新 user state', async () => {
    const { result } = renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.user).toBeNull()

    act(() => {
      result.current.setUser(mockUser)
    })

    expect(result.current.user).toEqual(mockUser)

    act(() => {
      result.current.setUser(null)
    })

    expect(result.current.user).toBeNull()
  })

  it('store 已有 initial token 时:hook 读取到 isAuthenticated=true', async () => {
    // 用 createInMemoryTokenStore 的 initial 参数预填 token
    store = createInMemoryTokenStore({
      initial: { token: 'preloaded-at', refreshToken: 'preloaded-rt' },
    })

    const { result } = renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.token).toBe('preloaded-at')
    expect(result.current.refreshToken).toBe('preloaded-rt')
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('login + logout + login 序列:状态正确转换', async () => {
    const { result } = renderHook(() =>
      useAuth<TestUser>({ store, bindTransport, fetchProfile, logoutApi }),
    )

    await waitFor(() => expect(result.current.ready).toBe(true))

    // 第一次 login
    await act(async () => {
      await result.current.login('at-1', 'rt-1', mockUser)
    })
    expect(result.current.token).toBe('at-1')
    expect(result.current.user).toEqual(mockUser)

    // logout
    await act(async () => {
      await result.current.logout()
    })
    expect(result.current.token).toBeNull()
    expect(result.current.user).toBeNull()

    // 第二次 login(不同 token)
    await act(async () => {
      await result.current.login('at-2', 'rt-2', { id: 'u-2', nickname: 'tester2' })
    })
    expect(result.current.token).toBe('at-2')
    expect(result.current.refreshToken).toBe('rt-2')
    expect(result.current.user).toEqual({ id: 'u-2', nickname: 'tester2' })
  })
})
