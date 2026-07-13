import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../db/index.js'
import {
  lessons,
  zhsCourseVideo,
  zhsCategoryDictionary,
  zhsEducationPlatform,
  zhsCoursePay,
  zhsCoursePayLog,
  zhsCoursePlatformLog,
  zhsUserVideoComment,
  zhsUserVideoLog,
  zhsUserPlatform,
  zhsOperateTokenFlow,
} from '@ihui/database'
import { eq, sql, and, desc } from 'drizzle-orm'
import { requireAdmin } from '../plugins/require-permission.js'

const courseSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  coverUrl: z.string().url().optional(),
  categoryId: z.string().uuid().optional(),
  lecturerId: z.string().uuid().optional(),
  lecturerName: z.string().max(128).optional(),
  price: z.number().min(0).default(0),
  originalPrice: z.number().min(0).optional(),
  sort: z.number().int().default(0),
  status: z.number().int().default(1),
})

const updateSchema = courseSchema.partial().extend({ id: z.string().uuid() })

const pageQuery = {
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(20),
}

export const zhsCourseRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const idParam = z.object({ id: z.string() })
  const idsParam = z.object({ ids: z.string() })
  const videoIdParam = z.object({ video_id: z.string() })
  const categoryIdParam = z.object({ category_id: z.string() })
  const codeParam = z.object({ code: z.string() })
  const platformIdParam = z.object({ platform_id: z.string() })
  const commentIdParam = z.object({ comment_id: z.string() })

  // 课程列表
  fastify.get('/list', async (request) => {
    const { page, pageSize, keyword, status, categoryId } = z
      .object({
        ...pageQuery,
        keyword: z.string().optional(),
        status: z.coerce.number().optional(),
        categoryId: z.string().optional(),
      })
      .parse(request.query)
    const offset = (Number(page) - 1) * Number(pageSize)
    const conditions = []
    if (keyword) conditions.push(sql`${lessons.title} ILIKE ${`%${keyword}%`}`)
    if (status !== undefined) conditions.push(eq(lessons.status, Number(status)))
    if (categoryId) conditions.push(eq(lessons.categoryId, categoryId))
    const where = conditions.length ? sql.join(conditions, sql` AND `) : sql`TRUE`
    const result = await db
      .select()
      .from(lessons)
      .where(where)
      .limit(Number(pageSize))
      .offset(offset)
    const total = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(lessons)
      .where(where)
    return {
      list: result,
      total: total[0]?.count ?? 0,
      page: Number(page),
      pageSize: Number(pageSize),
    }
  })

  // 课程详情
  fastify.get('/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    const result = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1)
    if (!result[0]) return reply.code(404).send({ error: '课程不存在' })
    return result[0]
  })

  // 创建课程
  fastify.post('/', async (request, reply) => {
    const body = courseSchema.parse(request.body)
    const [created] = await db
      .insert(lessons)
      .values({
        title: body.title,
        intro: body.description,
        coverImage: body.coverUrl,
        categoryId: body.categoryId,
        lecturerId: body.lecturerId,
        lecturerName: body.lecturerName,
        price: body.price.toString(),
        originalPrice: body.originalPrice?.toString(),
        sort: body.sort,
        status: body.status,
      })
      .returning()
    return reply.code(201).send(created)
  })

  // 更新课程
  fastify.put('/', async (request, reply) => {
    const body = updateSchema.parse(request.body)
    const { id, ...updateData } = body
    const [updated] = await db
      .update(lessons)
      .set({
        ...(updateData.title && { title: updateData.title }),
        ...(updateData.description !== undefined && { intro: updateData.description }),
        ...(updateData.coverUrl !== undefined && { coverImage: updateData.coverUrl }),
        ...(updateData.categoryId && { categoryId: updateData.categoryId }),
        ...(updateData.lecturerId && { lecturerId: updateData.lecturerId }),
        ...(updateData.lecturerName && { lecturerName: updateData.lecturerName }),
        ...(updateData.price !== undefined && { price: updateData.price.toString() }),
        ...(updateData.originalPrice !== undefined && {
          originalPrice: updateData.originalPrice.toString(),
        }),
        ...(updateData.sort !== undefined && { sort: updateData.sort }),
        ...(updateData.status !== undefined && { status: updateData.status }),
        updatedAt: new Date(),
      })
      .where(eq(lessons.id, id))
      .returning()
    if (!updated) return reply.code(404).send({ error: '课程不存在' })
    return updated
  })

  // 批量删除课程
  fastify.delete('/:ids', async (request) => {
    const { ids } = idsParam.parse(request.params)
    const idList = ids.split(',').filter(Boolean)
    await db.delete(lessons).where(sql`${lessons.id} = ANY(${idList}::uuid[])`)
    return { deleted: idList.length }
  })

  // 课程下架
  fastify.post('/delist/:ids', async (request) => {
    const { ids } = idsParam.parse(request.params)
    const idList = ids.split(',').filter(Boolean)
    await db
      .update(lessons)
      .set({ status: 0, updatedAt: new Date() })
      .where(sql`${lessons.id} = ANY(${idList}::uuid[])`)
    return { delisted: idList.length }
  })

  // ========== 课程视频 CRUD (9端点) ==========
  // 视频列表
  fastify.get('/videos', async (request) => {
    const { courseId, page, pageSize, status, keyword } = z
      .object({
        ...pageQuery,
        courseId: z.coerce.number().optional(),
        status: z.coerce.number().optional(),
        keyword: z.string().optional(),
      })
      .parse(request.query)
    const conditions = []
    if (courseId) conditions.push(eq(zhsCourseVideo.courseId, Number(courseId)))
    if (status !== undefined) conditions.push(eq(zhsCourseVideo.status, Number(status)))
    if (keyword) conditions.push(sql`${zhsCourseVideo.title} ILIKE ${`%${keyword}%`}`)
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const list = await db
      .select()
      .from(zhsCourseVideo)
      .where(where)
      .orderBy(desc(zhsCourseVideo.createdAt))
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    const total = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(zhsCourseVideo)
      .where(where)
    return { list, total: total[0]?.count ?? 0, page: Number(page), pageSize: Number(pageSize) }
  })

  // 我的视频（静态路由，须在 /:video_id 之前注册）
  fastify.get('/videos/my', async (request) => {
    const { userUuid, courseId, page, pageSize } = z
      .object({
        ...pageQuery,
        userUuid: z.string(),
        courseId: z.coerce.number().optional(),
      })
      .parse(request.query)
    const conditions = [eq(zhsCourseVideo.creator, userUuid)]
    if (courseId) conditions.push(eq(zhsCourseVideo.courseId, Number(courseId)))
    const list = await db
      .select()
      .from(zhsCourseVideo)
      .where(and(...conditions))
      .orderBy(desc(zhsCourseVideo.createdAt))
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    return { list, total: list.length, page: Number(page), pageSize: Number(pageSize) }
  })

  // 视频详情
  fastify.get('/videos/:video_id', async (request, reply) => {
    const { video_id } = videoIdParam.parse(request.params)
    const result = await db
      .select()
      .from(zhsCourseVideo)
      .where(eq(zhsCourseVideo.id, Number(video_id)))
      .limit(1)
    if (!result[0]) return reply.code(404).send({ error: '视频不存在' })
    return result[0]
  })

  // 创建视频
  fastify.post('/videos/create', async (request, reply) => {
    const body = z
      .object({
        courseId: z.number().int(),
        videoPath: z.string().min(1),
        title: z.string().max(200).optional(),
        subtitle: z.string().optional(),
        content: z.string().optional(),
        binding: z.string().optional(),
        duration: z.number().int().optional(),
        adjunctUrl: z.string().optional(),
        isPay: z.number().int().default(0),
        amount: z.number().optional(),
        sort: z.number().int().default(0),
        creator: z.string().optional(),
        lecturer: z.string().optional(),
        label: z.string().optional(),
      })
      .parse(request.body)
    const [created] = await db
      .insert(zhsCourseVideo)
      .values({
        courseId: body.courseId,
        videoPath: body.videoPath,
        title: body.title,
        subtitle: body.subtitle,
        content: body.content,
        binding: body.binding,
        duration: body.duration,
        adjunctUrl: body.adjunctUrl,
        isPay: body.isPay,
        amount: body.amount,
        sort: body.sort,
        creator: body.creator,
        lecturer: body.lecturer,
        label: body.label,
      })
      .returning()
    return reply.code(201).send(created)
  })

  // 批量创建视频
  fastify.post('/videos/batch', async (request, reply) => {
    const body = z
      .object({
        videos: z.array(
          z.object({
            courseId: z.number().int(),
            videoPath: z.string().min(1),
            title: z.string().max(200).optional(),
            duration: z.number().int().optional(),
            sort: z.number().int().default(0),
            creator: z.string().optional(),
            lecturer: z.string().optional(),
          }),
        ),
      })
      .parse(request.body)
    const created = await db.insert(zhsCourseVideo).values(body.videos).returning()
    return reply.code(201).send({ created: created.length, list: created })
  })

  // 更新视频
  fastify.put('/videos/:video_id', async (request, reply) => {
    const { video_id } = videoIdParam.parse(request.params)
    const body = z
      .object({
        title: z.string().max(200).optional(),
        subtitle: z.string().optional(),
        content: z.string().optional(),
        remark: z.string().optional(),
        videoPath: z.string().optional(),
        binding: z.string().optional(),
        duration: z.number().int().optional(),
        adjunctUrl: z.string().optional(),
        isPay: z.number().int().optional(),
        amount: z.number().optional(),
        status: z.number().int().optional(),
        sort: z.number().int().optional(),
        lecturer: z.string().optional(),
        label: z.string().optional(),
      })
      .parse(request.body)
    const [updated] = await db
      .update(zhsCourseVideo)
      .set({
        ...(body.title !== undefined && { title: body.title }),
        ...(body.subtitle !== undefined && { subtitle: body.subtitle }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.remark !== undefined && { remark: body.remark }),
        ...(body.videoPath !== undefined && { videoPath: body.videoPath }),
        ...(body.binding !== undefined && { binding: body.binding }),
        ...(body.duration !== undefined && { duration: body.duration }),
        ...(body.adjunctUrl !== undefined && { adjunctUrl: body.adjunctUrl }),
        ...(body.isPay !== undefined && { isPay: body.isPay }),
        ...(body.amount !== undefined && { amount: body.amount }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.sort !== undefined && { sort: body.sort }),
        ...(body.lecturer !== undefined && { lecturer: body.lecturer }),
        ...(body.label !== undefined && { label: body.label }),
        updatedAt: new Date(),
      })
      .where(eq(zhsCourseVideo.id, Number(video_id)))
      .returning()
    if (!updated) return reply.code(404).send({ error: '视频不存在' })
    return updated
  })

  // 删除视频
  fastify.delete('/videos/:video_id', async (request) => {
    const { video_id } = videoIdParam.parse(request.params)
    await db.delete(zhsCourseVideo).where(eq(zhsCourseVideo.id, Number(video_id)))
    return { deleted: true }
  })

  // 移动视频（调整课程归属）
  fastify.post('/videos/:video_id/move', async (request, reply) => {
    const { video_id } = videoIdParam.parse(request.params)
    const { courseId } = z.object({ courseId: z.number().int() }).parse(request.body)
    const [updated] = await db
      .update(zhsCourseVideo)
      .set({ courseId, updatedAt: new Date() })
      .where(eq(zhsCourseVideo.id, Number(video_id)))
      .returning()
    if (!updated) return reply.code(404).send({ error: '视频不存在' })
    return updated
  })

  // 发布视频
  fastify.post('/videos/:video_id/issue', async (request, reply) => {
    const { video_id } = videoIdParam.parse(request.params)
    const [updated] = await db
      .update(zhsCourseVideo)
      .set({ status: 1, auditStatus: 1, updatedAt: new Date() })
      .where(eq(zhsCourseVideo.id, Number(video_id)))
      .returning()
    if (!updated) return reply.code(404).send({ error: '视频不存在' })
    return updated
  })

  // ========== 课程分类 (2端点) ==========
  // 分类列表
  fastify.get('/categories', async (request) => {
    const { type, parentId, status } = z
      .object({
        type: z.string().optional(),
        parentId: z.coerce.number().optional(),
        status: z.coerce.number().optional(),
      })
      .parse(request.query)
    const conditions = []
    if (type) conditions.push(eq(zhsCategoryDictionary.type, type))
    if (parentId !== undefined)
      conditions.push(eq(zhsCategoryDictionary.parentId, Number(parentId)))
    if (status !== undefined) conditions.push(eq(zhsCategoryDictionary.status, Number(status)))
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const list = await db
      .select()
      .from(zhsCategoryDictionary)
      .where(where)
      .orderBy(desc(zhsCategoryDictionary.sort))
    return { list }
  })

  // 父级分类链
  fastify.get('/categories/:category_id/parent', async (request) => {
    const { category_id } = categoryIdParam.parse(request.params)
    const chain: (typeof zhsCategoryDictionary.$inferSelect)[] = []
    let currentId = Number(category_id)
    for (let i = 0; i < 10 && currentId > 0; i++) {
      const result = await db
        .select()
        .from(zhsCategoryDictionary)
        .where(eq(zhsCategoryDictionary.id, currentId))
        .limit(1)
      if (!result[0]) break
      chain.unshift(result[0])
      currentId = result[0].parentId
    }
    return { chain }
  })

  // ========== 教育平台 (5端点) ==========
  // 平台列表
  fastify.get('/platforms', async (request) => {
    const { status, keyword } = z
      .object({ status: z.coerce.number().optional(), keyword: z.string().optional() })
      .parse(request.query)
    const conditions = []
    if (status !== undefined) conditions.push(eq(zhsEducationPlatform.status, Number(status)))
    if (keyword) conditions.push(sql`${zhsEducationPlatform.name} ILIKE ${`%${keyword}%`}`)
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const list = await db
      .select()
      .from(zhsEducationPlatform)
      .where(where)
      .orderBy(desc(zhsEducationPlatform.sort))
    return { list }
  })

  // 平台详情（按 code）
  fastify.get('/platforms/:code', async (request, reply) => {
    const { code } = codeParam.parse(request.params)
    const result = await db
      .select()
      .from(zhsEducationPlatform)
      .where(eq(zhsEducationPlatform.code, code))
      .limit(1)
    if (!result[0]) return reply.code(404).send({ error: '平台不存在' })
    return result[0]
  })

  // 创建平台
  fastify.post('/platforms/create', async (request, reply) => {
    const body = z
      .object({
        code: z.string().min(1).max(50),
        name: z.string().min(1).max(100),
        domain: z.string().max(200).optional(),
        remark: z.string().optional(),
        binding: z.string().optional(),
        filePath: z.string().optional(),
        type: z.number().int().optional(),
        sort: z.number().int().default(0),
      })
      .parse(request.body)
    const [created] = await db
      .insert(zhsEducationPlatform)
      .values({
        code: body.code,
        name: body.name,
        domain: body.domain,
        remark: body.remark,
        binding: body.binding,
        filePath: body.filePath,
        type: body.type,
        sort: body.sort,
      })
      .returning()
    return reply.code(201).send(created)
  })

  // 更新平台
  fastify.put('/platforms/:platform_id', async (request, reply) => {
    const { platform_id } = platformIdParam.parse(request.params)
    const body = z
      .object({
        name: z.string().max(100).optional(),
        domain: z.string().max(200).optional(),
        remark: z.string().optional(),
        binding: z.string().optional(),
        filePath: z.string().optional(),
        type: z.number().int().optional(),
        status: z.number().int().optional(),
        sort: z.number().int().optional(),
        isHidden: z.number().int().optional(),
      })
      .parse(request.body)
    const [updated] = await db
      .update(zhsEducationPlatform)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.domain !== undefined && { domain: body.domain }),
        ...(body.remark !== undefined && { remark: body.remark }),
        ...(body.binding !== undefined && { binding: body.binding }),
        ...(body.filePath !== undefined && { filePath: body.filePath }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.sort !== undefined && { sort: body.sort }),
        ...(body.isHidden !== undefined && { isHidden: body.isHidden }),
        updatedAt: new Date(),
      })
      .where(eq(zhsEducationPlatform.id, Number(platform_id)))
      .returning()
    if (!updated) return reply.code(404).send({ error: '平台不存在' })
    return updated
  })

  // 删除平台（软删除）
  fastify.delete('/platforms/:platform_id', async (request) => {
    const { platform_id } = platformIdParam.parse(request.params)
    await db
      .update(zhsEducationPlatform)
      .set({ isDel: 1, updatedAt: new Date() })
      .where(eq(zhsEducationPlatform.id, Number(platform_id)))
    return { deleted: true }
  })

  // ========== 课程支付 (2端点) ==========
  // 创建支付
  fastify.post('/pay', async (request, reply) => {
    const body = z
      .object({
        courseId: z.number().int(),
        userUuid: z.string().min(1),
        orderNo: z.string().max(64).optional(),
        amount: z.number().int().default(0),
      })
      .parse(request.body)
    const [created] = await db
      .insert(zhsCoursePay)
      .values({
        courseId: body.courseId,
        userUuid: body.userUuid,
        orderNo: body.orderNo,
        amount: body.amount,
      })
      .returning()
    if (!created) return reply.code(500).send({ error: '创建支付记录失败' })
    await db.insert(zhsCoursePayLog).values({
      payId: created.id,
      action: 'create',
      detail: `用户 ${body.userUuid} 创建支付订单`,
    })
    return reply.code(201).send(created)
  })

  // 支付日志
  fastify.get('/pay-logs', async (request) => {
    const { payId, page, pageSize } = z
      .object({
        ...pageQuery,
        payId: z.coerce.number().optional(),
      })
      .parse(request.query)
    const conditions = []
    if (payId) conditions.push(eq(zhsCoursePayLog.payId, Number(payId)))
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const list = await db
      .select()
      .from(zhsCoursePayLog)
      .where(where)
      .orderBy(desc(zhsCoursePayLog.createdAt))
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    return { list, page: Number(page), pageSize: Number(pageSize) }
  })

  // ========== 课程评论 (4端点) ==========
  // 评论列表
  fastify.get('/comments', async (request) => {
    const { videoId, page, pageSize, status } = z
      .object({
        ...pageQuery,
        videoId: z.coerce.number().optional(),
        status: z.coerce.number().optional(),
      })
      .parse(request.query)
    const conditions = []
    if (videoId) conditions.push(eq(zhsUserVideoComment.videoId, Number(videoId)))
    if (status !== undefined) conditions.push(eq(zhsUserVideoComment.status, Number(status)))
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const list = await db
      .select()
      .from(zhsUserVideoComment)
      .where(where)
      .orderBy(desc(zhsUserVideoComment.createdAt))
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    return { list, page: Number(page), pageSize: Number(pageSize) }
  })

  // 创建评论
  fastify.post('/comments/create', async (request, reply) => {
    const body = z
      .object({
        videoId: z.number().int(),
        userUuid: z.string().min(1),
        content: z.string().min(1),
        parentId: z.number().int().default(0),
      })
      .parse(request.body)
    const [created] = await db
      .insert(zhsUserVideoComment)
      .values({
        videoId: body.videoId,
        userUuid: body.userUuid,
        content: body.content,
        parentId: body.parentId,
      })
      .returning()
    return reply.code(201).send(created)
  })

  // 父评论列表
  fastify.get('/comments/parent', async (request) => {
    const { videoId, page, pageSize } = z
      .object({
        ...pageQuery,
        videoId: z.coerce.number().optional(),
      })
      .parse(request.query)
    const list = await db
      .select()
      .from(zhsUserVideoComment)
      .where(
        and(
          eq(zhsUserVideoComment.videoId, Number(videoId)),
          eq(zhsUserVideoComment.parentId, 0),
          eq(zhsUserVideoComment.status, 1),
        ),
      )
      .orderBy(desc(zhsUserVideoComment.createdAt))
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    return { list, page: Number(page), pageSize: Number(pageSize) }
  })

  // 删除评论（软删除）
  fastify.delete('/comments/:comment_id', async (request) => {
    const { comment_id } = commentIdParam.parse(request.params)
    await db
      .update(zhsUserVideoComment)
      .set({ status: 0, updatedAt: new Date() })
      .where(eq(zhsUserVideoComment.id, Number(comment_id)))
    return { deleted: true }
  })

  // ========== 视频日志 (2端点) ==========
  // 记录视频日志
  fastify.post('/video-log', async (request, reply) => {
    const body = z
      .object({
        videoId: z.number().int(),
        userUuid: z.string().min(1),
        action: z.string().min(1).max(32),
      })
      .parse(request.body)
    const [created] = await db
      .insert(zhsUserVideoLog)
      .values({
        videoId: body.videoId,
        userUuid: body.userUuid,
        action: body.action,
      })
      .returning()
    return reply.code(201).send(created)
  })

  // 视频日志列表
  fastify.get('/video-log/list', async (request) => {
    const { videoId, userUuid, action, page, pageSize } = z
      .object({
        ...pageQuery,
        videoId: z.coerce.number().optional(),
        userUuid: z.string().optional(),
        action: z.string().optional(),
      })
      .parse(request.query)
    const conditions = []
    if (videoId) conditions.push(eq(zhsUserVideoLog.videoId, Number(videoId)))
    if (userUuid) conditions.push(eq(zhsUserVideoLog.userUuid, userUuid))
    if (action) conditions.push(eq(zhsUserVideoLog.action, action))
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const list = await db
      .select()
      .from(zhsUserVideoLog)
      .where(where)
      .orderBy(desc(zhsUserVideoLog.createdAt))
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    return { list, page: Number(page), pageSize: Number(pageSize) }
  })

  // ========== 操作日志 (2端点) ==========
  // Token 操作日志列表
  fastify.get('/operate/list', async (request) => {
    const { userId, type, page, pageSize } = z
      .object({
        ...pageQuery,
        userId: z.string().optional(),
        type: z.coerce.number().optional(),
      })
      .parse(request.query)
    const conditions = []
    if (userId) conditions.push(eq(zhsOperateTokenFlow.userId, userId))
    if (type !== undefined) conditions.push(eq(zhsOperateTokenFlow.type, Number(type)))
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const list = await db
      .select()
      .from(zhsOperateTokenFlow)
      .where(where)
      .orderBy(desc(zhsOperateTokenFlow.createdAt))
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    return { list, page: Number(page), pageSize: Number(pageSize) }
  })

  // 平台操作日志列表
  fastify.get('/platform-logs', async (request) => {
    const { courseId, platformId, page, pageSize } = z
      .object({
        ...pageQuery,
        courseId: z.coerce.number().optional(),
        platformId: z.coerce.number().optional(),
      })
      .parse(request.query)
    const conditions = []
    if (courseId) conditions.push(eq(zhsCoursePlatformLog.courseId, Number(courseId)))
    if (platformId) conditions.push(eq(zhsCoursePlatformLog.platformId, Number(platformId)))
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const list = await db
      .select()
      .from(zhsCoursePlatformLog)
      .where(where)
      .orderBy(desc(zhsCoursePlatformLog.createdAt))
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    return { list, page: Number(page), pageSize: Number(pageSize) }
  })

  // ========== 用户平台 (3端点) ==========
  // 绑定用户平台
  fastify.post('/user-platform/bind', async (request, reply) => {
    const body = z
      .object({
        userUuid: z.string().min(1),
        platformId: z.number().int(),
      })
      .parse(request.body)
    const [created] = await db
      .insert(zhsUserPlatform)
      .values({
        userUuid: body.userUuid,
        platformId: body.platformId,
      })
      .returning()
    return reply.code(201).send(created)
  })

  // 解绑用户平台
  fastify.delete('/user-platform/unbind', async (request) => {
    const { userUuid, platformId } = z
      .object({ userUuid: z.string(), platformId: z.coerce.number().optional() })
      .parse(request.query)
    await db
      .delete(zhsUserPlatform)
      .where(
        and(
          eq(zhsUserPlatform.userUuid, userUuid),
          eq(zhsUserPlatform.platformId, Number(platformId)),
        ),
      )
    return { unbind: true }
  })

  // 我的平台
  fastify.get('/user-platform/my', async (request) => {
    const { userUuid } = z.object({ userUuid: z.string() }).parse(request.query)
    const list = await db
      .select()
      .from(zhsUserPlatform)
      .where(and(eq(zhsUserPlatform.userUuid, userUuid), eq(zhsUserPlatform.status, 1)))
    return { list }
  })
}

/**
 * 管理员课程路由（前缀 /api/admin/course）。
 * 复用 zhsCourseRoutes 的全部端点，但添加 requireAdmin 钩子。
 */
export const adminZhsCourseRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', requireAdmin)
  fastify.register(zhsCourseRoutes)
}
