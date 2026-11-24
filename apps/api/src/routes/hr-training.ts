// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 培训路由(2026-11-24 八波)。前缀 /api/hr-training。
 * 权限族 hr:employee:view|manage;自助面只看本人学时。
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { requirePermission, requireSelf } from '../plugins/require-permission.js'
import { error, success } from '../utils/response.js'
import { AppError } from '../errors/AppError.js'
import { db } from '../db/index.js'
import { hrEmployee } from '@ihui/database'
import {
  createCourse,
  createPlan,
  employeeTrainingHours,
  enroll,
  listCourses,
  listEnrollments,
  listMyEnrollments,
  listPlans,
  markCompleted,
  markDropped,
  planProgress,
  reopen,
  setPlanStatus,
  updateCourse,
} from '../services/hr-training.js'

const EMP_VIEW = 'hr:employee:view'
const EMP_MANAGE = 'hr:employee:manage'
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const HOURS = z.union([z.string(), z.number()])

function badRequest(reply: FastifyReply, message: string) {
  return reply.status(400).send(error(400, message, 'BAD_REQUEST'))
}

function userIdOf(request: { user?: unknown; jwtPayload?: unknown }): string | null {
  const u = request.user as { id?: string } | undefined
  const p = request.jwtPayload as { userId?: string } | undefined
  return u?.id ?? p?.userId ?? null
}

async function guard<T>(reply: FastifyReply, fn: () => Promise<T>) {
  try {
    reply.send(success(await fn()))
  } catch (err) {
    if (err instanceof AppError) {
      reply.status(err.statusCode).send(error(err.statusCode, err.message, err.errorCode))
      return
    }
    throw err
  }
}

export const hrTrainingRoutes: FastifyPluginAsync = async (server) => {
  // ---------- 课程 ----------
  server.get(
    '/courses',
    { preHandler: requirePermission(EMP_VIEW) },
    async (request, reply) => {
      const q = request.query as { includeRetired?: string }
      await guard(reply, () => listCourses(q.includeRetired === 'true'))
    },
  )

  server.post(
    '/courses',
    { preHandler: requirePermission(EMP_MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          code: z.string().min(1).max(40),
          name: z.string().min(1).max(200),
          category: z.string().max(60).optional(),
          durationHours: HOURS,
          description: z.string().max(4000).nullable().optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      await guard(reply, () => createCourse(parsed.data))
    },
  )

  server.patch(
    '/courses/:id',
    { preHandler: requirePermission(EMP_MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          name: z.string().min(1).max(200).optional(),
          durationHours: HOURS.optional(),
          description: z.string().max(4000).nullable().optional(),
          status: z.enum(['active', 'retired']).optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => updateCourse(id, parsed.data))
    },
  )

  // ---------- 计划 ----------
  server.get(
    '/plans',
    { preHandler: requirePermission(EMP_VIEW) },
    async (request, reply) => {
      const q = request.query as { status?: string }
      await guard(reply, () => listPlans(q.status))
    },
  )

  server.post(
    '/plans',
    { preHandler: requirePermission(EMP_MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          name: z.string().min(1).max(120),
          startFrom: DATE,
          endTo: DATE,
          note: z.string().max(2000).nullable().optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      await guard(reply, () => createPlan(parsed.data))
    },
  )

  server.post(
    '/plans/:id/status',
    { preHandler: requirePermission(EMP_MANAGE) },
    async (request, reply) => {
      const parsed = z.object({ status: z.enum(['open', 'closed']) }).safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => setPlanStatus(id, parsed.data.status))
    },
  )

  server.post(
    '/plans/:id/enroll',
    { preHandler: requirePermission(EMP_MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          assignments: z
            .array(z.object({ employeeId: z.string().uuid(), courseId: z.string().uuid() }))
            .min(1)
            .max(500),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => enroll(id, parsed.data.assignments))
    },
  )

  server.get(
    '/plans/:id/enrollments',
    { preHandler: requirePermission(EMP_VIEW) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const q = request.query as { employeeId?: string; status?: string }
      await guard(reply, () => listEnrollments(id, q.employeeId, q.status))
    },
  )

  server.get(
    '/plans/:id/progress',
    { preHandler: requirePermission(EMP_VIEW) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => planProgress(id))
    },
  )

  // ---------- 完成/放弃/重开 ----------
  server.post(
    '/enrollments/:id/complete',
    { preHandler: requirePermission(EMP_MANAGE) },
    async (request, reply) => {
      const parsed = z.object({ note: z.string().max(2000).nullable().optional() }).safeParse(request.body ?? {})
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => markCompleted(id, parsed.data.note ?? null))
    },
  )

  server.post(
    '/enrollments/:id/drop',
    { preHandler: requirePermission(EMP_MANAGE) },
    async (request, reply) => {
      const parsed = z.object({ note: z.string().max(2000).nullable().optional() }).safeParse(request.body ?? {})
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => markDropped(id, parsed.data.note ?? null))
    },
  )

  server.post(
    '/enrollments/:id/reopen',
    { preHandler: requirePermission(EMP_MANAGE) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => reopen(id))
    },
  )

  // ---------- 自助面:本人记录与学时(归属由服务端解析,不信客户端自报) ----------
  server.get(
    '/my/enrollments',
    { preHandler: requireSelf },
    async (request, reply) => {
      const userId = userIdOf(request)
      if (!userId) return reply.status(401).send(error(401, '未登录', 'UNAUTHORIZED'))
      await guard(reply, async () => {
        const [emp] = await db
          .select({ id: hrEmployee.id })
          .from(hrEmployee)
          .where(eq(hrEmployee.userId, userId))
          .limit(1)
        if (!emp) throw new AppError('未关联员工档案,无培训记录可查', 403, 'TRAINING_NO_EMPLOYEE')
        const rows = await listMyEnrollments(emp.id)
        const hours = await employeeTrainingHours(emp.id)
        return { list: rows, total: rows.length, hours }
      })
    },
  )

  server.get(
    '/my/hours',
    { preHandler: requireSelf },
    async (request, reply) => {
      const userId = userIdOf(request)
      if (!userId) return reply.status(401).send(error(401, '未登录', 'UNAUTHORIZED'))
      await guard(reply, async () => {
        const [emp] = await db
          .select({ id: hrEmployee.id })
          .from(hrEmployee)
          .where(eq(hrEmployee.userId, userId))
          .limit(1)
        if (!emp) throw new AppError('未关联员工档案,无培训学时可查', 403, 'TRAINING_NO_EMPLOYEE')
        return employeeTrainingHours(emp.id)
      })
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
