// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 排班 + 社保增减员路由(前缀 /api/hr-shift)。
 *
 * 权限:
 *   · hr:attendance:manage —— 班次 CRUD、排班、删除排班
 *   · hr:attendance:view   —— 班次/排班/月历读取
 *   · hr:employee:manage   —— 社保增减员台账写入与回执回填
 *   · hr:employee:view     —— 增减员台账读取
 * 路由只做参数校验,状态推进一律在服务层。
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'

import { AppError } from '../errors/AppError.js'
import { requirePermission } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { buildSchema } from '../utils/swagger.js'
import {
  assignShifts,
  createShift,
  deleteAssignment,
  deleteShift,
  listAssignments,
  listShifts,
  shiftCalendar,
  updateShift,
} from '../services/hr-shift.js'
import {
  createSocialChange,
  listSocialChanges,
  markSocialAccepted,
  markSocialFailed,
  markSocialSubmitted,
  socialChangeSummary,
} from '../services/hr-social-change.js'

const ATT_MANAGE = 'hr:attendance:manage'
const ATT_VIEW = 'hr:attendance:view'
const EMP_MANAGE = 'hr:employee:manage'
const EMP_VIEW = 'hr:employee:view'

const uuid = z.string().uuid()
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期必须是 YYYY-MM-DD')
const month = z.string().regex(/^\d{4}-\d{2}$/, '月份必须是 YYYY-MM')
const hm = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, '时间必须是 HH:MM')

function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof AppError) {
    reply.status(err.statusCode).send(error(err.statusCode, err.message, err.errorCode))
    return true
  }
  return false
}

export const hrShiftSocialRoutes: FastifyPluginAsync = async (server) => {
  // ── 班次 ──────────────────────────────────────────────────────────────
  server.get(
    '/shifts',
    {
      preHandler: requirePermission(ATT_VIEW),
      schema: buildSchema({ tags: ['人事-排班'], summary: '班次列表' }),
    },
    async (request, reply) => {
      const q = z
        .object({
          departmentId: uuid.optional(),
          status: z.enum(['enabled', 'disabled']).optional(),
        })
        .safeParse(request.query)
      if (!q.success) {
        reply
          .status(400)
          .send(error(400, q.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      reply.send(success(await listShifts(q.data)))
    },
  )

  server.post(
    '/shifts',
    {
      preHandler: requirePermission(ATT_MANAGE),
      schema: buildSchema({ tags: ['人事-排班'], summary: '新建班次' }),
    },
    async (request, reply) => {
      const body = z
        .object({
          departmentId: uuid,
          name: z.string().min(1).max(100),
          startTime: hm,
          endTime: hm,
          flexMinutes: z.number().int().min(0).max(240).optional(),
          crossesMidnight: z.boolean().optional(),
          status: z.enum(['enabled', 'disabled']).optional(),
        })
        .safeParse(request.body)
      if (!body.success) {
        reply
          .status(400)
          .send(error(400, body.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      try {
        reply.send(success(await createShift(body.data)))
      } catch (err) {
        if (!fail(reply, err)) throw err
      }
    },
  )

  server.patch(
    '/shifts/:id',
    {
      preHandler: requirePermission(ATT_MANAGE),
      schema: buildSchema({ tags: ['人事-排班'], summary: '修改班次' }),
    },
    async (request, reply) => {
      const id = uuid.safeParse((request.params as { id?: string }).id)
      if (!id.success) {
        reply.status(400).send(error(400, 'id 必须是 UUID', 'VALIDATION_FAILED'))
        return
      }
      const body = z
        .object({
          departmentId: uuid.optional(),
          name: z.string().min(1).max(100).optional(),
          startTime: hm.optional(),
          endTime: hm.optional(),
          flexMinutes: z.number().int().min(0).max(240).optional(),
          crossesMidnight: z.boolean().optional(),
          status: z.enum(['enabled', 'disabled']).optional(),
        })
        .safeParse(request.body)
      if (!body.success) {
        reply
          .status(400)
          .send(error(400, body.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      try {
        reply.send(success(await updateShift(id.data, body.data)))
      } catch (err) {
        if (!fail(reply, err)) throw err
      }
    },
  )

  server.delete(
    '/shifts/:id',
    {
      preHandler: requirePermission(ATT_MANAGE),
      schema: buildSchema({ tags: ['人事-排班'], summary: '停用并删除班次' }),
    },
    async (request, reply) => {
      const id = uuid.safeParse((request.params as { id?: string }).id)
      if (!id.success) {
        reply.status(400).send(error(400, 'id 必须是 UUID', 'VALIDATION_FAILED'))
        return
      }
      try {
        reply.send(success(await deleteShift(id.data)))
      } catch (err) {
        if (!fail(reply, err)) throw err
      }
    },
  )

  // ── 排班 ──────────────────────────────────────────────────────────────
  server.post(
    '/assignments',
    {
      preHandler: requirePermission(ATT_MANAGE),
      schema: buildSchema({ tags: ['人事-排班'], summary: '批量排班(人 × 日期 × 班次)' }),
    },
    async (request, reply) => {
      const body = z
        .object({
          employeeId: uuid,
          shiftId: uuid,
          workDates: z.array(date).min(1).max(62),
          note: z.string().max(200).optional(),
        })
        .safeParse(request.body)
      if (!body.success) {
        reply
          .status(400)
          .send(error(400, body.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      const userId = (request.user as { id?: string } | undefined)?.id ?? null
      try {
        reply.send(success(await assignShifts({ ...body.data, createdBy: userId })))
      } catch (err) {
        if (!fail(reply, err)) throw err
      }
    },
  )

  server.get(
    '/assignments',
    {
      preHandler: requirePermission(ATT_VIEW),
      schema: buildSchema({ tags: ['人事-排班'], summary: '排班明细' }),
    },
    async (request, reply) => {
      const q = z
        .object({
          month: month.optional(),
          employeeId: uuid.optional(),
          departmentId: uuid.optional(),
        })
        .safeParse(request.query)
      if (!q.success) {
        reply
          .status(400)
          .send(error(400, q.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      reply.send(success(await listAssignments(q.data)))
    },
  )

  server.get(
    '/calendar',
    {
      preHandler: requirePermission(ATT_VIEW),
      schema: buildSchema({ tags: ['人事-排班'], summary: '排班月历' }),
    },
    async (request, reply) => {
      const q = z.object({ month }).safeParse(request.query)
      if (!q.success) {
        reply.status(400).send(error(400, 'month 必须是 YYYY-MM', 'VALIDATION_FAILED'))
        return
      }
      reply.send(success(await shiftCalendar(q.data.month)))
    },
  )

  server.delete(
    '/assignments/:id',
    {
      preHandler: requirePermission(ATT_MANAGE),
      schema: buildSchema({ tags: ['人事-排班'], summary: '删除排班' }),
    },
    async (request, reply) => {
      const id = uuid.safeParse((request.params as { id?: string }).id)
      if (!id.success) {
        reply.status(400).send(error(400, 'id 必须是 UUID', 'VALIDATION_FAILED'))
        return
      }
      try {
        reply.send(success(await deleteAssignment(id.data)))
      } catch (err) {
        if (!fail(reply, err)) throw err
      }
    },
  )

  // ── 社保/公积金增减员 ─────────────────────────────────────────────────
  server.post(
    '/social-changes',
    {
      preHandler: requirePermission(EMP_MANAGE),
      schema: buildSchema({ tags: ['人事-社保'], summary: '新建增减员台账' }),
    },
    async (request, reply) => {
      const body = z
        .object({
          employeeId: uuid,
          changeType: z.enum(['increase', 'decrease', 'adjust']),
          effectiveMonth: month.optional(),
          regionName: z.string().max(100).nullable().optional(),
          insuranceBase: z.number().nonnegative().nullable().optional(),
          fundBase: z.number().nonnegative().nullable().optional(),
          note: z.string().max(500).nullable().optional(),
        })
        .safeParse(request.body)
      if (!body.success) {
        reply
          .status(400)
          .send(error(400, body.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      const userId = (request.user as { id?: string } | undefined)?.id ?? null
      try {
        reply.send(success(await createSocialChange({ ...body.data, operatorId: userId })))
      } catch (err) {
        if (!fail(reply, err)) throw err
      }
    },
  )

  server.get(
    '/social-changes',
    {
      preHandler: requirePermission(EMP_VIEW),
      schema: buildSchema({ tags: ['人事-社保'], summary: '增减员台账列表' }),
    },
    async (request, reply) => {
      const q = z
        .object({
          employeeId: uuid.optional(),
          status: z.enum(['pending', 'submitted', 'accepted', 'failed']).optional(),
          effectiveMonth: month.optional(),
          changeType: z.enum(['increase', 'decrease', 'adjust']).optional(),
        })
        .safeParse(request.query)
      if (!q.success) {
        reply
          .status(400)
          .send(error(400, q.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      reply.send(success(await listSocialChanges(q.data)))
    },
  )

  server.get(
    '/social-changes/summary',
    {
      preHandler: requirePermission(EMP_VIEW),
      schema: buildSchema({ tags: ['人事-社保'], summary: '增减员月汇总' }),
    },
    async (request, reply) => {
      const q = z.object({ effectiveMonth: month }).safeParse(request.query)
      if (!q.success) {
        reply.status(400).send(error(400, 'effectiveMonth 必须是 YYYY-MM', 'VALIDATION_FAILED'))
        return
      }
      reply.send(success(await socialChangeSummary(q.data.effectiveMonth)))
    },
  )

  server.post(
    '/social-changes/:id/submit',
    {
      preHandler: requirePermission(EMP_MANAGE),
      schema: buildSchema({ tags: ['人事-社保'], summary: '回填平台回执号(已报)' }),
    },
    async (request, reply) => {
      const id = uuid.safeParse((request.params as { id?: string }).id)
      const body = z.object({ platformRef: z.string().min(1).max(100) }).safeParse(request.body)
      if (!id.success || !body.success) {
        reply.status(400).send(error(400, 'id 或 platformRef 无效', 'VALIDATION_FAILED'))
        return
      }
      const userId = (request.user as { id?: string } | undefined)?.id ?? null
      try {
        reply.send(success(await markSocialSubmitted(id.data, body.data.platformRef, userId)))
      } catch (err) {
        if (!fail(reply, err)) throw err
      }
    },
  )

  server.post(
    '/social-changes/:id/accepted',
    {
      preHandler: requirePermission(EMP_MANAGE),
      schema: buildSchema({ tags: ['人事-社保'], summary: '平台已受理' }),
    },
    async (request, reply) => {
      const id = uuid.safeParse((request.params as { id?: string }).id)
      const body = z.object({ note: z.string().max(500).optional() }).safeParse(request.body ?? {})
      if (!id.success || !body.success) {
        reply.status(400).send(error(400, 'id 无效', 'VALIDATION_FAILED'))
        return
      }
      try {
        reply.send(success(await markSocialAccepted(id.data, body.data.note ?? null)))
      } catch (err) {
        if (!fail(reply, err)) throw err
      }
    },
  )

  server.post(
    '/social-changes/:id/failed',
    {
      preHandler: requirePermission(EMP_MANAGE),
      schema: buildSchema({ tags: ['人事-社保'], summary: '平台退回' }),
    },
    async (request, reply) => {
      const id = uuid.safeParse((request.params as { id?: string }).id)
      const body = z.object({ note: z.string().min(1).max(500) }).safeParse(request.body)
      if (!id.success || !body.success) {
        reply.status(400).send(error(400, 'id 或退回原因无效', 'VALIDATION_FAILED'))
        return
      }
      try {
        reply.send(success(await markSocialFailed(id.data, body.data.note)))
      } catch (err) {
        if (!fail(reply, err)) throw err
      }
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
