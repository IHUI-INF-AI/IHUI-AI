// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DB-35(2026-11-14):发票抬头等 PII 字段的读写收口。
 *
 * 本文件只做空值/形状收口,密码学一律复用 `utils/crypto.ts`:
 * - `encryptCredential` / `decryptCredential` 是紧凑格式 `enc:v1:iv:tag:ct`
 *   (固定头 49 字符 + 4×ceil(n/3)),比 JSON 荷载更省 varchar;
 * - 已带前缀的值幂等返回,upsert 读改写不会二次加密;
 * - 非前缀视为存量明文原样返回,历史数据无需回写;
 * - 前缀匹配但认证失败**必须抛错**,绝不回落成密文——否则"密钥已换/数据被篡改"
 *   与"成功读到明文"在响应上完全同形。
 *
 * 字段口径只维护一份:learn_invoice_titles 与 edu_invoice_titles 共用
 * `INVOICE_PII_KEYS`,避免两张表各自漏字段。
 */
import { decryptCredential, encryptCredential } from './crypto.js'

/** 两张发票抬头表共用的敏感字段集合。 */
export const INVOICE_PII_KEYS = ['taxNo', 'bank', 'bankAccount', 'address', 'phone'] as const

export type InvoicePiiKey = (typeof INVOICE_PII_KEYS)[number]

/** 发票抬头敏感字段的最小结构约束(两张表都满足)。 */
export type InvoicePiiFields = Partial<Record<InvoicePiiKey, string | null>>

/**
 * 加密单个 PII 文本。
 * - `null`/`undefined` 原样透传(可空列不该被写成 'null' 字符串);
 * - 空串由 `encryptCredential` 原样返回(与"未填写"同义);
 * - 已带 `enc:v1:` 前缀的值幂等返回。
 */
export function encryptPiiText(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined) return value
  return encryptCredential(value)
}

/**
 * 解密单个 PII 文本。
 * - `null`/`undefined` 原样透传;
 * - 存量明文(无前缀)原样返回;
 * - 密文格式/认证失败抛错,由调用方决定是 500 还是落 null + 告警。
 */
export function decryptPiiText(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined) return value
  return decryptCredential(value)
}

function mapInvoiceFields<T extends InvoicePiiFields>(
  fields: T,
  fn: (value: string | null | undefined) => string | null | undefined,
): T {
  const out: Record<string, unknown> = { ...fields }
  for (const key of INVOICE_PII_KEYS) {
    // 只处理调用方显式提供的键:更新语句里未出现的字段必须保持 undefined,
    // 一旦补成 null 会把用户没改的银行账号清空。
    if (fields[key] !== undefined) out[key] = fn(fields[key])
  }
  return out as T
}

/** 写库前加密发票抬头的敏感字段(未提供的键保持 undefined)。 */
export function encryptInvoiceTitleFields<T extends InvoicePiiFields>(fields: T): T {
  return mapInvoiceFields(fields, encryptPiiText)
}

/** 读库后解密发票抬头的敏感字段(整行传入,可空列保持 null)。 */
export function decryptInvoiceTitleFields<T extends InvoicePiiFields>(fields: T): T {
  return mapInvoiceFields(fields, decryptPiiText)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
