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
import { useColorScheme } from 'react-native'
import type { ReactNode } from 'react'
import { createThemeStore } from '@ihui/shared/stores'
import { createAsyncStorageTransport } from '../stores/storage-adapter'

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
  return {
    themeMode,
    resolvedTheme,
    setThemeMode: setTheme,
  }
}

/**
 * 兼容旧 ThemeProvider — zustand 全局 store 不需要 Provider,此组件仅作占位。
 * 调用方仍可 <ThemeProvider><App /></ThemeProvider> 不报错。
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}