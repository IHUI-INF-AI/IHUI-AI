import { createReadWriteDb, type Database } from '@ihui/database'
import { config } from '../config/index.js'
import { sqlEventBus } from './sql-event-bus.js'
// P1 修复:集成 pool-leak-detector,跟踪 postgres.js 连接池中 active/idle 连接,
// 让 db-keepalive.ts 的 scanLeaks 能检测到长时间未归还的连接泄漏。
// 此前 pool-leak-detector.ts 完整实现但从未被任何模块调用 checkout/trackConnection,
// 导致泄漏扫描器无数据可扫。这里通过周期性采样 pool 内部状态,把 active 连接注册为
// "已借出",idle 连接标记为 "已归还",从而让泄漏检测真正生效。
import {
  poolLeakDetector,
  trackConnection,
  untrackConnection,
} from '../utils/pool-leak-detector.js'

// 使用读写分离工厂创建主库(写)与读副本(读)
// 无 DATABASE_READ_REPLICA_URL 时,dbReader 自动回退到主库
// logger 回调把每次 SQL 查询事件发布到 sqlEventBus,
// slow-sql-killer 与 n1-detector 订阅消费(自动注入 ALS 中的 requestId)
const { dbWriter, dbReader, writerClient } = createReadWriteDb({
  url: config.DATABASE_URL,
  readReplicaUrl: config.DATABASE_READ_REPLICA_URL,
  logger: (event) => {
    sqlEventBus.emit({
      query: event.query,
      params: event.params,
      durationMs: event.durationMs,
      timestamp: event.timestamp,
    })
  },
})

// 主库(写) — insert/update/delete 必须使用此客户端
export const db: Database = dbWriter
// 读副本(读) — 仅用于 SELECT 查询;无读副本时回退到主库
export const dbRead: Database = dbReader
// 原始 postgres.js 客户端，用于连接池指标采样
export const dbClient = writerClient
// P1 修复:导出 poolLeakDetector 单例,供 admin 路由 / db-keepalive 等模块统一访问
export { poolLeakDetector }

// P1 修复:周期性采样 postgres.js 连接池状态,把 active 连接注册到 leak detector。
// Drizzle ORM 内部自动管理连接(不暴露 acquire/release 钩子),无法在查询前后手动
// trackConnection;改为周期性读取 postgres.js 内部 pool 状态,active 连接 → track,
// idle 连接 → untrack。这样若某连接长期停留在 active 状态(疑似泄漏),scanLeaks
// 会在超时阈值(默认 5 分钟)后告警。
const POOL_TRACK_INTERVAL_MS = 30_000
const trackedConns = new WeakSet<object>()
const poolTracker = setInterval(() => {
  try {
    // postgres.js 不公开 pool 内部状态,尝试读取内部属性(与 db-keepalive.ts 同模式)
    const internal = writerClient as unknown as {
      state?: { idle?: object[]; active?: object[] }
    }
    if (!internal.state) return
    const activeConns = internal.state.active ?? []
    const idleConns = internal.state.idle ?? []
    // 新增 active 连接 → track(记录借出 + 调用栈)
    for (const conn of activeConns) {
      if (!trackedConns.has(conn)) {
        trackedConns.add(conn)
        trackConnection(conn, 'writer', 'postgres-pool-active')
      }
    }
    // 转为 idle 的连接 → untrack(记录归还)
    for (const conn of idleConns) {
      if (trackedConns.has(conn)) {
        trackedConns.delete(conn)
        untrackConnection(conn)
      }
    }
  } catch {
    // 内部属性访问失败时静默忽略(兼容不同 postgres.js 版本)
  }
}, POOL_TRACK_INTERVAL_MS)
// unref:不阻止进程退出,进程结束时 timer 自动清理
poolTracker.unref()

export type { Database }

/**
 * 安全获取 `.returning()` 的单条结果。
 * 若无结果抛出 Error(由调用方 catch 返回 500 + message,与现有 catch 模式一致)。
 * 用途:消除 `const [x] = ...returning(); if (!x) return reply.status(500).send(...)` 重复守卫。
 *
 * @example
 * // 替换前:
 * const [created] = await db.insert(t).values(v).returning()
 * if (!created) return reply.status(500).send(error(500, '创建失败'))
 * // 替换后:
 * const created = await returningOne(db.insert(t).values(v).returning(), '创建失败')
 */
export async function returningOne<T>(
  promise: Promise<T[]>,
  errorMessage = '数据库操作未返回记录',
): Promise<T> {
  const rows = await promise
  const row = rows[0]
  if (!row) throw new Error(errorMessage)
  return row
}
