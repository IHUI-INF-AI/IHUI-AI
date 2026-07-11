import { create } from 'zustand'

import { getMembershipInfo, getPoints, type MembershipInfo, type PointsInfo } from '@/lib/vip-api'

interface AuthVipState {
  membership: MembershipInfo | null
  points: PointsInfo | null
  loading: boolean
  error: string | null
  setMembership: (membership: MembershipInfo | null) => void
  setPoints: (points: PointsInfo | null) => void
  fetchMembership: () => Promise<void>
  fetchPoints: () => Promise<void>
}

/** VIP 状态 Store，存储会员信息与积分余额 */
export const useAuthVipStore = create<AuthVipState>((set) => ({
  membership: null,
  points: null,
  loading: false,
  error: null,

  setMembership: (membership) => set({ membership }),

  setPoints: (points) => set({ points }),

  fetchMembership: async () => {
    set({ loading: true, error: null })
    const res = await getMembershipInfo()
    if (!res.success) {
      set({ loading: false, error: res.error })
      return
    }
    set({ membership: res.data, loading: false })
  },

  fetchPoints: async () => {
    const res = await getPoints()
    if (res.success) {
      set({ points: res.data })
    }
  },
}))
