/**
 * @ihui/shared/stores/theme-store — 跨端共享 Theme zustand 工厂
 *
 * 设计原则(2026-07-25 立):
 * 1. 统一类型:ThemeMode('light'|'dark'|'system') + AccentColor(5 色) + FontSize(3 级) + highContrast
 * 2. 跨端兼容:web(next-themes) / RN(styled-components ThemeProvider) / Taro(原生样式) / extension(CSS class) / desktop(CSS var)
 * 3. 依赖注入:transport 可选 + onChange 回调(用于同步 DOM class / 原生主题)
 * 4. SSR 安全:createSSRSafeTransport 自动 fallback
 *
 * 与 useThemeStore(各端现有)的差异:
 * - 现有 useThemeStore:耦合 DOM 操作(直接 toggle .dark class)
 * - createThemeStore:仅镜像状态,DOM 同步由 onChange 回调处理(各端策略不同)
 *
 * 各端接入示例:
 * - web: createThemeStore({ transport: ssrSafeLocalStorage, onChange: (s) => next-themes.setTheme(s.theme) })
 * - mobile-rn: createThemeStore({ transport: asyncStorageTransport, onChange: (s) => NativeTheme.set(s.theme) })
 * - miniapp-taro: createThemeStore({ transport: taroStorageTransport, onChange: (s) => Taro.setNavigationBarColor(...) })
 * - extension: createThemeStore({ transport: chromeStorageTransport, onChange: (s) => document.body.dataset.theme = s.theme })
 */

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { PersistTransport } from './transport'

export type ThemeMode = 'light' | 'dark' | 'system'
export type AccentColor = 'green' | 'blue' | 'purple' | 'orange' | 'red'
export type FontSize = 'small' | 'medium' | 'large'

export interface ThemeStoreState {
  theme: ThemeMode
  accentColor: AccentColor
  fontSize: FontSize
  highContrast: boolean
  setTheme: (theme: ThemeMode) => void
  setAccentColor: (color: AccentColor) => void
  setFontSize: (size: FontSize) => void
  toggleHighContrast: () => void
  reset: () => void
}

export interface CreateThemeStoreOptions {
  /** 持久化 transport(可选) */
  transport?: PersistTransport
  /** storage key,默认 'ihui-theme' */
  persistKey?: string
  /** 主题变化回调(用于同步 DOM class / 原生主题) */
  onChange?: (state: ThemeStoreState) => void
  /** 初始 theme(默认 'system') */
  initialTheme?: ThemeMode
  /** 初始 accentColor(默认 'green') */
  initialAccentColor?: AccentColor
  /** 初始 fontSize(默认 'medium') */
  initialFontSize?: FontSize
  /** persist version,默认 1 */
  version?: number
}

export interface CreatedThemeStore {
  useThemeStore: UseBoundStore<StoreApi<ThemeStoreState>>
  getState: () => ThemeStoreState
  setState: StoreApi<ThemeStoreState>['setState']
  subscribe: StoreApi<ThemeStoreState>['subscribe']
  reset: () => void
}

const DEFAULT_STATE: Pick<ThemeStoreState, 'theme' | 'accentColor' | 'fontSize' | 'highContrast'> = {
  theme: 'system',
  accentColor: 'green',
  fontSize: 'medium',
  highContrast: false,
}

export function createThemeStore(
  options: CreateThemeStoreOptions = {},
): CreatedThemeStore {
  const {
    transport,
    persistKey = 'ihui-theme',
    onChange,
    initialTheme = DEFAULT_STATE.theme,
    initialAccentColor = DEFAULT_STATE.accentColor,
    initialFontSize = DEFAULT_STATE.fontSize,
    version = 1,
  } = options

  const persistStorage: StateStorage = {
    getItem: async (name) => {
      if (!transport) return null
      return transport.getItem(name)
    },
    setItem: async (name, value) => {
      if (!transport) return
      await transport.setItem(name, value)
    },
    removeItem: async (name) => {
      if (!transport) return
      await transport.removeItem(name)
    },
  }

  // emit 包装:每次 state 变化后调用 onChange
  const emit = (state: ThemeStoreState) => {
    if (onChange) onChange(state)
  }

  const initialState: ThemeStoreState = {
    theme: initialTheme,
    accentColor: initialAccentColor,
    fontSize: initialFontSize,
    highContrast: false,
    setTheme: (theme) => {
      useStore.setState({ theme })
      emit(useStore.getState())
    },
    setAccentColor: (accentColor) => {
      useStore.setState({ accentColor })
      emit(useStore.getState())
    },
    setFontSize: (fontSize) => {
      useStore.setState({ fontSize })
      emit(useStore.getState())
    },
    toggleHighContrast: () => {
      useStore.setState((s) => ({ highContrast: !s.highContrast }))
      emit(useStore.getState())
    },
    reset: () => {
      useStore.setState({ ...DEFAULT_STATE })
      emit(useStore.getState())
    },
  }

  const useStore = create<ThemeStoreState>()(
    persist(() => initialState, {
      name: persistKey,
      storage: createJSONStorage(() => persistStorage),
      version,
    }),
  )

  return {
    useThemeStore: useStore,
    getState: useStore.getState,
    setState: useStore.setState,
    subscribe: useStore.subscribe,
    reset: () => {
      useStore.setState({ ...DEFAULT_STATE })
      emit(useStore.getState())
    },
  }
}
