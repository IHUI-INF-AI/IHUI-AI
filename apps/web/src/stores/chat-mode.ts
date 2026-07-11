import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ChatMode = 'normal' | 'agent' | 'search' | 'translate'

interface ChatModeState {
  mode: ChatMode
  /** 是否处于全屏聊天模式 */
  fullscreen: boolean
  setMode: (mode: ChatMode) => void
  setFullscreen: (v: boolean) => void
  toggleFullscreen: () => void
}

/** 聊天模式 Store，管理聊天面板的交互模式与全屏态（持久化） */
export const useChatModeStore = create<ChatModeState>()(
  persist(
    (set) => ({
      mode: 'normal',
      fullscreen: false,

      setMode: (mode) => set({ mode }),
      setFullscreen: (fullscreen) => set({ fullscreen }),
      toggleFullscreen: () => set((s) => ({ fullscreen: !s.fullscreen })),
    }),
    {
      name: 'ihui-chat-mode',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? window.localStorage
          : { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      ),
    },
  ),
)
