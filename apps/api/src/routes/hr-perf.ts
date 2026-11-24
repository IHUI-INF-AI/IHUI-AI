// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 绩效路由(2026-11-24 七波)。前缀 /api/hr-perf。
 * 自助面 requireSelf + 服务端解析本人档案;管理面 hr:employee:view|manage;
 * 流转判据全在服务层 reviewTransition(§0.6)。
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { requirePermission, requireSelf } from '../plugins/require-permission.js'
import { error, success } from '../utils/response.js'
import { AppError } from '../errors/AppError.js'
import { db } from '../db/index.js'
import { PERF_CYCLE_TYPES, hrEmployee } from '@ihui/database'
import {
  adminReviewDecide,
  closeCycle,
  createCycle,
  employeeDecide,
  gradeDistribution,
  launchReviews,
  listCycles,
  listReviews,
  managerScore,
  selfSubmit,
  setCycleStatus,
} from '../services/hr-perf.js'

const EMP_VIEW = 'hr:employee:view'
const EMP_MANAGE = 'hr:employee:manage'
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const SCORE = z.number().int().min(0).max(100)

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

async function selfEmployee(userId: string) {
  const [emp] = await db
    .select({ id: hrEmployee.id })
    .from(hrEmployee)
    .where(eq(hrEmployee.userId, userId))
    .limit(1)
  if (!emp) throw new AppError('未关联员工档案,无法使用绩效自助面', 403, 'PERF_NO_EMPLOYEE')
  return emp
}

/** 自助端点必带本人档案;此处不再保留未使用的反查函数 */

export const hrPerfRoutes: FastifyPluginAsync = async (server) => {
  // ---------- 周期 ----------
  server.post(
    '/cycles',
    { preHandler: requirePermission(EMP_MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          name: z.string().min(1).max(100),
          cycleType: z.enum(PERF_CYCLE_TYPES),
          startFrom: DATE,
          endTo: DATE,
          note: z.string().max(500).nullable().optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      await guard(reply, () => createCycle(parsed.data))
    },
  )

  server.get(
    '/cycles',
    { preHandler: requirePermission(EMP_VIEW) },
    async (request, reply) => {
      const q = request.query as { status?: string }
      await guard(reply, () => listCycles(q.status))
    },
  )

  server.post(
    '/cycles/:id/status',
    { preHandler: requirePermission(EMP_MANAGE) },
    async (request, reply) => {
      const parsed = z.object({ status: z.enum(['open', 'reviewing']) }).safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => setCycleStatus(id, parsed.data.status))
    },
  )

  server.post(
    '/cycles/:id/launch',
    { preHandler: requirePermission(EMP_MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          assignments: z
            .array(z.object({ employeeId: z.string().uuid(), reviewerId: z.string().uuid() }))
            .min(1)
            .max(200),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => launchReviews(id, parsed.data.assignments))
    },
  )

  server.post(
    '/cycles/:id/close',
    { preHandler: requirePermission(EMP_MANAGE) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => closeCycle(id))
    },
  )

  server.get(
    '/cycles/:id/reviews',
    { preHandler: requirePermission(EMP_VIEW) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const q = request.query as { status?: string }
      await guard(reply, () => listReviews(id, q.status))
    },
  )

  server.get(
    '/cycles/:id/distribution',
    { preHandler: requirePermission(EMP_VIEW) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => gradeDistribution(id))
    },
  )

  // ---------- 评估单动作 ----------
  server.post(
    '/reviews/:id/self',
    { preHandler: requireSelf },
    async (request, reply) => {
      const parsed = z
        .object({ score: SCORE, comment: z.string().min(1).max(2000) })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, async () => {
        const userId = userIdOf(request)
        if (!userId) throw new AppError('未登录', 401, 'UNAUTHORIZED')
        const emp = await selfEmployee(userId)
        return selfSubmit(id, { employeeId: emp.id, userId }, parsed.data.score, parsed.data.comment)
      })
    },
  )

  server.post(
    '/reviews/:id/manager',
    { preHandler: requirePermission(EMP_MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          finalScore: SCORE,
          comment: z.string().min(1).max(2000),
          thresholds: z
            .array(z.object({ min: z.number().int().min(0).max(100), grade: z.string().min(1).max(4) }))
            .optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, async () => {
        const userId = userIdOf(request)
        if (!userId) throw new AppError('未登录', 401, 'UNAUTHORIZED')
        return managerScore(id, { userId }, parsed.data)
      })
    },
  )

  server.post(
    '/reviews/:id/decide',
    { preHandler: requireSelf },
    async (request, reply) => {
      const parsed = z.object({ action: z.enum(['confirm', 'refuse']) }).safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, async () => {
        const userId = userIdOf(request)
        if (!userId) throw new AppError('未登录', 401, 'UNAUTHORIZED')
        const emp = await selfEmployee(userId)
        return employeeDecide(id, { employeeId: emp.id }, parsed.data.action)
      })
    },
  )

/** 管理面代确认/代退(极少场景留口子;reason ≥4 字进 note,服务层走 admin kind,可追责) */
  server.post(
    '/reviews/:id/admin-decide',
    { preHandler: requirePermission(EMP_MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          action: z.enum(['confirm', 'refuse']),
          reason: z.string().min(4).max(500),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () =>
        adminReviewDecide(id, parsed.data.action, userIdOf(request), parsed.data.reason),
      )
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
