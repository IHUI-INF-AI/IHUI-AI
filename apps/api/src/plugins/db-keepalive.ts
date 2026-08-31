// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

// 测试环境(vitest)不启动生产定时器:单元测试中 db/dbClient 常被 vi.mock 只替换
// 部分导出(多数测试只给 db),定时器触发访问不完整 mock 会抛
// "No 'dbClient' export is defined on the mock" 并打噪音日志
// (pool metrics sample failed / database keepalive failed),且无谓增加测试负载。
// vitest 默认置 NODE_ENV=test 并恒置 VITEST=true,双保险判定。
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'

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

  const timer = isTestEnv
    ? undefined
    : setInterval(async () => {
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

  timer?.unref()

  // 定时采样 postgres.js 连接池状态并上报 Gauge 指标
  // postgres.js 的 options.max 为连接池最大容量；内部连接状态通过尝试访问内部属性获取
  const poolSampler = isTestEnv
    ? undefined
    : setInterval(() => {
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
        } catch (err) {
          server.log.warn({ err }, 'pool metrics sample failed')
        }
      }, POOL_SAMPLE_INTERVAL_MS)

  poolSampler?.unref()

  // 定时扫描连接池泄漏（超时未归还的连接）
  const leakScanner = isTestEnv
    ? undefined
    : setInterval(() => {
        try {
          const leaks = poolLeakDetector.scanLeaks()
          if (leaks.length > 0) {
            server.log.warn(
              { leakCount: leaks.length, stats: poolLeakDetector.stats() },
              'pool leak detected',
            )
          }
        } catch (err) {
          server.log.warn({ err }, 'pool leak scan failed')
        }
      }, LEAK_SCAN_INTERVAL_MS)

  leakScanner?.unref()

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
    if (timer) clearInterval(timer)
    if (poolSampler) clearInterval(poolSampler)
    if (leakScanner) clearInterval(leakScanner)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
