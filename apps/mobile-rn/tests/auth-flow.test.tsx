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

const { apiMocks, tokenMocks, ssoMocks } = vi.hoisted(() => ({
  apiMocks: {
    loginByAccount: vi.fn(),
    logout: vi.fn(),
  },
  tokenMocks: {
    initApi: vi.fn(async () => {}),
    setToken: vi.fn(async () => {}),
    setRefreshToken: vi.fn(async () => {}),
    getToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null),
    clearToken: vi.fn(async () => {}),
  },
  ssoMocks: {
    getInitialSsoCode: vi.fn(async () => null),
    subscribeSsoDeepLink: vi.fn(() => () => {}),
    exchangeSsoCode: vi.fn(async () => null),
    openSsoLogin: vi.fn(async () => null),
    extractSsoCode: vi.fn(() => null),
  },
}))

vi.mock('@ihui/api-client', () => ({
  loginByAccount: apiMocks.loginByAccount,
  logout: apiMocks.logout,
}))

vi.mock('../src/lib/token', () => tokenMocks)

vi.mock('../src/lib/sso', () => ssoMocks)

import { AuthProvider, useAuth } from '../src/context/AuthContext'

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

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
    tokenMocks.getToken.mockReturnValue(null)
    tokenMocks.getRefreshToken.mockReturnValue(null)
    ssoMocks.getInitialSsoCode.mockResolvedValue(null)
    ssoMocks.subscribeSsoDeepLink.mockReturnValue(() => {})
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

    await waitFor(() => expect(result.current.ready).toBe(true))
    await waitFor(() => expect(result.current.token).toBe('sso-at'))

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

    await waitFor(() => expect(result.current.ready).toBe(true))
    await waitFor(() => expect(ssoMocks.subscribeSsoDeepLink).toHaveBeenCalled())

    expect(deepLinkCallback).not.toBeNull()
    await act(async () => {
      await deepLinkCallback!('runtime-code')
    })

    await waitFor(() => expect(result.current.token).toBe('sso-at'))
    expect(ssoMocks.exchangeSsoCode).toHaveBeenCalledWith('runtime-code')
  })
})
