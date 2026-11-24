// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * mobile-rn ThemeContext — 基于 @ihui/shared/stores createThemeStore 工厂
 *
 * 2026-07-27 重构:删除本地 AsyncStorage + useState 实现,改用跨端共享工厂。
 * - 持久化 key 统一为 'ihui-theme'(与 web/miniapp-taro/extension 一致,消除 'ihui_theme' 漂移)
 * - 暴露 useTheme() API 保持向后兼容(themeMode / resolvedTheme / setThemeMode)
 * - 内部 zustand store 支持 accentColor / fontSize / highContrast 等扩展(暂未暴露,后续按需启用)
 * - zustand persist 自动异步 hydrate,无需手动 useEffect 读 storage
 *
 * 调用方零修改(RootNavigator/ProfileScreen/SettingsScreen/SharedDemoScreen 共 4 处)。
 */
import { Appearance, useColorScheme } from 'react-native'
import { useCallback, useEffect, type ReactNode } from 'react'
import { createThemeStore, type ThemeMode } from '@ihui/shared/stores'
import { createAsyncStorageTransport } from '../stores/storage-adapter'
import { commitRnTheme, reloadForTheme } from '../theme/active-tokens'
import { syncNativeWindColorScheme, syncWindowColorScheme } from '../theme/color-scheme-sync'

// 全局单例 store(自动持久化到 AsyncStorage,默认 key = 'ihui-theme',与 web/miniapp-taro/extension 一致)
export const themeStore = createThemeStore({
  transport: createAsyncStorageTransport(),
  initialTheme: 'system',
})

/**
 * 兼容旧 useTheme() API — 调用方零修改。
 * 返回 { themeMode, resolvedTheme, setThemeMode } 三字段(原 API 表面)。
 */
export function useTheme() {
  const themeMode = themeStore.useThemeStore((s) => s.theme)
  const setTheme = themeStore.useThemeStore((s) => s.setTheme)
  const systemScheme = useColorScheme()
  const resolvedTheme: 'light' | 'dark' =
    themeMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeMode
  /**
   * 切主题必须同时落到模块级 token 单例(全端 86 个文件的 StyleSheet.create 在求值时
   * 一次性取色,只有重载 JS 才会重算),故这里在 store 写入之外 commit + reload。
   */
  const setThemeMode = useCallback(
    (next: ThemeMode): void => {
      setTheme(next)
      if (commitRnTheme(next)) reloadForTheme()
    },
    [setTheme],
  )
  return {
    themeMode,
    resolvedTheme,
    setThemeMode,
  }
}

/**
 * ThemeProvider — zustand 全局 store 本身不需要 Provider,这里只承担一件事:
 * 偏好为 system 时订阅系统配色变化,把新配色落到模块级 token 入口并重载 JS。
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeMode = themeStore.useThemeStore((s) => s.theme)
  const systemScheme = useColorScheme()
  const resolved: 'light' | 'dark' =
    themeMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeMode
  /**
   * 把 App 解析出的主题落到 NativeWind 的 store —— 不同步的话全端 `dark:*` 类只跟系统外观走,
   * 用户在设置里手动选深色时它们一条都不生效(而守门 83 的 R2 正是把"同行有 dark: 变体"记为已配对)。
   */
  useEffect(() => {
    syncNativeWindColorScheme(resolved)
  }, [resolved])
  /**
   * 原生窗口按**偏好**落档(不是解析结果):偏好为 system 时交还系统,
   * 否则键盘 / Alert 对话框 / 状态栏这些原生表面会跟系统走,和 App 内容反色。
   */
  useEffect(() => {
    syncWindowColorScheme(themeMode)
  }, [themeMode])
  useEffect(() => {
    if (themeMode !== 'system') return
    const sub = Appearance.addChangeListener(() => {
      if (commitRnTheme('system')) reloadForTheme()
    })
    return () => sub.remove()
  }, [themeMode])
  return <>{children}</>
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
