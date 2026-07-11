import { create } from 'zustand'

function setAuthCookie(token: string | null) {
  if (typeof document === 'undefined') return
  if (token) {
    document.cookie = `auth_token=${token}; path=/; max-age=604800; SameSite=Lax`
  } else {
    document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax'
  }
}

interface AuthTokenState {
  token: string | null
  /** token 过期时间戳（ms），null 表示未知 */
  expiresAt: number | null
  setToken: (token: string | null, expiresAt?: number) => void
  clear: () => void
  /** 判断 token 是否已过期 */
  isExpired: () => boolean
}

/** Token 管理 Store，独立于 auth store 专注于 token 的存取与过期判断 */
export const useAuthTokenStore = create<AuthTokenState>((set, get) => ({
  token: null,
  expiresAt: null,

  setToken: (token, expiresAt) => {
    setAuthCookie(token)
    set({ token, expiresAt: expiresAt ?? null })
  },

  clear: () => {
    setAuthCookie(null)
    set({ token: null, expiresAt: null })
  },

  isExpired: () => {
    const { token, expiresAt } = get()
    if (!token) return true
    if (!expiresAt) return false
    return Date.now() >= expiresAt
  },
}))
