/**
 * /api/admin/system/login-logs 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import {
  sysLogininfor,
  lessons,
  zhsCourseVideo,
  zhsCourseTemp,
  zhsCourseVideoTemp,
  cozeVariables,
  oauthApps,
} from '@ihui/database'
import { eq, ilike, desc, sql, or } from 'drizzle-orm'
import {
  paginationSchema,
  idParamSchema,
  registerCrud,
  fields,
  createLoginLogSchema,
  updateLoginLogSchema,
} from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const systemLoginLogsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
  server.get('/system/login-logs', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(
          ilike(sysLogininfor.loginName, `%${search}%`),
          ilike(sysLogininfor.ipaddr, `%${search}%`),
        )
      : undefined
    const list = await db
      .select()
      .from(sysLogininfor)
      .where(where)
      .orderBy(desc(sysLogininfor.loginTime))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(sysLogininfor)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.get('/system/login-logs/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .select()
      .from(sysLogininfor)
      .where(eq(sysLogininfor.infoId, Number(p.data.id)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.post('/system/login-logs', async (request, reply) => {
    const b = createLoginLogSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .insert(sysLogininfor)
      .values({
        loginName: b.data.loginName ?? null,
        ipaddr: b.data.ipaddr ?? null,
        loginLocation: b.data.loginLocation ?? null,
        browser: b.data.browser ?? null,
        os: b.data.os ?? null,
        status: b.data.status ?? '0',
        msg: b.data.msg ?? null,
        loginTime: b.data.loginTime ? new Date(b.data.loginTime) : new Date(),
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/system/login-logs/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = updateLoginLogSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .update(sysLogininfor)
      .set({
        ...(b.data.loginName !== undefined && { loginName: b.data.loginName }),
        ...(b.data.ipaddr !== undefined && { ipaddr: b.data.ipaddr }),
        ...(b.data.loginLocation !== undefined && { loginLocation: b.data.loginLocation }),
        ...(b.data.browser !== undefined && { browser: b.data.browser }),
        ...(b.data.os !== undefined && { os: b.data.os }),
        ...(b.data.status !== undefined && { status: b.data.status }),
        ...(b.data.msg !== undefined && { msg: b.data.msg }),
        ...(b.data.loginTime !== undefined && {
          loginTime: b.data.loginTime ? new Date(b.data.loginTime) : new Date(),
        }),
      })
      .where(eq(sysLogininfor.infoId, Number(p.data.id)))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/system/login-logs/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const existing = await db
      .select()
      .from(sysLogininfor)
      .where(eq(sysLogininfor.infoId, Number(p.data.id)))
      .limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    await db.delete(sysLogininfor).where(eq(sysLogininfor.infoId, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // ===========================================================================
  // 3b. 鉴权/用户模块 — 路由已迁移至 admin-auth-edu-routes.ts
  // ===========================================================================

  // ===========================================================================
  // 4. 教务/课程模块 — 无表路由（空数据桩，8 个）
  // ===========================================================================
  registerCrud(server, '/courses', lessons, {
    searchField: lessons.title,
    map: fields({
      title: 'string',
      coverImage: 'string',
      intro: 'string',
      categoryId: 'string',
      lecturerId: 'string',
      lecturerName: 'string',
      price: 'string',
      originalPrice: 'string',
      isFree: 'boolean',
      isPublished: 'boolean',
      sort: 'number',
      viewCount: 'number',
      signupCount: 'number',
      lessonCount: 'number',
      status: 'number',
    }),
  })

  // ========== 课程审计比较 + 回收站还原端点（前端 audit/trash 页面调用） ==========

  // GET /courses/:id - 课程详情（审计比较 before 快照）
  server.get('/courses/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db.select().from(lessons).where(eq(lessons.id, p.data.id)).limit(1)
    if (!row) return reply.status(404).send(error(404, '课程不存在'))
    return reply.send(success(row))
  })

  // GET /courses/temp/:id - 课程临时表详情（审计比较 after 快照）
  server.get('/courses/temp/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .select()
      .from(zhsCourseTemp)
      .where(eq(zhsCourseTemp.id, Number(p.data.id)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '临时课程不存在'))
    return reply.send(success(row))
  })

  // POST /courses/:id/restore - 软删除还原（status=0 → status=1）
  server.post('/courses/:id/restore', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .update(lessons)
      .set({ status: 1, updatedAt: new Date() })
      .where(eq(lessons.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '课程不存在'))
    return reply.send(success(row))
  })

  // GET /course-videos/:id - 课程视频详情（审计比较 before 快照）
  server.get('/course-videos/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .select()
      .from(zhsCourseVideo)
      .where(eq(zhsCourseVideo.id, Number(p.data.id)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '视频不存在'))
    return reply.send(success(row))
  })

  // GET /course-videos/temp/:id - 课程视频临时表详情（审计比较 after 快照）
  server.get('/course-videos/temp/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .select()
      .from(zhsCourseVideoTemp)
      .where(eq(zhsCourseVideoTemp.id, Number(p.data.id)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '临时视频不存在'))
    return reply.send(success(row))
  })

  // /learn/homework, /edu/classes, /edu/classes/schedules, /finance/statistics — 已迁移至 learn.ts / admin-monitoring-routes.ts / admin-auth-edu-routes.ts
  // /learn/materials, /learn/plans, /learn/reminds — 已迁移至 admin-auth-edu-routes.ts

  // ===========================================================================
  // 5. 平台/API 管理模块 — 路由已迁移至 admin-monitoring-routes.ts / admin-shop-routes.ts
  // ===========================================================================
  registerCrud(server, '/developer/coze', cozeVariables, {
    searchField: cozeVariables.variableName,
    map: fields({
      botId: 'string',
      variableName: 'string',
      variableValue: 'string',
      description: 'string',
      dataType: 'string',
    }),
  })
  // PATCH/PUT /developer/coze/:id/status — 状态切换（cozeVariables 表无 status 字段，返回成功桩）
  server.put('/developer/coze/:id/status', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    return reply.send(
      success({
        id: p.data.id,
        status: (request.body as { status?: number })?.status ?? 0,
        updated: true,
      }),
    )
  })

  registerCrud(server, '/oauth/apps', oauthApps, {
    searchField: oauthApps.name,
    map: fields({
      clientId: 'string',
      clientSecret: 'string',
      name: 'string',
      description: 'string',
      redirectUris: 'json',
      scopes: 'json',
      icon: 'string',
      ownerUuid: 'string',
      isActive: 'number',
    }),
  })
  // PATCH /oauth/apps/:id/status — 状态切换（前端传 active|disabled，转换为 isActive 0|1）
  server.patch('/oauth/apps/:id/status', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = z.object({ status: z.string().max(32) }).safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .update(oauthApps)
      .set({ isActive: b.data.status === 'active' ? 1 : 0, updatedAt: new Date() })
      .where(eq(oauthApps.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  // /oauth-audit/stats — 已迁移至 admin-monitoring-routes.ts
}

export default systemLoginLogsRoutes
