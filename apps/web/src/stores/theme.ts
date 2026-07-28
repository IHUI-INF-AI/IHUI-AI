/**
 * theme — web 端主题 store(2026-07-28 迁移至 @ihui/shared/stores 工厂)
 *
 * 迁移说明:
 * - 原 create<ThemeState>()(persist(...)) 手写实现 → createThemeStore 工厂
 * - 工厂提供 theme/accentColor/fontSize/highContrast + setTheme/setAccentColor/setFontSize/toggleHighContrast/reset
 * - 持久化 transport 注入 createSSRSafeWebTransport(与 auth-store.ts 一致)
 * - DOM 同步(high-contrast 辅助类)通过 subscribe 回调处理(替代原 onRehydrateStorage + 各 setter 内联调用)
 * - 类型差异:原 accentColor: string → 工厂 AccentColor 联合类型('green'|'blue'|'purple'|'orange'|'red');
 *   useThemeStore 无外部消费者(仅本文件内部引用), narrowing 安全。
 */

import { createThemeStore } from '@ihui/shared/stores'
import { createSSRSafeWebTransport } from './storage-adapter'

export type { ThemeMode, FontSize, AccentColor } from '@ihui/shared/stores'

/** 将 high-contrast 辅助类同步到 document.documentElement.classList
 * 注意:.dark 类由 next-themes(ThemeProvider attribute="class")统一管理,此处不再 toggle 避免冲突。 */
function applyTheme(highContrast: boolean) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('high-contrast', highContrast)
}

const themeTransport = createSSRSafeWebTransport()

const createdStore = createThemeStore({
  transport: themeTransport,
  persistKey: 'ihui-theme',
  // 版本设为 0,与历史 localStorage 数据一致(原 persist 未设 version,zustand 默认 0)
  version: 0,
})

// subscribe 捕获所有状态变化(包括 rehydration 和 setter 调用),
// 同步 high-contrast 辅助类到 DOM(替代原 onRehydrateStorage + 各 setter 内联 applyTheme 调用)
createdStore.subscribe((state) => {
  applyTheme(state.highContrast)
})

// 初始加载时应用一次(覆盖同步 rehydration 已完成或 SSR 首屏场景)
if (typeof document !== 'undefined') {
  applyTheme(createdStore.getState().highContrast)
}

export const useThemeStore = createdStore.useThemeStore
