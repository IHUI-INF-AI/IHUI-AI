// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 主题系统 — 小程序端浅色/深色/跟随系统(2026-09-03 立)
 *
 * 根治:settings 页此前仅写 storage('theme'),全仓无消费方 → 主题设置从未生效。
 *
 * 架构(与 web 端 tokens.css 亮/暗双套 token 同源):
 * - 偏好:'auto' | 'light' | 'dark',存 storage THEME_STORAGE_KEY(settings/theme.tsx 写入)
 * - 解析:auto → 系统主题(getSystemInfoSync().theme,fallback 'light')
 * - 内容区:页面根容器 <ThemeRoot> 挂 .dark 类 → app.css 的 .dark 变量块随子树生效
 * - 原生 chrome:setNavigationBarColor / setTabBarStyle / setBackgroundColor 动态切换,
 *   色值与 token 严格对齐(原生 API 不支持 CSS var,豁免于样式守门)
 *
 * 已知边界(P2 增强,不阻塞本期):
 * - 未开启 app.json "darkmode": true(需配套 theme.json,Taro 编译链路待验证),
 *   auto 模式在运行期系统切换时不实时;启动时正确解析,手动 light/dark 全程生效。
 * - wx.setNavigationBarColor 在 iOS 需用户触摸后才可调用 → 启动时尽力设置,
 *   ThemeRoot 每次 useDidShow 重放(fail 静默,幂等)。
 */

import Taro from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { useDidShow } from '@tarojs/taro'

export type ThemePreference = 'auto' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

/** settings/theme.tsx 共用同一 storage key(2026-09-03 起统一从本模块导入) */
export const THEME_STORAGE_KEY = 'theme'
/** 主题变化事件(eventCenter 广播,ThemeRoot 订阅) */
export const THEME_EVENT = 'theme:changed'

const THEME_PREFERENCES: readonly ThemePreference[] = ['auto', 'light', 'dark']

/* ─── 原生 chrome 色值(与 packages/design-tokens tokens.css 严格对齐)───
 * light: background hsl(0 0% 96.1%) = #f5f5f5;primary 亮色 tabBar 同 app.config.ts 既有值
 * dark:  background hsl(0 0% 14%) = #242424;card hsl(0 0% 10%) = #1a1a1a;
 *        muted-foreground hsl(0 0% 63.9%) = #a3a3a3
 */
const THEME_CHROME: Record<
  ResolvedTheme,
  {
    navBg: string
    navFront: string
    windowBg: string
    tabColor: string
    tabSelected: string
    tabBg: string
    tabBorder: 'white' | 'black'
  }
> = {
  light: {
    navBg: '#ffffff',
    navFront: '#000000',
    windowBg: '#f5f5f5',
    tabColor: '#9CA3AF',
    tabSelected: '#6366F1',
    tabBg: '#ffffff',
    tabBorder: 'white',
  },
  dark: {
    navBg: '#242424',
    navFront: '#ffffff',
    windowBg: '#242424',
    tabColor: '#a3a3a3',
    tabSelected: '#ffffff',
    tabBg: '#1a1a1a',
    tabBorder: 'black',
  },
}

/* ─── 偏好读写 ─── */

export function getThemePreference(): ThemePreference {
  try {
    const saved = Taro.getStorageSync(THEME_STORAGE_KEY)
    return THEME_PREFERENCES.includes(saved as ThemePreference)
      ? (saved as ThemePreference)
      : 'auto'
  } catch {
    return 'auto'
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'auto') {
    try {
      const info = Taro.getSystemInfoSync()
      return info.theme === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  }
  return preference
}

/* ─── 原生 chrome 切换(幂等;单 API 失败不影响其余)─── */

export function applyThemeChrome(resolved: ResolvedTheme): void {
  const c = THEME_CHROME[resolved]
  try {
    void Taro.setBackgroundColor({ backgroundColor: c.windowBg })
  } catch {
    // ignore
  }
  try {
    void Taro.setNavigationBarColor({ frontColor: c.navFront, backgroundColor: c.navBg })
  } catch {
    // iOS 未触摸时 fail,由 ThemeRoot useDidShow 重放
  }
  try {
    void Taro.setTabBarStyle({
      color: c.tabColor,
      selectedColor: c.tabSelected,
      backgroundColor: c.tabBg,
      borderStyle: c.tabBorder,
    })
  } catch {
    // 非 tabBar 页面调用 fail,静默
  }
}

/* ─── 广播 ─── */

function notifyThemeChanged(resolved: ResolvedTheme): void {
  try {
    Taro.eventCenter.trigger(THEME_EVENT, resolved)
  } catch {
    // ignore
  }
}

/* ─── 设置入口(settings 页调用;app 启动初始化复用)─── */

export function setThemePreference(preference: ThemePreference): ResolvedTheme {
  try {
    Taro.setStorageSync(THEME_STORAGE_KEY, preference)
  } catch {
    // storage 写失败仍继续应用本次会话
  }
  const resolved = resolveTheme(preference)
  applyThemeChrome(resolved)
  notifyThemeChanged(resolved)
  return resolved
}

/* ─── App 启动初始化(App.tsx 的 ThemeInitHandler 调用)─── */

let themeListenerRegistered = false

export function initTheme(): void {
  const preference = getThemePreference()
  applyThemeChrome(resolveTheme(preference))

  if (themeListenerRegistered) return
  themeListenerRegistered = true
  // 系统主题切换:手动偏好下重放 chrome 防原生重置;auto 下随系统
  try {
    Taro.onThemeChange(() => {
      const resolved = resolveTheme(getThemePreference())
      applyThemeChrome(resolved)
      notifyThemeChanged(resolved)
    })
  } catch {
    // H5 / 低版本基础库无此 API,静默
  }
}

/* ─── 页面根容器 hook(ThemeRoot 使用)─── */

export function useThemeRoot(): {
  resolved: ResolvedTheme
  themeClass: string
  applyPreference: (preference: ThemePreference) => void
} {
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(getThemePreference()))

  useEffect(() => {
    const handler = (next: unknown) => {
      if (next === 'dark' || next === 'light') setResolved(next)
    }
    Taro.eventCenter.on(THEME_EVENT, handler)
    return () => {
      try {
        Taro.eventCenter.off(THEME_EVENT, handler)
      } catch {
        // ignore
      }
    }
  }, [])

  // 页面每次显示时重放 chrome(iOS setNavigationBarColor 需触摸后;幂等)
  useDidShow(() => {
    applyThemeChrome(resolved)
  })

  // resolved 变化时同步 chrome
  useEffect(() => {
    applyThemeChrome(resolved)
  }, [resolved])

  const applyPreference = useCallback((preference: ThemePreference) => {
    const next = setThemePreference(preference)
    setResolved(next)
  }, [])

  return { resolved, themeClass: resolved === 'dark' ? 'dark' : '', applyPreference }
}
