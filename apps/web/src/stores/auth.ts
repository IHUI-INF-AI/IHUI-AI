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
      setUser: (user) => set({ user }),
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
      (s) => ({
        isAuthenticated: s.isAuthenticated,
        user: s.user,
      }),
      createAuthPersistStorage<Partial<AuthState>>(
        ssrStorage as PersistStorage<Partial<AuthState>>,
      ),
    ),
  ),
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
