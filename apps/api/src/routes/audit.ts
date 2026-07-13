import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { findAuditLogs, getDetailedStats, exportAuditLogs } from '../db/search-queries.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

const ADMIN_ROLE_ID = 1

// =============================================================================
// Zod schemas
// =============================================================================

const auditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  action: z.preprocess(emptyToUndefined, z.string().optional()),
  resourceType: z.preprocess(emptyToUndefined, z.string().optional()),
  startDate: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  endDate: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
})

const auditLogsExportQuerySchema = z.object({
  userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  action: z.preprocess(emptyToUndefined, z.string().optional()),
  resourceType: z.preprocess(emptyToUndefined, z.string().optional()),
  startDate: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  endDate: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  format: z.enum(['csv', 'json']).optional().default('csv'),
  limit: z.coerce.number().int().min(1).max(10000).optional().default(10000),
})

// =============================================================================
// 路由
// =============================================================================

export const auditRoutes: FastifyPluginAsync = async (server) => {
  // 统一 admin 鉴权：authenticate + requireAdmin，一次注册应用于全部 audit 路由
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
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
            page: { type: 'integer', minimum: 1, default: 1, description: '页码(默认 1)' },
            pageSize: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: '每页数量(1-100,默认 20)',
            },
            userId: { type: 'string', description: '按用户 ID 筛选(可选)' },
            action: { type: 'string', description: '按操作类型筛选(可选)' },
            resourceType: { type: 'string', description: '按资源类型筛选(可选)' },
            startDate: { type: 'string', description: '开始时间 YYYY-MM-DD(可选)' },
            endDate: { type: 'string', description: '结束时间 YYYY-MM-DD(可选)' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          403: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
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
            format: {
              type: 'string',
              enum: ['csv', 'json'],
              default: 'csv',
              description: '导出格式',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 10000,
              default: 10000,
              description: '最大导出条数',
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
      const escapeCsv = (v: unknown): string => {
        if (v === null || v === undefined) return ''
        const s = typeof v === 'string' ? v : JSON.stringify(v)
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
        return s
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
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          403: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (_request, reply) => {
      const stats = await getDetailedStats()
      return reply.send(success(stats))
    },
  )
}
