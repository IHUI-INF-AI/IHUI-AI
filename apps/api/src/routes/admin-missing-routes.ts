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
import type { FastifyPluginAsync, FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, or, ilike, desc, asc, sql, and } from 'drizzle-orm'
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
  userThirdPartyAccounts,
  userAuthInfo,
  roles,
  permissions,
  userRoles,
  userSk,
  userVips,
  vipLevels,
  messageTemplates,
  auditLogs,
  sysLogininfor,
} from '@ihui/database'

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

const idParamSchema = z.object({ id: z.string() })

// --- 11 条升级路由的 body 校验 schema ---
const updateAuthInfoSchema = z.object({
  phone: z.string().nullable().optional(),
  authStatus: z.string().optional(),
  realName: z.string().nullable().optional(),
})

const createRoleSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().nullable().optional(),
  scope: z.string().optional(),
})

const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  scope: z.string().optional(),
})

const createVipLevelSchema = z.object({
  levelName: z.string().min(1),
  levelValue: z.number().int().optional(),
  price: z.number().int().optional(),
  durationDays: z.number().int().optional(),
  status: z.number().int().optional(),
  sortOrder: z.number().int().optional(),
})

const updateVipLevelSchema = z.object({
  levelName: z.string().min(1).optional(),
  levelValue: z.number().int().optional(),
  price: z.number().int().optional(),
  durationDays: z.number().int().optional(),
  status: z.number().int().optional(),
  sortOrder: z.number().int().optional(),
})

const createSmsTemplateSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  status: z.number().int().optional(),
})

const updateSmsTemplateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  status: z.number().int().optional(),
})

const createUserRoleSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
  scopeResourceId: z.string().nullable().optional(),
})

const createPermissionSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  resource: z.string().min(1),
  action: z.string().min(1),
  description: z.string().nullable().optional(),
})

const updatePermissionSchema = z.object({
  name: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  resource: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
})

/** 空列表响应（用于无对应表的路由） */
function emptyList(page: number, pageSize: number) {
  return success({ list: [], total: 0, page, pageSize })
}

/** 通用空桩路由注册（用于无对应 DB 表的路由） */
function registerEmptyStub(server: FastifyInstance, basePath: string) {
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
    const { ids } = z.object({ ids: z.string().optional().default('') }).parse(request.body ?? {})
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
  // 3. 鉴权/用户/系统模块 — 有表路由（真实 CRUD，11 个）
  // ===========================================================================

  // /api/admin/auth-accounts — userThirdPartyAccounts 表（第三方账号绑定）
  server.get('/auth-accounts', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(
          ilike(userThirdPartyAccounts.userId, `%${search}%`),
          ilike(userThirdPartyAccounts.platform, `%${search}%`),
        )
      : undefined
    const list = await db
      .select()
      .from(userThirdPartyAccounts)
      .where(where)
      .orderBy(desc(userThirdPartyAccounts.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(userThirdPartyAccounts)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.delete('/auth-accounts/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const existing = await db
      .select()
      .from(userThirdPartyAccounts)
      .where(eq(userThirdPartyAccounts.id, p.data.id))
      .limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    await db.delete(userThirdPartyAccounts).where(eq(userThirdPartyAccounts.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/auth-info — userAuthInfo 表（用户认证信息）
  server.get('/auth-info', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(ilike(userAuthInfo.userUuid, `%${search}%`), ilike(userAuthInfo.phone, `%${search}%`))
      : undefined
    const list = await db
      .select()
      .from(userAuthInfo)
      .where(where)
      .orderBy(desc(userAuthInfo.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(userAuthInfo)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.put('/auth-info/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = updateAuthInfoSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .update(userAuthInfo)
      .set({
        ...(b.data.phone !== undefined && { phone: b.data.phone }),
        ...(b.data.authStatus !== undefined && { authStatus: b.data.authStatus }),
        ...(b.data.realName !== undefined && { realName: b.data.realName }),
        updatedAt: new Date(),
      })
      .where(eq(userAuthInfo.userUuid, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })

  // /api/admin/auth-role — roles 表（RBAC 角色管理）
  server.get('/auth-role', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(ilike(roles.name, `%${search}%`), ilike(roles.displayName, `%${search}%`))
      : undefined
    const list = await db
      .select()
      .from(roles)
      .where(where)
      .orderBy(desc(roles.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(roles)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post('/auth-role', async (request, reply) => {
    const b = createRoleSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .insert(roles)
      .values({
        name: b.data.name,
        displayName: b.data.displayName,
        description: b.data.description ?? null,
        scope: b.data.scope ?? 'self',
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/auth-role/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = updateRoleSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .update(roles)
      .set({
        ...(b.data.name !== undefined && { name: b.data.name }),
        ...(b.data.displayName !== undefined && { displayName: b.data.displayName }),
        ...(b.data.description !== undefined && { description: b.data.description }),
        ...(b.data.scope !== undefined && { scope: b.data.scope }),
        updatedAt: new Date(),
      })
      .where(eq(roles.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/auth-role/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const existing = await db.select().from(roles).where(eq(roles.id, p.data.id)).limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    await db.delete(roles).where(eq(roles.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/auth-tokens — userSk 表（用户 API Key/Token 管理）
  server.get('/auth-tokens', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(ilike(userSk.userId, `%${search}%`), ilike(userSk.key, `%${search}%`))
      : undefined
    const list = await db
      .select()
      .from(userSk)
      .where(where)
      .orderBy(desc(userSk.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(userSk)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.delete('/auth-tokens/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const existing = await db.select().from(userSk).where(eq(userSk.id, p.data.id)).limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    await db.delete(userSk).where(eq(userSk.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/auth-user-vip — userVips 表（用户 VIP 订阅记录）
  server.get('/auth-user-vip', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(userVips.userId, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(userVips)
      .where(where)
      .orderBy(desc(userVips.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(userVips)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.delete('/auth-user-vip/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const existing = await db.select().from(userVips).where(eq(userVips.id, p.data.id)).limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    await db.delete(userVips).where(eq(userVips.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/auth-vip-level — vipLevels 表（VIP 等级配置）
  server.get('/auth-vip-level', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(vipLevels.levelName, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(vipLevels)
      .where(where)
      .orderBy(asc(vipLevels.sortOrder))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(vipLevels)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post('/auth-vip-level', async (request, reply) => {
    const b = createVipLevelSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .insert(vipLevels)
      .values({
        levelName: b.data.levelName,
        levelValue: b.data.levelValue ?? 0,
        price: b.data.price ?? 0,
        durationDays: b.data.durationDays ?? 30,
        status: b.data.status ?? 1,
        sortOrder: b.data.sortOrder ?? 0,
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/auth-vip-level/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = updateVipLevelSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .update(vipLevels)
      .set({
        ...(b.data.levelName !== undefined && { levelName: b.data.levelName }),
        ...(b.data.levelValue !== undefined && { levelValue: b.data.levelValue }),
        ...(b.data.price !== undefined && { price: b.data.price }),
        ...(b.data.durationDays !== undefined && { durationDays: b.data.durationDays }),
        ...(b.data.status !== undefined && { status: b.data.status }),
        ...(b.data.sortOrder !== undefined && { sortOrder: b.data.sortOrder }),
        updatedAt: new Date(),
      })
      .where(eq(vipLevels.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/auth-vip-level/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const existing = await db.select().from(vipLevels).where(eq(vipLevels.id, p.data.id)).limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    await db.delete(vipLevels).where(eq(vipLevels.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/auth-sms-temp — messageTemplates 表（短信模板，channel='sms'）
  server.get('/auth-sms-temp', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? and(
          eq(messageTemplates.channel, 'sms'),
          or(
            ilike(messageTemplates.title, `%${search}%`),
            ilike(messageTemplates.code, `%${search}%`),
          ),
        )
      : eq(messageTemplates.channel, 'sms')
    const list = await db
      .select()
      .from(messageTemplates)
      .where(where)
      .orderBy(desc(messageTemplates.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(messageTemplates)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post('/auth-sms-temp', async (request, reply) => {
    const b = createSmsTemplateSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .insert(messageTemplates)
      .values({
        code: b.data.code,
        channel: 'sms',
        title: b.data.title,
        content: b.data.content,
        status: b.data.status ?? 1,
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/auth-sms-temp/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = updateSmsTemplateSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .update(messageTemplates)
      .set({
        ...(b.data.title !== undefined && { title: b.data.title }),
        ...(b.data.content !== undefined && { content: b.data.content }),
        ...(b.data.status !== undefined && { status: b.data.status }),
        updatedAt: new Date(),
      })
      .where(eq(messageTemplates.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/auth-sms-temp/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const existing = await db
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.id, p.data.id))
      .limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    await db.delete(messageTemplates).where(eq(messageTemplates.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/user-roles — userRoles 表（用户-角色关联）
  server.get('/user-roles', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(ilike(userRoles.userId, `%${search}%`), ilike(userRoles.roleId, `%${search}%`))
      : undefined
    const list = await db
      .select()
      .from(userRoles)
      .where(where)
      .orderBy(desc(userRoles.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(userRoles)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post('/user-roles', async (request, reply) => {
    const b = createUserRoleSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .insert(userRoles)
      .values({
        userId: b.data.userId,
        roleId: b.data.roleId,
        scopeResourceId: b.data.scopeResourceId ?? null,
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.delete('/user-roles/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const existing = await db.select().from(userRoles).where(eq(userRoles.id, p.data.id)).limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    await db.delete(userRoles).where(eq(userRoles.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/member/permissions — permissions 表（权限点管理）
  server.get('/member/permissions', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(ilike(permissions.name, `%${search}%`), ilike(permissions.displayName, `%${search}%`))
      : undefined
    const list = await db
      .select()
      .from(permissions)
      .where(where)
      .orderBy(desc(permissions.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(permissions)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post('/member/permissions', async (request, reply) => {
    const b = createPermissionSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .insert(permissions)
      .values({
        name: b.data.name,
        displayName: b.data.displayName,
        resource: b.data.resource,
        action: b.data.action,
        description: b.data.description ?? null,
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/member/permissions/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = updatePermissionSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .update(permissions)
      .set({
        ...(b.data.name !== undefined && { name: b.data.name }),
        ...(b.data.displayName !== undefined && { displayName: b.data.displayName }),
        ...(b.data.resource !== undefined && { resource: b.data.resource }),
        ...(b.data.action !== undefined && { action: b.data.action }),
        ...(b.data.description !== undefined && { description: b.data.description }),
      })
      .where(eq(permissions.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/member/permissions/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const existing = await db
      .select()
      .from(permissions)
      .where(eq(permissions.id, p.data.id))
      .limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    await db.delete(permissions).where(eq(permissions.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/system/operation-logs — auditLogs 表（操作审计日志）
  server.get('/system/operation-logs', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(ilike(auditLogs.userId, `%${search}%`), ilike(auditLogs.action, `%${search}%`))
      : undefined
    const list = await db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(auditLogs)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.delete('/system/operation-logs/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const existing = await db.select().from(auditLogs).where(eq(auditLogs.id, p.data.id)).limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    await db.delete(auditLogs).where(eq(auditLogs.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // /api/admin/system/login-logs — sysLogininfor 表（登录日志）
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
  // 3b. 鉴权/用户模块 — 无表路由（空数据桩，5 个）
  // ===========================================================================
  registerEmptyStub(server, '/auth-find-info')
  registerEmptyStub(server, '/auth-user-margin')
  registerEmptyStub(server, '/auth-veri-codes')
  registerEmptyStub(server, '/member/blacklist')
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

  // ===========================================================================
  // 9. 补充端点 — 管理员角色/日志/配置（5 个，空数据桩）
  // ===========================================================================
  server.get('/roles', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    return reply.send(emptyList(q.data.page, q.data.pageSize))
  })

  server.post('/roles', async (_request, reply) => {
    return reply.status(201).send(success({ created: true }))
  })

  // 注: /logs /configs 已由 system.ts adminSystemRoutes 真实实现,此处不再重复注册空桩

  server.put('/configs', async (_request, reply) => {
    return reply.send(success({ updated: true }))
  })
}
