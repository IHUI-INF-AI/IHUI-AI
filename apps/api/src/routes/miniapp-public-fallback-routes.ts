// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 *  - /content/course/:id    → 同表同投影的单条 + lesson_chapters 组成的章节大纲
 *  - /study/info            → 已迁出,鉴权版(返回真实 lessonRecords 聚合)在 miniapp-compat-routes.ts
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { carousels, lessons, announcements } from '@ihui/database'
import { success, error } from '../utils/response.js'
import { withPublicEdgeCache } from '../utils/public-edge-cache.js'
import { findLessonChapters } from '../db/learn-queries.js'

/** 课程列表/详情共用的投影源列(两处必须同形,否则同一门课在两个页面长得不一样) */
const courseColumns = {
  id: lessons.id,
  title: lessons.title,
  coverImage: lessons.coverImage,
  intro: lessons.intro,
  categoryId: lessons.categoryId,
  lecturerId: lessons.lecturerId,
  lecturerName: lessons.lecturerName,
  difficulty: lessons.difficulty,
  price: lessons.price,
  originalPrice: lessons.originalPrice,
  isFree: lessons.isFree,
  viewCount: lessons.viewCount,
  signupCount: lessons.signupCount,
  lessonCount: lessons.lessonCount,
  createdAt: lessons.createdAt,
}

/**
 * 库列 → 端上读取名。小程序两个课程页(`pkg-learn/course/list` 与 `.../detail`)都按
 * `coverUrl / teacher / description` 取值,而库里叫 `coverImage / lecturerName / intro`
 * ⇒ 列表页此前拿到的是 undefined(封面恒空)。映射只在这一处实现,列表与详情共用。
 * `subtitle` 库里没有对应列 ⇒ 不发这个键(端上是 optional,缺键即不渲染,胜过造一个假的一行)。
 */
function toCourseRow(r: Record<string, unknown>) {
  return {
    id: r.id,
    title: r.title,
    coverUrl: r.coverImage ?? '',
    teacher: r.lecturerName ?? '',
    teacherId: r.lecturerId ?? '',
    description: r.intro ?? '',
    level: r.difficulty ?? '',
    price: Number(r.price ?? 0),
    originalPrice:
      r.originalPrice === null || r.originalPrice === undefined ? null : Number(r.originalPrice),
    isFree: r.isFree,
    viewCount: r.viewCount,
    signupCount: r.signupCount,
    lessonCount: r.lessonCount,
    categoryId: r.categoryId,
    createdAt: r.createdAt,
  }
}

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
    return withPublicEdgeCache(reply).send(
      success({ banner, courses, announcements: announcementRows }),
    )
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
      dbRead
        .select({ total: sql<number>`count(*)::int` })
        .from(carousels)
        .where(where),
    ])
    return withPublicEdgeCache(reply).send(
      success({ list, total: totalRows[0]?.total ?? 0, page, pageSize }),
    )
  })

  // GET /content/course/list - 课程列表(lessons 表 isPublished=true + status=1,支持 categoryId,分页)
  server.get('/content/course/list', async (request, reply) => {
    const { page, pageSize, categoryId } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        categoryId: z.uuid().optional(),
      })
      .parse(request.query ?? {})
    const conditions = [eq(lessons.isPublished, true), eq(lessons.status, 1)]
    if (categoryId) conditions.push(eq(lessons.categoryId, categoryId))
    const where = and(...conditions)
    const offset = (page - 1) * pageSize
    const [rows, totalRows] = await Promise.all([
      dbRead
        .select(courseColumns)
        .from(lessons)
        .where(where)
        .orderBy(desc(lessons.createdAt))
        .limit(pageSize)
        .offset(offset),
      dbRead
        .select({ total: sql<number>`count(*)::int` })
        .from(lessons)
        .where(where),
    ])
    const list = rows.map(toCourseRow)
    return withPublicEdgeCache(reply).send(
      success({ list, total: totalRows[0]?.total ?? 0, page, pageSize }),
    )
  })

  // GET /content/course/:id - 课程详情(与列表同表同投影,另挂 lesson_chapters 组成的章节大纲)
  server.get('/content/course/:id', async (request, reply) => {
    const parsed = z
      .object({ id: z.uuid('课程 id 必须是 UUID') })
      .safeParse((request.params ?? {}) as { id?: string })
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await dbRead
      .select(courseColumns)
      .from(lessons)
      .where(
        and(eq(lessons.id, parsed.data.id), eq(lessons.isPublished, true), eq(lessons.status, 1)),
      )
      .limit(1)
    const row = rows[0]
    if (!row) return reply.status(404).send(error(404, '课程不存在或未发布'))
    // 章节没有"时长/简介"列 ⇒ duration/description 落空串,由端上决定不渲染,而不是在服务端造数
    const chapters = await findLessonChapters(parsed.data.id)
    return reply.send(
      success({
        ...toCourseRow(row),
        outline: chapters.map((c) => ({ title: c.title, duration: '', description: '' })),
      }),
    )
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
