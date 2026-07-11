/**
 * Follower 保护（bug172）。
 *
 * 当从库（follower）复制延迟过大或堆积查询数过多时，
 * 暂时停止路由读流量到该 follower，避免读到陈旧数据或雪崩；
 * 冷却期过后重新放回轮询。
 *
 * 迁移自旧架构 bug172_follower_guard.py。
 */

/** Follower 保护配置。 */
export interface FollowerGuardConfig {
  /** 允许的最大复制延迟（秒），超过则拉黑 follower，默认 5 */
  maxLagSec: number
  /** 允许的最大并发查询数，超过则拒绝新请求，默认 100 */
  maxInflight: number
  /** 恢复检测间隔（秒）：距拉黑多久后重新放回，默认 10 */
  recoverySec: number
  /** 拉黑冷却时长（秒），默认 30 */
  cooldownSec: number
}

/** 默认配置。 */
export const DEFAULT_FOLLOWER_GUARD_CONFIG: FollowerGuardConfig = {
  maxLagSec: 5,
  maxInflight: 100,
  recoverySec: 10,
  cooldownSec: 30,
}

/** Follower 运行状态。 */
export interface FollowerStatus {
  /** 是否被拉黑 */
  blocked: boolean
  /** 当前并发查询数 */
  inflight: number
  /** 最近上报的复制延迟（秒） */
  lagSec: number
  /** 拉黑原因 */
  blockReason?: string
}

/** 拉黑事件记录。 */
export interface BlockEvent {
  /** 时间戳（epoch ms） */
  ts: number
  /** follower 节点 ID */
  nodeId: string
  /** 原因：lag / inflight / recovered */
  reason: string
}

/** 最大保留事件数。 */
const MAX_EVENTS = 100

/**
 * 从库过载保护：延迟或堆积超阈值时拉黑，恢复后放回。
 *
 * 使用方式：
 * 1. 定期调用 reportLag() 上报复制延迟
 * 2. 每次路由读请求前调用 acquire() 尝试获取 follower
 * 3. 请求完成后调用 release() 释放
 * 4. 定期调用 tick() 执行恢复检测
 */
export class FollowerGuard {
  private readonly cfg: FollowerGuardConfig
  /** 被拉黑的节点：nodeId → 解除拉黑的时间戳（epoch ms） */
  private readonly blocked = new Map<string, number>()
  /** 各节点当前并发数 */
  private readonly inflight = new Map<string, number>()
  /** 各节点最近延迟 */
  private readonly lag = new Map<string, number>()
  /** 拉黑原因 */
  private readonly blockReason = new Map<string, string>()
  /** 事件历史 */
  private readonly events: BlockEvent[] = []

  constructor(config: FollowerGuardConfig = DEFAULT_FOLLOWER_GUARD_CONFIG) {
    this.cfg = config
  }

  /**
   * 上报从库复制延迟。
   * @returns true 表示 follower 仍可用；false 表示延迟过大被拉黑
   */
  reportLag(nodeId: string, lagSec: number): boolean {
    this.lag.set(nodeId, lagSec)
    if (lagSec > this.cfg.maxLagSec) {
      this.block(nodeId, 'lag')
      return false
    }
    return true
  }

  /**
   * 尝试获取 follower 用于读请求。
   * @returns true 表示可用并已计入并发；false 表示被拉黑或过载
   */
  acquire(nodeId: string): boolean {
    const now = Date.now()
    const unblockAt = this.blocked.get(nodeId)
    if (unblockAt !== undefined && unblockAt > now) return false

    const cur = this.inflight.get(nodeId) ?? 0
    if (cur >= this.cfg.maxInflight) {
      this.block(nodeId, 'inflight')
      return false
    }
    this.inflight.set(nodeId, cur + 1)
    return true
  }

  /** 释放 follower 的一个并发槽位。 */
  release(nodeId: string): void {
    const cur = this.inflight.get(nodeId) ?? 0
    if (cur > 0) {
      this.inflight.set(nodeId, cur - 1)
    }
  }

  /**
   * 恢复检测：距拉黑超过 recoverySec 后重新放回。
   * 应由定时任务周期调用。
   */
  tick(): void {
    const now = Date.now()
    const recovered: string[] = []
    for (const [nodeId, unblockAt] of this.blocked) {
      // unblockAt 是拉黑冷却结束时间；冷却结束后再等 recoverySec 才恢复
      if (now >= unblockAt + this.cfg.recoverySec * 1000) {
        recovered.push(nodeId)
      }
    }
    for (const nodeId of recovered) {
      this.blocked.delete(nodeId)
      this.blockReason.delete(nodeId)
      this.pushEvent(nodeId, 'recovered')
    }
  }

  /** 拉黑一个 follower。 */
  private block(nodeId: string, reason: string): void {
    this.blocked.set(nodeId, Date.now() + this.cfg.cooldownSec * 1000)
    this.blockReason.set(nodeId, reason)
    this.pushEvent(nodeId, reason)
  }

  private pushEvent(nodeId: string, reason: string): void {
    this.events.push({ ts: Date.now(), nodeId, reason })
    if (this.events.length > MAX_EVENTS) {
      this.events.shift()
    }
  }

  /** 获取所有被拉黑 follower 的状态。 */
  status(): Record<string, FollowerStatus> {
    const now = Date.now()
    const result: Record<string, FollowerStatus> = {}
    for (const [nodeId, unblockAt] of this.blocked) {
      result[nodeId] = {
        blocked: unblockAt > now,
        inflight: this.inflight.get(nodeId) ?? 0,
        lagSec: this.lag.get(nodeId) ?? 0,
        blockReason: this.blockReason.get(nodeId),
      }
    }
    return result
  }

  /** 获取拉黑事件历史。 */
  getEvents(limit = 20): BlockEvent[] {
    return this.events.slice(-limit)
  }
}
