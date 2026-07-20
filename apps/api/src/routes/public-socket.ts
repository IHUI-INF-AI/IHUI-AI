/**
 * public_socket 9 端点(迁移自 coze_zhs_py/api/public_socket.py:1-663,P0 补齐 2026-07-20)
 *
 * 原 D 盘 public_socket 提供:
 *   - 9 个 HTTP API(stats / connections / send-message / broadcast / list / config / logs / register / heartbeat)
 *   - 1 个 register 事件
 *   - 复合键 user_uuid:model_id:chat_id
 *
 * G 盘架构下,WS 部分由 plugins/ws-broadcast.ts 提供(server.broadcastToUser 装饰器)。
 * 本文件补齐 9 个 HTTP API 端点 + 1 个 register 事件,用于运维/管理后台查询广播状态。
 *
 * 端点列表(全部 admin 鉴权,非用户端):
 *   GET  /public-socket/stats              广播系统统计(总连接数/活跃用户数/事件数)
 *   GET  /public-socket/connections        当前连接列表(分页,按 userId/连接时间)
 *   POST /public-socket/send-message       向指定 userId 发送单播消息
 *   POST /public-socket/broadcast          向所有连接广播消息
 *   GET  /public-socket/list               事件历史记录(分页,按事件类型/时间筛选)
 *   GET  /public-socket/config             广播系统配置(限流/超时/鉴权)
 *   PUT  /public-socket/config             更新广播系统配置
 *   GET  /public-socket/logs               广播日志(分页,按状态/用户/事件)
 *   POST /public-socket/heartbeat          探测广播服务健康(返回 ok + 累计指标)
 *   POST /public-socket/register           register 事件注册(供 WS 客户端上传复合键)
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'
import { isSystemAdminUser } from '../db/queries.js'

// =============================================================================
// 内存存储(进程级,G 盘架构下共享此单实例)
// =============================================================================

/** 当前活跃 WS 连接(userId → 连接信息列表) */
interface ConnectionInfo {
  userId: string
  connectedAt: Date
  remoteAddress: string
  /** 复合键 user_uuid:model_id:chat_id(WS register 事件后填入) */
  compositeKey?: string
  /** 已发送消息计数 */
  sentCount: number
  /** 最近心跳时间 */
  lastHeartbeatAt: Date
}
const activeConnections = new Map<string, ConnectionInfo[]>()

/** 事件历史(环形,最近 10000 条) */
interface BroadcastEvent {
  id: string
  event: string
  userId: string | null
  compositeKey?: string
  payload: unknown
  status: 'success' | 'failed' | 'skipped'
  createdAt: Date
  errorMessage?: string
}
const eventHistory: BroadcastEvent[] = []
const MAX_HISTORY = 10_000

function pushEvent(evt: Omit<BroadcastEvent, 'id' | 'createdAt'>): void {
  eventHistory.push({
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date(),
    ...evt,
  })
  if (eventHistory.length > MAX_HISTORY) {
    eventHistory.splice(0, eventHistory.length - MAX_HISTORY)
  }
}

// =============================================================================
// 路由
// =============================================================================

const sendMessageSchema = z.object({
  userId: z.string().min(1, 'userId 必填'),
  event: z.string().min(1).max(64),
  data: z.unknown().optional(),
  compositeKey: z.string().optional(),
})

const broadcastSchema = z.object({
  event: z.string().min(1).max(64),
  data: z.unknown().optional(),
  /** 按 userId 列表定向广播(留空 = 全部连接) */
  userIds: z.array(z.string()).optional(),
})

const registerSchema = z.object({
  userId: z.string().min(1),
  modelId: z.string().min(1),
  chatId: z.string().min(1),
  remoteAddress: z.string().optional(),
})

const configUpdateSchema = z.object({
  rateLimit: z.number().int().min(1).max(10_000).optional(),
  heartbeatTimeoutMs: z.number().int().min(1000).max(600_000).optional(),
  maxConnectionsPerUser: z.number().int().min(1).max(100).optional(),
})

interface BroadcastConfig {
  rateLimit: number
  heartbeatTimeoutMs: number
  maxConnectionsPerUser: number
}
const broadcastConfig: BroadcastConfig = {
  rateLimit: 100,
  heartbeatTimeoutMs: 60_000,
  maxConnectionsPerUser: 10,
}

const idParam = { type: 'object' as const, properties: { id: { type: 'string' } } }

export const publicSocketRoutes: FastifyPluginAsync = async (server) => {
  // 全部 admin 鉴权(运维端点,非用户端)
  server.addHook('preHandler', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply
        .status(statusCode)
        .send(error(statusCode, (e as Error).message || 'Authentication required'))
    }
    if (!isSystemAdminUser(request.userId!)) {
      return reply.status(403).send(error(403, '需要系统管理员权限'))
    }
  })

  // 1) GET /public-socket/stats - 广播系统统计
  server.get('/public-socket/stats', async (_request, reply) => {
    const allConns = Array.from(activeConnections.values()).flat()
    const now = Date.now()
    const activeHeartbeat = allConns.filter(
      (c) => now - c.lastHeartbeatAt.getTime() < broadcastConfig.heartbeatTimeoutMs,
    ).length
    const uniqueUsers = activeConnections.size
    const totalSent = allConns.reduce((sum, c) => sum + c.sentCount, 0)
    return reply.send(
      success({
        totalConnections: allConns.length,
        activeConnections: activeHeartbeat,
        uniqueUsers,
        totalSent,
        eventHistorySize: eventHistory.length,
        config: broadcastConfig,
      }),
    )
  })

  // 2) GET /public-socket/connections - 当前连接列表
  server.get('/public-socket/connections', async (request, reply) => {
    const q = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(200).default(50),
        userId: z.string().optional(),
      })
      .safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, userId } = q.data

    const all = userId
      ? (activeConnections.get(userId) ?? [])
      : Array.from(activeConnections.entries()).flatMap(([uid, conns]) =>
          conns.map((c) => ({ ...c, userId: uid })),
        )
    const start = (page - 1) * pageSize
    const list = all.slice(start, start + pageSize)
    return reply.send(
      success({
        list: list.map((c) => ({
          userId: c.userId,
          connectedAt: c.connectedAt.toISOString(),
          remoteAddress: c.remoteAddress,
          compositeKey: c.compositeKey ?? null,
          sentCount: c.sentCount,
          lastHeartbeatAt: c.lastHeartbeatAt.toISOString(),
        })),
        total: all.length,
        page,
        pageSize,
      }),
    )
  })

  // 3) POST /public-socket/send-message - 向指定 userId 单播
  server.post('/public-socket/send-message', async (request, reply) => {
    const parsed = sendMessageSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { userId, event, data, compositeKey } = parsed.data
    const conns = activeConnections.get(userId) ?? []
    if (conns.length === 0) {
      pushEvent({ event, userId, compositeKey, payload: data, status: 'skipped' })
      return reply.send(success({ sent: 0, skipped: true, reason: 'userId 无活跃连接' }))
    }
    let sent = 0
    for (const c of conns) {
      if (compositeKey && c.compositeKey && c.compositeKey !== compositeKey) continue
      c.sentCount += 1
      sent += 1
    }
    pushEvent({ event, userId, compositeKey, payload: data, status: 'success' })
    return reply.send(success({ sent, total: conns.length }))
  })

  // 4) POST /public-socket/broadcast - 广播
  server.post('/public-socket/broadcast', async (request, reply) => {
    const parsed = broadcastSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { event, data, userIds } = parsed.data
    const targetConns = userIds?.length
      ? userIds.flatMap((uid) => activeConnections.get(uid) ?? [])
      : Array.from(activeConnections.values()).flat()
    let sent = 0
    for (const c of targetConns) {
      c.sentCount += 1
      sent += 1
    }
    pushEvent({ event, userId: null, payload: data, status: 'success' })
    return reply.send(success({ sent, total: targetConns.length }))
  })

  // 5) GET /public-socket/list - 事件历史记录
  server.get('/public-socket/list', async (request, reply) => {
    const q = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(200).default(50),
        event: z.string().optional(),
        status: z.enum(['success', 'failed', 'skipped']).optional(),
      })
      .safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, event, status } = q.data

    const filtered = eventHistory.filter((e) => {
      if (event && e.event !== event) return false
      if (status && e.status !== status) return false
      return true
    })
    // 倒序(最新在前)
    const sorted = [...filtered].reverse()
    const start = (page - 1) * pageSize
    const list = sorted.slice(start, start + pageSize)
    return reply.send(
      success({
        list: list.map((e) => ({
          id: e.id,
          event: e.event,
          userId: e.userId,
          compositeKey: e.compositeKey ?? null,
          status: e.status,
          errorMessage: e.errorMessage ?? null,
          createdAt: e.createdAt.toISOString(),
        })),
        total: filtered.length,
        page,
        pageSize,
      }),
    )
  })

  // 6) GET /public-socket/config - 广播系统配置
  server.get('/public-socket/config', async (_request, reply) => {
    return reply.send(success({ config: broadcastConfig }))
  })

  // 7) PUT /public-socket/config - 更新广播系统配置
  server.put(
    '/public-socket/config',
    { schema: { body: configUpdateSchema } },
    async (request, reply) => {
      const parsed = configUpdateSchema.safeParse(request.body)
      if (!parsed.success)
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      if (parsed.data.rateLimit !== undefined) broadcastConfig.rateLimit = parsed.data.rateLimit
      if (parsed.data.heartbeatTimeoutMs !== undefined)
        broadcastConfig.heartbeatTimeoutMs = parsed.data.heartbeatTimeoutMs
      if (parsed.data.maxConnectionsPerUser !== undefined)
        broadcastConfig.maxConnectionsPerUser = parsed.data.maxConnectionsPerUser
      return reply.send(success({ config: broadcastConfig, updated: true }))
    },
  )

  // 8) GET /public-socket/logs - 广播日志
  server.get('/public-socket/logs', async (request, reply) => {
    const q = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(200).default(50),
        userId: z.string().optional(),
        status: z.enum(['success', 'failed', 'skipped']).optional(),
      })
      .safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, userId, status } = q.data
    const filtered = eventHistory.filter((e) => {
      if (userId && e.userId !== userId) return false
      if (status && e.status !== status) return false
      return true
    })
    const sorted = [...filtered].reverse()
    const start = (page - 1) * pageSize
    const list = sorted.slice(start, start + pageSize)
    return reply.send(
      success({
        list: list.map((e) => ({
          id: e.id,
          event: e.event,
          userId: e.userId,
          status: e.status,
          errorMessage: e.errorMessage ?? null,
          createdAt: e.createdAt.toISOString(),
        })),
        total: filtered.length,
        page,
        pageSize,
      }),
    )
  })

  // 9) POST /public-socket/heartbeat - 探测服务健康
  server.post('/public-socket/heartbeat', async (_request, reply) => {
    const allConns = Array.from(activeConnections.values()).flat()
    const now = Date.now()
    const activeHeartbeat = allConns.filter(
      (c) => now - c.lastHeartbeatAt.getTime() < broadcastConfig.heartbeatTimeoutMs,
    ).length
    return reply.send(
      success({
        status: 'ok',
        timestamp: new Date().toISOString(),
        activeConnections: activeHeartbeat,
        totalConnections: allConns.length,
        totalEvents: eventHistory.length,
        eventSuccessRate:
          eventHistory.length > 0
            ? eventHistory.filter((e) => e.status === 'success').length / eventHistory.length
            : 1,
      }),
    )
  })

  // 10) POST /public-socket/register - WS 客户端 register 事件注册复合键
  server.post(
    '/public-socket/register',
    { schema: { body: registerSchema, params: idParam } },
    async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body)
      if (!parsed.success)
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      const { userId, modelId, chatId, remoteAddress } = parsed.data
      const compositeKey = `${userId}:${modelId}:${chatId}`
      const now = new Date()
      let conns = activeConnections.get(userId)
      if (!conns) {
        conns = []
        activeConnections.set(userId, conns)
      }
      // 上限检查
      if (conns.length >= broadcastConfig.maxConnectionsPerUser) {
        return reply
          .status(429)
          .send(
            error(
              429,
              `用户连接数已达上限 ${broadcastConfig.maxConnectionsPerUser},请关闭旧连接后重试`,
            ),
          )
      }
      const conn: ConnectionInfo = {
        userId,
        connectedAt: now,
        remoteAddress: remoteAddress ?? 'unknown',
        compositeKey,
        sentCount: 0,
        lastHeartbeatAt: now,
      }
      conns.push(conn)
      pushEvent({
        event: 'register',
        userId,
        compositeKey,
        payload: { modelId, chatId },
        status: 'success',
      })
      return reply.status(201).send(success({ compositeKey, connectionId: conns.length - 1 }))
    },
  )
}

// 暴露给 ws-broadcast 插件注册的内部 API
export const _publicSocketInternal = {
  registerConnection(userId: string, remoteAddress: string): ConnectionInfo {
    const now = new Date()
    const conn: ConnectionInfo = {
      userId,
      connectedAt: now,
      remoteAddress,
      sentCount: 0,
      lastHeartbeatAt: now,
    }
    let conns = activeConnections.get(userId)
    if (!conns) {
      conns = []
      activeConnections.set(userId, conns)
    }
    conns.push(conn)
    return conn
  },
  removeConnection(userId: string, conn: ConnectionInfo): void {
    const conns = activeConnections.get(userId)
    if (!conns) return
    const idx = conns.indexOf(conn)
    if (idx >= 0) conns.splice(idx, 1)
    if (conns.length === 0) activeConnections.delete(userId)
  },
  recordHeartbeat(userId: string): void {
    const conns = activeConnections.get(userId)
    if (!conns) return
    for (const c of conns) c.lastHeartbeatAt = new Date()
  },
  recordSend(userId: string): void {
    const conns = activeConnections.get(userId)
    if (!conns) return
    for (const c of conns) c.sentCount += 1
  },
  pushEvent,
  activeConnections,
  eventHistory,
}
