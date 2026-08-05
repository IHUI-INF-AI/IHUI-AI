import { create } from 'zustand'

interface NavigationState {
  /** 导航是否正在进行中 */
  pending: boolean
  /** 标记导航开始（点击链接时立即触发） */
  start: () => void
  /** 标记导航结束（新页面渲染完成后触发） */
  end: () => void
}

export const useNavigationStore = create<NavigationState>((set) => ({
  pending: false,
  start: () => set({ pending: true }),
  end: () => set({ pending: false }),
}))