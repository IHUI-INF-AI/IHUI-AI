// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import { db } from '../db/index.js'
import { analyticsEvents } from '@ihui/database'
import { eq, and, gte, lte, desc, sql, isNotNull, type SQL } from 'drizzle-orm'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { createAnalyticsEvent } from '../db/analytics-queries.js'

// =============================================================================
// 行为埋点事件模块(2026-08-10 立)
//   - 公共上报 POST /api/analytics/track 由 routes/user/misc-routes.ts 提供
//     (兼容批量 {events:[]} 与单事件 {event})
//   - 本文件:管理端聚合 /api/admin/analytics/* 事件类型排行 / 行为热度 / 概览
// 事件命名约定(properties 受白名单约束,见 ANALYTICS_PROP_WHITELIST):
//   page_view       页面访问  { path, sessionId }        —— 旧文档里的 title/referer 已不在白名单
//   page_time       页面停留  { value(秒), label(上一页路径) }
//   click           按钮/链接点击 { label, category, tag }
//   search          站内搜索  —— keyword 键已丢弃(用户自由文本),仅保留 category/label
//   download        下载行为  { url }
//   form_submit     表单提交  —— keyword 键已丢弃(用户自由文本)
//   link_out        站外跳转  { url }
//   login           登录成功
// =============================================================================

// 2026-10-03 数据出域合规整改:埋点 props 由「无约束透传」收敛为显式白名单。
//
// 为什么丢弃而不是报错:props 是前端自由拼装的对象,抛错意味着**任一前端改动漏传一个
// 白名单外的键,线上埋点整批 400** —— 合规收紧不该以打挂数据采集为代价。丢弃是安全方向:
// 多余的键不落库,合法的事件照常入库。
//
// 为什么白名单在 handler 里而不在 JSON schema 里:schema 若写 additionalProperties:false,
// ajv 会在**校验期**直接 400,同样打挂埋点。schema 保持宽容(只声明已知键供 OpenAPI 文档),
// 过滤在 handler 强制执行 —— 校验期宽容、入库期严格。
//
// 键的来源:逐个 grep 过全仓在用调用方(use-analytics / use-route-analytics /
// send-message / AnalyticsCapture / vip / tool-call-summary-card / cli agent.ts),
// 凡在用且非用户自由文本的一律保留,避免误杀在用键。
const ANALYTICS_PROP_WHITELIST: ReadonlySet<string> = new Set([
  // ── 任务书给定的基线白名单 ──
  'path', // page_view 页面路径(hot-pages 接口按它聚合,必须在)
  'ts', // use-analytics.track 统一注入的时间戳
  'category',
  'label',
  'value',
  'ref',
  'durationMs',
  'count',
  'from', // route_change 上一页
  'to', // route_change 当前页
  'result',
  'errorCode',
  'feature',
  'itemType',
  'itemId',
  // ── grep 实证在用、且非用户自由文本的键(补入以免误杀)──
  'sessionId', // AnalyticsCapture:sessionStorage 内的匿名访问 id
  'url', // AnalyticsCapture:download / link_out,已过 stripUrlCredentialSegments
  'tag', // AnalyticsCapture:click 命中的元素标签名
  'location', // vip/page.tsx
  'target', // vip/page.tsx
  'method', // vip/details/PageClient.tsx 支付方式
  'cardType', // tool-call-summary-card.tsx
  'group_key', // tool-call-summary-card.tsx
  'children_count', // tool-call-summary-card.tsx
  'toolName', // cli agent.ts tool_call_completed
  'success', // cli agent.ts tool_call_completed
  'modelId', // cli agent.ts session_start
  'hasSession', // cli agent.ts session_start
  'totalTokens', // cli agent.ts session_end
])

/** props 键数上限:白名单已经限定了键集合,这里只防单个事件塞满 15 个键 × 超长值 */
const ANALYTICS_PROP_MAX_KEYS = 32
/** 字符串值截断长度:够放下 URL / 路径 / 短标签,又不至于把整段用户输入写进库 */
const ANALYTICS_PROP_MAX_STRING = 256

/**
 * props 值钳制:字符串截断,数字/布尔透传,其它类型(null / undefined / 对象 / 数组 /
 * 函数 / Symbol / BigInt / NaN / Infinity)一律丢弃。
 * @returns 可入库的值,或 undefined 表示该键应被丢弃
 */
function clampAnalyticsPropValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === 'string') {
    return value.length > ANALYTICS_PROP_MAX_STRING
      ? value.slice(0, ANALYTICS_PROP_MAX_STRING)
      : value
  }
  // 非有限数(JSON.stringify 会把它们序列化成 null,入库即失真),丢弃
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'boolean') return value
  return undefined
}

/**
 * 按白名单 + 值钳制收敛埋点 props。**纯函数**,导出供单测直接覆盖。
 * 非对象 / null / 数组 一律收敛为 {}。
 */
export function sanitizeAnalyticsProps(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return {}
  const out: Record<string, unknown> = {}
  let kept = 0
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (kept >= ANALYTICS_PROP_MAX_KEYS) break
    if (!ANALYTICS_PROP_WHITELIST.has(key)) continue
    const clamped = clampAnalyticsPropValue(raw)
    if (clamped === undefined) continue
    out[key] = clamped
    kept++
  }
  return out
}

const dateRangeQuery = z.object({
  startTime: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
  endTime: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
})

const eventListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  event: z
    .string()
    .optional()
    .transform(emptyToUndefined)
    .pipe(z.string().min(1).max(100).optional()),
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
// 注意:不可挂在带 authenticate 的 user/ 子路由下,否则匿名访客无法上报。
// =============================================================================

export const analyticsRoutes: FastifyPluginAsync = async (server) => {
  server.post(
    '/analytics/track',
    {
      schema: {
        summary: '批量上报埋点事件(兼容单事件)',
        tags: ['analytics'],
        body: {
          type: 'object',
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
                  // 2026-10-03:这里**故意保留 additionalProperties: true 且不声明子键类型**
                  // (见上方 ANALYTICS_PROP_WHITELIST 处的说明)。两个原因:
                  //  1) additionalProperties:false 会让 ajv 在校验期直接 400,打挂整批埋点;
                  //  2) 即便 additionalProperties:true,只要给子键声明了
                  //     type:['string','number','boolean'],ajv 仍会因「值类型不符」报
                  //     FST_ERR_VALIDATION —— 实测该错误在响应序列化阶段变成 500,整批丢失。
                  // 所以这里只列**键名**供 OpenAPI 文档展示(不写 type = 不约束),
                  // 过滤与钳制一律由 handler 侧 sanitizeAnalyticsProps 在入库前强制。
                  // 一句话:校验期宽容、入库期严格。
                  props: {
                    type: 'object',
                    properties: Object.fromEntries(
                      [...ANALYTICS_PROP_WHITELIST].map((k) => [k, {}]),
                    ),
                    additionalProperties: true,
                  },
                },
              },
            },
            event: { type: 'string' },
            properties: {
              type: 'object',
              properties: Object.fromEntries([...ANALYTICS_PROP_WHITELIST].map((k) => [k, {}])),
              additionalProperties: true,
            },
          },
        },
        response: { 200: dataObjSchema, 400: dataObjSchema },
      },
    },
    async (request, reply) => {
      const body =
        (request.body as {
          event?: string
          events?: Array<{
            name?: string
            category?: string
            label?: string
            value?: number
            props?: Record<string, unknown>
          }>
          properties?: unknown
        } | null) ?? {}
      const ip = request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ?? request.ip
      const ua = request.headers['user-agent']?.slice(0, 500) ?? null
      const userId = (request as { userId?: string }).userId ?? null

      // 批量格式 {events: [...]}
      if (Array.isArray(body.events) && body.events.length > 0) {
        let inserted = 0
        for (const ev of body.events.slice(0, 100)) {
          if (!ev?.name) continue
          try {
            await createAnalyticsEvent({
              userId,
              event: String(ev.name).slice(0, 100),
              // 顶层 category/label/value 与 props 合并后再过白名单:
              // 合并后统一过滤,避免 props 里的同名字段绕过钳制。
              properties: sanitizeAnalyticsProps({
                category: ev.category,
                label: ev.label,
                value: ev.value,
                ...(ev.props ?? {}),
              }),
              ip: ip?.slice(0, 45) ?? null,
              userAgent: ua,
            })
            inserted++
          } catch {
            /* 单条失败跳过 */
          }
        }
        return reply.send(success({ success: true, inserted }))
      }

      // 单事件格式 {event, properties}
      if (!body.event) return reply.status(400).send(error(400, '缺少 event 或 events'))
      try {
        await createAnalyticsEvent({
          userId,
          event: String(body.event).slice(0, 100),
          properties: sanitizeAnalyticsProps(body.properties),
          ip: ip?.slice(0, 45) ?? null,
          userAgent: ua,
        })
      } catch (e) {
        server.log.warn({ err: e }, 'analytics track insert failed')
      }
      return reply.send(success({ success: true }))
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
      const conds: SQL[] = []
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
      const conds: SQL[] = []
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
      const conds: SQL[] = [
        eq(analyticsEvents.event, 'page_view'),
        isNotNull(sql`${analyticsEvents.properties}->>'path'`),
      ]
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
      const conds: SQL[] = []
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
      const conds: SQL[] = []
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
