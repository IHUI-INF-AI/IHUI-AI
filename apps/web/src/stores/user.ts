import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { getProfile, type UserProfile, type UserStatistics } from '@/lib/user-api'
import { createPersistConfig } from './persist-helpers'

interface UserState {
  profile: UserProfile | null
  statistics: UserStatistics | null
  following: number
  followers: number
  loading: boolean
  error: string | null
  setProfile: (profile: UserProfile | null) => void
  updateProfile: (patch: Partial<UserProfile>) => void
  setStatistics: (stats: UserStatistics | null) => void
  fetchProfile: () => Promise<void>
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      profile: null,
      statistics: null,
      following: 0,
      followers: 0,
      loading: false,
      error: null,

      setProfile: (profile) => set({ profile }),

      updateProfile: (patch) =>
        set((s) => (s.profile ? { profile: { ...s.profile, ...patch } } : s)),

      setStatistics: (statistics) => {
        if (statistics) {
          set({ statistics, following: statistics.followingCount, followers: statistics.fansCount })
        } else {
          set({ statistics })
        }
      },

      fetchProfile: async () => {
        set({ loading: true, error: null })
        const res = await getProfile()
        if (!res.success) {
          set({ loading: false, error: res.error })
          return
        }
        set({ profile: res.data, loading: false })
      },
    }),
    createPersistConfig<UserState>('ihui-user', (s) => ({
      profile: s.profile,
      statistics: s.statistics,
      following: s.following,
      followers: s.followers,
    })),
  ),
)
