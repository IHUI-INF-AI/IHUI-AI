'use client'

/**
 * 登录偏好(自动登录 + 自动续期)前端封装。
 *
 * 后端接口:
 *  GET /api/auth/login-preferences → { autoLogin, autoRenew }
 *  PUT /api/auth/login-preferences ← { autoLogin?, autoRenew? }
 *
 * 本地缓存(localStorage key=ihui-login-prefs)用于未登录时/登录页快速读取,
 * 登录成功后用后端返回值覆盖,保证多端一致。
 */

import { fetchApi } from './api'

export interface LoginPreferences {
  /** 自动登录:勾选后 refreshToken 持久化 30 天,下次访问免密登录 */
  autoLogin: boolean
  /** 自动续期:access token 过期前自动用 refreshToken 换新(默认 true) */
  autoRenew: boolean
}

const CACHE_KEY = 'ihui-login-prefs'
const DEFAULT_PREFS: LoginPreferences = { autoLogin: false, autoRenew: true }

/* ========== 本地缓存 ========== */

export function loadLocalLoginPrefs(): LoginPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return DEFAULT_PREFS
    const p = JSON.parse(raw) as Partial<LoginPreferences>
    return {
      autoLogin: p.autoLogin ?? false,
      autoRenew: p.autoRenew ?? true,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function saveLocalLoginPrefs(p: Partial<LoginPreferences>): void {
  if (typeof window === 'undefined') return
  try {
    const merged = { ...loadLocalLoginPrefs(), ...p }
    localStorage.setItem(CACHE_KEY, JSON.stringify(merged))
  } catch {
    // 静默失败
  }
}

export function clearLocalLoginPrefs(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // 静默失败
  }
}

/* ========== 后端读写 ========== */

export async function fetchLoginPreferences(): Promise<LoginPreferences> {
  const res = await fetchApi<LoginPreferences>('/api/auth/login-preferences')
  if (res.success && res.data) {
    saveLocalLoginPrefs(res.data)
    return res.data
  }
  return loadLocalLoginPrefs()
}

export async function saveLoginPreferences(
  prefs: Partial<LoginPreferences>,
): Promise<LoginPreferences | null> {
  const res = await fetchApi<LoginPreferences>('/api/auth/login-preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  })
  if (res.success && res.data) {
    saveLocalLoginPrefs(res.data)
    return res.data
  }
  return null
}
