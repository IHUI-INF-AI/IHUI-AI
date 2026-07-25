/**
 * auth-store — web 端共享 Auth zustand store(2026-07-25 立)
 *
 * 接入示例:
 * ```ts
 * import { useWebAuthStore, hydrateAuth, logoutAuth } from '@/stores/auth-store'
 *
 * // 1. 客户端首次挂载时同步镜像 tokenStore 状态
 * useEffect(() => { hydrateAuth() }, [])
 *
 * // 2. 组件订阅(与 useAuthStore 用法一致,选择器可选)
 * const user = useWebAuthStore((s) => s.user)
 * const isAuthenticated = useWebAuthStore((s) => s.isAuthenticated)
 *
 * // 3. 登录后写入(同步镜像 + 触发 tokenStore 写入 cookie)
 * await useWebAuthStore.getState().setAuth({
 *   token: data.accessToken,
 *   refreshToken: data.refreshToken,
 *   user: data.user,
 * })
 *
 * // 4. 登出(清 tokenStore + 清 user + 通知后端)
 * await logoutAuth()
 * ```
 *
 * 设计原则:
 * 1. **非破坏性**:`useAuthStore`(apps/web/src/stores/auth.ts)是 web 端历史 auth store,
 *    本文件**不替换**它,只是新加一层 `webSharedAuthStore` 包装 `@ihui/shared/stores`
 *    的 `createAuthStore` 工厂,允许组件逐步迁移。
 * 2. **TokenStore 契约**:`createAuthStore` 依赖 `TokenStore` 接口,本文件将现有
 *    `useAuthStore`(已与 auth_token / refresh_token cookie 双向同步)适配为该契约,
 *    无新持久化逻辑,无新 cookie 写入路径,完全复用现有 setToken / setUser / logout。
 * 3. **安全优先**:只持久化 `user` + `isAuthenticated` 到 localStorage(2026-07-21 审计结论),
 *    token 一律不落盘,refresh token 仍走 refresh_token cookie(由后端管理)。
 * 4. **SSR 友好**:userTransport 用 `createSSRSafeWebTransport`,服务端渲染阶段
 *    自动 fallback 到内存,避免 `window.localStorage` 访问报错。
 *
 * 与现有 useAuthStore 的关系:
 * - `useAuthStore`(apps/web/src/stores/auth.ts):web 端历史实现,自管 cookie + zustand 状态
 * - `useWebAuthStore`(本文件):基于共享工厂的薄包装,内部委托 `useAuthStore` 操作 cookie
 * - 二者底层数据源一致(都是 auth_token / refresh_token cookie),
 *   调用任一方的 setToken / logout 都会同步另一方的镜像
 */

import { createAuthStore } from '@ihui/shared/stores'
import type { AuthUser } from '@ihui/api-client'
import { logout as apiLogout } from '@ihui/api-client'
import type { TokenStore } from '@ihui/shared/auth/token-store'
import { useAuthStore as legacyAuthStore } from './auth'
import { createSSRSafeWebTransport } from './storage-adapter'

/**
 * Web 端 TokenStore 适配器
 *
 * 将现有 `useAuthStore`(apps/web/src/stores/auth.ts)适配为共享层 `TokenStore` 契约,
 * 供 `createAuthStore` 工厂读取/写入 token。
 *
 * 行为:
 * - `getToken` / `getRefreshToken`:从 `useAuthStore` zustand 状态读取
 *   (该状态由 setToken 同步写入 cookie,内存即为单一可信源)
 * - `setToken(t)`:复用现有 `setToken(t, currentRefreshToken)`,保持 refreshToken 不变
 * - `setRefreshToken(t)`:复用现有 `setToken(currentToken, t)`,保持 accessToken 不变
 * - `clearAll()`:复用现有 `logout()`,同时清 cookie + 清 zustand 状态
 *
 * 不引入新的 cookie 路径,所有写入都走现有 `setAuthCookie` / `setRefreshTokenCookie`。
 */
const webTokenStore: TokenStore = {
  getToken: () => legacyAuthStore.getState().token,
  getRefreshToken: () => legacyAuthStore.getState().refreshToken,
  setToken: (token) => {
    const current = legacyAuthStore.getState()
    // 保持 refreshToken 不变:传 string 走"session cookie"分支,传 null 走 clear 分支
    current.setToken(token, token ? current.refreshToken : null)
  },
  setRefreshToken: (token) => {
    const current = legacyAuthStore.getState()
    // 保持 accessToken 不变;传 string 走"session cookie"分支,传 null 走 clear 分支
    if (current.token) {
      current.setToken(current.token, token)
    }
  },
  clearAll: () => {
    legacyAuthStore.getState().logout()
  },
}

/** user + isAuthenticated 持久化 transport(SSR 安全) */
const userTransport = createSSRSafeWebTransport()

/**
 * Web 端共享 Auth zustand store 实例
 *
 * 实例化一次,模块作用域导出,所有组件共享同一份 state。
 * 持久化策略:`name: 'ihui-auth-user'`,仅存 `user` + `isAuthenticated`,
 * 与现有 `useAuthStore` 的 `ihui-auth` 持久化分区互不干扰(不同 key)。
 */
export const webSharedAuthStore = createAuthStore<AuthUser>({
  tokenStore: webTokenStore,
  userTransport,
  userPersistKey: 'ihui-auth-user',
  onLogout: async () => {
    // 注销时通知后端撤销 refreshToken(后端家族轮换 + RFC 6749 重用检测保护)
    // 与现有 useAuthStore.logout() 行为一致
    const refreshToken = legacyAuthStore.getState().refreshToken
    if (refreshToken) {
      try {
        await apiLogout(refreshToken)
      } catch {
        // swallow:本地登出必须无条件成功,后端通知失败不影响 UI 状态
      }
    }
  },
})

/** 共享 Auth zustand hook(组件订阅入口) */
export const useWebAuthStore = webSharedAuthStore.useAuthStore

/**
 * 同步镜像 tokenStore 状态
 *
 * 应在客户端首次挂载(根布局 useEffect)调用一次,把 cookie / legacy store 中的
 * token + refreshToken 镜像到本 store 的 zustand 状态,供 React 订阅。
 * 后续若通过 `useWebAuthStore` 写入,会自动同步回 legacy store(无需再次 hydrate)。
 */
export function hydrateAuth(): void {
  webSharedAuthStore.hydrate()
  useWebAuthStore.getState().setReady(true)
}

/**
 * 登出辅助函数
 *
 * 流程:清 tokenStore(legacy useAuthStore.logout → 清 cookie + 清 zustand 镜像)
 *      → 通知后端撤销 refreshToken(onLogout 钩子)
 *      → 清本 store 的 user + isAuthenticated + token 镜像
 *
 * 调用方无需关心三阶段顺序,任一阶段失败不影响本地登出(后端通知已在 onLogout 内部 try/catch)。
 */
export async function logoutAuth(): Promise<void> {
  await useWebAuthStore.getState().logout()
}
