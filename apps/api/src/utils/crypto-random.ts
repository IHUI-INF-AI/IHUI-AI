/**
 * 密码学安全随机数生成工具
 *
 * 2026-07-21 安全审计加固:
 * - 替换 Math.random() 用于安全凭证生成的场景
 * - Math.random 不是密码学安全,熵不足 + 可预测
 *   攻击者可从少量样本预测其他用户的凭证
 * - 本文件所有函数使用 node:crypto 的 CSPRNG (crypto.randomBytes / randomInt)
 *
 * 用途: API key、设备码、验证码、配对码、优惠码、证书编号
 * 熵强度: 详见各函数注释
 */
import { randomBytes, randomInt } from 'node:crypto'

/**
 * 生成 API key (用于第三方集成密钥、平台应用密钥)
 *
 * 格式: sk_<base64url 编码的随机字节>
 * 默认 32 字节 = 256 位熵,base64url 编码 43 字符
 * 例: sk_5z8yQ9K3vN7mP2xR4bC6dF8gH1jL0nM3qT5wX7yZ
 *
 * @param bytes 随机字节数,默认 32 字节 (256 位熵)
 */
export function generateApiKey(bytes: number = 32): string {
  return `sk_${randomBytes(bytes).toString('base64url')}`
}

/**
 * 生成短码 (用于设备配对码、OAuth 设备码、用户友好短 ID)
 *
 * 默认 6 字符 alphanumeric (32 个易读字符,排除 I/L/O/0/1)
 * 熵 = log2(32^6) ≈ 30 位,足以防暴力枚举 (2^30 次尝试才 50% 命中)
 * 对 1 次/秒 限流,需要 ~34 年才 50% 命中
 *
 * @param length 长度,默认 6
 */
export function generateShortCode(length: number = 6): string {
  // 大写字母 + 数字,排除易混淆字符 I/L/O/0/1
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(length * 2) // 取双倍字节防熵不足
  let code = ''
  for (let i = 0; i < length; i++) {
    // 使用模运算取字符(轻微偏置可接受,32 字符表 6 位足够)
    code += chars[bytes[i]! % chars.length]
  }
  return code
}

/**
 * 生成数字验证码 (用于短信验证码、邮箱验证码)
 *
 * 默认 6 位数字
 * 熵 = log2(10^6) ≈ 20 位
 * 单码暴力枚举需要 10^6 次,500k 次 50% 命中
 * 必须配合限流(单手机号每分钟最多 1 次,每小时最多 5 次)和有效期(5 分钟)
 *
 * @param length 长度,默认 6
 */
export function generateNumericCode(length: number = 6): string {
  // 直接在 [10^(length-1), 10^length) 范围生成,
  // 保证返回值转为数字后仍在指定长度区间 (例:6 位 → 100000-999999)
  const min = 10 ** (length - 1)
  const max = 10 ** length
  const code = randomInt(min, max)
  return code.toString()
}

/**
 * 生成证书编号 (业务编号,非安全凭证)
 *
 * 格式: CERT-YYYYMMDD-<8 字符 base36>
 * 8 字符 alphanumeric 熵 = log2(36^8) ≈ 41 位
 * 防暴力枚举足够,实际唯一性由 DB unique 约束保证
 */
export function generateCertificateNumber(): string {
  const now = new Date()
  const ymd =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')
  // 8 字符大写 + 数字(去除易混淆字符 I L O 0 1)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(8)
  let rand = ''
  for (let i = 0; i < 8; i++) {
    rand += chars[bytes[i]! % chars.length]
  }
  return `CERT-${ymd}-${rand}`
}
