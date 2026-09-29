// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 记住账号 + 账号历史 + 自动登录 凭据管理(票 #27 web 端收口,2026-09-29)
 *
 * 本文件**不再持久化口令**。旧版把 `{account, password}` 经
 * `base64(encodeURIComponent(JSON))` 写 localStorage —— base64 是编码不是加密,
 * 一步可还原。而浏览器没有能给普通网页"任意保存第三方站点口令、事后再静默取回"的
 * OS 级安全存储(Web Credentials / PasswordCredential 只服务于浏览器自动填充与
 * 联合登录,页面 JS 拿不到静默读取的能力),所以"把 base64 换成 AES"同样不解决问题:
 * 密钥只能落在同一 origin 的存储里,XSS / 同源脚本 / 读到磁盘的进程拿得到密文
 * 就拿得到钥匙 —— 与不加密等价。
 *
 * 自动登录不需要口令:refresh token 静默续期早已承担这件事
 * (`apps/web/src/hooks/use-auth-bootstrap.ts` 靠 httpOnly refresh cookie 调
 * `/auth/refresh`;运行中 401 由 `@ihui/api-client` 的 fetchApi 自动续期)。
 * 口令在换到 token 之后就没有存在本地的理由,于是本地也不该留它。
 *
 * 记录形态 / key 名 / 历史上限的唯一真相在 `@ihui/shared`(RN / 小程序用同一份实现):
 * - 编解码:`@ihui/shared/auth/remembered-account`(纯函数,结构上写不出口令字段)
 * - key 名:`@ihui/shared/constants/storage-keys`(端内禁止再抄字面量)
 * 本文件只保留 web/extension 的平台运输层:localStorage 读写 + 认出**历史 base64
 * 传输形态**并把它就地改写成"只含账号"的 JSON(迁移义务 —— 不是"新写入才干净")。
 *
 * "记住账号"(登录历史下拉 + 账号回填)完整保留:账号不是机密,删掉是功能倒退;
 * 删掉的只有口令那一半。
 *
 * 存储格式(localStorage,btoa/atob 可用)
 * - ihui-remember-credentials: {"account"} —— **永远不含 password**(历史 base64 形态读到即抹)
 * - ihui-auto-login: '1' / '0'
 * - ihui-login-history: string[](最多 LOGIN_HISTORY_MAX 个,不含口令;历史 base64 形态仍可读)
 */

import {
  decodeRememberedAccount,
  encodeRememberedAccount,
  normalizeLoginHistory,
  pushLoginHistory,
} from '@ihui/shared/auth/remembered-account'
import {
  AUTO_LOGIN_STORAGE_KEY,
  LOGIN_HISTORY_STORAGE_KEY,
  REMEMBERED_ACCOUNT_STORAGE_KEY,
} from '@ihui/shared/constants/storage-keys'

export interface RememberedCredentials {
  account: string
  password: string
}

/** 解出历史传输形态 `btoa(unescape(encodeURIComponent(text)))`;非 base64 ⇒ null。 */
function decodeLegacyTransport(raw: string): string | null {
  try {
    const binary = atob(raw)
    return new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)))
  } catch {
    return null
  }
}

function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    // localStorage 不可用时静默失败(与旧版同一条失效方向)
    return null
  }
}

/* ========== 记住账号(不含口令) ========== */

/**
 * 写盘的只有账号。`_password` 入参只为保留调用方与跨端 `CredentialStorage` 接口的形状,
 * 值被**丢弃**:web 没有任何可放它的地方(见文件头),自动登录由 token 续期承担。
 */
export function saveRememberedCredentials(account: string, _password: string): void {
  try {
    localStorage.setItem(REMEMBERED_ACCOUNT_STORAGE_KEY, encodeRememberedAccount(account))
  } catch {
    // 静默失败
  }
}

/**
 * 读回记住的账号;读到旧形态(带口令的记录或 base64 传输)时**就地抹掉口令**。
 *
 * 返回值的 `password` 恒为 '' —— 这不是"没找到口令",是"这一端不再提供口令"。
 * PasswordLoginForm 的自动提交 effect 据此自然短路,自动登录走 use-auth-bootstrap
 * 的静默续期,不再重放账密。
 */
export function loadRememberedCredentials(): RememberedCredentials | null {
  const raw = readItem(REMEMBERED_ACCOUNT_STORAGE_KEY)
  if (!raw) return null
  // 新传输 = JSON 文本;旧传输 = base64(encodeURIComponent(JSON))
  const direct = decodeRememberedAccount(raw)
  const decoded = direct ?? decodeRememberedAccount(decodeLegacyTransport(raw) ?? '')
  if (decoded) {
    // 带明文口令的旧记录,或仍是 base64 传输形态 ⇒ 原位改写成"只含账号"的新传输
    if (decoded.carriedPlaintextPassword || !direct) {
      persistRememberedAccount(decoded.account)
    }
    return { account: decoded.account, password: '' }
  }
  // 解不出的垃圾记录:key 归本库所有,且旧形态可能含口令 ⇒ 删除是唯一安全方向
  clearRememberedCredentials()
  return null
}

/** 落盘的只有账号 —— 写出去的文本由共享出口生成,结构上没有 `password` 这个字段。 */
function persistRememberedAccount(account: string): void {
  try {
    localStorage.setItem(REMEMBERED_ACCOUNT_STORAGE_KEY, encodeRememberedAccount(account))
  } catch {
    // 静默失败
  }
}

export function clearRememberedCredentials(): void {
  try {
    localStorage.removeItem(REMEMBERED_ACCOUNT_STORAGE_KEY)
  } catch {
    // 静默失败
  }
}

/* ========== 自动登录 ========== */

export function saveAutoLogin(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_LOGIN_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // 静默失败
  }
}

export function loadAutoLogin(): boolean {
  return readItem(AUTO_LOGIN_STORAGE_KEY) === '1'
}

export function clearAutoLogin(): void {
  try {
    localStorage.removeItem(AUTO_LOGIN_STORAGE_KEY)
  } catch {
    // 静默失败
  }
}

/* ========== 账号历史 ========== */

/** 历史列表的落盘文本(不含口令;写普通 JSON,读侧兼容历史 base64)。 */
function writeLoginHistory(list: readonly string[]): void {
  try {
    localStorage.setItem(LOGIN_HISTORY_STORAGE_KEY, JSON.stringify(list))
  } catch {
    // 静默失败
  }
}

export function saveLoginHistory(account: string): void {
  // 去重 → 置顶 → 截断的唯一规则在 @ihui/shared/auth/remembered-account(pushLoginHistory)
  writeLoginHistory(pushLoginHistory(loadLoginHistory(), account))
}

export function loadLoginHistory(): string[] {
  const raw = readItem(LOGIN_HISTORY_STORAGE_KEY)
  if (!raw) return []
  const direct = normalizeLoginHistory(raw)
  if (direct.length > 0) return direct
  const legacy = decodeLegacyTransport(raw)
  return legacy ? normalizeLoginHistory(legacy) : []
}

export function clearLoginHistory(): string[] {
  try {
    localStorage.removeItem(LOGIN_HISTORY_STORAGE_KEY)
  } catch {
    // 静默失败
  }
  return []
}

/** 删除单个历史账号,返回更新后的列表 */
export function removeFromLoginHistory(account: string): string[] {
  const list = loadLoginHistory().filter((a) => a !== account)
  writeLoginHistory(list)
  return list
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
