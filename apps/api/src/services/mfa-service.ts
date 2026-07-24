/**
 * MFA (多因素认证) 服务层 — 国安级 TOTP + 备份恢复码。
 *
 * 设计:
 * - TOTP 核心复用 ./totp-service.js (RFC 6238 手工实现,零冗余)
 * - 备份恢复码:16 字节 hex,SHA-256 哈希存储,常量时间校验
 * - 密钥加密:AES-256-GCM (复用 ../utils/crypto.js),DB 只存密文 bytea
 *
 * 本模块为纯密码学层,不直接操作数据库。DB 读写由 routes/mfa.ts 编排。
 */
import { createHash } from 'node:crypto'
import {
  generateSecret as generateSecretBuffer,
  base32Encode,
  base32Decode,
  buildOtpauthUri,
  verifyTotp,
  generateQrCodeDataUrl as totpGenerateQrCodeDataUrl,
} from './totp-service.js'
import {
  encryptJSON,
  decryptJSON,
  isEncryptedPayload,
  type EncryptedPayload,
} from '../utils/crypto.js'
import { constantTimeCompare, secureRandomBytes } from '../utils/crypto-extra.js'

// ============ TOTP (RFC 6238) ============

/**
 * 生成 20 字节 CSPRNG 密钥,返回 Base32 编码字符串。
 */
export function generateSecret(): string {
  return base32Encode(generateSecretBuffer())
}

/**
 * 构造 otpauth:// URI(可被 Google/Microsoft Authenticator 扫码识别)。
 * @param secret Base32 编码的密钥
 * @param account 用户账号(邮箱/手机号)
 * @param issuer 发行方,默认 'IHUI-AI'
 */
export function generateQRCodeURI(secret: string, account: string, issuer = 'IHUI-AI'): string {
  return buildOtpauthUri({
    secret: base32Decode(secret),
    accountName: account,
    issuer,
  })
}

/**
 * 生成 QR code data URL (data:image/png;base64,...)。
 * 依赖 qrcode 包;缺失时回退返回 otpauth URI 本身。
 */
export async function generateQRCodeDataUrl(uri: string): Promise<string> {
  return totpGenerateQrCodeDataUrl(uri)
}

/**
 * 校验 TOTP token(±1 时间窗口,防时钟漂移)。
 * @param token 用户输入的 6 位数字
 * @param secret Base32 字符串或原始 Buffer
 * @param _window 时间窗口(默认 1 = ±1 step / ±30s)
 */
export function verifyTOTP(token: string, secret: string | Buffer, _window = 1): boolean {
  const secretBuf = typeof secret === 'string' ? base32Decode(secret) : secret
  // totp-service.verifyTotp 内部固定 ±1 窗口(3 个 counter),与 window=1 语义一致
  return verifyTotp(token, secretBuf)
}

// ============ 备份恢复码 ============

/**
 * 生成 count 个一次性恢复码(16 字节 hex,32 字符)。
 * 明文只返回一次,DB 只存 SHA-256 哈希。
 */
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    codes.push(secureRandomBytes(16).toString('hex'))
  }
  return codes
}

/**
 * 对恢复码取 SHA-256 哈希(DB 只存哈希,明文不落库)。
 * 输入大小写不敏感:统一转小写后哈希。
 */
export function hashRecoveryCode(code: string): string {
  const normalized = code.trim().toLowerCase()
  return createHash('sha256').update(normalized, 'utf8').digest('hex')
}

/**
 * 校验恢复码是否匹配哈希数组中的任一项(常量时间比较)。
 */
export function verifyRecoveryCode(code: string, hashes: string[]): boolean {
  if (!code || hashes.length === 0) return false
  const inputHash = hashRecoveryCode(code)
  for (const h of hashes) {
    if (constantTimeCompare(inputHash, h)) return true
  }
  return false
}

// ============ 密钥加密存储(AES-256-GCM → bytea) ============

/**
 * 加密 TOTP 密钥(AES-256-GCM),用于 DB two_factor_secret(bytea) 存储。
 * @param secretBase32 Base32 编码的密钥
 * @returns Buffer(JSON 序列化的 EncryptedPayload,可直接写入 bytea 列)
 */
export function encryptSecret(secretBase32: string): Buffer {
  const payload = encryptJSON(secretBase32)
  return Buffer.from(JSON.stringify(payload), 'utf8')
}

/**
 * 解密 TOTP 密钥(从 DB bytea 读取后解密)。
 * @returns Base32 编码的密钥字符串(可直接传给 verifyTOTP)
 */
export function decryptSecret(stored: Buffer): string {
  let payload: EncryptedPayload
  try {
    payload = JSON.parse(stored.toString('utf8')) as EncryptedPayload
  } catch {
    throw new Error('decryptSecret: 存储的密钥不是有效 JSON')
  }
  if (!isEncryptedPayload(payload)) {
    throw new Error('decryptSecret: 存储的密钥格式无效')
  }
  const base32 = decryptJSON(payload)
  if (typeof base32 !== 'string') {
    throw new Error('decryptSecret: 解密结果不是字符串')
  }
  return base32
}
