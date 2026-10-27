// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 终端 REST 路由 — PTY session CRUD。
 *
 * 路径(在 server.ts 用 prefix:'/api' 注册 → /api/terminal/*):
 *   GET    /terminal/sessions           — 列出当前用户的 session
 *   POST   /terminal/sessions           — 创建新 session(spawn PTY)
 *   POST   /terminal/sessions/:id/resize — 调整 PTY 大小
 *   DELETE /terminal/sessions/:id        — 关闭/杀死 session
 *   GET    /terminal/sessions/history   — 列出最近 7 天历史会话(Redis terminal:session:*)
 *   GET    /terminal/sessions/:id/scrollback — 读取会话 scrollback 历史(Redis terminal:scrollback:*)
 *
 * 鉴权:所有端点用 authenticate(JWT),复用 v1-apply-diff.ts 模式。
 * 限额:单用户最多 5 个并发 session,超出返回 403。
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import {
  createSession,
  listSessions,
  resizeSession,
  closeSession,
  listHistorySessions,
  getScrollback,
} from '../services/terminal-service.js'

export const terminalRoutes: FastifyPluginAsync = async (server) => {
  // 鉴权 helper(同 v1-apply-diff.ts 模式)
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || '操作失败,请稍后重试'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  /**
   * 本地终端访问闸(2026-10-27 加固)。
   *
   * POST /terminal/sessions 起的是**这台服务器上的一个真 shell**(getDefaultShell ⇒
   * cmd/pwsh),而原实现只判 authenticate:任意注册账号拿到一枚 JWT 就能在生产机上执行
   * 任意命令。现默认只放行管理员;自托管部署确实要把终端开给登录用户时,显式设
   * `IHUI_TERMINAL_LOCAL_ENABLED=1`(届时退回 requireAuth 语义,而不是悄悄放开)。
   */
  const requireTerminalAccess = async (request: FastifyRequest, reply: FastifyReply) => {
    if (process.env.IHUI_TERMINAL_LOCAL_ENABLED === '1') {
      await requireAuth(request, reply)
      return
    }
    await requireAdmin(request, reply)
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

  // POST /terminal/sessions — 创建新 session(默认仅管理员,理由见 requireTerminalAccess 头注)
  server.post('/terminal/sessions', async (request, reply) => {
    await requireTerminalAccess(request, reply)
    if (reply.sent) return
    if (!request.userId) return

    const parsed = createSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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

  // GET /terminal/sessions/history — 列出最近 7 天历史会话(Redis terminal:session:* 元数据)
  server.get('/terminal/sessions/history', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const sessions = await listHistorySessions(request.userId)
    return reply.send(success({ sessions }))
  })

  // GET /terminal/recordings — 终端录制列表(G-962 B8;web use-terminal-session 读 data.recordings)
  // 数据源待接:库内无终端录制表,服务层也只有内存会话 + Redis scrollback,无录制产物。
  // 这里返回真实空态,不伪造录制记录。
  server.get('/terminal/recordings', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    return reply.send(success({ recordings: [] }))
  })

  // GET /terminal/sessions/:id/scrollback — 读取会话 scrollback 历史(Redis,降级返回空)
  server.get('/terminal/sessions/:id/scrollback', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    const { lines, source } = await getScrollback(id, request.userId)
    return reply.send(success({ lines, source }))
  })
}

export default terminalRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
