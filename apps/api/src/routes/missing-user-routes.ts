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
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { eq, asc, sql } from 'drizzle-orm'
import { authenticate } from '../plugins/auth.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { db } from '../db/index.js'
import { aiModelConfig } from '@ihui/database'
import {
  findMyLessons,
  signUpLesson,
  isSignedUp,
  findSignUp,
  updateProgress,
} from '../db/learn-queries.js'
import {
  findOrderByOrderNo,
  findPaymentByOrderId,
  findRefundById,
  cancelOrder,
  applyRefund,
  processRefund,
  handleRefund,
} from '../db/order-queries.js'
import {
  applyWithdrawal,
  listWithdrawals,
  getWithdrawalById,
  approveWithdrawal,
  rejectWithdrawal,
  withdrawalSummary,
  availableWithdrawal,
  commissionSummary,
  listCommissionFlows,
  listSubordinates,
  teamCenter,
} from '../db/commission-queries.js'
import {
  findPublishedArticles,
  findArticleById,
  incrementArticleViewCount,
  createArticle,
  findPublishedNewsCategories,
  findMyArticles,
} from '../db/news-queries.js'
import { findMessageById } from '../db/chat-queries.js'
import { createCertificate, updateCertificateStatus } from '../db/certificate-queries.js'
import { findResourceById } from '../db/resource-queries.js'
import {
  findPublishedKnowledge,
  findKnowledgeById,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
} from '../db/knowledge-queries.js'
import {
  findPublishedSkills,
  findSkillById,
  createSkill,
  updateSkill,
  deleteSkill,
} from '../db/skills-queries.js'
import {
  findUserPreferences,
  deleteUserPreferencesByGroup,
} from '../db/user-preferences-queries.js'

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
  const orderNoParam = z.object({ orderNo: z.string() })
  const refundNoParam = z.object({ refundNo: z.string() })
  const orderIdParam = z.object({ orderId: z.string() })
  const codeParam = z.object({ code: z.string() })
  const taskIdParam = z.object({ taskId: z.string() })
  const botConversationParam = z.object({ botId: z.string(), conversationId: z.string() })

  // 所有路由都需要登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply
        .status(statusCode)
        .send(error(statusCode, (e as Error).message || 'Authentication required'))
    }
  })

  // ===========================================================================
  // 1. 文章模块 /article/*（9 个端点，其中 7 个真实化，like/favorite 无表保持桩）
  // ===========================================================================
  server.get('/article/list', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findPublishedArticles({
      page: q.page,
      pageSize: q.pageSize,
      search: q.search,
    })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/article/detail/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const article = await findArticleById(id)
    if (article) await incrementArticleViewCount(id)
    return reply.send(success({ article }))
  })

  server.get('/article/hot', async (_request, reply) => {
    const result = await findPublishedArticles({ page: 1, pageSize: 10 })
    return reply.send(success({ list: result.list }))
  })

  server.get('/article/essence', async (_request, reply) => {
    const result = await findPublishedArticles({ page: 1, pageSize: 10 })
    return reply.send(success({ list: result.list }))
  })

  server.get('/article/categories', async (_request, reply) => {
    const list = await findPublishedNewsCategories()
    return reply.send(success({ list }))
  })

  server.get('/article/my', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findMyArticles(request.userId!, { page: q.page, pageSize: q.pageSize })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.post('/article/publish', async (request, reply) => {
    const body =
      (request.body as {
        title?: string
        content?: string
        categoryId?: string
        summary?: string
        coverImage?: string
        isPublished?: boolean
      } | null) ?? {}
    if (!body.title || !body.content)
      return reply.status(400).send(error(400, '标题和内容不能为空'))
    const article = await createArticle({
      title: body.title,
      content: body.content,
      categoryId: body.categoryId,
      summary: body.summary,
      coverImage: body.coverImage,
      authorId: request.userId,
      isPublished: body.isPublished ?? false,
    })
    return reply.status(201).send(success({ success: true, article }))
  })

  // 注: like/favorite 无对应表，保持桩实现
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
    const result = await findPublishedKnowledge({
      page: q.page,
      pageSize: q.pageSize,
      search: q.search,
    })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/knowledge/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const knowledge = await findKnowledgeById(id)
    if (!knowledge) return reply.status(404).send(error(404, '知识库不存在'))
    return reply.send(success({ knowledge }))
  })

  // 注: like 无对应表，保持桩实现
  server.post('/knowledge/:id/like', async (_request, reply) => {
    return reply.send(success({ success: true }))
  })

  // ===========================================================================
  // 4. 技能 /skills/*（2 个端点）
  // ===========================================================================
  server.get('/skills', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findPublishedSkills({
      page: q.page,
      pageSize: q.pageSize,
      search: q.search,
    })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/skills/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const skill = await findSkillById(id)
    if (!skill) return reply.status(404).send(error(404, '技能不存在'))
    return reply.send(success({ skill }))
  })

  // ===========================================================================
  // 5. 学习记录 /study/*（6 个端点）
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

  // POST /study/records - 记录学习（桩实现，前端 LearnRecord 字段与 learnRecord 表结构不匹配，保持桩策略）
  server.post('/study/records', async (request, reply) => {
    const body = z
      .object({
        courseId: z.string().optional(),
        lessonId: z.string().optional(),
        duration: z.number().optional(),
        progress: z.number().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, '参数错误'))
    }
    return reply.status(201).send(
      success({
        record: {
          id: randomUUID(),
          userId: request.userId!,
          courseId: body.data.courseId ?? null,
          lessonId: body.data.lessonId ?? null,
          duration: body.data.duration ?? 0,
          progress: body.data.progress ?? 0,
          status: 'in_progress',
          createdAt: new Date().toISOString(),
        },
      }),
    )
  })

  // PUT /study/records/:id - 更新学习进度（桩实现）
  server.put('/study/records/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = z
      .object({
        progress: z.number().optional(),
        status: z.enum(['in_progress', 'completed', 'paused']).optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, '参数错误'))
    }
    return reply.send(
      success({
        record: {
          id,
          userId: request.userId!,
          progress: body.data.progress ?? 0,
          status: body.data.status ?? 'in_progress',
          updatedAt: new Date().toISOString(),
        },
      }),
    )
  })

  server.get('/study/progress', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findMyLessons(request.userId!, { page: q.page, pageSize: q.pageSize })
    const completed = result.list.filter((l) => l.progress >= 100).length
    return reply.send(
      success({
        progress:
          result.list.length > 0
            ? Math.round(result.list.reduce((s, l) => s + l.progress, 0) / result.list.length)
            : 0,
        totalCourses: result.total,
        completedCourses: completed,
      }),
    )
  })

  server.get('/study/progress/all', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findMyLessons(request.userId!, { page: q.page, pageSize: q.pageSize })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
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
  server.get('/settings/notifications', async (request, reply) => {
    const { list } = await findUserPreferences(request.userId!, 'notifications')
    const settings = Object.fromEntries(list.map((r) => [r.key, r.value]))
    return reply.send(success({ settings }))
  })

  server.get('/settings/privacy', async (request, reply) => {
    const { list } = await findUserPreferences(request.userId!, 'privacy')
    const settings = Object.fromEntries(list.map((r) => [r.key, r.value]))
    return reply.send(success({ settings }))
  })

  server.get('/settings/preferences', async (request, reply) => {
    const { list } = await findUserPreferences(request.userId!, 'preferences')
    const settings = Object.fromEntries(list.map((r) => [r.key, r.value]))
    return reply.send(success({ settings }))
  })

  server.get('/settings/devices', async (request, reply) => {
    const { list, total } = await findUserPreferences(request.userId!, 'devices')
    return reply.send(success({ list, total }))
  })

  // 桩:无 security_logs 表,待后续建表后真实化
  server.get('/settings/security-logs', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  // 桩:无 export 任务表,待后续建表后真实化
  server.get('/settings/export', async (_request, reply) => {
    return reply.send(success({ url: null, exportedAt: null }))
  })

  server.post('/settings/clear-data', async (request, reply) => {
    const userId = request.userId!
    await Promise.all([
      deleteUserPreferencesByGroup(userId, 'notifications'),
      deleteUserPreferencesByGroup(userId, 'privacy'),
      deleteUserPreferencesByGroup(userId, 'devices'),
    ])
    return reply.send(success({ success: true }))
  })

  // 桩:账号删除需级联清理多表,待后续实现事务级联删除
  server.post('/settings/delete-account', async (_request, reply) => {
    return reply.send(success({ success: true }))
  })

  // ===========================================================================
  // 10. AI 模块补充 /ai/*（6 个端点）
  // ===========================================================================
  server.get('/ai/models', async (_request, reply) => {
    const rows = await db
      .select({
        id: aiModelConfig.id,
        name: aiModelConfig.name,
        provider: aiModelConfig.providerCode,
        description: aiModelConfig.description,
        type: aiModelConfig.apiFormat,
        status: sql<number>`CASE WHEN ${aiModelConfig.enabled} THEN 1 ELSE 0 END`,
        sort: aiModelConfig.sortOrder,
        baseUrl: aiModelConfig.baseUrl,
        modelIdForTest: aiModelConfig.modelIdForTest,
      })
      .from(aiModelConfig)
      .where(eq(aiModelConfig.enabled, true))
      .orderBy(asc(aiModelConfig.sortOrder), asc(aiModelConfig.id))
    return reply.send(success({ list: rows }))
  })

  server.get('/ai/models/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [row] = await db
      .select({
        id: aiModelConfig.id,
        name: aiModelConfig.name,
        provider: aiModelConfig.providerCode,
        description: aiModelConfig.description,
        type: aiModelConfig.apiFormat,
        status: sql<number>`CASE WHEN ${aiModelConfig.enabled} THEN 1 ELSE 0 END`,
        sort: aiModelConfig.sortOrder,
        baseUrl: aiModelConfig.baseUrl,
        modelIdForTest: aiModelConfig.modelIdForTest,
      })
      .from(aiModelConfig)
      .where(eq(aiModelConfig.id, Number(id)))
    if (!row) return reply.status(404).send(error(404, '模型不存在'))
    return reply.send(success({ model: row }))
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
  server.get('/commission/overview', async (request, reply) => {
    const userId = request.userId!
    const [summary, withdrawal, available] = await Promise.all([
      commissionSummary(userId, 30),
      withdrawalSummary(userId),
      availableWithdrawal(userId),
    ])
    return reply.send(
      success({
        totalCommission: summary.totalAmount,
        availableCommission: available,
        pendingCommission: withdrawal.pendingAmount,
        withdrawnCommission: withdrawal.totalWithdrawn,
      }),
    )
  })

  server.get('/commission/invite-info', async (request, reply) => {
    const team = await teamCenter(request.userId!)
    return reply.send(
      success({
        inviteCode: null,
        inviteUrl: null,
        inviteCount: team.totalInvitees,
        vipInvitees: team.vipInvitees,
        monthNew: team.monthNew,
      }),
    )
  })

  server.get('/commission/invited-users', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await listSubordinates(request.userId!, q.page, q.pageSize)
    return reply.send(
      success({ list: result.items, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/commission/list', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await listCommissionFlows(request.userId!, q.page, q.pageSize)
    return reply.send(
      success({ list: result.items, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  // ===========================================================================
  // 13. 其他补充端点
  // ===========================================================================

  // GET /vip/benefits - VIP 权益列表
  server.get('/vip/benefits', async (_request, reply) => {
    return reply.send(success({ list: [] }))
  })

  // 注: /coupons 已由 promotions.ts 真实实现,此处不再重复注册空桩

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
    const message = await findMessageById(id)
    return reply.send(success({ message }))
  })

  // ===========================================================================
  // 14. 支付模块 /payment/*, /payments/*, /refunds/*, /top-up/*, /invoices/*（15 个端点）
  // ===========================================================================
  server.post('/payment/order/:orderNo/close', async (request, reply) => {
    const orderNo = orderNoParam.parse(request.params).orderNo
    if (!orderNo) return reply.status(400).send(error(400, '参数错误'))
    const order = await findOrderByOrderNo(orderNo)
    if (!order) return reply.status(404).send(error(404, '订单不存在'))
    const updated = await cancelOrder(order.id)
    return reply.send(success({ success: !!updated, order: updated }))
  })

  server.post('/payment/order/:orderNo/sync', async (request, reply) => {
    const orderNo = orderNoParam.parse(request.params).orderNo
    if (!orderNo) return reply.status(400).send(error(400, '参数错误'))
    const order = await findOrderByOrderNo(orderNo)
    return reply.send(success({ order }))
  })

  server.post('/payment/callback/verify', async (_request, reply) => {
    return reply.send(success({ success: true }))
  })

  server.get('/payment/orders/:orderNo', async (request, reply) => {
    const orderNo = orderNoParam.parse(request.params).orderNo
    if (!orderNo) return reply.status(400).send(error(400, '参数错误'))
    const order = await findOrderByOrderNo(orderNo)
    return reply.send(success({ order }))
  })

  // 注: /payments/me 已由 order.ts 真实实现,此处不再重复注册空桩

  server.get('/payment/refund/:refundNo', async (request, reply) => {
    const refundNo = refundNoParam.parse(request.params).refundNo
    if (!refundNo) return reply.status(400).send(error(400, '参数错误'))
    const refund = await findRefundById(refundNo)
    return reply.send(success({ refund }))
  })

  server.post('/payment/refund/:refundNo/cancel', async (request, reply) => {
    const refundNo = refundNoParam.parse(request.params).refundNo
    if (!refundNo) return reply.status(400).send(error(400, '参数错误'))
    const refund = await processRefund(refundNo, 'rejected', '用户取消')
    return reply.send(success({ success: !!refund, refund }))
  })

  server.get('/payment/refund/:refundNo/status', async (request, reply) => {
    const refundNo = refundNoParam.parse(request.params).refundNo
    if (!refundNo) return reply.status(400).send(error(400, '参数错误'))
    const refund = await findRefundById(refundNo)
    return reply.send(success({ status: refund?.status ?? null }))
  })

  server.post('/payment/refund/:refundNo/audit', async (request, reply) => {
    const refundNo = refundNoParam.parse(request.params).refundNo
    if (!refundNo) return reply.status(400).send(error(400, '参数错误'))
    const body =
      (request.body as { action?: 'approved' | 'rejected'; reason?: string } | null) ?? {}
    const refund = await processRefund(refundNo, body.action ?? 'approved', body.reason ?? null)
    return reply.send(success({ success: !!refund, refund }))
  })

  server.post('/payment/refund/:refundNo/process', async (request, reply) => {
    const refundNo = refundNoParam.parse(request.params).refundNo
    if (!refundNo) return reply.status(400).send(error(400, '参数错误'))
    const body =
      (request.body as {
        status?: 'processing' | 'completed' | 'failed'
        message?: string
      } | null) ?? {}
    const refund = await handleRefund(refundNo, body.status ?? 'processing', body.message ?? null)
    return reply.send(success({ success: !!refund, refund }))
  })

  server.post('/refunds/apply', async (request, reply) => {
    const body =
      (request.body as { orderId?: string; reason?: string; refundType?: string } | null) ?? {}
    if (!body.orderId) return reply.status(400).send(error(400, '缺少订单 id'))
    const result = await applyRefund({
      orderId: body.orderId,
      userId: request.userId!,
      reason: body.reason,
      refundType: body.refundType,
    })
    if (result.reason)
      return reply
        .status(400)
        .send(error(400, result.reason === 'order_not_found' ? '订单不存在' : '订单未支付'))
    return reply.status(201).send(success({ success: true, refund: result.refund }))
  })

  // 注: /refunds/me 已由 order.ts 真实实现,此处不再重复注册空桩

  server.get('/top-up/status/:orderId', async (request, reply) => {
    const orderId = orderIdParam.parse(request.params).orderId
    if (!orderId) return reply.status(400).send(error(400, '参数错误'))
    const payment = await findPaymentByOrderId(orderId)
    return reply.send(success({ status: payment?.status ?? null, payment }))
  })

  // 注: /invoices/applications (GET/POST) 已由 order.ts 真实实现,此处不再重复注册空桩

  // ===========================================================================
  // 15. 提现模块 /finance/withdrawal/*（7 个端点）
  // ===========================================================================
  const withdrawalApplySchema = z.object({
    amount: z.coerce.number().int().positive(),
    method: z.string().min(1),
    accountInfo: z.record(z.unknown()).optional(),
  })

  server.post('/finance/withdrawal/withdrawal', async (request, reply) => {
    const parsed = withdrawalApplySchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, '参数错误'))
    const available = await availableWithdrawal(request.userId!)
    if (available < parsed.data.amount) {
      return reply.status(400).send(error(400, '可提现余额不足'))
    }
    const flow = await applyWithdrawal({
      userId: request.userId!,
      amount: parsed.data.amount,
      method: parsed.data.method,
      accountInfo: parsed.data.accountInfo ?? {},
    })
    return reply.status(201).send(success({ success: true, flow }))
  })

  server.get('/finance/withdrawal/getWithdrawal', async (request, reply) => {
    const userId = request.userId!
    const [summary, available] = await Promise.all([
      withdrawalSummary(userId),
      availableWithdrawal(userId),
    ])
    return reply.send(success({ withdrawal: { ...summary, available } }))
  })

  server.get('/finance/withdrawal/my-records', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await listWithdrawals(request.userId!, q.page, q.pageSize)
    return reply.send(
      success({ list: result.items, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/finance/withdrawal/flows/list', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await listWithdrawals(request.userId!, q.page, q.pageSize)
    return reply.send(
      success({ list: result.items, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/finance/withdrawal/flows/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const flow = await getWithdrawalById(id)
    return reply.send(success({ flow }))
  })

  server.post('/finance/withdrawal/flows/:id/approve', async (request, reply) => {
    const roleId = request.jwtPayload?.roleId ?? 0
    if (roleId < 1) return reply.status(403).send(error(403, '需要管理员权限'))
    const id = parseIdParam(request, reply)
    if (id === null) return
    const flow = await approveWithdrawal(id)
    if (!flow) return reply.status(400).send(error(400, '提现记录不存在或已处理'))
    return reply.send(success({ success: true, flow }))
  })

  server.post('/finance/withdrawal/flows/:id/reject', async (request, reply) => {
    const roleId = request.jwtPayload?.roleId ?? 0
    if (roleId < 1) return reply.status(403).send(error(403, '需要管理员权限'))
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = (request.body as { reason?: string } | null) ?? {}
    const flow = await rejectWithdrawal(id, body.reason ?? '驳回')
    if (!flow) return reply.status(400).send(error(400, '提现记录不存在或已处理'))
    return reply.send(success({ success: true, flow }))
  })

  // ===========================================================================
  // 16. 基金模块 /fund/*（6 个端点）
  // ===========================================================================
  server.post('/fund/ali/pay/create', async (_request, reply) => {
    return reply.send(success({ payUrl: null, orderId: null }))
  })

  server.post('/fund/ali/pay/create2', async (_request, reply) => {
    return reply.send(success({ payUrl: null, orderId: null }))
  })

  server.get('/fund/ali/pay/alipay/return', async (_request, reply) => {
    return reply.send(success({ success: true }))
  })

  server.get('/fund', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  server.get('/fund/:code', async (request, reply) => {
    const code = codeParam.parse(request.params).code
    if (!code) return reply.status(400).send(error(400, '参数错误'))
    return reply.send(success({ fund: null }))
  })

  server.get('/fund/:code/net-values', async (request, reply) => {
    const code = codeParam.parse(request.params).code
    if (!code) return reply.status(400).send(error(400, '参数错误'))
    return reply.send(success({ list: [] }))
  })

  // ===========================================================================
  // 17. AI 模块 /ai/*, /ai-ext/*（11 个端点）
  // ===========================================================================
  server.get('/ai/index', async (_request, reply) => {
    return reply.send(success({ banners: [], models: [], recommend: [] }))
  })

  server.get('/ai/team', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  server.get('/ai/team/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ team: null }))
  })

  // 注: /ai/chat (POST) 和 /ai/history (GET) 已由 ai-user-model-chat.ts 真实实现,此处不再重复注册空桩

  server.post('/ai/chat/conversations', async (_request, reply) => {
    return reply.status(201).send(success({ conversationId: null }))
  })

  server.get('/ai/chat/conversations', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  server.delete('/ai/chat/conversations/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ success: true }))
  })

  server.post('/ai/aigc/tasks/:taskId/cancel', async (request, reply) => {
    const taskId = taskIdParam.parse(request.params).taskId
    if (!taskId) return reply.status(400).send(error(400, '参数错误'))
    return reply.send(success({ success: true }))
  })

  server.post('/ai-ext/capabilities/:id/toggle', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ success: true }))
  })

  server.get('/ai-ext/reports', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  server.post('/ai-ext/reports/generate', async (_request, reply) => {
    return reply.status(201).send(success({ reportId: null }))
  })

  // ===========================================================================
  // 18. AI Feed/World 模块 /ai-feed/*, /ai-world/*（4 个端点）
  // ===========================================================================
  server.get('/ai-feed', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  server.get('/ai-feed/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ feed: null }))
  })

  server.get('/ai-world/categories', async (_request, reply) => {
    return reply.send(success({ list: [] }))
  })

  server.get('/ai-world/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ world: null }))
  })

  // ===========================================================================
  // 19. Workspace-AI 模块 /workspace-ai/*（2 个端点）
  // ===========================================================================
  server.post('/workspace-ai/generate-component', async (_request, reply) => {
    return reply.send(success({ component: null, code: '' }))
  })

  server.post('/workspace-ai/agentic', async (_request, reply) => {
    return reply.send(success({ result: null, taskId: null }))
  })

  // ===========================================================================
  // 20. Course 模块 /course/*（4 个端点，全部真实化）
  // ===========================================================================
  server.post('/course/:id/enroll', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const userId = request.userId!
    const already = await isSignedUp(id, userId)
    if (!already) await signUpLesson(id, userId)
    return reply.status(201).send(success({ success: true, enrolled: !already }))
  })

  server.get('/course/:id/progress', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const signup = await findSignUp(id, request.userId!)
    if (!signup) return reply.status(404).send(error(404, '未报名该课程'))
    return reply.send(
      success({
        progress: signup.progress,
        status: signup.status,
        completedLessons: signup.status >= 2 ? 1 : 0,
        totalLessons: 1,
      }),
    )
  })

  server.post('/course/lesson-complete', async (request, reply) => {
    const body = (request.body as { lessonId?: string } | null) ?? {}
    if (!body.lessonId) return reply.status(400).send(error(400, '缺少 lessonId'))
    const updated = await updateProgress(body.lessonId, request.userId!, 100)
    if (!updated) return reply.status(404).send(error(404, '未报名该课程'))
    return reply.send(
      success({ success: true, progress: updated.progress, status: updated.status }),
    )
  })

  server.get('/course/my', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findMyLessons(request.userId!, { page: q.page, pageSize: q.pageSize })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  // ===========================================================================
  // 21. Resource/Certificate/Knowledge/Skills 模块（9 个端点）
  // ===========================================================================
  server.get('/resources/:id/download', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const resource = await findResourceById(id)
    if (!resource) return reply.status(404).send(error(404, '资源不存在'))
    return reply.send(success({ url: resource.fileUrl, resource }))
  })

  // 注: resources/:id/like 无对应 like 表，保持桩实现
  server.post('/resources/:id/like', async (_request, reply) => {
    return reply.send(success({ success: true }))
  })

  server.post('/certificates/issue', async (request, reply) => {
    const body =
      (request.body as {
        userId?: string
        templateId?: string
        title?: string
        recipientName?: string
        source?: string
        sourceId?: string
      } | null) ?? {}
    if (!body.userId || !body.templateId || !body.title) {
      return reply.status(400).send(error(400, '缺少 userId/templateId/title'))
    }
    const cert = await createCertificate({
      userId: body.userId,
      templateId: body.templateId,
      certificateNo: 'CERT' + Date.now() + randomUUID().slice(0, 6).toUpperCase(),
      title: body.title,
      recipientName: body.recipientName,
      source: body.source,
      sourceId: body.sourceId,
    })
    return reply
      .status(201)
      .send(success({ success: true, certificateId: cert.id, certificate: cert }))
  })

  server.post('/certificates/:id/revoke', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const cert = await updateCertificateStatus(id, 0)
    if (!cert) return reply.status(404).send(error(404, '证书不存在'))
    return reply.send(success({ success: true, certificate: cert }))
  })

  server.post('/knowledge', async (request, reply) => {
    const body = z
      .object({
        title: z.string().min(1),
        content: z.string().min(1),
        summary: z.string().optional(),
        coverImage: z.string().optional(),
        categoryId: z.string().optional(),
        isPublished: z.boolean().optional(),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '标题和内容不能为空'))
    const knowledge = await createKnowledge({
      title: body.data.title,
      content: body.data.content,
      summary: body.data.summary,
      coverImage: body.data.coverImage,
      categoryId: body.data.categoryId,
      authorId: request.userId,
      isPublished: body.data.isPublished ?? false,
    })
    return reply.status(201).send(success({ id: knowledge.id, knowledge }))
  })

  server.put('/knowledge/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = z
      .object({
        title: z.string().optional(),
        content: z.string().optional(),
        summary: z.string().optional(),
        coverImage: z.string().optional(),
        categoryId: z.string().optional(),
        isPublished: z.boolean().optional(),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const knowledge = await updateKnowledge(id, body.data)
    if (!knowledge) return reply.status(404).send(error(404, '知识库不存在'))
    return reply.send(success({ success: true, knowledge }))
  })

  server.delete('/knowledge/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    await deleteKnowledge(id)
    return reply.send(success({ success: true }))
  })

  server.post('/skills', async (request, reply) => {
    const body = z
      .object({
        name: z.string().min(1),
        description: z.string().optional(),
        icon: z.string().optional(),
        categoryId: z.string().optional(),
        difficulty: z.number().optional(),
        content: z.string().optional(),
        isPublished: z.boolean().optional(),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '技能名称不能为空'))
    const skill = await createSkill({
      name: body.data.name,
      description: body.data.description,
      icon: body.data.icon,
      categoryId: body.data.categoryId,
      difficulty: body.data.difficulty,
      content: body.data.content,
      authorId: request.userId,
      isPublished: body.data.isPublished ?? false,
    })
    return reply.status(201).send(success({ id: skill.id, skill }))
  })

  server.put('/skills/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = z
      .object({
        name: z.string().optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        categoryId: z.string().optional(),
        difficulty: z.number().optional(),
        content: z.string().optional(),
        isPublished: z.boolean().optional(),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const skill = await updateSkill(id, body.data)
    if (!skill) return reply.status(404).send(error(404, '技能不存在'))
    return reply.send(success({ success: true, skill }))
  })

  server.delete('/skills/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    await deleteSkill(id)
    return reply.send(success({ success: true }))
  })

  // ===========================================================================
  // 22. Article/Member/Live/Agent/Coze 模块（7 个端点）
  // 注意：POST /api/sign-in 已在 gamification.ts 中注册，跳过
  // 注意：POST /api/coupons/verify 已在 promotions.ts 中注册，跳过
  // ===========================================================================
  server.get('/article/comments', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  server.get('/members/me', async (_request, reply) => {
    return reply.send(success({ member: null }))
  })

  server.get('/live/calendar', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    return reply.send(emptyList(q.page, q.pageSize))
  })

  server.post('/agents/:id/favorite', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ success: true }))
  })

  server.get('/agents/:id/reviews', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ list: [] }))
  })

  server.post('/agents/:id/publish', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    return reply.send(success({ success: true }))
  })

  server.get('/coze/chat/history/:botId/:conversationId', async (request, reply) => {
    const { botId, conversationId } = botConversationParam.parse(request.params)
    if (!botId || !conversationId) return reply.status(400).send(error(400, '参数错误'))
    return reply.send(success({ list: [] }))
  })

  // ===========================================================================
  // 23. 其他模块（2 个端点）
  // 注意：POST /api/users/change-phone 已在 users.ts 中注册，跳过
  // ===========================================================================
  server.get('/categories', async (_request, reply) => {
    return reply.send(success({ list: [] }))
  })

  server.post('/analytics/track', async (_request, reply) => {
    return reply.send(success({ success: true }))
  })
}
