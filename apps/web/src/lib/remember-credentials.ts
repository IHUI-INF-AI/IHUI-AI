/**
 * 记住密码凭据管理(localStorage + base64 编码)
 *
 * 存储格式:base64(encodeURIComponent(JSON)) → localStorage
 * key: ihui-remember-credentials
 */

const STORAGE_KEY = 'ihui-remember-credentials'

export interface RememberedCredentials {
  account: string
  password: string
}

export function saveRememberedCredentials(account: string, password: string): void {
  try {
    const json = JSON.stringify({ account, password })
    const encoded = btoa(unescape(encodeURIComponent(json)))
    localStorage.setItem(STORAGE_KEY, encoded)
  } catch {
    // localStorage 不可用时静默失败
  }
}

export function loadRememberedCredentials(): RememberedCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const json = decodeURIComponent(escape(atob(raw)))
    const parsed = JSON.parse(json) as Partial<RememberedCredentials>
    if (typeof parsed.account === 'string' && typeof parsed.password === 'string') {
      return { account: parsed.account, password: parsed.password }
    }
    return null
  } catch {
    return null
  }
}

export function clearRememberedCredentials(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 静默失败
  }
}
