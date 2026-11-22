// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Stub for @ihui/shared/stores - vitest mock
// Provides createThemeStore and createAuthStore used by ThemeContext and auth-store.

import { useSyncExternalStore } from 'react'

export interface ThemeStoreOptions {
  transport: {
    getItem(key: string): Promise<string | null>
    setItem(key: string, value: string): Promise<void>
    removeItem(key: string): Promise<void>
  }
  initialTheme?: 'light' | 'dark' | 'system'
}

export interface ThemeStore {
  useThemeStore: (selector: (state: ThemeState) => unknown) => unknown
  getState: () => ThemeState
}

export interface ThemeState {
  theme: 'light' | 'dark' | 'system'
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export function createThemeStore(_opts: ThemeStoreOptions): ThemeStore {
  let _theme: 'light' | 'dark' | 'system' = 'light'
  const listeners = new Set<(state: ThemeState) => void>()

  const state: ThemeState = {
    get theme() {
      return _theme
    },
    setTheme(t) {
      _theme = t
      listeners.forEach((l) => l(state))
    },
  }

  return {
    useThemeStore(selector) {
      const result = selector(state)
      return result
    },
    getState() {
      return state
    },
  }
}

export interface PersistTransport {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

// Auth store stubs
export interface AuthStoreOptions {
  tokenStore: {
    getToken(): string | null
    getRefreshToken(): string | null
    setToken(token: string | null): void
    setRefreshToken(token: string | null): void
    clearAll(): void
  }
  userTransport: PersistTransport
  userPersistKey: string
}

export interface AuthUser {
  id: string
  nickname: string
  avatar?: string
}

export interface AuthStore {
  useAuthStore: (selector: (state: AuthState) => unknown) => unknown
  getState: () => AuthState
  setState: (partial: Partial<AuthState>) => void
  hydrate: () => void
  setReady: (ready: boolean) => void
  subscribe: (listener: () => void) => () => void
}

export interface AuthState {
  token: string | null
  refreshToken: string | null
  expiresIn: number | null
  user: AuthUser | null
  isAuthenticated: boolean
  ready: boolean
  setAuth: (data: {
    token: string
    refreshToken?: string
    expiresIn?: number
    user?: AuthUser
  }) => Promise<void>
  setUser: (user: AuthUser | null) => void
  logout: () => Promise<void>
  hydrate: () => void
  setReady: (ready: boolean) => void
}

export function createAuthStore(opts: AuthStoreOptions): AuthStore {
  const { tokenStore } = opts
  let _user: AuthUser | null = null
  let _isAuthenticated = false
  let _ready = false
  let _token: string | null = null
  let _refreshToken: string | null = null
  let _expiresIn: number | null = null

  // Listener system for React re-renders
  const listeners = new Set<() => void>()

  const notify = () => {
    listeners.forEach((l) => l())
  }

  const state: AuthState = {
    get token() {
      return _token
    },
    get refreshToken() {
      return _refreshToken
    },
    get expiresIn() {
      return _expiresIn
    },
    get user() {
      return _user
    },
    get isAuthenticated() {
      return _isAuthenticated
    },
    get ready() {
      return _ready
    },
    async setAuth(data) {
      await tokenStore.setToken(data.token)
      if (data.refreshToken !== undefined) {
        await tokenStore.setRefreshToken(data.refreshToken)
      }
      if (data.expiresIn !== undefined) _expiresIn = data.expiresIn
      if (data.user !== undefined) _user = data.user
      _token = data.token
      _refreshToken = data.refreshToken ?? _refreshToken
      _isAuthenticated = true
      notify()
    },
    setUser(user) {
      _user = user
      notify()
    },
    async logout() {
      await tokenStore.clearAll()
      _token = null
      _refreshToken = null
      _expiresIn = null
      _user = null
      _isAuthenticated = false
      notify()
    },
    async hydrate() {
      const t = tokenStore.getToken()
      const rt = tokenStore.getRefreshToken()
      if (t !== null) _token = t
      if (rt !== null) _refreshToken = rt
      notify()
    },
    setReady(ready) {
      _ready = ready
      notify()
    },
  }

  return {
    useAuthStore(selector) {
      const slice = useSyncExternalStore(
        (onStoreChange) => {
          listeners.add(onStoreChange)
          return () => {
            listeners.delete(onStoreChange)
          }
        },
        () => selector(state),
        () => selector(state),
      )
      return slice
    },
    getState() {
      return state
    },
    setState(partial) {
      if (partial.token !== undefined) _token = partial.token
      if (partial.refreshToken !== undefined) _refreshToken = partial.refreshToken
      if (partial.expiresIn !== undefined) _expiresIn = partial.expiresIn
      if (partial.user !== undefined) _user = partial.user
      if (partial.isAuthenticated !== undefined) _isAuthenticated = partial.isAuthenticated
      if (partial.ready !== undefined) _ready = partial.ready
      notify()
    },
    hydrate() {
      return state.hydrate()
    },
    setReady(ready) {
      _ready = ready
      notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
