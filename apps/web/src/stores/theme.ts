import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'
export type FontSize = 'small' | 'medium' | 'large'

interface ThemeState {
  theme: ThemeMode
  accentColor: string
  fontSize: FontSize
  highContrast: boolean
  setTheme: (theme: ThemeMode) => void
  setAccentColor: (color: string) => void
  setFontSize: (size: FontSize) => void
  toggleHighContrast: () => void
}

/** 将主题应用到 document.documentElement.classList
 * 注意: .dark 类由 next-themes (ThemeProvider attribute="class") 统一管理,此处不再 toggle 避免冲突。
 * 仅处理 high-contrast 辅助类。 */
function applyTheme(
  _theme: ThemeMode,
  _accentColor: string,
  _fontSize: FontSize,
  highContrast: boolean,
) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('high-contrast', highContrast)
}

/** SSR 安全的 localStorage 替代存储 */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      accentColor: 'green',
      fontSize: 'medium',
      highContrast: false,

      setTheme: (theme) => {
        set({ theme })
        const s = useThemeStore.getState()
        applyTheme(theme, s.accentColor, s.fontSize, s.highContrast)
      },

      setAccentColor: (accentColor) => {
        set({ accentColor })
        const s = useThemeStore.getState()
        applyTheme(s.theme, accentColor, s.fontSize, s.highContrast)
      },

      setFontSize: (fontSize) => {
        set({ fontSize })
        const s = useThemeStore.getState()
        applyTheme(s.theme, s.accentColor, fontSize, s.highContrast)
      },

      toggleHighContrast: () => {
        const next = !useThemeStore.getState().highContrast
        set({ highContrast: next })
        const s = useThemeStore.getState()
        applyTheme(s.theme, s.accentColor, s.fontSize, next)
      },
    }),
    {
      name: 'ihui-theme',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : noopStorage,
      ),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme, state.accentColor, state.fontSize, state.highContrast)
      },
    },
  ),
)
