/**
 * 前端用户端缺失路由补建（54 个路由）。
 *
 * 来源：前端调用但后端完全未实现的 /api/* 用户端路径（非 /api/admin/*）。
 *
 * 策略：全部使用空数据桩，前端可正常渲染空列表/空对象。
 *
 * 所有路由：
 * - 使用 authenticate 中间件（用户端需要登录）
 * - 响应格式统一 { code, message, data }
 * - 列表接口支持分页（page/pageSize）+ 模糊搜索（search）
 *
 * 注意：GET /api/notifications（列表）和 POST /api/notifications/read-all
 * 已在 notifications.ts 中实现，此处不再重复注册。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

const idParamSchema = z.object({ id: z.string() })

/** 空列表响应 */
function emptyList(page: number, pageSize: number) {
  return success({ list: [], total: 0, page, pageSize })
}

/** 解析分页参数，失败返回 null 并发送 400 */
function parsePagination(request: FastifyRequest, reply: FastifyReply) {
  const parsed = paginationSchema.safeParse(request.query)
  if (!parsed.success) {
    reply.status(400).send(error(400, '参数错误'))
    return null
  }
  return parsed.data
}

/** 解析 id 路径参数，失败返回 null 并发送 400 */
function parseIdParam(request: FastifyRequest, reply: FastifyReply) {
  const parsed = idParamSchema.safeParse(request.params)
  if (!parsed.success) {
    reply.status(400).send(error(400, '参数错误'))
    return null
  }
  return parsed.data.id
}

export const missingUserRoutes: FastifyPluginAsync = async (server) => {
  // 所有路由都需要登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      reply
        .status(statusCode)
        .send(error(statusCode, (e as Error).message || 'Authentication required'))
    }
  })

  // ===========================================================================
  // 1. 文章模块 /article/*（9 个端点）
  // ===========================================================================
  server.get('/article/list', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  server.get('/article/detail/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ article: null }))
  })

  server.get('/article/hot', async (_request, reply) => {
    return reply.send(success({ list: [] }))
  })

  server.get('/article/essence', async (_request, reply) => {
    return reply.send(success({ list: [] }))
  })

  server.get('/article/categories', async (_request, reply) => {
    return reply.send(success({ list: [] }))
  })

  server.get('/article/my', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  server.post('/article/publish', async (_request, reply) => {
    return reply.status(201).send(success({ success: true }))
  })

  server.post('/article/like', async (_request, reply) => {
    return reply.send(success({ success: true }))
  })

  server.post('/article/favorite', async (_request, reply) => {
    return reply.send(success({ success: true }))
  })

  // ===========================================================================
  // 2. 内容生成 /content-generation/*（3 个端点）
  // ===========================================================================
  server.post('/content-generation/generate', async (_request, reply) => {
    return reply.send(success({ content: '', taskId: null }))
  })

  server.get('/content-generation/history', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  server.get('/content-generation/templates', async (_request, reply) => {
    return reply.send(success({ list: [] }))
  })

  // ===========================================================================
  // 3. 知识库 /knowledge/*（3 个端点）
  // ===========================================================================
  server.get('/knowledge', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  server.get('/knowledge/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ knowledge: null }))
  })

  server.post('/knowledge/:id/like', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ success: true }))
  })

  // ===========================================================================
  // 4. 技能 /skills/*（2 个端点）
  // ===========================================================================
  server.get('/skills', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  server.get('/skills/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ skill: null }))
  })

  // ===========================================================================
  // 5. 学习记录 /study/*（4 个端点）
  // ===========================================================================
  server.get('/study/records', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  server.get('/study/records/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ record: null }))
  })

  server.get('/study/progress', async (_request, reply) => {
    return reply.send(success({ progress: 0, totalCourses: 0, completedCourses: 0 }))
  })

  server.get('/study/statistics', async (_request, reply) => {
    return reply.send(success({ totalHours: 0, totalCourses: 0, totalLessons: 0, streak: 0 }))
  })

  // ===========================================================================
  // 6. MCP /mcp/*（3 个端点）
  // ===========================================================================
  server.get('/mcp', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  server.get('/mcp/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ mcp: null }))
  })

  server.post('/mcp/invoke', async (_request, reply) => {
    return reply.send(success({ result: null }))
  })

  // ===========================================================================
  // 7. OpenClaw /openclaw/*（2 个端点）
  // ===========================================================================
  server.get('/openclaw', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  server.get('/openclaw/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ openclaw: null }))
  })

  // ===========================================================================
  // 8. 代理类 /luyala-proxy/* 和 /openrouter-proxy/*（4 个端点）
  // ===========================================================================
  server.post('/luyala-proxy/chat/completions', async (_request, reply) => {
    return reply.send(
      success({
        id: 'chatcmpl-stub',
        object: 'chat.completion',
        choices: [],
      }),
    )
  })

  server.post('/luyala-proxy/video/create', async (_request, reply) => {
    return reply.send(success({ taskId: null, status: 'pending' }))
  })

  server.post('/openrouter-proxy/chat/completions', async (_request, reply) => {
    return reply.send(
      success({
        id: 'chatcmpl-stub',
        object: 'chat.completion',
        choices: [],
      }),
    )
  })

  server.get('/openrouter-proxy/models', async (_request, reply) => {
    return reply.send(success({ data: [] }))
  })

  // ===========================================================================
  // 9. 用户设置 /settings/*（8 个端点）
  // ===========================================================================
  server.get('/settings/notifications', async (_request, reply) => {
    return reply.send(success({ settings: {} }))
  })

  server.get('/settings/privacy', async (_request, reply) => {
    return reply.send(success({ settings: {} }))
  })

  server.get('/settings/preferences', async (_request, reply) => {
    return reply.send(success({ settings: {} }))
  })

  server.get('/settings/devices', async (_request, reply) => {
    return reply.send(success({ list: [] }))
  })

  server.get('/settings/security-logs', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  server.get('/settings/export', async (_request, reply) => {
    return reply.send(success({ url: null, exportedAt: null }))
  })

  server.post('/settings/clear-data', async (_request, reply) => {
    return reply.send(success({ success: true }))
  })

  server.post('/settings/delete-account', async (_request, reply) => {
    return reply.send(success({ success: true }))
  })

  // ===========================================================================
  // 10. AI 模块补充 /ai/*（6 个端点）
  // ===========================================================================
  server.get('/ai/models', async (_request, reply) => {
    return reply.send(success({ list: [] }))
  })

  server.get('/ai/models/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ model: null }))
  })

  server.get('/ai/careers', async (_request, reply) => {
    return reply.send(success({ list: [] }))
  })

  server.get('/ai/careers/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ career: null }))
  })

  server.get('/ai/chat-types', async (_request, reply) => {
    return reply.send(success({ list: [] }))
  })

  server.get('/ai/community', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  // ===========================================================================
  // 11. 开发者扩展 /developer/*（4 个端点）
  // ===========================================================================
  server.get('/developer/info', async (_request, reply) => {
    return reply.send(success({ developer: null }))
  })

  server.get('/developer/price', async (_request, reply) => {
    return reply.send(success({ list: [] }))
  })

  server.post('/developer/apply', async (_request, reply) => {
    return reply.status(201).send(success({ success: true }))
  })

  server.post('/developer/:id/audit', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ success: true }))
  })

  // ===========================================================================
  // 12. 分销 /commission/*（4 个端点）
  // ===========================================================================
  server.get('/commission/overview', async (_request, reply) => {
    return reply.send(
      success({
        totalCommission: 0,
        availableCommission: 0,
        pendingCommission: 0,
        withdrawnCommission: 0,
      }),
    )
  })

  server.get('/commission/invite-info', async (_request, reply) => {
    return reply.send(success({ inviteCode: null, inviteUrl: null, inviteCount: 0 }))
  })

  server.get('/commission/invited-users', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  server.get('/commission/list', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  // ===========================================================================
  // 13. 其他补充端点
  // ===========================================================================

  // GET /vip/benefits - VIP 权益列表
  server.get('/vip/benefits', async (_request, reply) => {
    return reply.send(success({ list: [] }))
  })

  // GET /coupons - 用户优惠券列表（/api/admin/coupons 已在 promotions.ts admin 中实现）
  server.get('/coupons', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  // GET /notifications/:id - 通知详情
  // （GET /api/notifications 列表 和 POST /api/notifications/read-all 已在 notifications.ts 中实现）
  server.get('/notifications/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ notification: null }))
  })

  // GET /messages/:id - 消息详情
  server.get('/messages/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ message: null }))
  })
}
