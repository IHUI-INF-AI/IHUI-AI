// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 职级路由(2026-11-24 六波)。前缀 /api/hr-grade。
 * 权限族照抄 hr-shift-social:hr:employee:view|manage,路由只校验参数,
 * 重叠/停用判定全在服务层(§0.6 判据单源)。
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'

import { requirePermission } from '../plugins/require-permission.js'
import { error, success } from '../utils/response.js'
import { AppError } from '../errors/AppError.js'
import {
  createGrade,
  currentGrade,
  currentGradesBulk,
  gradeDistribution,
  gradeHistory,
  grantGrade,
  listGrades,
  updateGrade,
} from '../services/hr-grade.js'

const EMP_VIEW = 'hr:employee:view'
const EMP_MANAGE = 'hr:employee:manage'
const GRADE_REASON = z.enum(['hire', 'promotion', 'transfer', 'demotion', 'other'])

function badRequest(reply: FastifyReply, message: string) {
  return reply.status(400).send(error(400, message, 'BAD_REQUEST'))
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

function userIdOf(request: { user?: unknown; jwtPayload?: unknown }): string | null {
  const u = request.user as { id?: string } | undefined
  const p = request.jwtPayload as { userId?: string } | undefined
  return u?.id ?? p?.userId ?? null
}

export const hrGradeRoutes: FastifyPluginAsync = async (server) => {
  server.get(
    '/grades',
    { preHandler: requirePermission(EMP_VIEW) },
    async (request, reply) => {
      const q = request.query as { includeRetired?: string }
      await guard(reply, () => listGrades(q.includeRetired === 'true'))
    },
  )

  server.post(
    '/grades',
    { preHandler: requirePermission(EMP_MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          code: z.string().min(1).max(40),
          name: z.string().min(1).max(100),
          level: z.number().int().min(1),
          note: z.string().max(500).nullable().optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      await guard(reply, () => createGrade(parsed.data))
    },
  )

  server.patch(
    '/grades/:id',
    { preHandler: requirePermission(EMP_MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          name: z.string().min(1).max(100).optional(),
          level: z.number().int().min(1).optional(),
          note: z.string().max(500).nullable().optional(),
          status: z.enum(['active', 'retired']).optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => updateGrade(id, parsed.data))
    },
  )

  server.post(
    '/grant',
    { preHandler: requirePermission(EMP_MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          employeeId: z.string().uuid(),
          gradeId: z.string().uuid(),
          effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          reason: GRADE_REASON,
          note: z.string().max(500).nullable().optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      await guard(reply, () => grantGrade({ ...parsed.data, operatorId: userIdOf(request) }))
    },
  )

  server.get(
    '/current/:employeeId',
    { preHandler: requirePermission(EMP_VIEW) },
    async (request, reply) => {
      const { employeeId } = request.params as { employeeId: string }
      await guard(reply, async () => ({ employeeId, grade: await currentGrade(employeeId) }))
    },
  )

  server.post(
    '/current-bulk',
    { preHandler: requirePermission(EMP_VIEW) },
    async (request, reply) => {
      const parsed = z
        .object({ employeeIds: z.array(z.string().uuid()).min(1).max(500) })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      await guard(reply, () => currentGradesBulk(parsed.data.employeeIds))
    },
  )

  server.get(
    '/history/:employeeId',
    { preHandler: requirePermission(EMP_VIEW) },
    async (request, reply) => {
      const { employeeId } = request.params as { employeeId: string }
      await guard(reply, async () => ({ employeeId, history: await gradeHistory(employeeId) }))
    },
  )

  server.get(
    '/distribution',
    { preHandler: requirePermission(EMP_VIEW) },
    async (_request, reply) => {
      await guard(reply, () => gradeDistribution())
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
