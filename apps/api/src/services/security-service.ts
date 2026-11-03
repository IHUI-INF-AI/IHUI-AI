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

    const [minuteCount, hourCount] = await Promise.all([
      this.redis.incr(minuteKey),
      this.redis.incr(hourKey),
    ])
    // 首次写入时设置 TTL
    if (minuteCount === 1) await this.redis.expire(minuteKey, 60)
    if (hourCount === 1) await this.redis.expire(hourKey, 3600)

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
