/**
 * 小程序端首页公开 fallback 路由(2026-07-22 立,2026-07-26 真实化)
 *
 * 背景:小程序端首页未登录时调用 /content/home、/content/banner/list、
 * /content/course/list、/study/info,这些路由在 API 中不存在或需鉴权,
 * 导致 Taro.request fail → 弹"网络异常"toast,影响界面展示。
 *
 * 方案:提供公开(无需鉴权)fallback,真实查询 carousels / lessons / announcements 表,
 * 让首页未登录用户也能看到真实内容;已登录用户的进阶数据走鉴权路由。
 *
 * 真实化映射(2026-07-26):
 *  - /content/home          → carousels(position=home,status=1,前 5)+ lessons(isPublished,前 10)+ announcements(前 5)
 *  - /content/banner/list   → carousels(status=1,支持 position 筛选,分页)
 *  - /content/course/list   → lessons(isPublished + status=1,支持 categoryId,分页)
 *  - /study/info            → 保持空数据(真实学习统计走鉴权路由 /study/*,需 userId)
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { carousels, lessons, announcements } from '@ihui/database'
import { success } from '../utils/response.js'

export const miniappPublicFallbackRoutes: FastifyPluginAsync = async (server) => {
  // GET /content/home - 首页聚合(banner 前 5 + 推荐课程前 10 + 公告前 5)
  server.get('/content/home', async (_request, reply) => {
    const [banner, courses, announcementRows] = await Promise.all([
      dbRead
        .select({
          id: carousels.id,
          title: carousels.title,
          imageUrl: carousels.imageUrl,
          linkUrl: carousels.linkUrl,
          description: carousels.description,
        })
        .from(carousels)
        .where(and(eq(carousels.position, 'home'), eq(carousels.status, 1)))
        .orderBy(desc(carousels.sort))
        .limit(5),
      dbRead
        .select({
          id: lessons.id,
          title: lessons.title,
          coverImage: lessons.coverImage,
          intro: lessons.intro,
          price: lessons.price,
          isFree: lessons.isFree,
          lecturerName: lessons.lecturerName,
          viewCount: lessons.viewCount,
          signupCount: lessons.signupCount,
        })
        .from(lessons)
        .where(and(eq(lessons.isPublished, true), eq(lessons.status, 1)))
        .orderBy(desc(lessons.createdAt))
        .limit(10),
      dbRead
        .select({
          id: announcements.id,
          title: announcements.title,
          type: announcements.type,
          publishedAt: announcements.publishedAt,
        })
        .from(announcements)
        .where(eq(announcements.isPublished, true))
        .orderBy(desc(announcements.publishedAt))
        .limit(5),
    ])
    return reply.send(success({ banner, courses, announcements: announcementRows }))
  })

  // GET /content/banner/list - banner 列表(carousels 表 status=1,支持 position 筛选,分页)
  server.get('/content/banner/list', async (request, reply) => {
    const { page, pageSize, position } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        position: z.string().max(64).optional(),
      })
      .parse(request.query ?? {})
    const conditions = [eq(carousels.status, 1)]
    if (position) conditions.push(eq(carousels.position, position))
    const where = and(...conditions)
    const offset = (page - 1) * pageSize
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(carousels)
        .where(where)
        .orderBy(desc(carousels.sort))
        .limit(pageSize)
        .offset(offset),
      dbRead.select({ total: sql<number>`count(*)::int` }).from(carousels).where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.total ?? 0, page, pageSize }))
  })

  // GET /content/course/list - 课程列表(lessons 表 isPublished=true + status=1,支持 categoryId,分页)
  server.get('/content/course/list', async (request, reply) => {
    const { page, pageSize, categoryId } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        categoryId: z.string().uuid().optional(),
      })
      .parse(request.query ?? {})
    const conditions = [eq(lessons.isPublished, true), eq(lessons.status, 1)]
    if (categoryId) conditions.push(eq(lessons.categoryId, categoryId))
    const where = and(...conditions)
    const offset = (page - 1) * pageSize
    const [list, totalRows] = await Promise.all([
      dbRead
        .select({
          id: lessons.id,
          title: lessons.title,
          coverImage: lessons.coverImage,
          intro: lessons.intro,
          categoryId: lessons.categoryId,
          lecturerName: lessons.lecturerName,
          price: lessons.price,
          originalPrice: lessons.originalPrice,
          isFree: lessons.isFree,
          viewCount: lessons.viewCount,
          signupCount: lessons.signupCount,
          lessonCount: lessons.lessonCount,
          createdAt: lessons.createdAt,
        })
        .from(lessons)
        .where(where)
        .orderBy(desc(lessons.createdAt))
        .limit(pageSize)
        .offset(offset),
      dbRead.select({ total: sql<number>`count(*)::int` }).from(lessons).where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.total ?? 0, page, pageSize }))
  })

  // GET /study/info - 学习统计(公开 fallback 保持空数据;真实数据走鉴权路由 /study/*,需 userId)
  server.get('/study/info', async (_request, reply) => {
    return reply.send(
      success({ todayMinutes: 0, totalMinutes: 0, continuousDays: 0, courses: 0 }),
    )
  })
}
