// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * miniapp-taro 端 CredentialStorage 实现
 *
 * 收口(票 #27 第二端,2026-09-29):**本端不再持久化口令**。
 * 旧版把 `{account, password}` 直接 `JSON.stringify` 写进 Taro storage,并在头注里
 * 自述"记住密码(账号+密码)"。微信/支付宝给小程序的 storage 是**应用沙箱里的明文文件**
 * (`wx.setStorageSync` 官方文档没有提供任何加密或访问控制语义;真机上数据落在
 * 微信私有目录,备份/ROOT 场景可直接读出),而本端**没有** Keychain 级的安全存储原语,
 * 所以"给它加密"这个选项结构上不存在 —— 密钥同样要落在这块存储里。
 *
 * 出路不是加密口令,而是**不再需要口令**:自动登录由 refreshToken 续期承担
 * (`src/utils/auth.ts` 的 `refreshAccessToken()`,经 `app.tsx` 的
 * `bindTokenStoreToApiClient(tokenStore, { refreshAccessToken })` 挂在 401 拦截器上;
 * refreshToken 本身早已落在这份 storage 里)。口令在换到 token 之后就没有存在本地的理由,
 * 于是本地也不该留它。
 *
 * 记录形态 / key 名 / 历史上限的唯一真相在 `@ihui/shared`:
 * - 编解码:`@ihui/shared/auth/remembered-account`(纯函数,写不出口令字段)
 * - key 名:`@ihui/shared/constants`(端内禁止再抄字面量)
 *
 * 历史明文记录的处置:`loadRemembered()` 读到旧形态时**就地抹掉口令**并保留账号
 * —— "记住账号"这一档支撑登录页历史下拉,删了是功能倒退;删掉的只有口令那一半。
 *
 * 存储格式(本端:Taro storage 无 btoa/atob,直接落 JSON 文本)
 * - ihui-remember-credentials: {"account"} —— **永远不含 password**
 * - ihui-auto-login: '1' / '0'
 * - ihui-login-history: string[](最多 LOGIN_HISTORY_MAX 个,不含口令)
 */
import { getStorageSync, setStorageSync, removeStorageSync } from '@tarojs/taro'
import type { CredentialStorage, RememberedCredentials } from '@ihui/shared/hooks'
import {
  AUTO_LOGIN_STORAGE_KEY,
  LOGIN_HISTORY_STORAGE_KEY,
  REMEMBERED_ACCOUNT_STORAGE_KEY,
} from '@ihui/shared/constants'
import {
  decodeRememberedAccount,
  encodeRememberedAccount,
  normalizeLoginHistory,
  pushLoginHistory,
} from '@ihui/shared/auth'

/** 从 Taro storage 读一个字符串值(未命中时 `getStorageSync` 返回 '' 而不是 undefined)。 */
function readText(key: string): string {
  const raw = getStorageSync(key)
  return typeof raw === 'string' ? raw : ''
}

/* ========== 记住账号(不含口令) ========== */

function loadRemembered(): RememberedCredentials | null {
  const stored = readText(REMEMBERED_ACCOUNT_STORAGE_KEY)
  if (!stored) return null
  const decoded = decodeRememberedAccount(stored)
  if (!decoded) return null
  // 旧版本把口令和账号写在同一条明文记录里 ⇒ 读出来只为把它抹掉;
  // 本端没有安全存储可迁,删了就是删了(账号那一半留在内存与盘上)。
  if (decoded.carriedPlaintextPassword) {
    persistRememberedAccount(decoded.account)
  }
  return { account: decoded.account, password: '' }
}

/** 落盘的只有账号 —— 写出去的文本由共享出口生成,结构上没有 `password` 这个字段。 */
function persistRememberedAccount(account: string): void {
  try {
    setStorageSync(REMEMBERED_ACCOUNT_STORAGE_KEY, encodeRememberedAccount(account))
  } catch {
    // storage 不可用时静默失败(与旧版同一条失效方向)
  }
}

/**
 * `CredentialStorage` 契约要求带 password(RN 那一端把它送进 Keychain)。
 * 本端**丢弃**这个入参:小程序没有可用的安全存储原语,而自动登录已改由 refreshToken
 * 续期承担,口令在换到 token 之后不需要留在本地。
 */
function saveRemembered(account: string, _password: string): void {
  persistRememberedAccount(account)
}

function clearRemembered(): void {
  try {
    removeStorageSync(REMEMBERED_ACCOUNT_STORAGE_KEY)
  } catch {
    // 静默失败
  }
}

/* ========== 自动登录 ========== */

function loadAutoLogin(): boolean {
  return readText(AUTO_LOGIN_STORAGE_KEY) === '1'
}

function saveAutoLogin(enabled: boolean): void {
  try {
    setStorageSync(AUTO_LOGIN_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // 静默失败
  }
}

function clearAutoLogin(): void {
  try {
    removeStorageSync(AUTO_LOGIN_STORAGE_KEY)
  } catch {
    // 静默失败
  }
}

/* ========== 账号历史 ========== */

function writeHistory(list: readonly string[]): void {
  try {
    setStorageSync(LOGIN_HISTORY_STORAGE_KEY, JSON.stringify(list))
  } catch {
    // 静默失败
  }
}

function saveLoginHistory(account: string): void {
  writeHistory(pushLoginHistory(loadLoginHistory(), account))
}

function loadLoginHistory(): string[] {
  const raw = readText(LOGIN_HISTORY_STORAGE_KEY)
  if (!raw) return []
  return normalizeLoginHistory(raw)
}

/** 删除单条账号历史,返回删除后的列表(供历史下拉 X 删除) */
function removeFromLoginHistory(account: string): string[] {
  const next = loadLoginHistory().filter((item) => item !== account)
  writeHistory(next)
  return next
}

/** 清空全部账号历史,返回空列表(供历史下拉"清空全部") */
function clearLoginHistory(): string[] {
  try {
    removeStorageSync(LOGIN_HISTORY_STORAGE_KEY)
  } catch {
    // 静默失败
  }
  return []
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
  loadLoginHistory,
  removeFromLoginHistory,
  clearLoginHistory,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
