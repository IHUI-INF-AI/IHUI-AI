import { create } from 'zustand'

import {
  getOverview,
  type CommissionOverview,
  type InvitedUser,
  type CommissionRecord,
  type CommissionRanking,
} from '@/lib/distribution-api'

/** 分销概览（复用 distribution-api 的 CommissionOverview） */
export type DistributionOverview = CommissionOverview
/** 排行榜用户（复用 distribution-api 的 CommissionRanking） */
export type RankUser = CommissionRanking

interface DistributionState {
  overview: DistributionOverview | null
  invitedUsers: InvitedUser[]
  commissionList: CommissionRecord[]
  ranking: RankUser[]
  loading: boolean
  error: string | null
  setOverview: (overview: DistributionOverview | null) => void
  setInvitedUsers: (users: InvitedUser[]) => void
  setCommissionList: (list: CommissionRecord[]) => void
  setRanking: (ranking: RankUser[]) => void
  fetchOverview: () => Promise<void>
}

export const useDistributionStore = create<DistributionState>((set) => ({
  overview: null,
  invitedUsers: [],
  commissionList: [],
  ranking: [],
  loading: false,
  error: null,

  setOverview: (overview) => set({ overview }),

  setInvitedUsers: (invitedUsers) => set({ invitedUsers }),

  setCommissionList: (commissionList) => set({ commissionList }),

  setRanking: (ranking) => set({ ranking }),

  fetchOverview: async () => {
    set({ loading: true, error: null })
    const res = await getOverview()
    if (!res.success) {
      set({ loading: false, error: res.error })
      return
    }
    set({ overview: res.data, loading: false })
  },
}))
