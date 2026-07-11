import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'

// =============================================================================
// Zod schemas
// =============================================================================

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const channelTypes = ['email', 'sms', 'push', 'in_app', 'webhook'] as const

const createChannelSchema = z.object({
  name: z.string().min(1, '渠道名称不能为空').max(100),
  type: z.enum(channelTypes),
  config: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
  remark: z.string().max(255).optional(),
})

const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(channelTypes).optional(),
  config: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
  remark: z.string().max(255).optional(),
})

const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  types: z
    .array(z.string())
    .optional()
    .describe('订阅通知类型列表,如 system/order/project/comment/mention'),
})

const listLogsQuery = z.object({
  ...paginationQuery,
  type: z.preprocess(emptyToUndefined, z.string().max(32).optional()),
  channel: z.preprocess(emptyToUndefined, z.string().max(32).optional()),
  status: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
  startDate: z.preprocess(emptyToUndefined, z.string().optional()),
  endDate: z.preprocess(emptyToUndefined, z.string().optional()),
})

function parsePaging(q: { page?: string; pageSize?: string }): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(Number(q.page) || 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
  return { page, pageSize }
}

// =============================================================================
// 路由
// =============================================================================

export const notificationExtendedRoutes: FastifyPluginAsync = async (server) => {
  // -------------------------------------------------------------------------
  // GET /notifications/channels - 通知渠道列表
  // -------------------------------------------------------------------------
  server.get('/notifications/channels', async (request, reply) => {
    await authenticate(request)
    const q = request.query as {
      page?: string
      pageSize?: string
      type?: string
      isActive?: string
    }
    const { page, pageSize } = parsePaging(q)
    const offset = (page - 1) * pageSize
    const conds: SQL[] = []
    if (q.type) conds.push(sql`"type" = ${q.type}`)
    if (q.isActive !== undefined) {
      conds.push(sql`"is_active" = ${q.isActive === 'true'}`)
    }
    const where = conds.length > 0 ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``
    try {
      const rows = await db.execute(
        sql`SELECT id, name, type, config, is_active, remark, created_at, updated_at
            FROM notification_channels
            ${where}
            ORDER BY created_at DESC
            LIMIT ${pageSize} OFFSET ${offset}`,
      )
      const countRows = await db.execute(
        sql`SELECT count(*)::int AS count FROM notification_channels ${where}`,
      )
      const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
      return reply.send(
        success({
          list: rows as Record<string, unknown>[],
          total,
          page,
          pageSize,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询通知渠道列表失败'))
    }
  })

  // -------------------------------------------------------------------------
  // POST /notifications/channels - 新增渠道
  // -------------------------------------------------------------------------
  server.post('/notifications/channels', async (request, reply) => {
    await authenticate(request)
    const parsed = createChannelSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { name, type, config, isActive, remark } = parsed.data
    try {
      const rows = await db.execute(
        sql`INSERT INTO notification_channels (name, type, config, is_active, remark, created_at, updated_at)
            VALUES (${name}, ${type}, ${config ? JSON.stringify(config) : null}, ${isActive ?? true},
                    ${remark ?? null}, NOW(), NOW())
            RETURNING id, name, type, config, is_active, remark, created_at, updated_at`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建通知渠道失败'))
    }
  })

  // -------------------------------------------------------------------------
  // PUT /notifications/channels/:id - 修改渠道
  // -------------------------------------------------------------------------
  server.put('/notifications/channels/:id', async (request, reply) => {
    await authenticate(request)
    const paramParsed = idParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const parsed = updateChannelSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { id } = paramParsed.data
    const body = parsed.data
    const sets: SQL[] = []
    if (body.name !== undefined) sets.push(sql`"name" = ${body.name}`)
    if (body.type !== undefined) sets.push(sql`"type" = ${body.type}`)
    if (body.config !== undefined) sets.push(sql`"config" = ${JSON.stringify(body.config)}`)
    if (body.isActive !== undefined) sets.push(sql`"is_active" = ${body.isActive}`)
    if (body.remark !== undefined) sets.push(sql`"remark" = ${body.remark}`)
    if (sets.length === 0) {
      return reply.status(400).send(error(400, '无更新字段'))
    }
    sets.push(sql`"updated_at" = NOW()`)
    try {
      const rows = await db.execute(
        sql`UPDATE notification_channels
            SET ${sql.join(sets, sql`, `)}
            WHERE id = ${id}
            RETURNING id, name, type, config, is_active, remark, created_at, updated_at`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      if (!row) return reply.status(404).send(error(404, '通知渠道不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新通知渠道失败'))
    }
  })

  // -------------------------------------------------------------------------
  // DELETE /notifications/channels/:id - 删除渠道
  // -------------------------------------------------------------------------
  server.delete('/notifications/channels/:id', async (request, reply) => {
    await authenticate(request)
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const { id } = parsed.data
    try {
      const rows = await db.execute(
        sql`DELETE FROM notification_channels WHERE id = ${id} RETURNING id`,
      )
      if ((rows as Record<string, unknown>[]).length === 0) {
        return reply.status(404).send(error(404, '通知渠道不存在'))
      }
      return reply.send(success({ id, deleted: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除通知渠道失败'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /notifications/preferences - 用户通知偏好
  // -------------------------------------------------------------------------
  server.get('/notifications/preferences', async (request, reply) => {
    await authenticate(request)
    const userId = request.userId!
    try {
      const rows = await db.execute(
        sql`SELECT id, user_id, email_enabled, sms_enabled, push_enabled, in_app_enabled, types, created_at, updated_at
            FROM notification_preferences
            WHERE user_id = ${userId}
            LIMIT 1`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      if (!row) {
        // 返回默认偏好
        return reply.send(
          success({
            userId,
            emailEnabled: true,
            smsEnabled: false,
            pushEnabled: true,
            inAppEnabled: true,
            types: ['system', 'order', 'project', 'comment', 'mention'],
          }),
        )
      }
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '获取通知偏好失败'))
    }
  })

  // -------------------------------------------------------------------------
  // PUT /notifications/preferences - 更新通知偏好
  // -------------------------------------------------------------------------
  server.put('/notifications/preferences', async (request, reply) => {
    await authenticate(request)
    const parsed = updatePreferencesSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const { emailEnabled, smsEnabled, pushEnabled, inAppEnabled, types } = parsed.data
    const sets: SQL[] = []
    if (emailEnabled !== undefined) sets.push(sql`"email_enabled" = ${emailEnabled}`)
    if (smsEnabled !== undefined) sets.push(sql`"sms_enabled" = ${smsEnabled}`)
    if (pushEnabled !== undefined) sets.push(sql`"push_enabled" = ${pushEnabled}`)
    if (inAppEnabled !== undefined) sets.push(sql`"in_app_enabled" = ${inAppEnabled}`)
    if (types !== undefined) sets.push(sql`"types" = ${JSON.stringify(types)}`)
    sets.push(sql`"updated_at" = NOW()`)
    try {
      const rows = await db.execute(
        sql`INSERT INTO notification_preferences (user_id, email_enabled, sms_enabled, push_enabled, in_app_enabled, types, created_at, updated_at)
            VALUES (${userId},
                    ${emailEnabled ?? true},
                    ${smsEnabled ?? false},
                    ${pushEnabled ?? true},
                    ${inAppEnabled ?? true},
                    ${JSON.stringify(types ?? ['system', 'order', 'project', 'comment', 'mention'])},
                    NOW(), NOW())
            ON CONFLICT (user_id) DO UPDATE
            SET ${sql.join(sets, sql`, `)}
            RETURNING id, user_id, email_enabled, sms_enabled, push_enabled, in_app_enabled, types, created_at, updated_at`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新通知偏好失败'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /notifications/logs - 通知发送日志（分页）
  // -------------------------------------------------------------------------
  server.get('/notifications/logs', async (request, reply) => {
    await authenticate(request)
    const parsed = listLogsQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, type, channel, status, startDate, endDate } = parsed.data
    const offset = (page - 1) * pageSize
    const conds: SQL[] = []
    // 仅查询当前用户的通知日志
    conds.push(sql`"user_id" = ${request.userId!}`)
    if (type) conds.push(sql`"type" = ${type}`)
    if (channel) conds.push(sql`"channel" = ${channel}`)
    if (status) conds.push(sql`"status" = ${status}`)
    if (startDate) conds.push(sql`"created_at" >= ${startDate}::timestamp`)
    if (endDate) conds.push(sql`"created_at" <= ${`${endDate} 23:59:59`}::timestamp`)
    const where = sql`WHERE ${sql.join(conds, sql` AND `)}`
    try {
      const rows = await db.execute(
        sql`SELECT id, user_id, type, title, content, channel, status, error_message, created_at
            FROM notification_logs
            ${where}
            ORDER BY created_at DESC
            LIMIT ${pageSize} OFFSET ${offset}`,
      )
      const countRows = await db.execute(
        sql`SELECT count(*)::int AS count FROM notification_logs ${where}`,
      )
      const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
      return reply.send(
        success({
          list: rows as Record<string, unknown>[],
          total,
          page,
          pageSize,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询通知日志失败'))
    }
  })
}
