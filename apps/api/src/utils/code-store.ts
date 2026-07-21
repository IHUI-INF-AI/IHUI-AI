/** 验证码内存存储与校验工具,供 auth / users 等路由共享。 */
import { generateNumericCode } from './crypto-random.js'

export interface CodeEntry {
  code: string
  expiresAt: number
  sentAt: number
}

/** 验证码内存存储：phone -> { code, expiresAt, sentAt } */
export const codeStore = new Map<string, CodeEntry>()

export const CODE_TTL_MS = 5 * 60 * 1000 // 5 分钟有效
export const CODE_RESEND_INTERVAL_MS = 60 * 1000 // 60 秒内不可重发

/** 生成 6 位数字验证码(密码学安全)。 */
export function generateCode(): string {
  // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成短信验证码,
  // Math.random 可预测 -> 攻击者可暴力枚举接管账号
  return generateNumericCode(6)
}

/** 清理已过期的验证码。 */
export function cleanupExpiredCodes(): void {
  const now = Date.now()
  for (const [phone, entry] of codeStore) {
    if (entry.expiresAt < now) codeStore.delete(phone)
  }
}

/**
 * 校验验证码：匹配且未过期时返回 true 并删除该验证码(一次性使用)。
 */
export function verifyCode(phone: string, code: string): boolean {
  const entry = codeStore.get(phone)
  if (!entry || entry.code !== code || entry.expiresAt < Date.now()) {
    return false
  }
  codeStore.delete(phone)
  return true
}
