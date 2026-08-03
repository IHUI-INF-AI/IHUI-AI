/**
 * 管理后台监控/统计路由（21 个端点）。
 * 替代 admin-missing-routes.ts 中的 19 个 registerEmptyStub 空桩。
 * 全部基于现有数据库表聚合，无新表。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sql, desc, eq, gte, count, and, ilike, type SQL } from 'drizzle-orm'
import * as os from 'node:os'
import { db } from '../db/index.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import {
  apiLogs,
  systemEvents,
  monitorAlerts,
  oauthAuditLogs,
  webhookEvents,
  eduOrders,
} from '@ihui/database'

async function getPerf() {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  // CPU 平均使用率:基于 os.cpus() 的 idle/total 比例(自启动以来的平均值)
  const cpus = os.cpus()
  let totalIdle = 0
  let totalTick = 0
  for (const cpu of cpus) {
    const { user, nice, sys, idle, irq } = cpu.times
    const tick = user + nice + sys + idle + irq
    totalIdle += idle
    totalTick += tick
  }
  const cpuUsage =
    totalTick > 0 ? Number((((totalTick - totalIdle) / totalTick) * 100).toFixed(2)) : 0
  return {
    cpu: cpuUsage,
    memory: Number((((totalMem - freeMem) / totalMem) * 100).toFixed(2)),
    qps: 0,
    avgResponse: 0,
    // diskUsage:无跨平台磁盘检测库,保持 0(如需真实数据可引入 node-disk-info)
    diskUsage: 0,
  }
}

const apiLogQuerySchema = z.object({
  page: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(1).default(1)),
  pageSize: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(1).max(100).default(20)),
  status: z.transform(emptyToUndefined).pipe(z.enum(['2xx', '4xx', '5xx', 'all']).optional()),
  endpoint: z.transform(emptyToUndefined).pipe(z.string().max(512).optional()),
  method: z.transform(emptyToUndefined).pipe(z.string().max(16).optional()),
})

export const adminMonitoringRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  /** 服务健康检测:DB(SELECT 1)、Redis(ping);api/web/ai-service 标记运行中 */
  async function checkServiceHealth(srv: typeof server) {
    const services: { name: string; status: string; latency: number }[] = []
    // api/web/ai-service:当前进程标记运行中
    services.push({ name: 'api', status: 'running', latency: 0 })
    services.push({ name: 'web', status: 'running', latency: 0 })
    services.push({ name: 'ai-service', status: 'running', latency: 0 })
    // postgres:SELECT 1 检查连通性
    try {
      const start = Date.now()
      await db.execute(sql`SELECT 1`)
      services.push({ name: 'postgres', status: 'healthy', latency: Date.now() - start })
    } catch {
      services.push({ name: 'postgres', status: 'unhealthy', latency: 0 })
    }
    // redis:尝试 ping(若插件未注册则 ping 调用抛异常,捕获后标记 unhealthy)
    try {
      const start = Date.now()
      await srv.redis.ping()
      services.push({ name: 'redis', status: 'healthy', latency: Date.now() - start })
    } catch {
      services.push({ name: 'redis', status: 'unhealthy', latency: 0 })
    }
    return services
  }

  server.get('/api-usage/day', async (_req, reply) => {
    const rows = await db
      .select({ date: sql<string>`to_char(${apiLogs.createdAt}, 'YYYY-MM-DD')`, calls: count() })
      .from(apiLogs)
      .where(gte(apiLogs.createdAt, sql`now() - interval '7 days'`))
      .groupBy(sql`1`)
      .orderBy(sql`1`)
    return reply.send(success(rows))
  })

  server.get('/api-usage/stats', async (_req, reply) => {
    const [stats] = await db
      .select({
        totalCalls: count(),
        todayCalls: sql<number>`count(*) filter (where ${apiLogs.createdAt} >= current_date)`,
        errorRate: sql<number>`coalesce(avg(case when ${apiLogs.statusCode} >= 400 then 1 else 0 end) * 100, 0)`,
        avgLatency: sql<number>`coalesce(avg(${apiLogs.duration}), 0)`,
      })
      .from(apiLogs)
    return reply.send(
      success(stats ?? { totalCalls: 0, todayCalls: 0, errorRate: 0, avgLatency: 0 }),
    )
  })

  server.get('/api-usage/top', async (_req, reply) => {
    const rows = await db
      .select({
        id: sql<string>`md5(${apiLogs.method} || ${apiLogs.path})`,
        endpoint: apiLogs.path,
        method: apiLogs.method,
        calls: count(),
        errorRate: sql<number>`coalesce(avg(case when ${apiLogs.statusCode} >= 400 then 1 else 0 end) * 100, 0)`,
      })
      .from(apiLogs)
      .groupBy(apiLogs.method, apiLogs.path)
      .orderBy(desc(count()))
      .limit(10)
    return reply.send(success(rows))
  })

  server.get('/oauth-audit/stats', async (_req, reply) => {
    const [stats] = await db
      .select({
        totalAuth: count(),
        todayAuth: sql<number>`count(*) filter (where ${oauthAuditLogs.createdAt} >= current_date)`,
        activeApps: sql<number>`count(distinct ${oauthAuditLogs.clientId})`,
        anomalyEvents: sql<number>`count(*) filter (where ${oauthAuditLogs.status} != 'success')`,
      })
      .from(oauthAuditLogs)
    return reply.send(
      success(stats ?? { totalAuth: 0, todayAuth: 0, activeApps: 0, anomalyEvents: 0 }),
    )
  })

  server.get('/backend-health/events', async (_req, reply) => {
    const events = await db
      .select({
        id: sql<string>`'sys_' || ${systemEvents.id}`,
        service: sql<string>`coalesce(${systemEvents.type}, 'system')`,
        level: systemEvents.level,
        message: systemEvents.message,
        time: systemEvents.createdAt,
      })
      .from(systemEvents)
      .orderBy(desc(systemEvents.createdAt))
      .limit(50)
    const alerts = await db
      .select({
        id: sql<string>`'alert_' || ${monitorAlerts.id}`,
        service: monitorAlerts.source,
        level: monitorAlerts.severity,
        message: monitorAlerts.message,
        time: monitorAlerts.firedAt,
      })
      .from(monitorAlerts)
      .where(eq(monitorAlerts.status, 'firing'))
      .orderBy(desc(monitorAlerts.firedAt))
      .limit(50)
    const combined = [...events, ...alerts]
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 50)
    return reply.send(success(combined))
  })

  server.get('/db-opt/slow-queries', async (_req, reply) => {
    try {
      const rows = await db.execute(sql`
        select
          md5(query) as id,
          query,
          coalesce(mean_exec_time, 0) as latency,
          calls
        from pg_stat_statements
        where mean_exec_time > 100
        order by mean_exec_time desc
        limit 20
      `)
      return reply.send(success((rows as Record<string, unknown>[]) ?? []))
    } catch {
      const rows = await db
        .select({
          id: sql<string>`'slow_' || ${apiLogs.id}::text`,
          query: apiLogs.path,
          latency: sql<number>`coalesce(${apiLogs.duration}, 0)`,
          calls: sql<number>`1`,
        })
        .from(apiLogs)
        .where(gte(apiLogs.duration, 1000))
        .orderBy(desc(apiLogs.duration))
        .limit(20)
      return reply.send(success(rows))
    }
  })

  server.get('/db-opt/suggestions', async (_req, reply) => {
    try {
      // 尝试从 pg_stat_statements 获取慢查询(mean_exec_time > 100ms)
      const slowQueries = await db.execute(sql`
        select
          md5(query) as id,
          query,
          coalesce(mean_exec_time, 0) as latency,
          calls
        from pg_stat_statements
        where mean_exec_time > 100
        order by mean_exec_time desc
        limit 20
      `)
      const rows = (slowQueries as Record<string, unknown>[]) ?? []

      // 基于慢查询生成索引建议(启发式:从 SQL 提取 WHERE 条件列名 + 表名)
      const suggestions = rows.map((row, idx) => {
        const queryStr = String(row.query ?? '')
        const latency = Number(row.latency ?? 0)
        const calls = Number(row.calls ?? 0)
        const whereMatch = queryStr.match(/where\s+(\w+)/i)
        const tableMatch = queryStr.match(/from\s+(\w+)/i)
        const tableName = tableMatch?.[1] ?? 'unknown'
        const columnName = whereMatch?.[1] ?? 'unknown'
        return {
          id: `sq_${idx + 1}`,
          type: 'index',
          title: `${tableName}_${columnName}_idx`,
          description: `慢查询(平均 ${latency.toFixed(0)}ms,调用 ${calls} 次):建议在 ${tableName}(${columnName}) 上添加索引`,
        }
      })

      if (suggestions.length > 0) return reply.send(success(suggestions))

      // pg_stat_statements 可用但无慢查询,返回通用建议
      return reply.send(
        success([
          {
            id: '1',
            type: 'index',
            title: 'api_logs_created_at_idx',
            description: 'Add index on api_logs(created_at) for time-range queries',
          },
          {
            id: '2',
            type: 'index',
            title: 'api_logs_path_method_idx',
            description: 'Add index on api_logs(path, method) for endpoint analytics',
          },
          {
            id: '3',
            type: 'archive',
            title: 'Old api_logs',
            description: 'Archive api_logs older than 90 days to reduce table size',
          },
        ]),
      )
    } catch {
      // pg_stat_statements 不可用,降级为查询 apiLogs 表的长耗时请求生成建议
      const slowApiLogs = await db
        .select({
          path: apiLogs.path,
          method: apiLogs.method,
          latency: sql<number>`coalesce(avg(${apiLogs.duration}), 0)`,
          calls: sql<number>`count(*)::int`,
        })
        .from(apiLogs)
        .where(gte(apiLogs.duration, 1000))
        .groupBy(apiLogs.path, apiLogs.method)
        .orderBy(desc(sql`avg(${apiLogs.duration})`))
        .limit(10)

      const suggestions = slowApiLogs.map((row, idx) => ({
        id: `slow_${idx + 1}`,
        type: 'index',
        title: `api_logs_${row.method.toLowerCase()}_${row.path.replace(/[^a-z0-9]/gi, '_').slice(0, 30)}_idx`,
        description: `慢请求(平均 ${Number(row.latency).toFixed(0)}ms,调用 ${row.calls} 次):${row.method} ${row.path} — 建议优化查询或添加索引`,
      }))

      return reply.send(
        success(
          suggestions.length > 0
            ? suggestions
            : [
                {
                  id: '1',
                  type: 'index',
                  title: 'api_logs_created_at_idx',
                  description: 'Add index on api_logs(created_at) for time-range queries',
                },
              ],
        ),
      )
    }
  })

  server.get('/db-opt/tables', async (_req, reply) => {
    const rows = await db.execute(sql`
      select
        relname as id,
        relname as name,
        coalesce(n_live_tup, 0) as rows,
        pg_size_pretty(pg_total_relation_size(c.oid)) as size,
        pg_size_pretty(pg_indexes_size(c.oid)) as "indexSize"
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r' and n.nspname = 'public'
      order by pg_total_relation_size(c.oid) desc
      limit 50
    `)
    return reply.send(success((rows as Record<string, unknown>[]) ?? []))
  })

  server.get('/event-bus/events', async (_req, reply) => {
    const rows = await db
      .select({
        id: sql<string>`'evt_' || ${webhookEvents.id}::text`,
        name: webhookEvents.eventType,
        source: webhookEvents.webhookId,
        status: webhookEvents.status,
        time: webhookEvents.createdAt,
      })
      .from(webhookEvents)
      .orderBy(desc(webhookEvents.createdAt))
      .limit(50)
    return reply.send(success(rows))
  })

  server.get('/event-bus/stats', async (_req, reply) => {
    const [stats] = await db
      .select({
        total: count(),
        today: sql<number>`count(*) filter (where ${webhookEvents.createdAt} >= current_date)`,
        processing: sql<number>`count(*) filter (where ${webhookEvents.status} = 'pending')`,
        failed: sql<number>`count(*) filter (where ${webhookEvents.status} = 'failed')`,
      })
      .from(webhookEvents)
    return reply.send(success(stats ?? { total: 0, today: 0, processing: 0, failed: 0 }))
  })

  server.get('/monitor/perf', async (_req, reply) => reply.send(success(await getPerf())))
  server.get('/monitoring/perf', async (_req, reply) => reply.send(success(await getPerf())))

  server.get('/monitor/services', async (_req, reply) => {
    const list = await checkServiceHealth(server)
    return reply.send(success({ list }))
  })

  server.get('/monitoring/services', async (_req, reply) => {
    const list = await checkServiceHealth(server)
    return reply.send(success({ list }))
  })

  server.get('/performance-dashboard/endpoints', async (_req, reply) => {
    const rows = await db
      .select({
        id: sql<string>`md5(${apiLogs.method} || ${apiLogs.path})`,
        endpoint: apiLogs.path,
        method: apiLogs.method,
        avgLatency: sql<number>`coalesce(avg(${apiLogs.duration}), 0)`,
        calls: count(),
        errorRate: sql<number>`coalesce(avg(case when ${apiLogs.statusCode} >= 400 then 1 else 0 end) * 100, 0)`,
      })
      .from(apiLogs)
      .groupBy(apiLogs.method, apiLogs.path)
      .orderBy(desc(count()))
      .limit(20)
    return reply.send(success(rows))
  })

  server.get('/performance-dashboard/stats', async (_req, reply) => {
    const [stats] = await db
      .select({
        cpu: sql<number>`0`,
        memory: sql<number>`0`,
        qps: sql<number>`coalesce(count(*) filter (where ${apiLogs.createdAt} >= now() - interval '1 second'), 0)`,
        avgResponse: sql<number>`coalesce(avg(${apiLogs.duration}), 0)`,
      })
      .from(apiLogs)
    return reply.send(success(stats ?? { cpu: 0, memory: 0, qps: 0, avgResponse: 0 }))
  })

  server.get('/system/monitor/metrics', async (_req, reply) => {
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    return reply.send(
      success({
        cpu: 0,
        memory: Number((((totalMem - freeMem) / totalMem) * 100).toFixed(2)),
        disk: 0,
        network: { in: 0, out: 0 },
        uptime: os.uptime(),
        loadAvg: os.loadavg(),
        processes: 0,
      }),
    )
  })

  server.get('/system/monitor/services', async (_req, reply) => {
    const list: { name: string; status: string; pid: number; memory: number; cpu: number }[] = []
    // api:当前进程真实数据
    list.push({
      name: 'api',
      status: 'running',
      pid: process.pid,
      memory: process.memoryUsage().rss,
      cpu: 0,
    })
    // postgres:SELECT 1 检查连通性
    try {
      await db.execute(sql`SELECT 1`)
      list.push({ name: 'postgres', status: 'running', pid: 0, memory: 0, cpu: 0 })
    } catch {
      list.push({ name: 'postgres', status: 'stopped', pid: 0, memory: 0, cpu: 0 })
    }
    // redis:尝试 ping
    try {
      await server.redis.ping()
      list.push({ name: 'redis', status: 'running', pid: 0, memory: 0, cpu: 0 })
    } catch {
      list.push({ name: 'redis', status: 'stopped', pid: 0, memory: 0, cpu: 0 })
    }
    return reply.send(success({ list }))
  })

  server.get('/finance/statistics', async (request, reply) => {
    const { period } = z.object({ period: z.string().optional() }).parse(request.query)
    // 2026-07-22 P0 Round 3 鲁棒性加固:显式 whitelist mapping 替代三元运算符
    // PostgreSQL interval 字面量不能参数化绑定,用 sql.raw 注入硬编码白名单字符串
    // 任何不在白名单的 period 值统一降级为 '7 days',杜绝注入风险
    const INTERVAL_WHITELIST: Record<string, string> = {
      year: '1 year',
      month: '1 month',
      week: '7 days',
    }
    const interval = INTERVAL_WHITELIST[period ?? ''] ?? '7 days'

    const [stats] = await db
      .select({
        totalRevenue: sql<number>`coalesce(sum(${eduOrders.payAmount}), 0)`,
        totalOrders: count(),
        paidOrders: sql<number>`count(*) filter (where ${eduOrders.status} = 'paid')`,
        refundedAmount: sql<number>`coalesce(sum(case when ${eduOrders.status} = 'refunded' then ${eduOrders.payAmount} else 0 end), 0)`,
        avgOrderAmount: sql<number>`coalesce(avg(${eduOrders.payAmount}), 0)`,
      })
      .from(eduOrders)
      .where(gte(eduOrders.createdAt, sql`now() - interval '${sql.raw(interval)}'`))

    const byType = await db
      .select({
        type: sql<string>`coalesce(${eduOrders.orderType}, 'unknown')`,
        count: count(),
        amount: sql<number>`coalesce(sum(${eduOrders.payAmount}), 0)`,
      })
      .from(eduOrders)
      .where(gte(eduOrders.createdAt, sql`now() - interval '${sql.raw(interval)}'`))
      .groupBy(sql`1`)

    const byMonth = await db
      .select({
        month: sql<string>`to_char(${eduOrders.createdAt}, 'YYYY-MM')`,
        revenue: sql<number>`coalesce(sum(${eduOrders.payAmount}), 0)`,
        orders: count(),
      })
      .from(eduOrders)
      .where(gte(eduOrders.createdAt, sql`now() - interval '6 months'`))
      .groupBy(sql`1`)
      .orderBy(sql`1`)

    return reply.send(
      success({
        totalRevenue: stats?.totalRevenue ?? 0,
        totalOrders: stats?.totalOrders ?? 0,
        paidOrders: stats?.paidOrders ?? 0,
        refundedAmount: stats?.refundedAmount ?? 0,
        avgOrderAmount: stats?.avgOrderAmount ?? 0,
        byType,
        byMonth,
      }),
    )
  })

  // GET /api-logs — API 日志列表(分页 + status/endpoint/method 筛选)
  server.get('/api-logs', async (request, reply) => {
    const q = apiLogQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize, status, endpoint, method } = q.data
    const conds: (SQL | undefined)[] = []
    if (status === '2xx')
      conds.push(sql`${apiLogs.statusCode} >= 200 and ${apiLogs.statusCode} < 300`)
    if (status === '4xx')
      conds.push(sql`${apiLogs.statusCode} >= 400 and ${apiLogs.statusCode} < 500`)
    if (status === '5xx') conds.push(sql`${apiLogs.statusCode} >= 500`)
    if (endpoint) conds.push(ilike(apiLogs.path, `%${endpoint}%`))
    if (method) conds.push(eq(apiLogs.method, method))
    const where = conds.length ? and(...conds) : undefined

    const [list, totalRow] = await Promise.all([
      db
        .select({
          id: apiLogs.id,
          method: apiLogs.method,
          path: apiLogs.path,
          statusCode: apiLogs.statusCode,
          duration: apiLogs.duration,
          createdAt: apiLogs.createdAt,
        })
        .from(apiLogs)
        .where(where)
        .orderBy(desc(apiLogs.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ c: sql<number>`count(*)::int` }).from(apiLogs).where(where),
    ])
    return reply.send(success({ list, total: totalRow[0]?.c ?? 0 }))
  })
}
