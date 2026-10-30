// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { db } from '../db/index.js'
import { deviceTokens, type Device } from '@ihui/database'
import {
  claimNextTask,
  completeTask,
  delegateTask,
  exchangePairCode,
  failTask,
  findDeviceById,
  heartbeat,
  isDeviceDelegationEnabled,
  issuePairCode,
  listDevices,
  listTasksForDevice,
  registerDevice,
  revokeDevice,
  updateTaskProgress,
  verifyDeviceToken,
  type DeviceCapabilities,
} from '../services/device-service.js'

// =============================================================================
// Zod 校验 schema
// =============================================================================

const registerDeviceTokenSchema = z.object({
  /** 推送令牌(FCM registration token / APNS device token / Web Push 订阅),原样存储 */
  token: z.string().min(1).max(2000),
  /** 平台:ios / android / web */
  platform: z.enum(['ios', 'android', 'web']),
  /** 设备型号/名称,如 "iPhone15,2" */
  deviceType: z.string().max(100).optional(),
  /** 客户端版本号 */
  appVersion: z.string().max(50).optional(),
  /** 客户端语言区域,如 "zh-CN" */
  locale: z.string().max(20).optional(),
})

export type RegisterDeviceTokenInput = z.infer<typeof registerDeviceTokenSchema>

// =============================================================================
// 设备路由
// =============================================================================

export const devicesRoutes: FastifyPluginAsync = async (server) => {
  // PUT /api/devices/token - 注册/更新当前用户的推送设备令牌
  // 同一 token 在 device_tokens 表中唯一;重复上报时 upsert 刷新元数据并置为 active。
  server.put('/devices/token', async (request, reply) => {
    await authenticate(request)
    const parsed = registerDeviceTokenSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const { token, platform, deviceType, appVersion, locale } = parsed.data

    const now = new Date()
    await db
      .insert(deviceTokens)
      .values({
        userId,
        token,
        platform,
        deviceType,
        appVersion,
        locale,
        isActive: true,
        lastUsedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: deviceTokens.token,
        set: {
          userId,
          platform,
          deviceType,
          appVersion,
          locale,
          isActive: true,
          lastUsedAt: now,
          updatedAt: now,
        },
      })

    return reply.send(success({ token, platform, registered: true }))
  })

  // DELETE /api/devices/token - 注销当前用户的某个推送设备令牌(卸载/退出登录时调用)
  // 仅将 isActive 置 false,保留记录以便审计,不物理删除。
  server.delete('/devices/token', async (request, reply) => {
    await authenticate(request)
    const { token } = z.object({ token: z.string().min(1).max(2000) }).parse(request.body)
    const userId = request.userId!
    const result = await db
      .update(deviceTokens)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(deviceTokens.token, token), eq(deviceTokens.userId, userId)))
    void result
    return reply.send(success({ token, unregistered: true }))
  })

  // ===========================================================================
  // G1 跨设备互联闭环(2026-10-30 立)
  // 用户令牌面:authenticate(人 JWT);设备令牌面:pair-exchange 签发的 HMAC bearer。
  // 逻辑全部收口 services/device-service.ts,本文件只做参数校验与状态码归位。
  // ===========================================================================

  /** 人令牌鉴权(照 chat-collab 的取令牌主体写法);失败已写响应返回 null */
  const requireUser = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<string | null> => {
    try {
      await authenticate(request)
      return request.userId!
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      reply.status(statusCode).send(error(statusCode, '操作失败,请稍后重试'))
      return null
    }
  }

  /** 设备令牌鉴权:Authorization Bearer <device_token>;失败已写响应返回 null */
  const requireDevice = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<Device | null> => {
    const header = request.headers.authorization
    const token =
      header && header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null
    if (!token) {
      reply.status(401).send(error(401, '需要设备令牌'))
      return null
    }
    const device = await verifyDeviceToken(token)
    if (!device) {
      reply.status(401).send(error(401, '设备令牌无效或已过期'))
      return null
    }
    return device
  }

  /** :id 路径参数校验(uuid);失败已写 400 响应返回 null。
   *  注意:safeParse 返回 {success,data},必须取 .data,不能直接解构字段。 */
  const requireId = (request: FastifyRequest, reply: FastifyReply): string | null => {
    const parsed = z.object({ id: z.string().uuid() }).safeParse(request.params)
    if (!parsed.success) {
      reply.status(400).send(error(400, '参数错误'))
      return null
    }
    return parsed.data.id
  }

  /** 服务层 AppError(statusCode)→ 响应归位;未知异常 → 500 */
  const replyServiceError = (reply: FastifyReply, e: unknown) => {
    const err = e as Error & { statusCode?: number; errorCode?: string }
    const statusCode = err.statusCode ?? 500
    return reply
      .status(statusCode)
      .send(error(statusCode, err.message || '操作失败,请稍后重试', err.errorCode))
  }

  const capabilitiesSchema = z.record(z.string(), z.unknown()).optional().nullable()

  // POST /api/devices - 注册设备(同 user+name 重复注册=幂等刷新 last_seen 并返回原行)
  server.post('/devices', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const parsed = z
      .object({
        name: z.string().min(1).max(255),
        os: z.string().max(128).optional().nullable(),
        capabilities: capabilitiesSchema,
      })
      .safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const device = await registerDevice({ userId, ...parsed.data })
      return reply.send(success(device))
    } catch (e) {
      return replyServiceError(reply, e)
    }
  })

  // GET /api/devices - 当前用户设备列表(附 online:last_seen_at 距今 <90s)
  server.get('/devices', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const list = await listDevices(userId)
    return reply.send(success(list))
  })

  // DELETE /api/devices/:id - 撤销设备(置 revoked_at,不物理删除)
  server.delete('/devices/:id', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const id = requireId(request, reply)
    if (!id) return
    const device = await revokeDevice(userId, id)
    if (!device) return reply.status(404).send(error(404, '设备不存在'))
    return reply.send(success({ id: device.id, revoked: true }))
  })

  // POST /api/devices/pair-code - 签发 6 位数字配对码(明文只在此响应出现一次)
  server.post('/devices/pair-code', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    try {
      const { code, expiresAt } = await issuePairCode(userId)
      return reply.send(success({ code, expires_at: expiresAt.toISOString() }))
    } catch (e) {
      return replyServiceError(reply, e)
    }
  })

  // POST /api/devices/pair-exchange - 配对码兑换设备令牌(公开端点:码即凭据)
  server.post('/devices/pair-exchange', async (request, reply) => {
    const parsed = z
      .object({
        code: z.string().regex(/^\d{6}$/, '配对码为 6 位数字'),
        name: z.string().min(1).max(255).optional(),
        os: z.string().max(128).optional().nullable(),
        capabilities: capabilitiesSchema,
      })
      .safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const { deviceToken, device } = await exchangePairCode(parsed.data)
      return reply.send(success({ device_token: deviceToken, device_id: device.id }))
    } catch (e) {
      return replyServiceError(reply, e)
    }
  })

  // POST /api/devices/heartbeat - 设备心跳(刷新 last_seen_at,回发续期令牌)
  server.post('/devices/heartbeat', async (request, reply) => {
    const device = await requireDevice(request, reply)
    if (!device) return
    try {
      const { lastSeenAt, deviceToken } = await heartbeat(device.id)
      return reply.send(
        success({ last_seen_at: lastSeenAt.toISOString(), device_token: deviceToken }),
      )
    } catch (e) {
      return replyServiceError(reply, e)
    }
  })

  // GET /api/devices/claim - 原子认领最早 queued 任务;无可认领 → 204
  server.get('/devices/claim', async (request, reply) => {
    if (!isDeviceDelegationEnabled()) {
      return reply.status(503).send(error(503, '跨设备委托未启用', 'DEVICE_DELEGATION_DISABLED'))
    }
    const device = await requireDevice(request, reply)
    if (!device) return
    const task = await claimNextTask(device.id)
    if (!task) return reply.status(204).send()
    return reply.send(success(task))
  })

  // GET /api/devices/:id/tasks - 该设备待办/历史任务(用户令牌面,归属校验)
  server.get('/devices/:id/tasks', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const id = requireId(request, reply)
    if (!id) return
    const device = await findDeviceById(id)
    // 跨用户一律 404(不泄露"存在但不可见")
    if (!device || device.userId !== userId) {
      return reply.status(404).send(error(404, '设备不存在'))
    }
    const tasks = await listTasksForDevice(device.id)
    return reply.send(success(tasks))
  })

  // POST /api/devices/tasks/:id/progress - 设备上报进度(running 态更新 result_summary)
  server.post('/devices/tasks/:id/progress', async (request, reply) => {
    const device = await requireDevice(request, reply)
    if (!device) return
    const id = requireId(request, reply)
    if (!id) return
    const parsed = z.object({ summary: z.record(z.string(), z.unknown()) }).safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const task = await updateTaskProgress(
        device.id,
        id,
        parsed.data.summary as DeviceCapabilities,
      )
      return reply.send(success(task))
    } catch (e) {
      return replyServiceError(reply, e)
    }
  })

  // POST /api/devices/tasks/:id/complete - 设备上报完成(终态)
  server.post('/devices/tasks/:id/complete', async (request, reply) => {
    const device = await requireDevice(request, reply)
    if (!device) return
    const id = requireId(request, reply)
    if (!id) return
    const parsed = z.object({ summary: capabilitiesSchema }).safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const task = await completeTask(
        device.id,
        id,
        parsed.data.summary as DeviceCapabilities | null,
      )
      return reply.send(success(task))
    } catch (e) {
      return replyServiceError(reply, e)
    }
  })

  // POST /api/devices/tasks/:id/fail - 设备上报失败(终态)
  server.post('/devices/tasks/:id/fail', async (request, reply) => {
    const device = await requireDevice(request, reply)
    if (!device) return
    const id = requireId(request, reply)
    if (!id) return
    const parsed = z
      .object({ error: z.string().max(2000).optional(), summary: capabilitiesSchema })
      .safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const task = await failTask(
        device.id,
        id,
        parsed.data.error ?? null,
        parsed.data.summary as DeviceCapabilities | null,
      )
      return reply.send(success(task))
    } catch (e) {
      return replyServiceError(reply, e)
    }
  })

  // POST /api/chat/sessions/:id/delegate - 会话委托到设备(离线允许入队,待认领)
  // 仓库会话路由既有风格是 /api/chat/conversations/:id/...,同挂一个别名(响应形状一致)。
  const delegateHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceDelegationEnabled()) {
      return reply.status(503).send(error(503, '跨设备委托未启用', 'DEVICE_DELEGATION_DISABLED'))
    }
    const userId = await requireUser(request, reply)
    if (!userId) return
    const id = requireId(request, reply)
    if (!id) return
    const parsed = z.object({ target_device_id: z.string().uuid() }).safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const task = await delegateTask({
        userId,
        sessionId: id,
        targetDeviceId: parsed.data.target_device_id,
      })
      return reply.send(success({ task_id: task.id, status: 'queued' }))
    } catch (e) {
      return replyServiceError(reply, e)
    }
  }
  server.post('/chat/sessions/:id/delegate', delegateHandler)
  server.post('/chat/conversations/:id/delegate', delegateHandler)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
