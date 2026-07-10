import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import { getAgents, type Agent } from '@/lib/agent-api'

interface AgentState {
  agents: Agent[]
  currentAgent: Agent | null
  favorites: string[]
  loading: boolean
  error: string | null
  setAgents: (agents: Agent[]) => void
  setCurrentAgent: (agent: Agent | null) => void
  toggleFavorite: (id: string) => void
  fetchAgents: () => Promise<void>
}

/** SSR 安全的 localStorage 替代存储 */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set) => ({
      agents: [],
      currentAgent: null,
      favorites: [],
      loading: false,
      error: null,

      setAgents: (agents) => set({ agents }),

      setCurrentAgent: (currentAgent) => set({ currentAgent }),

      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((f) => f !== id)
            : [...s.favorites, id],
        })),

      fetchAgents: async () => {
        set({ loading: true, error: null })
        const res = await getAgents({ pageSize: 100 })
        if (!res.success) {
          set({ loading: false, error: res.error })
          return
        }
        set({ agents: res.data.list, loading: false })
      },
    }),
    {
      name: 'ihui-agent-favorites',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : noopStorage,
      ),
      partialize: (s) => ({ favorites: s.favorites }),
    },
  ),
)
