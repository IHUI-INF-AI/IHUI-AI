// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AuthContext 认证流程测试
 *
 * 覆盖:
 * - token 获取:initApi 后 token 状态同步
 * - login:账号密码登录成功/失败
 * - loginBySso:SSO 登录成功/用户取消/code 缺失/交换失败
 * - logout:调用 API logout + 清除 token + 清空 user
 * - 冷启动 SSO deep link
 * - 运行时 SSO deep link
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { resetAsyncStorageMock } from './__mocks__/async-storage'

const { apiMocks, tokenMocks, ssoMocks } = vi.hoisted(() => ({
  apiMocks: {
    loginByAccount: vi.fn(),
    logout: vi.fn(),
  },
  tokenMocks: {
    initApi: vi.fn(async () => {}),
    setToken: vi.fn(async () => {}),
    setRefreshToken: vi.fn(async () => {}),
    getToken: vi.fn(() => null as unknown),
    getRefreshToken: vi.fn(() => null as unknown),
    clearToken: vi.fn(async () => {}),
  },
  ssoMocks: {
    getInitialSsoCode: vi.fn(async () => null as unknown),
    subscribeSsoDeepLink: vi.fn((_cb: (code: string) => void) => () => {}),
    exchangeSsoCode: vi.fn(async () => null as unknown),
    openSsoLogin: vi.fn(async () => null as unknown),
    extractSsoCode: vi.fn(() => null as unknown),
  },
}))

vi.mock('@ihui/api-client', () => ({
  loginByAccount: apiMocks.loginByAccount,
  logout: apiMocks.logout,
}))

vi.mock('../src/lib/token', () => ({
  ...tokenMocks,
  tokenStore: {
    getToken: () => tokenMocks.getToken() as string | null,
    getRefreshToken: () => tokenMocks.getRefreshToken() as string | null,
    setToken: tokenMocks.setToken,
    setRefreshToken: tokenMocks.setRefreshToken,
    clearAll: tokenMocks.clearToken,
  },
}))

vi.mock('../src/lib/sso', () => ssoMocks)

import { AuthProvider, useAuth } from '../src/context/AuthContext'
import { rnAuthStore } from '../src/stores/auth-store'

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

function renderAuth() {
  return renderHook(() => useAuth(), { wrapper })
}

const mockUser = { id: 'u-1', nickname: 'tester', avatar: '', roleId: 0, status: 1 }
const mockLoginResult = {
  success: true,
  data: {
    accessToken: 'at-001',
    refreshToken: 'rt-001',
    expiresIn: 7200,
    refreshExpiresIn: 2592000,
    user: mockUser,
  },
} as const

const mockSsoTokenData = {
  accessToken: 'sso-at',
  refreshToken: 'sso-rt',
  expiresIn: 7200,
  refreshExpiresIn: 2592000,
  user: mockUser,
}

describe('AuthContext 认证流程', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetAsyncStorageMock()
    tokenMocks.getToken.mockReturnValue(null)
    tokenMocks.getRefreshToken.mockReturnValue(null)
    ssoMocks.getInitialSsoCode.mockResolvedValue(null)
    ssoMocks.subscribeSsoDeepLink.mockReturnValue(() => {})
    // 重置 auth store 状态,防止前序测试的 user 状态泄漏到当前测试
    rnAuthStore.setState({
      token: null,
      refreshToken: null,
      expiresIn: null,
      isAuthenticated: false,
      user: null,
      ready: false,
    })
  })

  it('initApi 后 ready=true,token 从 getToken 读取', async () => {
    tokenMocks.getToken.mockReturnValue('cached-tk')
    const { result } = renderAuth()

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(tokenMocks.initApi).toHaveBeenCalledTimes(1)
    expect(result.current.token).toBe('cached-tk')
  })

  it('initApi 后无 token 时 token=null', async () => {
    tokenMocks.getToken.mockReturnValue(null)
    const { result } = renderAuth()

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.token).toBeNull()
  })

  it('login 成功:写入 token + refreshToken,设置 user', async () => {
    apiMocks.loginByAccount.mockResolvedValue(mockLoginResult)
    const { result } = renderAuth()

    await waitFor(() => expect(result.current.ready).toBe(true))

    let loginResult: { success: boolean } | undefined
    await act(async () => {
      loginResult = await result.current.login('alice', 'pass123')
    })

    expect(loginResult).toEqual({ success: true })
    expect(tokenMocks.setToken).toHaveBeenCalledWith('at-001')
    expect(tokenMocks.setRefreshToken).toHaveBeenCalledWith('rt-001')
    expect(result.current.token).toBe('at-001')
    expect(result.current.user).toEqual(mockUser)
  })

  it('login 失败:返回 error,不写入 token', async () => {
    apiMocks.loginByAccount.mockResolvedValue({ success: false, error: '密码错误' })
    const { result } = renderAuth()

    await waitFor(() => expect(result.current.ready).toBe(true))

    let loginResult: { success: boolean; error?: string } | undefined
    await act(async () => {
      loginResult = await result.current.login('alice', 'wrong')
    })

    expect(loginResult).toEqual({ success: false, error: '密码错误' })
    expect(tokenMocks.setToken).not.toHaveBeenCalled()
    expect(result.current.user).toBeNull()
  })

  it('loginBySso 成功:openSsoLogin → extractSsoCode → exchangeSsoCode → 写入 token', async () => {
    ssoMocks.openSsoLogin.mockResolvedValue('ihui://sso/callback?sso_code=xyz')
    ssoMocks.extractSsoCode.mockReturnValue('xyz')
    ssoMocks.exchangeSsoCode.mockResolvedValue(mockSsoTokenData)
    const { result } = renderAuth()

    await waitFor(() => expect(result.current.ready).toBe(true))

    let ssoResult: { success: boolean; error?: string } | undefined
    await act(async () => {
      ssoResult = await result.current.loginBySso()
    })

    expect(ssoResult).toEqual({ success: true })
    expect(ssoMocks.openSsoLogin).toHaveBeenCalledTimes(1)
    expect(ssoMocks.exchangeSsoCode).toHaveBeenCalledWith('xyz')
    expect(tokenMocks.setToken).toHaveBeenCalledWith('sso-at')
    expect(tokenMocks.setRefreshToken).toHaveBeenCalledWith('sso-rt')
    expect(result.current.token).toBe('sso-at')
    expect(result.current.user).toEqual(mockUser)
  })

  it('loginBySso 用户取消:openSsoLogin 返回 null → 返回失败', async () => {
    ssoMocks.openSsoLogin.mockResolvedValue(null)
    const { result } = renderAuth()

    await waitFor(() => expect(result.current.ready).toBe(true))

    let ssoResult: { success: boolean; error?: string } | undefined
    await act(async () => {
      ssoResult = await result.current.loginBySso()
    })

    expect(ssoResult!.success).toBe(false)
    expect(ssoResult!.error).toBe('用户取消授权')
    expect(ssoMocks.exchangeSsoCode).not.toHaveBeenCalled()
  })

  it('loginBySso 回跳无 code:extractSsoCode 返回 null → 返回失败', async () => {
    ssoMocks.openSsoLogin.mockResolvedValue('ihui://sso/callback?other=1')
    ssoMocks.extractSsoCode.mockReturnValue(null)
    const { result } = renderAuth()

    await waitFor(() => expect(result.current.ready).toBe(true))

    let ssoResult: { success: boolean; error?: string } | undefined
    await act(async () => {
      ssoResult = await result.current.loginBySso()
    })

    expect(ssoResult!.success).toBe(false)
    expect(ssoResult!.error).toBe('SSO 回跳未包含 code')
  })

  it('loginBySso 交换失败:exchangeSsoCode 返回 null → 返回失败', async () => {
    ssoMocks.openSsoLogin.mockResolvedValue('ihui://sso/callback?sso_code=bad')
    ssoMocks.extractSsoCode.mockReturnValue('bad')
    ssoMocks.exchangeSsoCode.mockResolvedValue(null)
    const { result } = renderAuth()

    await waitFor(() => expect(result.current.ready).toBe(true))

    let ssoResult: { success: boolean; error?: string } | undefined
    await act(async () => {
      ssoResult = await result.current.loginBySso()
    })

    expect(ssoResult!.success).toBe(false)
    expect(ssoResult!.error).toBe('SSO 换取 token 失败')
  })

  it('logout:调用 API logout + clearToken + 清空 user', async () => {
    apiMocks.loginByAccount.mockResolvedValue(mockLoginResult)
    tokenMocks.getRefreshToken.mockReturnValue('rt-001')
    apiMocks.logout.mockResolvedValue(undefined)
    const { result } = renderAuth()

    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.login('alice', 'pass123')
    })
    expect(result.current.token).toBe('at-001')

    await act(async () => {
      await result.current.logout()
    })

    expect(apiMocks.logout).toHaveBeenCalledWith('rt-001')
    expect(tokenMocks.clearToken).toHaveBeenCalledTimes(1)
    expect(result.current.token).toBeNull()
    expect(result.current.user).toBeNull()
  })

  it('logout 无 refreshToken 时不调用 API logout', async () => {
    tokenMocks.getRefreshToken.mockReturnValue(null)
    const { result } = renderAuth()

    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.logout()
    })

    expect(apiMocks.logout).not.toHaveBeenCalled()
    expect(tokenMocks.clearToken).toHaveBeenCalled()
  })

  it('冷启动 SSO deep link:getInitialSsoCode 有值时自动交换', async () => {
    ssoMocks.getInitialSsoCode.mockResolvedValue('cold-start-code')
    ssoMocks.exchangeSsoCode.mockResolvedValue(mockSsoTokenData)
    const { result } = renderAuth()

    // 一条链: initApi() → hydrateAuth → setReady(true) → await getInitialSsoCode → applySsoCode
    // → exchangeSsoCode → setAuth。终点 = token 落进 store。`ready=true` 写在 exchange **之前**
    // (同一个 async 回调里),所以它被终点严格蕴含 ⇒ 降级为同步断言,本枚只等一次(8s < 10s)。
    await waitFor(() => expect(result.current.token).toBe('sso-at'), { timeout: 8_000 })
    expect(result.current.ready, '令牌都写进来了 ready 还是 false = 就绪时序与链身自相矛盾').toBe(
      true,
    )

    expect(ssoMocks.exchangeSsoCode).toHaveBeenCalledWith('cold-start-code')
    expect(result.current.user).toEqual(mockUser)
  })

  it('运行时 SSO deep link:subscribeSsoDeepLink 回调触发交换', async () => {
    let deepLinkCallback: ((code: string) => void) | null = null
    ssoMocks.subscribeSsoDeepLink.mockImplementation((cb: (code: string) => void) => {
      deepLinkCallback = cb
      return () => {}
    })
    ssoMocks.exchangeSsoCode.mockResolvedValue(mockSsoTokenData)
    const { result } = renderAuth()

    // 链 A(initApi → hydrateAuth → setReady(true) → await getInitialSsoCode → subscribe):
    // 终点 = 订阅真的挂上了,而**回调句柄必须在触发链 B 之前就拿到**(不在这儿等,下面的
    // `deepLinkCallback!` 就是一次凭空调用)⇒ 这一段不能并进链 B。ready 写在 subscribe 之前,
    // 被这个终点蕴含 ⇒ 降级为同步断言。
    await waitFor(() => expect(ssoMocks.subscribeSsoDeepLink).toHaveBeenCalled(), {
      timeout: 4_000,
    })
    expect(result.current.ready, '订阅都挂上了 ready 还是 false = 就绪时序与链身自相矛盾').toBe(
      true,
    )

    expect(deepLinkCallback).not.toBeNull()
    await act(async () => {
      await deepLinkCallback!('runtime-code')
    })

    // 链 B(回调 → applySsoCode → exchangeSsoCode → setAuth):终点 = token 落库。
    // "exchange 用哪枚 code 被调用"是链上的中间态,被终点蕴含 ⇒ 保持原来的同步断言位置。
    // 预算 4s+5s=9s < testTimeout 10s:两枚独立链各留一次等待,和仍低于墙上时间,红由断言定性。
    await waitFor(() => expect(result.current.token).toBe('sso-at'), { timeout: 5_000 })
    expect(ssoMocks.exchangeSsoCode).toHaveBeenCalledWith('runtime-code')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
