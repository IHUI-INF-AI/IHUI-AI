/**
 * miniapp-taro 端 CredentialStorage 实现
 *
 * 基于 Taro.setStorageSync / getStorageSync / removeStorageSync,
 * 实现 @ihui/shared/hooks 的 CredentialStorage 接口,供 useLoginForm 注入使用。
 *
 * 存储 key 与 web 端 (apps/web/src/lib/remember-credentials.ts) 命名一致,
 * 但 Taro storage 与浏览器 localStorage 属于不同沙箱,数据不互通。
 *
 * 存储格式:JSON.stringify(直接存储,小程序环境无 btoa/atob)
 * - ihui-remember-credentials: 记住密码(账号+密码)
 * - ihui-auto-login: 自动登录标志('1' / '0')
 * - ihui-login-history: 账号历史列表(最多 5 个,不含密码)
 */
import { getStorageSync, setStorageSync, removeStorageSync } from '@tarojs/taro'
import type { CredentialStorage, RememberedCredentials } from '@ihui/shared/hooks'

const CREDENTIALS_KEY = 'ihui-remember-credentials'
const AUTO_LOGIN_KEY = 'ihui-auto-login'
const HISTORY_KEY = 'ihui-login-history'
const MAX_HISTORY = 5

/* ========== 记住密码 ========== */

function loadRemembered(): RememberedCredentials | null {
  try {
    const raw = getStorageSync(CREDENTIALS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RememberedCredentials>
    if (parsed?.account && parsed?.password) {
      return { account: parsed.account, password: parsed.password }
    }
    return null
  } catch {
    return null
  }
}

function saveRemembered(account: string, password: string): void {
  try {
    setStorageSync(CREDENTIALS_KEY, JSON.stringify({ account, password }))
  } catch {
    // storage 不可用时静默失败
  }
}

function clearRemembered(): void {
  try {
    removeStorageSync(CREDENTIALS_KEY)
  } catch {
    // 静默失败
  }
}

/* ========== 自动登录 ========== */

function loadAutoLogin(): boolean {
  try {
    return getStorageSync(AUTO_LOGIN_KEY) === '1'
  } catch {
    return false
  }
}

function saveAutoLogin(enabled: boolean): void {
  try {
    setStorageSync(AUTO_LOGIN_KEY, enabled ? '1' : '0')
  } catch {
    // 静默失败
  }
}

function clearAutoLogin(): void {
  try {
    removeStorageSync(AUTO_LOGIN_KEY)
  } catch {
    // 静默失败
  }
}

/* ========== 账号历史 ========== */

function saveLoginHistory(account: string): void {
  try {
    const raw = getStorageSync(HISTORY_KEY)
    let list: string[] = []
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        list = parsed.filter((a): a is string => typeof a === 'string' && a.length > 0)
      }
    }
    const filtered = list.filter((a) => a !== account)
    filtered.unshift(account)
    setStorageSync(HISTORY_KEY, JSON.stringify(filtered.slice(0, MAX_HISTORY)))
  } catch {
    // 静默失败
  }
}

/* ========== CredentialStorage 接口实现 ========== */

export const credentialStorage: CredentialStorage = {
  loadRemembered,
  saveRemembered,
  clearRemembered,
  loadAutoLogin,
  saveAutoLogin,
  clearAutoLogin,
  saveLoginHistory,
}
