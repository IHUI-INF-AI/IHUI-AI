import { createReadWriteDb, type Database } from '@ihui/database'
import type { FastifyInstance } from 'fastify'
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
const { dbWriter, writerClient, getReader, reportReplicaHealth, replicaClients } =
  createReadWriteDb({
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
// P1-3 修复(2026-08-06):dbRead 原为固定绑第一个副本(dbReader),副本故障不自动回退。
// 改为动态代理 —— 每次属性访问都从 getReader() 取当前优先级最高且健康的副本,
// 全部不健康时 getReader() 自动回退主库,实现读路径故障转移。
// 健康状态由下方探测循环通过 reportReplicaHealth 驱动。
export const dbRead: Database = new Proxy(dbWriter, {
  get(target, prop, receiver) {
    const reader = getReader()
    if (reader === target) return Reflect.get(target, prop, receiver)
    const value = Reflect.get(reader, prop)
    return typeof value === 'function' ? value.bind(reader) : value
  },
})
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
  } catch (e) {
    // 2026-08-02 修复:不再静默吞错,记录 warn 日志(便于排查 pool 状态采样失败)
    console.warn('[pool-tracker] sampling failed:', e)
  }
}, POOL_TRACK_INTERVAL_MS)
// unref:不阻止进程退出,进程结束时 timer 自动清理
// P2 修复(2026-07-31):导出 stopPoolTracker 供 index.ts shutdown 显式清理
poolTracker.unref()

/** 显式停止 poolTracker,避免 vitest/HMR 场景下累积。 */
export function stopPoolTracker(): void {
  clearInterval(poolTracker)
}

// =============================================================================
// P1-3 修复(2026-08-06):读副本健康探测循环。
// 原 reportReplicaHealth/getReader 为死代码(从未被调用),dbRead 固定绑第一个副本,
// 副本宕机/延迟超阈值不自动回退主库 → 700+ 处 dbRead 读路径雪崩。
// 现在:每 15s 对每个副本执行 SELECT 1,成功 → reportReplicaHealth(id, true),
// 失败 → reportReplicaHealth(id, false);连续失败 ≥3 次(或延迟 >10s)标记不健康,
// getReader() 自动跳过并回退主库,故障恢复后探测成功自动恢复。
// =============================================================================
const REPLICA_PROBE_INTERVAL_MS = 15_000

const replicaProbeTimer = (() => {
  if (replicaClients.size === 0) return null
  const probe = async (): Promise<void> => {
    for (const [id, client] of replicaClients) {
      try {
        const start = Date.now()
        await client`SELECT 1`
        const lagSec = (Date.now() - start) / 1000
        reportReplicaHealth(id, true, lagSec)
      } catch (e) {
        // 连接失败 → 上报不健康(连续失败达阈值后 getReader 跳过该副本)
        console.warn(`[replica-probe] 副本 ${id} 探测失败:`, (e as Error).message)
        reportReplicaHealth(id, false)
      }
    }
  }
  void probe()
  const timer = setInterval(() => void probe(), REPLICA_PROBE_INTERVAL_MS)
  timer.unref()
  return timer
})()

/**
 * 2026-08-02 修复:注册 onClose 钩子清理 poolTracker,防进程不退出。
 * 在 Fastify 启动后调用:registerPoolTrackerCleanup(server)
 * P1-3:同时清理 replicaProbeTimer。
 */
export function registerPoolTrackerCleanup(server: FastifyInstance): void {
  server.addHook('onClose', () => {
    clearInterval(poolTracker)
    if (replicaProbeTimer) clearInterval(replicaProbeTimer)
  })
}

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
