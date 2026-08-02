/**
 * WebSocket 鉴权辅助(共享给所有 ws 插件)。
 *
 * 设计目标:
 *  - 统一 close code:4001=缺 token, 4003=token 无效, 4004=账号已注销(R76 软删除扩展)
 *  - 注入式 status 查询(默认 getUserStatus,允许测试覆盖)
 *  - 单一改动点,新增 ws 插件无需重复写鉴权样板
 *
 * 用法:
 *   const userId = await wsAuth(socket, query.token)
 *   if (!userId) return  // 连接已 close
 */
import type { WebSocket } from '@fastify/websocket'
import { verifyAccessToken } from '@ihui/auth'
import { getUserStatus } from '../db/usercenter-queries.js'

/** 注入式状态查询,默认从 usercenter 表读取(便于测试覆盖) */
export type UserStatusFetcher = (userId: string) => Promise<number | undefined>

/** close code 约定 */
export const WS_CLOSE = {
  MISSING_TOKEN: 4001,
  /** 触发速率限制(flooding/滥用),客户端应在退避后重试 */
  RATE_LIMITED: 4002,
  INVALID_TOKEN: 4003,
  /** 账号已注销(软删除 status=3),与 R76 requireActiveUser 一致 */
  ACCOUNT_CANCELLED: 4004,
  /** 单用户并发连接数超限(资源耗尽防护) */
  TOO_MANY_CONNECTIONS: 4005,
} as const

/**
 * WebSocket 鉴权:校验 JWT + 用户 status(非注销态)。
 *
 * 失败时直接 `socket.close(code, reason)`,返回 null;
 * 成功返回 userId,业务层可直接使用。
 */
export async function wsAuth(
  socket: WebSocket,
  token: string | undefined,
  fetchStatus: UserStatusFetcher = getUserStatus,
): Promise<string | null> {
  if (!token) {
    socket.close(WS_CLOSE.MISSING_TOKEN, '缺少 token')
    return null
  }
  let userId: string
  try {
    const payload = await verifyAccessToken(token)
    userId = payload.userId
  } catch {
    socket.close(WS_CLOSE.INVALID_TOKEN, 'token 无效')
    return null
  }
  const status = await fetchStatus(userId)
  if (status === undefined) {
    socket.close(WS_CLOSE.INVALID_TOKEN, '用户不存在')
    return null
  }
  if (status === 3) {
    socket.close(WS_CLOSE.ACCOUNT_CANCELLED, '账号已注销')
    return null
  }
  return userId
}

/**
 * 单用户并发 WebSocket 连接数限制器(防资源耗尽)。
 *
 * 使用:每个 ws 插件持有一个 limiter 实例,连接成功 acquire(userId),
 * 断开时 release(userId)。超限直接 close(4005),客户端应避免多端刷连接。
 */
export class WsUserConnectionLimiter {
  private readonly counts = new Map<string, number>()

  constructor(private readonly maxPerUser = 8) {}

  /** 尝试占用一个连接槽位,true=允许,false=超限 */
  acquire(userId: string): boolean {
    const current = this.counts.get(userId) ?? 0
    if (current >= this.maxPerUser) return false
    this.counts.set(userId, current + 1)
    return true
  }

  /** 释放一个连接槽位(连接断开时调用) */
  release(userId: string): void {
    const current = this.counts.get(userId)
    if (current === undefined) return
    if (current <= 1) this.counts.delete(userId)
    else this.counts.set(userId, current - 1)
  }

  /** 当前某用户的活跃连接数(指标/调试用) */
  currentCount(userId: string): number {
    return this.counts.get(userId) ?? 0
  }
}

/**
 * 滑动窗口速率限制器(防 ws 消息 flooding)。
 *
 * 使用:每个 ws 插件持有一个 limiter 实例,在 socket.on('message') 入口处调
 * `allow(userId)`,false 即 close(4002) 或仅丢弃该消息。
 *
 * 默认 60 条/分钟/用户(可在构造时覆盖),内存中的时间戳数组会自动剪裁过期项。
 */
export class WsRateLimiter {
  private readonly buckets = new Map<string, number[]>()

  constructor(
    private readonly maxRequests = 60,
    private readonly windowMs = 60_000,
  ) {}

  /** 判断当前消息是否允许通过,true=允许,false=超限 */
  allow(key: string): boolean {
    const now = Date.now()
    const cutoff = now - this.windowMs
    const old = this.buckets.get(key)
    const stamps = old === undefined ? [] : old.filter((t) => t > cutoff)
    if (stamps.length >= this.maxRequests) {
      this.buckets.set(key, stamps)
      return false
    }
    stamps.push(now)
    this.buckets.set(key, stamps)
    return true
  }

  /** 清除某用户的速率窗口(连接断开时调用,避免内存累积) */
  reset(key: string): void {
    this.buckets.delete(key)
  }
}
