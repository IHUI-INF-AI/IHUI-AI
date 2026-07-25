/**
 * mobile-rn 端共享 Auth zustand Store 接入(2026-07-25 立)
 *
 * @example 接入示例
 * ```tsx
 * // 1) 业务组件中订阅认证状态
 * import { useAuthStore, logoutAuth } from '@/stores/auth-store'
 *
 * function ProfileButton() {
 *   const user = useAuthStore((s) => s.user)
 *   const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
 *   if (!isAuthenticated) return <LoginButton />
 *   return <Text onPress={logoutAuth}>{user?.nickname}</Text>
 * }
 *
 * // 2) App 启动时执行 hydrate(tokenStore → store 镜像)
 * import { hydrateAuth } from '@/stores/auth-store'
 *
 * useEffect(() => {
 *   void hydrateAuth()
 * }, [])
 *
 * // 3) 登录成功后写认证态(tokenStore + 镜像 + user 持久化)
 * import { rnAuthStore } from '@/stores/auth-store'
 *
 * await rnAuthStore.getState().setAuth({
 *   token: accessToken,
 *   refreshToken,
 *   user: profile,
 * })
 * ```
 *
 * 与现有 AuthContext 的关系:
 * - **不替换**:AuthContext 仍是当前 UI 订阅来源,组件用 useAuth() 取值不变。
 * - **平行存在**:本 store 用 zustand + persist 实现,提供"跨组件订阅同一份状态 +
 *   自动从 AsyncStorage 恢复 user"的能力,为后续按页面 / 按模块逐步迁移铺路。
 * - **数据源一致**:两边都通过 ../lib/token 的 tokenStore 读 / 写 token,
 *   setAuth 写完 tokenStore 后立即 hydrate 本 store,确保镜像同步。
 * - **非破坏性接入**:任何登录 / 登出路径改用 setAuth/logout 后,
 *   AuthContext 的 useState 自然会因为 tokenStore 变化而重渲染(因 getToken 同步缓存)。
 *   实际迁移策略见后续 AGENTS 文档。
 *
 * 安全说明:
 * - token / refreshToken / expiresIn 一律不持久化,只走 SecureStore(tokenStore 内部)
 * - user + isAuthenticated 持久化到 AsyncStorage(非敏感 UI 状态,可跨会话恢复)
 * - 遵循 web 端 2026-07-21 安全审计结论
 */
import { createAuthStore, type AuthUser } from '@ihui/shared/stores'
import { tokenStore } from '../lib/token'
import { createAsyncStorageTransport } from './storage-adapter'

/**
 * mobile-rn 端共享 Auth zustand store 实例
 *
 * 注入:
 * - tokenStore:复用 ../lib/token 实现的 TokenStore 契约(SecureStore 优先 + AsyncStorage fallback)
 * - userTransport:本端 AsyncStorage transport(只持久化 user + isAuthenticated)
 * - userPersistKey:与 web 端同名 'ihui-auth-user',便于调试 + 未来跨端数据共享
 */
export const rnAuthStore = createAuthStore({
  tokenStore,
  userTransport: createAsyncStorageTransport(),
  userPersistKey: 'ihui-auth-user',
})

/**
 * zustand bound hook(组件用 useAuthStore(selector) 订阅)
 *
 * @example
 * ```tsx
 * const user = useAuthStore((s) => s.user)
 * const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
 * const ready = useAuthStore((s) => s.ready)
 * ```
 */
export const { useAuthStore } = rnAuthStore

/**
 * 启动时从 tokenStore 同步镜像到 store
 *
 * 应在 AuthProvider 初始化(initApi)之后调用,确保 cachedToken 已就绪。
 * 若用户已登录,本函数会同步 token/refreshToken/isAuthenticated 到 store,
 * 让 zustand 订阅者(非 AuthContext 消费者)能立刻拿到认证态。
 *
 * user 信息由 zustand persist 中间件自动从 AsyncStorage 恢复,
 * 无需在此处手动加载。
 */
export function hydrateAuth(): void {
  rnAuthStore.hydrate()
  rnAuthStore.getState().setReady(true)
}

/**
 * 登出辅助函数
 *
 * 流程:store.logout() → tokenStore.clearAll() → 清本地镜像 + 清 user 持久化。
 * 与 AuthContext.logout 同语义,但走 zustand 通道,不依赖 React Context。
 * 业务侧 logout API(如后端 revoke refresh_token)由创建 store 时注入的 onLogout 处理。
 */
export async function logoutAuth(): Promise<void> {
  await rnAuthStore.getState().logout()
}

/** 透传 AuthUser 类型,方便业务方 import 时不绕道 @ihui/api-client */
export type { AuthUser }
