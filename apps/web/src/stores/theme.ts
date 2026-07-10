import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'
export type FontSize = 'small' | 'medium' | 'large'

interface ThemeState {
  theme: ThemeMode
  accentColor: string
  fontSize: FontSize
  setTheme: (theme: ThemeMode) => void
  setAccentColor: (color: string) => void
  setFontSize: (size: FontSize) => void
}

/** 解析 system 主题为实际明暗 */
function resolveDark(theme: ThemeMode): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** 将主题应用到 document.documentElement.classList */
function applyTheme(theme: ThemeMode, accentColor: string, fontSize: FontSize) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', resolveDark(theme))
  root.setAttribute('data-accent', accentColor)
  root.setAttribute('data-font-size', fontSize)
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'system',
  accentColor: 'blue',
  fontSize: 'medium',

  setTheme: (theme) => {
    set({ theme })
    const s = useThemeStore.getState()
    applyTheme(theme, s.accentColor, s.fontSize)
  },

  setAccentColor: (accentColor) => {
    set({ accentColor })
    const s = useThemeStore.getState()
    applyTheme(s.theme, accentColor, s.fontSize)
  },

  setFontSize: (fontSize) => {
    set({ fontSize })
    const s = useThemeStore.getState()
    applyTheme(s.theme, s.accentColor, fontSize)
  },
}))
