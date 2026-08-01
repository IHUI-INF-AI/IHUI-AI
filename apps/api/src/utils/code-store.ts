/** 验证码内存存储与校验工具,供 auth / users 等路由共享。 */
import { sql } from 'drizzle-orm'
import { generateNumericCode } from './crypto-random.js'
import { db } from '../db/index.js'

export interface CodeEntry {
  code: string
  expiresAt: number
  sentAt: number
}

/** 验证码内存存储：phone/email -> { code, expiresAt, sentAt } */
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
  for (const [key, entry] of codeStore) {
    if (entry.expiresAt < now) codeStore.delete(key)
  }
}

/**
 * 校验验证码:匹配且未过期时返回 true 并删除该验证码(一次性使用)。
 *
 * 测试 bypass(仅 NODE_ENV !== 'production'):
 * - 先查 test_verify_code_bypass 表,命中且 code 匹配 → true(不消耗内存 code)
 * - admin 账号(email=502319984@qq.com / phone=18643389808)固定验证码 123456
 * - 生产环境永远走真实验证码流程
 *
 * @param identifier phone 或 email(与发送时存入 codeStore 的 key 一致)
 */
export async function verifyCode(identifier: string, code: string): Promise<boolean> {
  // 测试 bypass:仅非生产环境,admin 账号固定验证码 123456
  if (process.env.NODE_ENV !== 'production') {
    try {
      const result = await db.execute(sql`
        SELECT 1 FROM "test_verify_code_bypass"
        WHERE "identifier" = ${identifier}
          AND "fixed_code" = ${code}
          AND "is_active" = true
        LIMIT 1
      `)
      if (Array.isArray(result) && result.length > 0) {
        return true
      }
    } catch {
      // 表不存在或查询失败时降级到内存校验(不阻塞登录流程)
    }
  }

  // 内存校验(原逻辑)
  const entry = codeStore.get(identifier)
  if (!entry || entry.code !== code || entry.expiresAt < Date.now()) {
    return false
  }
  codeStore.delete(identifier)
  return true
}
