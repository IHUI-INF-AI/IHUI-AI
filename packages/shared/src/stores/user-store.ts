/**
 * @ihui/shared/stores/user-store — 跨端共享 User zustand 工厂
 *
 * 设计原则(2026-07-25 立):
 * 1. 泛型 TProfile:各端注入自己的用户信息类型(web: UserProfile + UserStatistics / miniapp-taro: UserInfo / RN: AuthUser)
 * 2. 纯逻辑层:只管 profile 状态,fetchProfile 等 API 调用由各端在 useEffect 中自行注入
 *    原因:shared 包不应依赖 @ihui/api-client 之外的端特定 API
 * 3. 依赖注入:transport 由各端注入(localStorage / AsyncStorage / Taro.storage / chrome.storage)
 * 4. 可选持久化:不传 transport 时 profile 仅存内存
 *
 * 与 useUserStore(各端现有)的差异:
 * - 现有 useUserStore:耦合 fetchProfile 等端特定 API
 * - createUserStore:只管 profile CRUD,各端在 useEffect 中调用 fetchProfile 后 setProfile
 *
 * 各端接入示例:
 * - web: createUserStore<UserProfile>({ transport: localStorageTransport, persistKey: 'ihui-user' })
 *        useEffect(() => { fetchProfile().then(p => setProfile(p)) }, [])
 * - mobile-rn: 同上,transport 用 AsyncStorage
 */

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { PersistTransport } from './transport'

export interface UserStoreState<TProfile> {
  /** 用户 profile(主信息) */
  profile: TProfile | null
  /** 加载状态(由调用方控制,store 仅镜像) */
  loading: boolean
  /** 错误信息(由调用方控制,store 仅镜像) */
  error: string | null
  /** 设置 profile(全量替换) */
  setProfile: (profile: TProfile | null) => void
  /** 增量更新 profile(浅合并) */
  updateProfile: (patch: Partial<TProfile>) => void
  /** 设置 loading 标志 */
  setLoading: (loading: boolean) => void
  /** 设置 error 信息 */
  setError: (error: string | null) => void
  /** 重置 store(清 profile/loading/error,持久化数据也清) */
  reset: () => void
}

export interface CreateUserStoreOptions<TProfile> {
  /** 持久化 transport(可选,不传则不持久化) */
  transport?: PersistTransport
  /** storage key,默认 'ihui-user' */
  persistKey?: string
  /** 自定义 partialize(过滤敏感字段) */
  partialize?: (state: UserStoreState<TProfile>) => Partial<UserStoreState<TProfile>>
  /** persist schema version,默认 1(数据迁移用) */
  version?: number
}

export interface CreatedUserStore<TProfile> {
  useUserStore: UseBoundStore<StoreApi<UserStoreState<TProfile>>>
  getState: () => UserStoreState<TProfile>
  setState: StoreApi<UserStoreState<TProfile>>['setState']
  subscribe: StoreApi<UserStoreState<TProfile>>['subscribe']
  /** 重置 store + 清理持久化 */
  reset: () => void
}

export function createUserStore<TProfile>(
  options: CreateUserStoreOptions<TProfile> = {},
): CreatedUserStore<TProfile> {
  const { transport, persistKey = 'ihui-user', partialize, version = 1 } = options

  const persistStorage: StateStorage = {
    getItem: async (name) => {
      if (!transport) return null
      return transport.getItem(name)
    },
    setItem: async (name, value) => {
      if (!transport) return
      await transport.setItem(name, value)
    },
    removeItem: async (name) => {
      if (!transport) return
      await transport.removeItem(name)
    },
  }

  const initialState: UserStoreState<TProfile> = {
    profile: null,
    loading: false,
    error: null,
    setProfile: (profile) => {
      useStore.setState({ profile })
    },
    updateProfile: (patch) => {
      useStore.setState((s) =>
        s.profile ? { profile: { ...s.profile, ...patch } } : s,
      )
    },
    setLoading: (loading) => {
      useStore.setState({ loading })
    },
    setError: (error) => {
      useStore.setState({ error })
    },
    reset: () => {
      useStore.setState({ profile: null, loading: false, error: null })
    },
  }

  const useStore = create<UserStoreState<TProfile>>()(
    persist(() => initialState, {
      name: persistKey,
      storage: createJSONStorage(() => persistStorage),
      ...(partialize
        ? { partialize: partialize as (state: UserStoreState<TProfile>) => Partial<UserStoreState<TProfile>> }
        : {}),
      ...(version !== undefined ? { version } : {}),
    }),
  )

  return {
    useUserStore: useStore,
    getState: useStore.getState,
    setState: useStore.setState,
    subscribe: useStore.subscribe,
    reset: () => {
      useStore.setState({ profile: null, loading: false, error: null })
    },
  }
}
