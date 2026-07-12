/**
 * SRS 媒体服务器路由 (迁移自旧架构 main.py + services/srs_manager.py)。
 *
 * 端点：
 * - GET    /srs/streams          — 流列表
 * - GET    /srs/streams/:key     — 流详情
 * - POST   /srs/streams          — 创建流（生成推流密钥+URL）
 * - PUT    /srs/streams/:id      — 更新流信息
 * - DELETE /srs/streams/:id     — 删除流
 * - POST   /srs/streams/:key/kick — 踢出推流
 * - GET    /srs/streams/:key/status — 查询 SRS 实时流状态
 * - GET    /srs/servers          — SRS 服务器列表
 * - POST   /srs/servers          — 添加 SRS 服务器
 * - PUT    /srs/servers/:id      — 更新 SRS 服务器
 * - DELETE /srs/servers/:id      — 删除 SRS 服务器
 * - GET    /srs/servers/:id/health — 健康检查
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { srsStreams, srsServers } from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import {
  createStream,
  getActiveServer,
  getStreamStatusFromSRS,
  kickStream,
  healthCheckServer,
} from '../services/srs-service.js'

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

const createStreamSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  channelId: z.string().uuid().optional(),
})

const updateStreamSchema = z.object({
  title: z.string().max(200).optional(),
  status: z.enum(['active', 'inactive', 'banned']).optional(),
  channelId: z.string().uuid().optional(),
})

const createServerSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().min(1).max(255),
  rtmpPort: z.number().int().min(1).max(65535).default(1935),
  httpPort: z.number().int().min(1).max(65535).default(8080),
  webrtcPort: z.number().int().min(1).max(65535).default(1985),
  apiPort: z.number().int().min(1).max(65535).default(1985),
  apiSecret: z.string().max(256).optional(),
  maxStreams: z.number().int().min(1).default(100),
  healthCheckUrl: z.string().max(500).optional(),
})

const updateServerSchema = createServerSchema.partial()

export const srsRoutes: FastifyPluginAsync = async (server) => {
  // ===== 流管理 =====

  server.get('/streams', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const query = request.query as { status?: string; page?: string; pageSize?: string }
    const page = parseInt(query.page ?? '1', 10)
    const pageSize = parseInt(query.pageSize ?? '20', 10)
    const offset = (page - 1) * pageSize
    const condition = query.status ? eq(srsStreams.status, query.status) : undefined
    const list = await db
      .select()
      .from(srsStreams)
      .where(condition ?? eq(srsStreams.id, srsStreams.id))
      .orderBy(desc(srsStreams.createdAt))
      .limit(pageSize)
      .offset(offset)
    return reply.send(success({ list, page, pageSize }))
  })

  server.get('/streams/:key', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { key } = request.params as { key: string }
    const [stream] = await db
      .select()
      .from(srsStreams)
      .where(eq(srsStreams.streamKey, key))
      .limit(1)
    if (!stream) return reply.status(404).send(error(404, '流不存在'))
    return reply.send(success(stream))
  })

  server.post('/streams', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = createStreamSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { stream } = await createStream(parsed.data)
    return reply.status(201).send(success(stream))
  })

  server.put('/streams/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const { id } = request.params as { id: string }
    const parsed = updateStreamSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [stream] = await db
      .update(srsStreams)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(srsStreams.id, id))
      .returning()
    if (!stream) return reply.status(404).send(error(404, '流不存在'))
    return reply.send(success(stream))
  })

  server.delete('/streams/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const { id } = request.params as { id: string }
    await db.delete(srsStreams).where(eq(srsStreams.id, id))
    return reply.send(success({ deleted: true }))
  })

  server.post('/streams/:key/kick', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const { key } = request.params as { key: string }
    const srv = await getActiveServer()
    if (!srv) return reply.status(503).send(error(503, '无可用 SRS 服务器'))
    const kicked = await kickStream(srv, key)
    if (kicked) {
      await db
        .update(srsStreams)
        .set({ status: 'inactive', endTime: new Date(), updatedAt: new Date() })
        .where(eq(srsStreams.streamKey, key))
    }
    return reply.send(success({ kicked, streamKey: key }))
  })

  server.get('/streams/:key/status', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { key } = request.params as { key: string }
    const srv = await getActiveServer()
    if (!srv) return reply.status(503).send(error(503, '无可用 SRS 服务器'))
    const status = await getStreamStatusFromSRS(srv, key)
    return reply.send(success({ streamKey: key, srsStatus: status }))
  })

  // ===== SRS 服务器管理 =====

  server.get('/servers', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const list = await db.select().from(srsServers).orderBy(desc(srsServers.createdAt))
    return reply.send(success(list))
  })

  server.post('/servers', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createServerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [srv] = await db.insert(srsServers).values(parsed.data).returning()
    return reply.status(201).send(success(srv))
  })

  server.put('/servers/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const { id } = request.params as { id: string }
    const parsed = updateServerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [srv] = await db
      .update(srsServers)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(srsServers.id, id))
      .returning()
    if (!srv) return reply.status(404).send(error(404, '服务器不存在'))
    return reply.send(success(srv))
  })

  server.delete('/servers/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const { id } = request.params as { id: string }
    await db.delete(srsServers).where(eq(srsServers.id, id))
    return reply.send(success({ deleted: true }))
  })

  server.get('/servers/:id/health', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { id } = request.params as { id: string }
    const [srv] = await db.select().from(srsServers).where(eq(srsServers.id, id)).limit(1)
    if (!srv) return reply.status(404).send(error(404, '服务器不存在'))
    const result = await healthCheckServer(srv)
    await db
      .update(srsServers)
      .set({
        status: result.healthy ? 'online' : 'offline',
        lastHealthCheck: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(srsServers.id, id))
    return reply.send(
      success({ ...result, serverId: id, status: result.healthy ? 'online' : 'offline' }),
    )
  })
}
