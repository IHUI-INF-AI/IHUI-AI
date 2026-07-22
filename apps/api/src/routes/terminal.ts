/**
 * 终端 REST 路由 — PTY session CRUD。
 *
 * 路径(在 server.ts 用 prefix:'/api' 注册 → /api/terminal/*):
 *   GET    /terminal/sessions           — 列出当前用户的 session
 *   POST   /terminal/sessions           — 创建新 session(spawn PTY)
 *   POST   /terminal/sessions/:id/resize — 调整 PTY 大小
 *   DELETE /terminal/sessions/:id        — 关闭/杀死 session
 *
 * 鉴权:所有端点用 authenticate(JWT),复用 v1-apply-diff.ts 模式。
 * 限额:单用户最多 5 个并发 session,超出返回 403。
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import {
  createSession,
  listSessions,
  resizeSession,
  closeSession,
} from '../services/terminal-service.js'

export const terminalRoutes: FastifyPluginAsync = async (server) => {
  // 鉴权 helper(同 v1-apply-diff.ts 模式)
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  const createSchema = z.object({
    cwd: z.string().optional(),
    cols: z.number().int().min(1).max(500).optional(),
    rows: z.number().int().min(1).max(200).optional(),
  })

  const resizeSchema = z.object({
    cols: z.number().int().min(1).max(500),
    rows: z.number().int().min(1).max(200),
  })

  // GET /terminal/sessions — 列出当前用户的 session
  server.get('/terminal/sessions', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const sessions = listSessions(request.userId)
    return reply.send(success({ sessions }))
  })

  // POST /terminal/sessions — 创建新 session
  server.post('/terminal/sessions', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = createSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const session = createSession(request.userId, parsed.data)
      return reply.send(success({ session }))
    } catch (e) {
      const msg = (e as Error).message
      // 超限额返回 403,其他返回 400
      if (msg.includes('超过最大并发')) {
        return reply.status(403).send(error(403, msg))
      }
      return reply.status(400).send(error(400, msg))
    }
  })

  // POST /terminal/sessions/:id/resize — 调整 PTY 大小
  server.post('/terminal/sessions/:id/resize', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    const parsed = resizeSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const ok = resizeSession(id, request.userId, parsed.data.cols, parsed.data.rows)
    if (!ok) {
      return reply.status(404).send(error(404, '终端会话不存在或已关闭'))
    }
    return reply.send(success({ resized: true }))
  })

  // DELETE /terminal/sessions/:id — 关闭/杀死 session
  server.delete('/terminal/sessions/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    const ok = closeSession(id, request.userId)
    if (!ok) {
      return reply.status(404).send(error(404, '终端会话不存在或已关闭'))
    }
    return reply.send(success({ closed: true }))
  })
}

export default terminalRoutes
