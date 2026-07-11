/**
 * 数据库连接池泄漏检测器。
 *
 * 迁移自旧架构 app/utils/pool_leak_detector.py 和 bug152_pool_monitor.py。
 *
 * 设计：
 * - 跟踪每次 checkout / checkin（WeakMap 记录 stack trace）
 * - 超 N 秒未归还视为泄漏
 * - 提供 forceRelease 接口（后端 worker 自动回收）
 * - 超时未归还告警
 *
 * 使用：
 *   const connId = poolLeakDetector.checkout('writer', 'SELECT users');
 *   try {
 *     // ... 使用连接 ...
 *   } finally {
 *     poolLeakDetector.checkin(connId);
 *   }
 *
 *   // 定时扫描泄漏
 *   const leaks = poolLeakDetector.scanLeaks();
 */

// =============================================================================
// 类型定义
// =============================================================================

/** 借用状态。 */
export type BorrowState = 'OK' | 'TIMEOUT' | 'POOL_EXHAUSTED'

/** 连接借用记录。 */
export interface CheckOutRecord {
  /** 连接 ID（自增） */
  connId: number
  /** 连接池名称 */
  pool: string
  /** 借出时间（Unix 毫秒） */
  checkedOutAt: number
  /** 借出时的调用栈 */
  stack: string
  /** 上下文描述（如 SQL 语句摘要） */
  context: string
  /** 归还时间（Unix 毫秒），0 表示尚未归还 */
  checkedInAt: number
}

/** 泄漏检测统计。 */
export interface PoolLeakStats {
  /** 当前未归还的连接数 */
  outstanding: number
  /** 泄漏超时阈值（秒） */
  leakTimeoutSec: number
  /** 累计借出次数 */
  totalCheckout: number
  /** 累计归还次数 */
  totalCheckin: number
  /** 累计泄漏次数 */
  totalLeaked: number
  /** 累计强制回收次数 */
  totalForceReleased: number
  /** 泄漏率（0-1） */
  leakRate: number
  /** 历史保留记录数 */
  keptHistory: number
}

/** 借用操作记录（用于 stats 分析）。 */
export interface BorrowRecord {
  state: BorrowState
  /** 等待耗时（毫秒） */
  waitMs: number
  /** 使用耗时（毫秒） */
  usedMs: number
  /** 时间戳（Unix 毫秒） */
  ts: number
}

// =============================================================================
// 常量
// =============================================================================

const DEFAULT_LEAK_TIMEOUT_SEC = 300 // 5 分钟
const DEFAULT_MAX_RECORDS = 200

// =============================================================================
// 连接池泄漏检测器
// =============================================================================

/**
 * 数据库连接池泄漏检测器。
 *
 * 使用 Map（connId → CheckOutRecord）跟踪借出连接，
 * 借出时记录调用栈，归还时移除记录。
 * 超时未归还的连接在 scanLeaks() 时被标记为泄漏。
 */
export class PoolLeakDetector {
  private readonly outstanding = new Map<number, CheckOutRecord>()
  private readonly history: CheckOutRecord[] = []
  private readonly leakWarnings: CheckOutRecord[] = []
  private readonly maxRecords: number
  private leakTimeoutSec: number
  private nextId = 1
  private totalCheckout = 0
  private totalCheckin = 0
  private totalLeaked = 0
  private totalForceReleased = 0

  constructor(
    leakTimeoutSec: number = DEFAULT_LEAK_TIMEOUT_SEC,
    maxRecords: number = DEFAULT_MAX_RECORDS,
  ) {
    this.leakTimeoutSec = Math.max(1, leakTimeoutSec)
    this.maxRecords = Math.max(10, maxRecords)
  }

  /** 设置泄漏超时阈值（秒）。 */
  setTimeout(sec: number): void {
    this.leakTimeoutSec = Math.max(1, sec)
  }

  /**
   * 记录一次连接借出。
   *
   * @param pool 连接池名称（如 'writer' / 'reader'）
   * @param context 上下文描述（如 SQL 语句摘要）
   * @returns 连接 ID（>=1），用于后续 checkin
   */
  checkout(pool: string, context: string = ''): number {
    const connId = this.nextId++
    const stack = this.captureStack(8)

    const rec: CheckOutRecord = {
      connId,
      pool,
      checkedOutAt: Date.now(),
      stack,
      context,
      checkedInAt: 0,
    }

    this.outstanding.set(connId, rec)
    this.totalCheckout++

    return connId
  }

  /**
   * 归还连接。若 connId 不存在则静默忽略（可能已被 forceRelease）。
   */
  checkin(connId: number): void {
    const rec = this.outstanding.get(connId)
    if (rec === undefined) return

    rec.checkedInAt = Date.now()
    this.outstanding.delete(connId)
    this.addToHistory(rec)
    this.totalCheckin++
  }

  /**
   * 扫描超时未归还的连接，记录为泄漏。
   *
   * @returns 新发现的泄漏记录列表
   */
  scanLeaks(): CheckOutRecord[] {
    const now = Date.now()
    const thresholdMs = this.leakTimeoutSec * 1000
    const newLeaks: CheckOutRecord[] = []

    for (const [connId, rec] of this.outstanding) {
      if (now - rec.checkedOutAt > thresholdMs) {
        newLeaks.push(rec)
        this.leakWarnings.push(rec)
        this.totalLeaked++

        console.warn(
          `[pool-leak] conn_id=${rec.connId} pool=${rec.pool} ` +
            `age=${Math.round((now - rec.checkedOutAt) / 1000)}s > ${this.leakTimeoutSec}s ` +
            `context=${rec.context.slice(0, 80)}`,
        )

        // 从 outstanding 中移除（视为已泄漏，不再跟踪归还）
        this.outstanding.delete(connId)
        // 忽略 connId 未使用警告（已通过迭代器删除）
        void connId
      }
    }

    // 限制 leakWarnings 长度
    if (this.leakWarnings.length > this.maxRecords) {
      this.leakWarnings.splice(0, this.leakWarnings.length - this.maxRecords)
    }

    return newLeaks
  }

  /**
   * 强制回收指定连接。
   *
   * @returns true 表示已回收，false 表示连接不存在（可能已归还或已回收）
   */
  forceRelease(connId: number): boolean {
    const rec = this.outstanding.get(connId)
    if (rec === undefined) return false

    rec.checkedInAt = Date.now()
    this.outstanding.delete(connId)
    this.addToHistory(rec)
    this.totalForceReleased++
    return true
  }

  /**
   * 回收所有超时连接。
   *
   * @returns 回收数量
   */
  forceReleaseAllLeaked(): number {
    const now = Date.now()
    const thresholdMs = this.leakTimeoutSec * 1000
    const ids: number[] = []

    for (const [connId, rec] of this.outstanding) {
      if (now - rec.checkedOutAt > thresholdMs) {
        ids.push(connId)
      }
    }

    let count = 0
    for (const id of ids) {
      if (this.forceRelease(id)) count++
    }

    return count
  }

  /** 获取当前未归还的连接列表（用于诊断）。 */
  getOutstanding(): CheckOutRecord[] {
    return [...this.outstanding.values()].map((r) => ({ ...r }))
  }

  /** 获取最近的泄漏告警列表（最多 50 条，按时间倒序）。 */
  getLeaks(): CheckOutRecord[] {
    return this.leakWarnings
      .slice(-50)
      .reverse()
      .map((r) => ({ ...r }))
  }

  /** 获取统计信息。 */
  stats(): PoolLeakStats {
    return {
      outstanding: this.outstanding.size,
      leakTimeoutSec: this.leakTimeoutSec,
      totalCheckout: this.totalCheckout,
      totalCheckin: this.totalCheckin,
      totalLeaked: this.totalLeaked,
      totalForceReleased: this.totalForceReleased,
      leakRate:
        this.totalCheckout > 0
          ? Math.round((this.totalLeaked / this.totalCheckout) * 10000) / 10000
          : 0,
      keptHistory: this.history.length,
    }
  }

  /** 清空所有记录和计数器。 */
  clear(): void {
    this.outstanding.clear()
    this.history.length = 0
    this.leakWarnings.length = 0
    this.totalCheckout = 0
    this.totalCheckin = 0
    this.totalLeaked = 0
    this.totalForceReleased = 0
  }

  // ===========================================================================
  // 内部方法
  // ===========================================================================

  /** 捕获调用栈（限制深度）。 */
  private captureStack(limit: number): string {
    const err = new Error()
    const stack = err.stack ?? ''
    // 按 \n 分割，跳过前 3 行（Error / captureStack / checkout）
    const lines = stack.split('\n').slice(3, 3 + limit)
    return lines.join('\n')
  }

  /** 添加到历史记录（限制长度）。 */
  private addToHistory(rec: CheckOutRecord): void {
    this.history.push(rec)
    if (this.history.length > this.maxRecords) {
      this.history.splice(0, this.history.length - this.maxRecords)
    }
  }
}

/** 全局单例。 */
export const poolLeakDetector = new PoolLeakDetector()

// =============================================================================
// WeakMap 辅助：为任意连接对象附加泄漏跟踪
// =============================================================================

/**
 * 使用 WeakMap 为连接对象附加借用记录（不阻止 GC）。
 *
 * 适用于 postgres.js 等库的连接对象：借出时调用 track，
 * 归还时调用 untrack，超时后可通过 getTracked 查看借用信息。
 */
const trackedConnections = new WeakMap<
  object,
  { connId: number; pool: string; checkedOutAt: number; stack: string }
>()

/**
 * 跟踪一个连接对象的借出。
 *
 * @param conn 连接对象（任意对象引用）
 * @param pool 连接池名称
 * @param context 上下文描述
 * @returns 连接 ID
 */
export function trackConnection(conn: object, pool: string, context: string = ''): number {
  const connId = poolLeakDetector.checkout(pool, context)
  const stack = new Error().stack ?? ''
  trackedConnections.set(conn, {
    connId,
    pool,
    checkedOutAt: Date.now(),
    stack,
  })
  return connId
}

/**
 * 取消跟踪连接对象（归还时调用）。
 */
export function untrackConnection(conn: object): void {
  const info = trackedConnections.get(conn)
  if (info) {
    poolLeakDetector.checkin(info.connId)
    trackedConnections.delete(conn)
  }
}

/**
 * 获取被跟踪连接的借用信息（用于诊断）。
 */
export function getTrackedConnection(
  conn: object,
): { connId: number; pool: string; checkedOutAt: number; stack: string } | undefined {
  return trackedConnections.get(conn)
}
