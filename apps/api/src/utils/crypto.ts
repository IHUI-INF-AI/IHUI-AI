// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { config } from '../config/index.js'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits

/**
 * F-218(2026-11-13):按 **字节** 而不是 UTF-16 字符数校验密钥,并拒绝多字节截断。
 *
 * 派生路径保持与历史实现完全一致:旧实现取 `key.slice(0, 32)`(32 个字符)再按 UTF-8
 * 编码,对纯 ASCII 密钥等价于「前 32 字节」。存量密文就是用该派生结果加密的,因此这里
 * 不换 KDF、不加版本前缀,只把长度判据从字符换成字节:
 *   - 少于 32 字节 → 立即报错(旧实现会静默产出不足 256 位的密钥,或让 createCipheriv
 *     抛出不指向配置项的 ERR_CRYPTO_INVALID_KEYLEN);
 *   - 前 32 字节切在多字节字符中间 → 立即报错(旧实现按字符截断后字节数 > 32,同样在
 *     createCipheriv 处失败,且错误信息无法定位到配置)。
 * 报错信息只含字节数,不含密钥内容(不得把密钥写进日志/响应)。
 */
function getKey(): Buffer {
  const key = config.CREDENTIALS_ENCRYPTION_KEY
  const keyBytes = Buffer.from(key, 'utf8')
  if (keyBytes.length < KEY_LENGTH) {
    throw new Error(
      `CREDENTIALS_ENCRYPTION_KEY 字节长度不足:需要至少 ${KEY_LENGTH} 字节,当前 ${keyBytes.length} 字节`,
    )
  }
  const derived = keyBytes.subarray(0, KEY_LENGTH)
  // 32 字节边界若落在多字节字符中间,toString('utf8') 会出现替换字符,往返编码不再相等。
  if (!Buffer.from(derived.toString('utf8'), 'utf8').equals(derived)) {
    throw new Error(
      `CREDENTIALS_ENCRYPTION_KEY 前 ${KEY_LENGTH} 字节不是完整字符边界(含多字节字符),请改用 ${KEY_LENGTH} 字节 ASCII/hex 随机串`,
    )
  }
  return derived
}

export interface EncryptedPayload {
  iv: string // base64
  ciphertext: string // base64
  tag: string // base64
}

/**
 * 加密任意可 JSON 序列化的值，返回 { iv, ciphertext, tag } 结构。
 */
export function encryptJSON(data: unknown): EncryptedPayload {
  const key = getKey()
  const iv = randomBytes(12) // GCM 推荐 12 字节 IV
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const plaintext = Buffer.from(JSON.stringify(data), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: tag.toString('base64'),
  }
}

/**
 * 解密 { iv, ciphertext, tag } 结构，返回原始值。
 *
 * P0-5m(2026-07-30):兼容裸字符串格式(非 JSON.stringify 包裹)。
 * 旧格式:encryptJSON("key") → 加密 JSON.stringify("key")='"key"' → JSON.parse → "key"
 * 新格式:直接加密 "key" → JSON.parse("key") 会失败 → 回退返回裸字符串
 */
export function decryptJSON(payload: EncryptedPayload): unknown {
  const key = getKey()
  const iv = Buffer.from(payload.iv, 'base64')
  const ciphertext = Buffer.from(payload.ciphertext, 'base64')
  const tag = Buffer.from(payload.tag, 'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  const text = plaintext.toString('utf8')
  try {
    return JSON.parse(text)
  } catch {
    // 非 JSON 格式(裸字符串),直接返回
    return text
  }
}

/**
 * 判断值是否为加密 payload 格式（含 iv/ciphertext/tag 三字段）。
 */
export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.iv === 'string' && typeof v.ciphertext === 'string' && typeof v.tag === 'string'
}

/**
 * 字段级加密（P0 隐私修复）：把单个字符串字段加密后以 JSON 字符串落库。
 * 用于姓名/身份证等敏感字段写时加密，读时经 decryptField 还原。
 * 底层复用 encryptJSON（AES-256-GCM，应用级密钥 = CREDENTIALS_ENCRYPTION_KEY）。
 */
export function encryptField(plain: string): string {
  return JSON.stringify(encryptJSON(plain))
}

/**
 * 字段级解密：兼容新格式（encrypted payload JSON）与存量明文。
 * - 存量为加密 payload → AES-256-GCM 解密返回原始字符串
 * - 存量明文（未加密历史数据）→ 原样返回（兼容读路径，不报错）
 *
 * 解密失败必须抛出，**不得**回落到 `stored`：`stored` 本身就是加密荷载的 JSON 文本，
 * 一旦当明文返回，读路径（auth-identity 的 idCard）会把整段密文当成身份证号送到客户端，
 * 于是"密钥已换 / 数据被篡改"与"成功读到明文"在响应上完全同形。
 */
export function decryptField(stored: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch {
    return stored // 存量明文：不是 JSON
  }
  if (!isEncryptedPayload(parsed)) return stored // 存量明文：是 JSON 但不是加密荷载形状
  const value = decryptJSON(parsed)
  return typeof value === 'string' ? value : String(value ?? '')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
