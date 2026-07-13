import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import {
  saveVisitLog,
  getVisitSummary,
  getDayPvList,
  getDayUvList,
  findIpCityList,
} from '../db/visit-tracking-queries.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { db } from '../db/index.js'
import { visitLogs } from '@ihui/database'
import { eq, desc, and, gte, lte, sql, like, isNotNull } from 'drizzle-orm'

// =============================================================================
// Zod schemas
// =============================================================================

// 兼容 {data: {...}} 与平铺结构
const saveVisitLogSchema = z
  .object({
    data: z
      .object({
        userId: z.string().uuid().optional(),
        ip: z.string().max(64).optional(),
        city: z.string().max(100).optional(),
        url: z.string().max(512).optional(),
        referer: z.string().max(512).optional(),
        userAgent: z.string().max(512).optional(),
        sessionId: z.string().max(128).optional(),
        visitDate: z.string().max(10).optional(),
      })
      .optional(),
    userId: z.string().uuid().optional(),
    ip: z.string().max(64).optional(),
    city: z.string().max(100).optional(),
    url: z.string().max(512).optional(),
    referer: z.string().max(512).optional(),
    userAgent: z.string().max(512).optional(),
    sessionId: z.string().max(128).optional(),
    visitDate: z.string().max(10).optional(),
  })
  .transform((v) => (v.data ? v.data : v))

const dateRangeQuery = z.object({
  startTime: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  endTime: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
})

const ipCityQuery = z.object({
  startTime: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  endTime: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const logListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  url: z.preprocess(emptyToUndefined, z.string().min(1).max(512).optional()),
  startTime: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  endTime: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
})

const pageStatsQuery = z.object({
  startTime: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  endTime: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const sourceRecordSchema = z.object({
  referer: z.string().min(1).max(512),
  sessionId: z.string().max(128).optional(),
  userId: z.string().uuid().optional(),
  ip: z.string().max(64).optional(),
})

const pageRecordSchema = z.object({
  url: z.string().min(1).max(512),
  sessionId: z.string().max(128).optional(),
  userId: z.string().uuid().optional(),
  ip: z.string().max(64).optional(),
})

const activityQuery = z.object({
  startTime: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  endTime: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  granularity: z.enum(['hour', 'day']).optional().default('day'),
})

const userJourneyQuery = z.object({
  sessionId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  ip: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

// =============================================================================
// 鉴权辅助
// =============================================================================

const dataObjSchema = {
  type: 'object',
  properties: {
    code: { type: 'number' },
    message: { type: 'string' },
    data: { type: 'object', additionalProperties: true },
  },
} as const

const dateRangeProps = {
  startTime: { type: 'string', description: '开始时间 YYYY-MM-DD' },
  endTime: { type: 'string', description: '结束时间 YYYY-MM-DD' },
} as const

// =============================================================================
// 公共路由（前缀 /api，无需登录，仅保存访问记录）
// =============================================================================

export const visitTrackingRoutes: FastifyPluginAsync = async (server) => {
  // POST /visit-tracking/visit-log - 保存访问记录(访客可不登录)
  server.post(
    '/visit-tracking/visit-log',
    {
      schema: {
        summary: '保存访问记录',
        tags: ['visit-tracking'],
        body: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              description: '访问记录数据(可选, 缺省则取平铺字段)',
              properties: {
                userId: { type: 'string', format: 'uuid' },
                ip: { type: 'string' },
                city: { type: 'string' },
                url: { type: 'string' },
                referer: { type: 'string' },
                userAgent: { type: 'string' },
                sessionId: { type: 'string' },
                visitDate: { type: 'string', description: 'YYYY-MM-DD' },
              },
            },
            userId: { type: 'string', format: 'uuid' },
            ip: { type: 'string' },
            city: { type: 'string' },
            url: { type: 'string' },
            referer: { type: 'string' },
            userAgent: { type: 'string' },
            sessionId: { type: 'string' },
            visitDate: { type: 'string' },
          },
        },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = saveVisitLogSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const visitLog = await saveVisitLog(parsed.data)
      return reply.send(success({ visitLog }))
    },
  )

  // POST /visit-tracking/source/record - 记录来源（访客可不登录）
  server.post('/visit-tracking/source/record', async (request, reply) => {
    const parsed = sourceRecordSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const visitDate = new Date().toISOString().slice(0, 10)
    const [row] = await db
      .insert(visitLogs)
      .values({
        referer: parsed.data.referer,
        sessionId: parsed.data.sessionId,
        userId: parsed.data.userId,
        ip: parsed.data.ip,
        visitDate,
      })
      .returning()
    return reply.send(success({ visitLog: row }))
  })

  // POST /visit-tracking/page/record - 记录页面访问（访客可不登录）
  server.post('/visit-tracking/page/record', async (request, reply) => {
    const parsed = pageRecordSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const visitDate = new Date().toISOString().slice(0, 10)
    const [row] = await db
      .insert(visitLogs)
      .values({
        url: parsed.data.url,
        sessionId: parsed.data.sessionId,
        userId: parsed.data.userId,
        ip: parsed.data.ip,
        visitDate,
      })
      .returning()
    return reply.send(success({ visitLog: row }))
  })
}

// =============================================================================
// 管理员路由（前缀 /api/admin，访问统计）
// =============================================================================

export const adminVisitTrackingRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /visit-tracking/summary - 访问概览
  server.get(
    '/visit-tracking/summary',
    {
      schema: {
        summary: '访问概览',
        tags: ['visit-tracking'],
        querystring: { type: 'object', properties: dateRangeProps },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = dateRangeQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const summary = await getVisitSummary(parsed.data.startTime, parsed.data.endTime)
      return reply.send(success({ summary }))
    },
  )

  // GET /visit-tracking/day/pv/list - 每日 PV 列表
  server.get(
    '/visit-tracking/day/pv/list',
    {
      schema: {
        summary: '每日 PV 列表',
        tags: ['visit-tracking'],
        querystring: { type: 'object', properties: dateRangeProps },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = dateRangeQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const list = await getDayPvList(parsed.data.startTime, parsed.data.endTime)
      return reply.send(success({ list }))
    },
  )

  // GET /visit-tracking/day/uv/list - 每日 UV 列表
  server.get(
    '/visit-tracking/day/uv/list',
    {
      schema: {
        summary: '每日 UV 列表',
        tags: ['visit-tracking'],
        querystring: { type: 'object', properties: dateRangeProps },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = dateRangeQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const list = await getDayUvList(parsed.data.startTime, parsed.data.endTime)
      return reply.send(success({ list }))
    },
  )

  // GET /visit-tracking/ip-city/summary/list - IP 城市统计列表
  server.get(
    '/visit-tracking/ip-city/summary/list',
    {
      schema: {
        summary: 'IP 城市统计列表',
        tags: ['visit-tracking'],
        querystring: {
          type: 'object',
          properties: {
            ...dateRangeProps,
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = ipCityQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findIpCityList({
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
      })
      return reply.send(success(result))
    },
  )

  // GET /visit-tracking/log/list - 访问日志列表（支持 userId/url/时间范围筛选）
  server.get(
    '/visit-tracking/log/list',
    {
      schema: {
        summary: '访问日志列表',
        tags: ['visit-tracking'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            userId: { type: 'string', format: 'uuid' },
            url: { type: 'string' },
            startTime: { type: 'string', description: 'YYYY-MM-DD' },
            endTime: { type: 'string', description: 'YYYY-MM-DD' },
          },
        },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = logListQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { page, pageSize, userId, url, startTime, endTime } = parsed.data
      const conds = []
      if (userId) conds.push(eq(visitLogs.userId, userId))
      if (url) conds.push(like(visitLogs.url, `%${url}%`))
      if (startTime) conds.push(gte(visitLogs.visitDate, startTime.slice(0, 10)))
      if (endTime) conds.push(lte(visitLogs.visitDate, endTime.slice(0, 10)))
      const where = conds.length > 0 ? and(...conds) : undefined
      const offset = (page - 1) * pageSize
      const [list, totalRows] = await Promise.all([
        db
          .select()
          .from(visitLogs)
          .where(where)
          .orderBy(desc(visitLogs.createdAt))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(visitLogs)
          .where(where),
      ])
      return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
    },
  )

  // GET /visit-tracking/stats/page - 页面统计（按 url 分组 PV/UV）
  server.get(
    '/visit-tracking/stats/page',
    {
      schema: {
        summary: '页面统计',
        tags: ['visit-tracking'],
        querystring: {
          type: 'object',
          properties: {
            ...dateRangeProps,
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = pageStatsQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { startTime, endTime, page, pageSize } = parsed.data
      const conds = [isNotNull(visitLogs.url)]
      if (startTime) conds.push(gte(visitLogs.visitDate, startTime.slice(0, 10)))
      if (endTime) conds.push(lte(visitLogs.visitDate, endTime.slice(0, 10)))
      const where = and(...conds)
      const offset = (page - 1) * pageSize
      const [list, totalRows] = await Promise.all([
        db
          .select({
            url: visitLogs.url,
            pv: sql<number>`count(${visitLogs.id})::int`,
            uv: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
          })
          .from(visitLogs)
          .where(where)
          .groupBy(visitLogs.url)
          .orderBy(desc(sql`count(${visitLogs.id})`))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(distinct ${visitLogs.url})::int` })
          .from(visitLogs)
          .where(where),
      ])
      return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
    },
  )

  // ===========================================================================
  // P0-4: 安全审计与行为分析端点（迁移自 cloud-learning-trace-service）
  // IP 黑名单使用内存 Map（无 DB schema 变更；重启清空）
  // 行为分析/安全事件基于 visit_logs 表聚合查询
  // ===========================================================================

  interface IpBlacklistEntry {
    ip: string
    reason: string
    addedAt: Date
    expireAt: Date | null
  }
  const ipBlacklist = new Map<string, IpBlacklistEntry>()

  function cleanupExpiredBlacklist(): void {
    const now = Date.now()
    for (const [ip, entry] of ipBlacklist) {
      if (entry.expireAt && entry.expireAt.getTime() < now) ipBlacklist.delete(ip)
    }
  }

  const ipBlacklistAddSchema = z.object({
    ip: z.string().min(1).max(64),
    reason: z.string().max(200).optional().default(''),
    ttlSeconds: z.number().int().min(0).optional(),
  })

  // GET /visit-tracking/ip-blacklist - 列出 IP 黑名单
  server.get('/visit-tracking/ip-blacklist', async (_request, reply) => {
    cleanupExpiredBlacklist()
    const list = Array.from(ipBlacklist.values())
    return reply.send(success({ list, total: list.length }))
  })

  // POST /visit-tracking/ip-blacklist - 添加 IP 到黑名单
  server.post('/visit-tracking/ip-blacklist', async (request, reply) => {
    const parsed = ipBlacklistAddSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { ip, reason, ttlSeconds } = parsed.data
    const entry: IpBlacklistEntry = {
      ip,
      reason,
      addedAt: new Date(),
      expireAt: ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null,
    }
    ipBlacklist.set(ip, entry)
    return reply.send(success({ entry }))
  })

  // DELETE /visit-tracking/ip-blacklist/:ip - 从黑名单移除 IP
  server.delete('/visit-tracking/ip-blacklist/:ip', async (request, reply) => {
    const { ip } = z.object({ ip: z.string().min(1) }).parse(request.params)
    if (!ipBlacklist.delete(ip)) {
      return reply.status(404).send(error(404, 'IP 不在黑名单中'))
    }
    return reply.send(success({ removed: true }))
  })

  // GET /traces/security-events - 安全事件统计（高频访问 IP / 异常 UA / 异常 referer）
  server.get('/traces/security-events', async (request, reply) => {
    const parsed = dateRangeQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const conds = []
    if (parsed.data.startTime)
      conds.push(gte(visitLogs.visitDate, parsed.data.startTime.slice(0, 10)))
    if (parsed.data.endTime) conds.push(lte(visitLogs.visitDate, parsed.data.endTime.slice(0, 10)))
    const where = conds.length > 0 ? and(...conds) : undefined

    const [topIps, topUserAgents, topReferers] = await Promise.all([
      db
        .select({
          ip: visitLogs.ip,
          count: sql<number>`count(*)::int`,
        })
        .from(visitLogs)
        .where(where)
        .groupBy(visitLogs.ip)
        .orderBy(desc(sql`count(*)`))
        .limit(20),
      db
        .select({
          userAgent: visitLogs.userAgent,
          count: sql<number>`count(*)::int`,
        })
        .from(visitLogs)
        .where(where)
        .groupBy(visitLogs.userAgent)
        .orderBy(desc(sql`count(*)`))
        .limit(20),
      db
        .select({
          referer: visitLogs.referer,
          count: sql<number>`count(*)::int`,
        })
        .from(visitLogs)
        .where(where)
        .groupBy(visitLogs.referer)
        .orderBy(desc(sql`count(*)`))
        .limit(20),
    ])

    cleanupExpiredBlacklist()
    return reply.send(
      success({
        topIps,
        topUserAgents,
        topReferers,
        ipBlacklist: Array.from(ipBlacklist.values()),
        blacklistedHits: topIps.filter((r) => ipBlacklist.has(r.ip ?? '')),
      }),
    )
  })

  // GET /traces/activity - 用户活跃度（按天/小时聚合 PV/UV）
  server.get('/traces/activity', async (request, reply) => {
    const parsed = activityQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { startTime, endTime, granularity } = parsed.data
    const conds = []
    if (startTime) conds.push(gte(visitLogs.visitDate, startTime.slice(0, 10)))
    if (endTime) conds.push(lte(visitLogs.visitDate, endTime.slice(0, 10)))
    const where = conds.length > 0 ? and(...conds) : undefined
    const bucket =
      granularity === 'hour'
        ? sql<string>`to_char(${visitLogs.createdAt}, 'YYYY-MM-DD HH24:00')`
        : visitLogs.visitDate
    const list = await db
      .select({
        bucket,
        pv: sql<number>`count(*)::int`,
        uv: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
      })
      .from(visitLogs)
      .where(where)
      .groupBy(bucket)
      .orderBy(bucket)
    return reply.send(success({ list, granularity }))
  })

  // GET /traces/popular-pages - 热门页面（PV Top N）
  server.get('/traces/popular-pages', async (request, reply) => {
    const parsed = dateRangeQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const conds = [isNotNull(visitLogs.url)]
    if (parsed.data.startTime)
      conds.push(gte(visitLogs.visitDate, parsed.data.startTime.slice(0, 10)))
    if (parsed.data.endTime) conds.push(lte(visitLogs.visitDate, parsed.data.endTime.slice(0, 10)))
    const list = await db
      .select({
        url: visitLogs.url,
        pv: sql<number>`count(*)::int`,
        uv: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
      })
      .from(visitLogs)
      .where(and(...conds))
      .groupBy(visitLogs.url)
      .orderBy(desc(sql`count(*)`))
      .limit(50)
    return reply.send(success({ list }))
  })

  // GET /traces/user-journey - 用户访问路径（按 sessionId 或 ip 追踪）
  server.get('/traces/user-journey', async (request, reply) => {
    const { sessionId, ip, limit } = userJourneyQuery.parse(request.query)
    const conds = []
    if (sessionId) conds.push(eq(visitLogs.sessionId, sessionId))
    if (ip) conds.push(eq(visitLogs.ip, ip))
    if (conds.length === 0) {
      return reply.status(400).send(error(400, '必须提供 sessionId 或 ip'))
    }
    const list = await db
      .select({
        id: visitLogs.id,
        url: visitLogs.url,
        referer: visitLogs.referer,
        sessionId: visitLogs.sessionId,
        ip: visitLogs.ip,
        userId: visitLogs.userId,
        createdAt: visitLogs.createdAt,
      })
      .from(visitLogs)
      .where(and(...conds))
      .orderBy(desc(visitLogs.createdAt))
      .limit(limit)
    return reply.send(success({ list, total: list.length }))
  })

  // GET /traces/performance - 性能监控概览（无独立性能表，返回桩 + 访问量基线）
  server.get('/traces/performance', async (request, reply) => {
    const parsed = dateRangeQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const conds = []
    if (parsed.data.startTime)
      conds.push(gte(visitLogs.visitDate, parsed.data.startTime.slice(0, 10)))
    if (parsed.data.endTime) conds.push(lte(visitLogs.visitDate, parsed.data.endTime.slice(0, 10)))
    const where = conds.length > 0 ? and(...conds) : undefined
    const [row] = await db
      .select({
        totalRequests: sql<number>`count(*)::int`,
        uniqueVisitors: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
        avgPerVisitor: sql<number>`coalesce(count(*)::float / nullif(count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip})), 0), 0)`,
      })
      .from(visitLogs)
      .where(where)
    return reply.send(
      success({
        summary: row ?? { totalRequests: 0, uniqueVisitors: 0, avgPerVisitor: 0 },
        note: '性能监控表未独立建模，仅基于 visit_logs 聚合',
      }),
    )
  })

  // GET /traces/slow-queries - 慢查询列表（无独立性能表，返回空桩）
  server.get('/traces/slow-queries', async (_request, reply) => {
    return reply.send(
      success({
        list: [],
        total: 0,
        note: '慢查询表未独立建模，需启用 DB 端慢查询日志后接入',
      }),
    )
  })

  // GET /traces/export - 导出原始访问日志（JSON）
  server.get('/traces/export', async (request, reply) => {
    const parsed = logListQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, userId, url, startTime, endTime } = parsed.data
    const conds = []
    if (userId) conds.push(eq(visitLogs.userId, userId))
    if (url) conds.push(like(visitLogs.url, `%${url}%`))
    if (startTime) conds.push(gte(visitLogs.visitDate, startTime.slice(0, 10)))
    if (endTime) conds.push(lte(visitLogs.visitDate, endTime.slice(0, 10)))
    const where = conds.length > 0 ? and(...conds) : undefined
    const offset = (page - 1) * pageSize
    const [list, totalRows] = await Promise.all([
      db
        .select()
        .from(visitLogs)
        .where(where)
        .orderBy(desc(visitLogs.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(visitLogs)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  // GET /traces/export-report - 导出汇总报告（PV/UV 趋势 + Top 页面 + Top IP）
  server.get('/traces/export-report', async (request, reply) => {
    const parsed = dateRangeQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const conds = []
    if (parsed.data.startTime)
      conds.push(gte(visitLogs.visitDate, parsed.data.startTime.slice(0, 10)))
    if (parsed.data.endTime) conds.push(lte(visitLogs.visitDate, parsed.data.endTime.slice(0, 10)))
    const where = conds.length > 0 ? and(...conds) : undefined

    const [summary, dailyTrend, topPages, topIps] = await Promise.all([
      db
        .select({
          pv: sql<number>`count(*)::int`,
          uv: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
        })
        .from(visitLogs)
        .where(where),
      db
        .select({
          date: visitLogs.visitDate,
          pv: sql<number>`count(*)::int`,
          uv: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
        })
        .from(visitLogs)
        .where(where)
        .groupBy(visitLogs.visitDate)
        .orderBy(visitLogs.visitDate),
      db
        .select({
          url: visitLogs.url,
          pv: sql<number>`count(*)::int`,
        })
        .from(visitLogs)
        .where(and(...(conds.length > 0 ? conds : [sql`true`]), isNotNull(visitLogs.url)))
        .groupBy(visitLogs.url)
        .orderBy(desc(sql`count(*)`))
        .limit(20),
      db
        .select({
          ip: visitLogs.ip,
          pv: sql<number>`count(*)::int`,
        })
        .from(visitLogs)
        .where(where)
        .groupBy(visitLogs.ip)
        .orderBy(desc(sql`count(*)`))
        .limit(20),
    ])

    return reply.send(
      success({
        generatedAt: new Date().toISOString(),
        range: parsed.data,
        summary: summary[0] ?? { pv: 0, uv: 0 },
        dailyTrend,
        topPages,
        topIps,
      }),
    )
  })
}
