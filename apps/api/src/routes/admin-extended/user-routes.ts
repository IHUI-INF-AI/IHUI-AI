/**
 * 用户管理路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 路径前缀:/admin/users
 */
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, count, sum, inArray, gte, gt, sql } from 'drizzle-orm'
import { db, dbRead } from '../../db/index.js'
import {
  users,
  certificates,
  examRecords,
  userCourseEnrollments,
  userLearnRecords,
} from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../../utils/response.js'
import { idParamSchema } from './_shared.js'
import { logAction } from '../../services/audit-service.js'

const updateUserSchema = z
  .object({
    nickname: z.string().min(1).max(64).optional(),
    avatar: z.string().max(500).optional(),
    bio: z.string().max(500).optional(),
    gender: z.number().int().min(0).max(2).optional(),
    birthday: z.string().optional(),
    roleId: z.number().int().min(0).max(10).optional(),
    deptId: z.number().int().optional(),
    status: z.number().int().min(0).max(3).optional(),
    isVip: z.number().int().min(-1).max(2).optional(),
    level: z.number().int().min(0).max(3).optional(),
  })
  .strict()

const batchStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, '至少选择 1 条').max(100, '单次最多 100 条'),
  status: z.number().int().min(0, 'status 0-3').max(3, 'status 0-3'),
})

const batchReviewSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, '至少选择 1 条').max(100, '单次最多 100 条'),
})

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfMonth(): Date {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

function auditCtx(request: FastifyRequest) {
  const ua = request.headers['user-agent']
  return {
    userId: request.userId,
    ip: request.ip,
    userAgent: typeof ua === 'string' ? ua.slice(0, 512) : undefined,
  }
}

export const userRoutes: FastifyPluginAsync = async (server) => {
  // 路径修正(2026-07-23):原 /admin/users/:id 与 admin.ts 的 GET /users/:id(经 prefix /api/admin 暴露为 /api/admin/users/:id)冲突,
  // 改为 /admin/users/:id/detail 保留扩展学习统计功能,基础用户详情走 admin.ts。
  server.get('/admin/users/:id/detail', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const [row] = await db
      .select({
        id: users.id,
        nickname: users.nickname,
        phone: users.phone,
        email: users.email,
        level: users.level,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '用户不存在'))
    const [certRow] = await db
      .select({ cnt: count() })
      .from(certificates)
      .where(and(eq(certificates.userId, id), eq(certificates.status, 1)))
    const [examRow] = await db
      .select({ cnt: count() })
      .from(examRecords)
      .where(eq(examRecords.userId, id))
    const [signupRow] = await db
      .select({ cnt: count() })
      .from(userCourseEnrollments)
      .where(and(eq(userCourseEnrollments.userId, id), eq(userCourseEnrollments.status, 1)))
    const [learnRow] = await db
      .select({ total: sum(userLearnRecords.studyDuration) })
      .from(userLearnRecords)
      .where(eq(userLearnRecords.userId, id))
    const lessonRows = await db
      .select({ id: userLearnRecords.lessonId, progress: userLearnRecords.progress })
      .from(userLearnRecords)
      .where(eq(userLearnRecords.userId, id))
      .orderBy(desc(userLearnRecords.updatedAt))
      .limit(5)
    return reply.send(
      success({
        user: {
          ...row,
          certCount: certRow?.cnt ?? 0,
          examCount: examRow?.cnt ?? 0,
          signupCount: signupRow?.cnt ?? 0,
          learnHours: Number(learnRow?.total ?? 0),
          lessons: lessonRows.map((l) => ({ id: l.id, progress: l.progress })),
        },
      }),
    )
  })
  server.put('/admin/users/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateUserSchema, request.body)
    const [row] = await db
      .update(users)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '用户不存在'))
    return reply.send(success(row))
  })
  server.post('/admin/users/:id/review', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const [row] = await db
      .update(users)
      .set({ status: 1, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '用户不存在'))
    return reply.send(success(row))
  })
  server.post('/admin/users/:id/audit', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const [row] = await db
      .update(users)
      .set({ status: 1, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '用户不存在'))
    return reply.send(success(row))
  })

  // ===== GET /admin/users/stats — 用户活跃度统计聚合 =====
  server.get('/admin/users/stats', { preHandler: requireAdmin }, async (_request, reply) => {
    const todayStart = startOfToday()
    const weekStart = daysAgo(7)
    const monthStart = startOfMonth()
    const sevenDaysAgo = daysAgo(7)
    const dayExpr = sql<string>`to_char(${users.createdAt}, 'YYYY-MM-DD')`
    const [
      totalRows,
      todayRows,
      weekRows,
      monthRows,
      byStatusRows,
      byLevelRows,
      vipRows,
      dailyRows,
      activeRows,
    ] = await Promise.all([
      dbRead.select({ count: sql<number>`count(*)::int` }).from(users),
      dbRead.select({ count: sql<number>`count(*)::int` }).from(users).where(gte(users.createdAt, todayStart)),
      dbRead.select({ count: sql<number>`count(*)::int` }).from(users).where(gte(users.createdAt, weekStart)),
      dbRead.select({ count: sql<number>`count(*)::int` }).from(users).where(gte(users.createdAt, monthStart)),
      dbRead.select({ status: users.status, count: sql<number>`count(*)::int` }).from(users).groupBy(users.status),
      dbRead.select({ level: users.level, count: sql<number>`count(*)::int` }).from(users).groupBy(users.level),
      dbRead.select({ count: sql<number>`count(*)::int` }).from(users).where(gt(users.isVip, 0)),
      dbRead
        .select({ date: dayExpr, count: sql<number>`count(*)::int` })
        .from(users)
        .where(gte(users.createdAt, sevenDaysAgo))
        .groupBy(dayExpr)
        .orderBy(dayExpr),
      dbRead
        .select({ count: sql<number>`count(distinct ${userLearnRecords.userId})::int` })
        .from(userLearnRecords)
        .where(gte(userLearnRecords.updatedAt, sevenDaysAgo)),
    ])
    const byStatus: Record<number, number> = {}
    for (const r of byStatusRows) byStatus[r.status] = r.count
    const byLevel: Record<number, number> = {}
    for (const r of byLevelRows) byLevel[r.level] = r.count
    return reply.send(
      success({
        total: totalRows[0]?.count ?? 0,
        todayNew: todayRows[0]?.count ?? 0,
        weekNew: weekRows[0]?.count ?? 0,
        monthNew: monthRows[0]?.count ?? 0,
        byStatus,
        byLevel,
        vipCount: vipRows[0]?.count ?? 0,
        daily: dailyRows.map((r) => ({ date: r.date, count: r.count })),
        activeUsers: activeRows[0]?.count ?? 0,
      }),
    )
  })

  // ===== POST /admin/users/batch-status — 批量启用/禁用 =====
  server.post('/admin/users/batch-status', { preHandler: requireAdmin }, async (request, reply) => {
    const body = batchStatusSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const { ids, status } = body.data
    const existing = await dbRead.select({ id: users.id }).from(users).where(inArray(users.id, ids))
    const existingSet = new Set(existing.map((r) => r.id))
    const failed: Array<{ id: string; reason: string }> = []
    let updated = 0
    for (const id of ids) {
      if (!existingSet.has(id)) {
        failed.push({ id, reason: '不存在' })
        continue
      }
      const [row] = await db
        .update(users)
        .set({ status, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning({ id: users.id })
      if (row) updated++
      else failed.push({ id, reason: '更新失败' })
    }
    await logAction({
      ...auditCtx(request),
      action: 'user.batch_status',
      resourceType: 'user',
      details: { count: updated, status, failed: failed.length },
    })
    return reply.send(success({ updated, failed }))
  })

  // ===== POST /admin/users/batch-review — 批量审核(待审核 0 → 正常 1)=====
  server.post('/admin/users/batch-review', { preHandler: requireAdmin }, async (request, reply) => {
    const body = batchReviewSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const { ids } = body.data
    const existing = await dbRead
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(inArray(users.id, ids))
    const existingMap = new Map(existing.map((r) => [r.id, r.status]))
    const skipped: Array<{ id: string; reason: string }> = []
    let reviewed = 0
    for (const id of ids) {
      if (!existingMap.has(id)) {
        skipped.push({ id, reason: '不存在' })
        continue
      }
      const curStatus = existingMap.get(id)!
      if (curStatus !== 0) {
        skipped.push({ id, reason: `状态 ${curStatus} 非待审核` })
        continue
      }
      const [row] = await db
        .update(users)
        .set({ status: 1, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning({ id: users.id })
      if (row) reviewed++
      else skipped.push({ id, reason: '更新失败' })
    }
    await logAction({
      ...auditCtx(request),
      action: 'user.batch_review',
      resourceType: 'user',
      details: { reviewed, skipped: skipped.length },
    })
    return reply.send(success({ reviewed, skipped }))
  })
}
