/**
 * 国安级审计日志路由(admin only)。
 *
 * 端点(均要求 roleId >= 1):
 * - GET    /audit-logs          分页查询(filters + pagination)
 * - GET    /audit-logs/export   流式导出(format=json/cef/leef)
 * - POST   /audit-logs/verify   验证指定范围日志链完整性
 * - GET    /audit-logs/stats    统计(总数 / 按动作 / 按用户)
 *
 * 路由注册时不带 /api 前缀,由主 agent 在 index.ts 以 prefix '/api' 挂载。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import {
  queryAuditLogs,
  exportAuditLogs,
  verifyUserChain,
  verifyRangeChain,
  getAuditLogStats,
} from '../services/audit-log-service.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { logger } from '../utils/logger.js'

const ADMIN_ROLE_ID = 1

// =============================================================================
// Zod schemas
// =============================================================================

const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  action: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
  resourceType: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
  startDate: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  endDate: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
})

const auditLogExportSchema = z.object({
  userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  action: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
  resourceType: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
  startDate: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  endDate: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  format: z.enum(['json', 'cef', 'leef']).optional().default('json'),
  limit: z.coerce.number().int().min(1).max(50000).optional().default(10000),
})

const auditLogVerifySchema = z.object({
  userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  startDate: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  endDate: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  limit: z.coerce.number().int().min(1).max(50000).optional().default(10000),
})

const auditLogStatsSchema = z.object({
  userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  action: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
  resourceType: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
  startDate: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  endDate: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
})

// =============================================================================
// 路由
// =============================================================================

export const auditLogRoutes: FastifyPluginAsync = async (server) => {
  // 统一 admin 鉴权:authenticate + roleId 检查,一次注册应用于全部 audit-log 路由
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

  // GET /audit-logs - 分页查询审计日志链
  server.get(
    '/audit-logs',
    {
      schema: {
        summary: '审计日志链分页查询',
        tags: ['audit-log'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            userId: { type: 'string', format: 'uuid', description: '按用户 ID 筛选' },
            action: { type: 'string', description: '按动作筛选(auth.login/data.read 等)' },
            resourceType: { type: 'string', description: '按资源类型筛选' },
            startDate: { type: 'string', description: '开始时间(ISO)' },
            endDate: { type: 'string', description: '结束时间(ISO)' },
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
          400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
          401: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
          403: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsed = auditLogQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { page, pageSize, userId, action, resourceType, startDate, endDate } = parsed.data
      const { list, total } = await queryAuditLogs(
        { userId, action, resourceType, startDate, endDate },
        page,
        pageSize,
      )
      return reply.send(success({ list, total, page, pageSize }))
    },
  )

  // GET /audit-logs/export - 流式导出(json/cef/leef)
  server.get(
    '/audit-logs/export',
    {
      schema: {
        summary: '流式导出审计日志(SIEM 兼容:JSON/CEF/LEEF)',
        tags: ['audit-log'],
        querystring: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
            action: { type: 'string' },
            resourceType: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            format: { type: 'string', enum: ['json', 'cef', 'leef'], default: 'json' },
            limit: { type: 'integer', minimum: 1, maximum: 50000, default: 10000 },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = auditLogExportSchema.safeParse(request.query)
      if (!parsed.success) {
        return reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { userId, action, resourceType, startDate, endDate, format, limit } = parsed.data

      const mimeTypes: Record<string, string> = {
        json: 'application/x-ndjson; charset=utf-8',
        cef: 'text/plain; charset=utf-8',
        leef: 'text/plain; charset=utf-8',
      }
      const ext = format === 'json' ? 'ndjson' : format
      const filename = `audit-logs-${format}-${Date.now()}.${ext}`

      reply.header('Content-Type', mimeTypes[format] ?? 'text/plain; charset=utf-8')
      reply.header('Content-Disposition', `attachment; filename="${filename}"`)
      // 关闭压缩(流式响应不应被框架再次压缩,避免缓冲)
      reply.header('X-Accel-Buffering', 'no')

      try {
        const stream = exportAuditLogs(
          { userId, action, resourceType, startDate, endDate },
          format,
          limit,
        )
        for await (const line of stream) {
          if (!reply.raw.writableEnded) {
            reply.raw.write(line + '\n')
          }
        }
      } catch (e) {
        logger.error('[audit-log route] export stream failed', {
          error: (e as Error).message,
        })
        if (!reply.raw.writableEnded) {
          reply.raw.write(
            JSON.stringify({ error: 'export failed', message: (e as Error).message }) + '\n',
          )
        }
      } finally {
        if (!reply.raw.writableEnded) {
          reply.raw.end()
        }
      }
    },
  )

  // POST /audit-logs/verify - 验证日志链完整性(仅 admin)
  server.post(
    '/audit-logs/verify',
    {
      schema: {
        summary: '验证审计日志链 HMAC 完整性(检测篡改)',
        tags: ['audit-log'],
        body: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid', description: '验证指定用户的链(可选)' },
            startDate: { type: 'string', description: '验证时间范围起始(可选)' },
            endDate: { type: 'string', description: '验证时间范围结束(可选)' },
            limit: { type: 'integer', minimum: 1, maximum: 50000, default: 10000 },
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
          400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
          401: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
          403: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsed = auditLogVerifySchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        return reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { userId, startDate, endDate, limit } = parsed.data

      // userId 优先:验证单用户链;否则验证时间范围链
      const result = userId
        ? await verifyUserChain(userId, limit)
        : await verifyRangeChain(startDate, endDate, limit)

      return reply.send(success(result))
    },
  )

  // GET /audit-logs/stats - 统计(总数 / 按动作 / 按用户)
  server.get(
    '/audit-logs/stats',
    {
      schema: {
        summary: '审计日志统计(总数 / 按动作分组 / 按用户分组)',
        tags: ['audit-log'],
        querystring: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
            action: { type: 'string' },
            resourceType: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
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
          400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
          401: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
          403: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsed = auditLogStatsSchema.safeParse(request.query)
      if (!parsed.success) {
        return reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { userId, action, resourceType, startDate, endDate } = parsed.data
      const stats = await getAuditLogStats({
        userId,
        action,
        resourceType,
        startDate,
        endDate,
      })
      return reply.send(success(stats))
    },
  )
}
