// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, between, eq } from 'drizzle-orm'

import { hrAttendanceMonthly, hrEmployee } from '@ihui/database'
import { db } from '../db/index.js'
import { buildDailyAttendance, buildMonthlyAttendance } from '../services/hr-attendance-settle.js'
import { requirePermission } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { AppError } from '../errors/AppError.js'
import { buildSchema } from '../utils/swagger.js'

/**
 * 考勤结算路由(HR-5 第 4 期,2026-11-12 立)。
 *
 * 补齐链条最后一环:四类导入数据 → 日结 → 月结。
 * 在此之前 hr_attendance_daily / hr_attendance_monthly 只有读没有写,
 * 加班和请假存进去却永远算不进工资。
 *
 * 权限:hr:attendance:manage(结算会写正式表,与建档同档)。
 */

const HR_MANAGE = 'hr:attendance:manage'

const periodSchema = z.object({
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/, '月份格式必须是 YYYY-MM'),
  departmentId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
})

const monthlySchema = z.object({
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/, '月份格式必须是 YYYY-MM'),
  departmentId: z.string().uuid().optional(),
  /** 是否覆盖已签字归档的月结(默认 false —— 财务签过的账不许悄悄改) */
  overwriteSigned: z.boolean().optional(),
})

export const hrSettleRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // 1. POST /api/hr-settle/daily — 生成日结
  // ==========================================================================
  server.post(
    '/daily',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        tags: ['人事-考勤结算'],
        summary: '生成考勤日结(某月每一天 × 在职员工)',
        description:
          '汇总打卡/请假/加班/外出四类原始数据成日结。幂等:同一员工同一天重复执行只更新不重复插入。',
      }),
    },
    async (request, reply) => {
      const parsed = periodSchema.safeParse(request.body)
      if (!parsed.success) {
        reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      try {
        const result = await buildDailyAttendance(parsed.data)
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
  // 2. POST /api/hr-settle/monthly — 生成月结
  // ==========================================================================
  server.post(
    '/monthly',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        tags: ['人事-考勤结算'],
        summary: '生成月度考勤汇总(从日结汇总)',
        description:
          '只读日结表,不回头读原始单据。已 signed 的月结默认拒绝覆盖,需显式 overwriteSigned=true。',
      }),
    },
    async (request, reply) => {
      const parsed = monthlySchema.safeParse(request.body)
      if (!parsed.success) {
        reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      try {
        const result = await buildMonthlyAttendance(parsed.data)
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
  // 3. GET /api/hr-settle/monthly — 查询月结结果
  // ==========================================================================
  server.get(
    '/monthly',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        tags: ['人事-考勤结算'],
        summary: '查询月度考勤汇总',
      }),
    },
    async (request, reply) => {
      const q = request.query as { periodMonth?: string; departmentId?: string }
      if (!q.periodMonth || !/^\d{4}-\d{2}$/.test(q.periodMonth)) {
        reply.status(400).send(error(400, '请提供 periodMonth(YYYY-MM)', 'VALIDATION_FAILED'))
        return
      }
      const filters = [eq(hrAttendanceMonthly.periodMonth, q.periodMonth)]
      if (q.departmentId) filters.push(eq(hrAttendanceMonthly.departmentId, q.departmentId))
      const rows = await db
        .select({
          id: hrAttendanceMonthly.id,
          employeeId: hrAttendanceMonthly.employeeId,
          employeeNo: hrEmployee.employeeNo,
          employeeName: hrEmployee.name,
          scheduledDays: hrAttendanceMonthly.scheduledDays,
          actualDays: hrAttendanceMonthly.actualDays,
          lateCount: hrAttendanceMonthly.lateCount,
          earlyCount: hrAttendanceMonthly.earlyCount,
          absentDays: hrAttendanceMonthly.absentDays,
          leaveDays: hrAttendanceMonthly.leaveDays,
          otHours: hrAttendanceMonthly.otHours,
          otDetail: hrAttendanceMonthly.otDetail,
          signed: hrAttendanceMonthly.signed,
        })
        .from(hrAttendanceMonthly)
        .leftJoin(hrEmployee, eq(hrEmployee.id, hrAttendanceMonthly.employeeId))
        .where(and(...filters))
        .limit(500)
      reply.send(success({ periodMonth: q.periodMonth, rows }))
    },
  )
}

/** 保留导出:结算服务里读日结明细的辅助(供后续报表复用) */
export async function listDailyDetail(params: {
  periodMonth: string
  employeeId?: string | undefined
}): Promise<unknown[]> {
  const [y, m] = params.periodMonth.split('-').map(Number) as [number, number]
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const start = `${params.periodMonth}-01`
  const end = `${params.periodMonth}-${String(lastDay).padStart(2, '0')}`
  const { hrAttendanceDaily } = await import('@ihui/database')
  const filters = [between(hrAttendanceDaily.date, start, end)]
  if (params.employeeId) filters.push(eq(hrAttendanceDaily.employeeId, params.employeeId))
  // hr_attendance_daily 无 deletedAt 列(日结是派生表,物理覆盖即可)
  return db
    .select()
    .from(hrAttendanceDaily)
    .where(and(...filters))
    .limit(2000)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
