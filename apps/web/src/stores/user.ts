/**
 * user — web 端用户 store(2026-07-28 迁移至 @ihui/shared/stores 工厂)
 *
 * 迁移说明:
 * - 原 create<UserState>()(persist(...)) 手写实现 → createUserStore<UserProfile> 工厂
 * - 工厂提供:profile / loading / error / setProfile / updateProfile / setLoading / setError / reset
 * - 本地扩展(工厂不提供):statistics / following / followers / setStatistics / fetchProfile
 *   通过 setState 注入到 vanilla store,运行时与工厂字段共存
 * - 类型扩展:WebUserState extends UserStoreState<UserProfile>,通过 as unknown as UseBoundStore 暴露扩展字段
 * - 持久化保持与历史一致:profile + statistics + following + followers(partialize 覆盖工厂默认行为)
 * - 版本设为 0,与历史 localStorage 数据一致
 *
 * 调用方(use-auth-bootstrap / use-settings-user-info / use-user-auth)的 selector 用法不变:
 *   useUserStore((s) => s.profile) / useUserStore((s) => s.fetchProfile) 等均可用。
 */

import { createUserStore, type UserStoreState } from '@ihui/shared/stores'
import type { UseBoundStore } from 'zustand/react'
import type { StoreApi } from 'zustand/vanilla'
import { getProfile, type UserProfile, type UserStatistics } from '@ihui/api-client'
import { createSSRSafeWebTransport } from './storage-adapter'

interface WebUserState extends UserStoreState<UserProfile> {
  statistics: UserStatistics | null
  following: number
  followers: number
  setStatistics: (stats: UserStatistics | null) => void
  fetchProfile: () => Promise<void>
}

const userTransport = createSSRSafeWebTransport()

const createdStore = createUserStore<UserProfile>({
  transport: userTransport,
  persistKey: 'ihui-user',
  // 与历史 localStorage 数据一致(原 persist 未设 version,zustand 默认 0)
  version: 0,
  // 持久化字段与原实现一致:profile + statistics + following + followers
  // 工厂 partialize 类型只认 UserStoreState<UserProfile>,扩展字段通过 unknown 双重断言访问
  partialize: ((s: WebUserState) => ({
    profile: s.profile,
    statistics: s.statistics,
    following: s.following,
    followers: s.followers,
  })) as unknown as (s: UserStoreState<UserProfile>) => Partial<UserStoreState<UserProfile>>,
})

// 类型别名:接受扩展字段的 setState(工厂类型只认 UserStoreState<UserProfile>)
const setExtended = createdStore.setState as (
  partial: Partial<WebUserState> | ((s: WebUserState) => Partial<WebUserState>),
) => void

// 注入 web 端扩展状态与方法
setExtended({
  statistics: null,
  following: 0,
  followers: 0,
  setStatistics: (stats) => {
    if (stats) {
      setExtended({
        statistics: stats,
        following: stats.followingCount,
        followers: stats.fansCount,
      })
    } else {
      setExtended({ statistics: stats })
    }
  },
  fetchProfile: async () => {
    createdStore.setState({ loading: true, error: null })
    const res = await getProfile()
    if (!res.success) {
      createdStore.setState({ loading: false, error: res.error })
      return
    }
    // 后端 /api/auth/me 已补全 gender/birthday/createdAt 等字段,AuthUser 与 UserProfile 形状一致
    createdStore.setState({ profile: res.data as UserProfile, loading: false })
  },
})

export const useUserStore = createdStore.useUserStore as unknown as UseBoundStore<
  StoreApi<WebUserState>
>
