import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../db/index.js'
import { sql, eq, and, desc } from 'drizzle-orm'
import {
  examPapers,
  examWrongQuestion,
  examSignups,
  lessons,
  liveChannels,
  subscriptions,
  asks,
  askAnswers,
  learnTopic,
  circles,
} from '@ihui/database'
import { deleteFile } from '../services/storage-service.js'

/**
 * 历史项目缺失端点补齐（集中实现）。
 * 注意：以下 schema 字段已对齐实际数据库结构：
 * - examSignups.paperId（非 examId）
 * - 问答使用 asks / askAnswers 表（非 circlePosts/comments 的 authorId/type）
 * - learn_record 表使用 member_id / learn_time（秒），统计换算为分钟
 * - user_favorites 使用 resource_type / resource_id（非 target_type / target_id）
 * - db.execute 返回行数组（非 .rows）
 *
 * 编号说明：
 * - 已实现：D1, D2, D3, D5, D6, D7, D8, D9, D10, D16, D17, D18, D19
 * - 已废弃（无对应业务需求或被其它路由覆盖）：
 *   - D4  历史考试详情聚合 → 由 /api/exam/* 系列路由覆盖
 *   - D11 ~ D15  历史桩端点 → 实际无前端调用方，废弃
 */
export const legacyCompletionRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const idParam = z.object({ id: z.string() })
  const userIdQuery = z.object({ userId: z.string() })
  const paginatedUserIdQuery = z.object({
    userId: z.string(),
    page: z.coerce.number().optional().default(1),
    pageSize: z.coerce.number().optional().default(20),
  })

  // ========== D1: 考试报名 sign-up CRUD (5端点) ==========
  // 报名列表
  fastify.get('/exam/signups', async (request) => {
    const { examId, userId, page, pageSize } = z
      .object({
        examId: z.string().optional(),
        userId: z.string().optional(),
        page: z.coerce.number().optional().default(1),
        pageSize: z.coerce.number().optional().default(20),
      })
      .parse(request.query)
    const conditions = []
    if (examId) conditions.push(eq(examSignups.paperId, examId))
    if (userId) conditions.push(eq(examSignups.userId, userId))
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const list = await db
      .select()
      .from(examSignups)
      .where(where)
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    return { list, total: list.length, page: Number(page), pageSize: Number(pageSize) }
  })

  // 创建报名
  fastify.post('/exam/signups', async (request, reply) => {
    const body = z
      .object({ examId: z.string().uuid(), userId: z.string().uuid() })
      .parse(request.body)
    const [created] = await db
      .insert(examSignups)
      .values({
        paperId: body.examId,
        userId: body.userId,
      })
      .returning()
    return reply.code(201).send(created)
  })

  // 报名详情
  fastify.get('/exam/signups/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    const result = await db.select().from(examSignups).where(eq(examSignups.id, id)).limit(1)
    if (!result[0]) return reply.code(404).send({ error: '报名记录不存在' })
    return result[0]
  })

  // 取消报名
  fastify.delete('/exam/signups/:id', async (request) => {
    const { id } = idParam.parse(request.params)
    await db.delete(examSignups).where(eq(examSignups.id, id))
    return { deleted: true }
  })

  // 检查是否已报名
  fastify.get('/exam/signups/check', async (request) => {
    const { examId, userId } = z
      .object({ examId: z.string(), userId: z.string() })
      .parse(request.query)
    const result = await db
      .select()
      .from(examSignups)
      .where(and(eq(examSignups.paperId, examId), eq(examSignups.userId, userId)))
      .limit(1)
    return { signed: !!result[0], signup: result[0] || null }
  })

  // ========== D2: 考试收藏/推荐/热门 (3端点) ==========
  fastify.get('/exam/recommend', async () => {
    const list = await db
      .select()
      .from(examPapers)
      .where(eq(examPapers.status, 1))
      .orderBy(desc(examPapers.createdAt))
      .limit(10)
    return { list }
  })

  fastify.get('/exam/hot', async () => {
    const list = await db
      .select()
      .from(examPapers)
      .where(eq(examPapers.status, 1))
      .orderBy(desc(examPapers.createdAt))
      .limit(10)
    return { list }
  })

  fastify.get('/exam/favorites', async (request) => {
    const { userId } = userIdQuery.parse(request.query)
    // user_favorites 使用 resource_type / resource_id
    const rows = await db.execute(
      sql`SELECT e.* FROM exam_papers e JOIN user_favorites f ON f.resource_id::text = e.id::text WHERE f.user_id = ${userId} AND f.resource_type = 'exam'`,
    )
    return { list: rows as Record<string, unknown>[] }
  })

  // ========== D3: 学习时间统计 (3端点) ==========
  fastify.get('/learn/stats/total-time', async (request) => {
    const { userId } = userIdQuery.parse(request.query)
    // learn_record 表使用 member_id / learn_time（秒）
    const rows = await db.execute(
      sql`SELECT COALESCE(SUM(learn_time), 0)::int AS total_seconds FROM learn_record WHERE member_id = ${userId}`,
    )
    const totalSeconds = (rows[0] as { total_seconds?: number } | undefined)?.total_seconds ?? 0
    return { totalMinutes: Math.floor(totalSeconds / 60) }
  })

  fastify.get('/learn/stats/today-time', async (request) => {
    const { userId } = userIdQuery.parse(request.query)
    const rows = await db.execute(
      sql`SELECT COALESCE(SUM(learn_time), 0)::int AS today_seconds FROM learn_record WHERE member_id = ${userId} AND created_at >= CURRENT_DATE`,
    )
    const todaySeconds = (rows[0] as { today_seconds?: number } | undefined)?.today_seconds ?? 0
    return { todayMinutes: Math.floor(todaySeconds / 60) }
  })

  fastify.get('/learn/stats/rank-percent', async (request) => {
    const { userId } = userIdQuery.parse(request.query)
    const rows = await db.execute(sql`
      WITH user_total AS (
        SELECT member_id, SUM(learn_time) as total FROM learn_record GROUP BY member_id
      ), ranks AS (
        SELECT member_id, PERCENT_RANK() OVER (ORDER BY total DESC) as pct FROM user_total
      )
      SELECT pct FROM ranks WHERE member_id = ${userId}
    `)
    return { rankPercent: (rows[0] as { pct?: number } | undefined)?.pct ?? 0 }
  })

  // ========== D5: 学习专题 topic 公开接口 (3端点) ==========
  fastify.get('/learn/topics', async () => {
    // 实际表名为 learn_topic（单数），status 为 varchar('draft'/'published')
    const rows = await db
      .select({
        id: learnTopic.id,
        title: learnTopic.title,
        image: learnTopic.image,
        status: learnTopic.status,
        description: learnTopic.description,
        company_id: learnTopic.companyId,
        department_id: learnTopic.departmentId,
        create_user_id: learnTopic.createUserId,
        price: learnTopic.price,
        original_price: learnTopic.originalPrice,
        created_at: learnTopic.createdAt,
        updated_at: learnTopic.updatedAt,
      })
      .from(learnTopic)
      .where(eq(learnTopic.status, 'published'))
      .orderBy(desc(learnTopic.createdAt))
    return { list: rows as Record<string, unknown>[] }
  })

  fastify.get('/learn/topics/:id', async (request) => {
    const { id } = idParam.parse(request.params)
    const rows = await db
      .select({
        id: learnTopic.id,
        title: learnTopic.title,
        image: learnTopic.image,
        status: learnTopic.status,
        description: learnTopic.description,
        company_id: learnTopic.companyId,
        department_id: learnTopic.departmentId,
        create_user_id: learnTopic.createUserId,
        price: learnTopic.price,
        original_price: learnTopic.originalPrice,
        created_at: learnTopic.createdAt,
        updated_at: learnTopic.updatedAt,
      })
      .from(learnTopic)
      .where(eq(learnTopic.id, id))
    return (rows[0] as Record<string, unknown> | undefined) || { error: '专题不存在' }
  })

  fastify.get('/learn/topics/:id/lessons', async (request) => {
    const { id } = idParam.parse(request.params)
    const rows = await db.execute(
      sql`SELECT l.* FROM lessons l JOIN learn_topic_lesson tl ON tl.lesson_id = l.id WHERE tl.topic_id = ${id}`,
    )
    return { list: rows as Record<string, unknown>[] }
  })

  // ========== D6: 直播频道订阅 (2端点) ==========
  fastify.post('/live/subscribe', async (request, reply) => {
    const body = z
      .object({ channelId: z.string().uuid(), userId: z.string().uuid() })
      .parse(request.body)
    const [created] = await db
      .insert(subscriptions)
      .values({
        userId: body.userId,
        targetType: 'live_channel',
        targetId: body.channelId,
      })
      .returning()
    return reply.code(201).send(created)
  })

  fastify.delete('/live/unsubscribe', async (request) => {
    const { channelId, userId } = z
      .object({ channelId: z.string(), userId: z.string() })
      .parse(request.query)
    await db
      .delete(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.targetId, channelId)))
    return { unsubscribed: true }
  })

  // ========== D7: 问答分类/会员计数 (5端点) ==========
  fastify.get('/ask/categories', async () => {
    const rows = await db.execute(
      sql`SELECT * FROM circle_categories WHERE status = 1 ORDER BY sort ASC`,
    )
    return { list: rows as Record<string, unknown>[] }
  })

  fastify.get('/ask/member/question-count', async (request) => {
    const { userId } = userIdQuery.parse(request.query)
    const rows = await db.execute(
      sql`SELECT count(*)::int AS count FROM asks WHERE user_id = ${userId}`,
    )
    return { count: (rows[0] as { count?: number } | undefined)?.count ?? 0 }
  })

  fastify.get('/ask/member/answer-count', async (request) => {
    const { userId } = userIdQuery.parse(request.query)
    const rows = await db.execute(
      sql`SELECT count(*)::int AS count FROM ask_answers WHERE user_id = ${userId}`,
    )
    return { count: (rows[0] as { count?: number } | undefined)?.count ?? 0 }
  })

  fastify.get('/ask/member/questions', async (request) => {
    const { userId, page, pageSize } = paginatedUserIdQuery.parse(request.query)
    const list = await db
      .select()
      .from(asks)
      .where(eq(asks.userId, userId))
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    return { list, page: Number(page), pageSize: Number(pageSize) }
  })

  fastify.get('/ask/member/answers', async (request) => {
    const { userId, page, pageSize } = paginatedUserIdQuery.parse(request.query)
    const list = await db
      .select()
      .from(askAnswers)
      .where(eq(askAnswers.userId, userId))
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    return { list, page: Number(page), pageSize: Number(pageSize) }
  })

  // ========== D8: 回答删除/更新 (2端点) ==========
  fastify.delete('/ask/answers/:id', async (request) => {
    const { id } = idParam.parse(request.params)
    await db.delete(askAnswers).where(eq(askAnswers.id, id))
    return { deleted: true }
  })

  fastify.patch('/ask/answers/:id', async (request) => {
    const { id } = idParam.parse(request.params)
    const { content } = z.object({ content: z.string() }).parse(request.body)
    const [updated] = await db
      .update(askAnswers)
      .set({ content })
      .where(eq(askAnswers.id, id))
      .returning()
    return updated
  })

  // ========== D9: 各模块 by-ids 批量查询 (统一端点) ==========
  fastify.post('/batch/lessons', async (request) => {
    const { ids } = z.object({ ids: z.array(z.string()) }).parse(request.body)
    const list = await db
      .select()
      .from(lessons)
      .where(sql`${lessons.id} = ANY(${ids}::uuid[])`)
    return { list }
  })

  fastify.post('/batch/exams', async (request) => {
    const { ids } = z.object({ ids: z.array(z.string()) }).parse(request.body)
    const list = await db
      .select()
      .from(examPapers)
      .where(sql`${examPapers.id} = ANY(${ids}::uuid[])`)
    return { list }
  })

  fastify.post('/batch/channels', async (request) => {
    const { ids } = z.object({ ids: z.array(z.string()) }).parse(request.body)
    const list = await db
      .select()
      .from(liveChannels)
      .where(sql`${liveChannels.id} = ANY(${ids}::uuid[])`)
    return { list }
  })

  // ========== D10: OSS 文件删除 + URL转Base64 (2端点) ==========
  fastify.delete('/oss/file', async (request) => {
    const { fileUrl } = z.object({ fileUrl: z.string().optional() }).parse(request.query)
    if (!fileUrl) return { deleted: false, error: 'fileUrl 为必填项' }

    // 从 URL 中提取文件 ID（UUID 格式或最后一段路径）
    const uuidMatch = fileUrl.match(
      /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    )
    const fileId = uuidMatch ? uuidMatch[1] : (fileUrl.split('/').filter(Boolean).pop() ?? null)

    if (!fileId) return { deleted: false, error: '无法从 URL 提取文件 ID' }

    const deleted = deleteFile(fileId)
    return { deleted, fileUrl }
  })

  fastify.get('/oss/to-base64', async (request, reply) => {
    const { url } = z.object({ url: z.string().url() }).parse(request.query)
    try {
      const response = await fetch(url)
      const buffer = Buffer.from(await response.arrayBuffer())
      const base64 = `data:${response.headers.get('content-type') || 'image/png'};base64,${buffer.toString('base64')}`
      return { base64 }
    } catch {
      return reply.code(400).send({ error: 'URL 转换失败' })
    }
  })

  // ========== D10补充: OSS 问答图片上传 ==========
  fastify.post('/oss/ask/question/image', async (_request, reply) => {
    // 复用现有上传逻辑
    return reply.code(501).send({ error: '请使用 /api/oss/upload 端点' })
  })

  // ========== D16: 错题删除 ==========
  fastify.delete('/exam/wrong-questions/:id', async (request) => {
    const { id } = idParam.parse(request.params)
    await db.delete(examWrongQuestion).where(eq(examWrongQuestion.id, id))
    return { deleted: true }
  })

  // ========== D17: 圈子热门列表 (历史 /public-api/circle/hot/list) ==========
  fastify.get('/circles/hot', async (request) => {
    const { limit } = z
      .object({ limit: z.coerce.number().optional().default(10) })
      .parse(request.query)
    const list = await db
      .select({
        id: sql`${circles.id}`,
        name: sql`${circles.name}`,
        slug: sql`${circles.slug}`,
        coverImage: sql`${circles.coverImage}`,
        memberCount: sql`${circles.memberCount}`,
        postCount: sql`${circles.postCount}`,
      })
      .from(circles)
      .where(eq(circles.isPublished, true))
      .orderBy(desc(circles.memberCount))
      .limit(Number(limit))
    return { list }
  })

  // ========== D18: 圈子成员计数 (历史 /public-api/member/count) ==========
  fastify.get('/circles/member-count', async (request) => {
    const { circleId } = z.object({ circleId: z.string().uuid() }).parse(request.query)
    const [row] = await db
      .select({ count: circles.memberCount })
      .from(circles)
      .where(eq(circles.id, circleId))
    return { circleId, memberCount: row?.count ?? 0 }
  })

  // ========== D19: 企业微信 token (历史 /work-we-chat/token) ==========
  fastify.get('/work-wechat/token', async (request) => {
    const { corpId, agentId, secret } = z
      .object({
        corpId: z.string(),
        agentId: z.string().optional(),
        secret: z.string(),
      })
      .parse(request.query)
    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(corpId)}&corpsecret=${encodeURIComponent(secret)}`
    const res = await fetch(url)
    const data = (await res.json()) as { access_token?: string; errcode?: number; errmsg?: string }
    return {
      accessToken: data.access_token ?? null,
      agentId,
      errcode: data.errcode ?? 0,
      errmsg: data.errmsg ?? null,
    }
  })

  // ========== D20: 视频预加载分片管理 (历史 /study/video-preload) ==========
  // 返回视频分片信息供前端预加载,减少首帧等待
  fastify.get('/study/video-preload', async (request, reply) => {
    const parsed = z
      .object({
        videoId: z.coerce.number().int(),
        userId: z.string().optional(),
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'videoId 参数错误' })
    }
    const { videoId, userId } = parsed.data
    // 基于视频 ID 生成 4 个分片(示例实现,实际应由 CDN/转码服务产出)
    const segments = [1, 2, 3, 4].map((idx) => ({
      seq: idx,
      url: `/videos/${videoId}/segment-${idx}.m4s`,
      duration: 10,
      size: 1024 * 1024 * idx,
      preload: idx === 1,
    }))
    return {
      videoId,
      userId: userId ?? null,
      segments,
      policy: {
        preloadCount: 2,
        maxBitrate: '1080p',
        cacheTtl: 3600,
      },
    }
  })
}
