// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 奖金/经济补偿/算薪复核路由(前缀 /api/hr-comp)。
 *
 * 权限统一 hr:payroll:manage(金额与审批比考勤更敏感)。
 * 纯测算接口(calc)不落库,落库接口才写台账 —— 前端可先试算再确认。
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'

import { AppError } from '../errors/AppError.js'
import { requirePermission } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { buildSchema } from '../utils/swagger.js'
import {
  calcAnnualBonusTax,
  calcSeverance,
  createBonusPayment,
  createSeveranceRecord,
  listBonusPayments,
  listSeveranceRecords,
} from '../services/hr-compensation.js'
import {
  payrollReviewTrail,
  reviewPayroll,
  submitPayrollForReview,
} from '../services/hr-payroll-review.js'

const PAYROLL = 'hr:payroll:manage'
const uuid = z.string().uuid()
const month = z.string().regex(/^\d{4}-\d{2}$/, '月份必须是 YYYY-MM')
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期必须是 YYYY-MM-DD')

function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof AppError) {
    reply.status(err.statusCode).send(error(err.statusCode, err.message, err.errorCode))
    return true
  }
  return false
}

export const hrCompRoutes: FastifyPluginAsync = async (server) => {
  // ── 年终奖 ────────────────────────────────────────────────────────────
  server.post(
    '/bonus/calc',
    {
      preHandler: requirePermission(PAYROLL),
      schema: buildSchema({ tags: ['人事-薪资'], summary: '年终奖单独计税试算(不落库)' }),
    },
    async (request, reply) => {
      const body = z.object({ bonusAmount: z.number().positive() }).safeParse(request.body)
      if (!body.success) {
        reply.status(400).send(error(400, 'bonusAmount 必须大于 0', 'VALIDATION_FAILED'))
        return
      }
      try {
        reply.send(success(calcAnnualBonusTax(body.data.bonusAmount)))
      } catch (err) {
        if (!fail(reply, err)) throw err
      }
    },
  )

  server.post(
    '/bonus-payments',
    {
      preHandler: requirePermission(PAYROLL),
      schema: buildSchema({ tags: ['人事-薪资'], summary: '登记年终奖并单独计税' }),
    },
    async (request, reply) => {
      const body = z
        .object({
          employeeId: uuid,
          periodMonth: month,
          bonusType: z.enum(['annual', 'quarterly', 'project', 'other']).optional(),
          bonusAmount: z.number().positive(),
          taxMethod: z.enum(['separate', 'merged']).optional(),
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
        reply.send(success(await createBonusPayment({ ...body.data, createdBy: userId })))
      } catch (err) {
        if (!fail(reply, err)) throw err
      }
    },
  )

  server.get(
    '/bonus-payments',
    {
      preHandler: requirePermission(PAYROLL),
      schema: buildSchema({ tags: ['人事-薪资'], summary: '年终奖台账' }),
    },
    async (request, reply) => {
      const q = z
        .object({ periodMonth: month.optional(), employeeId: uuid.optional() })
        .safeParse(request.query)
      if (!q.success) {
        reply
          .status(400)
          .send(error(400, q.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      reply.send(success(await listBonusPayments(q.data)))
    },
  )

  // ── 经济补偿 ───────────────────────────────────────────────────────────
  server.post(
    '/severance/calc',
    {
      preHandler: requirePermission(PAYROLL),
      schema: buildSchema({ tags: ['人事-薪资'], summary: '经济补偿金试算(不落库)' }),
    },
    async (request, reply) => {
      const body = z
        .object({
          hireDate: date,
          lastWorkDate: date,
          monthlyAvgWage: z.number().positive(),
          localAvgMonthlyWage: z.number().positive(),
        })
        .safeParse(request.body)
      if (!body.success) {
        reply
          .status(400)
          .send(error(400, body.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      try {
        reply.send(success(calcSeverance(body.data)))
      } catch (err) {
        if (!fail(reply, err)) throw err
      }
    },
  )

  server.post(
    '/severance-records',
    {
      preHandler: requirePermission(PAYROLL),
      schema: buildSchema({ tags: ['人事-薪资'], summary: '登记经济补偿测算' }),
    },
    async (request, reply) => {
      const body = z
        .object({
          employeeId: uuid,
          resignationId: uuid.nullable().optional(),
          hireDate: date.optional(),
          lastWorkDate: date.optional(),
          monthlyAvgWage: z.number().positive(),
          localAvgMonthlyWage: z.number().positive(),
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
        reply.send(success(await createSeveranceRecord({ ...body.data, createdBy: userId })))
      } catch (err) {
        if (!fail(reply, err)) throw err
      }
    },
  )

  server.get(
    '/severance-records',
    {
      preHandler: requirePermission(PAYROLL),
      schema: buildSchema({ tags: ['人事-薪资'], summary: '经济补偿台账' }),
    },
    async (request, reply) => {
      const q = z.object({ employeeId: uuid.optional() }).safeParse(request.query)
      if (!q.success) {
        reply.status(400).send(error(400, 'employeeId 无效', 'VALIDATION_FAILED'))
        return
      }
      reply.send(success(await listSeveranceRecords(q.data)))
    },
  )

  // ── 算薪复核 ───────────────────────────────────────────────────────────
  server.post(
    '/payroll/submit',
    {
      preHandler: requirePermission(PAYROLL),
      schema: buildSchema({ tags: ['人事-薪资'], summary: '提交算薪复核(留痕)' }),
    },
    async (request, reply) => {
      const body = z.object({ periodMonth: month }).safeParse(request.body)
      if (!body.success) {
        reply.status(400).send(error(400, 'periodMonth 必须是 YYYY-MM', 'VALIDATION_FAILED'))
        return
      }
      const userId = (request.user as { id?: string } | undefined)?.id ?? null
      try {
        reply.send(success(await submitPayrollForReview(body.data.periodMonth, userId)))
      } catch (err) {
        if (!fail(reply, err)) throw err
      }
    },
  )

  server.post(
    '/payroll/review',
    {
      preHandler: requirePermission(PAYROLL),
      schema: buildSchema({ tags: ['人事-薪资'], summary: '复核算薪:批准/退回(制单≠复核)' }),
    },
    async (request, reply) => {
      const body = z
        .object({
          periodMonth: month,
          decision: z.enum(['approve', 'reject']),
          note: z.string().max(500).optional(),
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
        reply.send(
          success(
            await reviewPayroll({
              periodMonth: body.data.periodMonth,
              decision: body.data.decision,
              note: body.data.note ?? null,
              reviewerId: userId,
            }),
          ),
        )
      } catch (err) {
        if (!fail(reply, err)) throw err
      }
    },
  )

  server.get(
    '/payroll/review-trail',
    {
      preHandler: requirePermission(PAYROLL),
      schema: buildSchema({ tags: ['人事-薪资'], summary: '算薪审批时间线' }),
    },
    async (request, reply) => {
      const q = z.object({ periodMonth: month }).safeParse(request.query)
      if (!q.success) {
        reply.status(400).send(error(400, 'periodMonth 必须是 YYYY-MM', 'VALIDATION_FAILED'))
        return
      }
      try {
        reply.send(success(await payrollReviewTrail(q.data.periodMonth)))
      } catch (err) {
        if (!fail(reply, err)) throw err
      }
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
