// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

import { hrPayrollPeriod } from '@ihui/database'
import { db } from '../db/index.js'
import {
  buildPayroll,
  listPayrollItems,
  revertPayrollCalculation,
  getMyPayrollItem,
  listMyPayrollPeriods,
  buildPayrollHandoffVoucher,
} from '../services/hr-payroll.js'
import { requirePermission, requireAuth } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { AppError } from '../errors/AppError.js'
import { buildSchema, errorCodeResponses } from '../utils/swagger.js'
import { exportToExcel, type ColumnDef } from '../services/excel-export-service.js'

/**
 * 薪资计算路由(HR-5 第 5 期,2026-11-12 立)。
 *
 * 串联:月结考勤 → 薪资计算 → 工资单。
 * 权限:hr:payroll:manage(薪资比考勤更敏感,单独一档)。
 */

const HR_PAYROLL = 'hr:payroll:manage'

const calcSchema = z.object({
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/, '月份格式必须是 YYYY-MM'),
  /** 参保地区名(对应 hr_insurance_rate_config.region_name);不传则取该年第一条启用配置 */
  regionName: z.string().max(100).optional(),
  /** 是否覆盖已审批通过的周期(默认 false —— 财务审过的账不许改) */
  overwriteApproved: z.boolean().optional(),
})

const statusSchema = z.object({
  status: z.enum(['draft', 'calculated', 'approved', 'paid']),
})

export const hrPayrollRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // 1. POST /api/hr-payroll/calculate — 计算某月工资
  // ==========================================================================
  server.post(
    '/calculate',
    {
      preHandler: requirePermission(HR_PAYROLL),
      schema: buildSchema({
        tags: ['人事-薪资'],
        summary: '计算月度工资(基于月结考勤 + 薪资配置)',
        description:
          '需该月月结考勤已生成。每步中间值写入 breakdown 可审计。' +
          '缺薪资配置的员工会被跳过并报数,绝不猜数。',
      }),
    },
    async (request, reply) => {
      const parsed = calcSchema.safeParse(request.body)
      if (!parsed.success) {
        reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      const userId = (request.user as { id?: string } | undefined)?.id
      try {
        const result = await buildPayroll({ ...parsed.data, operatedBy: userId })
        reply.send(success(result))
      } catch (err) {
        if (err instanceof AppError) {
          reply.status(err.statusCode).send(error(err.statusCode, err.message, err.errorCode))
          return
        }
        throw err
      }
    },
  )

  // ==========================================================================
  // 2. GET /api/hr-payroll/items — 查询某月工资单
  // ==========================================================================
  server.get(
    '/items',
    {
      preHandler: requirePermission(HR_PAYROLL),
      schema: buildSchema({
        tags: ['人事-薪资'],
        summary: '查询月度工资单(含计算明细)',
      }),
    },
    async (request, reply) => {
      const q = request.query as { periodMonth?: string }
      if (!q.periodMonth || !/^\d{4}-\d{2}$/.test(q.periodMonth)) {
        reply.status(400).send(error(400, '请提供 periodMonth(YYYY-MM)', 'VALIDATION_FAILED'))
        return
      }
      const rows = await listPayrollItems(q.periodMonth)
      const totalGross = rows.reduce((s, r) => s + Number(r.grossPay), 0)
      const totalNet = rows.reduce((s, r) => s + Number(r.netPay), 0)
      reply.send(
        success({
          periodMonth: q.periodMonth,
          count: rows.length,
          totalGross: Math.round(totalGross * 100) / 100,
          totalNet: Math.round(totalNet * 100) / 100,
          rows,
        }),
      )
    },
  )

  // ==========================================================================
  // 3. POST /api/hr-payroll/status — 推进周期状态(draft→calculated→approved→paid)
  // ==========================================================================
  server.post(
    '/status',
    {
      preHandler: requirePermission(HR_PAYROLL),
      schema: buildSchema({
        tags: ['人事-薪资'],
        summary: '变更薪资周期状态',
        description:
          'approved 之后的周期默认不可重算(除非显式 overwriteApproved);paid 之后完全锁定。',
      }),
    },
    async (request, reply) => {
      const body = request.body as { periodMonth?: string; status?: string }
      const parsedPeriod = z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .safeParse(body.periodMonth)
      if (!parsedPeriod.success) {
        reply.status(400).send(error(400, '请提供 periodMonth(YYYY-MM)', 'VALIDATION_FAILED'))
        return
      }
      const parsedStatus = statusSchema.safeParse({ status: body.status })
      if (!parsedStatus.success) {
        reply
          .status(400)
          .send(error(400, '状态只能是 draft/calculated/approved/paid', 'VALIDATION_FAILED'))
        return
      }
      const [period] = await db
        .select()
        .from(hrPayrollPeriod)
        .where(eq(hrPayrollPeriod.periodMonth, parsedPeriod.data))
        .limit(1)
      if (!period) {
        reply.status(404).send(error(404, '该月薪资周期不存在', 'PAYROLL_PERIOD_NOT_FOUND'))
        return
      }
      // paid 之后彻底锁定
      if (period.status === 'paid' && parsedStatus.data.status !== 'paid') {
        reply.status(409).send(error(409, '已发放的周期不可回退状态', 'PAYROLL_PERIOD_PAID_LOCKED'))
        return
      }
      const [updated] = await db
        .update(hrPayrollPeriod)
        .set({ status: parsedStatus.data.status, updatedAt: new Date() })
        .where(eq(hrPayrollPeriod.id, period.id))
        .returning()
      reply.send(success(updated))
    },
  )

  // ==========================================================================
  // 4. GET /api/hr-payroll/periods — 薪资周期列表
  // ==========================================================================
  server.get(
    '/periods',
    {
      preHandler: requirePermission(HR_PAYROLL),
      schema: buildSchema({ tags: ['人事-薪资'], summary: '薪资周期列表' }),
    },
    async (_request, reply) => {
      const rows = await db.select().from(hrPayrollPeriod).limit(200)
      reply.send(success(rows))
    },
  )

  // ==========================================================================
  // 5. POST /api/hr-payroll/revert — 撤回一次算薪(补偿动作)
  // ==========================================================================
  server.post(
    '/revert',
    {
      preHandler: requirePermission(HR_PAYROLL),
      schema: buildSchema({
        tags: ['人事-薪资'],
        summary: '撤回一次算薪(仅 draft 周期)',
        description:
          '供编排流程在后续步骤失败时补偿用。只删工资单并把周期留在 draft;' +
          'calculated 及以上(人已确认过结果)一律拒绝。不触碰考勤月结。',
      }),
    },
    async (request, reply) => {
      const parsed = z
        .object({ periodMonth: z.string().regex(/^\d{4}-\d{2}$/, '月份格式必须是 YYYY-MM') })
        .safeParse(request.body)
      if (!parsed.success) {
        reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      try {
        const result = await revertPayrollCalculation(parsed.data)
        reply.send(success(result))
      } catch (err) {
        if (err instanceof AppError) {
          reply.status(err.statusCode).send(error(err.statusCode, err.message, err.errorCode))
          return
        }
        throw err
      }
    },
  )

  // ==========================================================================
  // 6. POST /api/hr-payroll/handoff — 人事部→财务部 AI 交割(生成财务凭证)
  // ==========================================================================
  server.post(
    '/handoff',
    {
      preHandler: requirePermission(HR_PAYROLL),
      schema: buildSchema({
        tags: ['人事-薪资'],
        summary: '生成某月薪资的财务交割凭证(算薪→记账联动)',
        description:
          '只读该月 approved 周期的工资单汇总产出借贷平衡的工资凭证(计提+发放),' +
          '**纯产出、不入账、不改账**;是否入账由财务侧决定。非 approved 周期返回 409 ' +
          'PAYROLL_NOT_APPROVED;借贷不平衡返回 500 VOUCHER_UNBALANCED(宁可不交割,不交错账)。',
        response: errorCodeResponses,
      }),
    },
    async (request, reply) => {
      const parsed = z
        .object({ periodMonth: z.string().regex(/^\d{4}-\d{2}$/, '月份格式必须是 YYYY-MM') })
        .safeParse(request.body)
      if (!parsed.success) {
        reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      try {
        const voucher = await buildPayrollHandoffVoucher(parsed.data.periodMonth)
        reply.send(success(voucher))
      } catch (err) {
        if (err instanceof AppError) {
          reply.status(err.statusCode).send(error(err.statusCode, err.message, err.errorCode))
          return
        }
        throw err
      }
    },
  )

  // ==========================================================================
  // 7. POST /api/hr-payroll/handoff/export — 交割凭证单导出(Excel,供财务归档)
  // ==========================================================================
  server.post(
    '/handoff/export',
    {
      preHandler: requirePermission(HR_PAYROLL),
      schema: buildSchema({
        tags: ['人事-薪资'],
        summary: '导出某月薪资的财务交割凭证单(Excel)',
        description:
          '与 /handoff 同判据(仅 approved、借贷平衡),把凭证分录导出为 xlsx 供财务归档/打印。' +
          '**纯产出、不入账**;非 approved 返回 409,不平衡返回 500。',
        response: errorCodeResponses,
      }),
    },
    async (request, reply) => {
      const parsed = z
        .object({ periodMonth: z.string().regex(/^\d{4}-\d{2}$/, '月份格式必须是 YYYY-MM') })
        .safeParse(request.body)
      if (!parsed.success) {
        reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      try {
        const voucher = await buildPayrollHandoffVoucher(parsed.data.periodMonth)
        const month = voucher.periodMonth
        const rows = [
          ...voucher.entries.map((e) => ({
            分录组: e.group,
            会计科目: e.account,
            借贷: e.direction,
            金额: e.amount,
          })),
          // 两组小计行,便于财务核对
          {
            分录组: '计提',
            会计科目: '小计',
            借贷: '借=贷',
            金额: voucher.totals.grossPay,
          },
          {
            分录组: '发放',
            会计科目: '小计',
            借贷: '借=贷',
            金额: voucher.totals.grossPay,
          },
        ]
        const columns: ColumnDef[] = [
          { header: '分录组', field: '分录组', width: 10 },
          { header: '会计科目', field: '会计科目', width: 28 },
          { header: '借贷', field: '借贷', width: 10 },
          { header: '金额(元)', field: '金额', width: 18, type: 'float' },
        ]
        const buffer = await exportToExcel(rows, {
          sheetName: `${month} 工资交割凭证`,
          columns,
          filename: `payroll-handoff-${month}.xlsx`,
        })
        reply
          .header(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          )
          .header('Content-Disposition', `attachment; filename="payroll-handoff-${month}.xlsx"`)
          .send(buffer)
      } catch (err) {
        if (err instanceof AppError) {
          reply.status(err.statusCode).send(error(err.statusCode, err.message, err.errorCode))
          return
        }
        throw err
      }
    },
  )

  /**
   * GET /mine/periods —— 员工自助:列出本人可见的工资月。
   * 权限:登录即可(requireAuth),按 request.userId 查本人档案,无 manage 权限要求。
   */
  server.get('/mine/periods', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.userId
    if (!userId) {
      reply.status(401).send(error(401, '未登录', 'UNAUTHORIZED'))
      return
    }
    const periods = await listMyPayrollPeriods(userId)
    reply.send(success({ periods }))
  })

  /**
   * GET /mine?periodMonth=YYYY-MM —— 员工自助:查本人某月工资单。
   * 权限:登录即可。查不到本人档案或该月未算薪时返回 404(区分未配置/未生成)。
   */
  server.get('/mine', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.userId
    if (!userId) {
      reply.status(401).send(error(401, '未登录', 'UNAUTHORIZED'))
      return
    }
    const parsed = z
      .object({ periodMonth: z.string().regex(/^\d{4}-\d{2}$/, '月份格式必须是 YYYY-MM') })
      .safeParse(request.query)
    if (!parsed.success) {
      reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
      return
    }
    const item = await getMyPayrollItem(userId, parsed.data.periodMonth)
    if (!item) {
      reply.status(404).send(error(404, '该月暂无您的工资单', 'NOT_FOUND'))
      return
    }
    reply.send(success(item))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
