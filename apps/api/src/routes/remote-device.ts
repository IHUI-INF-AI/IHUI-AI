// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 远程设备任务管理路由 (迁移自旧架构 Java RemoteDeviceByTaskController)。
 *
 * 端点：
 * - GET    /remote-devices              — 设备列表
 * - GET    /remote-devices/:id          — 设备详情
 * - POST   /remote-devices              — 注册设备
 * - PUT    /remote-devices/:id          — 更新设备
 * - DELETE /remote-devices/:id          — 删除设备
 * - POST   /remote-devices/:id/heartbeat — 设备心跳
 * - GET    /remote-devices/:id/tasks    — 设备任务列表
 * - POST   /remote-devices/:id/tasks    — 下发任务
 * - GET    /remote-device-tasks/:taskId — 任务详情
 * - PUT    /remote-device-tasks/:taskId/status — 更新任务状态
 * - DELETE /remote-device-tasks/:taskId — 删除任务
 * - POST   /remote-device-tasks/:taskId/retry — 重试任务
 * - GET    /remote-device-tasks/pending — 待下发任务列表
 */

import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { eq, desc, and, lt, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { remoteDevices, remoteDeviceTasks } from '@ihui/database'
import { requireAdmin, requireAuth, isSystemAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'

// 2026-10-27 属主闸(单源):设备面此前对 读/心跳/任务状态 只判 requireAuth —— 任何登录
// 用户可拖取全站设备清单与任务载荷、伪造他人设备心跳并覆写其网络属性、把他人任务改判
// completed 并注入任意 result(jsonb 由下发端/看板消费 ⇒ 伪造执行结果 + 二次注入面)。
// 管理员(isSystemAdmin,只认人用 JWT)看全站;普通用户的可见域 =
// remoteDevices.userId == 令牌主体。设备代理侧改走设备令牌前,这是服务端唯一防线。
const isPrivilegedViewer = (request: FastifyRequest): boolean =>
  isSystemAdmin(request, { includeInternalChannel: false })

/** 设备查询的属主条件;admin 返回 undefined(不加条件) */
const deviceOwnerCond = (request: FastifyRequest) =>
  isPrivilegedViewer(request) ? undefined : eq(remoteDevices.userId, request.userId!)

/**
 * 任务归属判定(任务表无 userId 列,归属经 deviceId → remoteDevices.userId)。
 * 非属主 ⇒ null,调用方如实回 404 —— 不区分"不存在"与"不是你的",不新增探测差分。
 */
async function taskWithOwnership(taskId: string, request: FastifyRequest) {
  const cond = deviceOwnerCond(request)
  const rows = await db
    .select({ task: remoteDeviceTasks })
    .from(remoteDeviceTasks)
    .innerJoin(remoteDevices, eq(remoteDeviceTasks.deviceId, remoteDevices.id))
    .where(cond ? and(eq(remoteDeviceTasks.id, taskId), cond) : eq(remoteDeviceTasks.id, taskId))
    .limit(1)
  return rows[0]?.task ?? null
}

const registerDeviceSchema = z.object({
  deviceNo: z.string().min(1).max(100),
  deviceName: z.string().max(200).optional(),
  deviceType: z.string().max(50).optional(),
  model: z.string().max(100).optional(),
  manufacturer: z.string().max(100).optional(),
  firmwareVersion: z.string().max(50).optional(),
  ipAddress: z.string().max(45).optional(),
  macAddress: z.string().max(17).optional(),
  location: z.string().max(255).optional(),
  longitude: z.string().max(20).optional(),
  latitude: z.string().max(20).optional(),
  userId: z.uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const updateDeviceSchema = registerDeviceSchema.partial()

const createTaskSchema = z.object({
  taskType: z.enum([
    'firmware_upgrade',
    'config_update',
    'reboot',
    'diagnostic',
    'data_collect',
    'custom',
  ]),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  priority: z.number().int().min(0).max(10).default(0),
  maxRetries: z.number().int().min(0).max(10).default(3),
})

const updateTaskStatusSchema = z.object({
  status: z.enum(['pending', 'dispatched', 'executing', 'completed', 'failed']),
  result: z.record(z.string(), z.unknown()).optional(),
  errorMessage: z.string().optional(),
})

export const remoteDeviceRoutes: FastifyPluginAsync = async (server) => {
  const idParam = z.object({ id: z.string() })
  const taskIdParam = z.object({ taskId: z.string() })
  const deviceListQuery = z.object({
    status: z.string().optional(),
    keyword: z.string().optional(),
    page: z.coerce.number().optional().default(1),
    // P1 修复(2026-08-06): 分页 pageSize 补上限
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  const heartbeatBody = z.object({
    batteryLevel: z.number().optional(),
    signalStrength: z.number().optional(),
    ipAddress: z.string().optional(),
  })
  const taskStatusQuery = z.object({ status: z.string().optional() })

  // ===== 设备管理 =====

  server.get('/remote-devices', async (request, reply) => {
    await requireAuth(request, reply)
    if (reply.sent) return
    const query = deviceListQuery.parse(request.query)
    const page = query.page
    const pageSize = query.pageSize
    const offset = (page - 1) * pageSize
    const conditions = []
    const ownerCond = deviceOwnerCond(request)
    if (ownerCond) conditions.push(ownerCond)
    if (query.status) conditions.push(eq(remoteDevices.status, query.status))
    const list = await db
      .select()
      .from(remoteDevices)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(remoteDevices.createdAt))
      .limit(pageSize)
      .offset(offset)
    return reply.send(success({ list, page, pageSize }))
  })

  server.get('/remote-devices/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (reply.sent) return
    const { id } = idParam.parse(request.params)
    const ownerCond = deviceOwnerCond(request)
    const [device] = await db
      .select()
      .from(remoteDevices)
      .where(ownerCond ? and(eq(remoteDevices.id, id), ownerCond) : eq(remoteDevices.id, id))
      .limit(1)
    if (!device) return reply.status(404).send(error(404, '设备不存在'))
    return reply.send(success(device))
  })

  server.post('/remote-devices', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = registerDeviceSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select()
      .from(remoteDevices)
      .where(eq(remoteDevices.deviceNo, parsed.data.deviceNo))
      .limit(1)
    if (existing) return reply.status(409).send(error(409, '设备编号已存在'))
    const [device] = await db.insert(remoteDevices).values(parsed.data).returning()
    return reply.status(201).send(success(device))
  })

  server.put('/remote-devices/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const { id } = idParam.parse(request.params)
    const parsed = updateDeviceSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [device] = await db
      .update(remoteDevices)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(remoteDevices.id, id))
      .returning()
    if (!device) return reply.status(404).send(error(404, '设备不存在'))
    return reply.send(success(device))
  })

  server.delete('/remote-devices/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const { id } = idParam.parse(request.params)
    const removed = await db
      .delete(remoteDevices)
      .where(eq(remoteDevices.id, id))
      .returning({ id: remoteDevices.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  server.post('/remote-devices/:id/heartbeat', async (request, reply) => {
    await requireAuth(request, reply)
    if (reply.sent) return
    const { id } = idParam.parse(request.params)
    const body = heartbeatBody.parse(request.body)
    // 属主闸:此前任何登录用户可对**任意**设备 id 伪造心跳并覆写其网络属性
    const ownerCond = deviceOwnerCond(request)
    const [device] = await db
      .update(remoteDevices)
      .set({
        status: 'online',
        lastOnlineAt: new Date(),
        batteryLevel: body.batteryLevel,
        signalStrength: body.signalStrength,
        ipAddress: body.ipAddress,
        updatedAt: new Date(),
      })
      .where(ownerCond ? and(eq(remoteDevices.id, id), ownerCond) : eq(remoteDevices.id, id))
      .returning()
    if (!device) return reply.status(404).send(error(404, '设备不存在'))
    return reply.send(success({ deviceId: id, status: 'online', timestamp: new Date() }))
  })

  // ===== 任务管理 =====

  server.get('/remote-devices/:id/tasks', async (request, reply) => {
    await requireAuth(request, reply)
    if (reply.sent) return
    const { id } = idParam.parse(request.params)
    const query = taskStatusQuery.parse(request.query)
    // 属主闸:先按属主条件确认设备可见,再列其任务
    const ownerCond = deviceOwnerCond(request)
    const [device] = await db
      .select({ id: remoteDevices.id })
      .from(remoteDevices)
      .where(ownerCond ? and(eq(remoteDevices.id, id), ownerCond) : eq(remoteDevices.id, id))
      .limit(1)
    if (!device) return reply.status(404).send(error(404, '设备不存在'))
    const conditions = [eq(remoteDeviceTasks.deviceId, id)]
    if (query.status) conditions.push(eq(remoteDeviceTasks.status, query.status))
    const list = await db
      .select()
      .from(remoteDeviceTasks)
      .where(and(...conditions))
      .orderBy(desc(remoteDeviceTasks.createdAt))
    return reply.send(success(list))
  })

  server.post('/remote-devices/:id/tasks', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const { id } = idParam.parse(request.params)
    const parsed = createTaskSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [device] = await db.select().from(remoteDevices).where(eq(remoteDevices.id, id)).limit(1)
    if (!device) return reply.status(404).send(error(404, '设备不存在'))
    const [task] = await db
      .insert(remoteDeviceTasks)
      .values({
        deviceId: id,
        ...parsed.data,
        createdBy: (request as unknown as { userId?: string }).userId,
      })
      .returning()
    return reply.status(201).send(success(task))
  })

  server.get('/remote-device-tasks/:taskId', async (request, reply) => {
    await requireAuth(request, reply)
    if (reply.sent) return
    const { taskId } = taskIdParam.parse(request.params)
    // 属主闸:任务载荷(payload/result)此前对任何登录用户可读
    const task = await taskWithOwnership(taskId, request)
    if (!task) return reply.status(404).send(error(404, '任务不存在'))
    return reply.send(success(task))
  })

  server.put('/remote-device-tasks/:taskId/status', async (request, reply) => {
    await requireAuth(request, reply)
    if (reply.sent) return
    const { taskId } = taskIdParam.parse(request.params)
    const parsed = updateTaskStatusSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const now = new Date()
    const updates: Record<string, unknown> = { status: parsed.data.status, updatedAt: now }
    if (parsed.data.status === 'dispatched') updates.dispatchedAt = now
    if (parsed.data.status === 'executing') updates.startedAt = now
    if (parsed.data.status === 'completed' || parsed.data.status === 'failed')
      updates.completedAt = now
    if (parsed.data.result !== undefined) updates.result = parsed.data.result
    if (parsed.data.errorMessage !== undefined) updates.errorMessage = parsed.data.errorMessage
    // 属主闸:此前任何登录用户可把**他人**任务改判 completed/failed 并注入任意 result
    const owned = await taskWithOwnership(taskId, request)
    if (!owned) return reply.status(404).send(error(404, '任务不存在'))
    const [task] = await db
      .update(remoteDeviceTasks)
      .set(updates)
      .where(eq(remoteDeviceTasks.id, taskId))
      .returning()
    if (!task) return reply.status(404).send(error(404, '任务不存在'))
    return reply.send(success(task))
  })

  server.delete('/remote-device-tasks/:taskId', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const { taskId } = taskIdParam.parse(request.params)
    const removed = await db
      .delete(remoteDeviceTasks)
      .where(eq(remoteDeviceTasks.id, taskId))
      .returning({ id: remoteDeviceTasks.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  server.post('/remote-device-tasks/:taskId/retry', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const { taskId } = taskIdParam.parse(request.params)
    const [task] = await db
      .select()
      .from(remoteDeviceTasks)
      .where(eq(remoteDeviceTasks.id, taskId))
      .limit(1)
    if (!task) return reply.status(404).send(error(404, '任务不存在'))
    if (task.retryCount >= task.maxRetries) {
      return reply.status(400).send(error(400, `已达最大重试次数 ${task.maxRetries}`))
    }
    // 上限判定必须落在 WHERE 里:上面那次 select 只是给"读后即答"的提示用,
    // 两个并发重试会各自读到 retryCount=N-1、各自写 N+1 ⇒ 既吞一次计数,也**绕过 maxRetries
    // 白送一次重试**(设备任务被重复下发)。库里加 `retry_count < max_retries` 守卫,
    // 空集就是"这一次没抢到额度",如实回 409。
    const [updated] = await db
      .update(remoteDeviceTasks)
      .set({
        status: 'pending',
        retryCount: sql`${remoteDeviceTasks.retryCount} + 1`,
        errorMessage: null,
        dispatchedAt: null,
        startedAt: null,
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(remoteDeviceTasks.id, taskId),
          lt(remoteDeviceTasks.retryCount, remoteDeviceTasks.maxRetries),
        ),
      )
      .returning()
    if (!updated) return reply.status(409).send(error(409, '重试次数已达上限,未执行本次重试'))
    return reply.send(success(updated))
  })

  server.get('/remote-device-tasks/pending', async (request, reply) => {
    await requireAuth(request, reply)
    if (reply.sent) return
    const query = z
      .object({
        page: z.coerce.number().optional().default(1),
        // P1 修复(2026-08-06): 分页 pageSize 补上限
        pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
      })
      .parse(request.query)
    const page = query.page
    const pageSize = query.pageSize
    const offset = (page - 1) * pageSize
    // 属主闸:待下发任务此前对任何登录用户可整站拖取
    const ownerCond = deviceOwnerCond(request)
    const base = db
      .select({ task: remoteDeviceTasks })
      .from(remoteDeviceTasks)
      .innerJoin(remoteDevices, eq(remoteDeviceTasks.deviceId, remoteDevices.id))
    const list = await (ownerCond
      ? base
          .where(and(eq(remoteDeviceTasks.status, 'pending'), ownerCond))
          .orderBy(desc(remoteDeviceTasks.priority), desc(remoteDeviceTasks.createdAt))
          .limit(pageSize)
          .offset(offset)
      : base
          .where(eq(remoteDeviceTasks.status, 'pending'))
          .orderBy(desc(remoteDeviceTasks.priority), desc(remoteDeviceTasks.createdAt))
          .limit(pageSize)
          .offset(offset))
    return reply.send(success({ list: list.map((r) => r.task), page, pageSize }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
