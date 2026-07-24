/**
 * 安全密码学工具集(国安级 MFA 配套)。
 *
 * - constantTimeCompare: 常量时间字符串比较,防 timing attack
 * - secureRandomBytes / secureRandomInt: CSPRNG 随机数(无偏拒绝采样)
 * - hmacSHA256 / hmacVerify: HMAC-SHA256 签名与验签
 */
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto'

/**
 * 常量时间字符串比较。
 * 长度不同时仍执行一次假比较,保证耗时与等长情况接近,防时序泄露。
 */
export function constantTimeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA) // 假比较,消耗相近时间
    return false
  }
  return timingSafeEqual(bufA, bufB)
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
export function hmacVerify(key: string | Buffer, data: string | Buffer, signature: string): boolean {
  return constantTimeCompare(hmacSHA256(key, data), signature)
}
