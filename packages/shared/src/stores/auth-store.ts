// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @ihui/shared/stores/auth-store — 跨端共享 Auth zustand 工厂
 *
 * 设计原则(2026-07-25 立;2026-09-28 收口 isAuthenticated):
 * 1. 零新概念:复用已有 TokenStore 契约(stage 1-3 已落地),auth store 仅镜像状态供 React 订阅
 * 2. 依赖注入:tokenStore(必传)+ userTransport(可选,用于 user 持久化)由各端注入
 * 3. 非破坏性:与 useAuth hook(stage 4 落地)平行存在,组件可任选;后续阶段可桥接
 * 4. 安全优先:token/refreshToken/expiresIn 一律不持久化(走 tokenStore),持久化块只落 user。
 *    遵循 web 端 2026-07-21 安全审计结论:localStorage 不可存 token,httpOnly cookie 才是正解
 * 5. 单一真相:登录态只由 token 决定。isAuthenticated 是 token !== null 的派生投影 ——
 *    写入面上任何 setState 携带的 isAuthenticated 一律被忽略并重算,持久化面上该键不落盘、
 *    rehydrate 时读回即剥除(旧 storage 块里的残留键被 merge 忽略,不产生"无 token 却
 *    isAuthenticated=true"的组合)。第二份真相只会漂移,这是本仓记过最多次的失效型。
 *
 * 与 useAuth hook(stage 4)的差异:
 * - useAuth:hook 层(组件级 useState + useEffect),适合"用一次创建一次"的场景
 * - createAuthStore:store 层(全局 zustand + persist),适合"跨组件订阅同一份状态"的场景
 * - 二者底层都依赖同一 TokenStore,数据源一致
 *
 * 各端接入示例:
 * - web: createAuthStore({ tokenStore: webTokenStore, userTransport: localStorageTransport })
 * - mobile-rn: createAuthStore({ tokenStore: rnTokenStore, userTransport: asyncStorageTransport })
 * - miniapp-taro: createAuthStore({ tokenStore: taroTokenStore, userTransport: taroStorageTransport })
 * - extension: createAuthStore({ tokenStore: extTokenStore, userTransport: chromeStorageTransport })
 *
 * 前置依赖:packages/shared/src/auth/token-store.ts(已存在)
 */

/**
 * 修复说明(2026-07-26 立,Taro Vite 归并 bug):
 * Taro 4.2.0 Vite runner 把 `import { create } from 'zustand'` 错误归并为
 * `taro.react_production_min.create`(React 上无此函数),导致 miniapp-taro 运行时抛
 * `TypeError: taro.react_production_min.create is not a function`。
 *
 * 修复方案:用 `createStore` from 'zustand/vanilla' + `useStore` from 'zustand/react'
 * 替换 `create` from 'zustand'。`createStore` 不依赖 React(可被 Vite 正确打包),
 * `useStore` 用 `React.useSyncExternalStore`(在 Taro 中存在)。
 *
 * 注意:导出的 useAuthStore 仍保持原 UseBoundStore 类型签名,既可作 hook 调用
 * (useAuthStore((s) => s.user) 或 useAuthStore()),又可访问 .getState()/.setState()/.subscribe()。
 */

import { createStore, type StoreApi } from 'zustand/vanilla'
import { useStore, type UseBoundStore } from 'zustand/react'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { AuthUser } from '@ihui/api-client'
import type { TokenStore } from '../auth/token-store'
import type { PersistTransport } from './transport'

export interface AuthStoreState<TUser = AuthUser> {
  /** access token(镜像自 tokenStore,仅供 React 订阅,真值在 tokenStore) */
  token: string | null
  /** refresh token(镜像自 tokenStore) */
  refreshToken: string | null
  /** token 过期时间(秒),镜像自 tokenStore */
  expiresIn: number | null
  /**
   * 派生只读:恒等于 `token !== null`(见 selectIsAuthenticated)。
   * 保留在 state 形状里只为兼容既有订阅写法;它不是独立开关 ——
   * setState 传入该键会被忽略并按 token 重算,持久化块也不携带它。
   */
  isAuthenticated: boolean
  /** 当前用户信息(可持久化) */
  user: TUser | null
  /** hydrate 是否完成(用于避免首屏渲染时 user 闪烁) */
  ready: boolean
  /**
   * 设置完整认证态(写 tokenStore + 镜像本地)
   *
   * @param input 至少需要 token,其他字段可选
   */
  setAuth: (input: {
    token: string
    refreshToken?: string | null
    expiresIn?: number | null
    user?: TUser | null
  }) => Promise<void>
  /** 仅更新 user 字段(不触发 tokenStore 写入) */
  setUser: (user: TUser | null) => void
  /**
   * 登出(调 tokenStore.clearAll + 清本地镜像 + 清 user)
   * 业务侧 logout API 注入由 onLogout 钩子处理
   */
  logout: () => Promise<void>
  /**
   * 从 tokenStore 同步读取 token/refreshToken/expiresIn 并更新本地镜像
   * 初始化时(hydrate 前)由 useAuthStore 调用,后续 tokenStore 变化时各端订阅 chrome.storage.onChanged 等
   */
  hydrate: () => void
  /** 标记 ready(true),用于 SSR 后客户端首帧渲染 */
  setReady: (ready: boolean) => void
}

/**
 * 登录态的唯一判据选择器:isAuthenticated 就是 `token !== null` 的投影。
 * 新代码优先用它订阅(不依赖 state 上那个派生字段),
 * 全仓不得再出现第二处"算 isAuthenticated"的实现。
 */
export function selectIsAuthenticated<TUser = AuthUser>(
  state: Pick<AuthStoreState<TUser>, 'token'>,
): boolean {
  return state.token !== null
}

export interface CreateAuthStoreOptions<TUser = AuthUser> {
  /** 必传:各端 token 存储实现(已遵守 TokenStore 契约) */
  tokenStore: TokenStore
  /**
   * 可选:user 持久化 transport
   * 不传则 user 仅存内存(SSR / 测试 / 不需跨会话恢复的场景)
   */
  userTransport?: PersistTransport
  /** user 持久化的 storage key,默认 'ihui-auth-user' */
  userPersistKey?: string
  /**
   * user 持久化 partialize(过滤掉非序列化字段)
   * 默认全量持久化
   */
  userPartialize?: (user: TUser | null) => Partial<TUser> | null
  /** 登录成功钩子(写完 tokenStore 后调用) */
  onLogin?: (user: TUser | null) => void | Promise<void>
  /** 登出钩子(清完 tokenStore 后调用) */
  onLogout?: () => void | Promise<void>
}

export interface CreatedAuthStore<TUser = AuthUser> {
  /** zustand bound hook(组件用 useAuthStore(selector) 订阅) */
  useAuthStore: UseBoundStore<StoreApi<AuthStoreState<TUser>>>
  /** 直接读 state(命令式 / 测试用) */
  getState: () => AuthStoreState<TUser>
  /** 直接写 state(命令式 / 测试用) */
  setState: StoreApi<AuthStoreState<TUser>>['setState']
  /** 订阅 state 变化 */
  subscribe: StoreApi<AuthStoreState<TUser>>['subscribe']
  /** 从 tokenStore 同步镜像(初始化 / chrome.storage.onChanged 等场景调用) */
  hydrate: () => void
}

/**
 * 创建跨端 Auth zustand store
 *
 * @example
 * ```ts
 * // web 端
 * const auth = createAuthStore({
 *   tokenStore: webTokenStore,
 *   userTransport: createSyncTransport({
 *     getItem: (k) => localStorage.getItem(k),
 *     setItem: (k, v) => localStorage.setItem(k, v),
 *     removeItem: (k) => localStorage.removeItem(k),
 *   }),
 * })
 *
 * // 组件订阅
 * const isAuthenticated = auth.useAuthStore(selectIsAuthenticated)
 * ```
 */
export function createAuthStore<TUser = AuthUser>(
  options: CreateAuthStoreOptions<TUser>,
): CreatedAuthStore<TUser> {
  const {
    tokenStore,
    userTransport,
    userPersistKey = 'ihui-auth-user',
    userPartialize,
    onLogin,
    onLogout,
  } = options

  // 包装 transport 为 zustand persist 需要的 StateStorage 接口(返回 raw string)
  // 注意:user persist 只存 user(security: 不存 token;单一真相: 不存 isAuthenticated)
  const persistStorage: StateStorage = {
    getItem: async (name) => {
      if (!userTransport) return null
      return userTransport.getItem(name)
    },
    setItem: async (name, value) => {
      if (!userTransport) return
      await userTransport.setItem(name, value)
    },
    removeItem: async (name) => {
      if (!userTransport) return
      await userTransport.removeItem(name)
    },
  }

  // 登录态派生的唯一落点:一切经本工厂的 state 写入都过这里,
  // patch 里携带的 isAuthenticated 一律被剥掉并按"结果的 token"重算。
  // 之所以包在 setState 层而不是各动作里各算一遍:两处算同一件事必漂移(本仓记过多次),
  // 外部调用方(如各端 reset)也不得拿到"独立翻转 isAuthenticated"的口子。
  const setStateDerived: StoreApi<AuthStoreState<TUser>>['setState'] = ((
    partial:
      | Partial<AuthStoreState<TUser>>
      | ((state: AuthStoreState<TUser>) => Partial<AuthStoreState<TUser>>),
    replace?: boolean,
  ) => {
    const patch = (
      typeof partial === 'function' ? partial(storeApi.getState()) : partial
    ) as Partial<AuthStoreState<TUser>> | undefined
    const { isAuthenticated: _ignored, ...rest } = patch ?? {}
    void _ignored
    const nextToken = 'token' in rest ? rest.token ?? null : replace ? null : storeApi.getState().token
    storeApi.setState(
      { ...rest, isAuthenticated: nextToken !== null } as Partial<AuthStoreState<TUser>>,
      replace as false | undefined,
    )
  }) as StoreApi<AuthStoreState<TUser>>['setState']

  // storeApi 在下方 createStore 调用后初始化,initialState 内的方法体在运行时
  // 才被调用(闭包延迟解析),故此处引用 storeApi 不会触发 TDZ。
  const initialState: AuthStoreState<TUser> = {
    token: null,
    refreshToken: null,
    expiresIn: null,
    isAuthenticated: false,
    user: null,
    ready: false,
    setAuth: async (input) => {
      await tokenStore.setToken(input.token)
      if (input.refreshToken !== undefined) {
        await tokenStore.setRefreshToken(input.refreshToken)
      }
      // 同步镜像;isAuthenticated 由 setStateDerived 按 token 派生,动作不再各自写它
      setStateDerived({
        token: input.token,
        refreshToken: input.refreshToken ?? storeApi.getState().refreshToken,
        expiresIn: input.expiresIn ?? storeApi.getState().expiresIn,
        user: input.user !== undefined ? input.user : storeApi.getState().user,
      })
      if (onLogin) {
        await onLogin(input.user !== undefined ? input.user : storeApi.getState().user)
      }
    },
    setUser: (user) => {
      setStateDerived({ user })
    },
    logout: async () => {
      await tokenStore.clearAll?.()
      setStateDerived({
        token: null,
        refreshToken: null,
        expiresIn: null,
        user: null,
      })
      if (onLogout) {
        await onLogout()
      }
    },
    hydrate: () => {
      const token = tokenStore.getToken()
      const refreshToken = tokenStore.getRefreshToken()
      setStateDerived({
        token,
        refreshToken,
        expiresIn: storeApi.getState().expiresIn,
      })
    },
    setReady: (ready) => {
      setStateDerived({ ready })
    },
  }

  // 用 createStore from 'zustand/vanilla' 替代 create from 'zustand'
  // createStore 不依赖 React,可被 Taro Vite runner 正确打包(详见文件顶部修复说明)
  const storeApi = createStore<AuthStoreState<TUser>>()(
    persist(() => initialState, {
      name: userPersistKey,
      storage: createJSONStorage(() => persistStorage),
      // 安全:仅持久化 user;token 一律不落盘(2026-07-21 审计),
      // isAuthenticated 不落盘(2026-09-28 收口:登录态第二份真相,派生自 token)
      partialize: (state) => {
        const persisted: Pick<AuthStoreState<TUser>, 'user'> = {
          user: state.user,
        }
        if (userPartialize && state.user) {
          const partial = userPartialize(state.user)
          if (partial) {
            persisted.user = { ...state.user, ...partial } as TUser
          }
        }
        return persisted
      },
      // 旧 storage 块(收口前写入的)里可能仍带 isAuthenticated —— 该键一律读回即剥除。
      // 不 bump version:version 变了而 migrate 缺失会让 zustand 整块丢弃,连带丢掉在用的 user;
      // merge 是逐键过滤,只挡第二份真相,不动任何端的历史数据。
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as { user?: TUser | null }
        const merged = {
          ...currentState,
          user: 'user' in persisted ? persisted.user ?? null : currentState.user,
        }
        return { ...merged, isAuthenticated: selectIsAuthenticated(merged) }
      },
      // SSR 友好:hydrate 完成后设置 ready
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.ready = true
        }
      },
      version: 1,
    }),
  )

  // 创建 bound hook:兼容原 UseBoundStore 类型签名
  // - 无参调用 useAuthStore() → 返回整个 state(useStore 的 selector 默认 identity)
  // - selector 调用 useAuthStore((s) => s.user) → 返回切片
  // - .getState()/.setState()/.subscribe() → 转发到 storeApi
  // storeApi 的方法基于闭包 state(非 this),作为引用赋值给 useBoundStore 后仍正确工作。
  // setState 走 setStateDerived:外部写入同样不能独立翻转 isAuthenticated(派生只读对整个面生效,
  // 否则"收口了工厂、放开了调用方"等于没收口)。
  const useBoundStore = Object.assign(
    function useAuthStoreHook<U>(selector?: (state: AuthStoreState<TUser>) => U): U {
      return useStore(storeApi, selector as (state: AuthStoreState<TUser>) => U)
    } as UseBoundStore<StoreApi<AuthStoreState<TUser>>>,
    {
      getState: storeApi.getState,
      setState: setStateDerived,
      subscribe: storeApi.subscribe,
    },
  )

  return {
    useAuthStore: useBoundStore,
    getState: storeApi.getState,
    setState: setStateDerived,
    subscribe: storeApi.subscribe,
    // 与 state.hydrate 同一实现:登录态派生只住在 setStateDerived 一处
    hydrate: () => {
      storeApi.getState().hydrate()
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
