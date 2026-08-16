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
 *
 * ============================================================================
 * 修复说明(2026-07-26 立):
 * Taro 4.2.0 Vite runner 把 `import { create } from 'zustand'` 错误归并为
 * `taro.react_production_min.create`(React 上无此函数),导致运行时抛
 * `TypeError: taro.react_production_min.create is not a function`。
 *
 * 解决方案:用 `createStore` from 'zustand/vanilla'(纯 store,无 React 绑定)
 * + `useStore` from 'zustand/react'(React hook 绑定,显式传入 storeApi)
 * 替换 `create` from 'zustand'(在 Taro Vite 下被错误归并)。
 *
 * 手动构造 UseBoundStore 兼容对象,既可作为 hook 调用,又保留
 * .getState() / .setState() / .subscribe() 接口,确保调用方 API 完全兼容。
 * ============================================================================
 */

import { createStore, type StoreApi } from 'zustand/vanilla'
import { useStore, type UseBoundStore } from 'zustand/react'
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

const DEFAULT_STATE: Pick<ThemeStoreState, 'theme' | 'accentColor' | 'fontSize' | 'highContrast'> =
  {
    theme: 'system',
    accentColor: 'green',
    fontSize: 'medium',
    highContrast: false,
  }

export function createThemeStore(options: CreateThemeStoreOptions = {}): CreatedThemeStore {
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

  // storeApi 在下方声明,这里通过闭包引用(运行时 storeApi 已初始化)
  const initialState: ThemeStoreState = {
    theme: initialTheme,
    accentColor: initialAccentColor,
    fontSize: initialFontSize,
    highContrast: false,
    setTheme: (theme) => {
      storeApi.setState({ theme })
      emit(storeApi.getState())
    },
    setAccentColor: (accentColor) => {
      storeApi.setState({ accentColor })
      emit(storeApi.getState())
    },
    setFontSize: (fontSize) => {
      storeApi.setState({ fontSize })
      emit(storeApi.getState())
    },
    toggleHighContrast: () => {
      storeApi.setState((s) => ({ highContrast: !s.highContrast }))
      emit(storeApi.getState())
    },
    reset: () => {
      storeApi.setState({ ...DEFAULT_STATE })
      emit(storeApi.getState())
    },
  }

  // 使用 createStore(zustand/vanilla)避免 Taro Vite 把 `create` 归并到
  // taro.react_production_min.create 的问题
  const storeApi = createStore<ThemeStoreState>()(
    persist(() => initialState, {
      name: persistKey,
      storage: createJSONStorage(() => persistStorage),
      version,
    }),
  )

  // 手动构造 UseBoundStore:既可作为 hook 调用,又保留 .getState/.setState/.subscribe
  const useBoundStore = Object.assign(
    function useThemeStoreHook<U>(selector?: (state: ThemeStoreState) => U): U {
      return useStore(storeApi, selector as (state: ThemeStoreState) => U)
    } as UseBoundStore<StoreApi<ThemeStoreState>>,
    {
      getState: storeApi.getState,
      setState: storeApi.setState,
      subscribe: storeApi.subscribe,
    },
  )

  return {
    useThemeStore: useBoundStore,
    getState: storeApi.getState,
    setState: storeApi.setState,
    subscribe: storeApi.subscribe,
    reset: () => {
      storeApi.setState({ ...DEFAULT_STATE })
      emit(storeApi.getState())
    },
  }
}
