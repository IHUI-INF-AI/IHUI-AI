import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { sql } from 'drizzle-orm'
import { db, dbClient } from '../db/index.js'
import {
  poolLeakDetector,
  type PoolLeakStats,
  type CheckOutRecord,
} from '../utils/pool-leak-detector.js'

const KEEPALIVE_INTERVAL_MS = 30_000
// 连接池指标采样间隔（秒）
const POOL_SAMPLE_INTERVAL_MS = 5_000
// 连接池泄漏扫描间隔（毫秒）
const LEAK_SCAN_INTERVAL_MS = 60_000

/**
 * 数据库连接保活插件。
 * 每 30 秒执行一次 SELECT 1,检测连接可用性。
 * 连接失败时记录 error 日志,恢复时记录 info 日志。
 *
 * 同时定时采样 postgres.js 连接池状态并上报指标：
 * - db_pool_size: 连接池最大容量
 * - db_pool_in_use / db_pool_checkedout / db_pool_overflow: 当前使用情况
 * - sql_query_duration_seconds: 保活查询耗时
 *
 * 集成连接池泄漏检测器（pool-leak-detector）：
 * - 每 60 秒扫描超时未归还的连接
 * - 检测到泄漏时记录 warning 日志
 * - 通过 server.getPoolLeakStats() 暴露统计
 */
const dbKeepalivePlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  let isAlive = true
  let consecutiveFailures = 0

  const timer = setInterval(async () => {
    const startMs = Date.now()
    try {
      await db.execute(sql`SELECT 1`)
      // 上报保活 SQL 查询耗时（fire-and-forget）
      try {
        const durationSec = (Date.now() - startMs) / 1000
        server.recordSqlQuery('system', 'SELECT', durationSec)
      } catch {
        /* 指标采集失败不影响业务 */
      }
      if (!isAlive || consecutiveFailures > 0) {
        server.log.info('database connection restored')
      }
      isAlive = true
      consecutiveFailures = 0
    } catch (err) {
      // 上报保活 SQL 查询失败耗时
      try {
        const durationSec = (Date.now() - startMs) / 1000
        server.recordSqlQuery('system', 'SELECT', durationSec)
      } catch {
        /* 指标采集失败不影响业务 */
      }
      consecutiveFailures++
      isAlive = false
      server.log.error({ err, consecutiveFailures }, 'database keepalive failed')
    }
  }, KEEPALIVE_INTERVAL_MS)

  timer.unref()

  // 定时采样 postgres.js 连接池状态并上报 Gauge 指标
  // postgres.js 的 options.max 为连接池最大容量；内部连接状态通过尝试访问内部属性获取
  const poolSampler = setInterval(() => {
    try {
      const poolSize = dbClient.options?.max ?? 0
      let inUse = 0
      let checkedOut = 0
      // postgres.js 不公开 pool 内部状态，尝试读取内部属性（兼容不同版本）
      const internal = dbClient as unknown as {
        state?: { connections?: unknown[]; idle?: unknown[]; active?: unknown[] }
      }
      if (internal.state) {
        const allConns = internal.state.connections ?? []
        const idleConns = internal.state.idle ?? []
        const activeConns = internal.state.active ?? []
        inUse = activeConns.length
        checkedOut = allConns.length - idleConns.length
      }
      server.setDbPoolMetrics({
        size: poolSize,
        inUse,
        checkedOut,
        overflow: 0,
      })
    } catch {
      /* 指标采集失败不影响业务 */
    }
  }, POOL_SAMPLE_INTERVAL_MS)

  poolSampler.unref()

  // 定时扫描连接池泄漏（超时未归还的连接）
  const leakScanner = setInterval(() => {
    try {
      const leaks = poolLeakDetector.scanLeaks()
      if (leaks.length > 0) {
        server.log.warn(
          { leakCount: leaks.length, stats: poolLeakDetector.stats() },
          'pool leak detected',
        )
      }
    } catch {
      /* 泄漏扫描失败不影响业务 */
    }
  }, LEAK_SCAN_INTERVAL_MS)

  leakScanner.unref()

  server.decorate('dbKeepalive', {
    get isAlive() {
      return isAlive
    },
    get failures() {
      return consecutiveFailures
    },
  })

  server.decorate('getPoolLeakStats', (): PoolLeakStats => {
    return poolLeakDetector.stats()
  })

  server.decorate('scanPoolLeaks', () => {
    return poolLeakDetector.scanLeaks()
  })

  server.addHook('onClose', async () => {
    clearInterval(timer)
    clearInterval(poolSampler)
    clearInterval(leakScanner)
  })
}

export const dbKeepalive = fp(dbKeepalivePlugin, {
  name: 'db-keepalive',
  fastify: '5.x',
})

declare module 'fastify' {
  interface FastifyInstance {
    dbKeepalive: {
      readonly isAlive: boolean
      readonly failures: number
    }
    /** 获取连接池泄漏检测统计。 */
    getPoolLeakStats: () => PoolLeakStats
    /** 手动触发连接池泄漏扫描，返回新发现的泄漏记录。 */
    scanPoolLeaks: () => CheckOutRecord[]
  }
}
