// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 发薪闭环路由(前缀 /api/hr-payout)。
 *
 * 权限三档:
 *   · hr:payroll:manage —— 建批次、导出、标记交银行/到账、生成与推送工资条、设置卡号
 *     (导出文件含明文卡号,必须走这一档)
 *   · hr:payslip:view    —— 看工资条与自己签收(员工侧)
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'

import { AppError } from '../errors/AppError.js'
import { requirePermission, requireSelf } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { db } from '../db/index.js'
import { hrEmployee, hrPayslip } from '@ihui/database'
import {
  acknowledgePayslip,
  bankCoverage,
  buildPayoutBatch,
  exportPayoutFile,
  generatePayslips,
  getEmployeeBank,
  listPayoutBatches,
  markPayoutPaid,
  markPayoutSubmitted,
  payoutSummary,
  pushPayslips,
  setEmployeeBank,
} from '../services/hr-payout.js'

const MANAGE = 'hr:payroll:manage'
const SLIP_VIEW = 'hr:payslip:view'
const PERIOD = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '月份必须是 YYYY-MM')

function userIdOf(request: { user?: unknown; jwtPayload?: unknown }): string | null {
  const u = request.user as { id?: string } | undefined
  const p = request.jwtPayload as { userId?: string } | undefined
  return u?.id ?? p?.userId ?? null
}

async function guard<T>(
  reply: { status: (n: number) => { send: (b: unknown) => void }; send: (b: unknown) => void },
  fn: () => Promise<T>,
) {
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

export const hrPayoutRoutes: FastifyPluginAsync = async (server) => {
  // ---------- 员工收款账户 ----------
  server.put(
    '/employees/:employeeId/bank',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          bankName: z.string().min(2).max(100),
          bankAccountNo: z.string().min(8).max(40),
          bankAccountName: z.string().max(100).nullish(),
        })
        .safeParse(request.body)
      if (!parsed.success) {
        reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      const { employeeId } = request.params as { employeeId: string }
      await guard(reply, () =>
        setEmployeeBank(employeeId, {
          bankName: parsed.data.bankName,
          bankAccountNo: parsed.data.bankAccountNo,
          bankAccountName: parsed.data.bankAccountName ?? null,
        }),
      )
    },
  )

  server.get(
    '/employees/:employeeId/bank',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const { employeeId } = request.params as { employeeId: string }
      await guard(reply, () => getEmployeeBank(employeeId))
    },
  )

  server.get(
    '/bank-coverage',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const q = request.query as { periodMonth?: string }
      await guard(reply, () => bankCoverage(q.periodMonth))
    },
  )

  // ---------- 代发批次 ----------
  server.post('/batches', { preHandler: requirePermission(MANAGE) }, async (request, reply) => {
    const parsed = z.object({ periodMonth: PERIOD }).safeParse(request.body)
    if (!parsed.success) {
      reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
      return
    }
    await guard(reply, () => buildPayoutBatch(parsed.data.periodMonth, userIdOf(request)))
  })

  server.get('/batches', { preHandler: requirePermission(MANAGE) }, async (request, reply) => {
    const q = request.query as { periodMonth?: string }
    await guard(reply, () => listPayoutBatches(q.periodMonth))
  })

  server.post(
    '/batches/:id/export',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => exportPayoutFile(id))
    },
  )

  server.post(
    '/batches/:id/submit',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => markPayoutSubmitted(id))
    },
  )

  server.post(
    '/batches/:id/paid',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          paidAt: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        })
        .safeParse(request.body ?? {})
      if (!parsed.success) {
        reply.status(400).send(error(400, 'paidAt 必须是 YYYY-MM-DD', 'VALIDATION_FAILED'))
        return
      }
      const { id } = request.params as { id: string }
      await guard(reply, () => markPayoutPaid(id, parsed.data.paidAt))
    },
  )

  // ---------- 工资条 ----------
  server.post(
    '/payslips/generate',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z.object({ periodMonth: PERIOD }).safeParse(request.body)
      if (!parsed.success) {
        reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      await guard(reply, () => generatePayslips(parsed.data.periodMonth))
    },
  )

  server.post(
    '/payslips/push',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({ periodMonth: PERIOD, channel: z.string().max(30).optional() })
        .safeParse(request.body)
      if (!parsed.success) {
        reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      await guard(reply, () =>
        pushPayslips(parsed.data.periodMonth, parsed.data.channel ?? 'inapp'),
      )
    },
  )

  server.get('/payslips', { preHandler: requirePermission(MANAGE) }, async (request, reply) => {
    const q = request.query as { periodMonth?: string; status?: string }
    await guard(reply, async () => {
      const cond =
        q.periodMonth && q.status
          ? and(eq(hrPayslip.periodMonth, q.periodMonth), eq(hrPayslip.status, q.status))
          : q.periodMonth
            ? eq(hrPayslip.periodMonth, q.periodMonth)
            : q.status
              ? eq(hrPayslip.status, q.status)
              : undefined
      return db.select().from(hrPayslip).where(cond).limit(500)
    })
  })

  // 员工本人视角:只回自己的工资条(不看别人)
  server.get('/my-payslips', { preHandler: requireSelf }, async (request, reply) => {
    const userId = userIdOf(request)
    if (!userId) {
      reply.status(401).send(error(401, '未登录', 'UNAUTHORIZED'))
      return
    }
    await guard(reply, async () => {
      const [emp] = await db
        .select({ id: hrEmployee.id })
        .from(hrEmployee)
        .where(eq(hrEmployee.userId, userId))
        .limit(1)
      if (!emp) return { employeeId: null, list: [] as unknown[] }
      const rows = await db
        .select()
        .from(hrPayslip)
        .where(eq(hrPayslip.employeeId, emp.id))
        .orderBy(hrPayslip.periodMonth)
        .limit(12)
      return { employeeId: emp.id, list: rows }
    })
  })

  server.post(
    '/payslips/:id/acknowledge',
    { preHandler: requirePermission(SLIP_VIEW) },
    async (request, reply) => {
      const parsed = z
        .object({ channel: z.string().max(30).optional(), remark: z.string().max(500).nullish() })
        .safeParse(request.body ?? {})
      if (!parsed.success) {
        reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      const { id } = request.params as { id: string }
      await guard(reply, () =>
        acknowledgePayslip(id, parsed.data.channel ?? 'inapp', parsed.data.remark ?? null),
      )
    },
  )

  server.get('/summary', { preHandler: requirePermission(MANAGE) }, async (request, reply) => {
    const q = request.query as { periodMonth?: string }
    const periodMonth = q.periodMonth
    if (!periodMonth) {
      reply.status(400).send(error(400, 'periodMonth 必填', 'VALIDATION_FAILED'))
      return
    }
    await guard(reply, () => payoutSummary(periodMonth))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
