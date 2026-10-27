// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { createHmac } from 'node:crypto'
import { secretsEqual } from '../plugins/internal-service-token.js'
import { eq, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tboxDevice, tboxCommand, tboxAgentChannel, tboxBean } from '@ihui/database'
import { success, error, parseOrThrow } from '../utils/response.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { config as env } from '../config/index.js'
import { isUuidString } from '../utils/uuid.js'

const registerSchema = z.object({
  deviceNo: z.string().min(1).max(100),
  deviceName: z.string().max(200).optional(),
  deviceType: z.string().max(50).optional(),
  userId: z.uuid().optional(),
})

const commandSchema = z.object({
  command: z.enum(['reboot', 'lock', 'unlock', 'upgrade']),
  payload: z.record(z.string(), z.unknown()).optional(),
})

// 设备信息更新(前端 POST /api/tbox/devices/:id)
const updateDeviceSchema = z.object({
  deviceName: z.string().max(200).optional(),
  deviceType: z.string().max(50).optional(),
  status: z.enum(['online', 'offline', 'sleep']).optional(),
})

const eventSchema = z.object({
  deviceNo: z.string(),
  eventType: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().optional(),
})

const deploySchema = z.object({
  deviceId: z.string().min(1),
  agentId: z.string().min(1),
  action: z.enum(['deploy', 'undeploy']),
  payload: z.unknown().optional(),
})

const tboxRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 2026-08-30 安全加固:设备管理 CRUD 端点(前端 /edu-ai/tbox 为 admin 权限页面)统一补充
  // requireAdmin 鉴权;POST /events 与 /agent/channel/deploy 为设备侧回调,
  // 保留原有 X-Signature HMAC-SHA256 签名验证作为鉴权,不加 requireAdmin。

  // 捕获原始请求体用于 webhook 签名验证
  server.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    try {
      const raw = body.toString()
      ;(req as FastifyRequest & { rawBody?: string }).rawBody = raw
      done(null, JSON.parse(raw))
    } catch (err) {
      done(err as Error, undefined)
    }
  })

  // 设备列表
  server.get('/devices', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return
    const list = await db
      .select()
      .from(tboxDevice)
      .orderBy(desc(tboxDevice.registeredAt))
      .limit(100)
    return reply.send(success(list))
  })

  // 设备详情
  server.get('/devices/:id', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return
    const { id } = req.params as { id: string }
    if (!isUuidString(id)) return reply.status(404).send(error(404, '设备不存在'))
    const device = await db.select().from(tboxDevice).where(eq(tboxDevice.id, id)).limit(1)
    if (!device[0]) return reply.status(404).send(error(404, '设备不存在'))
    return reply.send(success(device[0]))
  })

  // 设备注册
  server.post('/devices', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return
    const body = registerSchema.parse(req.body)
    const [device] = await db.insert(tboxDevice).values(body).returning()
    return reply.status(201).send(success(device))
  })

  // 指令下发
  server.post('/devices/:id/command', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return
    const { id } = req.params as { id: string }
    // 形状闸：与本文件 GET /devices/:id、GET /devices/:id/commands 同款(判据只有一份 utils/uuid.ts)。
    // tbox_device.id 是 uuid 列，畸形段会让 Postgres 抛 22P02 ⇒ 500，与"设备不存在"的 404 同形。
    if (!isUuidString(id)) return reply.status(404).send(error(404, '设备不存在'))
    const body = commandSchema.parse(req.body)
    const device = await db.select().from(tboxDevice).where(eq(tboxDevice.id, id)).limit(1)
    if (!device[0]) return reply.status(404).send(error(404, '设备不存在'))
    const [cmd] = await db
      .insert(tboxCommand)
      .values({
        deviceId: id,
        command: body.command,
        payload: body.payload,
        status: 'sent',
        sentAt: new Date(),
      })
      .returning()
    return reply.status(201).send(success(cmd))
  })

  // 指令历史
  server.get('/devices/:id/commands', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return
    const { id } = req.params as { id: string }
    // 形状闸(2026-09-28 普查收口):下面这些 :id 最终会被喂进 uuid 列,非 uuid 字面量让 Postgres
    // 抛 22P02 invalid input syntax for type uuid,而未被兜住就是 500 —— 于是"这条不存在"与
    // "服务坏了"在响应上完全同形。判据只有一份(utils/uuid.ts 的 isUuidString),闸必须在进 SQL 之前。
    if (!isUuidString(id)) return reply.status(404).send(error(404, '设备不存在'))
    const list = await db
      .select()
      .from(tboxCommand)
      .where(eq(tboxCommand.deviceId, id))
      .orderBy(desc(tboxCommand.createdAt))
      .limit(50)
    return reply.send(success(list))
  })

  // 设备信息更新(前端 POST /api/tbox/devices/:id)
  server.post('/devices/:id', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return
    const { id } = req.params as { id: string }
    // 形状闸：同本文件 GET /devices/:id。tbox_device.id 是 uuid 列，畸形段 ⇒ 22P02 ⇒ 500。
    if (!isUuidString(id)) return reply.status(404).send(error(404, '设备不存在'))
    const device = await db.select().from(tboxDevice).where(eq(tboxDevice.id, id)).limit(1)
    if (!device[0]) return reply.status(404).send(error(404, '设备不存在'))
    const body = parseOrThrow(updateDeviceSchema, req.body)
    const [updated] = await db
      .update(tboxDevice)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(tboxDevice.id, id))
      .returning()
    return reply.send(success(updated))
  })

  // 指令下发(复数路径,前端 POST /api/tbox/devices/:id/commands,与 /command 等价)
  server.post('/devices/:id/commands', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return
    const { id } = req.params as { id: string }
    // 形状闸：与上面 /command 等价路径同款，避免同型漏站。
    if (!isUuidString(id)) return reply.status(404).send(error(404, '设备不存在'))
    const body = commandSchema.parse(req.body)
    const device = await db.select().from(tboxDevice).where(eq(tboxDevice.id, id)).limit(1)
    if (!device[0]) return reply.status(404).send(error(404, '设备不存在'))
    const [cmd] = await db
      .insert(tboxCommand)
      .values({
        deviceId: id,
        command: body.command,
        payload: body.payload,
        status: 'sent',
        sentAt: new Date(),
      })
      .returning()
    return reply.status(201).send(success(cmd))
  })

  // 事件通知接收（X-Signature HMAC-SHA256 签名验证）
  server.post('/events', async (req, reply) => {
    const secret = env.TBOX_WEBHOOK_SECRET
    // 2026-10-27 安全加固:原写法 `if (secret) {...}` 是**fail-open** —— 密钥没配就整段
    // 跳过签名校验,端点对全网敞开(可任意翻转设备在线状态 / 插入上下架指令行)。
    // 生产 .env 至今未配 TBOX_WEBHOOK_SECRET,而近 30 天 /api/tbox 调用量为 0
    // ⇒ 无在跑的集成会被这条 fail-closed 打断。与 rewarded-video-ad /notify 同一口径。
    if (!secret) {
      return reply.status(503).send(error(503, '服务端未配置 TBOX_WEBHOOK_SECRET,拒绝处理设备回调'))
    }
    const signature = req.headers['x-signature'] as string | undefined
    if (!signature) return reply.status(401).send(error(401, '缺少签名'))

    const rawBody = (req as FastifyRequest & { rawBody?: string }).rawBody
    if (!rawBody) return reply.status(401).send(error(401, '无法读取请求体'))

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
    if (!secretsEqual(signature, expected)) {
      return reply.status(401).send(error(401, '签名验证失败'))
    }

    const body = eventSchema.parse(req.body)
    const device = await db
      .select()
      .from(tboxDevice)
      .where(eq(tboxDevice.deviceNo, body.deviceNo))
      .limit(1)
    if (!device[0]) return reply.status(404).send(error(404, '设备未注册'))
    await db
      .update(tboxDevice)
      .set({
        status: body.eventType === 'online' ? 'online' : 'offline',
        lastOnlineAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tboxDevice.id, device[0].id))
    return reply.send(success({ received: true }))
  })

  // 智能体上下架回调（X-Signature HMAC-SHA256 签名验证，与 /events 一致）
  server.post('/agent/channel/deploy', async (req, reply) => {
    const secret = env.TBOX_WEBHOOK_SECRET
    // 2026-10-27 安全加固:原写法 `if (secret) {...}` 是**fail-open** —— 密钥没配就整段
    // 跳过签名校验,端点对全网敞开(可任意翻转设备在线状态 / 插入上下架指令行)。
    // 生产 .env 至今未配 TBOX_WEBHOOK_SECRET,而近 30 天 /api/tbox 调用量为 0
    // ⇒ 无在跑的集成会被这条 fail-closed 打断。与 rewarded-video-ad /notify 同一口径。
    if (!secret) {
      return reply.status(503).send(error(503, '服务端未配置 TBOX_WEBHOOK_SECRET,拒绝处理设备回调'))
    }
    const signature = req.headers['x-signature'] as string | undefined
    if (!signature) return reply.status(401).send(error(401, '缺少签名'))

    const rawBody = (req as FastifyRequest & { rawBody?: string }).rawBody
    if (!rawBody) return reply.status(401).send(error(401, '无法读取请求体'))

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
    if (!secretsEqual(signature, expected)) {
      return reply.status(401).send(error(401, '签名验证失败'))
    }

    const body = parseOrThrow(deploySchema, req.body)
    const [row] = await db
      .insert(tboxAgentChannel)
      .values({
        deviceId: body.deviceId,
        agentId: body.agentId,
        action: body.action,
        payload: body.payload,
        status: 'pending',
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '回调记录写入失败'))
    return reply.send(success({ id: row.id, status: row.status }))
  })

  // ===== Tbox 工具根 CRUD(G-962 #91/#92/#93: 消费方 misc.ts:262/273/281) =====
  // 存储复用 tbox_bean(beanType='tool',beanData=工具 JSON,同 tbox-points.ts 的 Bean 存储先例)。
  const TOOL_BEAN_TYPE = 'tool'
  const createToolSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    icon: z.string().max(500).optional(),
    category: z.string().max(100).optional(),
    url: z.string().max(500).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    status: z.number().int().min(0).max(1).optional(),
  })
  const updateToolSchema = createToolSchema.partial()
  const toolIdSchema = z.object({ id: z.coerce.number().int().positive({ message: '无效的 ID' }) })

  function beanToTool(row: typeof tboxBean.$inferSelect): Record<string, unknown> {
    let payload: Record<string, unknown> = {}
    try {
      payload = row.beanData ? (JSON.parse(row.beanData) as Record<string, unknown>) : {}
    } catch {
      payload = {}
    }
    return { id: String(row.id), ...payload, status: row.status }
  }

  // POST / — 创建工具
  server.post('/', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return
    const parsed = createToolSchema.safeParse(req.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { status, ...payload } = parsed.data
    const [row] = await db
      .insert(tboxBean)
      .values({
        beanType: TOOL_BEAN_TYPE,
        beanData: JSON.stringify(payload),
        status: status ?? 1,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建工具失败'))
    return reply.status(201).send(success(beanToTool(row)))
  })

  // PUT /:id — 更新工具
  server.put('/:id', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return
    const idParsed = toolIdSchema.safeParse(req.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateToolSchema.safeParse(req.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(tboxBean)
      .where(eq(tboxBean.id, idParsed.data.id))
      .limit(1)
    if (!existing || existing.beanType !== TOOL_BEAN_TYPE)
      return reply.status(404).send(error(404, '工具不存在'))
    let payload: Record<string, unknown> = {}
    try {
      payload = existing.beanData ? (JSON.parse(existing.beanData) as Record<string, unknown>) : {}
    } catch {
      payload = {}
    }
    const { status, ...rest } = parsed.data
    const [updated] = await db
      .update(tboxBean)
      .set({
        beanData: JSON.stringify({ ...payload, ...rest }),
        ...(status !== undefined ? { status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(tboxBean.id, idParsed.data.id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '工具不存在'))
    return reply.send(success(beanToTool(updated)))
  })

  // DELETE /:id — 删除工具
  server.delete('/:id', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return
    const idParsed = toolIdSchema.safeParse(req.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const removed = await db
      .delete(tboxBean)
      .where(eq(tboxBean.id, idParsed.data.id))
      .returning({ id: tboxBean.id, beanType: tboxBean.beanType })
    if (removed.length === 0 || removed[0]?.beanType !== TOOL_BEAN_TYPE)
      return reply.status(404).send(error(404, '工具不存在'))
    return reply.send(success({ success: true }))
  })
}

export default tboxRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
