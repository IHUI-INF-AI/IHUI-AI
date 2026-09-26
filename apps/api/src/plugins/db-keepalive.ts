// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { sql } from 'drizzle-orm'
import { db, dbClient } from '../db/index.js'
import { startStopwatch, type ClockSource, type ElapsedSample } from '../utils/elapsed-ms.js'
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
 * 保活 tick 主体可注入的日志面。刻意只声明用到的三个方法，
 * 使 `server.log` 原样传入，而测试可用 plain object 替身。
 */
export interface KeepaliveTickLogger {
  info(payload: unknown, msg?: string): void
  warn(payload: unknown, msg?: string): void
  error(payload: unknown, msg?: string): void
}

/** 保活状态：成功路径归零、失败路径累加，经 `server.dbKeepalive` 的 getter 暴露。 */
export interface KeepaliveState {
  isAlive: boolean
  consecutiveFailures: number
}

/** 一次保活 tick 的全部外部依赖（db 执行 / 指标出口 / 日志 / 测试假时钟）。 */
export interface KeepaliveTickDeps {
  state: KeepaliveState
  execute: () => Promise<unknown>
  recordSqlQuery: (durationSec: number) => void
  log: KeepaliveTickLogger
  /** 测试注入口：假时钟。生产不传 ⇒ 走 elapsed-ms 的真实「单调钟 + 墙钟」双钟。 */
  clocks?: ClockSource
}

/**
 * 不可信样本首次出声的一次性 flag。
 * 保活每 30 秒一轮，若每轮都喊就等于把一条诊断刷成日志噪音；只出声一次，
 * 后续由 elapsedClockStats() 计数面回答"标了几条"（与 §5e「失败必须响」同一条禁令：不静默）。
 */
let untrustworthyShouted = false

/** 把一次经交叉校验的耗时样本喂给 SQL 直方图；不可信样本只出声、不喂数。 */
function reportKeepaliveLatency(
  sample: ElapsedSample,
  recordSqlQuery: (durationSec: number) => void,
  log: KeepaliveTickLogger,
): void {
  try {
    if (!sample.trustworthy || sample.elapsedMs === null) {
      // 为什么跳过直方图而不是写 0：直方图是**分布量**，写 0 等于宣称"这次查询很快"，
      // 会把 system/SELECT 的 p50/p95 往好的方向带偏且事后无从分辨。
      // 落库列那一型（`?? 0` 配 latencyTrusted 标量旗）形态不同——那条记录仍然完整，
      // 只是数值不可信；两种处置不得混用。计数由 elapsedClockStats() 观测面兜住，不静默丢。
      if (!untrustworthyShouted) {
        untrustworthyShouted = true
        log.warn(
          { reason: sample.reason, perfMs: sample.perfMs, wallMs: sample.wallMs },
          'database keepalive latency sample rejected by clock cross-check; NOT recorded into sql_query_duration_seconds (counted in elapsedClockStats)',
        )
      }
      return
    }
    recordSqlQuery(sample.elapsedMs / 1000)
  } catch {
    /* 指标采集失败不影响业务 */
  }
}

/**
 * 一次保活 tick：SELECT 1 + 耗时上报 + 连接状态翻转。
 * 保活语义（isAlive / consecutiveFailures / 恢复日志）与改造前逐字一致，
 * 唯一变化是耗时出口从裸墙钟差值换成 elapsed-ms 的单调钟 × 墙钟交叉校验。
 */
export async function runKeepaliveTick(deps: KeepaliveTickDeps): Promise<void> {
  const { state, execute, recordSqlQuery, log, clocks } = deps
  const stopwatch = startStopwatch(clocks ? { clocks } : {})
  try {
    await execute()
    // 上报保活 SQL 查询耗时（fire-and-forget）
    reportKeepaliveLatency(stopwatch.stop(), recordSqlQuery, log)
    if (!state.isAlive || state.consecutiveFailures > 0) {
      log.info('database connection restored')
    }
    state.isAlive = true
    state.consecutiveFailures = 0
  } catch (err) {
    // 上报保活 SQL 查询失败耗时
    reportKeepaliveLatency(stopwatch.stop(), recordSqlQuery, log)
    state.consecutiveFailures++
    state.isAlive = false
    log.error({ err, consecutiveFailures: state.consecutiveFailures }, 'database keepalive failed')
  }
}

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
  const state: KeepaliveState = { isAlive: true, consecutiveFailures: 0 }

  const timer = isTestEnv
    ? undefined
    : setInterval(() => {
        void runKeepaliveTick({
          state,
          execute: () => db.execute(sql`SELECT 1`),
          recordSqlQuery: (durationSec) => server.recordSqlQuery('system', 'SELECT', durationSec),
          log: server.log,
        })
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
      return state.isAlive
    },
    get failures() {
      return state.consecutiveFailures
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

/**
 * 测试通道（AGENTS §22c）：暴露 tick 主体与一次性出声 flag 的复位口。
 * 生产路径不调用这里任何一项，也不因此改变生产默认行为。
 */
export const __test__ = {
  runKeepaliveTick,
  /** 复位「不可信样本首次出声」flag，使多条用例各自都能观察到恰好一次 warn。 */
  resetUntrustworthyShout(): void {
    untrustworthyShouted = false
  },
  /** 只读取当前是否已出声（不写）。 */
  hasShouted(): boolean {
    return untrustworthyShouted
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
