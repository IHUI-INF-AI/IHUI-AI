// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'

import {
  SESSION_HINT_COOKIE_NAME,
  SESSION_LOGGED_OUT_STORAGE_KEY,
} from '@ihui/shared/auth/auto-login-policy'
// consistent-type-imports 禁 `typeof import('...')` 内联标注 ⇒ 顶部 type-only 命名空间
// import 后以 `typeof _ns` 引用(类型等值,vi.mock 工厂内仅编译期解析,无运行时影响)。
import type * as _apiClientNs from '@ihui/api-client'
import type * as _cookieUtilsNs from '@/lib/cookie-utils'
import { useAuthBootstrap, __test__ as bootstrapTest } from '@/hooks/use-auth-bootstrap'
import { useAuthStore } from '@/stores/auth'
import {
  hasSessionEstablished,
  isSessionLoggedOut,
  markSessionEstablished,
  markSessionLoggedOut,
  __resetSessionEstablishedMirrorForTest,
  __resetSessionLoggedOutMirrorForTest,
} from '@/lib/session-marker'

/**
 * `useAuthBootstrap` 冷启动刷新失败**分型**回归测试(2026-10-09 修复)。
 *
 * 修复面:web 端冷启动静默刷新失败时,区分「凭据被明确拒绝(401/403 → 结束本地会话,
 * **不落**持久登出标记)」与「瞬时失败(网络/5xx → 保持现状)」——瞬时失败也清凭据会把
 * 30 天 httpOnly refresh cookie 永久废掉(「自动登录总被清掉」的根因);另堵住
 * `!cancelled && retry.success` 的 else 把「组件已卸载」也当失败清会话的漏洞。
 *
 * 判据纯函数(`shouldExpireSession` / `classifyRefreshFailureStatus`)住在
 * `@ihui/shared/auth/auto-login-policy`,已有独立单测;本文件只锁 **web 这一侧的接线**:
 * hook 的三处失败分支是否真的只在 rejected 才结束本地会话(`expireSession()`),
 * 且**不落**持久登出标记(落了就永久压制账密自动登录)。
 *
 * 测试装置(为什么 mock 这几个):
 * - `@/lib/api` 整体换掉:hook 从它同时 import `fetchApi` 与 `getLastRefreshFailure`,
 *   两个都必须给 —— 只给一个,hook 读另一个时 Vitest 会报 "export is not defined on the mock"。
 * - `@ihui/api-client` 用 importOriginal 铺开、只覆写 `refreshAccessTokenOnce`:
 *   stores/auth.ts 的 `logout` 也从这里 import,漏了它模块加载即炸。
 * - `@/lib/cookie-utils` 只覆写 `getAuthCookie → null`(走 refresh 路径),其余导出留真
 *   (stores/auth 用到的 setAuthCookie/clearRefreshTokenCookie 是 P2-18 后的空操作;
 *   G 组的 `getSessionHintCookie` 必须留真 —— 它读的是 jsdom 的 cookie jar,替身会把自己测了个寂寞)。
 * - `@/stores/user` 只给 selector 形态的 `useUserStore`;本文件走不到 /auth/me 成功路径,
 *   fetchProfile 永远不会被真调。
 * - `@/stores/auth` 用**真 store**:断言的核心正是它的 `expireSession()` 只清凭据、
 *   不写标记(对照 `logout()` 会写标记)的接线,把 store mock 掉等于把要测的那根线拆了。
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
  useUserStore: <T>(selector: (s: { fetchProfile: () => Promise<void> }) => T): T =>
    selector({ fetchProfile: mocks.fetchProfile }),
}))

/** 持久登出标记在盘上的存在性(判据只看存在,不解析值) */
const markerInStorage = () => localStorage.getItem(SESSION_LOGGED_OUT_STORAGE_KEY)

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  __resetSessionLoggedOutMirrorForTest()
  __resetSessionEstablishedMirrorForTest()
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
    // 2026-10-14 控制台清零整改:瞬时失败提示从 console.warn 降级为 console.info
    // (no-console 白名单只放 warn/error/info;语义不变,故断言对象同步换成 info)。
    const logged = vi.spyOn(console, 'info').mockImplementation(() => {})
    // persist 冷启动带进来的幽灵 isAuthenticated 标志位(token 为空但标志位残留)
    useAuthStore.setState({ isAuthenticated: true })
    mocks.getLastRefreshFailure.mockReturnValue('transient')
    mocks.refreshAccessTokenOnce.mockResolvedValue(null)

    const { result } = renderHook(() => useAuthBootstrap())

    await waitFor(() => expect(result.current.ready).toBe(true))

    // 核心:瞬时失败不升级成持久标记(否则 30 天 refresh cookie 被永久废掉)
    expect(markerInStorage()).toBeNull()
    expect(isSessionLoggedOut()).toBe(false)
    // expireSession() 没被调:幽灵标志位保持原状(修复前这里会被清成 false)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(result.current.isAuthenticated).toBe(true)
    // 收束方式是 console.info(保持现状、下一次冷启动重试),不是静默
    expect(logged).toHaveBeenCalled()
    // 刷新失败即止步,不再打 /auth/me
    expect(mocks.fetchApi).not.toHaveBeenCalled()
  })
})

describe('B. 刷新被服务端明确拒绝(401/403):结束本地会话但不落登出标记', () => {
  it('getLastRefreshFailure()=rejected ⇒ expireSession() 清凭据、标记保持为空', async () => {
    useAuthStore.setState({ isAuthenticated: true })
    mocks.getLastRefreshFailure.mockReturnValue('rejected')
    mocks.refreshAccessTokenOnce.mockResolvedValue(null)

    const { result } = renderHook(() => useAuthBootstrap())

    await waitFor(() => expect(result.current.ready).toBe(true))

    // 核心(2026-10-20):会话被动失效**不得**落标记 —— 否则记住的账密从此不再自动提交
    expect(markerInStorage()).toBeNull()
    expect(isSessionLoggedOut()).toBe(false)
    // 幽灵标志位仍被清掉(UI 不能继续假装已登录)
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
    // gate 那一支必须清掉幽灵标志位,而不是只停在未 ready
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(markerInStorage()).not.toBeNull()
  })
})

describe('D. /auth/me retry 失败按 retry 状态码分型(cancelled 漏洞回归锁)', () => {
  /** 首次 /auth/me 与 retry 都失败;refresh 两次都成功 ⇒ 走到 retry 分支看 retry.status */
  async function runBootstrapWithFailedMe(status: number): Promise<void> {
    // 2026-10-14 控制台清零整改:无凭据门控(hasUsableRefreshCredential)要求存在登录态
    // 标志位才会发 /auth/refresh;本组锁的是 retry 分型/cancelled 接线,按回访用户建模。
    useAuthStore.setState({ isAuthenticated: true })
    mocks.refreshAccessTokenOnce.mockResolvedValue('fresh-access-token')
    mocks.fetchApi.mockResolvedValue({ success: false, error: `me failed ${status}`, status })

    const { result } = renderHook(() => useAuthBootstrap())
    await waitFor(() => expect(result.current.ready).toBe(true))

    // 自证真的走到了 retry 分支:两次 /auth/me、两次 refresh
    expect(mocks.fetchApi).toHaveBeenCalledTimes(2)
    expect(mocks.refreshAccessTokenOnce).toHaveBeenCalledTimes(2)
  }

  it('retry status=500(瞬时)⇒ 不写标记,登录态保持', async () => {
    // 2026-10-14 控制台清零整改:瞬时失败提示从 console.warn 降级为 console.info,断言对象同步换
    const logged = vi.spyOn(console, 'info').mockImplementation(() => {})

    await runBootstrapWithFailedMe(500)

    expect(markerInStorage()).toBeNull()
    expect(isSessionLoggedOut()).toBe(false)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(logged).toHaveBeenCalled()
    // 分型看的是 retry.status,不是刷新失败记录:refresh 成功过,记录必须没被读
    expect(mocks.getLastRefreshFailure).not.toHaveBeenCalled()
  })

  it('retry status=401(新凭据也被拒)⇒ 结束会话但不写标记', async () => {
    await runBootstrapWithFailedMe(401)

    expect(markerInStorage()).toBeNull()
    expect(isSessionLoggedOut()).toBe(false)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    // 分型来自 retry.status,而不是 getLastRefreshFailure 记录(refresh 是成功的)
    expect(mocks.getLastRefreshFailure).not.toHaveBeenCalled()
  })

  it('retry 落定前组件已卸载(cancelled)⇒ 即便 retry=401 也不落标记', async () => {
    // 2026-10-14:门控要求有凭据信号才走刷新路径;本用例锁的是 cancelled 语义,按回访用户建模。
    useAuthStore.setState({ isAuthenticated: true })
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

    // 已卸载 = cancelled:既不当失败清会话,也不发 warn/落标记
    expect(markerInStorage()).toBeNull()
    expect(isSessionLoggedOut()).toBe(false)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })
})

describe('E. 无任何 refresh 凭据:不发 /auth/refresh(2026-10-14 控制台清零整改)', () => {
  it('无标志位/无 auth cookie/非桌面 ⇒ 不发刷新请求,静默收束未登录态', async () => {
    // beforeEach 已复位为 isAuthenticated:false + getAuthCookie():null + jsdom(非桌面)
    const { result } = renderHook(() => useAuthBootstrap())

    await waitFor(() => expect(result.current.ready).toBe(true))

    // 核心:无凭据时绝不发 /auth/refresh(否则后端 400 → 浏览器控制台噪声)
    expect(mocks.refreshAccessTokenOnce).not.toHaveBeenCalled()
    expect(mocks.fetchApi).not.toHaveBeenCalled()
    // 不落标记、不清幽灵标志位、不写 debug(没走到失败分支)
    expect(markerInStorage()).toBeNull()
    expect(isSessionLoggedOut()).toBe(false)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('可读 auth cookie 在场(e2e storageState 降级通道)⇒ 照常走恢复路径', async () => {
    mocks.getAuthCookie.mockReturnValue('cookie-access-token')
    // /auth/me 必须成功:否则 else 分支会走 tryRefresh(本用例只锁"cookie 恢复不发 refresh")
    mocks.fetchApi.mockResolvedValue({
      success: true,
      data: { user: { id: 'u1', nickname: 'tester', roleId: 1 } },
    })
    const { result } = renderHook(() => useAuthBootstrap())

    await waitFor(() => expect(result.current.ready).toBe(true))

    // cookie 恢复路径:不发 refresh,直接以 cookie token 打 /auth/me
    expect(mocks.refreshAccessTokenOnce).not.toHaveBeenCalled()
    expect(mocks.fetchApi).toHaveBeenCalledWith('/auth/me')
  })
})

describe('F. forceAttempt:服务端守卫已证明 refresh cookie 在场的现场(2026-10-26)', () => {
  it('本地无任何可见凭据 + forceAttempt ⇒ 仍然发一次刷新(否则有 30 天会话也被判匿名)', async () => {
    // beforeEach 已复位成匿名首访:isAuthenticated=false / 无 auth cookie / 无 established 标记
    expect(await bootstrapTest.hasUsableRefreshCredential()).toBe(false)
    mocks.getLastRefreshFailure.mockReturnValue('transient')
    mocks.refreshAccessTokenOnce.mockResolvedValue(null)

    const { result } = renderHook(() => useAuthBootstrap({ forceAttempt: true }))

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(mocks.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
  })

  it('不传 forceAttempt ⇒ 保持匿名首访零噪声,不发刷新', async () => {
    const { result } = renderHook(() => useAuthBootstrap())

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(mocks.refreshAccessTokenOnce).not.toHaveBeenCalled()
  })
})

describe('B. 冷启动准入:httpOnly cookie 看不见 ≠ 没有(2026-10-20)', () => {
  /**
   * 病灶:两个 token cookie 都是 httpOnly,`document.cookie` 里看不到;`ihui-auth` 只持久化
   * `isAuthenticated`,一次被动失效(`expireSession`)就把它落成 false。原来的准入只看
   * "JS 看得见的凭据"(isAuthenticated / 非 httpOnly cookie / 桌面 vault),于是**有 cookie
   * 的老用户**在冷启动被判成匿名、连 `/auth/refresh` 都不发 ⇒ 每次都要手点登录。
   * 修法:加一颗跨冷启动存活的 `ihui-session-established`(只在拿到过 token 时写)。
   */
  it('全新浏览器(无任何痕迹)⇒ 不发 refresh,保持"匿名首访零噪声"', async () => {
    expect(await bootstrapTest.hasUsableRefreshCredential()).toBe(false)

    const { result } = renderHook(() => useAuthBootstrap())
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(mocks.refreshAccessTokenOnce).not.toHaveBeenCalled()
  })

  it('曾登录过(isAuthenticated 已被被动失效落 false)⇒ 仍然发 refresh', async () => {
    markSessionEstablished()
    mocks.getLastRefreshFailure.mockReturnValue('transient')
    mocks.refreshAccessTokenOnce.mockResolvedValue(null)

    expect(await bootstrapTest.hasUsableRefreshCredential()).toBe(true)

    const { result } = renderHook(() => useAuthBootstrap())
    await waitFor(() => expect(result.current.ready).toBe(true))

    expect(mocks.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
  })

  it('写入有效 token 会自动落这颗标记(setToken 接线)', () => {
    expect(hasSessionEstablished()).toBe(false)
    useAuthStore.getState().setToken('tk-live')
    expect(hasSessionEstablished()).toBe(true)
  })

  it('被动失效(expireSession)清掉标记,死 cookie 不再每次冷启动空转', () => {
    markSessionEstablished()
    useAuthStore.setState({ token: 'tk', refreshToken: 'rt', isAuthenticated: true })
    useAuthStore.getState().expireSession()
    expect(hasSessionEstablished()).toBe(false)
    // 但绝不写登出标记 —— 被动失效不是用户主动退出
    expect(markerInStorage()).toBeNull()
  })

  it('显式登出不清标记(拦住自动登录的是登出标记,不是这颗)', () => {
    markSessionEstablished()
    useAuthStore.setState({ token: 'tk', refreshToken: 'rt', isAuthenticated: true })
    useAuthStore.getState().logout()
    expect(hasSessionEstablished()).toBe(true)
    expect(markerInStorage()).not.toBeNull()
  })
})

describe('G. 后端下发的会话提示 cookie:标记被清也不能把老用户判成匿名(2026-10-27)', () => {
  /**
   * 病灶(B 组那一修的残留半格):`ihui-session-established` 住在 localStorage,
   * `expireSession()` 会清它 —— 而那次 expireSession 可能本身就是一次误判(瞬时失败
   * 分型修好之前,任何刷新失败都会走到它)。标记一没,JS 视野里就什么都不剩:两条凭据
   * cookie 是 httpOnly 读不到,于是冷启动闸门判匿名、连 /auth/refresh 都不发,浏览器里
   * 明明还躺着一条 30 天的 refresh cookie。正解是后端同批下发一条**非 httpOnly**、
   * 值恒 '1'、与 refresh 同寿命的提示 cookie(名字与下发方同源:
   * @ihui/shared/auth/auto-login-policy 的 SESSION_HINT_COOKIE_NAME)。
   */
  const HINT = SESSION_HINT_COOKIE_NAME
  const setHint = (value: string) => {
    document.cookie = `${HINT}=${value}; Path=/; Max-Age=2592000`
  }
  const dropHint = () => {
    document.cookie = `${HINT}=; Path=/; Max-Age=0`
  }

  afterEach(() => dropHint())

  it('无任何本地痕迹 + 提示 cookie 在场 ⇒ 准入成立,冷启动真发一次 refresh', async () => {
    // 这正是「隔天打开后台就要重登」的现场:标记没了、isAuthenticated 落成 false、
    // auth cookie 是 httpOnly 读不到 —— 差别只在于这条提示 cookie 看不看得见。
    dropHint()
    expect(await bootstrapTest.hasUsableRefreshCredential()).toBe(false)

    setHint('1')
    expect(await bootstrapTest.hasUsableRefreshCredential()).toBe(true)

    mocks.getLastRefreshFailure.mockReturnValue('transient')
    mocks.refreshAccessTokenOnce.mockResolvedValue(null)
    const { result } = renderHook(() => useAuthBootstrap())
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(mocks.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
  })

  it('标记被 expireSession 清掉后,提示 cookie 仍接得住(不依赖 localStorage 的存活)', async () => {
    markSessionEstablished()
    useAuthStore.setState({ token: 'tk', refreshToken: 'rt', isAuthenticated: true })
    useAuthStore.getState().expireSession()
    expect(hasSessionEstablished()).toBe(false)
    setHint('1')

    expect(await bootstrapTest.hasUsableRefreshCredential()).toBe(true)
  })

  it('提示 cookie 只认后端那枚值:被改成别的值不算凭据(不接受"有名字就算")', async () => {
    setHint('yes')
    expect(await bootstrapTest.hasUsableRefreshCredential()).toBe(false)
    setHint('1')
    expect(await bootstrapTest.hasUsableRefreshCredential()).toBe(true)
  })

  it('摘除必须同批:登出路径 clearAuthCookies 下发的 Max-Age=0 覆盖后不再算凭据', async () => {
    setHint('1')
    expect(await bootstrapTest.hasUsableRefreshCredential()).toBe(true)
    dropHint()
    expect(await bootstrapTest.hasUsableRefreshCredential()).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
