/**
 * 退款失败 DLQ (Dead Letter Queue)。
 *
 * 迁移自旧架构 server/app/utils/refund_dlq.py。
 *
 * 场景: 退款失败 (网络 / 支付宝 5xx) 时业务方会重试，但有上限。
 * 超过 3 次失败后进入 DLQ，人工介入，不再自动重试。
 *
 * 存储:
 * 1. Redis ZSET (主): key=ihui:refund:dlq, score=ts, member=orderNo
 * 2. Redis HASH: key=ihui:refund:dlq:meta:<orderNo>:info, 记录重试次数 / 错误 / 上下文
 *
 * 行为:
 * - 失败 1 次: incr retry_count，1h 过期
 * - 失败 2 次: 继续累加
 * - 失败 3 次: 进入 DLQ (7 天 TTL)，触发告警
 * - 成功: 清掉 retry 记录
 *
 * 使用 apps/api/src/plugins/redis.ts 暴露的 ioredis 客户端 (调用方传入 server.redis)。
 */

import type { Redis } from 'ioredis'

/** 最大重试次数，超过即入 DLQ */
export const MAX_RETRY = 3
/** DLQ 7 天后过期 */
export const DLQ_TTL_SEC = 7 * 24 * 3600
/** 单次失败 meta 24h 后过期 */
export const META_TTL_SEC = 24 * 3600

export interface DlqEntry {
  orderNo: string
  /** 进入 DLQ 的时间戳 (毫秒) */
  failedAt: number
  retryCount: number
  error: string
  context: Record<string, unknown>
  /** 是否已隔离 (QUARANTINE) */
  quarantined?: boolean
  quarantineReason?: string
}

export type DlqAction = 'REPLAY' | 'DROP' | 'QUARANTINE'

/** DLQ 操作结果 */
export interface DlqActionResult {
  action: DlqAction
  orderNo: string
  success: boolean
  message: string
}

/**
 * 退款失败 DLQ。
 *
 * 通过构造函数注入 ioredis 客户端 (即 plugins/redis.ts 暴露的 server.redis)。
 */
export class RefundDlq {
  private readonly dlqKey: string
  private readonly metaPrefix: string

  constructor(
    private readonly redis: Redis,
    keyPrefix = 'ihui:refund:dlq',
  ) {
    this.dlqKey = keyPrefix
    this.metaPrefix = `${keyPrefix}:meta:`
  }

  private metaKey(orderNo: string): string {
    return `${this.metaPrefix}${orderNo}`
  }

  private infoKey(orderNo: string): string {
    return `${this.metaKey(orderNo)}:info`
  }

  /**
   * 记录退款失败，返回当前重试次数 (1-based)。
   * 第 3 次失败时自动进入 DLQ。
   *
   * @returns retryCount；-1 表示 Redis 异常
   */
  async recordRefundFailure(
    orderNo: string,
    error: string,
    context: Record<string, unknown> = {},
  ): Promise<number> {
    try {
      const now = Date.now()
      const key = this.metaKey(orderNo)
      const retryCount = await this.redis.incr(key)
      if (retryCount === 1) {
        await this.redis.expire(key, META_TTL_SEC)
      }
      await this.redis.hset(this.infoKey(orderNo), {
        order_no: orderNo,
        error,
        ts: String(now),
        retry_count: String(retryCount),
        context: JSON.stringify(context),
      })
      await this.redis.expire(this.infoKey(orderNo), META_TTL_SEC)

      if (retryCount >= MAX_RETRY) {
        // 进入 DLQ
        await this.redis.zadd(this.dlqKey, now, orderNo)
        await this.redis.expire(this.dlqKey, DLQ_TTL_SEC)
      }
      return retryCount
    } catch {
      return -1
    }
  }

  /**
   * 直接将退款失败入队 (跳过重试计数，用于明确需要人工介入的场景)。
   */
  async enqueueRefundFailure(
    orderNo: string,
    error: string,
    context: Record<string, unknown> = {},
  ): Promise<void> {
    const now = Date.now()
    await this.redis.zadd(this.dlqKey, now, orderNo)
    await this.redis.expire(this.dlqKey, DLQ_TTL_SEC)
    await this.redis.hset(this.infoKey(orderNo), {
      order_no: orderNo,
      error,
      ts: String(now),
      retry_count: String(MAX_RETRY),
      context: JSON.stringify(context),
    })
    await this.redis.expire(this.infoKey(orderNo), DLQ_TTL_SEC)
  }

  /**
   * 退款成功后清除失败记录。
   */
  async clearRefundFailure(orderNo: string): Promise<void> {
    await this.redis.del(this.metaKey(orderNo))
    await this.redis.del(this.infoKey(orderNo))
    await this.redis.zrem(this.dlqKey, orderNo)
  }

  /**
   * 当前失败次数。
   */
  async getRetryCount(orderNo: string): Promise<number> {
    const v = await this.redis.get(this.metaKey(orderNo))
    return v ? Number(v) : 0
  }

  /**
   * 列出 DLQ 中的订单。
   */
  async listDlq(limit = 100): Promise<DlqEntry[]> {
    const items = await this.redis.zrange(this.dlqKey, 0, limit - 1, 'WITHSCORES')
    const out: DlqEntry[] = []
    for (let i = 0; i < items.length; i += 2) {
      const orderNo = items[i]!
      const ts = Number(items[i + 1]!)
      const info = await this.redis.hgetall(this.infoKey(orderNo))
      out.push({
        orderNo,
        failedAt: ts,
        retryCount: info.retry_count ? Number(info.retry_count) : MAX_RETRY,
        error: info.error ?? '',
        context: info.context ? safeParse(info.context) : {},
        quarantined: info.quarantined === '1' ? true : undefined,
        quarantineReason: info.quarantine_reason || undefined,
      })
    }
    return out
  }

  /**
   * DLQ 当前大小。
   */
  async dlqSize(): Promise<number> {
    return this.redis.zcard(this.dlqKey)
  }

  /**
   * REPLAY: 从 DLQ 移除并清零重试计数，允许重新处理。
   */
  async replayRefund(orderNo: string): Promise<boolean> {
    await this.redis.zrem(this.dlqKey, orderNo)
    await this.redis.del(this.metaKey(orderNo))
    await this.redis.del(this.infoKey(orderNo))
    return true
  }

  /**
   * DROP: 彻底删除 DLQ 记录。
   */
  async dropRefund(orderNo: string): Promise<boolean> {
    await this.redis.zrem(this.dlqKey, orderNo)
    await this.redis.del(this.metaKey(orderNo))
    await this.redis.del(this.infoKey(orderNo))
    return true
  }

  /**
   * QUARANTINE: 标记为隔离，保留记录但不自动重试。
   */
  async quarantineRefund(orderNo: string, reason = ''): Promise<boolean> {
    await this.redis.hset(this.infoKey(orderNo), {
      quarantined: '1',
      quarantine_reason: reason,
      quarantine_ts: String(Date.now()),
    })
    return true
  }

  /**
   * 执行 DLQ 管理操作。
   */
  async performAction(orderNo: string, action: DlqAction, reason = ''): Promise<DlqActionResult> {
    let success = false
    let message = ''
    switch (action) {
      case 'REPLAY':
        success = await this.replayRefund(orderNo)
        message = success ? '已重新入队，允许重试' : '重放失败'
        break
      case 'DROP':
        success = await this.dropRefund(orderNo)
        message = success ? '已丢弃' : '丢弃失败'
        break
      case 'QUARANTINE':
        success = await this.quarantineRefund(orderNo, reason)
        message = success ? '已隔离' : '隔离失败'
        break
    }
    return { action, orderNo, success, message }
  }
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>
  } catch {
    return {}
  }
}
