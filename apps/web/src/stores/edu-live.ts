import { create } from 'zustand'

import { getLiveList, type Live } from '@/lib/live-api'

interface EduLiveState {
  lives: Live[]
  currentLive: Live | null
  loading: boolean
  error: string | null
  setLives: (lives: Live[]) => void
  setCurrentLive: (live: Live | null) => void
  fetchLives: (status?: string) => Promise<void>
}

/** 教育-直播 Store，管理直播列表与当前直播 */
export const useEduLiveStore = create<EduLiveState>((set) => ({
  lives: [],
  currentLive: null,
  loading: false,
  error: null,

  setLives: (lives) => set({ lives }),
  setCurrentLive: (currentLive) => set({ currentLive }),

  fetchLives: async (status) => {
    set({ loading: true, error: null })
    const res = await getLiveList({ pageSize: 100, ...(status ? { status } : {}) })
    if (!res.success) {
      set({ loading: false, error: res.error })
      return
    }
    set({ lives: res.data.list, loading: false })
  },
}))
