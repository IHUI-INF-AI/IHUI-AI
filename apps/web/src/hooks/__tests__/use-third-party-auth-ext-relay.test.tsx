/**
 * DBG-66 接线断言(2026-11-11 立):主登录弹窗里 8 平台通用回调
 * (useThirdPartyAuth.handleCallback → handleLoginSuccess → applyLoginData)成功后
 * 必须把 token 交给扩展发送端 @/lib/ext-auth-relay。摘掉接线即翻红;
 * 发送端自身的消息形状/降级由 src/lib/__tests__/ext-auth-relay.test.ts 钉,
 * 本文件不复算判据。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'

const h = vi.hoisted(() => ({
  fetchApi: vi.fn(),
  notifyExtensionAuth: vi.fn(),
  recordOAuthConsent: vi.fn(),
  setToken: vi.fn(),
  setUser: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ fetchApi: h.fetchApi }))
vi.mock('@/lib/ext-auth-relay', () => ({ notifyExtensionAuth: h.notifyExtensionAuth }))
vi.mock('@ihui/api-client', () => ({ recordOAuthConsent: h.recordOAuthConsent }))
vi.mock('@/lib/third-party-config', () => ({
  getAllPlatformConfigs: () => ({ github: { enabled: true } }),
  getPlatformConfig: () => ({ enabled: true }),
  validatePlatformConfig: () => ({ valid: true, missing: [] }),
}))
vi.mock('@/lib/oauth-utils', () => ({
  buildAuthUrl: () => '',
  clearOAuthState: vi.fn(),
  generateState: () => 'state-fixture',
  saveOAuthState: vi.fn(),
  validateOAuthState: () => true,
}))
vi.mock('@/lib/auth-domains', () => ({
  buildAuthSubdomainStartUrl: () => '',
  isAuthSubdomainHost: () => false,
  isMainDomainHost: () => false,
}))
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() },
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}))
vi.mock('@/stores/auth', () => {
  const state = { setToken: h.setToken, setUser: h.setUser }
  const store: any = (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state)
  store.getState = () => state
  return { useAuthStore: store }
})

async function loadHook() {
  vi.resetModules()
  const mod = await import('@/hooks/use-third-party-auth')
  mod.__test__.resetOAuthStatusCache()
  return renderHook(() => mod.useThirdPartyAuth())
}

beforeEach(() => {
  vi.clearAllMocks()
  h.fetchApi.mockImplementation(async (url: string) => {
    if (url.includes('oauth-status')) return { success: true, data: null }
    if (url.includes('/callback')) {
      return {
        success: true,
        data: {
          token: 'tok-1',
          refreshToken: 'rt-1',
          expiresIn: 3600,
          user: {
            id: 'u1',
            username: 'u',
            email: 'u@example.com',
            nickname: 'n',
            avatar: 'a',
            isVip: false,
            inviteCode: '',
            createTime: '2026-11-11',
          },
        },
      }
    }
    if (url.includes('third-party-accounts')) return { success: true, data: [] }
    return { success: false, error: 'not-used-in-this-test' }
  })
})

afterEach(() => cleanup())

describe('通用 OAuth 回调成功 → 扩展发送端接线(DBG-66)', () => {
  it('handleCallback 成功:token/refreshToken/expiresIn 交给 notifyExtensionAuth', async () => {
    const { result } = await loadHook()
    let ok = false
    await act(async () => {
      ok = await result.current.handleCallback('github', 'code-1', 'state-fixture')
    })
    expect(ok).toBe(true)
    expect(h.setToken).toHaveBeenCalledWith('tok-1', 'rt-1')
    expect(h.notifyExtensionAuth).toHaveBeenCalledTimes(1)
    expect(h.notifyExtensionAuth).toHaveBeenCalledWith({
      accessToken: 'tok-1',
      refreshToken: 'rt-1',
      expiresIn: 3600,
    })
  })

  it('回调失败(后端拒绝):不向扩展发送', async () => {
    h.fetchApi.mockImplementation(async (url: string) => {
      if (url.includes('oauth-status')) return { success: true, data: null }
      if (url.includes('/callback')) return { success: false, error: 'bad state' }
      return { success: true, data: [] }
    })
    const { result } = await loadHook()
    let ok = true
    await act(async () => {
      ok = await result.current.handleCallback('github', 'code-1', 'state-fixture')
    })
    expect(ok).toBe(false)
    expect(h.notifyExtensionAuth).not.toHaveBeenCalled()
  })
})
