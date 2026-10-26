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

/**
 * RN 侧的三档 ('system'|'light'|'dark') ⇄ 端内偏好的三档 ('auto'|'light'|'dark') 的显式对照。
 * 端内真相源没有 'system' 这个名字,也不是同一套措辞 ⇒ 必须在这里翻译一次,
 * 而不是把 RN 的字面量直接塞进 setThemePreference(那会让 'system' 落进"存进去但没人认"的死档)。
 */
function toPreference(mode: ThemeMode): 'auto' | 'light' | 'dark' {
  return mode === 'system' ? 'auto' : mode
}

function toThemeMode(preference: 'auto' | 'light' | 'dark'): ThemeMode {
  return preference === 'auto' ? 'system' : preference
}

export function useTheme(): {
  themeMode: ThemeMode
  resolvedTheme: ResolvedTheme
  setThemeMode: (next: ThemeMode) => void
} {
  const [themeMode, setMode] = useState<ThemeMode>(() => toThemeMode(getThemePreference()))
  const [resolvedTheme, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(getThemePreference()),
  )

  useEffect(() => {
    const handler = (next: unknown) => {
      if (next === 'dark' || next === 'light') setResolved(next)
    }
    Taro.eventCenter.on(THEME_EVENT, handler)
    // 清理函数必须返回 void:Taro.eventCenter.off 自己返回 Events 对象,
    // 直接 `return () => off(...)` 会把那个返回值当成 cleanup 的产物(React 判 EffectCallback 不合法)
    return () => {
      Taro.eventCenter.off(THEME_EVENT, handler)
    }
  }, [])

  const setThemeMode = useCallback((next: ThemeMode) => {
    setMode(next)
    setResolved(setThemePreference(toPreference(next)))
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
      theme: toThemeMode(getThemePreference()),
      setTheme: (t: ThemeMode) => setThemePreference(toPreference(t)),
    }),
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
