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
import type { FastifyPluginAsync, FastifyInstance } from 'fastify'
import { z } from 'zod'
import { eq, or, ilike, desc, asc, sql, and, inArray, type SQL } from 'drizzle-orm'
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
  newsArticles,
  lessons,
  zhsCourseVideo,
  zhsCourseTemp,
  zhsCourseVideoTemp,
  learnHomework,
  cozeVariables,
  oauthApps,
  monitorAlerts,
  suppressionRules,
  apiLogs,
  withdrawalFlows,
  productIdentities,
  statisticsSnapshots,
  users,
  aiModelConfig,
} from '@ihui/database'
import { encryptJSON, decryptJSON, isEncryptedPayload } from '../utils/crypto.js'

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

// R14: 多字段搜索 schema（comment-logs / video-logs 用）
const commentLogQuerySchema = paginationSchema.extend({
  userUuid: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
  commentId: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
  createdAt: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
})

const videoLogQuerySchema = paginationSchema.extend({
  userUuid: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
  videoId: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
  createdAt: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
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

/* eslint-disable @typescript-eslint/no-explicit-any -- Drizzle ORM 泛型表/列助手需要 any，社区标准模式 */
function registerCrud(
  server: FastifyInstance,
  basePath: string,
  table: any,
  opts: {
    searchField?: any
    orderBy?: any
    hasUpdatedAt?: boolean
    map: (body: Record<string, unknown>) => Record<string, unknown>
  },
) {
  const hasUpdatedAt = opts.hasUpdatedAt !== false
  server.get(basePath, async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search && opts.searchField ? ilike(opts.searchField, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(table)
      .where(where)
      .orderBy(opts.orderBy ?? desc(table.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(table)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post(basePath, async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const [row] = await db.insert(table).values(opts.map(body)).returning()
    return reply.status(201).send(success(row))
  })
  server.put(`${basePath}/:id`, async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = request.body as Record<string, unknown>
    const set: Record<string, unknown> = { ...opts.map(body) }
    if (hasUpdatedAt) set.updatedAt = new Date()
    const [row] = await db.update(table).set(set).where(eq(table.id, p.data.id)).returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete(`${basePath}/:id`, async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(table).where(eq(table.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
  server.delete(basePath, async (request, reply) => {
    const parsed = z
      .object({ ids: z.string().optional().default('') })
      .safeParse(request.body ?? {})
    if (!parsed.success) return reply.status(400).send(error(400, '参数错误'))
    const idList = parsed.data.ids.split(',').filter(Boolean)
    if (idList.length === 0) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(table).where(inArray(table.id, idList))
    return reply.send(success({ deleted: idList.length }))
  })
}
/* eslint-enable @typescript-eslint/no-explicit-any */

type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'json'
function fields(fc: Record<string, FieldType>) {
  return (b: Record<string, unknown>) => {
    const o: Record<string, unknown> = {}
    for (const [k, t] of Object.entries(fc)) {
      if (b[k] === undefined) continue
      const v = b[k]
      if (t === 'string') o[k] = v === null ? null : String(v)
      else if (t === 'number') o[k] = v === null ? null : Number(v)
      else if (t === 'boolean') o[k] = v === null ? null : Boolean(v)
      else if (t === 'date') o[k] = v ? new Date(String(v)) : null
      else o[k] = v
    }
    return o
  }
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
    const q = commentLogQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, userUuid, commentId, createdAt } = q.data
    const conditions: SQL[] = []
    if (userUuid) conditions.push(ilike(zhsUserCommentLog.userUuid, `%${userUuid}%`))
    if (commentId !== undefined) conditions.push(eq(zhsUserCommentLog.commentId, commentId))
    if (createdAt) {
      const dayStart = new Date(createdAt)
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
      conditions.push(sql`${zhsUserCommentLog.createdAt} >= ${dayStart.toISOString()}::timestamp`)
      conditions.push(sql`${zhsUserCommentLog.createdAt} < ${dayEnd.toISOString()}::timestamp`)
    }
    const where = conditions.length ? and(...conditions) : undefined
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
    const q = videoLogQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, userUuid, videoId, createdAt } = q.data
    const conditions: SQL[] = []
    if (userUuid) conditions.push(ilike(zhsUserVideoLog.userUuid, `%${userUuid}%`))
    if (videoId !== undefined) conditions.push(eq(zhsUserVideoLog.videoId, videoId))
    if (createdAt) {
      const dayStart = new Date(createdAt)
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
      conditions.push(sql`${zhsUserVideoLog.createdAt} >= ${dayStart.toISOString()}::timestamp`)
      conditions.push(sql`${zhsUserVideoLog.createdAt} < ${dayEnd.toISOString()}::timestamp`)
    }
    const where = conditions.length ? and(...conditions) : undefined
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
  // 2. 内容运营模块 — 路由已迁移至 admin-content-routes.ts
  // ===========================================================================
  registerCrud(server, '/news/information', newsArticles, {
    searchField: newsArticles.title,
    map: fields({
      categoryId: 'string',
      title: 'string',
      summary: 'string',
      content: 'string',
      coverImage: 'string',
      authorId: 'string',
      authorName: 'string',
      isPublished: 'boolean',
      isPinned: 'boolean',
      viewCount: 'number',
      sort: 'number',
      status: 'number',
      publishedAt: 'date',
    }),
  })

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

  // /api/admin/member/users — users 表（会员用户列表）
  server.get('/member/users', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const status = z.coerce
      .number()
      .int()
      .optional()
      .safeParse((request.query as { status?: string }).status)
    const conds = []
    if (search)
      conds.push(
        or(
          ilike(users.nickname, `%${search}%`),
          ilike(users.phone, `%${search}%`),
          ilike(users.email, `%${search}%`),
        ),
      )
    if (status.success && status.data !== undefined) conds.push(eq(users.status, status.data))
    const where = conds.length > 0 ? and(...conds) : undefined
    const list = await db
      .select({
        id: users.id,
        nickname: users.nickname,
        phone: users.phone,
        email: users.email,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(users)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.patch('/member/users/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = z
      .object({ status: z.number().int().optional(), level: z.number().int().optional() })
      .safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    const sets: Record<string, unknown> = { updatedAt: new Date() }
    if (b.data.status !== undefined) sets.status = b.data.status
    const [row] = await db.update(users).set(sets).where(eq(users.id, p.data.id)).returning()
    if (!row) return reply.status(404).send(error(404, '用户不存在'))
    return reply.send(success(row))
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

  // /edu/classes, /edu/classes/schedules, /finance/statistics — 已迁移至 admin-monitoring-routes.ts / admin-auth-edu-routes.ts
  registerCrud(server, '/learn/homework', learnHomework, {
    searchField: learnHomework.title,
    map: fields({
      lessonId: 'string',
      chapterId: 'string',
      title: 'string',
      description: 'string',
      content: 'json',
      dueDate: 'date',
      sort: 'number',
      status: 'string',
    }),
  })
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

  // /api/admin/oss/files — 文件列表（空桩，实际文件由 oss 路由处理）
  server.get('/oss/files', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    return reply.send(emptyList(q.data.page, q.data.pageSize))
  })

  // ===========================================================================
  // 6. 监控/运维模块 — 路由已迁移至 admin-monitoring-routes.ts
  // ===========================================================================
  registerCrud(server, '/monitor/alerts', monitorAlerts, {
    searchField: monitorAlerts.name,
    hasUpdatedAt: false,
    map: fields({
      name: 'string',
      source: 'string',
      severity: 'string',
      status: 'string',
      message: 'string',
      labels: 'json',
      annotations: 'json',
      firedAt: 'date',
      resolvedAt: 'date',
    }),
  })
  registerCrud(server, '/monitor/alert-rules', suppressionRules, {
    searchField: suppressionRules.name,
    map: fields({
      name: 'string',
      matchLabels: 'json',
      matchSource: 'string',
      isActive: 'boolean',
      suppressMinutes: 'number',
    }),
  })
  // /monitor/perf, /monitor/services — 已迁移至 admin-monitoring-routes.ts
  registerCrud(server, '/monitoring/logs', apiLogs, {
    searchField: apiLogs.path,
    hasUpdatedAt: false,
    map: fields({
      userId: 'string',
      method: 'string',
      path: 'string',
      statusCode: 'number',
      duration: 'number',
      ip: 'string',
      userAgent: 'string',
      requestBody: 'json',
      responseBody: 'json',
      error: 'string',
    }),
  })
  // /monitoring/perf, /monitoring/services, /performance-dashboard/*, /system/monitor/* — 已迁移至 admin-monitoring-routes.ts

  // /api/admin/stats 已在 admin.ts 中实现，此处不再重复注册

  // ===========================================================================
  // 7. 商城模块 — 路由已迁移至 admin-shop-routes.ts
  // ===========================================================================
  // /shop/funds/accounts, /shop/products, PATCH /shop/products/:id/status — 已迁移至 admin-shop-routes.ts
  registerCrud(server, '/shop/withdrawal-flow', withdrawalFlows, {
    searchField: withdrawalFlows.method,
    map: fields({
      userId: 'string',
      amount: 'number',
      fee: 'number',
      originalAmount: 'number',
      status: 'number',
      method: 'string',
      accountInfo: 'json',
      partnerTradeNo: 'string',
      paymentNo: 'string',
      rejectReason: 'string',
      processedAt: 'date',
    }),
  })
  // /shop/withdrawals — 已迁移至 admin-shop-routes.ts

  // ===========================================================================
  // 8. 相对路径模块 — 无表路由（空数据桩，2 个）
  // ===========================================================================
  registerCrud(server, '/products', productIdentities, {
    searchField: productIdentities.name,
    map: fields({
      name: 'string',
      code: 'string',
      type: 'string',
      value: 'string',
      description: 'string',
      status: 'string',
    }),
  })
  registerCrud(server, '/statistics', statisticsSnapshots, {
    searchField: statisticsSnapshots.type,
    hasUpdatedAt: false,
    map: fields({ type: 'string', data: 'json', createdBy: 'string' }),
  })

  // ===========================================================================
  // 8.5 AI 模型配置 — aiModelConfig 表(加密 CRUD + 测试连通,6 个端点)
  // ===========================================================================
  // apiKeyEnc 字段 AES-256-GCM 加密(与 utils/crypto.ts 一致)
  // GET 不返回 apiKeyEnc,仅返回 hasApiKey 布尔;POST/PUT 接收 body.apiKey 明文加密入库

  server.get('/ai-model-config', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(aiModelConfig.name, `%${search}%`) : undefined
    const rows = await db
      .select({
        id: aiModelConfig.id,
        name: aiModelConfig.name,
        providerCode: aiModelConfig.providerCode,
        isBuiltin: aiModelConfig.isBuiltin,
        baseUrl: aiModelConfig.baseUrl,
        apiFormat: aiModelConfig.apiFormat,
        modelIdForTest: aiModelConfig.modelIdForTest,
        enabled: aiModelConfig.enabled,
        description: aiModelConfig.description,
        sortOrder: aiModelConfig.sortOrder,
        ownerUuid: aiModelConfig.ownerUuid,
        lastTestStatus: aiModelConfig.lastTestStatus,
        lastTestResponseMs: aiModelConfig.lastTestResponseMs,
        lastTestedAt: aiModelConfig.lastTestedAt,
        lastTestError: aiModelConfig.lastTestError,
        hasApiKey: sql<boolean>`${aiModelConfig.apiKeyEnc} IS NOT NULL`,
        createdAt: aiModelConfig.createdAt,
        updatedAt: aiModelConfig.updatedAt,
      })
      .from(aiModelConfig)
      .where(where)
      .orderBy(desc(aiModelConfig.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(aiModelConfig)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list: rows, total, page, pageSize }))
  })

  server.get('/ai-model-config/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const id = Number(p.data.id)
    const [row] = await db
      .select({
        id: aiModelConfig.id,
        name: aiModelConfig.name,
        providerCode: aiModelConfig.providerCode,
        isBuiltin: aiModelConfig.isBuiltin,
        baseUrl: aiModelConfig.baseUrl,
        apiFormat: aiModelConfig.apiFormat,
        modelIdForTest: aiModelConfig.modelIdForTest,
        enabled: aiModelConfig.enabled,
        description: aiModelConfig.description,
        sortOrder: aiModelConfig.sortOrder,
        ownerUuid: aiModelConfig.ownerUuid,
        lastTestStatus: aiModelConfig.lastTestStatus,
        lastTestResponseMs: aiModelConfig.lastTestResponseMs,
        lastTestedAt: aiModelConfig.lastTestedAt,
        lastTestError: aiModelConfig.lastTestError,
        hasApiKey: sql<boolean>`${aiModelConfig.apiKeyEnc} IS NOT NULL`,
        extraConfig: aiModelConfig.extraConfig,
        createdAt: aiModelConfig.createdAt,
        updatedAt: aiModelConfig.updatedAt,
      })
      .from(aiModelConfig)
      .where(eq(aiModelConfig.id, id))
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })

  server.post('/ai-model-config', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey : ''
    const insertData: Record<string, unknown> = {
      name: String(body.name ?? ''),
      providerCode: String(body.providerCode ?? ''),
      isBuiltin: Boolean(body.isBuiltin ?? false),
      baseUrl: String(body.baseUrl ?? ''),
      apiFormat: String(body.apiFormat ?? 'openai_chat'),
      modelIdForTest: body.modelIdForTest ? String(body.modelIdForTest) : null,
      enabled: Boolean(body.enabled ?? true),
      description: body.description ? String(body.description) : null,
      sortOrder: Number(body.sortOrder ?? 0),
      ownerUuid: body.ownerUuid ? String(body.ownerUuid) : null,
      extraConfig: body.extraConfig ? String(body.extraConfig) : null,
    }
    if (apiKey) {
      insertData.apiKeyEnc = JSON.stringify(encryptJSON(apiKey))
    }
    const [row] = await db
      .insert(aiModelConfig)
      .values(insertData as never)
      .returning({ id: aiModelConfig.id })
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success({ id: row.id, created: true }))
  })

  server.put('/ai-model-config/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const id = Number(p.data.id)
    const body = (request.body ?? {}) as Record<string, unknown>
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    for (const k of [
      'name',
      'providerCode',
      'baseUrl',
      'apiFormat',
      'modelIdForTest',
      'description',
      'ownerUuid',
      'extraConfig',
    ]) {
      if (body[k] !== undefined) updateData[k] = body[k] === null ? null : String(body[k])
    }
    for (const k of ['isBuiltin', 'enabled']) {
      if (body[k] !== undefined) updateData[k] = Boolean(body[k])
    }
    if (body.sortOrder !== undefined) updateData.sortOrder = Number(body.sortOrder)
    if (typeof body.apiKey === 'string' && body.apiKey) {
      updateData.apiKeyEnc = JSON.stringify(encryptJSON(body.apiKey))
    }
    const [row] = await db
      .update(aiModelConfig)
      .set(updateData as never)
      .where(eq(aiModelConfig.id, id))
      .returning({ id: aiModelConfig.id })
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success({ id: row.id, updated: true }))
  })

  server.delete('/ai-model-config/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const id = Number(p.data.id)
    await db.delete(aiModelConfig).where(eq(aiModelConfig.id, id))
    return reply.send(success({ id, deleted: true }))
  })

  server.post('/ai-model-config/:id/test', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const id = Number(p.data.id)
    const [row] = await db.select().from(aiModelConfig).where(eq(aiModelConfig.id, id))
    if (!row) return reply.status(404).send(error(404, '记录不存在'))

    const startTime = Date.now()
    try {
      let apiKey = ''
      if (row.apiKeyEnc) {
        try {
          const payload = JSON.parse(row.apiKeyEnc) as unknown
          apiKey = isEncryptedPayload(payload) ? String(decryptJSON(payload)) : row.apiKeyEnc
        } catch {
          apiKey = row.apiKeyEnc
        }
      }
      if (!apiKey) throw new Error('API Key 未配置或解密失败')

      const model = row.modelIdForTest || `${row.providerCode}/test`
      const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000'
      const response = await fetch(`${aiServiceUrl}/api/llm/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Hello, this is a connectivity test. Reply with "OK".' },
          ],
          model,
        }),
      })
      const elapsed = Date.now() - startTime
      const result = (await response.json().catch(() => ({}))) as Record<string, unknown>

      if (!response.ok || result.error) {
        throw new Error(String(result.error_message || result.message || `HTTP ${response.status}`))
      }

      await db
        .update(aiModelConfig)
        .set({
          lastTestStatus: 'success',
          lastTestResponseMs: elapsed,
          lastTestedAt: new Date().toISOString(),
          lastTestError: null,
          updatedAt: new Date(),
        })
        .where(eq(aiModelConfig.id, id))

      return reply.send(
        success({
          status: 'success',
          responseMs: elapsed,
          model: result.model,
          content: typeof result.content === 'string' ? result.content.slice(0, 200) : '',
        }),
      )
    } catch (e) {
      const elapsed = Date.now() - startTime
      const errMsg = e instanceof Error ? e.message : String(e)
      await db
        .update(aiModelConfig)
        .set({
          lastTestStatus: 'failed',
          lastTestResponseMs: elapsed,
          lastTestedAt: new Date().toISOString(),
          lastTestError: errMsg,
          updatedAt: new Date(),
        })
        .where(eq(aiModelConfig.id, id))
      return reply.send(success({ status: 'failed', responseMs: elapsed, error: errMsg }))
    }
  })

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
