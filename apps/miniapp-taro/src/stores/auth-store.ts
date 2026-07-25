/**
 * @ihui/miniapp-taro/stores/auth-store — miniapp-taro 端共享 Auth zustand store
 *
 * 接入示例(组件订阅 + 登录/登出):
 * ```ts
 * import { useAuthStore, hydrateAuth, logoutAuth, taroAuthStore } from '@/stores/auth-store'
 *
 * // 1. App 启动时调用一次 hydrateAuth(从 tokenStore 同步镜像到 zustand)
 * useEffect(() => { hydrateAuth() }, [])
 *
 * // 2. 组件订阅 isAuthenticated
 * const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
 *
 * // 3. 登录后调 setAuth(token + user)
 * const { setAuth } = useAuthStore.getState()
 * await setAuth({ token, refreshToken, expiresIn, user: loginResult.user })
 *
 * // 4. 登出
 * await logoutAuth()
 * ```
 *
 * 设计原则(2026-07-25 立):
 * 1. 非破坏性接入:不替换现有 utils/auth.ts 的 tokenStore,只是新增一份
 *    taroSharedAuthStore(taroAuthStore)作为 zustand 桥接层,与现有
 *    useUserStore(stores/user.ts)平行存在,允许业务逐步迁移。
 * 2. 复用 @ihui/shared/stores/createAuthStore:本端只做"依赖注入"——
 *    注入 tokenStore(来自 utils/auth.ts)+ userTransport(来自
 *    storage-adapter.ts 包装的 Taro.storage),所有 store 逻辑由共享层负责。
 * 3. 安全优先:token / refreshToken / expiresIn 一律不落盘,只持久化
 *    user + isAuthenticated(与 web 端 2026-07-21 安全审计结论一致)。
 * 4. 类型对齐:TUser 泛型使用本端 UserInfo(modules 字段、可选 id 等
 *    miniapp-taro 特有扩展),不强制对齐 AuthUser,避免编译期类型噪声。
 *
 * 与现有实现的差异:
 * - utils/auth.ts:命令式 tokenStore(getToken/setToken/...),无 React 订阅
 * - stores/user.ts(useUserStore):基于 tokenStore 包装的 zustand,组件级订阅
 *   (但无 zustand persist,user 走 tokenStore.setUserInfo 间接落盘)
 * - **本模块(taroSharedAuthStore / taroAuthStore)**:
 *   跨端共享的 zustand + persist(独立 'ihui-auth-user' key),不污染
 *   tokenStore 的 'ihui_user_info' key,适合后续跨端统一认证层收敛
 *
 * 与现有 user 持久化的关系:
 * - 'ihui_user_info' key(由 tokenStore.setUserInfo 写入):保留 useUserStore 链路
 * - 'ihui-auth-user' key(由 taroAuthStore userTransport 写入):新增链路
 * 两 key 互不干扰,各自维护自己的副本;后续迁移完成可废弃 'ihui_user_info'。
 */

import { createAuthStore } from '@ihui/shared/stores'
import { tokenStore } from '../utils/auth'
import type { UserInfo } from '../utils/auth'
import { createTaroStorageTransport } from './storage-adapter'

/** miniapp-taro 端 user 持久化 transport(包装 Taro.storage)*/
const userTransport = createTaroStorageTransport()

/**
 * miniapp-taro 端共享 Auth zustand store 实例
 *
 * - tokenStore:本端 utils/auth.ts 中的 tokenStore(已遵守 TokenStore 契约)
 * - userTransport:Taro.storage 包装的 PersistTransport(独立 'ihui-auth-user' key)
 * - TUser:UserInfo(本端扩展类型,含可选 id/isVip/uuid/userName/realName 等)
 */
export const taroAuthStore = createAuthStore<UserInfo>({
  tokenStore,
  userTransport,
})

/** 组件订阅 hook(由 zustand bound store 暴露)*/
export const useAuthStore = taroAuthStore.useAuthStore

/**
 * 从 tokenStore 同步镜像到 zustand
 *
 * 适用场景:
 * - App 启动时(确保 zustand 镜像与 tokenStore 实际值对齐)
 * - tokenStore 写值后(本端 tokenStore 同步写入 Taro.storage,但 zustand
 *   镜像不会自动感知,需主动调 hydrate 同步)
 *
 * @example
 * ```ts
 * useEffect(() => { hydrateAuth() }, [])
 * ```
 */
export function hydrateAuth(): void {
  taroAuthStore.hydrate()
  // 标记 ready,供组件用 useAuthStore((s) => s.ready) 判定首帧渲染
  taroAuthStore.setReady(true)
}

/**
 * 登出辅助函数(清 tokenStore + 清 zustand 镜像 + 清 user)
 *
 * 不调后端 logout API(由业务侧在 onLogout 钩子中注入),本函数只负责本地清理。
 * 如需调后端,可在调用本函数前先 await api.logout(refreshToken)。
 *
 * @example
 * ```ts
 * await api.logout(refreshToken) // 可选:业务侧后端登出
 * await logoutAuth() // 必选:本地清理
 * ```
 */
export async function logoutAuth(): Promise<void> {
  await taroAuthStore.getState().logout()
}
