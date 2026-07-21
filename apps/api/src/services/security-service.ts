/**
 * 安全服务（风控/异常检测/IP 信誉/输入校验）。
 * 迁移自旧架构 security_service.py。
 *
 * 提供：
 * - RateLimiter: 基于 Redis 滑动窗口限流（每分钟/每小时）
 * - InputValidator: XSS 清洗、SQL 注入检测、文件类型校验
 * - CSRFProtection: CSRF token 生成与校验
 * - SECURITY_HEADERS: 安全响应头
 */

import { createHash, randomBytes } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type IORedis from 'ioredis';

// =============================================================================
// RateLimiter - Redis 滑动窗口限流
// =============================================================================

export interface RateLimitResult {
  allowed: boolean;
  message?: string;
  retryAfter?: number;
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
    const minuteKey = `rl:m:${key}`;
    const hourKey = `rl:h:${key}`;

    const [minuteCount, hourCount] = await Promise.all([
      this.redis.incr(minuteKey),
      this.redis.incr(hourKey),
    ]);
    // 首次写入时设置 TTL
    if (minuteCount === 1) await this.redis.expire(minuteKey, 60);
    if (hourCount === 1) await this.redis.expire(hourKey, 3600);

    if (minuteCount > this.requestsPerMinute) {
      return {
        allowed: false,
        message: `超过每分钟请求限制(${this.requestsPerMinute})`,
        retryAfter: 60,
      };
    }
    if (hourCount > this.requestsPerHour) {
      return {
        allowed: false,
        message: `超过每小时请求限制(${this.requestsPerHour})`,
        retryAfter: 3600,
      };
    }
    return { allowed: true };
  }
}

// =============================================================================
// InputValidator - 输入校验
// =============================================================================

const SQL_KEYWORDS = [
  'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'UNION',
  'OR', 'AND', 'WHERE', 'FROM', 'INTO', 'VALUES', 'SET',
];

const XSS_PATTERNS = [
  '<script', '</script>', 'javascript:', 'onerror=', 'onload=',
  'eval(', 'document.', 'window.', 'alert(',
];

export class InputValidator {
  /** 清洗 XSS（移除常见脚本标签与事件处理器）。 */
  static sanitizeString(value: string): string {
    if (typeof value !== 'string') return value;
    let sanitized = value.trim();
    for (const pattern of XSS_PATTERNS) {
      const re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      sanitized = sanitized.replace(re, '');
    }
    return sanitized;
  }

  /** 检测 SQL 注入（关键字 + 引号/分号组合）。 */
  static checkSqlInjection(value: string): boolean {
    if (typeof value !== 'string') return false;
    const upper = value.toUpperCase();
    const hasQuote = /['";]/.test(value);
    if (!hasQuote) return false;
    return SQL_KEYWORDS.some((kw) => upper.includes(kw));
  }

  /** 校验文件扩展名是否在允许列表中。 */
  static validateFileType(filename: string, allowedTypes: string[]): boolean {
    if (!filename) return false;
    const ext = filename.toLowerCase().split('.').pop() ?? '';
    return allowedTypes.includes(ext);
  }
}

// =============================================================================
// CSRFProtection - CSRF token 生成与校验（Redis 存储）
// =============================================================================

export class CSRFProtection {
  private readonly prefix = 'csrf:';

  constructor(private readonly redis: IORedis, private readonly ttlSeconds = 86400) {}

  /** 生成 CSRF token 并存入 Redis（绑定 sessionId）。 */
  async generateToken(sessionId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const data = `${sessionId}:${token}`;
    const key = `${this.prefix}${createHash('sha256').update(data).digest('hex')}`;
    await this.redis.setex(key, this.ttlSeconds, sessionId);
    return token;
  }

  /** 校验 CSRF token。 */
  async validateToken(token: string, sessionId: string): Promise<boolean> {
    if (!token) return false;
    const data = `${sessionId}:${token}`;
    const key = `${this.prefix}${createHash('sha256').update(data).digest('hex')}`;
    const stored = await this.redis.get(key);
    return stored === sessionId;
  }

  /** 清理过期 token（Redis TTL 自动清理，此方法为兼容保留）。 */
  async cleanupExpired(): Promise<void> {
    // Redis setex 自动过期，无需手动清理
  }
}

// =============================================================================
// 安全响应头
// =============================================================================

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:;",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

/**
 * 异常检测：检查 IP 是否在黑名单（Redis set）中。
 * 黑名单 key: sec:ip:blacklist
 */
export async function isIpBlacklisted(redis: IORedis, ip: string): Promise<boolean> {
  try {
    return (await redis.sismember('sec:ip:blacklist', ip)) === 1;
  } catch {
    return false;
  }
}

/**
 * IP 信誉记录：连续失败 N 次后自动加入黑名单。
 * key: sec:ip:fail:<ip>（计数），达到阈值则写入黑名单。
 */
export async function recordIpFailure(
  redis: IORedis,
  ip: string,
  threshold = 10,
  windowSeconds = 3600,
): Promise<boolean> {
  const key = `sec:ip:fail:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds);
  if (count >= threshold) {
    await redis.sadd('sec:ip:blacklist', ip);
    return true;
  }
  return false;
}

/** 清除 IP 失败计数（登录成功时调用）。 */
export async function clearIpFailures(redis: IORedis, ip: string): Promise<void> {
  await redis.del(`sec:ip:fail:${ip}`);
}
