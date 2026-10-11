// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'

import { SESSION_LOGGED_OUT_STORAGE_KEY } from '@ihui/shared/auth/auto-login-policy'
// consistent-type-imports 禁 `typeof import('...')` 内联标注 ⇒ 顶部 type-only 命名空间
// import 后以 `typeof _ns` 引用(类型等值,vi.mock 工厂内仅编译期解析,无运行时影响)。
import type * as _apiClientNs from '@ihui/api-client'
import type * as _cookieUtilsNs from '@/lib/cookie-utils'
import { useAuthBootstrap } from '@/hooks/use-auth-bootstrap'
import { useAuthStore } from '@/stores/auth'
import {
  isSessionLoggedOut,
  markSessionLoggedOut,
  __resetSessionLoggedOutMirrorForTest,
} from '@/lib/session-marker'

/**
 * `useAuthBootstrap` 冷启动刷新失败**分型**回归测试(2026-10-09 修复)。
 *
 * 修复面:web 端冷启动静默刷新失败时,区分「凭据被明确拒绝(401/403 → 允许落持久登出
 * 标记)」与「瞬时失败(网络/5xx → 绝不落标记)」——瞬时失败也 logout() 会把 30 天
 * httpOnly refresh cookie 永久废掉(「自动登录总被清掉」的根因);另堵住
 * `!cancelled && retry.success` 的 else 把「组件已卸载」也当失败走 logout() 落标记的漏洞。
 *
 * 判据纯函数(`shouldMarkSessionLoggedOut` / `classifyRefreshFailureStatus`)住在
 * `@ihui/shared/auth/auto-login-policy`,已有独立单测;本文件只锁 **web 这一侧的接线**:
 * hook 的三处失败分支是否真的只在 rejected 才调 `logout()`(= 落标记的唯一出口)。
 *
 * 测试装置(为什么 mock 这几个):
 * - `@/lib/api` 整体换掉:hook 从它同时 import `fetchApi` 与 `getLastRefreshFailure`,
 *   两个都必须给 —— 只给一个,hook 读另一个时 Vitest 会报 "export is not defined on the mock"。
 * - `@ihui/api-client` 用 importOriginal 铺开、只覆写 `refreshAccessTokenOnce`:
 *   stores/auth.ts 的 `logout` 也从这里 import,漏了它模块加载即炸。
 * - `@/lib/cookie-utils` 只覆写 `getAuthCookie → null`(走 refresh 路径),其余导出留真
 *   (stores/auth 用到的 setAuthCookie/clearRefreshTokenCookie 是 P2-18 后的空操作)。
 * - `@/stores/user` 只给 selector 形态的 `useUserStore`;本文件走不到 /auth/me 成功路径,
 *   fetchProfile 永远不会被真调。
 * - `@/stores/auth` 用**真 store**:断言的核心正是它的 `logout() → markSessionLoggedOut()`
 *   接线,把 store mock 掉等于把要测的那根线拆了。
 *
 * 每个用例前:清 localStorage + `__resetSessionLoggedOutMirrorForTest()` + 复位 store ——
 * session-marker 有进程内镜像,不清会把上一个用例的判定带进本用例。
 */

const mocks = vi.hoisted(() => ({
  fetchApi: vi.fn(),
  getLastRefreshFailure: vi.fn<() => 'rejected' | 'transient' | null>(),
  refreshAccessTokenOnce: vi.fn<() => Promise<string | null>>(),
  getAuthCookie: vi.fn<() => string | null>(),
  fetchProfile: vi.fn<() => Promise<void>>(),
}))

vi.mock('@/lib/api', () => ({
  fetchApi: mocks.fetchApi,
  getLastRefreshFailure: mocks.getLastRefreshFailure,
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof _apiClientNs>()
  return { ...actual, refreshAccessTokenOnce: mocks.refreshAccessTokenOnce }
})

vi.mock('@/lib/cookie-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof _cookieUtilsNs>()
  return { ...actual, getAuthCookie: mocks.getAuthCookie }
})

vi.mock('@/stores/user', () => ({
  useUserStore: <T,>(selector: (s: { fetchProfile: () => Promise<void> }) => T): T =>
    selector({ fetchProfile: mocks.fetchProfile }),
}))

/** 持久登出标记在盘上的存在性(判据只看存在,不解析值) */
const markerInStorage = () => localStorage.getItem(SESSION_LOGGED_OUT_STORAGE_KEY)

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  __resetSessionLoggedOutMirrorForTest()
  useAuthStore.setState({
    token: null,
    refreshToken: null,
    expiresIn: null,
    isAuthenticated: false,
    user: null,
  })

  mocks.fetchApi.mockReset()
  // 默认给一个"不该被走到"的失败响应:/auth/me 被意外调用时行为确定,断言仍能抓住它
  mocks.fetchApi.mockResolvedValue({ success: false, error: 'unexpected /auth/me', status: 500 })
  mocks.getLastRefreshFailure.mockReset()
  mocks.getLastRefreshFailure.mockReturnValue(null)
  mocks.refreshAccessTokenOnce.mockReset()
  mocks.refreshAccessTokenOnce.mockResolvedValue(null)
  mocks.getAuthCookie.mockReset()
  mocks.getAuthCookie.mockReturnValue(null)
  mocks.fetchProfile.mockReset()
  mocks.fetchProfile.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
})

describe('A. 冷启动静默刷新瞬时失败:绝不落持久登出标记(2026-10-09 主病根)', () => {
  it('getLastRefreshFailure()=transient + refresh 失败 ⇒ 不写标记、不 logout、ready', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // persist 冷启动带进来的幽灵 isAuthenticated 标志位(token 为空但标志位残留)
    useAuthStore.setState({ isAuthenticated: true })
    mocks.getLastRefreshFailure.mockReturnValue('transient')
    mocks.refreshAccessTokenOnce.mockResolvedValue(null)

    const { result } = renderHook(() => useAuthBootstrap())

    await waitFor(() => expect(result.current.ready).toBe(true))

    // 核心:瞬时失败不升级成持久标记(否则 30 天 refresh cookie 被永久废掉)
    expect(markerInStorage()).toBeNull()
    expect(isSessionLoggedOut()).toBe(false)
    // logout() 没被调:幽灵标志位保持原状(修复前这里会被清成 false 并落标记)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(result.current.isAuthenticated).toBe(true)
    // 收束方式是 console.warn(保持现状、下一次冷启动重试),不是静默
    expect(warn).toHaveBeenCalled()
    // 刷新失败即止步,不再打 /auth/me
    expect(mocks.fetchApi).not.toHaveBeenCalled()
  })
})

describe('B. 刷新被服务端明确拒绝(401/403):与主动登出同处置', () => {
  it('getLastRefreshFailure()=rejected ⇒ logout() 落持久登出标记', async () => {
    useAuthStore.setState({ isAuthenticated: true })
    mocks.getLastRefreshFailure.mockReturnValue('rejected')
    mocks.refreshAccessTokenOnce.mockResolvedValue(null)

    const { result } = renderHook(() => useAuthBootstrap())

    await waitFor(() => expect(result.current.ready).toBe(true))

    expect(markerInStorage()).not.toBeNull()
    expect(isSessionLoggedOut()).toBe(true)
    // logout() 真被调:幽灵标志位被清掉
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})

describe('C. 登出标记已在场:冷启动不得再碰刷新', () => {
  it('标记先在场 ⇒ 不发 /auth/refresh、停在未登录态', async () => {
    markSessionLoggedOut()
    useAuthStore.setState({ isAuthenticated: true })

    const { result } = renderHook(() => useAuthBootstrap())

    await waitFor(() => expect(result.current.ready).toBe(true))

    expect(mocks.refreshAccessTokenOnce).not.toHaveBeenCalled()
    expect(mocks.fetchApi).not.toHaveBeenCalled()
    // gate 那一支必须 logout 清掉幽灵标志位,而不是只停在未 ready
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(markerInStorage()).not.toBeNull()
  })
})

describe('D. /auth/me retry 失败按 retry 状态码分型(cancelled 漏洞回归锁)', () => {
  /** 首次 /auth/me 与 retry 都失败;refresh 两次都成功 ⇒ 走到 retry 分支看 retry.status */
  async function runBootstrapWithFailedMe(status: number): Promise<void> {
    mocks.refreshAccessTokenOnce.mockResolvedValue('fresh-access-token')
    mocks.fetchApi.mockResolvedValue({ success: false, error: `me failed ${status}`, status })

    const { result } = renderHook(() => useAuthBootstrap())
    await waitFor(() => expect(result.current.ready).toBe(true))

    // 自证真的走到了 retry 分支:两次 /auth/me、两次 refresh
    expect(mocks.fetchApi).toHaveBeenCalledTimes(2)
    expect(mocks.refreshAccessTokenOnce).toHaveBeenCalledTimes(2)
  }

  it('retry status=500(瞬时)⇒ 不写标记,登录态保持', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await runBootstrapWithFailedMe(500)

    expect(markerInStorage()).toBeNull()
    expect(isSessionLoggedOut()).toBe(false)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(warn).toHaveBeenCalled()
    // 分型看的是 retry.status,不是刷新失败记录:refresh 成功过,记录必须没被读
    expect(mocks.getLastRefreshFailure).not.toHaveBeenCalled()
  })

  it('retry status=401(新凭据也被拒)⇒ 写标记', async () => {
    await runBootstrapWithFailedMe(401)

    expect(markerInStorage()).not.toBeNull()
    expect(isSessionLoggedOut()).toBe(true)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    // 标记来自 retry.status 的分型,而不是 getLastRefreshFailure 记录(refresh 是成功的)
    expect(mocks.getLastRefreshFailure).not.toHaveBeenCalled()
  })

  it('retry 落定前组件已卸载(cancelled)⇒ 即便 retry=401 也不落标记', async () => {
    useAuthStore.setState({ isAuthenticated: false })
    mocks.refreshAccessTokenOnce.mockResolvedValue('fresh-access-token')

    // 第一次 /auth/me 立即失败;retry 挂起,直到我们主动放行
    let resolveRetry!: (v: unknown) => void
    const retryPending = new Promise<unknown>((resolve) => {
      resolveRetry = resolve
    })
    mocks.fetchApi
      .mockResolvedValueOnce({ success: false, error: 'me dead', status: 401 })
      .mockImplementationOnce(() => retryPending)

    const { unmount } = renderHook(() => useAuthBootstrap())

    // 自证:retry 已发出且还挂着,此时才卸载(StrictMode/布局切换卸载的同形)
    await waitFor(() => expect(mocks.fetchApi).toHaveBeenCalledTimes(2))
    unmount()

    resolveRetry({ success: false, error: 'me dead', status: 401 })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    // 已卸载 = cancelled:既不当失败 logout,也不发 warn/落标记
    expect(markerInStorage()).toBeNull()
    expect(isSessionLoggedOut()).toBe(false)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
