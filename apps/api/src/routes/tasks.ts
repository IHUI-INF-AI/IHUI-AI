/**
 * 三端联动任务调度路由(2026-07-23 立,对齐 @ihui/shared/tasks/dispatch 契约)。
 *
 * mobile-rn 下发 → api WebSocket → desktop 接收执行 → 结果回推。
 * Redis key 格式:tasks:<userId>(任务数组 JSON)
 * WS 推送频道:task-dispatch:<userId> / task-result:<userId>
 * Redis 不可用时降级为进程内 Map。
 *
 * 端点:
 *  - POST /tasks/dispatch   下发任务(创建 + WS 推送)
 *  - POST /tasks/result      回传结果(更新状态 + WS 推送)
 *  - GET  /tasks             列出用户任务
 *  - GET  /tasks/devices     返回在线设备列表
 *
 * 设备在线注册表(2026-07-23 立,P1 设备寻址闭环):
 *  - POST /tasks/register-device      desktop 启动注册 deviceId(30s 心跳刷新 lastSeen + 60s TTL)
 *  - DELETE /tasks/devices/:deviceId  设备下线清理
 *  - GET /tasks/devices               返回真实在线设备列表(过滤 lastSeen 距今 >60s 为 offline)
 * Redis key 格式:devices:<userId>(Hash 结构,field=deviceId → value=TaskDevice JSON)
 */
import type {
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  FastifyInstance,
} from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import type {
  TaskDispatch,
  TaskResult,
  TaskDispatchResponse,
  TaskWsMessage,
  TaskDevice,
  TaskDeviceRegisterResponse,
  TaskDeviceListResponse,
  TaskCancelResponse,
  TaskFilePayload,
} from '@ihui/shared'

const dispatchSchema = z.object({
  toDevice: z.string().min(1).max(100),
  command: z.string().min(1).max(10_000),
  filePayload: z
    .object({
      filename: z.string().min(1).max(255),
      size: z.number().int().nonnegative(),
      mimeType: z.string().min(1).max(100),
      content: z.string().min(1),
    })
    .optional(),
})

/** base64 解码后最大字节数(1MB,2026-07-24 P2-c 跨端文件传输) */
const FILE_PAYLOAD_MAX_BYTES = 1_048_576

/** Node.js atob 兼容(15+ 原生支持);解码 base64 → 字节数 */
function base64DecodedBytes(b64: string): number {
  try {
    const bin = atob(b64)
    return bin.length
  } catch {
    return -1
  }
}

const resultSchema = z.object({
  taskId: z.string().min(1).max(100),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  output: z.string().max(100_000).optional(),
  error: z.string().max(10_000).optional(),
})

/** POST /tasks/:id/cancel body:可空或 { reason?: string }(2026-07-23 立) */
const cancelSchema = z.object({
  reason: z.string().max(1_000).optional(),
})

/** GET /tasks?since=<timestamp> 查询参数(2026-07-23 立) */
const sinceSchema = z.object({
  since: z.coerce.number().int().nonnegative().optional(),
})

const deviceTypeSchema = z.enum([
  'desktop',
  'web',
  'mobile',
  'cloud',
  'extension',
  'cli',
])

const registerSchema = z.object({
  deviceId: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  type: deviceTypeSchema,
})

/** 设备在线判定阈值:lastSeen 距今超过此值视为 offline(毫秒) */
const DEVICE_ONLINE_TTL_MS = 60_000

/** Redis 不可用时的进程内降级存储:userId → tasks[] */
const tasksFallback = new Map<string, TaskDispatch[]>()

/** Redis 不可用时的设备注册表降级存储:userId → (deviceId → TaskDevice) */
const devicesFallback = new Map<string, Map<string, TaskDevice>>()

function userKey(userId: string): string {
  return `tasks:${userId}`
}

async function readTasks(
  redis: { get: (k: string) => Promise<string | null> },
  key: string,
): Promise<TaskDispatch[]> {
  try {
    const raw = await redis.get(key)
    if (!raw) return []
    return JSON.parse(raw) as TaskDispatch[]
  } catch {
    return tasksFallback.get(key) ?? []
  }
}

async function writeTasks(
  redis: { set: (k: string, v: string) => Promise<unknown> },
  key: string,
  tasks: TaskDispatch[],
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(tasks))
  } catch {
    tasksFallback.set(key, tasks)
  }
}

function deviceKey(userId: string): string {
  return `devices:${userId}`
}

/** 读取用户全部设备(从 Redis Hash);Redis 不可用时降级进程内 Map。 */
async function readDevices(
  redis: {
    hgetall: (k: string) => Promise<Record<string, string>>
  },
  key: string,
): Promise<Map<string, TaskDevice>> {
  try {
    const raw = await redis.hgetall(key)
    const map = new Map<string, TaskDevice>()
    for (const [deviceId, json] of Object.entries(raw)) {
      try {
        map.set(deviceId, JSON.parse(json) as TaskDevice)
      } catch {
        /* 单个设备 JSON 损坏,跳过 */
      }
    }
    return map
  } catch {
    return devicesFallback.get(key) ?? new Map<string, TaskDevice>()
  }
}

/** 写入/刷新单个设备(Redis HSET + EXPIRE 60s);Redis 不可用时降级进程内 Map。 */
async function writeDevice(
  redis: {
    hset: (k: string, field: string, value: string) => Promise<unknown>
    expire: (k: string, ttl: number) => Promise<unknown>
  },
  key: string,
  device: TaskDevice,
): Promise<void> {
  try {
    await redis.hset(key, device.deviceId, JSON.stringify(device))
    await redis.expire(key, 60)
  } catch {
    let inner = devicesFallback.get(key)
    if (!inner) {
      inner = new Map<string, TaskDevice>()
      devicesFallback.set(key, inner)
    }
    inner.set(device.deviceId, device)
  }
}

/** 删除单个设备(Redis HDEL);Redis 不可用时降级进程内 Map delete。 */
async function removeDevice(
  redis: { hdel: (k: string, ...fields: string[]) => Promise<unknown> },
  key: string,
  deviceId: string,
): Promise<void> {
  try {
    await redis.hdel(key, deviceId)
  } catch {
    devicesFallback.get(key)?.delete(deviceId)
  }
}

/**
 * 推送 WS 消息:publish 到专用 Redis 频道 + 调用 pushNotification 直推在线客户端。
 * 参考 agent-control.ts 的 server.pushNotification 模式。
 */
function publishTaskWs(
  server: FastifyInstance,
  userId: string,
  channel: 'task-dispatch' | 'task-result' | 'task-cancelled',
  message: TaskWsMessage,
): void {
  const fullChannel = `${channel}:${userId}`
  try {
    void server.redis.publish(fullChannel, JSON.stringify(message))
  } catch {
    /* Redis publish 失败,忽略(降级模式下 WS 直推兜底) */
  }
  try {
    server.pushNotification(userId, message)
  } catch {
    /* WS 推送失败,忽略 */
  }
}

export const tasksRoutes: FastifyPluginAsync = async (server) => {
  // POST /tasks/dispatch — 下发任务(创建 + WS 推送到 task-dispatch 频道)
  server.post('/tasks/dispatch', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = dispatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const { toDevice, command, filePayload } = parsed.data

    // 二次校验:base64 解码后字节数 >1MB 返回 413(2026-07-24 P2-c 跨端文件传输)
    if (filePayload) {
      const bytes = base64DecodedBytes(filePayload.content)
      if (bytes < 0) {
        return reply.status(400).send(error(400, '附件 base64 解码失败'))
      }
      if (bytes > FILE_PAYLOAD_MAX_BYTES) {
        return reply
          .status(413)
          .send(error(413, `文件过大(限制 1MB,当前 ${bytes} 字节)`))
      }
    }

    const now = new Date().toISOString()
    const task: TaskDispatch = {
      id: randomUUID(),
      userId: Number(userId),
      fromDevice: 'api',
      toDevice,
      command,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }
    if (filePayload) {
      task.filePayload = filePayload as TaskFilePayload
    }

    const key = userKey(userId)
    const tasks = await readTasks(server.redis, key)
    tasks.push(task)
    await writeTasks(server.redis, key, tasks)

    publishTaskWs(server, userId, 'task-dispatch', {
      type: 'task-dispatch',
      taskId: task.id,
      payload: task,
    })

    const response: TaskDispatchResponse = { task }
    return reply.status(201).send(success(response))
  })

  // POST /tasks/result — 回传结果(更新状态 + WS 推送到 task-result 频道)
  server.post('/tasks/result', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = resultSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const { taskId, status, output, error: taskError } = parsed.data
    const key = userKey(userId)
    const tasks = await readTasks(server.redis, key)
    const idx = tasks.findIndex((t) => t.id === taskId)
    if (idx < 0) {
      return reply.status(404).send(error(404, '任务不存在'))
    }

    const finishedAt = new Date().toISOString()
    const result: TaskResult = {
      taskId,
      status,
      output,
      error: taskError,
      finishedAt,
    }
    const task = tasks[idx]!
    task.status = status
    task.result = result
    task.updatedAt = finishedAt
    await writeTasks(server.redis, key, tasks)

    publishTaskWs(server, userId, 'task-result', {
      type: 'task-result',
      taskId,
      payload: result,
    })

    return reply.send(success({ task }))
  })

  // GET /tasks — 列出用户任务(支持 ?since=<timestamp> 增量拉取,2026-07-23 立)
  // 不传 since 时返回全量;传 since 时返回 updatedAt > since 的任务(用于 WS 重连后补拉断线期间错过的任务)
  server.get('/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = sinceSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const since = parsed.data.since

    const key = userKey(userId)
    const allTasks = await readTasks(server.redis, key)
    const tasks =
      since !== undefined
        ? allTasks.filter((t) => Date.parse(t.updatedAt) > since)
        : allTasks
    return reply.send(success({ tasks, total: tasks.length }))
  })

  // POST /tasks/:id/cancel — 取消任务(2026-07-23 立,P0 跨端任务取消)
  // 鉴权:复用 authenticate preHandler。
  // 校验:task 存在 + 属于当前用户 + 状态 ∈ {pending, running}(否则 409)。
  // 执行:更新 status=cancelled + updatedAt=now + WS 推送 task-cancelled:<userId> 消息。
  server.post<{ Params: { id: string } }>(
    '/tasks/:id/cancel',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      const userId = request.userId!
      const { id: taskId } = request.params

      const parsed = cancelSchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        return reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const key = userKey(userId)
      const tasks = await readTasks(server.redis, key)
      const idx = tasks.findIndex((t) => t.id === taskId)
      if (idx < 0) {
        return reply.status(404).send(error(404, '任务不存在'))
      }

      const task = tasks[idx]!
      // 仅 pending / running 可取消;completed/failed/cancelled 返回 409
      if (task.status !== 'pending' && task.status !== 'running') {
        return reply.status(409).send(error(409, `任务已处于 ${task.status} 状态,无法取消`))
      }

      const now = new Date().toISOString()
      task.status = 'cancelled'
      task.updatedAt = now
      await writeTasks(server.redis, key, tasks)

      // WS 推送 task-cancelled:<userId> 消息:taskId + 携带发起方设备标识(fromDevice)
      publishTaskWs(server, userId, 'task-cancelled', {
        type: 'task-cancelled',
        taskId,
        deviceId: task.fromDevice,
        payload: task,
      })

      const response: TaskCancelResponse = { task }
      return reply.send(success(response))
    },
  )

  // POST /tasks/register-device — 设备上线注册/心跳刷新(Hash 结构 + 60s TTL)
  server.post(
    '/tasks/register-device',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!(await checkAuth(request, reply))) return
      const userId = request.userId!

      const parsed = registerSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const { deviceId, name, type } = parsed.data
      const now = new Date().toISOString()
      const device: TaskDevice = {
        deviceId,
        name,
        type,
        lastSeen: now,
        online: true,
      }

      const key = deviceKey(userId)
      await writeDevice(server.redis, key, device)

      const response: TaskDeviceRegisterResponse = { device }
      return reply.status(201).send(success(response))
    },
  )

  // DELETE /tasks/devices/:deviceId — 设备下线清理
  server.delete<{ Params: { deviceId: string } }>(
    '/tasks/devices/:deviceId',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      const userId = request.userId!

      const { deviceId } = request.params
      const key = deviceKey(userId)
      await removeDevice(server.redis, key, deviceId)

      return reply.send(success({ removed: true }))
    },
  )

  // GET /tasks/devices — 返回真实在线设备列表(lastSeen >60s 标记为 offline 但仍返回)
  server.get('/tasks/devices', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const key = deviceKey(userId)
    const deviceMap = await readDevices(server.redis, key)
    const now = Date.now()
    const devices: TaskDevice[] = []
    for (const device of deviceMap.values()) {
      const lastSeenMs = Date.parse(device.lastSeen)
      const isOnline =
        !Number.isNaN(lastSeenMs) && now - lastSeenMs <= DEVICE_ONLINE_TTL_MS
      devices.push({ ...device, online: isOnline })
    }

    const response: TaskDeviceListResponse = {
      devices,
      total: devices.length,
    }
    return reply.send(success(response))
  })
}
