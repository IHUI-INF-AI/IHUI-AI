// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 发起期"用户协议同意"记录闸(2026-10-27 立)
 *
 * 立因:服务端把第三方 OAuth 通用回调 `POST /api/auth/:platform/callback` 改成
 * fail-closed —— 发起期必须已在 Redis 落同意记录(绑定 state),否则 403
 * `OAUTH_AGREEMENT_REQUIRED`。回调是**一次性消费**,所以前端唯一正确的顺序是:
 *   生成 state → 写同意记录(Redis)→ 本地 saveOAuthState → 跳厂商
 * 任何一步换序都会让"用户明明同意了"的回调被 403 挡死。
 *
 * 本文件钉三档(每档都有摘掉新逻辑即翻红):
 *   ① 成功档:recordOAuthConsent 先于 location 跳转被调用,且它拿到的 state
 *      就是随后写进 sessionStorage、交给厂商的那一个;
 *   ② 失败档(如 Redis 不可用 503):停在本地报错,不写 state、不跳转;
 *   ③ 未同意档:startLogin 未带 agreementAccepted 时透传 false,
 *      服务端据此拒绝 —— 前端不得替用户"默认已同意"。
 *
 * 另钉一条回归锁:handleCallback 只 POST `{ code, state }`,不再自报同意
 * (同意记录必须在发起期落,回调期补报没有意义,也绕过了 state 绑定)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'

/** oauth-status 的服务器答复夹具(true/false 键) */
const statusRef = { current: null as Record<string, boolean> | null }
/** 调用先后顺序:consent → navigate,用来证明"Redis 有记录才跳厂商" */
const order: string[] = []

const { fetchApiMock, recordOAuthConsent, toastError } = vi.hoisted(() => ({
  fetchApiMock: vi.fn(),
  recordOAuthConsent: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ fetchApi: fetchApiMock }))

// 席 C 契约:@ihui/api-client 的 recordOAuthConsent(本地包尚未落地时用 mock 钉契约形状)
vi.mock('@ihui/api-client', () => ({ recordOAuthConsent }))

// 本地开关的唯一来源:这里当夹具用,github 走直连厂商授权页
vi.mock('@/lib/third-party-config', () => ({
  getAllPlatformConfigs: () => ({ github: { enabled: true } }),
  getPlatformConfig: (p: string) =>
    p === 'github'
      ? {
          enabled: true,
          clientId: 'test-client-id',
          redirectUri: 'https://example.com/callback?platform=github',
          authUrl: 'https://github.com/login/oauth/authorize',
          scope: 'read:user',
        }
      : { enabled: false },
  validatePlatformConfig: () => ({ valid: true, missing: [] }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: { error: toastError, success: vi.fn(), warning: vi.fn(), info: vi.fn() },
    error: toastError,
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}))

async function loadHook() {
  vi.resetModules()
  const mod = await import('@/hooks/use-third-party-auth')
  // 缓存是模块级"只取一次":不重置就同一进程里多条用例会读到同一份答复
  mod.__test__.resetOAuthStatusCache()
  return renderHook(() => mod.useThirdPartyAuth())
}

const hrefSetter = vi.fn()
let originalLocation: Location

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  order.length = 0
  window.sessionStorage.clear()

  fetchApiMock.mockImplementation(async (url: string) => {
    if (url.includes('oauth-status')) return { success: true, data: statusRef.current }
    return { success: false, error: 'not-used-in-this-test' }
  })

  // 只拦 href 赋值:本 hook 的全部导航都走 window.location.href
  originalLocation = window.location
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      ...originalLocation,
      get href() {
        return ''
      },
      set href(v: string) {
        order.push('navigate')
        hrefSetter(v)
      },
    },
  })
})

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  })
})

describe('startLogin 在跳转厂商前先落同意记录', () => {
  it('成功档:consent(platform, state, true) → 本地 state → 跳厂商(state 同一个)', async () => {
    statusRef.current = { github: true }
    recordOAuthConsent.mockImplementation(async () => {
      order.push('consent')
      return { success: true, data: { ok: true } }
    })

    const { result } = await loadHook()
    await waitFor(() => expect(result.current.isPlatformEnabled('github')).toBe(true))

    const ok = await result.current.startLogin('github', true)

    expect(ok).toBe(true)
    expect(recordOAuthConsent).toHaveBeenCalledTimes(1)
    const [platform, state, accepted] = recordOAuthConsent.mock.calls[0]!
    expect(platform).toBe('github')
    expect(typeof state).toBe('string')
    expect((state as string).length).toBeGreaterThan(0)
    expect(accepted).toBe(true)

    // 顺序:Redis 记录 → 本地 state 写入 → 导航。互换任意两步这条就红。
    expect(order).toEqual(['consent', 'navigate'])
    expect(window.sessionStorage.getItem('oauth_state_github')).toBe(state)
    expect(hrefSetter).toHaveBeenCalledTimes(1)
    const navUrl = hrefSetter.mock.calls[0]![0] as string
    expect(navUrl).toContain('https://github.com/login/oauth/authorize?')
    expect(navUrl).toContain(`state=${state}`)
  })

  it('失败档:consent 被服务端拒绝(如 Redis 503)⇒ 不写本地 state、不跳转、走既有错误提示', async () => {
    statusRef.current = { github: true }
    recordOAuthConsent.mockImplementation(async () => {
      order.push('consent')
      return { success: false, error: 'REDIS_UNAVAILABLE', status: 503 }
    })

    const { result } = await loadHook()
    await waitFor(() => expect(result.current.isPlatformEnabled('github')).toBe(true))

    const ok = await result.current.startLogin('github', true)

    expect(ok).toBe(false)
    expect(order).toEqual(['consent'])
    expect(
      hrefSetter,
      'Redis 没落记录就跳厂商 ⇒ 回调必 403,这条路必须不存在',
    ).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem('oauth_state_github')).toBeNull()
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('GitHub'), 'REDIS_UNAVAILABLE')
  })

  it('未同意档:不带第二参时 agreementAccepted 透传 false,且同样不跳转', async () => {
    statusRef.current = { github: true }
    recordOAuthConsent.mockImplementation(async () => {
      order.push('consent')
      return { success: false, error: 'OAUTH_AGREEMENT_REQUIRED', status: 403 }
    })

    const { result } = await loadHook()
    await waitFor(() => expect(result.current.isPlatformEnabled('github')).toBe(true))

    const ok = await result.current.startLogin('github')

    expect(ok).toBe(false)
    expect(recordOAuthConsent.mock.calls[0]![2]).toBe(false)
    expect(hrefSetter).not.toHaveBeenCalled()
  })
})

describe('handleCallback 不自报同意', () => {
  it('回调期只 POST { code, state },不带 agreementAccepted', async () => {
    statusRef.current = { github: true }
    window.sessionStorage.setItem('oauth_state_github', 'st-from-start')

    const { result } = await loadHook()
    await waitFor(() => expect(result.current.isPlatformEnabled('github')).toBe(true))

    await result.current.handleCallback('github', 'the-code', 'st-from-start')

    const callbackCall = fetchApiMock.mock.calls.find(([url]) =>
      String(url).includes('/api/auth/github/callback'),
    )
    expect(callbackCall, '必须真的打到通用回调端点').toBeTruthy()
    const body = JSON.parse(String((callbackCall?.[1] as RequestInit | undefined)?.body))
    expect(body).toEqual({ code: 'the-code', state: 'st-from-start' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
