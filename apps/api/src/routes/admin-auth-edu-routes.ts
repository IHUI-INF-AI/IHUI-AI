/**
 * 管理后台鉴权/教育/学习路由（11 个端点）。
 * 替代 admin-missing-routes.ts 中的 registerEmptyStub 空桩。
 * 复用现有 userAuthInfo/userMargins/captchas/systemConfigs/lessons/lessonChapters/resources/learnMaps/eduNotification/users 表。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, or, ilike, desc, sql, and, inArray } from 'drizzle-orm'
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
  tDepartment,
  userDevices,
} from '@ihui/database'

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.transform(emptyToUndefined).pipe(z.string().max(200).optional()),
})

const idParamSchema = z.object({ id: z.string() })

const blacklistQuerySchema = paginationSchema.extend({
  type: z.transform(emptyToUndefined).pipe(z.enum(['user', 'ip', 'device']).optional()),
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
  // admin 鉴权/教育路由响应含 idCard(已通过 card 重命名隐式绕过,此处改为显式旁路)
  // 防止 response-sanitizer 把 idCard 字段误伤为 '***'(若未来移除重命名)
  server.addHook('onRequest', async (request) => {
    request.skipResponseSanitization = true
  })

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

  server.get('/auth-find-info/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [r] = await db
      .select()
      .from(userAuthInfo)
      .where(eq(userAuthInfo.userUuid, p.data.id))
      .limit(1)
    if (!r) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(
      success({
        id: r.userUuid,
        userUuid: r.userUuid,
        card: r.idCard,
        belong: r.authSource,
        title: r.realName,
        message: r.rejectReason,
        createdAt: r.createdAt,
      }),
    )
  })

  server.post('/auth-find-info', async (request, reply) => {
    // 2026-08-01 P1 修复:原直接 as 类型断言,补齐 Zod 校验防 NaN/超长字段。
    const body = z
      .object({
        userUuid: z.string().min(1).max(100),
        title: z.string().max(100).nullable().optional(),
        card: z.string().max(50).nullable().optional(),
        belong: z.string().max(100).nullable().optional(),
        message: z.string().max(500).nullable().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .insert(userAuthInfo)
      .values({
        userUuid: body.data.userUuid,
        realName: body.data.title ?? null,
        idCard: body.data.card ?? null,
        authSource: body.data.belong ?? null,
        rejectReason: body.data.message ?? null,
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
    const body = z
      .object({
        title: z.string().max(100).nullable().optional(),
        card: z.string().max(50).nullable().optional(),
        belong: z.string().max(100).nullable().optional(),
        message: z.string().max(500).nullable().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .update(userAuthInfo)
      .set({
        ...(body.data.title !== undefined && { realName: body.data.title }),
        ...(body.data.card !== undefined && { idCard: body.data.card }),
        ...(body.data.belong !== undefined && { authSource: body.data.belong }),
        ...(body.data.message !== undefined && { rejectReason: body.data.message }),
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

  server.get('/auth-user-margin/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [r] = await db
      .select()
      .from(userMargins)
      .where(eq(userMargins.userId, p.data.id))
      .limit(1)
    if (!r) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapMargin(r)))
  })

  server.post('/auth-user-margin', async (request, reply) => {
    // 2026-08-01 P1 修复:原直接 as 类型断言,tokenQuantity 传 "abc" 会写入 NaN。
    const body = z
      .object({
        userUuid: z.string().min(1).max(100),
        tokenQuantity: z.coerce.number().int().min(0).default(0),
        tokenFree: z.coerce.number().int().min(0).default(0),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .insert(userMargins)
      .values({
        userId: body.data.userUuid,
        tokenQuantity: body.data.tokenQuantity,
        frozenQuantity: body.data.tokenFree,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(mapMargin(row)))
  })

  server.put('/auth-user-margin/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = z
      .object({
        tokenQuantity: z.coerce.number().int().min(0).optional(),
        tokenFree: z.coerce.number().int().min(0).optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .update(userMargins)
      .set({
        ...(body.data.tokenQuantity !== undefined && { tokenQuantity: body.data.tokenQuantity }),
        ...(body.data.tokenFree !== undefined && { frozenQuantity: body.data.tokenFree }),
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

    // 先查 margin 是否有资金,有余额/冻结时禁止硬删,防资金丢失(P0 修复)
    const [margin] = await db
      .select({
        tokenQuantity: userMargins.tokenQuantity,
        frozenQuantity: userMargins.frozenQuantity,
      })
      .from(userMargins)
      .where(eq(userMargins.userId, p.data.id))
      .limit(1)

    if (!margin) {
      return reply.status(404).send(error(404, '用户余额记录不存在'))
    }

    // 有余额或冻结资金时禁止硬删,需先处理资金
    if ((margin.tokenQuantity ?? 0) > 0 || (margin.frozenQuantity ?? 0) > 0) {
      return reply
        .status(400)
        .send(
          error(
            400,
            `无法删除有资金的余额记录(token=${margin.tokenQuantity}, frozen=${margin.frozenQuantity}),请先处理资金`,
          ),
        )
    }

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

  server.get('/auth-veri-codes/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [r] = await db.select().from(captchas).where(eq(captchas.id, p.data.id)).limit(1)
    if (!r) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(
      success({
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
      }),
    )
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

    // device 类型分支:从 user_devices 表按 fingerprintHash 查设备详情(最后登录时间/UA/IP/关联用户)
    // identifier 即设备指纹哈希;一个指纹可能被多个用户使用(换号登录),返回 userIds 列表
    if (type === 'device' && list.length > 0) {
      const fingerprints = list.map((it) => it.identifier).filter((v): v is string => Boolean(v))
      const deviceMap = new Map<
        string,
        { lastSeenAt: Date | null; userAgent: string | null; ip: string | null; userIds: string[] }
      >()
      if (fingerprints.length > 0) {
        const devRows = await db
          .select({
            fingerprintHash: userDevices.fingerprintHash,
            lastSeenAt: userDevices.lastSeenAt,
            userAgent: userDevices.userAgent,
            ip: userDevices.ip,
            userId: userDevices.userId,
          })
          .from(userDevices)
          .where(inArray(userDevices.fingerprintHash, fingerprints))
        for (const dr of devRows) {
          const existing = deviceMap.get(dr.fingerprintHash)
          if (existing) {
            existing.userIds.push(dr.userId)
            if (dr.lastSeenAt && (!existing.lastSeenAt || dr.lastSeenAt > existing.lastSeenAt)) {
              existing.lastSeenAt = dr.lastSeenAt
              existing.userAgent = dr.userAgent
              existing.ip = dr.ip
            }
          } else {
            deviceMap.set(dr.fingerprintHash, {
              lastSeenAt: dr.lastSeenAt,
              userAgent: dr.userAgent,
              ip: dr.ip,
              userIds: [dr.userId],
            })
          }
        }
      }
      const enriched = list.map((it) => {
        const info = deviceMap.get(it.identifier)
        return {
          ...it,
          lastSeenAt: info?.lastSeenAt ?? null,
          userAgent: info?.userAgent ?? null,
          ip: info?.ip ?? null,
          userIds: info?.userIds ?? [],
        }
      })
      return reply.send(success({ list: enriched }))
    }

    return reply.send(success({ list }))
  })

  server.post('/member/blacklist', async (request, reply) => {
    // 2026-08-01 P1 修复:原直接 as 类型断言,补齐 Zod 校验防类型错误。
    const body = z
      .object({
        identifier: z.string().min(1).max(200),
        user: z.string().max(100).nullable().optional(),
        type: z.enum(['user', 'ip', 'device']).optional().default('user'),
        reason: z.string().max(500).nullable().optional(),
        expiresAt: z.string().max(50).nullable().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const payload: BlacklistPayload = {
      user: body.data.user ?? null,
      type: body.data.type,
      reason: body.data.reason ?? null,
      status: 'active',
      expiresAt: body.data.expiresAt ?? null,
      createdAt: new Date().toISOString(),
    }
    const [row] = await db
      .insert(systemConfigs)
      .values({
        key: body.data.identifier,
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

  server.get('/edu/classes/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [r] = await db.select().from(lessons).where(eq(lessons.id, p.data.id)).limit(1)
    if (!r) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapClass(r)))
  })

  server.post('/edu/classes', async (request, reply) => {
    // 2026-08-01 P1 修复:原直接 as 类型断言,补齐 Zod 校验防 NaN/超长字段。
    const body = z
      .object({
        name: z.string().min(1).max(200),
        teacherName: z.string().max(100).nullable().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .insert(lessons)
      .values({
        title: body.data.name,
        lecturerName: body.data.teacherName ?? null,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(mapClass(row)))
  })

  server.put('/edu/classes/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = z
      .object({
        name: z.string().min(1).max(200).optional(),
        teacherName: z.string().max(100).nullable().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .update(lessons)
      .set({
        ...(body.data.name !== undefined && { title: body.data.name }),
        ...(body.data.teacherName !== undefined && { lecturerName: body.data.teacherName }),
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

  server.get('/edu/classes/schedules/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [r] = await db
      .select()
      .from(lessonChapters)
      .where(eq(lessonChapters.id, p.data.id))
      .limit(1)
    if (!r) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapSchedule(r)))
  })

  server.post('/edu/classes/schedules', async (request, reply) => {
    // 2026-08-01 P1 修复:原直接 as 类型断言,补齐 Zod 校验防 NaN/超长字段。
    const body = z
      .object({
        classId: z.string().min(1).max(100),
        title: z.string().min(1).max(200),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .insert(lessonChapters)
      .values({
        lessonId: body.data.classId,
        title: body.data.title,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(mapSchedule(row)))
  })

  server.put('/edu/classes/schedules/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = z
      .object({
        title: z.string().min(1).max(200).optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .update(lessonChapters)
      .set({
        ...(body.data.title !== undefined && { title: body.data.title }),
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

  server.get('/learn/materials/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [r] = await db.select().from(resources).where(eq(resources.id, p.data.id)).limit(1)
    if (!r) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapMaterial(r)))
  })

  server.post('/learn/materials', async (request, reply) => {
    // 2026-08-01 P1 修复:原直接 as 类型断言,fileSize 传 "abc" 会写入 NaN,补齐 Zod 校验。
    const body = z
      .object({
        title: z.string().min(1).max(200),
        type: z.string().max(50).nullable().optional(),
        fileUrl: z.string().max(2000).nullable().optional(),
        fileSize: z.coerce.number().int().min(0).default(0),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .insert(resources)
      .values({
        title: body.data.title,
        fileType: body.data.type ?? null,
        fileUrl: body.data.fileUrl ?? null,
        fileSize: body.data.fileSize,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(mapMaterial(row)))
  })

  server.put('/learn/materials/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = z
      .object({
        title: z.string().min(1).max(200).optional(),
        type: z.string().max(50).nullable().optional(),
        fileUrl: z.string().max(2000).nullable().optional(),
        fileSize: z.coerce.number().int().min(0).optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .update(resources)
      .set({
        ...(body.data.title !== undefined && { title: body.data.title }),
        ...(body.data.type !== undefined && { fileType: body.data.type }),
        ...(body.data.fileUrl !== undefined && { fileUrl: body.data.fileUrl }),
        ...(body.data.fileSize !== undefined && { fileSize: body.data.fileSize }),
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

  server.get('/learn/plans/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [r] = await db.select().from(learnMaps).where(eq(learnMaps.id, p.data.id)).limit(1)
    if (!r) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapPlan(r)))
  })

  server.post('/learn/plans', async (request, reply) => {
    // 2026-08-01 P1 修复:原直接 as 类型断言,补齐 Zod 校验防超长字段。
    const body = z
      .object({
        title: z.string().min(1).max(200),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .insert(learnMaps)
      .values({
        title: body.data.title,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(mapPlan(row)))
  })

  server.put('/learn/plans/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = z
      .object({
        title: z.string().min(1).max(200).optional(),
        status: z.enum(['active', 'expired']).optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .update(learnMaps)
      .set({
        ...(body.data.title !== undefined && { title: body.data.title }),
        ...(body.data.status !== undefined && {
          isPublished: body.data.status === 'active',
        }),
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

  server.get('/learn/reminds/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [r] = await db
      .select()
      .from(eduNotification)
      .where(eq(eduNotification.id, Number(p.data.id)))
      .limit(1)
    if (!r) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapRemind(r)))
  })

  server.post('/learn/reminds', async (request, reply) => {
    // 2026-08-01 P1 修复:原直接 as 类型断言,Number(b.userId ?? 0) 在 userId="abc" 时变 NaN,补齐 Zod 校验。
    const body = z
      .object({
        userId: z.coerce.number().int().min(0),
        title: z.string().min(1).max(200),
        content: z.string().max(5000).nullable().optional(),
        type: z.string().max(50).optional().default('system'),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .insert(eduNotification)
      .values({
        memberId: body.data.userId,
        title: body.data.title,
        content: body.data.content ?? null,
        notifType: body.data.type,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(mapRemind(row)))
  })

  server.put('/learn/reminds/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = z
      .object({
        title: z.string().min(1).max(200).nullable().optional(),
        content: z.string().max(5000).nullable().optional(),
        type: z.string().max(50).optional(),
        isRead: z.boolean().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .update(eduNotification)
      .set({
        ...(body.data.title !== undefined && { title: body.data.title }),
        ...(body.data.content !== undefined && { content: body.data.content }),
        ...(body.data.type !== undefined && { notifType: body.data.type }),
        ...(body.data.isRead !== undefined && { isRead: body.data.isRead }),
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

  // 11. /auth-dept — tDepartment 表 CRUD
  server.get('/auth-dept', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(tDepartment.name, `%${search}%`) : undefined
    const [list, totalRow] = await Promise.all([
      db
        .select()
        .from(tDepartment)
        .where(where)
        .orderBy(desc(tDepartment.createTime))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(tDepartment)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRow[0]?.c ?? 0, page, pageSize }))
  })

  server.get('/auth-dept/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .select()
      .from(tDepartment)
      .where(eq(tDepartment.id, Number(p.data.id)))
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })

  server.post('/auth-dept', async (request, reply) => {
    const body = z
      .object({
        code: z.string().min(1).max(50),
        name: z.string().min(1).max(50),
        shortName: z.string().max(50).optional().default(''),
        enabled: z.boolean().optional().default(true),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(tDepartment).values(body.data).returning()
    return reply.status(201).send(success(row))
  })

  server.put('/auth-dept/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = z
      .object({
        code: z.string().min(1).max(50).optional(),
        name: z.string().min(1).max(50).optional(),
        shortName: z.string().max(50).optional(),
        enabled: z.boolean().optional(),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db
      .update(tDepartment)
      .set({ ...body.data, updateTime: new Date() })
      .where(eq(tDepartment.id, Number(p.data.id)))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })

  server.delete('/auth-dept/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(tDepartment).where(eq(tDepartment.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
}
