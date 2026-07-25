/**
 * @ihui/extension/stores/auth-store — extension 端共享 zustand auth store(2026-07-25 立)
 *
 * 接入示例(在 React 组件中):
 * ```tsx
 * import { useAuthStore, hydrateAuth, extAuthStore } from './stores/auth-store'
 *
 * // 组件挂载时(比如 App.tsx)同步 token 镜像 + 拉起 zustand persist rehydrate
 * useEffect(() => {
 *   hydrateAuth()
 * }, [])
 *
 * // 登录成功后写入认证态(同步 tokenStore + 镜像本地)
 * await extAuthStore.useAuthStore.getState().setAuth({
 *   token: 'xxx',
 *   refreshToken: 'yyy',
 *   expiresIn: 3600,
 *   user: { id: 'u1', nickname: 'alice' },
 * })
 *
 * // 订阅 isAuthenticated(替代 useAuth hook 的派生)
 * const isAuthed = useAuthStore((s) => s.isAuthenticated)
 * const user = useAuthStore((s) => s.user)
 * ```
 *
 * 设计原则:
 * 1. **非破坏性**:不替换 lib/token.ts 的 tokenStore,只在其之上叠加
 *    zustand 共享 store 的镜像与 user 持久化。tokenStore 是真值源,
 *    auth store 是 React 订阅层(避免双源不一致)。
 * 2. **安全**:token/refreshToken/expiresIn 一律不持久化到 chrome.storage,
 *    只持久化 user + isAuthenticated。token 仍由 tokenStore 走
 *    chrome.storage.local 的 TOKEN_STORAGE_KEY 等三个 key 管理。
 * 3. **依赖注入**:tokenStore 从 lib/token 导入,userTransport 用本端
 *    chrome.storage.local 包装,所有 IO 边界明确。
 * 4. **跨上下文同步**:zustand persist 写入的 user 字段,在 background /
 *    popup / sidepanel 三个上下文自动通过 chrome.storage.local 共享
 *    (与 tokenStore 的 onChanged 监听机制一致)。
 *
 * 与已有 useAuth hook(stage 4 落地)的关系:
 * - useAuth hook:hook 层(组件级 useState + useEffect),适合"用一次创建一次"
 * - 本 store:全局 zustand + persist,适合"跨组件订阅同一份状态"
 * - 二者底层共享同一 tokenStore 数据源,可共存(本 store 不破坏 hook)
 *
 * 后续迁移路径:
 * - 阶段 A(本任务):新增本 store + 适配器,旧 hook 不动
 * - 阶段 B:逐步把 entrypoints 组件从 useAuth 迁移到 useAuthStore
 * - 阶段 C:删除 useAuth hook 调用,完全统一
 *
 * 前置依赖:
 * - packages/shared/src/stores/auth-store.ts(createAuthStore 工厂)
 * - apps/extension/lib/token.ts(tokenStore 契约实现)
 * - 本目录 storage-adapter.ts(chrome.storage.local transport)
 */

import { createAuthStore, type AuthStoreState } from '@ihui/shared/stores'
import type { AuthUser } from '@ihui/api-client'
import { tokenStore } from '../../lib/token'
import { createChromeStorageTransport } from './storage-adapter'

/**
 * 创建 chrome.storage.local transport(供 createAuthStore 注入 user 持久化)
 *
 * 持久化 key 使用默认 'ihui-auth-user',与 web 端保持一致(便于跨端排查)。
 * token / refreshToken / expiresIn 由 partialize 过滤,不会落盘。
 */
const userTransport = createChromeStorageTransport()

/**
 * extension 端共享 zustand auth store 实例
 *
 * 导出形式:
 * - extAuthStore:完整 CreatedAuthStore(useAuthStore / getState / setState / subscribe / hydrate)
 * - useAuthStore:绑定的 zustand hook(组件用 useAuthStore(selector) 订阅)
 * - hydrateAuth:从 tokenStore 同步 token 镜像 + 触发 rehydrate(初始化时调用)
 * - logoutAuth:登出辅助(调 extAuthStore 的 logout + 任何扩展清理)
 */
export const extAuthStore = createAuthStore<AuthUser>({
  tokenStore,
  userTransport,
  userPersistKey: 'ihui-auth-user',
  onLogout: () => {
    // 登出后停止 token 自动刷新任务(避免登出态继续发 refresh 请求)
    void import('../../lib/token-utils').then(({ stopAutoRefresh }) => {
      stopAutoRefresh()
    })
  },
})

/** zustand 绑定 hook,组件用 useAuthStore(selector) 订阅 */
export const useAuthStore = extAuthStore.useAuthStore

/**
 * 从 tokenStore 同步 token/refreshToken 镜像到 zustand store
 *
 * 适用场景:
 * - App 启动时:背景脚本先 initApi() 加载 token 到 cachedToken,此时调一次
 *   hydrateAuth 让 zustand store 拿到正确的 isAuthenticated 镜像
 * - chrome.storage.onChanged 触发:lib/token.ts 已自动更新 cachedToken,
 *   但 zustand store 的镜像不会自动变;本函数在 onChanged 回调里再调一次即可
 * - 跨上下文同步:sidepanel 打开时如需拉取最新 token 状态,调一次 hydrateAuth
 *
 * 注意:此函数只同步 token 镜像,user 字段由 zustand persist 自动从
 * chrome.storage.local 的 'ihui-auth-user' 键 rehydrate。
 */
export function hydrateAuth(): void {
  extAuthStore.hydrate()
  extAuthStore.useAuthStore.getState().setReady(true)
}

/**
 * 登出辅助函数
 *
 * 行为:
 * 1. 调 extAuthStore 的 logout:清 tokenStore + 清 zustand 本地镜像 + 清 user
 * 2. onLogout 钩子:停止 token 自动刷新任务(由 createAuthStore options 注入)
 *
 * 业务侧如有"调后端 logout API + 跳转到登录页"等扩展需求,
 * 建议在调用方包裹(避免本文件依赖具体后端 API)。
 */
export async function logoutAuth(): Promise<void> {
  await extAuthStore.useAuthStore.getState().logout()
}

/**
 * 便捷类型 re-export(供业务方引用)
 */
export type { AuthStoreState }
