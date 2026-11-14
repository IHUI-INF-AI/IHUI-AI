// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { env } from 'node:process'
import { sql, and, eq, inArray } from 'drizzle-orm'
import { authenticate } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { db } from '../db/index.js'
import { deviceTokens } from '@ihui/database'
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
  clickUrl: z.url().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  /** 指定设备 token 列表；若不提供则按 memberId 推送 */
  tokens: z.array(z.string().min(1).max(500)).max(100).optional(),
  /** 按 memberId 推送（需配合 admin 鉴权） */
  memberIds: z.array(z.uuid()).max(100).optional(),
})

/** device_tokens 的 platform 列必填且长度 20:从 deviceType 归一,认不出时落 web。 */
function resolveDevicePlatform(deviceType: string | undefined): 'ios' | 'android' | 'web' {
  const value = deviceType?.toLowerCase()
  if (value === 'ios' || value === 'android' || value === 'web') return value
  return 'web'
}

// =============================================================================
// 用户端路由（注册/注销设备 token）
// =============================================================================

export const pushRoutes: FastifyPluginAsync = async (server) => {
  // POST /push/devices/register - 用户注册设备 token
  // 2026-11-08 修 F-680:改用 device_tokens(user_id uuid + token 唯一索引)。
  // 旧实现把 users.id(UUID)写进教育域通知设备表的 member_id(integer) ⇒ 100% 22P02,
  // 且 ON CONFLICT (device_token) 无唯一索引可匹配。
  server.post('/push/devices/register', async (request, reply) => {
    await authenticate(request)
    const parsed = registerDeviceSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const { deviceToken, deviceType } = parsed.data
    const now = new Date()
    const platform = resolveDevicePlatform(deviceType)
    // upsert：同 token 已存在（device_tokens.token 唯一索引）则刷新归属与状态
    await db
      .insert(deviceTokens)
      .values({
        userId,
        token: deviceToken,
        platform,
        deviceType: deviceType ?? null,
        isActive: true,
        lastUsedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: deviceTokens.token,
        set: {
          userId,
          platform,
          deviceType: deviceType ?? null,
          isActive: true,
          lastUsedAt: now,
          updatedAt: now,
        },
      })
    return reply.send(success({ registered: true }))
  })

  // POST /push/devices/unregister - 用户注销设备 token
  server.post('/push/devices/unregister', async (request, reply) => {
    await authenticate(request)
    const { deviceToken } = z
      .object({ deviceToken: z.string().min(1).max(500) })
      .parse(request.body)
    // 归属校验:WHERE 必须同时带 token 与 user_id,否则知道他人 device token 即可静默停掉对方推送
    const [current] = await db
      .select({ id: deviceTokens.id, isActive: deviceTokens.isActive })
      .from(deviceTokens)
      .where(and(eq(deviceTokens.token, deviceToken), eq(deviceTokens.userId, request.userId!)))
      .limit(1)
    if (!current) {
      return reply.status(404).send(error(404, '设备不存在或不属于当前用户'))
    }
    // G-998153 出口形态:先取现值、按键比较,只有真变化才写 —— 已停用设备的重复注销
    // 不再空转 UPDATE 推进 updatedAt(增量读消费源),应答契约不变(仍 unregistered:true, removed:1)。
    const changed: { isActive?: boolean } = {}
    if (current.isActive) changed.isActive = false
    if (Object.keys(changed).length > 0) {
      await db
        .update(deviceTokens)
        .set({ ...changed, updatedAt: new Date() })
        .where(and(eq(deviceTokens.token, deviceToken), eq(deviceTokens.userId, request.userId!)))
    }
    return reply.send(success({ unregistered: true, removed: 1 }))
  })

  // GET /push/provider - 查询当前推送 provider
  server.get('/push/provider', async (_request, reply) => {
    return reply.send(success({ provider: detectPushProvider() }))
  })

  // GET /push/templates - 客户端可订阅的微信小程序订阅消息模板列表
  // 返回真实微信模板 ID(环境变量配置,如 WX_MINI_REMIND_TMPL_ID),
  // 客户端直接把 id 传给 requestSubscribeMessage(tmplIds);未配置任何模板时返回空列表。
  server.get('/push/templates', async (_request, reply) => {
    const list: Array<{ id: string; code: string; title: string; variables: null }> = []
    if (env.WX_MINI_REMIND_TMPL_ID) {
      list.push({
        id: env.WX_MINI_REMIND_TMPL_ID,
        code: 'edu_fee_reminder',
        title: '待付款提醒',
        variables: null,
      })
    }
    return reply.send(success({ list, total: list.length }))
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
    // SDB-47:未配置通道时每条结果都是 success:false(failed=total),但管理端仅看 failed
    // 无法区分「全部投递失败」与「根本没配通道」,故在响应顶层带出 provider(=stub 即桩)。
    const provider = detectPushProvider()

    // 1. 优先使用显式 tokens
    if (tokens && tokens.length > 0) {
      const results = await sendPushBatch(
        tokens.map((t) => ({ token: t })),
        message,
      )
      const successCount = results.filter((r) => r.success).length
      return reply.send(
        success({
          provider,
          total: results.length,
          success: successCount,
          failed: results.length - successCount,
          results,
        }),
      )
    }

    // 2. 按 memberIds(user uuid)查询激活的设备 token
    if (memberIds && memberIds.length > 0) {
      const rows = await db
        .select({ token: deviceTokens.token })
        .from(deviceTokens)
        .where(and(inArray(deviceTokens.userId, memberIds), eq(deviceTokens.isActive, true)))
      const activeTokens = rows.map((r) => r.token)
      if (activeTokens.length === 0) {
        return reply.send(
          success({
            provider,
            total: 0,
            success: 0,
            failed: 0,
            results: [],
            note: '指定用户无激活设备',
          }),
        )
      }
      const results = await sendPushBatch(
        activeTokens.map((t) => ({ token: t })),
        message,
      )
      const successCount = results.filter((r) => r.success).length
      return reply.send(
        success({
          provider,
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
  // 2026-11-08 修 F-680:读取路径同样接到 device_tokens;member_id 作为兼容别名保留,
  // 实际过滤列为 user_id(uuid)。
  server.get('/push/devices', async (request, reply) => {
    const { page, pageSize, memberId, isActive } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        memberId: z.transform(emptyToUndefined).pipe(z.uuid().optional()),
        isActive: z.transform(emptyToUndefined).pipe(z.enum(['true', 'false']).optional()),
      })
      .parse(request.query)

    const conds = []
    if (memberId !== undefined) conds.push(sql`user_id = ${memberId}::uuid`)
    if (isActive !== undefined) conds.push(sql`is_active = ${isActive === 'true'}`)
    const where =
      conds.length > 0 ? sql.join(['WHERE', sql.join(conds, sql` AND `)], sql` `) : sql``

    const offset = (page - 1) * pageSize
    const listRows = await db.execute(sql`
      SELECT id, user_id AS member_id, device_type, token AS device_token,
             is_active, created_at, updated_at
      FROM device_tokens
      ${where}
      ORDER BY updated_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `)
    const countRows = await db.execute(sql`
      SELECT count(*)::int AS count FROM device_tokens ${where}
    `)
    const total = (countRows as unknown as Array<{ count: number }>)[0]?.count ?? 0
    return reply.send(success({ list: listRows, total, page, pageSize }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
