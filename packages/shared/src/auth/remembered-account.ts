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
 * 纯度:纯函数 + 常量,不 import `node:` 内建、不触 DOM / RN / Taro API
 * (守门 126:packages/shared 的非 Node 宿主可达闭包内禁止 node: 内建)。
 * storage 读写一律留在端内,由调用方以"文本"形式喂进来 —— 端的差异是**运输方式**
 * (base64 / 原生 storage),不是**记录里允许有什么**。
 */

import { LOGIN_HISTORY_MAX } from '../constants/storage-keys'

/** 记住的那一档:只有账号。账号不是机密(它支撑登录页历史下拉),所以可以落盘。 */
export interface RememberedAccount {
  account: string
}

/** 解码结果:`carriedPlaintextPassword` 为真 ⇒ 盘上那份旧记录带着明文口令,调用方必须抹掉它。 */
export interface DecodedRememberedAccount extends RememberedAccount {
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
 */
export function encodeRememberedAccount(account: string): string {
  const record: RememberedAccount = { account }
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
