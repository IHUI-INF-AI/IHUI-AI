/**
 * @ihui/shared/hooks/use-auth — 跨端共享 Auth Hook(2026-07-25 立)
 *
 * 设计原则:
 * 1. 依赖注入:各端必须传入 TokenStore 实现(不内置存储逻辑)
 * 2. 零新依赖:纯 useState + useEffect,不引入 zustand(兼容 extension MV3 / mobile-rn Hermes)
 * 3. 非破坏性:与各端现有 auth store 平行存在,可通过 re-export 桥接(参考 date-utils 模式)
 * 4. 泛型 TUser:兼容 miniapp-taro 的 UserInfo 扩展(默认 AuthUser)
 *
 * 各端接入示例:
 * - mobile-rn: useAuth({ store: rnTokenStore, bindTransport: bindTokenStoreToApiClient })
 * - extension: useAuth({ store: extTokenStore, bindTransport: bindTokenStoreToApiClient, fetchProfile: getProfile })
 * - web: 桥接版,内部订阅 useAuthStore,对外接口与本 hook 一致(保留 getState() 能力)
 * - miniapp-taro: useAuth<UserInfo>({ store: taroTokenStore })
 *
 * 前置依赖:packages/shared/src/auth/token-store.ts(已存在,提供 TokenStore 接口)
 */

import { useCallback, useEffect, useState } from 'react'
import type { AuthUser } from '@ihui/api-client'
import type { TokenStore } from '../auth/token-store'

export interface UseAuthOptions<TUser = AuthUser> {
  /** 各端注入自己的 TokenStore 实现(必须) */
  store: TokenStore
  /**
   * transport 注入函数,默认不注入(各端可传 bindTokenStoreToApiClient)。
   * web 端因 cookie 兜底需自定义 provider(参考 cookie-utils.ts getAuthCookie)
   */
  bindTransport?: (store: TokenStore) => void
  /** 登录后获取用户 profile 的函数(各端可复用 @ihui/api-client getProfile) */
  fetchProfile?: () => Promise<{ success: boolean; data?: TUser; error?: string }>
  /** 登出时调用的后端 API(默认不调,各端按需注入) */
  logoutApi?: (refreshToken: string) => Promise<void>
  /** 是否在 hook 挂载时自动 bind transport,默认 true */
  autoBind?: boolean
}

export interface UseAuthReturn<TUser = AuthUser> {
  /** 当前用户信息(null 表示未登录或未加载) */
  user: TUser | null
  /** 当前 access token(从 store 同步读取,React state 仅用于触发重渲染) */
  token: string | null
  /** 当前 refresh token */
  refreshToken: string | null
  /** 是否已认证(token 非空) */
  isAuthenticated: boolean
  /** hook 初始化完成(transport 已绑定),false 时 UI 可渲染 loading */
  ready: boolean
  /** 通用登录:写 token + 可选拉 profile */
  login: (token: string, refreshToken?: string, user?: TUser) => Promise<void>
  /** 通用登出:调后端 logout(可选)+ 清 store + 清 state */
  logout: () => Promise<void>
  /** 显式刷新 access token(各端可选实现,无实现时返回 false) */
  refresh: () => Promise<boolean>
  /** 直接更新 user(供 profile 接口回填) */
  setUser: (user: TUser | null) => void
}

/**
 * 跨端共享 Auth Hook
 *
 * @example
 * ```ts
 * // mobile-rn 接入示例
 * const auth = useAuth({
 *   store: rnTokenStore,
 *   bindTransport: bindTokenStoreToApiClient,
 *   fetchProfile: async () => {
 *     const res = await getProfile()
 *     return { success: res.success, data: res.data }
 *   },
 * })
 * ```
 */
export function useAuth<TUser = AuthUser>(options: UseAuthOptions<TUser>): UseAuthReturn<TUser> {
  const { store, bindTransport, fetchProfile, logoutApi, autoBind = true } = options

  // user 独立管理(不放入 store,因各端 user 持久化策略不同)
  const [user, setUser] = useState<TUser | null>(null)
  // token state 仅用于触发 React 重渲染(真值从 store 同步读取)
  const [tokenVersion, setTokenVersion] = useState(0)
  const [ready, setReady] = useState(false)

  // 挂载时绑定 transport
  useEffect(() => {
    if (autoBind && bindTransport) {
      bindTransport(store)
    }
    setReady(true)
  }, [store, bindTransport, autoBind])

  // 从 store 同步读取 token(内存缓存,无 async)
  const token = store.getToken()
  const refreshToken = store.getRefreshToken()
  // tokenVersion 仅用于触发 React 重渲染(setTokenVersion 在 login/logout 中调用)
  // void 显式消费,避免"未使用变量"警告
  void tokenVersion
  const isAuthenticated = !!token

  const login = useCallback(
    async (newToken: string, newRefreshToken?: string, newUser?: TUser) => {
      await store.setToken(newToken)
      if (newRefreshToken !== undefined) {
        await store.setRefreshToken(newRefreshToken)
      }
      setTokenVersion((v) => v + 1)

      if (newUser) {
        setUser(newUser)
      } else if (fetchProfile) {
        const res = await fetchProfile()
        if (res.success && res.data) {
          setUser(res.data)
        }
      }
    },
    [store, fetchProfile],
  )

  const logout = useCallback(async () => {
    const rt = store.getRefreshToken()
    if (logoutApi && rt) {
      try {
        await logoutApi(rt)
      } catch {
        // 后端 logout 失败不阻塞本地清理
      }
    }
    await store.clearAll?.()
    setUser(null)
    setTokenVersion((v) => v + 1)
  }, [store, logoutApi])

  const refresh = useCallback(async (): Promise<boolean> => {
    // 默认不实现,各端按需注入 refresh 逻辑
    // web/extension 可通过 useCallback 闭包注入 chrome.alarms / cookie refresh
    return false
  }, [])

  return {
    user,
    token,
    refreshToken,
    isAuthenticated,
    ready,
    login,
    logout,
    refresh,
    setUser,
  }
}
