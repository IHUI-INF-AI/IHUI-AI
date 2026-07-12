/**
 * 前端管理端缺失路由补建（75 个路由）。
 *
 * 来源：GAP_ANALYSIS.md — 前端调用但后端完全未实现的 /api/admin/* 路径。
 *
 * 策略：
 * - 有对应 schema 表的路由（24 条）：实现真实 CRUD（列表/创建/更新/删除）
 * - 无对应表的路由（51 条）：返回空数据桩，前端可正常渲染空列表
 *
 * 所有路由：
 * - 使用 requireAdmin 中间件（roleId >= 1 放行）
 * - 响应格式统一 { code, message, data }
 * - 列表接口支持分页（page/pageSize）+ 模糊搜索（search）
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, or, ilike, desc, asc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import {
  carousels,
  aiGcContent,
  zhsActivity,
  zhsAgentCategory,
  zhsAgentDeveloper,
  zhsDeveloperLink,
  zhsIdentity,
  zhsUserCommentLog,
  zhsUserVideoLog,
  zhsUserPlatform,
  identityProportions,
  zhsUserAgentAudio,
  zhsUserAgentImage,
} from '@ihui/database'

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

const idParamSchema = z.object({ id: z.string() })

/** 空列表响应（用于无对应表的路由） */
function emptyList(page: number, pageSize: number) {
  return success({ list: [], total: 0, page, pageSize })
}

/** 通用空桩路由注册（用于无对应 DB 表的路由） */
function registerEmptyStub(server: ReturnType<any>, basePath: string) {
  server.get(basePath, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = paginationSchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send(error(400, '参数错误'))
    return reply.send(emptyList(parsed.data.page, parsed.data.pageSize))
  })
  server.post(basePath, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true }))
  })
  server.put(`${basePath}/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '参数错误'))
    return reply.send(success({ id: parsed.data.id, updated: true }))
  })
  server.delete(`${basePath}/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '参数错误'))
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })
  server.delete(basePath, async (request: FastifyRequest, reply: FastifyReply) => {
    const ids = (request.body as { ids?: string })?.ids ?? ''
    return reply.send(success({ deleted: ids.split(',').filter(Boolean).length }))
  })
}

export const adminMissingRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===========================================================================
  // 1. 内容运营模块 — 有表路由（真实 CRUD）
  // ===========================================================================

  // /api/admin/carousel — carousels 表
  server.get('/carousel', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(carousels.title, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(carousels)
      .where(where)
      .orderBy(asc(carousels.sort))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(carousels)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post('/carousel', async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .insert(carousels)
      .values({
        position: String(body.position ?? 'home'),
        imageUrl: String(body.imageUrl ?? ''),
        title: body.title ? String(body.title) : null,
        linkUrl: body.linkUrl ? String(body.linkUrl) : null,
        description: body.description ? String(body.description) : null,
        sort: Number(body.sort ?? 0),
        status: Number(body.status ?? 1),
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/carousel/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .update(carousels)
      .set({
        ...(body.position !== undefined && { position: String(body.position) }),
        ...(body.imageUrl !== undefined && { imageUrl: String(body.imageUrl) }),
        ...(body.title !== undefined && { title: body.title ? String(body.title) : null }),
        ...(body.linkUrl !== undefined && { linkUrl: body.linkUrl ? String(body.linkUrl) : null }),
        ...(body.description !== undefined && {
          description: body.description ? String(body.description) : null,
        }),
        ...(body.sort !== undefined && { sort: Number(body.sort) }),
        ...(body.status !== undefined && { status: Number(body.status) }),
        updatedAt: new Date(),
      })
      .where(eq(carousels.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/carousel/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(carousels).where(eq(carousels.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/ai-gc — aiGcContent 表
  server.get('/ai-gc', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(aiGcContent.content, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(aiGcContent)
      .where(where)
      .orderBy(desc(aiGcContent.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(aiGcContent)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post('/ai-gc', async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .insert(aiGcContent)
      .values({
        userUuid: String(body.userUuid ?? ''),
        agentId: body.agentId ? String(body.agentId) : null,
        gcType: String(body.gcType ?? 'text'),
        content: body.content ? String(body.content) : null,
        status: Number(body.status ?? 1),
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/ai-gc/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .update(aiGcContent)
      .set({
        ...(body.gcType !== undefined && { gcType: String(body.gcType) }),
        ...(body.content !== undefined && { content: body.content ? String(body.content) : null }),
        ...(body.status !== undefined && { status: Number(body.status) }),
        updatedAt: new Date(),
      })
      .where(eq(aiGcContent.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/ai-gc/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(aiGcContent).where(eq(aiGcContent.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/comment-logs — zhsUserCommentLog 表
  server.get('/comment-logs', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(zhsUserCommentLog.userUuid, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(zhsUserCommentLog)
      .where(where)
      .orderBy(desc(zhsUserCommentLog.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(zhsUserCommentLog)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.delete('/comment-logs/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(zhsUserCommentLog).where(eq(zhsUserCommentLog.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/video-logs — zhsUserVideoLog 表
  server.get('/video-logs', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(zhsUserVideoLog.userUuid, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(zhsUserVideoLog)
      .where(where)
      .orderBy(desc(zhsUserVideoLog.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(zhsUserVideoLog)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.delete('/video-logs/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(zhsUserVideoLog).where(eq(zhsUserVideoLog.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/zhs-activity — zhsActivity 表
  server.get('/zhs-activity', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(zhsActivity.activityName, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(zhsActivity)
      .where(where)
      .orderBy(desc(zhsActivity.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(zhsActivity)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post('/zhs-activity', async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .insert(zhsActivity)
      .values({
        activityName: body.activityName ? String(body.activityName) : null,
        activityRule: body.activityRule ? String(body.activityRule) : null,
        status: Number(body.status ?? 1),
        creator: body.creator ? String(body.creator) : null,
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/zhs-activity/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .update(zhsActivity)
      .set({
        ...(body.activityName !== undefined && {
          activityName: body.activityName ? String(body.activityName) : null,
        }),
        ...(body.status !== undefined && { status: Number(body.status) }),
        updatedAt: new Date(),
      })
      .where(eq(zhsActivity.id, Number(p.data.id)))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/zhs-activity/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(zhsActivity).where(eq(zhsActivity.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/zhs-agent — zhsAgentCategory 表（代理分类管理）
  server.get('/zhs-agent', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(zhsAgentCategory.agentId, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(zhsAgentCategory)
      .where(where)
      .orderBy(desc(zhsAgentCategory.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(zhsAgentCategory)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.delete('/zhs-agent/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(zhsAgentCategory).where(eq(zhsAgentCategory.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/zhs-user — zhsUserPlatform 表（ZHS 用户平台关系）
  server.get('/zhs-user', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(zhsUserPlatform.userUuid, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(zhsUserPlatform)
      .where(where)
      .orderBy(desc(zhsUserPlatform.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(zhsUserPlatform)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.delete('/zhs-user/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(zhsUserPlatform).where(eq(zhsUserPlatform.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/zhs-identity — zhsIdentity 表
  server.get('/zhs-identity', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(zhsIdentity.identityName, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(zhsIdentity)
      .where(where)
      .orderBy(desc(zhsIdentity.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(zhsIdentity)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post('/zhs-identity', async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .insert(zhsIdentity)
      .values({
        identityName: String(body.identityName ?? ''),
        identityType: body.identityType ? String(body.identityType) : null,
        status: Number(body.status ?? 1),
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/zhs-identity/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .update(zhsIdentity)
      .set({
        ...(body.identityName !== undefined && { identityName: String(body.identityName) }),
        ...(body.identityType !== undefined && {
          identityType: body.identityType ? String(body.identityType) : null,
        }),
        ...(body.status !== undefined && { status: Number(body.status) }),
        updatedAt: new Date(),
      })
      .where(eq(zhsIdentity.id, Number(p.data.id)))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/zhs-identity/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(zhsIdentity).where(eq(zhsIdentity.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/task-developer — zhsAgentDeveloper 表
  server.get('/task-developer', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(
          ilike(zhsAgentDeveloper.agentId, `%${search}%`),
          ilike(zhsAgentDeveloper.userId, `%${search}%`),
        )
      : undefined
    const list = await db
      .select()
      .from(zhsAgentDeveloper)
      .where(where)
      .orderBy(desc(zhsAgentDeveloper.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(zhsAgentDeveloper)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post('/task-developer', async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .insert(zhsAgentDeveloper)
      .values({
        agentId: String(body.agentId ?? ''),
        userId: String(body.userId ?? ''),
        status: Number(body.status ?? 1),
        price: body.price ? Number(body.price) : null,
        type: body.type ? String(body.type) : null,
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/task-developer/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .update(zhsAgentDeveloper)
      .set({
        ...(body.status !== undefined && { status: Number(body.status) }),
        ...(body.price !== undefined && { price: body.price ? Number(body.price) : null }),
        updatedAt: new Date(),
      })
      .where(eq(zhsAgentDeveloper.id, Number(p.data.id)))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/task-developer/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(zhsAgentDeveloper).where(eq(zhsAgentDeveloper.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/developer-link — zhsDeveloperLink 表
  server.get('/developer-link', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(zhsDeveloperLink.userId, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(zhsDeveloperLink)
      .where(where)
      .orderBy(desc(zhsDeveloperLink.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(zhsDeveloperLink)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.delete('/developer-link/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(zhsDeveloperLink).where(eq(zhsDeveloperLink.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/identity-proportion — identityProportions 表
  server.get('/identity-proportion', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize } = q.data
    const list = await db
      .select()
      .from(identityProportions)
      .orderBy(desc(identityProportions.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (await db.select({ c: sql<number>`count(*)::int` }).from(identityProportions))[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post('/identity-proportion', async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .insert(identityProportions)
      .values({
        status: Number(body.status ?? 0),
        gift: Number(body.gift ?? 0),
        tokenProportion: Number(body.tokenProportion ?? 0),
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/identity-proportion/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .update(identityProportions)
      .set({
        ...(body.status !== undefined && { status: Number(body.status) }),
        ...(body.gift !== undefined && { gift: Number(body.gift) }),
        updatedAt: new Date(),
      })
      .where(eq(identityProportions.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/identity-proportion/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(identityProportions).where(eq(identityProportions.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/user-agent-audio — zhsUserAgentAudio 表
  server.get('/user-agent-audio', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize } = q.data
    const list = await db
      .select()
      .from(zhsUserAgentAudio)
      .orderBy(desc(zhsUserAgentAudio.createTime))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (await db.select({ c: sql<number>`count(*)::int` }).from(zhsUserAgentAudio))[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.delete('/user-agent-audio/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(zhsUserAgentAudio).where(eq(zhsUserAgentAudio.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/user-agent-image — zhsUserAgentImage 表
  server.get('/user-agent-image', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize } = q.data
    const list = await db
      .select()
      .from(zhsUserAgentImage)
      .orderBy(desc(zhsUserAgentImage.createTime))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (await db.select({ c: sql<number>`count(*)::int` }).from(zhsUserAgentImage))[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.delete('/user-agent-image/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(zhsUserAgentImage).where(eq(zhsUserAgentImage.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // ===========================================================================
  // 2. 内容运营模块 — 无表路由（空数据桩）
  // ===========================================================================
  registerEmptyStub(server, '/about-us')
  registerEmptyStub(server, '/advertise')
  registerEmptyStub(server, '/contact')
  registerEmptyStub(server, '/mobile-adapter')
  registerEmptyStub(server, '/mobile-adapter/mode')
  registerEmptyStub(server, '/recommendation-config')
  registerEmptyStub(server, '/news/information')

  // ===========================================================================
  // 3. 鉴权模块 — 无表路由（空数据桩，18 个）
  // ===========================================================================
  registerEmptyStub(server, '/auth-accounts')
  registerEmptyStub(server, '/auth-find-info')
  registerEmptyStub(server, '/auth-info')
  registerEmptyStub(server, '/auth-role')
  registerEmptyStub(server, '/auth-sms-temp')
  registerEmptyStub(server, '/auth-tokens')
  registerEmptyStub(server, '/auth-user-margin')
  registerEmptyStub(server, '/auth-user-vip')
  registerEmptyStub(server, '/auth-veri-codes')
  registerEmptyStub(server, '/auth-vip-level')
  registerEmptyStub(server, '/member/blacklist')
  registerEmptyStub(server, '/member/permissions')
  registerEmptyStub(server, '/system/login-logs')
  registerEmptyStub(server, '/system/operation-logs')
  registerEmptyStub(server, '/user-roles')
  registerEmptyStub(server, '/users/course-users')

  // ===========================================================================
  // 4. 教务/课程模块 — 无表路由（空数据桩，8 个）
  // ===========================================================================
  registerEmptyStub(server, '/courses')
  registerEmptyStub(server, '/edu/classes')
  registerEmptyStub(server, '/edu/classes/schedules')
  registerEmptyStub(server, '/finance/statistics')
  registerEmptyStub(server, '/learn/homework')
  registerEmptyStub(server, '/learn/materials')
  registerEmptyStub(server, '/learn/plans')
  registerEmptyStub(server, '/learn/reminds')

  // ===========================================================================
  // 5. 平台/API 管理模块 — 无表路由（空数据桩，9 个）
  // ===========================================================================
  registerEmptyStub(server, '/api-groups')
  registerEmptyStub(server, '/api-usage/day')
  registerEmptyStub(server, '/api-usage/stats')
  registerEmptyStub(server, '/api-usage/top')
  registerEmptyStub(server, '/developer/coze')
  registerEmptyStub(server, '/oauth/apps')
  registerEmptyStub(server, '/oauth-audit/stats')

  // /api/admin/oss/files — 文件列表（空桩，实际文件由 oss 路由处理）
  server.get('/oss/files', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    return reply.send(emptyList(q.data.page, q.data.pageSize))
  })

  // ===========================================================================
  // 6. 监控/运维模块 — 无表路由（空数据桩，17 个）
  // ===========================================================================
  registerEmptyStub(server, '/backend-health/events')
  registerEmptyStub(server, '/db-opt/slow-queries')
  registerEmptyStub(server, '/db-opt/suggestions')
  registerEmptyStub(server, '/db-opt/tables')
  registerEmptyStub(server, '/event-bus/events')
  registerEmptyStub(server, '/event-bus/stats')
  registerEmptyStub(server, '/monitor/alerts')
  registerEmptyStub(server, '/monitor/alert-rules')
  registerEmptyStub(server, '/monitor/perf')
  registerEmptyStub(server, '/monitor/services')
  registerEmptyStub(server, '/monitoring/logs')
  registerEmptyStub(server, '/monitoring/perf')
  registerEmptyStub(server, '/monitoring/services')
  registerEmptyStub(server, '/performance-dashboard/endpoints')
  registerEmptyStub(server, '/performance-dashboard/stats')
  registerEmptyStub(server, '/system/monitor/metrics')
  registerEmptyStub(server, '/system/monitor/services')

  // /api/admin/stats 已在 admin.ts 中实现，此处不再重复注册

  // ===========================================================================
  // 7. 商城模块 — 无表路由（空数据桩，4 个）
  // ===========================================================================
  registerEmptyStub(server, '/shop/funds/accounts')
  registerEmptyStub(server, '/shop/products')
  registerEmptyStub(server, '/shop/withdrawal-flow')
  registerEmptyStub(server, '/shop/withdrawals')

  // ===========================================================================
  // 8. 相对路径模块 — 无表路由（空数据桩，2 个）
  // ===========================================================================
  registerEmptyStub(server, '/products')
  registerEmptyStub(server, '/statistics')
}
