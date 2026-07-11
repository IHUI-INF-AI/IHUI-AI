'use client'

import * as React from 'react'

import { useThemeStore, type FontSize } from '@/stores/theme'
import { useToast } from '@/hooks/use-toast'

export interface UseSettingsAppReturn {
  theme: string
  accentColor: string
  fontSize: FontSize
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setAccentColor: (color: string) => void
  setFontSize: (size: FontSize) => void
  reset: () => void
}

/** 设置-应用 Hook，管理主题、强调色、字号等应用级偏好 */
export function useSettingsApp(): UseSettingsAppReturn {
  const toast = useToast()
  const theme = useThemeStore((s) => s.theme)
  const accentColor = useThemeStore((s) => s.accentColor)
  const fontSize = useThemeStore((s) => s.fontSize)
  const setThemeStore = useThemeStore((s) => s.setTheme)
  const setAccentColorStore = useThemeStore((s) => s.setAccentColor)
  const setFontSizeStore = useThemeStore((s) => s.setFontSize)

  const setTheme = React.useCallback(
    (t: 'light' | 'dark' | 'system') => {
      setThemeStore(t)
      toast.success('主题已更新')
    },
    [setThemeStore, toast],
  )

  const setAccentColor = React.useCallback(
    (color: string) => {
      setAccentColorStore(color)
      toast.success('强调色已更新')
    },
    [setAccentColorStore, toast],
  )

  const setFontSize = React.useCallback(
    (size: FontSize) => {
      setFontSizeStore(size)
      toast.success('字号已更新')
    },
    [setFontSizeStore, toast],
  )

  const reset = React.useCallback(() => {
    setThemeStore('system')
    setAccentColorStore('blue')
    setFontSizeStore('medium')
    toast.success('已恢复默认设置')
  }, [setThemeStore, setAccentColorStore, setFontSizeStore, toast])

  return {
    theme,
    accentColor,
    fontSize,
    setTheme,
    setAccentColor,
    setFontSize,
    reset,
  }
}
