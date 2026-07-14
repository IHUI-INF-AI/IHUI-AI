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

/** 解析 system 主题为实际明暗 */
function resolveDark(theme: ThemeMode): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** 将主题应用到 document.documentElement.classList */
function applyTheme(
  theme: ThemeMode,
  accentColor: string,
  fontSize: FontSize,
  highContrast: boolean,
) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', resolveDark(theme))
  root.classList.toggle('high-contrast', highContrast)
  root.setAttribute('data-accent', accentColor)
  root.setAttribute('data-font-size', fontSize)
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
      accentColor: 'blue',
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
