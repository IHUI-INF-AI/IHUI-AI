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
import { eq, asc, sql, and } from 'drizzle-orm'
import { authenticate } from '../plugins/auth.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { db } from '../db/index.js'
import { isSystemAdminUser } from '../db/queries.js'
import {
  aiModelConfig,
  users,
  exportTasks,
  lessonSignUps,
  lessons,
  lessonChapters,
  lessonChapterSections,
} from '@ihui/database'
import { config } from '../config/index.js'
import {
  findMyLessons,
  signUpLesson,
  isSignedUp,
  findSignUp,
  updateProgress,
  findSignUpById,
  updateSignUpById,
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
  updateArticle,
  deleteArticle,
  findPublishedNewsCategories,
  findMyArticles,
} from '../db/news-queries.js'
import { findMessageById } from '../db/chat-queries.js'
import { createCertificate, updateCertificateStatus } from '../db/certificate-queries.js'
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
  upsertUserPreference,
  deleteUserPreferencesByGroup,
} from '../db/user-preferences-queries.js'
import { findSecurityLogs } from '../db/security-logs-queries.js'
import {
  createExportTask,
  findLatestExportTask,
  completeExportTask,
} from '../db/export-tasks-queries.js'
import { toggleLike } from '../db/resource-likes-queries.js'
import { findNotificationById } from '../db/notification-queries.js'
import { findFunds, findFundByCode, findFundNetValues } from '../db/fund-queries.js'
import { findAiFeedPosts, findAiFeedPostById } from '../db/ai-feed-post-queries.js'
import { findAiWorldCategories, findAiWorldItemById } from '../db/ai-world-queries.js'
import { findMcpServers, findMcpServerById } from '../db/mcp-queries.js'
import { findOpenclawItems, findOpenclawItemById } from '../db/openclaw-queries.js'
import { findSiteCategories } from '../db/site-categories-queries.js'
import { createAnalyticsEvent } from '../db/analytics-queries.js'
import {
  findAiIndexBanners,
  findAiTeamMembers,
  findAiTeamMemberById,
  createAiConversation,
  findAiConversations,
  deleteAiConversation,
  updateAiAigcTaskStatus,
  toggleAiExtCapability,
  findAiExtReports,
  createAiExtReport,
  findAiCareers,
  findAiCareerById,
  findAiChatTypes,
  findAiCommunityPosts,
} from '../db/ai-modules-queries.js'
import {
  findDeveloperInfo,
  findDeveloperPricing,
  createDeveloperApplication,
  updateDeveloperApplicationStatus,
} from '../db/developer-queries.js'
import { findMyMember } from '../db/my-member-queries.js'
import { findCozeChatHistory } from '../db/coze-chat-queries.js'
import { listVipLevels } from '../db/vip-queries.js'
import { isAlipayConfigured, buildSignedUrl } from '../services/alipay.js'
import { createOrder } from '../db/payment-queries.js'

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

const idParamSchema = z.object({ id: z.string() })

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

/** 内存导出内容缓存(taskId → content + 过期时间),进程重启后失效。 */
const exportContentStore = new Map<string, { content: string; expiresAt: Date }>()

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
  // 1. 文章模块 /article/*（9 个端点全部真实化,like/favorite 用 resource_likes 表 toggleLike）
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

  server.post('/article/like', async (request, reply) => {
    const body = (request.body as { id?: string } | null) ?? {}
    if (!body.id) return reply.status(400).send(error(400, '缺少 id'))
    const result = await toggleLike('article', body.id, request.userId!)
    return reply.send(success({ success: true, liked: result.liked }))
  })

  server.post('/article/favorite', async (request, reply) => {
    const body = (request.body as { id?: string } | null) ?? {}
    if (!body.id) return reply.status(400).send(error(400, '缺少 id'))
    const result = await toggleLike('article_favorite', body.id, request.userId!)
    return reply.send(success({ success: true, liked: result.liked }))
  })

  server.put('/article/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const existing = await findArticleById(id)
    if (!existing) return reply.status(404).send(error(404, '文章不存在'))
    if (existing.authorId !== request.userId)
      return reply.status(403).send(error(403, '无权编辑此文章'))
    const body =
      (request.body as {
        title?: string
        content?: string
        categoryId?: string
        summary?: string
        coverImage?: string
        isPublished?: boolean
      } | null) ?? {}
    if (body.title !== undefined && !body.title.trim())
      return reply.status(400).send(error(400, '标题不能为空'))
    if (body.content !== undefined && !body.content.trim())
      return reply.status(400).send(error(400, '内容不能为空'))
    const article = await updateArticle(id, {
      title: body.title,
      content: body.content,
      categoryId: body.categoryId,
      summary: body.summary,
      coverImage: body.coverImage,
      isPublished: body.isPublished,
    })
    return reply.send(success({ success: true, article }))
  })

  server.delete('/article/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const existing = await findArticleById(id)
    if (!existing) return reply.status(404).send(error(404, '文章不存在'))
    if (existing.authorId !== request.userId)
      return reply.status(403).send(error(403, '无权删除此文章'))
    await deleteArticle(id)
    return reply.send(success({ success: true }))
  })

  // ===========================================================================
  // 2. 知识库 /knowledge/*（3 个端点）
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

  server.post('/knowledge/:id/like', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const result = await toggleLike('knowledge', id, request.userId!)
    return reply.send(success({ success: true, liked: result.liked }))
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
    const result = await findMyLessons(request.userId!, { page: q.page, pageSize: q.pageSize })
    const list = result.list.map((item) => ({
      id: item.id,
      userId: request.userId,
      courseId: item.categoryId,
      courseTitle: item.title,
      lessonId: item.id,
      lessonTitle: item.title,
      duration: 0,
      progress: item.progress,
      status: item.signupStatus >= 2 ? 'completed' : 'in_progress',
      lastStudyAt: item.signupCreatedAt.toISOString(),
      createdAt: item.signupCreatedAt.toISOString(),
    }))
    return reply.send(success({ list, total: result.total, page: q.page, pageSize: q.pageSize }))
  })

  server.get('/study/records/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const signup = await findSignUpById(id, request.userId!)
    if (!signup) return reply.status(404).send(error(404, '学习记录不存在'))
    return reply.send(
      success({
        record: {
          id: signup.id,
          userId: signup.userId,
          lessonId: signup.lessonId,
          progress: signup.progress,
          status: signup.status >= 2 ? 'completed' : 'in_progress',
          createdAt: signup.createdAt.toISOString(),
        },
      }),
    )
  })

  // POST /study/records - 记录学习（真实化：报名课程 + 可选更新进度）
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
    const userId = request.userId!
    const lessonId = body.data.lessonId ?? body.data.courseId
    if (!lessonId) {
      return reply.status(400).send(error(400, '缺少 lessonId/courseId'))
    }
    await signUpLesson(lessonId, userId)
    if (body.data.progress !== undefined) {
      await updateProgress(lessonId, userId, body.data.progress)
    }
    const signup = await findSignUp(lessonId, userId)
    return reply.status(201).send(
      success({
        record: {
          id: signup?.id ?? lessonId,
          userId,
          lessonId,
          courseId: body.data.courseId ?? null,
          duration: body.data.duration ?? 0,
          progress: signup?.progress ?? 0,
          status: signup ? (signup.status >= 2 ? 'completed' : 'in_progress') : 'in_progress',
          createdAt: signup?.createdAt ?? new Date().toISOString(),
        },
      }),
    )
  })

  // PUT /study/records/:id - 更新学习进度（真实化：updateSignUpById 按 id 更新）
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
    const userId = request.userId!
    const statusMap = { in_progress: 1, completed: 2, paused: 1 } as const
    const updated = await updateSignUpById(id, userId, {
      progress: body.data.progress,
      status: body.data.status ? statusMap[body.data.status] : undefined,
    })
    if (!updated) return reply.status(404).send(error(404, '学习记录不存在或未报名'))
    return reply.send(
      success({
        record: {
          id: updated.id,
          userId,
          lessonId: updated.lessonId,
          progress: updated.progress,
          status: updated.status >= 2 ? 'completed' : 'in_progress',
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

  server.get('/study/statistics', async (request, reply) => {
    const userId = request.userId!
    const activeCond = and(eq(lessonSignUps.userId, userId), sql`${lessonSignUps.status} != 3`)

    const [signupStats] = await db
      .select({
        totalCourses: sql<number>`count(DISTINCT ${lessonSignUps.lessonId})::int`,
        completedCourses: sql<number>`count(*) FILTER (WHERE ${lessonSignUps.status} = 2)::int`,
        totalLessons: sql<number>`count(*)::int`,
      })
      .from(lessonSignUps)
      .where(activeCond)

    const [durationStats] = await db
      .select({
        totalDuration: sql<number>`COALESCE(SUM(${lessonChapterSections.duration}), 0)::int`,
      })
      .from(lessonSignUps)
      .innerJoin(lessons, eq(lessonSignUps.lessonId, lessons.id))
      .innerJoin(lessonChapters, eq(lessonChapters.lessonId, lessons.id))
      .innerJoin(lessonChapterSections, eq(lessonChapterSections.chapterId, lessonChapters.id))
      .where(activeCond)

    const dateRows = await db
      .select({ d: sql<string>`DISTINCT DATE(${lessonSignUps.createdAt})::text` })
      .from(lessonSignUps)
      .where(activeCond)
      .orderBy(sql`d DESC`)
      .limit(365)

    const dateSet = new Set(dateRows.map((r) => r.d))
    let streak = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const check = new Date(today)
      check.setDate(check.getDate() - i)
      const ds = check.toISOString().slice(0, 10)
      if (dateSet.has(ds)) {
        streak++
      } else if (i > 0) {
        break
      }
    }

    return reply.send(
      success({
        totalDuration: durationStats?.totalDuration ?? 0,
        totalCourses: signupStats?.totalCourses ?? 0,
        completedCourses: signupStats?.completedCourses ?? 0,
        totalLessons: signupStats?.totalLessons ?? 0,
        completedLessons: signupStats?.completedCourses ?? 0,
        continuousDays: streak,
      }),
    )
  })

  // ===========================================================================
  // 6. MCP /mcp/*（3 个端点）
  // ===========================================================================
  server.get('/mcp', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findMcpServers({
      page: q.page,
      pageSize: q.pageSize,
      search: q.search,
    })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/mcp/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const mcp = await findMcpServerById(id)
    if (!mcp) return reply.status(404).send(error(404, 'MCP 服务不存在'))
    return reply.send(success({ mcp }))
  })

  server.post('/mcp/invoke', async (request, reply) => {
    const body =
      (request.body as {
        serverId?: string
        projectId?: string
        tool?: string
        toolName?: string
        args?: unknown
      } | null) ?? {}
    const serverId = body.serverId ?? body.projectId
    const toolName = body.tool ?? body.toolName
    if (!serverId) return reply.status(400).send(error(400, '缺少 serverId'))
    if (!toolName) return reply.status(400).send(error(400, '缺少 toolName'))

    await createAnalyticsEvent({
      userId: request.userId,
      event: 'mcp_invoke',
      properties: { serverId, tool: toolName, args: body.args },
      ip: request.ip,
      userAgent: (request.headers['user-agent'] as string | undefined) ?? null,
    })

    try {
      const resp = await fetch(`${config.AI_SERVICE_URL}/api/mcp/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(request.headers.authorization
            ? { Authorization: request.headers.authorization }
            : {}),
        },
        body: JSON.stringify({ name: toolName, arguments: body.args ?? {} }),
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        return reply
          .status(502)
          .send(error(502, `MCP 服务调用失败: ${resp.status} ${text.slice(0, 200)}`))
      }
      const data = await resp.json().catch(() => ({}))
      return reply.send(success({ result: data }))
    } catch (e) {
      const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
      return reply.status(502).send(error(502, `MCP 服务不可用: ${msg}`))
    }
  })

  // ===========================================================================
  // 7. OpenClaw /openclaw/*（2 个端点）
  // ===========================================================================
  server.get('/openclaw', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findOpenclawItems({
      page: q.page,
      pageSize: q.pageSize,
      search: q.search,
    })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/openclaw/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const openclaw = await findOpenclawItemById(id)
    if (!openclaw) return reply.status(404).send(error(404, 'OpenClaw 条目不存在'))
    return reply.send(success({ openclaw }))
  })

  // ===========================================================================
  // 8. 代理类 /openrouter-proxy/*（2 个端点）
  // 委托到 VENDOR_CONFIGS 机制(chat-models.ts),复用现有 LLM 代理实现。
  // ===========================================================================
  const VENDOR_BASES: Record<string, { base: string; keyEnv: string; name: string }> = {
    openrouter: {
      base: 'https://openrouter.ai/api/v1',
      keyEnv: 'OPENROUTER_API_KEY',
      name: 'OpenRouter',
    },
  }

  async function proxyChatCompletion(
    vendor: string,
    body: Record<string, unknown>,
    reply: FastifyReply,
  ): Promise<void> {
    const cfg = VENDOR_BASES[vendor]
    if (!cfg) {
      reply.status(400).send(error(400, `不支持的厂商: ${vendor}`))
      return
    }
    const key = process.env[cfg.keyEnv] ?? ''
    if (!key) {
      reply.status(503).send(error(503, `${cfg.name} 服务未配置`))
      return
    }
    try {
      const resp = await fetch(`${cfg.base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        reply
          .status(502)
          .send(error(502, `上游 ${resp.status}: ${JSON.stringify(data).slice(0, 500)}`))
        return
      }
      reply.send(success(data))
    } catch (e) {
      const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
      reply.status(502).send(error(502, `调用异常: ${msg}`))
    }
  }

  server.post('/openrouter-proxy/chat/completions', async (request, reply) => {
    const body = (request.body as Record<string, unknown> | null) ?? {}
    await proxyChatCompletion('openrouter', body, reply)
  })

  server.get('/openrouter-proxy/models', async (_request, reply) => {
    const cfg = VENDOR_BASES.openrouter
    if (!cfg) {
      reply.status(400).send(error(400, '不支持的厂商: openrouter'))
      return
    }
    const key = process.env[cfg.keyEnv] ?? ''
    if (!key) {
      reply.status(503).send(error(503, `${cfg.name} 服务未配置`))
      return
    }
    try {
      const resp = await fetch(`${cfg.base}/models`, {
        headers: { Authorization: `Bearer ${key}` },
      })
      const data = await resp.json().catch(() => ({ data: [] }))
      if (!resp.ok) {
        reply.status(502).send(error(502, `上游 ${resp.status}`))
        return
      }
      reply.send(success(data))
    } catch (e) {
      reply.status(502).send(error(502, `调用异常: ${(e as Error).message}`))
    }
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

  server.put('/settings/notifications', async (request, reply) => {
    const body = (request.body as Record<string, unknown> | null) ?? {}
    const userId = request.userId!
    await Promise.all(
      Object.entries(body).map(([key, value]) =>
        upsertUserPreference(
          userId,
          'notifications',
          key,
          value === null || value === undefined ? null : String(value),
        ),
      ),
    )
    return reply.send(success({ success: true }))
  })

  server.put('/settings/privacy', async (request, reply) => {
    const body = (request.body as Record<string, unknown> | null) ?? {}
    const userId = request.userId!
    await Promise.all(
      Object.entries(body).map(([key, value]) =>
        upsertUserPreference(
          userId,
          'privacy',
          key,
          value === null || value === undefined ? null : String(value),
        ),
      ),
    )
    return reply.send(success({ success: true }))
  })

  server.put('/settings/preferences', async (request, reply) => {
    const body = (request.body as Record<string, unknown> | null) ?? {}
    const userId = request.userId!
    await Promise.all(
      Object.entries(body).map(([key, value]) =>
        upsertUserPreference(
          userId,
          'preferences',
          key,
          value === null || value === undefined ? null : String(value),
        ),
      ),
    )
    return reply.send(success({ success: true }))
  })

  server.get('/settings/devices', async (request, reply) => {
    const { list, total } = await findUserPreferences(request.userId!, 'devices')
    return reply.send(success({ list, total }))
  })

  server.get('/settings/security-logs', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findSecurityLogs(request.userId!, q.page, q.pageSize)
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/settings/export', async (request, reply) => {
    const latest = await findLatestExportTask(request.userId!)
    return reply.send(
      success({
        taskId: latest?.id ?? null,
        status: latest?.status ?? null,
        url: latest?.fileUrl ?? null,
        exportedAt: latest?.completedAt?.toISOString() ?? null,
      }),
    )
  })

  server.post('/settings/export', async (request, reply) => {
    const userId = request.userId!
    const task = await createExportTask(userId, 'user_data')

    const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    const [notifPrefs, privacyPrefs, prefPrefs] = await Promise.all([
      findUserPreferences(userId, 'notifications'),
      findUserPreferences(userId, 'privacy'),
      findUserPreferences(userId, 'preferences'),
    ])
    const signups = await findMyLessons(userId, { page: 1, pageSize: 1000 })

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: userRow
        ? {
            id: userRow.id,
            nickname: userRow.nickname,
            email: userRow.email,
            phone: userRow.phone,
            avatar: userRow.avatar,
            createdAt: userRow.createdAt,
          }
        : null,
      preferences: {
        notifications: notifPrefs.list,
        privacy: privacyPrefs.list,
        preferences: prefPrefs.list,
      },
      studyRecords: signups.list.map((s) => ({
        lessonId: s.id,
        title: s.title,
        status: s.signupStatus,
        progress: s.progress,
        enrolledAt: s.signupCreatedAt,
      })),
    }
    const content = JSON.stringify(exportData, null, 2)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    exportContentStore.set(task.id, { content, expiresAt })

    const downloadUrl = `/api/settings/export/${task.id}/download`
    await completeExportTask(task.id, downloadUrl)

    return reply.send(
      success({
        url: downloadUrl,
        filename: `user-data-${userId}-${Date.now()}.json`,
        expiresAt: expiresAt.toISOString(),
        taskId: task.id,
      }),
    )
  })

  server.get('/settings/export/:taskId/download', async (request, reply) => {
    const taskId = (request.params as { taskId: string }).taskId
    const entry = exportContentStore.get(taskId)
    if (!entry) return reply.status(404).send(error(404, '导出文件不存在或已过期'))
    if (entry.expiresAt < new Date()) {
      exportContentStore.delete(taskId)
      return reply.status(410).send(error(410, '导出文件已过期'))
    }
    const [task] = await db.select().from(exportTasks).where(eq(exportTasks.id, taskId)).limit(1)
    if (!task || task.userId !== request.userId!) {
      return reply.status(403).send(error(403, '无权访问'))
    }
    reply.header('Content-Type', 'application/json')
    reply.header('Content-Disposition', `attachment; filename="user-data.json"`)
    return reply.send(entry.content)
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

  server.post('/settings/delete-account', async (request, reply) => {
    if (await isSystemAdminUser(request.userId!)) {
      return reply.status(403).send(error(403, '系统内置管理员账户不可注销'))
    }
    await db.update(users).set({ status: 0 }).where(eq(users.id, request.userId!))
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
    const list = await findAiCareers()
    return reply.send(success({ list }))
  })

  server.get('/ai/careers/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const career = await findAiCareerById(id)
    if (!career) return reply.status(404).send(error(404, '职位不存在'))
    return reply.send(success({ career }))
  })

  server.get('/ai/chat-types', async (_request, reply) => {
    const list = await findAiChatTypes()
    return reply.send(success({ list }))
  })

  server.get('/ai/community', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findAiCommunityPosts({
      page: q.page,
      pageSize: q.pageSize,
      search: q.search,
    })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  // ===========================================================================
  // 11. 开发者扩展 /developer/*（4 个端点）
  // ===========================================================================
  server.get('/developer/info', async (request, reply) => {
    const developer = await findDeveloperInfo(request.userId!)
    return reply.send(success({ developer }))
  })

  server.get('/developer/price', async (_request, reply) => {
    const list = await findDeveloperPricing()
    return reply.send(success({ list }))
  })

  server.post('/developer/apply', async (request, reply) => {
    const body = z
      .object({
        name: z.string().min(1).max(100),
        description: z.string().max(2000).optional(),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const application = await createDeveloperApplication({
      userId: request.userId!,
      name: body.data.name,
      description: body.data.description,
    })
    return reply.status(201).send(success({ success: true, application }))
  })

  server.post('/developer/:id/audit', async (request, reply) => {
    const roleId = request.jwtPayload?.roleId ?? 0
    if (roleId < 1) return reply.status(403).send(error(403, '需要管理员权限'))
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = z
      .object({
        status: z.enum(['approved', 'rejected']),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const statusNum = body.data.status === 'approved' ? 1 : 2
    const application = await updateDeveloperApplicationStatus(id, statusNum)
    if (!application) return reply.status(404).send(error(404, '申请不存在'))
    return reply.send(success({ success: true, application }))
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
    const list = await listVipLevels(true)
    return reply.send(success({ list }))
  })

  // 注: /coupons 已由 promotions.ts 真实实现,此处不再重复注册空桩

  server.get('/notifications/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const notification = await findNotificationById(id)
    return reply.send(success({ notification }))
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

  server.post('/payment/callback/verify', async (request, reply) => {
    const body = (request.body as { orderNo?: string } | null) ?? {}
    if (!body.orderNo) return reply.status(400).send(error(400, '缺少 orderNo'))
    const order = await findOrderByOrderNo(body.orderNo)
    if (!order) return reply.status(404).send(error(404, '订单不存在'))
    return reply.send(success({ success: true, order }))
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
  server.post('/fund/ali/pay/create', async (request, reply) => {
    const body =
      (request.body as { amount?: number; description?: string; productId?: string } | null) ?? {}
    if (!body.amount || body.amount <= 0) {
      return reply.status(400).send(error(400, '缺少 amount 或 amount <= 0'))
    }
    const order = await createOrder({
      userId: request.userId!,
      amount: Math.round(body.amount * 100),
      orderType: 0,
      productId: body.productId,
      payType: 'alipay',
      description: body.description,
    })
    if (!isAlipayConfigured()) {
      return reply.send(
        success({ payUrl: null, orderId: order.id, orderNo: order.orderNo, mock: true }),
      )
    }
    const bizContent = {
      out_trade_no: order.orderNo,
      total_amount: body.amount.toFixed(2),
      subject: body.description ?? '订单支付',
      product_code: 'FAST_INSTANT_TRADE_PAY',
    }
    const payUrl = buildSignedUrl(bizContent, 'alipay.trade.page.pay')
    return reply.send(success({ payUrl, orderId: order.id, orderNo: order.orderNo }))
  })

  server.post('/fund/ali/pay/create2', async (request, reply) => {
    const body =
      (request.body as { amount?: number; description?: string; productId?: string } | null) ?? {}
    if (!body.amount || body.amount <= 0) {
      return reply.status(400).send(error(400, '缺少 amount 或 amount <= 0'))
    }
    const order = await createOrder({
      userId: request.userId!,
      amount: Math.round(body.amount * 100),
      orderType: 0,
      productId: body.productId,
      payType: 'alipay',
      description: body.description,
    })
    if (!isAlipayConfigured()) {
      return reply.send(
        success({ payUrl: null, orderId: order.id, orderNo: order.orderNo, mock: true }),
      )
    }
    const bizContent = {
      out_trade_no: order.orderNo,
      total_amount: body.amount.toFixed(2),
      subject: body.description ?? '订单支付',
      product_code: 'FAST_INSTANT_TRADE_PAY',
    }
    const payUrl = buildSignedUrl(bizContent, 'alipay.trade.page.pay')
    return reply.send(success({ payUrl, orderId: order.id, orderNo: order.orderNo }))
  })

  server.get('/fund/ali/pay/alipay/return', async (request, reply) => {
    const query =
      (request.query as { orderNo?: string; out_trade_no?: string; trade_no?: string } | null) ?? {}
    const orderNo = query.orderNo ?? query.out_trade_no
    if (!orderNo) {
      return reply.status(400).send(error(400, '缺少 orderNo'))
    }
    const order = await findOrderByOrderNo(orderNo)
    if (!order) {
      return reply.status(404).send(error(404, '订单不存在'))
    }
    return reply.send(
      success({
        success: true,
        orderNo: order.orderNo,
        status: order.status,
        tradeNo: query.trade_no ?? null,
      }),
    )
  })

  server.get('/fund', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findFunds({ page: q.page, pageSize: q.pageSize, search: q.search })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/fund/:code', async (request, reply) => {
    const code = codeParam.parse(request.params).code
    if (!code) return reply.status(400).send(error(400, '参数错误'))
    const fund = await findFundByCode(code)
    if (!fund) return reply.status(404).send(error(404, '基金不存在'))
    return reply.send(success({ fund }))
  })

  server.get('/fund/:code/history', async (request, reply) => {
    const code = codeParam.parse(request.params).code
    if (!code) return reply.status(400).send(error(400, '参数错误'))
    const fund = await findFundByCode(code)
    if (!fund) return reply.status(404).send(error(404, '基金不存在'))
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findFundNetValues(fund.id, { page: q.page, pageSize: q.pageSize })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/fund/:code/net-values', async (request, reply) => {
    const code = codeParam.parse(request.params).code
    if (!code) return reply.status(400).send(error(400, '参数错误'))
    const fund = await findFundByCode(code)
    if (!fund) return reply.status(404).send(error(404, '基金不存在'))
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findFundNetValues(fund.id, { page: q.page, pageSize: q.pageSize })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  // ===========================================================================
  // 17. AI 模块 /ai/*, /ai-ext/*（11 个端点）
  // ===========================================================================
  server.get('/ai/index', async (_request, reply) => {
    const [banners, models] = await Promise.all([
      findAiIndexBanners(),
      db
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
        .limit(10),
    ])
    return reply.send(success({ banners, models, recommend: models.slice(0, 5) }))
  })

  server.get('/ai/team', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findAiTeamMembers({ page: q.page, pageSize: q.pageSize, search: q.search })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/ai/team/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const team = await findAiTeamMemberById(id)
    if (!team) return reply.status(404).send(error(404, '团队成员不存在'))
    return reply.send(success({ team }))
  })

  // 注: /ai/chat (POST) 和 /ai/history (GET) 已由 ai-user-model-chat.ts 真实实现,此处不再重复注册空桩

  server.post('/ai/chat/conversations', async (request, reply) => {
    const body = z
      .object({
        title: z.string().max(200).optional(),
        modelId: z.string().max(100).optional(),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const conversation = await createAiConversation({
      userId: request.userId!,
      title: body.data.title,
      modelId: body.data.modelId,
    })
    return reply.status(201).send(success({ conversationId: conversation.id, conversation }))
  })

  server.get('/ai/chat/conversations', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findAiConversations({
      userId: request.userId!,
      page: q.page,
      pageSize: q.pageSize,
    })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.delete('/ai/chat/conversations/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const deleted = await deleteAiConversation(id, request.userId!)
    if (!deleted) return reply.status(404).send(error(404, '会话不存在'))
    return reply.send(success({ success: true }))
  })

  server.post('/ai/aigc/tasks/:taskId/cancel', async (request, reply) => {
    const taskId = taskIdParam.parse(request.params).taskId
    if (!taskId) return reply.status(400).send(error(400, '参数错误'))
    const task = await updateAiAigcTaskStatus(taskId, request.userId!, 3)
    if (!task) return reply.status(404).send(error(404, '任务不存在或不可取消'))
    return reply.send(success({ success: true, task }))
  })

  server.post('/ai-ext/capabilities/:id/toggle', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const capability = await toggleAiExtCapability(id)
    if (!capability) return reply.status(404).send(error(404, '能力不存在'))
    return reply.send(success({ success: true, capability }))
  })

  server.get('/ai-ext/reports', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findAiExtReports({
      userId: request.userId!,
      page: q.page,
      pageSize: q.pageSize,
    })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.post('/ai-ext/reports/generate', async (request, reply) => {
    const body = z
      .object({
        type: z.string().max(50),
        content: z.string().optional(),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const report = await createAiExtReport({
      userId: request.userId!,
      type: body.data.type,
      content: body.data.content,
    })
    return reply.status(201).send(success({ reportId: report.id, report }))
  })

  // ===========================================================================
  // 18. AI Feed/World 模块 /ai-feed/*, /ai-world/*（4 个端点）
  // ===========================================================================
  server.get('/ai-feed', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findAiFeedPosts({ page: q.page, pageSize: q.pageSize, search: q.search })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/ai-ext/ai-feed/items', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findAiFeedPosts({ page: q.page, pageSize: q.pageSize, search: q.search })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/ai-feed/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const feed = await findAiFeedPostById(id)
    if (!feed) return reply.status(404).send(error(404, '资讯不存在'))
    return reply.send(success({ feed }))
  })

  server.get('/ai-world/categories', async (_request, reply) => {
    const list = await findAiWorldCategories()
    return reply.send(success({ list }))
  })

  server.get('/ai-world/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const world = await findAiWorldItemById(id)
    if (!world) return reply.status(404).send(error(404, '条目不存在'))
    return reply.send(success({ world }))
  })

  // ===========================================================================
  // 18. Course 模块 /course/*（4 个端点，全部真实化）
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
  // 21. Resource/Certificate/Knowledge/Skills 模块（8 个端点；/resources/:id/download 已在 resource.ts 真实化）
  // ===========================================================================

  server.post('/resources/:id/like', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const result = await toggleLike('resource', id, request.userId!)
    return reply.send(success({ success: true, liked: result.liked }))
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
  // 21. Member/Live/Agent/Coze 模块（6 个端点）
  // 注意：POST /api/sign-in 已在 gamification.ts 中注册，跳过
  // 注意：POST /api/coupons/verify 已在 promotions.ts 中注册，跳过
  // ===========================================================================
  server.get('/members/me', async (request, reply) => {
    const member = await findMyMember(request.userId!)
    return reply.send(success({ member }))
  })

  // 注意:GET /api/live/calendar 已在 live.ts 中以增强版注册(月度参数+按日分组),此处不重复

  server.get('/coze/chat/history/:botId/:conversationId', async (request, reply) => {
    const { botId, conversationId } = botConversationParam.parse(request.params)
    if (!botId || !conversationId) return reply.status(400).send(error(400, '参数错误'))
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findCozeChatHistory(botId, conversationId, q.page, q.pageSize)
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  // ===========================================================================
  // 23. 其他模块（2 个端点）
  // 注意：POST /api/users/change-phone 已在 users.ts 中注册，跳过
  // ===========================================================================
  server.get('/categories', async (request, reply) => {
    const type = (request.query as { type?: string } | null)?.type
    const list = await findSiteCategories({ type })
    return reply.send(success({ list }))
  })

  server.post('/analytics/track', async (request, reply) => {
    const body = (request.body as { event?: string; properties?: unknown } | null) ?? {}
    if (!body.event) return reply.status(400).send(error(400, '缺少 event'))
    await createAnalyticsEvent({
      userId: request.userId,
      event: body.event,
      properties: body.properties,
      ip: request.ip,
      userAgent: (request.headers['user-agent'] as string | undefined) ?? null,
    })
    return reply.send(success({ success: true }))
  })

  // ===========================================================================
  // 24. AI 生涯指导（1 个端点）
  // 前端 apps/web/src/lib/ai-api.ts getCareerAdvice 调用 /api/ai/career-advice
  // ===========================================================================
  const careerAdviceSchema = z.object({
    school: z.string().max(200).optional().default(''),
    classLevel: z.string().max(100).optional().default(''),
    scoreRange: z.string().max(100).optional().default(''),
    languageDifficulty: z.string().max(500).optional().default(''),
    scienceCharacteristics: z.string().max(500).optional().default(''),
    learningObstacle: z.string().max(1000).optional().default(''),
    hobbies: z.string().max(1000).optional().default(''),
    target: z.string().max(1000).optional().default(''),
  })

  server.post('/ai/career-advice', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply
        .status(statusCode)
        .send(error(statusCode, (e as Error).message || 'Authentication required'))
    }

    const parsed = careerAdviceSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const input = parsed.data

    const prompt = [
      '你是一位资深的升学与生涯规划顾问,请根据以下学生情况给出个性化的生涯指导建议。',
      `学校: ${input.school || '未提供'}`,
      `年级: ${input.classLevel || '未提供'}`,
      `成绩区间: ${input.scoreRange || '未提供'}`,
      `语文学科特点/难度: ${input.languageDifficulty || '未提供'}`,
      `理科学科特点: ${input.scienceCharacteristics || '未提供'}`,
      `学习障碍/困难: ${input.learningObstacle || '未提供'}`,
      `兴趣爱好: ${input.hobbies || '未提供'}`,
      `目标: ${input.target || '未提供'}`,
      '请从升学方向、学科提升、兴趣发展、职业规划四个维度给出具体可执行的建议,800 字以内。',
    ].join('\n')

    try {
      const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          max_tokens: 1500,
          temperature: 0.7,
        }),
      })
      if (resp.ok) {
        const data = (await resp.json()) as { text?: string; content?: string; output?: string }
        const content = data.text ?? data.content ?? data.output ?? '暂无建议内容,请稍后重试。'
        return reply.send(success({ content }))
      }
      request.log.warn({ status: resp.status }, 'AI 服务调用失败,返回兜底建议')
    } catch (e) {
      request.log.warn({ err: e }, 'AI 服务不可用,返回兜底建议')
    }

    const fallback = [
      `针对${input.classLevel || '该'}阶段同学的生涯指导建议:`,
      '1. 升学方向:结合自身成绩区间与学科特点,优先考虑与优势学科匹配的专业方向。',
      '2. 学科提升:针对学习障碍制定阶段性小目标,弱科每日固定时间攻坚,强科保持稳定。',
      '3. 兴趣发展:将兴趣爱好与升学目标结合,参与相关竞赛或实践活动,丰富综合素质评价。',
      '4. 职业规划:多了解目标行业的真实工作内容,通过职业体验、学长交流等方式验证兴趣。',
      '(此为兜底建议,AI 服务暂不可用,请稍后重试获取个性化建议)',
    ].join('\n')
    return reply.send(success({ content: fallback }))
  })
}
