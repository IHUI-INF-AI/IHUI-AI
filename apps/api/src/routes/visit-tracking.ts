// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import {
  saveVisitLog,
  getVisitSummary,
  getDayPvList,
  getDayUvList,
  findIpCityList,
  getPageUsageList,
  visitScopeFilter,
  VISIT_SCOPE_VALUES,
  VISIT_PLATFORM_VALUES,
  type ObservedVisitorFields,
} from '../db/visit-tracking-queries.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { RateLimiter } from '../services/security-service.js'
import { db } from '../db/index.js'
import { visitLogs } from '@ihui/database'
import { eq, desc, and, gte, lte, sql, like, isNotNull } from 'drizzle-orm'

// =============================================================================
// 服务端观测面(真值化,2026-10-23 立)
// =============================================================================

/**
 * 取"这次请求真的是谁、用什么东西来的"。
 *
 * UA 的取法**照 `routes/analytics.ts` 的 POST /analytics/track 抄**(那张表 11349 行 UA
 * 全部有值,是本仓这条链的正确范式,不另发明第二套):`user-agent` 头 + 500 字符钳制
 * (列长 varchar(512))。
 *
 * ip 这一维**刻意不照 analytics 抄**,这是本次唯一一处有意的偏离,理由必须留档:
 * analytics 手读 `X-Forwarded-For` 首段,而本仓 `server.ts:199` 把 trustProxy 配成了
 * 显式可信代理清单(`config.TRUSTED_PROXIES`,默认 127.0.0.1/::1),
 * `services/security-service.ts:36-44` 的 `RateLimiter.getClientIp` 因此写明了口径:
 * "不再直接读 X-Forwarded-For 头 —— 手工读会绕过 trustProxy 检查,被攻击者伪造任意 IP
 * 绕过限流 / IP 拉黑 / 失败计数"。`visit_logs.ip` 不是旁观字段:它同时是管理端
 * 「访客追踪」IP 维度、IP 黑名单与 UV 去重的输入,把伪造 IP 收进来等于给这三处投毒。
 * 所以这里走被配置门控过的唯一出口 `RateLimiter.getClientIp`(= `request.ip`,
 * 与 `plugins/api-logger.ts:125` 写 api_logs.ip 同口径)。analytics.ts 那一处属
 * 同型残余暴露,本次按派单要求未动它(只作参照),已写进交付报告交后手。
 *
 * 客户端自报的同名字段**一律不进这里**：三个公开上报端点的 Zod 形状里已经没有
 * ip / userAgent 两个键(Zod 默认剥未知键),所以伪造值到不了 `saveVisitLog`。
 * 不写"客户端传了就用客户端的"那种兜底 —— 那正是 visit_logs 2550/2555 行 UA 为空、
 * IP 维度读不出东西的成因(AGENTS §5:身份/归属不得信客户端可整写的字段)。
 *
 * **刻意不 export**:本模块只导出 Fastify 插件 —— `tests/g261-validation.test.ts` 的
 * buildServer 会把模块里每个导出函数挨个 `server.register` 一遍,非插件形状的导出
 * 会在注册期炸掉 boot(实测:该探针因此 4 条用例各超时 30s)。取证改走注入链路,
 * 见 `tests/visit-tracking-truth.test.ts`。
 */
function observeVisitorRequest(request: FastifyRequest): ObservedVisitorFields {
  const peer = RateLimiter.getClientIp(request)
  const uaHeader = request.headers['user-agent']
  const ua = Array.isArray(uaHeader) ? uaHeader[0] : uaHeader
  return {
    ip: peer.slice(0, 64) || null,
    userAgent: ua ? ua.slice(0, 500) : null,
  }
}

// =============================================================================
// Zod schemas
// =============================================================================

// 兼容 {data: {...}} 与平铺结构
// 2026-10-23 真值化:这里**刻意不再声明** ip / userAgent —— 客户端自报的来源与 UA
// 属可整写字段,收下即污染整张表。旧前端仍可能带这两个键,剥未知键 ⇒ 静默丢弃,
// 不会 400(ajv 未配 additionalProperties:false,见 src/server.ts 的 ajv 段)。
// 2026-10-25 同一口径补上 visitDate:它是 PV/UV 的**分组键**(业务日),此前却由浏览器算好
// 送上来(VisitTracker 发 `new Date().toISOString().slice(0,10)`),任何人 POST 任意日期即可
// 回填/伪造任意一天的访问量,连格式都不校验(z.string().max(10) 收下 "abc" 也照存)。
// 现在与 ip/UA 同处理:不声明 ⇒ 剥掉静默忽略,业务日一律由服务端在写入口里定(见 saveVisitLog)。
const saveVisitLogSchema = z
  .object({
    data: z
      .object({
        userId: z.uuid().optional(),
        city: z.string().max(100).optional(),
        url: z.string().max(512).optional(),
        referer: z.string().max(512).optional(),
        sessionId: z.string().max(128).optional(),
      })
      .optional(),
    userId: z.uuid().optional(),
    city: z.string().max(100).optional(),
    url: z.string().max(512).optional(),
    referer: z.string().max(512).optional(),
    sessionId: z.string().max(128).optional(),
  })
  .transform((v) => (v.data ? v.data : v))

const dateRangeQuery = z.object({
  startTime: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
  endTime: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
  // 2026-10-25:采集面覆盖全站后,指标默认只算前台(public),后台/登录页单独可查;
  // 'all' 只给明细取证面用。判定单一真相源 = visit-tracking-queries 的 visitScopeFilter。
  scope: z.enum(VISIT_SCOPE_VALUES).default('public'),
})

const ipCityQuery = z.object({
  startTime: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
  endTime: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  scope: z.enum(VISIT_SCOPE_VALUES).default('public'),
})

const logListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().optional().transform(emptyToUndefined).pipe(z.uuid().optional()),
  url: z
    .string()
    .optional()
    .transform(emptyToUndefined)
    .pipe(z.string().min(1).max(512).optional()),
  startTime: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
  endTime: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
  // 明细是取证面 ⇒ 默认 'all';指标面(summary/趋势/排行)默认 'public'。
  scope: z.enum(VISIT_SCOPE_VALUES).default('all'),
})

const pageStatsQuery = z.object({
  startTime: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
  endTime: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  scope: z.enum(VISIT_SCOPE_VALUES).default('public'),
  // 2026-10-26:端筛选项。分桶判据与 /ops-wallboard 的 platformSplit 同源(visitPlatformFilter)。
  platform: z.enum(VISIT_PLATFORM_VALUES).default('all'),
  /** 排序键:pv=打开次数(默认) / uv=去重人数 */
  sort: z.enum(['pv', 'uv']).default('pv'),
})

// 同上:ip / userAgent 不在客户端可写字段清单里(2026-10-23 真值化)。
const sourceRecordSchema = z.object({
  referer: z.string().min(1).max(512),
  sessionId: z.string().max(128).optional(),
  userId: z.uuid().optional(),
})

const pageRecordSchema = z.object({
  url: z.string().min(1).max(512),
  sessionId: z.string().max(128).optional(),
  userId: z.uuid().optional(),
})

const activityQuery = z.object({
  startTime: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
  endTime: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
  granularity: z.enum(['hour', 'day']).optional().default('day'),
})

const userJourneyQuery = z.object({
  sessionId: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
  ip: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
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
  // Fastify 默认剥除未声明 query ⇒ scope 必须在这里声明,否则 Zod 永远读不到。
  scope: {
    type: 'string',
    enum: [...VISIT_SCOPE_VALUES],
    description: '访问面:public(默认)/admin/auth/all',
  },
} as const

// =============================================================================
// 公共路由（前缀 /api，无需登录，仅保存访问记录）
// =============================================================================

export const visitTrackingRoutes: FastifyPluginAsync = async (server) => {
  // POST /visit-tracking/visit-log - 保存访问记录(访客可不登录)
  server.post(
    '/visit-tracking/visit-log',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        summary: '保存访问记录',
        tags: ['visit-tracking'],
        body: {
          type: 'object',
          // 2026-10-23 真值化:ip / userAgent 已从可写字段清单移除(客户端自报值剥掉,
          // 服务端观测面另取)。这里不声明 additionalProperties:false ⇒ 旧前端带上
          // 这两个键也不会被 400,只是不起作用。
          properties: {
            data: {
              type: 'object',
              description: '访问记录数据(可选, 缺省则取平铺字段)',
              properties: {
                // G-261(同 G-257 口径):type-only,uuid 由 saveVisitLogSchema(Zod)校验;
                // format:'uuid' 走 ajv 先拒会被 400 响应 schema(code:number)掩盖成 500
                userId: { type: 'string', description: 'UUID(服务端 Zod 校验)' },
                city: { type: 'string' },
                url: { type: 'string' },
                referer: { type: 'string' },
                sessionId: { type: 'string' },
              },
            },
            userId: { type: 'string', description: 'UUID(服务端 Zod 校验)' },
            city: { type: 'string' },
            url: { type: 'string' },
            referer: { type: 'string' },
            sessionId: { type: 'string' },
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
      const visitLog = await saveVisitLog({
        ...parsed.data,
        observed: observeVisitorRequest(request),
      })
      return reply.send(success({ visitLog }))
    },
  )

  // POST /visit-tracking/source/record - 记录来源（访客可不登录）
  server.post(
    '/visit-tracking/source/record',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = sourceRecordSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      // 2026-10-23:此前这里手抄了一份 db.insert(visitLogs).values(...),既不写
      // user_agent、又收客户端自报 ip ⇒ 同一张表两个写入口径不同(§0.6)。
      // 现统一走 saveVisitLog 唯一写入口:ip/user_agent 取服务端观测面、visitDate 同一天。
      const visitLog = await saveVisitLog({
        referer: parsed.data.referer,
        sessionId: parsed.data.sessionId,
        userId: parsed.data.userId,
        observed: observeVisitorRequest(request),
      })
      return reply.send(success({ visitLog }))
    },
  )

  // POST /visit-tracking/page/record - 记录页面访问（访客可不登录）
  server.post(
    '/visit-tracking/page/record',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = pageRecordSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const visitLog = await saveVisitLog({
        url: parsed.data.url,
        sessionId: parsed.data.sessionId,
        userId: parsed.data.userId,
        observed: observeVisitorRequest(request),
      })
      return reply.send(success({ visitLog }))
    },
  )
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
      const summary = await getVisitSummary(
        parsed.data.startTime,
        parsed.data.endTime,
        parsed.data.scope,
      )
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
      const list = await getDayPvList(parsed.data.startTime, parsed.data.endTime, parsed.data.scope)
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
      const list = await getDayUvList(parsed.data.startTime, parsed.data.endTime, parsed.data.scope)
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
        scope: parsed.data.scope,
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
          // G-261:querystring 一律 type:'string',真实校验一律 logListQuery(Zod:page/pageSize
          // coerce+min/max/default,userId uuid)
          properties: {
            page: { type: 'string', description: '页码(整数,默认 1;服务端 Zod 校验)' },
            pageSize: {
              type: 'string',
              description: '每页条数(1-100,默认 20;服务端 Zod 校验)',
            },
            userId: { type: 'string', description: 'UUID(服务端 Zod 校验)' },
            url: { type: 'string' },
            startTime: { type: 'string', description: 'YYYY-MM-DD' },
            endTime: { type: 'string', description: 'YYYY-MM-DD' },
            scope: {
              type: 'string',
              enum: [...VISIT_SCOPE_VALUES],
              description: '访问面:all(默认)/public/admin/auth',
            },
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
      const { page, pageSize, userId, url, startTime, endTime, scope } = parsed.data
      const conds = []
      if (userId) conds.push(eq(visitLogs.userId, userId))
      if (url) conds.push(like(visitLogs.url, `%${url}%`))
      if (startTime) conds.push(gte(visitLogs.visitDate, startTime.slice(0, 10)))
      if (endTime) conds.push(lte(visitLogs.visitDate, endTime.slice(0, 10)))
      const scopeCond = visitScopeFilter(scope)
      if (scopeCond) conds.push(scopeCond)
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
            platform: {
              type: 'string',
              enum: [...VISIT_PLATFORM_VALUES],
              description: '端:all(默认)/web/rn/mp/ex',
            },
            sort: { type: 'string', enum: ['pv', 'uv'], description: '排序键(默认 pv)' },
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
      const { startTime, endTime, page, pageSize, scope, platform, sort } = parsed.data
      const result = await getPageUsageList({
        startTime,
        endTime,
        page,
        pageSize,
        scope,
        platform,
        sort,
      })
      return reply.send(success(result))
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

  // GET /traces/slow-queries - 慢查询列表（基于 pg_stat_activity 实时活跃查询）
  server.get('/traces/slow-queries', async (_request, reply) => {
    let list: Record<string, unknown>[] = []
    let note = '基于 pg_stat_activity 实时活跃查询(执行时长 > 1 秒)'
    try {
      const rows = await db.execute(
        sql`SELECT pid, usename, application_name, client_addr,
                   now() - query_start AS duration, state, query
            FROM pg_stat_activity
            WHERE state = 'active'
              AND now() - query_start > interval '1 second'
              AND query NOT ILIKE '%pg_stat_activity%'
            ORDER BY query_start ASC
            LIMIT 50`,
      )
      list = rows as Record<string, unknown>[]
    } catch {
      note = 'pg_stat_activity 不可用,需授予 pg_stat_scan_tables 权限或启用 pg_stat_statements 扩展'
    }
    return reply.send(success({ list, total: list.length, note }))
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
