import { create } from 'zustand'

import { getMyMemberInfo, getMemberLevels, type Member, type MemberLevel } from '@/lib/learn-api'

interface EduMemberState {
  member: Member | null
  levels: MemberLevel[]
  loading: boolean
  error: string | null
  setMember: (member: Member | null) => void
  setLevels: (levels: MemberLevel[]) => void
  fetchMember: () => Promise<void>
  fetchLevels: () => Promise<void>
}

/** 教育-会员 Store，管理当前会员信息与会员等级列表 */
export const useEduMemberStore = create<EduMemberState>((set) => ({
  member: null,
  levels: [],
  loading: false,
  error: null,

  setMember: (member) => set({ member }),
  setLevels: (levels) => set({ levels }),

  fetchMember: async () => {
    set({ loading: true, error: null })
    const res = await getMyMemberInfo()
    if (!res.success) {
      set({ loading: false, error: res.error })
      return
    }
    set({ member: res.data, loading: false })
  },

  fetchLevels: async () => {
    const res = await getMemberLevels()
    if (res.success) {
      set({ levels: res.data })
    }
  },
}))
