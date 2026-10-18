// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全密码学工具集(国安级 MFA 配套)。
 *
 * - constantTimeCompare: 常量时间字符串比较,防 timing attack
 * - secureRandomBytes / secureRandomInt: CSPRNG 随机数(无偏拒绝采样)
 * - hmacSHA256 / hmacVerify: HMAC-SHA256 签名与验签
 */
import { randomBytes, createHmac } from 'node:crypto'
import { secretsEqual } from '../plugins/internal-service-token.js'

/**
 * 常量时间字符串比较。
 * 经全仓唯一比较出口 secretsEqual(定长散列 + timingSafeEqual):长度不等不抛、
 * 无长度泄漏、无前缀早退 —— 时序安全性不弱于原先"长度不等时喂一次假比较"的形态。
 */
export function constantTimeCompare(a: string, b: string): boolean {
  return secretsEqual(a, b)
}

/**
 * 生成 length 字节 CSPRNG 随机数据。
 */
export function secureRandomBytes(length: number): Buffer {
  return randomBytes(length)
}

/**
 * 无偏随机整数 [0, max),使用拒绝采样消除模偏差。
 */
export function secureRandomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error('secureRandomInt: max 必须为正整数')
  }
  if (max === 1) return 0
  const RANGE = 2 ** 32
  const limit = RANGE - (RANGE % max) // 最大可接受值上界(不含)
  let x = secureRandomBytes(4).readUInt32BE(0)
  while (x >= limit) {
    x = secureRandomBytes(4).readUInt32BE(0)
  }
  return x % max
}

/**
 * HMAC-SHA256 签名,返回 hex 字符串。
 */
export function hmacSHA256(key: string | Buffer, data: string | Buffer): string {
  const keyBuf = typeof key === 'string' ? Buffer.from(key, 'utf8') : key
  const dataBuf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data
  return createHmac('sha256', keyBuf).update(dataBuf).digest('hex')
}

/**
 * 常量时间验证 HMAC-SHA256 签名。
 */
export function hmacVerify(
  key: string | Buffer,
  data: string | Buffer,
  signature: string,
): boolean {
  return constantTimeCompare(hmacSHA256(key, data), signature)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
