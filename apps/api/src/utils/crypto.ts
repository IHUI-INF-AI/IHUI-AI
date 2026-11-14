// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { config } from '../config/index.js'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits

function getKey(): Buffer {
  const key = config.CREDENTIALS_ENCRYPTION_KEY
  if (key.length < KEY_LENGTH) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY 必须至少 32 字符')
  }
  return Buffer.from(key.slice(0, KEY_LENGTH))
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

/**
 * DB-35(2026-11-14):第三方凭据的紧凑加密格式。
 *
 * 与 encryptField 的 JSON 荷载相比,这里没有 JSON 引号/字段名开销:固定头部 49 字符
 * (`enc:v1:` + base64(iv 12B) + ':' + base64(tag 16B) + ':'),密文是 4×ceil(n/3),
 * 因此同样的 varchar 长度能容纳更长的密钥。
 * 格式:`enc:v1:<base64(iv)>:<base64(tag)>:<base64(ciphertext)>`。
 *
 * 幂等:已带前缀的值原样返回(upsert 读改写路径不会二次加密);空串原样返回。
 * maxStoredLength:目标列长度上限,超出直接抛错(含上限值,不含明文/密文),
 * 让"写不进去"在写路径就暴露,而不是等 DB 截断/报错。
 */
const CREDENTIAL_PREFIX = 'enc:v1:'

export function encryptCredential(plain: string, maxStoredLength?: number): string {
  if (plain === '' || plain.startsWith(CREDENTIAL_PREFIX)) return plain
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()])
  const tag = cipher.getAuthTag()
  const stored = `${CREDENTIAL_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`
  if (maxStoredLength !== undefined && stored.length > maxStoredLength) {
    throw new Error(
      `凭据加密后长度 ${stored.length} 超过存储上限 ${maxStoredLength},请缩短凭据后再保存`,
    )
  }
  return stored
}

/**
 * 凭据解密:非 `enc:v1:` 前缀视为存量明文原样返回(兼容历史数据);
 * 前缀匹配但格式/认证失败**必须抛错**,绝不回落成明文——否则"密钥已换/数据被篡改"
 * 与"成功读到明文"在响应上同形,下游会拿密文当密钥去调第三方。
 */
export function decryptCredential(stored: string): string {
  if (!stored.startsWith(CREDENTIAL_PREFIX)) return stored
  const parts = stored.slice(CREDENTIAL_PREFIX.length).split(':')
  if (parts.length !== 3) {
    throw new Error('凭据密文格式非法:字段数不为 3,拒绝按明文处理')
  }
  const [ivB64, tagB64, ciphertextB64] = parts as [string, string, string]
  const key = getKey()
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
