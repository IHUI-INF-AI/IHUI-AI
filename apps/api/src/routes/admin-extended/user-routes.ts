/**
 * 用户管理路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 路径前缀:/admin/users
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, count, sum } from 'drizzle-orm'
import { db } from '../../db/index.js'
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
}
