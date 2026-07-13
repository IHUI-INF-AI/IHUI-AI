/**
 * 管理后台鉴权/教育/学习路由（11 个端点）。
 * 替代 admin-missing-routes.ts 中的 registerEmptyStub 空桩。
 * 复用现有 userAuthInfo/userMargins/captchas/systemConfigs/lessons/lessonChapters/resources/learnMaps/eduNotification/users 表。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, or, ilike, desc, sql, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import {
  userAuthInfo,
  userMargins,
  captchas,
  lessons,
  lessonChapters,
  resources,
  learnMaps,
  eduNotification,
  users,
  systemConfigs,
} from '@ihui/database'

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

const idParamSchema = z.object({ id: z.string() })

const blacklistQuerySchema = paginationSchema.extend({
  type: z.preprocess(emptyToUndefined, z.enum(['user', 'ip', 'device']).optional()),
})

type BlacklistPayload = {
  user: string | null
  type: 'user' | 'ip' | 'device'
  reason: string | null
  status: 'active' | 'removed'
  expiresAt: string | null
  createdAt: string
}

function safeParseBlacklist(value: string): BlacklistPayload {
  const fallback: BlacklistPayload = {
    user: null,
    type: 'user',
    reason: null,
    status: 'active',
    expiresAt: null,
    createdAt: new Date().toISOString(),
  }
  try {
    const parsed = JSON.parse(value) as Partial<BlacklistPayload>
    return { ...fallback, ...parsed }
  } catch {
    return fallback
  }
}

export const adminAuthEduRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // 1. /auth-find-info — userAuthInfo 表 CRUD
  // 映射: userUuid→id, realName→title, idCard→card, authSource→belong, rejectReason→message
  server.get('/auth-find-info', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(ilike(userAuthInfo.realName, `%${search}%`), ilike(userAuthInfo.idCard, `%${search}%`))
      : undefined
    const rows = await db
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
    const list = rows.map((r) => ({
      id: r.userUuid,
      userUuid: r.userUuid,
      card: r.idCard,
      belong: r.authSource,
      title: r.realName,
      message: r.rejectReason,
      createdAt: r.createdAt,
    }))
    return reply.send(success({ list, total, page, pageSize }))
  })

  server.post('/auth-find-info', async (request, reply) => {
    const b = request.body as Record<string, unknown>
    const [row] = await db
      .insert(userAuthInfo)
      .values({
        userUuid: b.userUuid as string,
        realName: (b.title as string | undefined) ?? null,
        idCard: (b.card as string | undefined) ?? null,
        authSource: (b.belong as string | undefined) ?? null,
        rejectReason: (b.message as string | undefined) ?? null,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(
      success({
        id: row.userUuid,
        userUuid: row.userUuid,
        card: row.idCard,
        belong: row.authSource,
        title: row.realName,
        message: row.rejectReason,
        createdAt: row.createdAt,
      }),
    )
  })

  server.put('/auth-find-info/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = request.body as Record<string, unknown>
    const [row] = await db
      .update(userAuthInfo)
      .set({
        realName: (b.title as string | null | undefined) ?? null,
        idCard: (b.card as string | null | undefined) ?? null,
        authSource: (b.belong as string | null | undefined) ?? null,
        rejectReason: (b.message as string | null | undefined) ?? null,
        updatedAt: new Date(),
      })
      .where(eq(userAuthInfo.userUuid, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(
      success({
        id: row.userUuid,
        userUuid: row.userUuid,
        card: row.idCard,
        belong: row.authSource,
        title: row.realName,
        message: row.rejectReason,
        createdAt: row.createdAt,
      }),
    )
  })

  server.delete('/auth-find-info/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(userAuthInfo).where(eq(userAuthInfo.userUuid, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // 2. /auth-user-margin — userMargins 表 CRUD
  // 映射: userId→id/userUuid, tokenQuantity→tokenQuantity, frozenQuantity→tokenFree, updatedAt→createdTime
  const mapMargin = (r: typeof userMargins.$inferSelect) => ({
    id: r.userId,
    userUuid: r.userId,
    tokenQuantity: r.tokenQuantity,
    tokenFree: r.frozenQuantity,
    aument: 0,
    field1: 0,
    field2: 0,
    field3: 0,
    createdTime: r.updatedAt,
  })

  server.get('/auth-user-margin', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? sql`${userMargins.userId}::text ilike '%' || ${search} || '%'`
      : undefined
    const rows = await db
      .select()
      .from(userMargins)
      .where(where)
      .orderBy(desc(userMargins.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(userMargins)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list: rows.map(mapMargin), total, page, pageSize }))
  })

  server.post('/auth-user-margin', async (request, reply) => {
    const b = request.body as Record<string, unknown>
    const [row] = await db
      .insert(userMargins)
      .values({
        userId: b.userUuid as string,
        tokenQuantity: (b.tokenQuantity as number | undefined) ?? 0,
        frozenQuantity: (b.tokenFree as number | undefined) ?? 0,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(mapMargin(row)))
  })

  server.put('/auth-user-margin/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = request.body as Record<string, unknown>
    const [row] = await db
      .update(userMargins)
      .set({
        tokenQuantity: (b.tokenQuantity as number | undefined) ?? 0,
        frozenQuantity: (b.tokenFree as number | undefined) ?? 0,
        updatedAt: new Date(),
      })
      .where(eq(userMargins.userId, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapMargin(row)))
  })

  server.delete('/auth-user-margin/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(userMargins).where(eq(userMargins.userId, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // 3. /auth-veri-codes — captchas 表（查询为主）
  // 表字段: id, captchaKey, code, expiresAt, createdAt
  server.get('/auth-veri-codes', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(captchas.captchaKey, `%${search}%`) : undefined
    const rows = await db
      .select()
      .from(captchas)
      .where(where)
      .orderBy(desc(captchas.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(captchas)
          .where(where)
      )[0]?.c ?? 0
    const list = rows.map((r) => ({
      id: r.id,
      userId: null,
      phone: null,
      code: r.code,
      type: null,
      platform: null,
      ip: null,
      expiresAt: r.expiresAt,
      used: false,
      usedAt: null,
      createdAt: r.createdAt,
    }))
    return reply.send(success({ list, total }))
  })

  server.delete('/auth-veri-codes/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(captchas).where(eq(captchas.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // 4. /member/blacklist — systemConfigs 表（category='member-blacklist'）
  // key=identifier, value=JSON({user, type, reason, status, expiresAt, createdAt})
  server.get('/member/blacklist', async (request, reply) => {
    const q = blacklistQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { search, type } = q.data
    const baseCond = eq(systemConfigs.category, 'member-blacklist')
    const searchCond = search
      ? or(ilike(systemConfigs.key, `%${search}%`), ilike(systemConfigs.value, `%${search}%`))
      : undefined
    const where = searchCond ? and(baseCond, searchCond) : baseCond
    const rows = await db
      .select()
      .from(systemConfigs)
      .where(where)
      .orderBy(desc(systemConfigs.createdAt))
    let list = rows.map((r) => {
      const payload = safeParseBlacklist(r.value)
      return {
        id: r.id,
        user: payload.user,
        identifier: r.key,
        type: payload.type,
        reason: payload.reason,
        status: payload.status,
        expiresAt: payload.expiresAt,
        createdAt: payload.createdAt,
      }
    })
    if (type) list = list.filter((it) => it.type === type)
    return reply.send(success({ list }))
  })

  server.post('/member/blacklist', async (request, reply) => {
    const b = request.body as Record<string, unknown>
    const identifier = String(b.identifier ?? '')
    const payload: BlacklistPayload = {
      user: (b.user as string | undefined) ?? null,
      type: (b.type as 'user' | 'ip' | 'device' | undefined) ?? 'user',
      reason: (b.reason as string | undefined) ?? null,
      status: 'active',
      expiresAt: (b.expiresAt as string | undefined) ?? null,
      createdAt: new Date().toISOString(),
    }
    const [row] = await db
      .insert(systemConfigs)
      .values({
        key: identifier,
        value: JSON.stringify(payload),
        category: 'member-blacklist',
        type: 'json',
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(
      success({
        id: row.id,
        user: payload.user,
        identifier: row.key,
        type: payload.type,
        reason: payload.reason,
        status: payload.status,
        expiresAt: payload.expiresAt,
        createdAt: payload.createdAt,
      }),
    )
  })

  server.delete('/member/blacklist/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(systemConfigs).where(eq(systemConfigs.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  server.post('/member/blacklist/:id/remove', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [existing] = await db
      .select()
      .from(systemConfigs)
      .where(eq(systemConfigs.id, p.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '记录不存在'))
    const payload = safeParseBlacklist(existing.value)
    payload.status = 'removed'
    const [row] = await db
      .update(systemConfigs)
      .set({ value: JSON.stringify(payload), updatedAt: new Date() })
      .where(eq(systemConfigs.id, p.data.id))
      .returning()
    if (!row) return reply.status(500).send(error(500, '更新失败'))
    return reply.send(
      success({
        id: row.id,
        user: payload.user,
        identifier: row.key,
        type: payload.type,
        reason: payload.reason,
        status: payload.status,
        expiresAt: payload.expiresAt,
        createdAt: payload.createdAt,
      }),
    )
  })

  // 5. /users/course-users — users 表查询（分配用户对话框，无 total）
  server.get('/users/course-users', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(ilike(users.username, `%${search}%`), ilike(users.nickname, `%${search}%`))
      : undefined
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        roleId: users.roleId,
      })
      .from(users)
      .where(where)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const list = rows.map((r) => ({
      userId: r.id,
      userName: r.username,
      nickname: r.nickname,
      roles: r.roleId,
    }))
    return reply.send(success({ list }))
  })

  // 6. /edu/classes — lessons 表 CRUD
  // 映射: title→name, lecturerName→teacherName, signupCount→studentCount, status→status
  const mapClass = (r: typeof lessons.$inferSelect) => ({
    id: r.id,
    name: r.title,
    courseId: null,
    courseName: null,
    teacherName: r.lecturerName,
    studentCount: r.signupCount,
    startDate: null,
    endDate: null,
    status: r.status,
  })

  server.get('/edu/classes', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(lessons.title, `%${search}%`) : undefined
    const rows = await db
      .select()
      .from(lessons)
      .where(where)
      .orderBy(desc(lessons.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(lessons)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list: rows.map(mapClass), total, page, pageSize }))
  })

  server.post('/edu/classes', async (request, reply) => {
    const b = request.body as Record<string, unknown>
    const [row] = await db
      .insert(lessons)
      .values({
        title: String(b.name ?? ''),
        lecturerName: (b.teacherName as string | undefined) ?? null,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(mapClass(row)))
  })

  server.put('/edu/classes/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = request.body as Record<string, unknown>
    const [row] = await db
      .update(lessons)
      .set({
        title: (b.name as string | undefined) ?? undefined,
        lecturerName: (b.teacherName as string | null | undefined) ?? null,
        updatedAt: new Date(),
      })
      .where(eq(lessons.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapClass(row)))
  })

  server.delete('/edu/classes/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(lessons).where(eq(lessons.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // 7. /edu/classes/schedules — lessonChapters 表 CRUD
  // 映射: lessonId→classId, title→title
  const mapSchedule = (r: typeof lessonChapters.$inferSelect) => ({
    id: r.id,
    classId: r.lessonId,
    className: null,
    title: r.title,
    teacherName: null,
    startTime: null,
    endTime: null,
    location: null,
    status: 1,
  })

  server.get('/edu/classes/schedules', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(lessonChapters.title, `%${search}%`) : undefined
    const rows = await db
      .select()
      .from(lessonChapters)
      .where(where)
      .orderBy(desc(lessonChapters.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(lessonChapters)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list: rows.map(mapSchedule), total, page, pageSize }))
  })

  server.post('/edu/classes/schedules', async (request, reply) => {
    const b = request.body as Record<string, unknown>
    const [row] = await db
      .insert(lessonChapters)
      .values({
        lessonId: String(b.classId ?? ''),
        title: String(b.title ?? ''),
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(mapSchedule(row)))
  })

  server.put('/edu/classes/schedules/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = request.body as Record<string, unknown>
    const [row] = await db
      .update(lessonChapters)
      .set({
        title: (b.title as string | undefined) ?? undefined,
      })
      .where(eq(lessonChapters.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapSchedule(row)))
  })

  server.delete('/edu/classes/schedules/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(lessonChapters).where(eq(lessonChapters.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // 8. /learn/materials — resources 表 CRUD
  // 映射: title→title, fileType→type, fileUrl→fileUrl, fileSize→fileSize, downloadCount→downloadCount
  const mapMaterial = (r: typeof resources.$inferSelect) => ({
    id: r.id,
    title: r.title,
    type: r.fileType,
    fileUrl: r.fileUrl,
    fileSize: r.fileSize,
    downloadCount: r.downloadCount,
    lessonTitle: null,
  })

  server.get('/learn/materials', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(resources.title, `%${search}%`) : undefined
    const rows = await db
      .select()
      .from(resources)
      .where(where)
      .orderBy(desc(resources.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(resources)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list: rows.map(mapMaterial), total, page, pageSize }))
  })

  server.post('/learn/materials', async (request, reply) => {
    const b = request.body as Record<string, unknown>
    const [row] = await db
      .insert(resources)
      .values({
        title: String(b.title ?? ''),
        fileType: (b.type as string | undefined) ?? null,
        fileUrl: (b.fileUrl as string | undefined) ?? null,
        fileSize: (b.fileSize as number | undefined) ?? 0,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(mapMaterial(row)))
  })

  server.put('/learn/materials/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = request.body as Record<string, unknown>
    const [row] = await db
      .update(resources)
      .set({
        title: (b.title as string | undefined) ?? undefined,
        fileType: (b.type as string | null | undefined) ?? null,
        fileUrl: (b.fileUrl as string | null | undefined) ?? null,
        fileSize: (b.fileSize as number | undefined) ?? 0,
        updatedAt: new Date(),
      })
      .where(eq(resources.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapMaterial(row)))
  })

  server.delete('/learn/materials/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(resources).where(eq(resources.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // 9. /learn/plans — learnMaps 表 CRUD
  // 映射: title→title, isPublished→status(active/expired)
  const mapPlan = (r: typeof learnMaps.$inferSelect) => ({
    id: r.id,
    userId: null,
    userName: null,
    title: r.title,
    startDate: null,
    endDate: null,
    targetHours: 0,
    status: r.isPublished ? 'active' : 'expired',
  })

  server.get('/learn/plans', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(learnMaps.title, `%${search}%`) : undefined
    const rows = await db
      .select()
      .from(learnMaps)
      .where(where)
      .orderBy(desc(learnMaps.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(learnMaps)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list: rows.map(mapPlan), total, page, pageSize }))
  })

  server.post('/learn/plans', async (request, reply) => {
    const b = request.body as Record<string, unknown>
    const [row] = await db
      .insert(learnMaps)
      .values({
        title: String(b.title ?? ''),
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(mapPlan(row)))
  })

  server.put('/learn/plans/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = request.body as Record<string, unknown>
    const [row] = await db
      .update(learnMaps)
      .set({
        title: (b.title as string | undefined) ?? undefined,
        isPublished: b.status === 'active' ? true : b.status === 'expired' ? false : undefined,
        updatedAt: new Date(),
      })
      .where(eq(learnMaps.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapPlan(row)))
  })

  server.delete('/learn/plans/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(learnMaps).where(eq(learnMaps.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // 10. /learn/reminds — eduNotification 表 CRUD
  // 映射: memberId→userId, title→title, content→content, notifType→type, isRead→isRead, createdAt→remindAt
  const mapRemind = (r: typeof eduNotification.$inferSelect) => ({
    id: r.id,
    userId: r.memberId,
    userName: null,
    title: r.title,
    content: r.content,
    remindAt: r.createdAt,
    type: r.notifType,
    isRead: r.isRead,
  })

  server.get('/learn/reminds', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(eduNotification.title, `%${search}%`) : undefined
    const rows = await db
      .select()
      .from(eduNotification)
      .where(where)
      .orderBy(desc(eduNotification.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(eduNotification)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list: rows.map(mapRemind), total, page, pageSize }))
  })

  server.post('/learn/reminds', async (request, reply) => {
    const b = request.body as Record<string, unknown>
    const [row] = await db
      .insert(eduNotification)
      .values({
        memberId: Number(b.userId ?? 0),
        title: (b.title as string | undefined) ?? null,
        content: (b.content as string | undefined) ?? null,
        notifType: (b.type as string | undefined) ?? 'system',
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(mapRemind(row)))
  })

  server.put('/learn/reminds/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = request.body as Record<string, unknown>
    const [row] = await db
      .update(eduNotification)
      .set({
        title: (b.title as string | null | undefined) ?? null,
        content: (b.content as string | null | undefined) ?? null,
        notifType: (b.type as string | undefined) ?? undefined,
        isRead: (b.isRead as boolean | undefined) ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(eduNotification.id, Number(p.data.id)))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapRemind(row)))
  })

  server.delete('/learn/reminds/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(eduNotification).where(eq(eduNotification.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
}
