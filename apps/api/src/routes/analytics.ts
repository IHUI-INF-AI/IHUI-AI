import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import { db } from '../db/index.js'
import { analyticsEvents } from '@ihui/database'
import { eq, and, gte, lte, desc, sql, isNotNull } from 'drizzle-orm'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// 行为埋点事件模块(2026-08-10 立)
//   - POST /api/analytics/track        前端批量上报埋点事件(匿名/登录均可)
//   - 管理端聚合:/api/admin/analytics/* 事件类型排行 / 行为热度 / 概览
// 事件命名约定(properties 自由扩展):
//   page_view       页面访问  { path, title, referer, sessionId }
//   stay_duration   停留时长  { path, seconds }
//   click           按钮/链接点击 { target, label, category }
//   search          站内搜索  { keyword }
//   download        下载行为  { name, type }
//   ai_call         AI 调用  { model, provider }
//   login           登录成功
// =============================================================================

const trackEventSchema = z.object({
  events: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        category: z.string().max(100).optional(),
        label: z.string().max(300).optional(),
        value: z.number().optional(),
        props: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .min(1)
    .max(100),
})

const dateRangeQuery = z.object({
  startTime: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
  endTime: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
})

const eventListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  event: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).max(100).optional()),
  userId: z.string().optional().transform(emptyToUndefined).pipe(z.uuid().optional()),
  startTime: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
  endTime: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
})

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
// 公共上报(匿名/登录均可,前端埋点批量上报)
// =============================================================================

export const analyticsRoutes: FastifyPluginAsync = async (server) => {
  server.post(
    '/analytics/track',
    {
      schema: {
        summary: '批量上报埋点事件',
        tags: ['analytics'],
        body: {
          type: 'object',
          required: ['events'],
          properties: {
            events: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  category: { type: 'string' },
                  label: { type: 'string' },
                  value: { type: 'number' },
                  props: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
        response: { 200: dataObjSchema, 400: dataObjSchema },
      },
    },
    async (request, reply) => {
      const parsed = trackEventSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const ip = request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ?? request.ip
      const ua = request.headers['user-agent']?.slice(0, 500) ?? null
      // 已登录:从 request.userId 取(Fastify decorateRequest 由 authenticate 注入)
      const userId = (request as { userId?: string }).userId ?? null

      const rows = parsed.data.events.map((ev) => ({
        userId: userId ? userId as string : null,
        event: ev.name,
        properties: {
          category: ev.category,
          label: ev.label,
          value: ev.value,
          ...(ev.props ?? {}),
        },
        ip: ip?.slice(0, 45) ?? null,
        userAgent: ua,
      }))
      // 批量插入(失败静默,不影响用户体验)
      try {
        await db.insert(analyticsEvents).values(rows)
      } catch (e) {
        server.log.warn({ err: e }, 'analytics track insert failed')
        return reply.send(success({ inserted: 0 }))
      }
      return reply.send(success({ inserted: rows.length }))
    },
  )
}

// =============================================================================
// 管理端聚合统计
// =============================================================================

export const adminAnalyticsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /analytics/summary - 概览(事件总数/类型数/今日/活跃用户)
  server.get(
    '/analytics/summary',
    {
      schema: {
        summary: '行为埋点概览',
        tags: ['analytics'],
        querystring: { type: 'object', properties: dateRangeProps },
        response: { 200: dataObjSchema, 400: dataObjSchema },
      },
    },
    async (request, reply) => {
      const parsed = dateRangeQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { startTime, endTime } = parsed.data
      const conds: any[] = []
      if (startTime) conds.push(gte(analyticsEvents.createdAt, new Date(`${startTime}T00:00:00`)))
      if (endTime) conds.push(lte(analyticsEvents.createdAt, new Date(`${endTime}T23:59:59`)))
      const where = conds.length > 0 ? and(...conds) : undefined

      const [row] = await db
        .select({
          totalEvents: sql<number>`count(*)::int`,
          eventTypes: sql<number>`count(distinct ${analyticsEvents.event})::int`,
          uniqueUsers: sql<number>`count(distinct ${analyticsEvents.userId})::int`,
        })
        .from(analyticsEvents)
        .where(where)

      // 今日事件数
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const [todayRow] = await db
        .select({ todayEvents: sql<number>`count(*)::int` })
        .from(analyticsEvents)
        .where(gte(analyticsEvents.createdAt, todayStart))

      // 最近事件类型分布
      const byEvent = await db
        .select({
          event: analyticsEvents.event,
          count: sql<number>`count(*)::int`,
        })
        .from(analyticsEvents)
        .where(where)
        .groupBy(analyticsEvents.event)
        .orderBy(desc(sql`count(*)`))
        .limit(10)

      return reply.send(
        success({
          summary: row ?? { totalEvents: 0, eventTypes: 0, uniqueUsers: 0 },
          todayEvents: (todayRow as unknown as Array<{ todayEvents: number }>)[0]?.todayEvents ?? 0,
          byEvent,
        }),
      )
    },
  )

  // GET /analytics/events/rank - 事件类型排行(PV + 用户数)
  server.get(
    '/analytics/events/rank',
    {
      schema: {
        summary: '事件类型排行',
        tags: ['analytics'],
        querystring: { type: 'object', properties: dateRangeProps },
        response: { 200: dataObjSchema, 400: dataObjSchema },
      },
    },
    async (request, reply) => {
      const parsed = dateRangeQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { startTime, endTime } = parsed.data
      const conds: any[] = []
      if (startTime) conds.push(gte(analyticsEvents.createdAt, new Date(`${startTime}T00:00:00`)))
      if (endTime) conds.push(lte(analyticsEvents.createdAt, new Date(`${endTime}T23:59:59`)))
      const where = conds.length > 0 ? and(...conds) : undefined

      const list = await db
        .select({
          event: analyticsEvents.event,
          count: sql<number>`count(*)::int`,
          uniqueUsers: sql<number>`count(distinct ${analyticsEvents.userId})::int`,
        })
        .from(analyticsEvents)
        .where(where)
        .groupBy(analyticsEvents.event)
        .orderBy(desc(sql`count(*)`))
        .limit(50)
      return reply.send(success({ list }))
    },
  )

  // GET /analytics/hot-pages - 行为热度页面(来自 page_view 事件的 path)
  server.get(
    '/analytics/hot-pages',
    {
      schema: {
        summary: '行为热度页面排行',
        tags: ['analytics'],
        querystring: { type: 'object', properties: dateRangeProps },
        response: { 200: dataObjSchema, 400: dataObjSchema },
      },
    },
    async (request, reply) => {
      const parsed = dateRangeQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { startTime, endTime } = parsed.data
      const conds: any[] = [eq(analyticsEvents.event, 'page_view'), isNotNull(sql`${analyticsEvents.properties}->>'path'`)]
      if (startTime) conds.push(gte(analyticsEvents.createdAt, new Date(`${startTime}T00:00:00`)))
      if (endTime) conds.push(lte(analyticsEvents.createdAt, new Date(`${endTime}T23:59:59`)))
      const where = and(...conds)

      const list = await db
        .select({
          path: sql<string>`${analyticsEvents.properties}->>'path'`,
          pv: sql<number>`count(*)::int`,
          uniqueUsers: sql<number>`count(distinct ${analyticsEvents.userId})::int`,
        })
        .from(analyticsEvents)
        .where(where)
        .groupBy(sql`${analyticsEvents.properties}->>'path'`)
        .orderBy(desc(sql`count(*)`))
        .limit(50)
      return reply.send(success({ list }))
    },
  )

  // GET /analytics/trend - 按天/小时聚合事件趋势
  server.get(
    '/analytics/trend',
    {
      schema: {
        summary: '事件趋势(按天)',
        tags: ['analytics'],
        querystring: { type: 'object', properties: dateRangeProps },
        response: { 200: dataObjSchema, 400: dataObjSchema },
      },
    },
    async (request, reply) => {
      const parsed = dateRangeQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { startTime, endTime } = parsed.data
      const conds: any[] = []
      if (startTime) conds.push(gte(analyticsEvents.createdAt, new Date(`${startTime}T00:00:00`)))
      if (endTime) conds.push(lte(analyticsEvents.createdAt, new Date(`${endTime}T23:59:59`)))
      const where = conds.length > 0 ? and(...conds) : undefined

      const list = await db
        .select({
          day: sql<string>`to_char(${analyticsEvents.createdAt}, 'YYYY-MM-DD')`,
          event: analyticsEvents.event,
          count: sql<number>`count(*)::int`,
        })
        .from(analyticsEvents)
        .where(where)
        .groupBy(sql`to_char(${analyticsEvents.createdAt}, 'YYYY-MM-DD')`, analyticsEvents.event)
        .orderBy(sql`to_char(${analyticsEvents.createdAt}, 'YYYY-MM-DD')`)
      return reply.send(success({ list }))
    },
  )

  // GET /analytics/events/list - 原始事件列表(筛选/分页)
  server.get(
    '/analytics/events/list',
    {
      schema: {
        summary: '原始事件列表',
        tags: ['analytics'],
        querystring: {
          type: 'object',
          properties: {
            ...dateRangeProps,
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            event: { type: 'string' },
            userId: { type: 'string', format: 'uuid' },
          },
        },
        response: { 200: dataObjSchema, 400: dataObjSchema },
      },
    },
    async (request, reply) => {
      const parsed = eventListQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { page, pageSize, event, userId, startTime, endTime } = parsed.data
      const conds: any[] = []
      if (event) conds.push(eq(analyticsEvents.event, event))
      if (userId) conds.push(eq(analyticsEvents.userId, userId))
      if (startTime) conds.push(gte(analyticsEvents.createdAt, new Date(`${startTime}T00:00:00`)))
      if (endTime) conds.push(lte(analyticsEvents.createdAt, new Date(`${endTime}T23:59:59`)))
      const where = conds.length > 0 ? and(...conds) : undefined
      const offset = (page - 1) * pageSize
      const [list, totalRows] = await Promise.all([
        db
          .select()
          .from(analyticsEvents)
          .where(where)
          .orderBy(desc(analyticsEvents.createdAt))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(analyticsEvents)
          .where(where),
      ])
      return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
    },
  )
}
