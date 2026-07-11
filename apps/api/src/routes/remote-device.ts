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

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, desc, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { remoteDevices, remoteDeviceTasks } from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

const ADMIN_ROLE_ID = 1

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    reply
      .status(statusCode)
      .send(error(statusCode, (e as Error).message || 'Authentication required'))
    return false
  }
}

async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if (!(await requireAuth(request, reply))) return false
  const roleId = (request as unknown as { roleId?: number }).roleId
  if (roleId === undefined || roleId < ADMIN_ROLE_ID) {
    reply.status(403).send(error(403, '需要管理员权限'))
    return false
  }
  return true
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
  userId: z.string().uuid().optional(),
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
  // ===== 设备管理 =====

  server.get('/remote-devices', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const query = request.query as {
      status?: string
      keyword?: string
      page?: string
      pageSize?: string
    }
    const page = parseInt(query.page ?? '1', 10)
    const pageSize = parseInt(query.pageSize ?? '20', 10)
    const offset = (page - 1) * pageSize
    const conditions = []
    if (query.status) conditions.push(eq(remoteDevices.status, query.status))
    const list = await db
      .select()
      .from(remoteDevices)
      .where(conditions.length > 0 ? and(...conditions) : eq(remoteDevices.id, remoteDevices.id))
      .orderBy(desc(remoteDevices.createdAt))
      .limit(pageSize)
      .offset(offset)
    return reply.send(success({ list, page, pageSize }))
  })

  server.get('/remote-devices/:id', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { id } = request.params as { id: string }
    const [device] = await db.select().from(remoteDevices).where(eq(remoteDevices.id, id)).limit(1)
    if (!device) return reply.status(404).send(error(404, '设备不存在'))
    return reply.send(success(device))
  })

  server.post('/remote-devices', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
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
    if (!(await requireAdmin(request, reply))) return
    const { id } = request.params as { id: string }
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
    if (!(await requireAdmin(request, reply))) return
    const { id } = request.params as { id: string }
    await db.delete(remoteDevices).where(eq(remoteDevices.id, id))
    return reply.send(success({ deleted: true }))
  })

  server.post('/remote-devices/:id/heartbeat', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { id } = request.params as { id: string }
    const body = request.body as {
      batteryLevel?: number
      signalStrength?: number
      ipAddress?: string
    }
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
      .where(eq(remoteDevices.id, id))
      .returning()
    if (!device) return reply.status(404).send(error(404, '设备不存在'))
    return reply.send(success({ deviceId: id, status: 'online', timestamp: new Date() }))
  })

  // ===== 任务管理 =====

  server.get('/remote-devices/:id/tasks', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { id } = request.params as { id: string }
    const query = request.query as { status?: string }
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
    if (!(await requireAdmin(request, reply))) return
    const { id } = request.params as { id: string }
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
    if (!(await requireAuth(request, reply))) return
    const { taskId } = request.params as { taskId: string }
    const [task] = await db
      .select()
      .from(remoteDeviceTasks)
      .where(eq(remoteDeviceTasks.id, taskId))
      .limit(1)
    if (!task) return reply.status(404).send(error(404, '任务不存在'))
    return reply.send(success(task))
  })

  server.put('/remote-device-tasks/:taskId/status', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { taskId } = request.params as { taskId: string }
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
    const [task] = await db
      .update(remoteDeviceTasks)
      .set(updates)
      .where(eq(remoteDeviceTasks.id, taskId))
      .returning()
    if (!task) return reply.status(404).send(error(404, '任务不存在'))
    return reply.send(success(task))
  })

  server.delete('/remote-device-tasks/:taskId', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const { taskId } = request.params as { taskId: string }
    await db.delete(remoteDeviceTasks).where(eq(remoteDeviceTasks.id, taskId))
    return reply.send(success({ deleted: true }))
  })

  server.post('/remote-device-tasks/:taskId/retry', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const { taskId } = request.params as { taskId: string }
    const [task] = await db
      .select()
      .from(remoteDeviceTasks)
      .where(eq(remoteDeviceTasks.id, taskId))
      .limit(1)
    if (!task) return reply.status(404).send(error(404, '任务不存在'))
    if (task.retryCount >= task.maxRetries) {
      return reply.status(400).send(error(400, `已达最大重试次数 ${task.maxRetries}`))
    }
    const [updated] = await db
      .update(remoteDeviceTasks)
      .set({
        status: 'pending',
        retryCount: task.retryCount + 1,
        errorMessage: null,
        dispatchedAt: null,
        startedAt: null,
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(remoteDeviceTasks.id, taskId))
      .returning()
    return reply.send(success(updated))
  })

  server.get('/remote-device-tasks/pending', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const query = request.query as { page?: string; pageSize?: string }
    const page = parseInt(query.page ?? '1', 10)
    const pageSize = parseInt(query.pageSize ?? '50', 10)
    const offset = (page - 1) * pageSize
    const list = await db
      .select()
      .from(remoteDeviceTasks)
      .where(eq(remoteDeviceTasks.status, 'pending'))
      .orderBy(desc(remoteDeviceTasks.priority), desc(remoteDeviceTasks.createdAt))
      .limit(pageSize)
      .offset(offset)
    return reply.send(success({ list, page, pageSize }))
  })
}
