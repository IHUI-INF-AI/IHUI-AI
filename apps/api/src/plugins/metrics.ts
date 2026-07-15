import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { parsePath } from '../utils/http-normalize.js'

/**
 * 请求指标收集插件。
 * 收集:请求计数、响应时间直方图、状态码分布。
 * 同时收集基础设施指标：活跃连接、DB 连接池状态、SQL 查询。
 * 暴露 /metrics 端点(Prometheus 文本格式)。
 */

// SQL 查询耗时桶（秒）：1ms ~ 30s
const SQL_DURATION_SECONDS_BUCKETS = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30] as const

/** SQL 指标数据（直方图 + 计数器） */
export interface SqlMetrics {
  durationBuckets: Map<string, number> // key: table|operation|le
  durationSum: Map<string, number> // key: table|operation
  durationCount: Map<string, number> // key: table|operation
  queriesTotal: Map<string, number> // key: table|operation
}

const metricsPluginInner: FastifyPluginAsync = async (server: FastifyInstance) => {
  const metrics = {
    requestsTotal: 0,
    requestsByMethod: new Map<string, number>(),
    requestsByRoute: new Map<string, number>(),
    requestsByStatus: new Map<number, number>(),
    responseTimeSum: 0,
    responseTimeCount: 0,
    responseTimeBuckets: {
      '<10ms': 0,
      '<50ms': 0,
      '<100ms': 0,
      '<500ms': 0,
      '<1s': 0,
      '<5s': 0,
      '>=5s': 0,
    },
    uptime: process.uptime(),
    startTime: Date.now(),
    // 新增：连接指标（Gauge）
    activeConnections: 0,
    websocketConnections: 0,
    // 新增：WS 消息与断开指标（Counter，按方向 + 端点）
    wsMessagesReceivedTotal: 0,
    wsMessagesSentTotal: 0,
    wsDisconnectsTotal: 0,
    // 新增：DB 连接池指标
    dbPoolInUse: 0,
    dbPoolSize: 0,
    dbPoolCheckedout: 0,
    dbPoolOverflow: 0,
    dbPoolConnectionsTotal: 0, // Counter
    dbPoolCheckoutTimeoutsTotal: 0, // Counter
    // 新增：SQL 指标
    sql: {
      durationBuckets: new Map<string, number>(),
      durationSum: new Map<string, number>(),
      durationCount: new Map<string, number>(),
      queriesTotal: new Map<string, number>(),
    } as SqlMetrics,
  }

  // 请求开始时记录
  server.addHook('onRequest', async () => {
    metrics.requestsTotal++
    metrics.activeConnections++
  })

  // 响应结束时记录
  server.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    // 活跃连接数递减（onResponse 在请求结束时触发，包括错误场景）
    metrics.activeConnections--

    const elapsed = reply.elapsedTime // 毫秒
    metrics.responseTimeSum += elapsed
    metrics.responseTimeCount++

    // 方法统计（归一化大写，与 audit.ts 一致）
    const method = request.method.toUpperCase()
    metrics.requestsByMethod.set(method, (metrics.requestsByMethod.get(method) ?? 0) + 1)

    // 路由统计（剥离 querystring 防止 metric 基数爆炸）
    const rawRoute = request.routeOptions?.url ?? request.url
    const route = parsePath(rawRoute)
    metrics.requestsByRoute.set(route, (metrics.requestsByRoute.get(route) ?? 0) + 1)

    // 状态码统计
    const status = reply.statusCode
    metrics.requestsByStatus.set(status, (metrics.requestsByStatus.get(status) ?? 0) + 1)

    // 响应时间桶
    if (elapsed < 10) metrics.responseTimeBuckets['<10ms']++
    else if (elapsed < 50) metrics.responseTimeBuckets['<50ms']++
    else if (elapsed < 100) metrics.responseTimeBuckets['<100ms']++
    else if (elapsed < 500) metrics.responseTimeBuckets['<500ms']++
    else if (elapsed < 1000) metrics.responseTimeBuckets['<1s']++
    else if (elapsed < 5000) metrics.responseTimeBuckets['<5s']++
    else metrics.responseTimeBuckets['>=5s']++
  })

  // ===== 新增：基础设施指标装饰器 =====

  // 设置活跃 WebSocket 连接数（由 ws-* 插件在连接建立/断开时调用）
  server.decorate('setWebsocketConnections', (count: number) => {
    metrics.websocketConnections = count
  })

  // 设置 DB 连接池 Gauge 指标（postgres.js 连接池状态采样，由于 Drizzle 封装，由外部定时采样调用）
  server.decorate(
    'setDbPoolMetrics',
    (opts: { inUse?: number; size?: number; checkedOut?: number; overflow?: number }) => {
      if (opts.inUse !== undefined) metrics.dbPoolInUse = opts.inUse
      if (opts.size !== undefined) metrics.dbPoolSize = opts.size
      if (opts.checkedOut !== undefined) metrics.dbPoolCheckedout = opts.checkedOut
      if (opts.overflow !== undefined) metrics.dbPoolOverflow = opts.overflow
    },
  )

  // 记录新建 DB 连接（Counter 递增）
  server.decorate('recordDbPoolConnection', () => {
    metrics.dbPoolConnectionsTotal++
  })

  // 记录 DB 连接池 checkout 超时（Counter 递增）
  server.decorate('recordDbPoolCheckoutTimeout', () => {
    metrics.dbPoolCheckoutTimeoutsTotal++
  })

  // 记录 SQL 查询耗时（Histogram + Counter，按 table/operation 维度）
  server.decorate('recordSqlQuery', (table: string, operation: string, durationSeconds: number) => {
    const key = `${table}|${operation}`
    // Counter
    metrics.sql.queriesTotal.set(key, (metrics.sql.queriesTotal.get(key) ?? 0) + 1)
    // Histogram
    metrics.sql.durationCount.set(key, (metrics.sql.durationCount.get(key) ?? 0) + 1)
    metrics.sql.durationSum.set(key, (metrics.sql.durationSum.get(key) ?? 0) + durationSeconds)
    for (const le of SQL_DURATION_SECONDS_BUCKETS) {
      if (durationSeconds <= le) {
        const bucketKey = `${key}|le=${le}`
        metrics.sql.durationBuckets.set(
          bucketKey,
          (metrics.sql.durationBuckets.get(bucketKey) ?? 0) + 1,
        )
      }
    }
    const infKey = `${key}|le=+Inf`
    metrics.sql.durationBuckets.set(infKey, (metrics.sql.durationBuckets.get(infKey) ?? 0) + 1)
  })

  // /metrics 端点(Prometheus 格式)
  server.get('/metrics', async (_request, reply) => {
    const lines: string[] = []

    // 请求总数
    lines.push('# HELP http_requests_total Total HTTP requests')
    lines.push('# TYPE http_requests_total counter')
    lines.push(`http_requests_total ${metrics.requestsTotal}`)

    // 按方法
    lines.push('# HELP http_requests_by_method HTTP requests by method')
    lines.push('# TYPE http_requests_by_method counter')
    for (const [method, count] of metrics.requestsByMethod) {
      lines.push(`http_requests_by_method{method="${method}"} ${count}`)
    }

    // 按状态码
    lines.push('# HELP http_requests_by_status HTTP requests by status code')
    lines.push('# TYPE http_requests_by_status counter')
    for (const [status, count] of metrics.requestsByStatus) {
      lines.push(`http_requests_by_status{status="${status}"} ${count}`)
    }

    // 响应时间
    lines.push('# HELP http_response_time_ms Response time in milliseconds')
    lines.push('# TYPE http_response_time_ms summary')
    const avgTime =
      metrics.responseTimeCount > 0 ? metrics.responseTimeSum / metrics.responseTimeCount : 0
    lines.push(`http_response_time_ms_sum ${metrics.responseTimeSum.toFixed(2)}`)
    lines.push(`http_response_time_ms_count ${metrics.responseTimeCount}`)
    lines.push(`http_response_time_ms_avg ${avgTime.toFixed(2)}`)

    // 响应时间桶
    lines.push('# HELP http_response_time_bucket Response time buckets')
    lines.push('# TYPE http_response_time_bucket histogram')
    for (const [bucket, count] of Object.entries(metrics.responseTimeBuckets)) {
      lines.push(`http_response_time_bucket{le="${bucket}"} ${count}`)
    }

    // 运行时间
    lines.push('# HELP process_uptime_seconds Process uptime in seconds')
    lines.push('# TYPE process_uptime_seconds gauge')
    lines.push(`process_uptime_seconds ${process.uptime().toFixed(2)}`)

    // ===== 新增：连接指标 =====
    lines.push('# HELP active_connections Active HTTP connections')
    lines.push('# TYPE active_connections gauge')
    lines.push(`active_connections ${metrics.activeConnections}`)

    lines.push('# HELP websocket_connections Active WebSocket connections')
    lines.push('# TYPE websocket_connections gauge')
    lines.push(`websocket_connections ${metrics.websocketConnections}`)

    lines.push('# HELP ws_messages_received_total Total WebSocket messages received from clients')
    lines.push('# TYPE ws_messages_received_total counter')
    lines.push(`ws_messages_received_total ${metrics.wsMessagesReceivedTotal}`)

    lines.push('# HELP ws_messages_sent_total Total WebSocket messages sent to clients')
    lines.push('# TYPE ws_messages_sent_total counter')
    lines.push(`ws_messages_sent_total ${metrics.wsMessagesSentTotal}`)

    lines.push('# HELP ws_disconnects_total Total WebSocket disconnects')
    lines.push('# TYPE ws_disconnects_total counter')
    lines.push(`ws_disconnects_total ${metrics.wsDisconnectsTotal}`)

    // ===== 新增：DB 连接池指标 =====
    lines.push('# HELP db_pool_in_use DB connections currently in use')
    lines.push('# TYPE db_pool_in_use gauge')
    lines.push(`db_pool_in_use ${metrics.dbPoolInUse}`)

    lines.push('# HELP db_pool_size DB connection pool total size')
    lines.push('# TYPE db_pool_size gauge')
    lines.push(`db_pool_size ${metrics.dbPoolSize}`)

    lines.push('# HELP db_pool_checkedout DB connections checked out from pool')
    lines.push('# TYPE db_pool_checkedout gauge')
    lines.push(`db_pool_checkedout ${metrics.dbPoolCheckedout}`)

    lines.push('# HELP db_pool_overflow DB connection pool overflow count')
    lines.push('# TYPE db_pool_overflow gauge')
    lines.push(`db_pool_overflow ${metrics.dbPoolOverflow}`)

    lines.push('# HELP db_pool_connections_total Total DB pool connections created')
    lines.push('# TYPE db_pool_connections_total counter')
    lines.push(`db_pool_connections_total ${metrics.dbPoolConnectionsTotal}`)

    lines.push('# HELP db_pool_checkout_timeouts_total Total DB pool checkout timeouts')
    lines.push('# TYPE db_pool_checkout_timeouts_total counter')
    lines.push(`db_pool_checkout_timeouts_total ${metrics.dbPoolCheckoutTimeoutsTotal}`)

    // ===== 新增：SQL 指标 =====
    lines.push('# HELP sql_query_duration_seconds SQL query duration in seconds')
    lines.push('# TYPE sql_query_duration_seconds histogram')
    for (const [k, v] of metrics.sql.durationBuckets) {
      const [base, le] = k.split('|le=')
      const [table, operation] = (base ?? '').split('|')
      lines.push(
        `sql_query_duration_seconds_bucket{table="${table}",operation="${operation}",le="${le}"} ${v}`,
      )
    }
    for (const [k, v] of metrics.sql.durationSum) {
      const [table, operation] = k.split('|')
      lines.push(
        `sql_query_duration_seconds_sum{table="${table}",operation="${operation}"} ${v.toFixed(6)}`,
      )
    }
    for (const [k, v] of metrics.sql.durationCount) {
      const [table, operation] = k.split('|')
      lines.push(`sql_query_duration_seconds_count{table="${table}",operation="${operation}"} ${v}`)
    }

    lines.push('# HELP sql_queries_total Total SQL queries by table and operation')
    lines.push('# TYPE sql_queries_total counter')
    for (const [k, v] of metrics.sql.queriesTotal) {
      const [table, operation] = k.split('|')
      lines.push(`sql_queries_total{table="${table}",operation="${operation}"} ${v}`)
    }

    reply.type('text/plain').send(lines.join('\n'))
  })

  // 暴露 metrics 对象供健康检查使用
  server.decorate('metrics', metrics)
}

export const metricsPlugin = fp(metricsPluginInner, {
  name: 'metrics-plugin',
  fastify: '5.x',
})

// 类型声明
declare module 'fastify' {
  interface FastifyInstance {
    metrics: {
      requestsTotal: number
      requestsByMethod: Map<string, number>
      requestsByRoute: Map<string, number>
      requestsByStatus: Map<number, number>
      responseTimeSum: number
      responseTimeCount: number
      responseTimeBuckets: Record<string, number>
      uptime: number
      startTime: number
      // 新增：连接指标
      activeConnections: number
      websocketConnections: number
      // 新增：WS 消息/断开 Counter
      wsMessagesReceivedTotal: number
      wsMessagesSentTotal: number
      wsDisconnectsTotal: number
      // 新增：DB 连接池指标
      dbPoolInUse: number
      dbPoolSize: number
      dbPoolCheckedout: number
      dbPoolOverflow: number
      dbPoolConnectionsTotal: number
      dbPoolCheckoutTimeoutsTotal: number
      // 新增：SQL 指标
      sql: SqlMetrics
    }
    /** 设置当前活跃 WebSocket 连接数（Gauge）。 */
    setWebsocketConnections: (count: number) => void
    /** 设置 DB 连接池 Gauge 指标（postgres.js pool 状态采样，由于 Drizzle 封装由外部定时调用）。 */
    setDbPoolMetrics: (opts: {
      inUse?: number
      size?: number
      checkedOut?: number
      overflow?: number
    }) => void
    /** 记录新建 DB 连接（Counter 递增）。 */
    recordDbPoolConnection: () => void
    /** 记录 DB 连接池 checkout 超时（Counter 递增）。 */
    recordDbPoolCheckoutTimeout: () => void
    /** 记录 SQL 查询耗时（Histogram + Counter，按 table/operation 维度）。 */
    recordSqlQuery: (table: string, operation: string, durationSeconds: number) => void
  }
}
