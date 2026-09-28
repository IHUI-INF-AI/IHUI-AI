// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 冷启动不得用"凭据存储里的旧凭据"自动登录(2026-09-27)
//
// 实测到的链(file:line 见 README 交付报告,这里只留判据所需的骨架):
//   显式登出清的是**凭据**:`logoutAuth()` → 共享工厂 `logout()` → `tokenStore.clearAll()`
//   → `src/lib/token.ts` 的 `clearToken()` → SecureStore 两个 key 删除。
//   这一段已由 `auth-single-credential-source.test.ts` 第 3 例钉住(登出 → 冷启动 token 为空)。
//   但登录页自己还有一条**与凭据存储无关**的静默重登路:`src/screens/LoginScreen.tsx:413-420`
//   的挂载 effect 读 `credentialStorage.loadAutoLogin()` + `loadRemembered()`
//   (AsyncStorage 的 `ihui-auto-login` + `ihui-remember-credentials` = 账号+密码),
//   两者齐备就 `form.login()` → 服务端换到新 token → 写回 → 回到已登录分支。
//   全仓没有任何登出路径清这两个 key(唯一清除点在
//   `packages/shared/src/hooks/use-login-form.ts:226-240`,条件是"取消记住密码")。
//
// 所以本文件判的是"登出标记"这一半(它住在 `lib/token.ts`,与 sessionEpoch 同一个收口点),
// 以及"登录态判据到底取哪一份实现"(替身对齐)。
// 消费点(LoginScreen 那一行)在本票受影响文件清单之外 —— 由末例如实点名,不假装已闭环。
//
// 取材纪律:本文件**不**覆盖 `@ihui/shared/stores`(别名已直指真实工厂,见 vitest.config.ts
// 里那条注释),第 4 例就是这条改动的验收 —— 它同时也是"凭据用例再也不必自带 vi.mock 才能
// 测到实现"的证明。`@ihui/shared/auth` 那一份仍是手写替身(它忽略全部持久化回调、
// 且没有 `setCachedWithoutPersist` ⇒ 直接用别名跑 `initApi()` 会 TypeError),
// 所以本文件沿用了既有凭据用例的局部覆盖;为什么没顺手把它也换成真实工厂,见文件末"残余"。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const { apiClient } = vi.hoisted(() => ({
  apiClient: {
    setBaseUrl: vi.fn(),
    setUserAgent: vi.fn(),
    setDeviceFingerprintProvider: vi.fn(),
    setTokenProvider: vi.fn(),
    fetchApi: vi.fn(),
    loginByAccount: vi.fn(),
    logout: vi.fn(),
  },
}))

vi.mock('@ihui/api-client', () => apiClient)
vi.mock('@ihui/shared/auth', async () => {
  const real = await import('../../../packages/shared/src/auth/token-store')
  return {
    bindTokenStoreToApiClient: real.bindTokenStoreToApiClient,
    createInMemoryTokenStore: real.createInMemoryTokenStore,
  }
})

import storageMock, { resetAsyncStorageMock } from './__mocks__/async-storage'
import { _resetSecureStoreBackendForTest } from '../src/lib/auth/secure-store'
import { initApi, getToken, isSessionLoggedOut, clearToken } from '../src/lib/token'
import { rnAuthStore, logoutAuth, hydrateAuth } from '../src/stores/auth-store'

const USER = { id: 'u1', nickname: 'tester', avatar: '' } as const
/** 与 `lib/token.ts` 的 SESSION_LOGGED_OUT_KEY 同值:断言的是"落在盘上的那份事实"。 */
const MARKER_KEY = 'ihui-session-logged-out'

/**
 * LoginScreen 自动登录判据的同一支算式(它自己写的三个条件的镜像)。
 * 消费点接上之后,这里应改成"渲染 LoginScreen 断言不调登录接口",并删除末例。
 */
function wouldAutoLogin(): boolean {
  return (
    !isSessionLoggedOut() &&
    storageMock.__store.get('ihui-auto-login') === '1' &&
    storageMock.__store.has('ihui-remember-credentials')
  )
}

describe('显式登出后的冷启动', () => {
  beforeEach(async () => {
    resetAsyncStorageMock()
    _resetSecureStoreBackendForTest()
    vi.clearAllMocks()
    // 单例内存缓存 + 登出标记跨用例存活,显式清回空态(与 setup.ts 的存储重置配对)
    await clearToken()
    resetAsyncStorageMock()
  })

  it('① 登出 → 标记落盘(持久),不是只活在内存里', async () => {
    await initApi()
    await rnAuthStore.getState().setAuth({ token: 'T', refreshToken: 'R', user: USER })
    expect(isSessionLoggedOut()).toBe(false)

    await logoutAuth()

    expect(isSessionLoggedOut()).toBe(true)
    // 进程重启后唯一还能拿到的东西就是这条盘上事实
    expect(storageMock.__store.has(MARKER_KEY)).toBe(true)
    expect(getToken()).toBeNull()
  })

  it('① 反向对照:盘上没有标记时,initApi 会把判据放回"未登出"(证明取的是盘,不是进程内存)', async () => {
    await initApi()
    await rnAuthStore.getState().setAuth({ token: 'T', refreshToken: 'R', user: USER })
    await logoutAuth()
    expect(isSessionLoggedOut()).toBe(true)

    // 抹掉盘上标记 = 模拟"上一进程从未登出过"的那一轮冷启动
    storageMock.__store.delete(MARKER_KEY)
    await initApi()

    expect(isSessionLoggedOut()).toBe(false)
  })

  it('② 正当登录路径不被误伤:登出后再登录(手动/SSO 走的同一条 setAuth)清掉标记', async () => {
    await initApi()
    await rnAuthStore.getState().setAuth({ token: 'T', refreshToken: 'R', user: USER })
    // 勾了"自动登录" + 记住了账密(用假值,不写任何真凭据)
    await storageMock.setItem('ihui-auto-login', '1')
    await storageMock.setItem('ihui-remember-credentials', JSON.stringify(USER))

    await logoutAuth()
    expect(isSessionLoggedOut()).toBe(true)
    // 登出标记的作用范围只到"下一次会话开始"之前
    expect(wouldAutoLogin()).toBe(false)

    await rnAuthStore.getState().setAuth({ token: 'T2', refreshToken: 'R2', user: USER })

    expect(isSessionLoggedOut()).toBe(false)
    expect(storageMock.__store.has(MARKER_KEY)).toBe(false)
    expect(wouldAutoLogin()).toBe(true)
  })

  it('③ 登出 → 冷启动(initApi + hydrateAuth)停在未登录态:token 空且 isAuthenticated 跟着 false', async () => {
    await initApi()
    await rnAuthStore.getState().setAuth({ token: 'T', refreshToken: 'R', user: USER })
    await logoutAuth()

    await initApi()
    hydrateAuth()

    expect(getToken()).toBeNull()
    expect(rnAuthStore.getState().token).toBeNull()
    expect(rnAuthStore.getState().isAuthenticated).toBe(false)
    expect(isSessionLoggedOut()).toBe(true)
  })

  it('④ 替身对齐验收:hydrate 对 null 是"覆盖"而不是"跳过"(别名解析到的必须是真实工厂)', async () => {
    await initApi()
    expect(getToken()).toBeNull()
    // 手工把镜像顶成"已登录",模拟一份没人清干净的旧状态
    rnAuthStore.setState({ token: 'STALE', refreshToken: 'STALE-RT', isAuthenticated: true })

    hydrateAuth()

    // 手写替身在这里会让 token 停留在 STALE、isAuthenticated 无人重算 ⇒ 本例必红;
    // 真实工厂覆盖并把 isAuthenticated 派生成 !!token。两条断言各管一半。
    expect(rnAuthStore.getState().token).toBeNull()
    expect(rnAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('⑤ setToken(null) 与 clearToken 同处置(它是共享工厂之外唯一另一条"清凭据"写法)', async () => {
    await initApi()
    await rnAuthStore.getState().setAuth({ token: 'T', refreshToken: 'R', user: USER })
    await clearToken()
    expect(isSessionLoggedOut()).toBe(true)

    // 恢复:先清标记,再单独走"写入非空 access token"
    storageMock.__store.delete(MARKER_KEY)
    await initApi()
    expect(isSessionLoggedOut()).toBe(false)
    await rnAuthStore.getState().setAuth({ token: 'T2', refreshToken: 'R2', user: USER })
    expect(isSessionLoggedOut()).toBe(false)
  })

  it('⑥ 消费点已闭环:LoginScreen 必须问 shouldAttemptAutoLogin,而不是自己再写一遍条件', async () => {
    const src = readFileSync(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        'src',
        'screens',
        'LoginScreen.tsx',
      ),
      'utf-8',
    )
    // 判据只许有一份:屏里自己写 `loadAutoLogin() && loadRemembered()` 而不走策略出口,
    // 下一次改判据就会只改一处(本仓最高频失效型)。
    expect(src).toMatch(/shouldAttemptAutoLogin\s*\(\s*\{/)
    expect(src).toMatch(/sessionLoggedOut:\s*isSessionLoggedOut/)
    const bare = src.match(/credentialStorage\.loadAutoLogin\(\)\s*&&\s*credentialStorage\.loadRemembered\(\)/)
    expect(bare, '屏里不得再留一份裸条件(判据必须只住在 auto-login-policy)').toBeFalsy()
  })

  it('⑦ 策略正反两臂:登出标记压过历史勾选;两个勾选位缺一不可', async () => {
    const { shouldAttemptAutoLogin } = await import('../src/lib/auto-login-policy')
    const d = (sessionLoggedOut: boolean, flag: boolean, remembered: boolean) =>
      shouldAttemptAutoLogin({
        sessionLoggedOut: () => sessionLoggedOut,
        hasAutoLoginFlag: () => flag,
        hasRememberedCredentials: () => remembered,
      })
    // 未登出 + 两勾选齐 ⇒ 允许静默重登(正当路径不被误伤)
    expect(d(false, true, true)).toBe(true)
    // 已登出 ⇒ 一律不重登,哪怕勾选都还在(这正是"退出后自己登回来"那一型)
    expect(d(true, true, true)).toBe(false)
    // 缺任一勾选位 ⇒ 不重登
    expect(d(false, false, true)).toBe(false)
    expect(d(false, true, false)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
