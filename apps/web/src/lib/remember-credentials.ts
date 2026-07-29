/**
 * 记住密码 + 账号历史 + 自动登录 凭据管理
 *
 * 存储格式:base64(encodeURIComponent(JSON)) → localStorage
 * - ihui-remember-credentials: 记住密码(账号+密码)
 * - ihui-auto-login: 自动登录标志
 * - ihui-login-history: 账号历史列表(最多 5 个,不含密码)
 *
 * 跨端契约对齐(2026-07-29):新增 `credentialStorage` 对象实现
 * `@ihui/shared/hooks` 的 `CredentialStorage` 接口,供 useLoginForm 注入使用。
 * 保留所有现有函数式 API 以向后兼容 web 端既有调用方。
 */

import type { CredentialStorage } from '@ihui/shared/hooks'

const CREDENTIALS_KEY = 'ihui-remember-credentials'
const AUTO_LOGIN_KEY = 'ihui-auto-login'
const HISTORY_KEY = 'ihui-login-history'
const MAX_HISTORY = 5

export interface RememberedCredentials {
  account: string
  password: string
}

function encode(data: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))))
}

function decode<T>(raw: string): T | null {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(raw)))) as T
  } catch {
    return null
  }
}

export function saveRememberedCredentials(account: string, password: string): void {
  try {
    localStorage.setItem(CREDENTIALS_KEY, encode({ account, password }))
  } catch {
    // localStorage 不可用时静默失败
  }
}

export function loadRememberedCredentials(): RememberedCredentials | null {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY)
    if (!raw) return null
    const parsed = decode<Partial<RememberedCredentials>>(raw)
    if (parsed?.account && parsed?.password) {
      return { account: parsed.account, password: parsed.password }
    }
    return null
  } catch {
    return null
  }
}

export function clearRememberedCredentials(): void {
  try {
    localStorage.removeItem(CREDENTIALS_KEY)
  } catch {
    // 静默失败
  }
}

/* ========== 自动登录 ========== */

export function saveAutoLogin(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_LOGIN_KEY, enabled ? '1' : '0')
  } catch {
    // 静默失败
  }
}

export function loadAutoLogin(): boolean {
  try {
    return localStorage.getItem(AUTO_LOGIN_KEY) === '1'
  } catch {
    return false
  }
}

export function clearAutoLogin(): void {
  try {
    localStorage.removeItem(AUTO_LOGIN_KEY)
  } catch {
    // 静默失败
  }
}

/* ========== 账号历史 ========== */

export function saveLoginHistory(account: string): void {
  try {
    const list = loadLoginHistory()
    const filtered = list.filter((a) => a !== account)
    filtered.unshift(account)
    const trimmed = filtered.slice(0, MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, encode(trimmed))
  } catch {
    // 静默失败
  }
}

export function loadLoginHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = decode<string[]>(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((a) => typeof a === 'string' && a.length > 0)
    }
    return []
  } catch {
    return []
  }
}

export function clearLoginHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {
    // 静默失败
  }
}

/** 删除单个历史账号,返回更新后的列表 */
export function removeFromLoginHistory(account: string): string[] {
  try {
    const list = loadLoginHistory().filter((a) => a !== account)
    localStorage.setItem(HISTORY_KEY, encode(list))
    return list
  } catch {
    return loadLoginHistory()
  }
}

/* ========== 跨端共享 storage 接口实现(2026-07-29) ========== */
//
// 包装现有函数式 API 为 `CredentialStorage` 接口对象,供
// `@ihui/shared/hooks` 的 `useLoginForm({ storage })` 注入使用。
// 接口仅覆盖登录流程需要的 7 个方法(loadLoginHistory /
// clearLoginHistory / removeFromLoginHistory 仍走原函数式 API,
// AccountHistoryInput 等组件继续直接调用,不受影响)。

export const credentialStorage: CredentialStorage = {
  loadRemembered: loadRememberedCredentials,
  saveRemembered: saveRememberedCredentials,
  clearRemembered: clearRememberedCredentials,
  loadAutoLogin,
  saveAutoLogin,
  clearAutoLogin,
  saveLoginHistory,
}
