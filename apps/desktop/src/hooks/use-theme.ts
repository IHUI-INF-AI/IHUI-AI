import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'ihui-theme'
const SYSTEM_DARK_MQL =
  typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : null

/** 解析为有效 theme。 */
function parseTheme(v: string | null): Theme {
  if (v === 'light' || v === 'dark') return v
  return 'system'
}

/** 把 theme 应用到 documentElement(.dark class + data-theme)。 */
function applyTheme(theme: Theme, isSystemDark: boolean): void {
  const dark = theme === 'system' ? isSystemDark : theme === 'dark'
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.dataset.theme = dark ? 'dark' : 'light'
}

/** 初始化主题:在 React 渲染前调用(main.tsx),避免 FOUC(无样式闪烁)。 */
export function initTheme(): Theme {
  const stored = parseTheme(localStorage.getItem(STORAGE_KEY))
  const sysDark = SYSTEM_DARK_MQL?.matches ?? false
  applyTheme(stored, sysDark)
  return stored
}

/** 主题 hook:返回当前 theme 与 setter,自动监听系统主题变化。 */
export function useTheme(): {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
  isDark: boolean
} {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system'
    return parseTheme(localStorage.getItem(STORAGE_KEY))
  })
  const [isSystemDark, setIsSystemDark] = useState<boolean>(() => SYSTEM_DARK_MQL?.matches ?? false)

  useEffect(() => {
    applyTheme(theme, isSystemDark)
  }, [theme, isSystemDark])

  useEffect(() => {
    if (!SYSTEM_DARK_MQL) return
    const handler = (e: MediaQueryListEvent) => setIsSystemDark(e.matches)
    SYSTEM_DARK_MQL.addEventListener('change', handler)
    return () => SYSTEM_DARK_MQL.removeEventListener('change', handler)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      // 忽略隐私模式 / localStorage 禁用
    }
    setThemeState(t)
  }, [])

  const toggle = useCallback(() => {
    const dark = theme === 'system' ? isSystemDark : theme === 'dark'
    setTheme(dark ? 'light' : 'dark')
  }, [theme, isSystemDark, setTheme])

  const isDark = theme === 'system' ? isSystemDark : theme === 'dark'

  return { theme, setTheme, toggle, isDark }
}
