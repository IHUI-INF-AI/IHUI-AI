// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { sqlEventBus } from '../db/sql-event-bus.js'

const SLOW_SQL_THRESHOLD_MS = parseInt(process.env.SLOW_SQL_THRESHOLD_MS ?? '1000', 10)

/**
 * 慢 SQL 杀手插件。
 * 监控执行时间超过阈值的 SQL 查询,定期输出慢查询统计。
 * 阈值默认 1000ms,可通过 SLOW_SQL_THRESHOLD_MS 环境变量配置。
 *
 * 通过订阅 sqlEventBus 自动捕获所有 SQL 查询事件(主库 + 读副本),
 * 无需在各业务代码手动调用 slowSqlStats.increment()。
 *
 * DB-29 明确降级为**告警面**:本插件只记录,不执行 pg_terminate_backend。
 * 原因:sqlEventBus 事件里没有后端 PID(只有一个查询串与耗时),凭进程内
 * 连接池无法安全定位"该杀哪条";误杀会命中同库其他实例的连接。
 * 真正的"硬中断"由连接池的 statement_timeout(默认 30s,见
 * packages/database/src/pool-options.ts)承担,本插件负责留痕与统计。
 */
const slowSqlKillerPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  let slowQueryCount = 0

  server.log.info({ thresholdMs: SLOW_SQL_THRESHOLD_MS }, 'slow-sql-killer plugin registered')

  // 订阅 SQL 事件,慢查询自动计数 + 即时告警
  const unsubscribe = sqlEventBus.on((event) => {
    if (event.durationMs !== undefined && event.durationMs > SLOW_SQL_THRESHOLD_MS) {
      slowQueryCount++
      server.log.warn(
        {
          query: event.query.slice(0, 500), // 截断防日志爆炸
          durationMs: Math.round(event.durationMs),
          requestId: event.requestId,
        },
        'slow SQL detected',
      )
    }
  })

  // 定期输出慢查询统计
  const interval = setInterval(() => {
    if (slowQueryCount > 0) {
      server.log.warn(
        { count: slowQueryCount, thresholdMs: SLOW_SQL_THRESHOLD_MS },
        'slow SQL queries in last 60s',
      )
      slowQueryCount = 0
    }
  }, 60_000)
  interval.unref()

  server.decorate('slowSqlStats', {
    get count() {
      return slowQueryCount
    },
    increment() {
      slowQueryCount++
    },
  })

  server.addHook('onClose', async () => {
    clearInterval(interval)
    unsubscribe()
  })
}

export const slowSqlKiller = fp(slowSqlKillerPlugin, {
  name: 'slow-sql-killer',
  fastify: '5.x',
})

declare module 'fastify' {
  interface FastifyInstance {
    slowSqlStats: {
      readonly count: number
      increment(): void
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
