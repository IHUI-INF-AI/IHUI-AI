// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { db } from '../db/index.js'
import { deviceTokens, type Device, type DeviceTask } from '@ihui/database'
import { deviceTaskEvent, isDeviceTaskStage, isDeviceTaskStatus } from '@ihui/types'
import type { DeviceTaskProgress } from '@ihui/types'
import { readChatSyncRev } from '../db/chat-sync-rev-queries.js'
import { AppError } from '../errors/AppError.js'
import {
  appendTaskStream,
  attachTaskMessage,
  extendTaskLease,
  getTaskForUser,
  requestTaskCancel,
  retryTask,
} from '../services/device-task-runtime.js'
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
  assertDeviceFingerprint,
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

/** pair-exchange 失败计数闸(第 12 批):TTL 窗口内每 IP 允许的失败尝试上限 */
const PAIR_EXCHANGE_FAIL_LIMIT = 5
/** 计数窗口(秒):与 PAIR_CODE_TTL_MS(5min)同量级 + 1min 缓冲 */
const PAIR_EXCHANGE_WINDOW_SEC = 360

export const devicesRoutes: FastifyPluginAsync = async (server) => {
  // PUT /api/devices/token - 注册/更新当前用户的推送设备令牌
  // 同一 token 在 device_tokens 表中唯一;本人重复上报时 upsert 刷新元数据并置为 active。
  server.put('/devices/token', async (request, reply) => {
    await authenticate(request)
    const parsed = registerDeviceTokenSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const { token, platform, deviceType, appVersion, locale } = parsed.data

    // token 全局唯一,若"冲突即改写 user_id",任何登录用户知道他人 FCM token 就能把
    // 该设备的推送改投到自己账号(SDB-01)。先判归属:不是本人就拒绝,原行一个字都不动。
    // 响应只回冲突本身,不回显原 owner 的任何信息。
    const rejectOwned = () =>
      reply.status(409).send(error(409, '推送令牌已被其他账号占用', 'DEVICE_TOKEN_OWNED_BY_OTHER'))

    const [existing] = await db
      .select({ userId: deviceTokens.userId })
      .from(deviceTokens)
      .where(eq(deviceTokens.token, token))
      .limit(1)
    if (existing && existing.userId !== userId) return rejectOwned()

    const now = new Date()
    const rows = await db
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
        // 预查与 upsert 之间有并发窗口:把归属判据下推进 DO UPDATE 的 WHERE,
        // 被他人抢先注册时条件不成立 ⇒ 0 行,原 owner 保持不变(而非改判 owner)。
        setWhere: eq(deviceTokens.userId, userId),
      })
      .returning({ id: deviceTokens.id })
    if (rows.length === 0) return rejectOwned()

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
    // G1b 指纹一致性闸(绑定过指纹的设备必须每请求携带同一 X-Device-Fingerprint;
    // 未绑定 = 存量设备,跳过校验)。requireDevice 在各端点 try 块之外调用,闸命中
    // 必须在这里手写响应归位(与上方 401 同形),不能依赖端点自身的 replyServiceError。
    try {
      assertDeviceFingerprint(device, request.headers['x-device-fingerprint'])
    } catch (e) {
      const err = e as { statusCode?: number; message?: string; errorCode?: string }
      const code = err.statusCode ?? 403
      reply.status(code).send(error(code, err.message ?? '设备指纹不匹配', err.errorCode))
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

  // G2(2026-11-25):执行器协议。入参统一 snake_case(与 target_device_id 等既有面一致),
  // 内部再映射成 @ihui/types 的 camelCase 形状。
  const taskProgressInputSchema = z.object({
    stage: z.string().max(32),
    percent: z.number().min(0).max(100),
    iteration: z.number().int().min(0).optional(),
    last_event: z.string().max(200).optional(),
    updated_at: z.string().max(64).optional(),
  })

  /** 入参进度 → 契约形状;未知 stage 一律 400(不静默丢弃,否则端侧渲染成空白) */
  const toProgress = (raw: z.infer<typeof taskProgressInputSchema>): DeviceTaskProgress => {
    if (!isDeviceTaskStage(raw.stage)) {
      throw new AppError(`未知执行阶段 ${raw.stage}`, 400, 'TASK_STAGE_INVALID')
    }
    const progress: DeviceTaskProgress = {
      stage: raw.stage,
      percent: raw.percent,
      updatedAt: raw.updated_at ?? new Date().toISOString(),
    }
    if (raw.iteration !== undefined) progress.iteration = raw.iteration
    if (raw.last_event !== undefined) progress.lastEvent = raw.last_event
    return progress
  }

  /** 库里的 jsonb 进度(可能是旧形状/半截)→ 契约形状;判不出来返回 null(不冒造) */
  const normalizeStoredProgress = (v: unknown): DeviceTaskProgress | null => {
    if (!v || typeof v !== 'object') return null
    const p = v as Record<string, unknown>
    if (!isDeviceTaskStage(p.stage)) return null
    if (typeof p.percent !== 'number' || p.percent < 0 || p.percent > 100) return null
    const updatedAt =
      typeof p.updatedAt === 'string' && !Number.isNaN(Date.parse(p.updatedAt))
        ? p.updatedAt
        : new Date().toISOString()
    const out: DeviceTaskProgress = { stage: p.stage, percent: p.percent, updatedAt }
    if (typeof p.iteration === 'number' && Number.isInteger(p.iteration))
      out.iteration = p.iteration
    if (typeof p.lastEvent === 'string') out.lastEvent = p.lastEvent
    return out
  }

  /**
   * 任务状态帧统一出口。
   * 广播失败**不改变**写路径结果:任务已经落库,端侧下次拉列表仍能看到;
   * 但构造失败(如 status 不在封闭集)绝不静默吞掉形状错误 —— 那是契约腐烂。
   */
  const broadcastDeviceTask = (userId: string, task: DeviceTask): void => {
    if (!isDeviceTaskStatus(task.status)) return
    const progress = normalizeStoredProgress(task.progress)
    const canCarryError = task.status === 'failed' || task.status === 'expired'
    const evt = deviceTaskEvent({
      taskId: task.id,
      deviceId: task.targetDeviceId,
      conversationId: task.sessionId,
      status: task.status,
      attempt: task.attempt,
      ...(progress ? { progress } : {}),
      ...(canCarryError && task.error ? { error: task.error } : {}),
    })
    try {
      server.broadcastToUser(userId, evt.event, evt.data)
    } catch {
      /* 广播面异常不回灌写路径 */
    }
  }

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
    // 失败计数闸(2026-10-31 安全强化第 12 批):码即凭据的公开端点,TTL 5 分钟内
    // 无 per-IP 失败上限 ⇒ 10^8 空间可被分布式在线爆破(兑换成功即签发长期设备
    // 令牌并以受害者身份注册设备)。窗口与 PAIR_CODE_TTL 同量级;redis 不可用时
    // fail-open 放行(限流是增强,不得因它掐死正常兑换)。
    const redis = server.redis
    const failKey = `pairx:fail:${request.ip}`
    const readFails = async (): Promise<number> => {
      if (!redis) return 0
      try {
        return parseInt((await redis.get(failKey)) ?? '0', 10)
      } catch {
        return 0
      }
    }
    if ((await readFails()) >= PAIR_EXCHANGE_FAIL_LIMIT) {
      return reply
        .status(429)
        .send(error(429, '尝试过于频繁,请稍后再试', 'PAIR_EXCHANGE_RATE_LIMITED'))
    }
    const parsed = z
      .object({
        code: z.string().regex(/^\d{8}$/, '配对码为 8 位数字'),
        name: z.string().min(1).max(255).optional(),
        os: z.string().max(128).optional().nullable(),
        capabilities: capabilitiesSchema,
        fingerprint: z.string().min(8).max(128).optional().nullable(),
        clientVersion: z.string().max(64).optional().nullable(),
      })
      .safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const { deviceToken, device } = await exchangePairCode(parsed.data)
      if (redis) await redis.del(failKey).catch(() => {})
      return reply.send(success({ device_token: deviceToken, device_id: device.id }))
    } catch (e) {
      if (redis) {
        try {
          const n = await redis.incr(failKey)
          if (n === 1) await redis.expire(failKey, PAIR_EXCHANGE_WINDOW_SEC)
        } catch {
          /* 计数失败按未计数处理(fail-open) */
        }
      }
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

  // POST /api/devices/tasks/:id/progress - 设备上报进度(running 态)
  server.post('/devices/tasks/:id/progress', async (request, reply) => {
    const device = await requireDevice(request, reply)
    if (!device) return
    const id = requireId(request, reply)
    if (!id) return
    const parsed = z
      .object({
        summary: z.record(z.string(), z.unknown()).optional(),
        progress: taskProgressInputSchema.optional(),
        agent_session_id: z.string().max(64).optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const task = await updateTaskProgress(
        device.id,
        id,
        (parsed.data.summary ?? null) as DeviceCapabilities | null,
        parsed.data.progress ? toProgress(parsed.data.progress) : null,
        parsed.data.agent_session_id ?? null,
      )
      broadcastDeviceTask(device.userId, task)
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
    const parsed = z
      .object({ summary: capabilitiesSchema, progress: taskProgressInputSchema.optional() })
      .safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const task = await completeTask(
        device.id,
        id,
        (parsed.data.summary ?? null) as DeviceCapabilities | null,
        parsed.data.progress ? toProgress(parsed.data.progress) : null,
      )
      broadcastDeviceTask(device.userId, task)
      // 消息面收尾:任务输出在会话里是一条 assistant 消息,终态必须发 terminal 帧,
      // 否则端侧那条"正在生成"的气泡永远转圈(内容已落库,但状态位没到)。
      if (task.messageId) {
        await server.broadcastChatMessageTerminal({
          conversationId: task.sessionId,
          messageId: task.messageId,
          reason: 'stop',
          memberUserIds: [device.userId],
        })
      }
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
      .object({
        error: z.string().max(2000).optional(),
        summary: capabilitiesSchema,
        progress: taskProgressInputSchema.optional(),
      })
      .safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const task = await failTask(
        device.id,
        id,
        parsed.data.error ?? null,
        (parsed.data.summary ?? null) as DeviceCapabilities | null,
        parsed.data.progress ? toProgress(parsed.data.progress) : null,
      )
      broadcastDeviceTask(device.userId, task)
      if (task.messageId) {
        // 用户取消走 aborted(端侧显示"已取消"),其余失败走 error(端侧显示失败原因)。
        const cancelled =
          task.progress !== null &&
          typeof task.progress === 'object' &&
          (task.progress as { stage?: unknown }).stage === 'cancelled'
        await server.broadcastChatMessageTerminal({
          conversationId: task.sessionId,
          messageId: task.messageId,
          reason: cancelled ? 'aborted' : 'error',
          memberUserIds: [device.userId],
        })
      }
      return reply.send(success(task))
    } catch (e) {
      return replyServiceError(reply, e)
    }
  })

  // POST /api/devices/tasks/:id/attach - 设备开执行:在会话里落一条 assistant 消息
  server.post('/devices/tasks/:id/attach', async (request, reply) => {
    const device = await requireDevice(request, reply)
    if (!device) return
    const id = requireId(request, reply)
    if (!id) return
    try {
      const attached = await attachTaskMessage(device.id, id)
      // created 必须先于任何 patch 帧(契约 §2):端侧先插入气泡,后续 patch 才有落点。
      // 幂等 attach 会重复发同一 messageId 的 created —— 端侧按 id 去重,内容不回退。
      await server.broadcastChatMessageCreated({
        conversationId: attached.conversationId,
        messageId: attached.messageId,
        role: 'assistant',
        content: attached.content,
        memberUserIds: [device.userId],
      })
      return reply.send(
        success({
          task_id: attached.taskId,
          message_id: attached.messageId,
          conversation_id: attached.conversationId,
        }),
      )
    } catch (e) {
      return replyServiceError(reply, e)
    }
  })

  // POST /api/devices/tasks/:id/stream - 设备上报执行输出增量(delta/snapshot)
  server.post('/devices/tasks/:id/stream', async (request, reply) => {
    const device = await requireDevice(request, reply)
    if (!device) return
    const id = requireId(request, reply)
    if (!id) return
    const parsed = z
      .object({
        kind: z.enum(['delta', 'snapshot']),
        text_delta: z.string().max(20_000).optional(),
        content: z.string().max(200_000).optional(),
        progress: taskProgressInputSchema.optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const frame = await appendTaskStream(device.id, id, {
        kind: parsed.data.kind,
        ...(parsed.data.text_delta !== undefined ? { textDelta: parsed.data.text_delta } : {}),
        ...(parsed.data.content !== undefined ? { content: parsed.data.content } : {}),
        ...(parsed.data.progress ? { progress: toProgress(parsed.data.progress) } : {}),
      })
      await server.broadcastChatMessagePatched({
        conversationId: frame.conversationId,
        messageId: frame.messageId,
        kind: frame.kind,
        ...(frame.kind === 'delta'
          ? { textDelta: frame.textDelta ?? '' }
          : { content: frame.content }),
        memberUserIds: [device.userId],
      })
      // rev 由广播装饰器分配;设备拿链头做对账(不是自己造坐标)
      const rev = await readChatSyncRev(frame.messageId)
      return reply.send(success({ message_id: frame.messageId, rev }))
    } catch (e) {
      return replyServiceError(reply, e)
    }
  })

  // POST /api/devices/tasks/:id/lease - 设备续租 + 取取消意图
  server.post('/devices/tasks/:id/lease', async (request, reply) => {
    const device = await requireDevice(request, reply)
    if (!device) return
    const id = requireId(request, reply)
    if (!id) return
    const parsed = z
      .object({ progress: taskProgressInputSchema.optional() })
      .safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const res = await extendTaskLease(
        device.id,
        id,
        parsed.data.progress ? toProgress(parsed.data.progress) : undefined,
      )
      return reply.send(
        success({
          cancel_requested: res.cancelRequested,
          lease_expires_at: res.leaseExpiresAt.toISOString(),
          agent_session_id: res.agentSessionId,
        }),
      )
    } catch (e) {
      return replyServiceError(reply, e)
    }
  })

  // GET /api/devices/tasks/:id - 用户侧任务详情(进度/载荷/失败原因)
  server.get('/devices/tasks/:id', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const id = requireId(request, reply)
    if (!id) return
    try {
      const found = await getTaskForUser(userId, id)
      if (!found) return reply.status(404).send(error(404, '任务不存在'))
      return reply.send(success(found))
    } catch (e) {
      return replyServiceError(reply, e)
    }
  })

  // POST /api/devices/tasks/:id/cancel - 用户取消(未认领直落 failed;已认领置取消意图)
  server.post('/devices/tasks/:id/cancel', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const id = requireId(request, reply)
    if (!id) return
    try {
      const res = await requestTaskCancel(userId, id)
      broadcastDeviceTask(userId, res.task)
      if (res.immediate && res.task.messageId) {
        await server.broadcastChatMessageTerminal({
          conversationId: res.task.sessionId,
          messageId: res.task.messageId,
          reason: 'aborted',
          memberUserIds: [userId],
        })
      }
      return reply.send(
        success({ cancelled: true, immediate: res.immediate, status: res.task.status }),
      )
    } catch (e) {
      return replyServiceError(reply, e)
    }
  })

  // POST /api/devices/tasks/:id/retry - 用户重排失败/过期任务(保留历史消息,attempt+1)
  server.post('/devices/tasks/:id/retry', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const id = requireId(request, reply)
    if (!id) return
    try {
      const res = await retryTask(userId, id)
      broadcastDeviceTask(userId, res.task)
      return reply.send(
        success({ task_id: res.task.id, status: 'queued', attempt: res.task.attempt }),
      )
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
    const parsed = z
      .object({
        target_device_id: z.string().uuid(),
        // G2 执行载荷(全部可选:缺 prompt 时服务端取会话最后一条 user 消息)
        prompt: z.string().max(20_000).optional(),
        workspace: z.string().max(200).optional(),
        mode: z.enum(['execute', 'plan']).optional(),
        auto_approve: z.boolean().optional(),
        model: z.string().max(100).optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const task = await delegateTask({
        userId,
        sessionId: id,
        targetDeviceId: parsed.data.target_device_id,
        payload: {
          ...(parsed.data.prompt !== undefined ? { prompt: parsed.data.prompt } : {}),
          ...(parsed.data.workspace !== undefined ? { workspace: parsed.data.workspace } : {}),
          ...(parsed.data.mode !== undefined ? { mode: parsed.data.mode } : {}),
          ...(parsed.data.auto_approve !== undefined
            ? { autoApprove: parsed.data.auto_approve }
            : {}),
          ...(parsed.data.model !== undefined ? { model: parsed.data.model } : {}),
        },
      })
      broadcastDeviceTask(userId, task)
      return reply.send(success({ task_id: task.id, status: 'queued' }))
    } catch (e) {
      return replyServiceError(reply, e)
    }
  }
  server.post('/chat/sessions/:id/delegate', delegateHandler)
  server.post('/chat/conversations/:id/delegate', delegateHandler)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
