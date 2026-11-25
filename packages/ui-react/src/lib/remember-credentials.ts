// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 记住账号 + 账号历史 + 自动登录 凭据管理(票 #27 web 端收口,2026-09-29)
 *
 * 账号本身不是机密,继续用共享编码器写 localStorage;口令只在用户显式勾选
 * 「记住密码」时交给 `remembered-password-vault.ts` 的 AES-GCM 保险箱,不再以明文
 * 或 base64 形式落 localStorage。保险箱的密钥是非导出 CryptoKey,存在 IndexedDB;
 * 只拿到 localStorage 密文的离线读取拿不到口令原文。WebCrypto/IndexedDB 不可用时
 * **不落盘**,绝不退回明文。
 *
 * 自动登录不再依赖这里的明文口令:refresh token 静默续期承担长期登录
 * (`apps/web/src/hooks/use-auth-bootstrap.ts` 靠 httpOnly refresh cookie 调
 * `/auth/refresh`;运行中 401 由 `@ihui/api-client` 的 fetchApi 自动续期)。
 * 用户勾选「记住密码」后,表单在挂载/账号变化时异步解密回填;该口令只存在内存与
 * 加密记录里。
 *
 * 记录形态 / key 名 / 历史上限的唯一真相在 `@ihui/shared`(RN / 小程序用同一份实现):
 * - 编解码:`@ihui/shared/auth/remembered-account`(纯函数,结构上写不出口令字段)
 * - key 名:`@ihui/shared/constants/storage-keys`(端内禁止再抄字面量)
 * 本文件只保留 web/extension 的平台运输层:localStorage 读写 + 认出**历史 base64
 * 传输形态**并把它就地改写成"只含账号"的 JSON(迁移义务 —— 不是"新写入才干净")。
 *
 * 存储格式(localStorage,btoa/atob 可用)
 * - ihui-remember-credentials: {"account"} —— **永远不含 password**(历史 base64 形态读到即抹)
 * - ihui-remember-password-v2: {v:2, account, iv, data} —— 仅密文;密钥在 IndexedDB
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
import {
  clearRememberedPassword as clearVaultPassword,
  getRememberedPasswordForAccount as getVaultPasswordForAccount,
  hasRememberedPasswordForAccount as hasVaultPasswordForAccount,
  saveRememberedPasswordForAccount as saveVaultPasswordForAccount,
} from './remembered-password-vault'

export interface RememberedCredentials {
  account: string
  password: string
}

/**
 * 用户**显式勾选"记住密码"**时才写入的口令。口令不再进 localStorage 明文 key,
 * 统一交给 `remembered-password-vault.ts` 的 AES-GCM 保险箱;不勾选时只留账号。
 * 换号登录且未勾选时会被 `saveRememberedCredentials` 清空口令记录,避免把上一个
 * 账号的口令填进新账号。
 */

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
 * 值被**丢弃**:口令由下面的显式「记住密码」路径单独加密保存,不走这里。
 *
 * 本函数同时**清掉已记住的口令**:它走的是登录成功但"未勾选记住密码"的分支,
 * 语义 = 用户本次不想记口令;账号历史(ihui-login-history)与账号回填 key 都不受影响。
 */
export function saveRememberedCredentials(account: string, _password: string): void {
  try {
    localStorage.setItem(REMEMBERED_ACCOUNT_STORAGE_KEY, encodeRememberedAccount(account))
  } catch {
    // 静默失败
  }
  clearVaultPassword()
}

/**
 * 勾选"记住密码"后的写入路径:账号照旧走"只含账号"的 key(历史下拉 / 回填数据源
 * 不变),口令进 AES-GCM 保险箱。返回是否成功落盘(WebCrypto/IndexedDB 不可用 ⇒ false,
 * 不退回明文)。
 */
export async function saveRememberedCredentialsWithPassword(
  account: string,
  password: string,
): Promise<boolean> {
  persistRememberedAccount(account)
  if (!password) {
    clearVaultPassword()
    return false
  }
  return saveVaultPasswordForAccount(account, password)
}

/** 同步判断某账号是否有加密口令记录(不解密,用于勾选框默认态)。 */
export function hasRememberedPasswordForAccount(account: string): boolean {
  return hasVaultPasswordForAccount(account)
}

/**
 * 读回某账号对应的口令(异步解密);账号不匹配 / 无记录 / 解密失败一律返回 ''
 * (换号不回吐旧口令)。历史明文记录会在此处迁移到保险箱并删除明文。
 */
export function getRememberedPasswordForAccount(account: string): Promise<string> {
  return getVaultPasswordForAccount(account)
}

/**
 * 读回记住的账号;读到旧形态(带口令的记录或 base64 传输)时**就地抹掉口令**。
 *
 * 返回值的 `password` 恒为 '' —— 口令已改为 AES-GCM 保险箱,无法同步解密;
 * 需要口令的调用方用下面的 `loadRememberedCredentialsWithPassword()`。
 */
export function loadRememberedCredentials(
  _options: { keepPassword?: boolean } = {},
): RememberedCredentials | null {
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

/** 异步版:账号同步读出,口令经保险箱解密;无记录/解不开时 password 为 ''。 */
export async function loadRememberedCredentialsWithPassword(): Promise<RememberedCredentials | null> {
  const remembered = loadRememberedCredentials()
  if (!remembered) return null
  const password = await getRememberedPasswordForAccount(remembered.account)
  return { account: remembered.account, password }
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
  clearVaultPassword()
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
