// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/theme.tsx —— RN 壳的 `useTheme()` 在小程序端的等价实现(表面逐字同形)。
 *
 * RN 侧:`apps/mobile-rn/src/context/ThemeContext.tsx` 的 useTheme() 返回
 * `{ themeMode, resolvedTheme, setThemeMode }`。本 shim 用**端内已有的主题真相源**
 * (`@/lib/theme` 的偏好存储 + THEME_EVENT)提供同三个字段,而不是又建一套偏好。
 *
 * 为什么必须替代 RN 那个模块:它 import 了 NativeWind 色板同步与 AsyncStorage transport,
 * 这些在小程序里没有对应物;搬 RN 壳到小程序时由 webpack 按路径替换接住
 * (见 apps/miniapp-taro/config/index.ts 的 rnShellReplacements)。
 */
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { THEME_EVENT, getThemePreference, resolveTheme, setThemePreference } from '@/lib/theme'

type ThemeMode = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

export function useTheme(): {
  themeMode: ThemeMode
  resolvedTheme: ResolvedTheme
  setThemeMode: (next: ThemeMode) => void
} {
  const [themeMode, setMode] = useState<ThemeMode>(() => getThemePreference() as ThemeMode)
  const [resolvedTheme, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(getThemePreference()),
  )

  useEffect(() => {
    const handler = (next: unknown) => {
      if (next === 'dark' || next === 'light') setResolved(next)
    }
    Taro.eventCenter.on(THEME_EVENT, handler)
    return () => Taro.eventCenter.off(THEME_EVENT, handler)
  }, [])

  const setThemeMode = useCallback((next: ThemeMode) => {
    setMode(next)
    setResolved(setThemePreference(next))
  }, [])

  return { themeMode, resolvedTheme, setThemeMode }
}

/** RN 的 ThemeProvider 承担"把偏好落到 NativeWind/原生窗口";小程序由 applyThemeChrome 承担,这里透传 */
export function ThemeProvider({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

export const themeStore = {
  useThemeStore: <T,>(
    selector: (state: { theme: ThemeMode; setTheme: (t: ThemeMode) => void }) => T,
  ): T =>
    selector({
      theme: getThemePreference() as ThemeMode,
      setTheme: (t: ThemeMode) => setThemePreference(t),
    }),
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
