// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「记住登录」记录的唯一编解码出口(跨端共享,零平台依赖)
 *
 * 立因(票 #27 的第二、三端):web 把 `{account, password}` 经 `base64(encodeURIComponent(JSON))`
 * 写 localStorage,小程序把同一对字段 `JSON.stringify` 写 Taro storage —— 两端都不是加密
 * (base64 只是编码,一步可还原),而"自动登录"之所以需要这份口令,仅仅因为它是
 * "重新输账号口令来重建会话"这条路。系统里已经有 refresh token 续期
 * (web = httpOnly refresh cookie + `use-auth-bootstrap` 的 `tryRefresh()`;
 *  小程序 = `utils/auth.ts` 的 `refreshAccessToken()` + refreshToken 落 storage),
 * 所以口令从来就不是自动登录的必要条件。
 *
 * 本模块把"记住的那一档里只有账号"这一件事变成**一处定义**:
 * - `encodeRememberedAccount()` 结构上写不出口令字段;
 * - `decodeRememberedAccount()` 负责认出旧形态并用 `carriedPlaintextPassword` 点名,
 *   让调用端把它**就地抹掉**(迁移而非"新写入才干净")。
 *
 * 2026-10-17 用户决策:在支持浏览器自带记住密码的前提下,项目自身也要"记住密码"
 * 免重填 —— 因此本出口新增**显式开关** `encodeRememberedCredentials()`,仅当调用方
 * 把口令交进来时才写出口令字段;`encodeRememberedAccount()` 默认路径保持不变,
 * 不显式交口令就永远不会有口令落盘。安全性由调用方负责(见 web 端注释)。
 */

import { LOGIN_HISTORY_MAX } from '../constants/storage-keys'

/** 记住的那一档:只有账号。账号不是机密(它支撑登录页历史下拉),所以可以落盘。 */
export interface RememberedAccount {
  account: string
}

/** 显式"记住密码"开关:账号 + 口令一起落盘(仅调用方明确要求时使用)。 */
export interface RememberedAccountWithPassword extends RememberedAccount {
  password: string
}

/** 解码结果:`carriedPlaintextPassword` 为真 ⇒ 盘上那份旧记录带着明文口令,调用方必须抹掉它。 */
export interface DecodedRememberedAccount extends RememberedAccount {
  carriedPlaintextPassword: boolean
}

/** 显式"记住密码"形态的解码结果:带口令字段(调用方自行决定是否抹掉)。 */
export interface DecodedRememberedAccountWithPassword extends RememberedAccountWithPassword {
  carriedPlaintextPassword: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 把"文本形态的存储值"收成对象(部分平台会把 JSON 直接反序列化回来)。 */
function readRecord(raw: unknown): Record<string, unknown> | null {
  if (isRecord(raw)) return raw
  if (typeof raw !== 'string' || raw.length === 0) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * 写出「记住登录」记录。唯一写法:值域里没有 `password` 这个属性,
 * 所以"手滑把口令一起存了"在本出口上不可能发生 —— 这就是它存在的理由。
 *
 * 仅当调用方**显式**要存口令时,用 `encodeRememberedCredentials()`,而不是这个。
 */
export function encodeRememberedAccount(account: string): string {
  const record: RememberedAccount = { account }
  return JSON.stringify(record)
}

/**
 * 2026-10-17:显式"记住密码"写入出口 —— 账号 + 口令一起写进记录。
 *
 * 与 `encodeRememberedAccount()` 的差别:本函数在调用方把口令交进来时才
 * 把口令字段写进 JSON;不交口令时调用方应改用 `encodeRememberedAccount()`。
 * 安全性:本出口不做加密(base64 是编码不是加密,同 origin 存密文+密钥 ≈ 不加密),
 * 调用方应自行评估 localStorage / storage 暴露面(XSS、同源脚本、磁盘读取),
 * 并按需在传输层叠加额外保护。
 */
export function encodeRememberedCredentials(account: string, password: string): string {
  const record: RememberedAccountWithPassword = { account, password }
  return JSON.stringify(record)
}

/**
 * 读回「记住登录」记录。
 *
 * 只有 `account` 是非空字符串才算一条有效记录;**从不**把盘上的 `password` 交回调用方
 * (旧版本的读取逻辑要求 `account && password` 同时存在,那是把"口令"当成了这一档的
 * 必要条件,正是本次收口要拆掉的那一环)。
 */
export function decodeRememberedAccount(raw: unknown): DecodedRememberedAccount | null {
  const record = readRecord(raw)
  if (!record) return null
  const account = record.account
  if (typeof account !== 'string' || account.length === 0) return null
  const password = record.password
  return {
    account,
    carriedPlaintextPassword: typeof password === 'string' && password.length > 0,
  }
}

/**
 * 2026-10-17:显式"记住密码"读取出口 —— 把盘上记录里的口令字段交回调用方。
 *
 * 调用方据此决定:
 * - 自动登录时直接拿这份口令回放登录(配合 `canAutoSubmitCredentials` 闸门);
 * - 或仅做账号回填,口令继续走浏览器自带记忆(autoComplete)。
 *
 * 与 `decodeRememberedAccount()` 的区别:本函数**保留**口令字段而非抹掉它;
 * 读出的口令在内存里,调用方用完即弃,不应再写回存储以外的任何地方。
 */
export function decodeRememberedCredentials(raw: unknown): DecodedRememberedAccountWithPassword | null {
  const record = readRecord(raw)
  if (!record) return null
  const account = record.account
  if (typeof account !== 'string' || account.length === 0) return null
  const password = typeof record.password === 'string' ? record.password : ''
  return {
    account,
    password,
    carriedPlaintextPassword: password.length > 0,
  }
}

/** 语料归一:只保留非空字符串项(盘上可能被写坏成混合类型)。 */
export function normalizeLoginHistory(raw: unknown): string[] {
  const parsed =
    typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw) as unknown
          } catch {
            return null
          }
        })()
      : raw
  if (!Array.isArray(parsed)) return []
  return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

/**
 * 把一次登录成功的账号并进历史:去重 → 置顶 → 截断到 `LOGIN_HISTORY_MAX`。
 *
 * 这条规则此前在 web 与小程序各写一遍(顺序一样、上限一样、字面量两份),
 * 于是"最多 5 个"这件事有两处可以各改各的。
 */
export function pushLoginHistory(current: readonly string[], account: string): string[] {
  if (account.length === 0) return normalizeLoginHistory(current)
  return normalizeLoginHistory([account, ...current.filter((item) => item !== account)]).slice(
    0,
    LOGIN_HISTORY_MAX,
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
