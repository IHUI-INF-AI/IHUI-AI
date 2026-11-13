// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { logout as apiLogout, type AuthUser as ApiAuthUser } from '@ihui/api-client'
import { type TokenPair } from '@ihui/types'
import {
  setAuthCookie,
  setRefreshTokenCookie,
  getRefreshTokenCookie,
  clearRefreshTokenCookie,
  REMEMBER_MAX_AGE,
} from '@/lib/cookie-utils'
import {
  isDesktopEnv,
  getDesktopRefreshToken,
  setDesktopRefreshToken,
} from '@/lib/desktop-token-vault'
import {
  clearSessionEstablished,
  clearSessionLoggedOutMarker,
  markSessionEstablished,
  markSessionLoggedOut,
} from '@/lib/session-marker'
import { createPersistConfig, ssrStorage } from './persist-helpers'
import { createAuthPersistStorage } from '@/lib/chat-persist-crypto'
import type { PersistStorage } from 'zustand/middleware'

/** 与共享层 @ihui/api-client AuthUser 完全一致,确保 5 端用户类型统一 */
export type AuthUser = ApiAuthUser

/**
 * Desktop(SaaS)模式:refreshToken 同步到 Tauri store(auth.json)。
 * 浏览器模式 isDesktopEnv()=false 空操作 —— cookie 链路完全不动。
 * 2026-09-02 桌面端 SaaS 化:跨站请求不带 SameSite=Lax cookie,登录/轮换的
 * refreshToken 必须落 Tauri store,刷新时由 api.ts 从 vault 读出发 body 模式。
 */
function syncDesktopRefreshToken(refreshToken: string | null): void {
  if (!isDesktopEnv()) return
  void setDesktopRefreshToken(refreshToken)
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  expiresIn: number | null
  isAuthenticated: boolean
  user: AuthUser | null
  setToken: (token: string | null, refreshOrPair?: string | TokenPair | null) => void
  /** 带 autoLogin 偏好的 setToken:autoLogin=true 时 refreshToken cookie max-age=30d */
  setTokenWithPrefs: (token: string, refreshOrPair: string | TokenPair, autoLogin: boolean) => void
  setUser: (user: AuthUser | null) => void
  /** 从 cookie 恢复 refreshToken(页面刷新后调用,实现"记住 30 天") */
  hydrateRefreshToken: () => void
  /**
   * 用户显式登出(按钮 / 账号注销):清凭据 + **落持久登出标记** ——
   * 标记会压住"记住密码 + 自动登录",直到下一次真正登录写入凭据。
   */
  logout: () => void
  /**
   * 会话被动失效(服务端明确拒绝 refresh):只清本地凭据,**不落**登出标记。
   * 与 `logout()` 的区别只有标记这一位 —— 用户的 30 天自动登录必须还能在下次冷启动
   * 用记住的账密把会话重新建立起来,否则服务端一次轮转冲突就永久变成"每次手点登录"。
   */
  expireSession: () => void
}

/**
 * persist 落盘的同步兜底(2026-11-12 立)。
 *
 * 病灶(真浏览器实测):登录成功后 `setToken` 已把内存态写成 isAuthenticated=true,
 * 但 `localStorage['ihui-auth']` 要么不存在、要么被写成初始值
 * `{"state":{"isAuthenticated":false,"user":null}}` —— persist 中间件的写入
 * 没有跟着这次 `set()` 发生,而是在稍后某次初始化/hydrate 时用初始值写了一次。
 * 后果:`admin/layout` 读到的 roleId 恒为 null,真管理员被弹到 /forbidden 或 /sso/login。
 *
 * 兜底只做一件事:把"当前内存态的持久化子集"同步写一份,不依赖 persist 的触发时机。
 * 与 persist 的 partialize 逐字同源(isAuthenticated + user),不含任何 token ——
 * 安全口径不变(localStorage 里永远没有 access/refresh token)。
 * 幂等:重复写同一份内容无副作用;persist 之后再写一次也只会覆盖成同样的值。
 */
function persistAuthSnapshot(state: { isAuthenticated: boolean; user: AuthUser | null }): void {
  if (typeof window === 'undefined') return
  try {
    // 单调性保护:已登录且有 user 的盘上快照,**不得**被"未登录"覆盖。
    // 实测存在模块双实例(SSR bundle / client bundle 各一份 store),另一份实例的
    // 初始化写入会把刚登好的态抹成 false/null,正是 admin 守卫读不到 roleId 的根因。
    // 失效方向:宁可留一份稍旧的已登录快照(下次冷启动用它恢复),也不写未登录覆盖它。
    const raw = window.localStorage.getItem('ihui-auth')
    if (raw && !state.user) {
      try {
        const prev = JSON.parse(raw) as {
          state?: { user?: unknown; isAuthenticated?: unknown }
        }
        // 盘上已是「已登录」或「有 user」的态 ⇒ 这次未登录写入一律不落。
        // 双实例场景下,另一份 store 的初始化会带着 false/null 过来,
        // 若放它写就会把刚登好的快照抹掉(setUser 已实测执行且 roleId=1,
        // 盘上却仍是 false/null,就是这个覆盖)。
        if (prev?.state?.user || prev?.state?.isAuthenticated === true) return
      } catch {
        // 旧值不可解析:按"无保护价值"处理,继续覆盖
      }
    }
    window.localStorage.setItem(
      'ihui-auth',
      JSON.stringify({
        state: { isAuthenticated: state.isAuthenticated, user: state.user },
        version: 0,
      }),
    )
  } catch {
    // 隐私模式/配额超限:持久化失败不影响登录本身,内存态仍然可用
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      expiresIn: null,
      isAuthenticated: false,
      user: null,
      setToken: (token, refreshOrPair) => {
        // 登出标记与凭据同源同步(判据住在 @ihui/shared/auth/auto-login-policy,这里只落盘):
        // 写入非空 token = 新一轮会话开始 ⇒ 标记作废;写入 null = **用户显式登出**
        // ⇒ 标记先落盘。会话被动失效(refresh 被拒)不走这里,走 `expireSession()`
        // —— 它只清凭据、不落标记(2026-10-20,见接口注释)。
        if (token) clearSessionLoggedOutMarker()
        else markSessionLoggedOut()
        // 记下"这台浏览器有过会话":cookie 是 httpOnly,冷启动判定不能靠"JS 看得见"
        // (见 lib/session-marker.ts 的 SESSION_ESTABLISHED_STORAGE_KEY 头注)。
        if (token) markSessionEstablished()
        // P2-18 修复(2026-08-06):setAuthCookie/setRefreshTokenCookie 已改为空操作,
        // cookie 由后端 httpOnly Set-Cookie 管理,此处不再实际写 cookie。
        setAuthCookie(token)
        if (refreshOrPair === null || refreshOrPair === undefined) {
          clearRefreshTokenCookie()
          set({ token, isAuthenticated: !!token, refreshToken: null, expiresIn: null })
          persistAuthSnapshot({ isAuthenticated: !!token, user: get().user })
          // 仅显式登出式调用(token 为空)才清 vault;token 有效但未带 refresh 的
          // 兼容调用保留既有 vault 值,避免误伤桌面端已落盘的 refreshToken。
          if (!token) syncDesktopRefreshToken(null)
          return
        }
        if (typeof refreshOrPair === 'string') {
          // autoLogin 偏好由 setTokenWithPrefs 处理;httpOnly 后 cookie 有效期由后端决定
          setRefreshTokenCookie(refreshOrPair || null)
          set({
            token,
            isAuthenticated: !!token,
            refreshToken: refreshOrPair || null,
            expiresIn: null,
          })
          persistAuthSnapshot({ isAuthenticated: !!token, user: get().user })
          syncDesktopRefreshToken(refreshOrPair || null)
          return
        }
        setRefreshTokenCookie(refreshOrPair.refreshToken ?? null)
        set({
          token,
          isAuthenticated: !!token,
          refreshToken: refreshOrPair.refreshToken ?? null,
          expiresIn: refreshOrPair.expiresIn ?? null,
        })
        persistAuthSnapshot({ isAuthenticated: !!token, user: get().user })
        syncDesktopRefreshToken(refreshOrPair.refreshToken ?? null)
      },
      setTokenWithPrefs: (token, refreshOrPair, autoLogin) => {
        // 登录成功写入凭据 ⇒ 登出标记作废(否则用户下次正常登录又被判成"刚登出")
        clearSessionLoggedOutMarker()
        markSessionEstablished()
        const refreshToken =
          typeof refreshOrPair === 'string' ? refreshOrPair : refreshOrPair.refreshToken
        const expiresIn =
          typeof refreshOrPair === 'string' ? null : (refreshOrPair.expiresIn ?? null)
        const cookieMaxAge = autoLogin ? REMEMBER_MAX_AGE : undefined
        setAuthCookie(token, { maxAge: cookieMaxAge })
        setRefreshTokenCookie(refreshToken ?? null, { maxAge: cookieMaxAge })
        set({ token, isAuthenticated: !!token, refreshToken: refreshToken ?? null, expiresIn })
        persistAuthSnapshot({ isAuthenticated: !!token, user: get().user })
        syncDesktopRefreshToken(refreshToken ?? null)
      },
      hydrateRefreshToken: () => {
        const { refreshToken } = get()
        if (refreshToken) return // 内存已有,无需恢复
        // P2-18:refresh_token 已 httpOnly,getRefreshTokenCookie() 恒返回 null,
        // 此函数在 httpOnly 部署下实际为空操作;登录态恢复改由 bootstrap 无参刷新完成。
        const fromCookie = getRefreshTokenCookie()
        if (fromCookie) {
          set({ refreshToken: fromCookie })
        }
      },
      setUser: (user) => {
        set({ user })
        // roleId 随 user 一起来(admin 守卫靠它判权限),必须立刻落盘:
        // 晚一步就会被 layout 的宽限期判成"角色还不知道"→ 弹 /forbidden。
        // isAuthenticated 取"是否真有 user",**不读 get()** ——
        // 实测 get() 可能落在另一份模块实例上读到初始 false,把刚登好的态写成未登录。
        persistAuthSnapshot({ isAuthenticated: user !== null, user })
      },
      logout: () => {
        // 标记先于凭据处置落盘(失效方向见 lib/session-marker.ts 头注):
        // httpOnly refresh cookie 由后端管理,而 refreshToken 不落 localStorage ——
        // 刷新页面后再登出时 rt 取不到 ⇒ 不调 /auth/logout ⇒ 服务端那份 cookie 仍有效,
        // 冷启动的静默刷新就会把刚点过退出的用户登回去。这条持久标记是客户端唯一的出口。
        markSessionLoggedOut()
        const { refreshToken } = get()
        // P2-18:httpOnly cookie 由后端管理,登出必须调后端接口(响应清 cookie);
        // 内存有 refreshToken 时携带 body 吊销,后端同时 clearAuthCookies。
        // 2026-09-02 桌面 SaaS:应用重启后内存 refreshToken 为空,但 vault 仍持有,
        // 需从 vault 读回再吊销,最后清空 vault —— 否则后端会话残留 30 天。
        void (async () => {
          const vaultToken = isDesktopEnv() ? await getDesktopRefreshToken() : null
          const rt = refreshToken ?? vaultToken
          // 2026-10-26:即使内存/vault 都取不到 rt 也要调一次 —— 浏览器模式下 httpOnly
          // refresh_token cookie 在 JS 里不可见,只有后端能吊销并清 cookie。旧写法 `if (rt)`
          // 会让服务端会话在登出后仍残留 30 天(客户端只靠持久标记压着不自动登回)。
          try {
            await apiLogout(rt ?? undefined)
          } catch {
            // 吊销失败(如已离线)不阻塞本地登出
          }
          if (isDesktopEnv()) await setDesktopRefreshToken(null)
        })()
        setAuthCookie(null)
        clearRefreshTokenCookie()
        set({
          token: null,
          refreshToken: null,
          expiresIn: null,
          isAuthenticated: false,
          user: null,
        })
      },
      expireSession: () => {
        // 被动失效:不写标记、不调 /auth/logout(凭据已被服务端否定,再吊销一次没有意义),
        // 也不清此前的标记 —— 若用户此前显式登出过,那份抑制必须继续有效。
        const knownRefresh = get().refreshToken
        // 服务端明确否定凭据 ⇒ 也别再让下次冷启动为一份死 cookie 空转一次 refresh。
        clearSessionEstablished()
        clearRefreshTokenCookie()
        // 清 vault 必须是 CAS,不能盲清:桌面多窗口共用 auth.json,另一窗口可能已轮转并把
        // 新 token 写回;盲清会把它抹掉,下次冷启动无凭据可刷(与 lib/api.ts 的 rejected
        // 分支同一条判据)。不知道本窗口用过哪一份(冷启动时 state 里没有)时一律不碰 ——
        // 那份真死了的话,下一次刷新由 api.ts 的 CAS 自己收掉。
        if (isDesktopEnv()) {
          void (async () => {
            if (!knownRefresh) return
            const current = await getDesktopRefreshToken()
            if (current === knownRefresh) await setDesktopRefreshToken(null)
          })()
        }
        set({
          token: null,
          refreshToken: null,
          expiresIn: null,
          isAuthenticated: false,
          user: null,
        })
        persistAuthSnapshot({ isAuthenticated: false, user: null })
      },
    }),
    // 2026-07-21 安全审计加固:严禁把 token / refreshToken 持久化到 localStorage
    // 原因:localStorage 可被任意 JavaScript 读取,任何 XSS 漏洞
    // (含第三方依赖的间接 XSS) 都会让攻击者通过 localStorage.getItem('ihui-auth')
    // 直接拿到 access_token + refresh_token,造成全账户劫持
    // 修复:仅持久化非敏感 UI 状态(isAuthenticated + user)到 localStorage
    // access_token 改用 httpOnly cookie(由后端 Set-Cookie 写入,JS 无法读取)
    // refresh_token 必须由后端管理(httpOnly cookie + 定期轮换)
    // 此处仅保留 isAuthenticated 标志位用于 UI 渲染决策
    // D48′(2026-09-24):桌面端把这块 blob 也接进信封加密 —— 它按上面的审计**不含任何 token**,
    // 但 `user` 里有手机号与昵称,明文留在 WebView Local Storage 仍属个人数据落盘(巡检门的
    // CJK 判据点名的正是它)。浏览器路径 createAuthPersistStorage 原样返回 ssrStorage,零行为变更。
    createPersistConfig<AuthState>(
      'ihui-auth',
      (s) => {
        // 双实例保护(2026-11-12 实测):本仓存在两份 store 模块实例(SSR bundle / client
        // bundle 各一份)。未登录那份的初始化写入会把已登录那份刚写的 user 抹成 null,
        // 而 admin/layout 读 roleId 依赖它 ⇒ 真管理员被弹 /forbidden。
        // 这里做"只升不降":内存里有 user 就用内存的;**内存没有但盘上有,就保留盘上的**。
        // 失效方向:宁可留一份稍旧的已登录快照,也绝不用空态覆盖它。
        if (s.user) return { isAuthenticated: s.isAuthenticated, user: s.user }
        if (typeof window !== 'undefined') {
          try {
            const raw = window.localStorage.getItem('ihui-auth')
            if (raw) {
              const prev = JSON.parse(raw) as {
                state?: { user?: AuthUser | null; isAuthenticated?: boolean }
              }
              if (prev?.state?.user) {
                return { isAuthenticated: true, user: prev.state.user }
              }
            }
          } catch {
            // 盘上值不可解析:按空态处理
          }
        }
        return { isAuthenticated: s.isAuthenticated, user: s.user }
      },
      createAuthPersistStorage<Partial<AuthState>>(
        ssrStorage as PersistStorage<Partial<AuthState>>,
      ),
      // rehydrate 落定后校正内存态(2026-11-12 修双实例问题)。
      //
      // 实测:盘上快照已是 {"isAuthenticated":true,"user":{"roleId":1}},
      // 但内存态停在初始 false/null —— admin/layout 读内存判权限,
      // 于是真管理员被 client 侧 router.replace 弹回 /sso/login。
      // 这里读一次盘(盘上有 user 就补进内存),不改任何业务判据。
      () => () => {
        if (typeof window === 'undefined') return
        try {
          const raw = window.localStorage.getItem('ihui-auth')
          if (!raw) return
          const parsed = JSON.parse(raw) as {
            state?: { user?: AuthUser | null; isAuthenticated?: boolean }
          }
          const user = parsed?.state?.user
          if (!user) return
          const current = useAuthStore.getState()
          if (current.user?.id === user.id && current.isAuthenticated) return
          // 只补 user 与 isAuthenticated 标志位;token 不进 localStorage 也不从这里恢复,
          // 仍由 bootstrap 的 /auth/refresh(cookie 链路)拿 —— 安全口径不变。
          useAuthStore.setState({ user, isAuthenticated: true })
        } catch {
          // 盘上值不可解析:保持内存原值
        }
      },
    ),
  ),
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
