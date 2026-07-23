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
} from '@ihui/shared'

const dispatchSchema = z.object({
  toDevice: z.string().min(1).max(100),
  command: z.string().min(1).max(10_000),
})

const resultSchema = z.object({
  taskId: z.string().min(1).max(100),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  output: z.string().max(100_000).optional(),
  error: z.string().max(10_000).optional(),
})

/** Redis 不可用时的进程内降级存储:userId → tasks[] */
const tasksFallback = new Map<string, TaskDispatch[]>()

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

/**
 * 推送 WS 消息:publish 到专用 Redis 频道 + 调用 pushNotification 直推在线客户端。
 * 参考 agent-control.ts 的 server.pushNotification 模式。
 */
function publishTaskWs(
  server: FastifyInstance,
  userId: string,
  channel: 'task-dispatch' | 'task-result',
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

    const { toDevice, command } = parsed.data
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

  // GET /tasks — 列出用户任务
  server.get('/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const key = userKey(userId)
    const tasks = await readTasks(server.redis, key)
    return reply.send(success({ tasks, total: tasks.length }))
  })

  // GET /tasks/devices — 返回在线设备列表
  server.get('/tasks/devices', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    // 尝试从 Redis 读取设备列表,失败则返回硬编码默认值
    const devicesKey = `devices:${userId}`
    let devices: string[] = ['desktop', 'web']
    try {
      const raw = await server.redis.get(devicesKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          devices = parsed as string[]
        }
      }
    } catch {
      /* Redis 不可用,返回默认设备列表 */
    }

    return reply.send(success({ devices }))
  })
}
