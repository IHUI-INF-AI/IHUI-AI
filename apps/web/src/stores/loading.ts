import { create } from 'zustand'

interface LoadingState {
  /** 全局加载计数器，> 0 表示有进行中加载 */
  count: number
  /** 全局加载态（count > 0 时为 true） */
  isLoading: boolean
  /** 加载提示文案 */
  tip: string | null
  start: (tip?: string) => void
  stop: () => void
  setTip: (tip: string | null) => void
  reset: () => void
}

/** 全局加载状态 Store，基于引用计数管理全局 loading（多请求并发安全） */
export const useLoadingStore = create<LoadingState>((set) => ({
  count: 0,
  isLoading: false,
  tip: null,

  start: (tip) =>
    set((s) => ({
      count: s.count + 1,
      isLoading: true,
      tip: tip ?? s.tip,
    })),

  stop: () =>
    set((s) => {
      const count = Math.max(0, s.count - 1)
      return {
        count,
        isLoading: count > 0,
        tip: count > 0 ? s.tip : null,
      }
    }),

  setTip: (tip) => set({ tip }),

  reset: () => set({ count: 0, isLoading: false, tip: null }),
}))
