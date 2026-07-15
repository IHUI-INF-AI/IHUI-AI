import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { authenticate } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { db } from '../db/index.js'
import { messageTemplates } from '@ihui/database'
import { sendPushBatch, detectPushProvider, type PushMessage } from '../services/push-provider.js'

// =============================================================================
// Zod schemas
// =============================================================================

const registerDeviceSchema = z.object({
  deviceToken: z.string().min(1).max(500),
  deviceType: z.string().max(50).optional(),
})

const sendPushBodySchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  clickUrl: z.string().url().optional(),
  data: z.record(z.unknown()).optional(),
  /** 指定设备 token 列表；若不提供则按 memberId 推送 */
  tokens: z.array(z.string().min(1).max(500)).optional(),
  /** 按 memberId 推送（需配合 admin 鉴权） */
  memberIds: z.array(z.number().int().positive()).optional(),
})

// =============================================================================
// 用户端路由（注册/注销设备 token）
// =============================================================================

export const pushRoutes: FastifyPluginAsync = async (server) => {
  // POST /push/devices/register - 用户注册设备 token
  // 当前用户系统无 memberId 映射，使用 userId 作为 memberId（兼容教育模块）
  server.post('/push/devices/register', async (request, reply) => {
    await authenticate(request)
    const parsed = registerDeviceSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const { deviceToken, deviceType } = parsed.data
    // upsert：同 token 已存在则更新 updatedAt，否则插入
    await db.execute(sql`
      INSERT INTO edu_notification_device (member_id, device_type, device_token, is_active, created_at, updated_at)
      VALUES (${userId}, ${deviceType ?? null}, ${deviceToken}, true, NOW(), NOW())
      ON CONFLICT (device_token)
      DO UPDATE SET is_active = true, updated_at = NOW()
    `)
    return reply.send(success({ registered: true }))
  })

  // POST /push/devices/unregister - 用户注销设备 token
  server.post('/push/devices/unregister', async (request, reply) => {
    await authenticate(request)
    const { deviceToken } = z
      .object({ deviceToken: z.string().min(1).max(500) })
      .parse(request.body)
    await db.execute(sql`
      UPDATE edu_notification_device
      SET is_active = false, updated_at = NOW()
      WHERE device_token = ${deviceToken}
    `)
    return reply.send(success({ unregistered: true }))
  })

  // GET /push/provider - 查询当前推送 provider
  server.get('/push/provider', async (_request, reply) => {
    return reply.send(success({ provider: detectPushProvider() }))
  })

  // GET /push/templates - 客户端可订阅的微信小程序推送模板列表
  // 微信小程序订阅消息机制: 客户端需先拿到模板 ID,再由用户主动授权订阅。
  // 这里返回 channel='push' 且 status=1 的模板精简字段。
  server.get('/push/templates', async (_request, reply) => {
    try {
      const rows = await db
        .select({
          id: messageTemplates.id,
          code: messageTemplates.code,
          title: messageTemplates.title,
          variables: messageTemplates.variables,
        })
        .from(messageTemplates)
        .where(eq(messageTemplates.channel, 'push'))
        .orderBy(messageTemplates.code)
      return reply.send(success({ list: rows, total: rows.length }))
    } catch {
      return reply.status(500).send(error(500, '查询推送模板失败'))
    }
  })
}

// =============================================================================
// 管理员路由（发送推送）
// =============================================================================

export const adminPushRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // POST /push/send - 发送推送（支持按 tokens 或 memberIds）
  server.post('/push/send', async (request, reply) => {
    const parsed = sendPushBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { title, body: msgBody, clickUrl, data, tokens, memberIds } = parsed.data

    const message: PushMessage = { title, body: msgBody, clickUrl, data }

    // 1. 优先使用显式 tokens
    if (tokens && tokens.length > 0) {
      const results = await sendPushBatch(
        tokens.map((t) => ({ token: t })),
        message,
      )
      const successCount = results.filter((r) => r.success).length
      return reply.send(
        success({
          total: results.length,
          success: successCount,
          failed: results.length - successCount,
          results,
        }),
      )
    }

    // 2. 按 memberIds 查询激活的设备 token
    if (memberIds && memberIds.length > 0) {
      const rows = await db.execute(sql`
        SELECT device_token
        FROM edu_notification_device
        WHERE member_id = ANY(${memberIds}::int[])
          AND is_active = true
      `)
      const deviceTokens = (rows as unknown as Array<{ device_token: string }>).map(
        (r) => r.device_token,
      )
      if (deviceTokens.length === 0) {
        return reply.send(
          success({ total: 0, success: 0, failed: 0, results: [], note: '指定用户无激活设备' }),
        )
      }
      const results = await sendPushBatch(
        deviceTokens.map((t) => ({ token: t })),
        message,
      )
      const successCount = results.filter((r) => r.success).length
      return reply.send(
        success({
          total: results.length,
          success: successCount,
          failed: results.length - successCount,
          results,
        }),
      )
    }

    return reply.status(400).send(error(400, '必须提供 tokens 或 memberIds'))
  })

  // GET /push/devices - 设备列表（分页 + 筛选）
  server.get('/push/devices', async (request, reply) => {
    const { page, pageSize, memberId, isActive } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        memberId: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
        isActive: z.preprocess(emptyToUndefined, z.enum(['true', 'false']).optional()),
      })
      .parse(request.query)

    const conds = []
    if (memberId !== undefined) conds.push(sql`member_id = ${memberId}`)
    if (isActive !== undefined) conds.push(sql`is_active = ${isActive === 'true'}`)
    const where =
      conds.length > 0 ? sql.join(['WHERE', sql.join(conds, sql` AND `)], sql` `) : sql``

    const offset = (page - 1) * pageSize
    const listRows = await db.execute(sql`
      SELECT id, member_id, device_type, device_token, is_active, created_at, updated_at
      FROM edu_notification_device
      ${where}
      ORDER BY updated_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `)
    const countRows = await db.execute(sql`
      SELECT count(*)::int AS count FROM edu_notification_device ${where}
    `)
    const total = (countRows as unknown as Array<{ count: number }>)[0]?.count ?? 0
    return reply.send(success({ list: listRows, total, page, pageSize }))
  })
}
