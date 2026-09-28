// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { findAuditLogs, getDetailedStats, exportAuditLogs } from '../db/search-queries.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { sanitizeCsvCell } from '../utils/csv-utils.js'

const ADMIN_ROLE_ID = 1

// =============================================================================
// Zod schemas
// =============================================================================

const auditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().optional().transform(emptyToUndefined).pipe(z.uuid().optional()),
  action: z.string().optional().transform(emptyToUndefined).pipe(z.string().optional()),
  resourceType: z.string().optional().transform(emptyToUndefined).pipe(z.string().optional()),
  startDate: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
  endDate: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
})
import { buildResponseSchema } from '../utils/api-schemas.js'

const auditLogsExportQuerySchema = z.object({
  userId: z.string().optional().transform(emptyToUndefined).pipe(z.uuid().optional()),
  action: z.string().optional().transform(emptyToUndefined).pipe(z.string().optional()),
  resourceType: z.string().optional().transform(emptyToUndefined).pipe(z.string().optional()),
  startDate: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
  endDate: z.string().optional().transform(emptyToUndefined).pipe(z.string().min(1).optional()),
  format: z.enum(['csv', 'json']).optional().default('csv'),
  limit: z.coerce.number().int().min(1).max(10000).optional().default(10000),
})

// =============================================================================
// 路由
//
// 口径(G-257,与 audit-log.ts 同批收口):querystring 的 JSON Schema 只声明类型,
// 真实校验一律由上方 Zod 做。此前 `/audit-logs` 展开的 `paginationQuerySchema`
// 带着 minimum/maximum/default 校验型约束,而本路由声明的 400 响应体走
// errorResponseSchema(`code: number`)—— 非法参数被 ajv 先拒后,Fastify 默认
// 错误体的 `code` 是字符串,序列化不匹配 ⇒ 400 被掩盖成 **500**(现读复证:
// tests/admin-audit-log-validation.test.ts 修复前 `?page=0` 实得 500)。
// `errorResponseSchema` 与共享片段 `paginationQuerySchema` 本身一字未动 ——
// 放宽契约不是修法,迁校验才是。querystring 数字参数声明 `type:'string'`:
// 传输线本就是字符串,ajv 的 integer 强转同属校验行为(`page=abc` 走同一型 500)。
// =============================================================================

export const auditRoutes: FastifyPluginAsync = async (server) => {
  // 统一 admin 鉴权：authenticate + requireAdmin，一次注册应用于全部 audit 路由
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || '操作失败,请稍后重试'
      return reply.status(statusCode).send(error(statusCode, message))
    }
    const roleId = request.jwtPayload?.roleId ?? 0
    if (roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '需要管理员权限'))
    }
  })

  // GET /audit-logs - 分页查询操作日志（支持 userId/action/resourceType 筛选）
  server.get(
    '/audit-logs',
    {
      schema: {
        summary: '审计日志列表',
        tags: ['audit'],
        querystring: {
          type: 'object',
          properties: {
            // 不再展开 paginationQuerySchema(minimum/maximum/default 属校验型约束,
            // 会触发 G-257 掩盖型;数值上下界由 auditLogsQuerySchema(Zod)执行)
            page: { type: 'string', description: '页码(整数,默认 1;服务端 Zod 校验)' },
            pageSize: {
              type: 'string',
              description: '每页数量(1-100,默认 20;服务端 Zod 校验)',
            },
            userId: { type: 'string', description: '按用户 ID 筛选(可选;Zod 校验 UUID)' },
            action: { type: 'string', description: '按操作类型筛选(可选)' },
            resourceType: { type: 'string', description: '按资源类型筛选(可选)' },
            startDate: { type: 'string', description: '开始时间 YYYY-MM-DD(可选)' },
            endDate: { type: 'string', description: '结束时间 YYYY-MM-DD(可选)' },
          },
        },
        response: buildResponseSchema(400, 401, 403),
      },
    },
    async (request, reply) => {
      const parsed = auditLogsQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { page, pageSize, userId, action, resourceType, startDate, endDate } = parsed.data
      const { list, total } = await findAuditLogs(page, pageSize, {
        userId,
        action,
        resourceType,
        startDate,
        endDate,
      })
      return reply.send(success({ list, total, page, pageSize }))
    },
  )

  // GET /audit-logs/export - 导出审计日志（CSV/JSON，最多 10000 条）
  server.get(
    '/audit-logs/export',
    {
      schema: {
        summary: '导出审计日志',
        tags: ['audit'],
        querystring: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: '按用户 ID 筛选(可选)' },
            action: { type: 'string', description: '按操作类型筛选(可选)' },
            resourceType: { type: 'string', description: '按资源类型筛选(可选)' },
            startDate: { type: 'string', description: '开始时间 YYYY-MM-DD(可选)' },
            endDate: { type: 'string', description: '结束时间 YYYY-MM-DD(可选)' },
            // G-257:enum/minimum/maximum/default 一律不写在 JSON Schema 里,
            // 由 auditLogsExportQuerySchema(Zod)执行;此处只声明类型。
            format: {
              type: 'string',
              description: '导出格式:csv(默认)/ json',
            },
            limit: {
              type: 'string',
              description: '最大导出条数(1-10000,默认 10000;服务端 Zod 校验)',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = auditLogsExportQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { userId, action, resourceType, startDate, endDate, format, limit } = parsed.data
      const list = await exportAuditLogs(
        { userId, action, resourceType, startDate, endDate },
        limit,
      )

      if (format === 'json') {
        return reply
          .header('Content-Type', 'application/json; charset=utf-8')
          .header('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.json"`)
          .send(
            JSON.stringify(
              { exportedAt: new Date().toISOString(), count: list.length, items: list },
              null,
              2,
            ),
          )
      }

      // CSV
      const headers = [
        'id',
        'userId',
        'action',
        'resourceType',
        'resourceId',
        'ip',
        'userAgent',
        'createdAt',
        'details',
      ]
      // P2 修复(2026-08-06):escapeCsv 先经 sanitizeCsvCell 做公式注入防护,
      // 防止 details/userAgent 等用户可控字段以 `=`/`+`/`-`/`@` 开头被 Excel 当公式执行。
      const escapeCsv = (v: unknown): string => {
        if (v === null || v === undefined) return ''
        const s = typeof v === 'string' ? v : JSON.stringify(v)
        const safe = sanitizeCsvCell(s)
        if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`
        return safe
      }
      const rows = list.map((row) =>
        [
          row.id,
          row.userId ?? '',
          row.action,
          row.resourceType ?? '',
          row.resourceId ?? '',
          row.ip ?? '',
          row.userAgent ?? '',
          row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ''),
          row.details ? JSON.stringify(row.details) : '',
        ]
          .map(escapeCsv)
          .join(','),
      )
      const csv = [headers.join(','), ...rows].join('\r\n')
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`)
        .send('\uFEFF' + csv)
    },
  )

  // GET /stats/detailed - 详细统计（用户增长趋势/项目分布/文件类型分布/订单统计）
  server.get(
    '/stats/detailed',
    {
      schema: {
        summary: '详细统计',
        tags: ['audit'],
        response: buildResponseSchema(401, 403),
      },
    },
    async (_request, reply) => {
      const stats = await getDetailedStats()
      return reply.send(success(stats))
    },
  )
}
