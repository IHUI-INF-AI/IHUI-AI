// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全服务（风控/异常检测/IP 信誉/输入校验）。
 * 迁移自旧架构 security_service.py。
 *
 * 提供：
 * - RateLimiter: 基于 Redis 滑动窗口限流（每分钟/每小时）
 */

import type { FastifyRequest } from 'fastify'
import type IORedis from 'ioredis'

// =============================================================================
// RateLimiter - Redis 滑动窗口限流
// =============================================================================

export interface RateLimitResult {
  allowed: boolean
  message?: string
  retryAfter?: number
}

/** 每档窗口的「加一 + 首次置 TTL」必须在同一次 EVAL 内完成(SDB-06)。
 *
 * 旧写法是先 `incr`、再按返回值 `=== 1` 补 `expire`:进程若在这两步之间崩溃、
 * 或连接在 `expire` 前断开,key 就永远没有 TTL —— 计数只增不减,该 IP/用户被
 * 永久限流(重启进程也不恢复),内存 Redis 里还会长期堆积这类死键。
 * 而错过之后 `=== 1` 再也不会成立,所以只能靠脚本把两步合成一个原子单元。
 * 同时对 `TTL < 0`(修复前遗留的无过期键)补一次 TTL,让存量坏键自愈。 */
const RATE_LIMIT_SCRIPT = `
local function bump(key, ttl)
  local n = redis.call('INCR', key)
  if n == 1 or redis.call('TTL', key) < 0 then redis.call('EXPIRE', key, ttl) end
  return n
end
local minute = bump(KEYS[1], tonumber(ARGV[1]))
local hour = bump(KEYS[2], tonumber(ARGV[2]))
return {minute, hour}
`

export class RateLimiter {
  constructor(
    private readonly redis: IORedis,
    private readonly requestsPerMinute = 60,
    private readonly requestsPerHour = 1000,
  ) {}

  /** 从请求中提取客户端 IP(2026-07-21 安全审计第十轮加固)。
   *
   * 不再直接读 X-Forwarded-For 头 — 因为 Fastify 已通过 trustProxy 配置
   * 在解析阶段验证代理 IP,request.ip 已经是真实客户端 IP(或最后可信代理 IP)。
   * 手工读 X-Forwarded-For 会绕过 trustProxy 检查,被攻击者伪造任意 IP 绕过
   * 限流 / IP 拉黑 / 失败计数(例如:Authorization: bypass, X-Forwarded-For: 1.1.1.1)。
   */
  static getClientIp(request: FastifyRequest): string {
    return request.ip
  }

  /**
   * 检查是否允许请求。
   * key 维度由调用方决定（IP / userId / IP+路由）。
   */
  async isAllowed(key: string): Promise<RateLimitResult> {
    const minuteKey = `rl:m:${key}`
    const hourKey = `rl:h:${key}`

    const [minuteCount, hourCount] = (await this.redis.eval(
      RATE_LIMIT_SCRIPT,
      2,
      minuteKey,
      hourKey,
      '60',
      '3600',
    )) as [number, number]

    if (minuteCount > this.requestsPerMinute) {
      return {
        allowed: false,
        message: `超过每分钟请求限制(${this.requestsPerMinute})`,
        retryAfter: 60,
      }
    }
    if (hourCount > this.requestsPerHour) {
      return {
        allowed: false,
        message: `超过每小时请求限制(${this.requestsPerHour})`,
        retryAfter: 3600,
      }
    }
    return { allowed: true }
  }
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
