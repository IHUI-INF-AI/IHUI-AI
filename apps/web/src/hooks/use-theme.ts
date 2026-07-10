'use client'

import * as React from 'react'
import { useTheme as useNextTheme } from 'next-themes'

export interface UseThemeReturn {
  theme: string | undefined
  setTheme: (theme: string) => void
  toggleTheme: () => void
  resolvedTheme: string | undefined
}

/** 主题管理，集成 next-themes */
export function useTheme(): UseThemeReturn {
  const { theme, setTheme, resolvedTheme } = useNextTheme()

  const toggleTheme = React.useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setTheme])

  return { theme, setTheme, toggleTheme, resolvedTheme }
}
