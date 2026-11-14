// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, desc, eq, isNull } from 'drizzle-orm'

import { hrEmployeeTaxProfile, hrInsuranceRateConfig, hrSalaryConfig } from '@ihui/database'
import { db } from '../db/index.js'
import { requirePermission } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { AppError } from '../errors/AppError.js'
import { buildSchema } from '../utils/swagger.js'

/**
 * 薪资配置管理路由(2026-11-13 立)。
 *
 * 这是算薪的前置数据入口:算薪引擎(hr-payroll.ts)读三张表 ——
 *   · hr_salary_config       员工薪资(基本工资/加班基数/社保基数/公积金比例/津贴/生效期)
 *   · hr_insurance_rate_config 各地区社保公积金费率(按年度)
 *   · hr_employee_tax_profile  员工个税专项附加扣除
 * 三表缺配置时算薪引擎会跳过该员工(skippedNoConfig)或社保按 0(warning),
 * 所以本路由是"打通算薪"的第一块 —— 没有录入入口,引擎再对也算不出数。
 *
 * 权限:沿用 hr:payroll:manage(薪资配置比工资单更敏感,同档管控)。
 * 设计铁律:费率/基数/生效期全部可配置,绝不在代码里写死任何比例或金额。
 */

const HR_PAYROLL = 'hr:payroll:manage'

const uuidSchema = z.string().uuid()
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期必须是 YYYY-MM-DD')

/** 金额:非负、两位小数上限(用 string 承载避免浮点漂移,与 numeric 列对齐) */
const moneySchema = z.string().regex(/^\d+(\.\d{1,2})?$/, '金额必须是非负数,最多两位小数')
/** 费率:0~1 之间,最多四位小数(如 0.08 = 8%) */
const rateSchema = z.string().regex(/^(0|1)(\.\d{1,4})?$/, '费率必须在 0~1 之间,最多四位小数')

// ==========================================================================
// Schemas
// ==========================================================================

const salaryUpsertSchema = z.object({
  employeeId: uuidSchema,
  baseSalary: moneySchema,
  otBase: moneySchema.optional(),
  insuranceBase: moneySchema.optional(),
  housingFundRate: rateSchema.optional(),
  fixedAllowance: moneySchema.optional(),
  effectiveFrom: dateSchema,
  effectiveTo: dateSchema.nullable().optional(),
})

const insuranceUpsertSchema = z.object({
  regionName: z.string().min(1).max(100),
  effectiveYear: z.number().int().min(2000).max(2100),
  pensionEmployer: rateSchema.optional(),
  pensionPersonal: rateSchema.optional(),
  unemploymentEmployer: rateSchema.optional(),
  unemploymentPersonal: rateSchema.optional(),
  medicalEmployer: rateSchema.optional(),
  medicalPersonal: rateSchema.optional(),
  injuryEmployer: rateSchema.optional(),
  housingFundRate: rateSchema.optional(),
  insuranceBaseMin: moneySchema.optional(),
  insuranceBaseMax: moneySchema.optional(),
  fundBaseMin: moneySchema.optional(),
  fundBaseMax: moneySchema.optional(),
  enabled: z.boolean().optional(),
})

const taxProfileUpsertSchema = z.object({
  employeeId: uuidSchema,
  childrenCount: z.number().int().min(0).max(10).optional(),
  childrenDeductionRatio: z
    .string()
    .regex(/^(0|1)(\.\d{1,2})?$/)
    .optional(),
  infantCount: z.number().int().min(0).max(10).optional(),
  isOnlyChild: z.boolean().optional(),
  elderlySupportShare: moneySchema.optional(),
  housingType: z.enum(['none', 'rent', 'loan']).optional(),
  housingRentAmount: moneySchema.optional(),
  otherMonthlyDeduction: moneySchema.optional(),
})

// 统一错误透传(与 hr-payroll.ts 同模式)
function sendErr(err: unknown, reply: { status: (c: number) => { send: (b: unknown) => void } }) {
  if (err instanceof AppError) {
    reply.status(err.statusCode).send(error(err.statusCode, err.message, err.errorCode))
    return
  }
  throw err
}

export const hrSalaryConfigRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // A. 员工薪资配置
  // ==========================================================================

  // A1. GET /api/hr-salary-config/employees — 某员工薪资配置历史(最新在前)
  server.get(
    '/employees',
    {
      preHandler: requirePermission(HR_PAYROLL),
      schema: buildSchema({ tags: ['人事-薪资配置'], summary: '某员工薪资配置历史' }),
    },
    async (request, reply) => {
      const q = request.query as { employeeId?: string }
      if (!q.employeeId || !uuidSchema.safeParse(q.employeeId).success) {
        reply.status(400).send(error(400, '请提供 employeeId(uuid)', 'VALIDATION_FAILED'))
        return
      }
      const rows = await db
        .select()
        .from(hrSalaryConfig)
        .where(eq(hrSalaryConfig.employeeId, q.employeeId))
        .orderBy(desc(hrSalaryConfig.effectiveFrom))
        .limit(100)
      reply.send(success({ employeeId: q.employeeId, count: rows.length, rows }))
    },
  )

  // A2. POST /api/hr-salary-config/employees — 新增一条薪资配置(调薪/入职)
  server.post(
    '/employees',
    {
      preHandler: requirePermission(HR_PAYROLL),
      schema: buildSchema({
        tags: ['人事-薪资配置'],
        summary: '新增员工薪资配置(支持历史版本/调薪)',
        description:
          '同一员工可有多条按生效期排列的配置,算薪时取 effectiveFrom 最新的一条。' +
          '若新配置 effectiveTo 为空且已有 open-ended 旧配置,旧配置会被自动闭合到新配置生效前一日。',
      }),
    },
    async (request, reply) => {
      const parsed = salaryUpsertSchema.safeParse(request.body)
      if (!parsed.success) {
        reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      try {
        const d = parsed.data
        // 闭合旧的 open-ended 配置:同一员工不应有两条"至今有效"的配置(会让算薪取数歧义)。
        // 新配置 open-ended 时,把旧 open-ended 配置闭合到"新配置生效前一日"。
        if (d.effectiveTo === null || d.effectiveTo === undefined) {
          const prevDay = new Date(`${d.effectiveFrom}T00:00:00Z`)
          prevDay.setUTCDate(prevDay.getUTCDate() - 1)
          const prevDayStr = prevDay.toISOString().slice(0, 10)
          await db
            .update(hrSalaryConfig)
            .set({ effectiveTo: prevDayStr, updatedAt: new Date() })
            .where(
              and(eq(hrSalaryConfig.employeeId, d.employeeId), isNull(hrSalaryConfig.effectiveTo)),
            )
        }
        const userId = (request.user as { id?: string } | undefined)?.id
        const [row] = await db
          .insert(hrSalaryConfig)
          .values({
            employeeId: d.employeeId,
            baseSalary: d.baseSalary,
            otBase: d.otBase ?? null,
            insuranceBase: d.insuranceBase ?? null,
            housingFundRate: d.housingFundRate ?? null,
            fixedAllowance: d.fixedAllowance ?? '0',
            effectiveFrom: d.effectiveFrom,
            effectiveTo: d.effectiveTo ?? null,
            createdBy: userId ?? null,
          })
          .returning()
        reply.send(success(row))
      } catch (err) {
        sendErr(err, reply)
      }
    },
  )

  // A3. DELETE /api/hr-salary-config/employees/:id — 删除一条配置
  server.delete(
    '/employees/:id',
    {
      preHandler: requirePermission(HR_PAYROLL),
      schema: buildSchema({ tags: ['人事-薪资配置'], summary: '删除员工薪资配置' }),
    },
    async (request, reply) => {
      const { id } = request.params as { id?: string }
      if (!id || !uuidSchema.safeParse(id).success) {
        reply.status(400).send(error(400, 'id 必须是 uuid', 'VALIDATION_FAILED'))
        return
      }
      const deleted = await db
        .delete(hrSalaryConfig)
        .where(eq(hrSalaryConfig.id, id))
        .returning({ id: hrSalaryConfig.id })
      if (deleted.length === 0) {
        reply.status(404).send(error(404, '配置不存在', 'SALARY_CONFIG_NOT_FOUND'))
        return
      }
      reply.send(success({ deletedId: id }))
    },
  )

  // ==========================================================================
  // B. 地区社保公积金费率配置
  // ==========================================================================

  // B1. GET /api/hr-salary-config/insurance — 费率列表(可按地区/年度过滤)
  server.get(
    '/insurance',
    {
      preHandler: requirePermission(HR_PAYROLL),
      schema: buildSchema({ tags: ['人事-薪资配置'], summary: '社保公积金费率列表' }),
    },
    async (request, reply) => {
      const q = request.query as { regionName?: string; effectiveYear?: string }
      const filters = []
      if (q.regionName) filters.push(eq(hrInsuranceRateConfig.regionName, q.regionName))
      if (q.effectiveYear && /^\d{4}$/.test(q.effectiveYear)) {
        filters.push(eq(hrInsuranceRateConfig.effectiveYear, Number(q.effectiveYear)))
      }
      const rows = await db
        .select()
        .from(hrInsuranceRateConfig)
        .where(filters.length ? and(...filters) : undefined)
        .orderBy(desc(hrInsuranceRateConfig.effectiveYear), hrInsuranceRateConfig.regionName)
        .limit(200)
      reply.send(success({ count: rows.length, rows }))
    },
  )

  // B2. POST /api/hr-salary-config/insurance — upsert 某地区某年度费率
  server.post(
    '/insurance',
    {
      preHandler: requirePermission(HR_PAYROLL),
      schema: buildSchema({
        tags: ['人事-薪资配置'],
        summary: '新增/更新地区社保公积金费率(按 地区+年度 upsert)',
        description: '费率各地不同、每年变,全部可配置,引擎不写死。同地区同年重复提交即更新。',
      }),
    },
    async (request, reply) => {
      const parsed = insuranceUpsertSchema.safeParse(request.body)
      if (!parsed.success) {
        reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      try {
        const d = parsed.data
        const [existing] = await db
          .select({ id: hrInsuranceRateConfig.id })
          .from(hrInsuranceRateConfig)
          .where(
            and(
              eq(hrInsuranceRateConfig.regionName, d.regionName),
              eq(hrInsuranceRateConfig.effectiveYear, d.effectiveYear),
            ),
          )
          .limit(1)

        const values = {
          regionName: d.regionName,
          effectiveYear: d.effectiveYear,
          pensionEmployer: d.pensionEmployer ?? null,
          pensionPersonal: d.pensionPersonal ?? null,
          unemploymentEmployer: d.unemploymentEmployer ?? null,
          unemploymentPersonal: d.unemploymentPersonal ?? null,
          medicalEmployer: d.medicalEmployer ?? null,
          medicalPersonal: d.medicalPersonal ?? null,
          injuryEmployer: d.injuryEmployer ?? null,
          housingFundRate: d.housingFundRate ?? null,
          insuranceBaseMin: d.insuranceBaseMin ?? null,
          insuranceBaseMax: d.insuranceBaseMax ?? null,
          fundBaseMin: d.fundBaseMin ?? null,
          fundBaseMax: d.fundBaseMax ?? null,
          enabled: d.enabled ?? true,
          updatedAt: new Date(),
        }

        const [row] = existing
          ? await db
              .update(hrInsuranceRateConfig)
              .set(values)
              .where(eq(hrInsuranceRateConfig.id, existing.id))
              .returning()
          : await db.insert(hrInsuranceRateConfig).values(values).returning()
        reply.send(success(row))
      } catch (err) {
        sendErr(err, reply)
      }
    },
  )

  // ==========================================================================
  // C. 员工个税专项附加扣除
  // ==========================================================================

  // C1. GET /api/hr-salary-config/tax-profile/:employeeId — 某员工个税扣除信息
  server.get(
    '/tax-profile/:employeeId',
    {
      preHandler: requirePermission(HR_PAYROLL),
      schema: buildSchema({ tags: ['人事-薪资配置'], summary: '某员工个税专项附加扣除' }),
    },
    async (request, reply) => {
      const { employeeId } = request.params as { employeeId?: string }
      if (!employeeId || !uuidSchema.safeParse(employeeId).success) {
        reply.status(400).send(error(400, 'employeeId 必须是 uuid', 'VALIDATION_FAILED'))
        return
      }
      const [row] = await db
        .select()
        .from(hrEmployeeTaxProfile)
        .where(eq(hrEmployeeTaxProfile.employeeId, employeeId))
        .limit(1)
      reply.send(success(row ?? null))
    },
  )

  // C2. POST /api/hr-salary-config/tax-profile — upsert 某员工个税扣除
  server.post(
    '/tax-profile',
    {
      preHandler: requirePermission(HR_PAYROLL),
      schema: buildSchema({
        tags: ['人事-薪资配置'],
        summary: '新增/更新员工个税专项附加扣除(按员工 upsert,一员工一条)',
      }),
    },
    async (request, reply) => {
      const parsed = taxProfileUpsertSchema.safeParse(request.body)
      if (!parsed.success) {
        reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      try {
        const d = parsed.data
        const [row] = await db
          .insert(hrEmployeeTaxProfile)
          .values({
            employeeId: d.employeeId,
            childrenCount: d.childrenCount ?? 0,
            childrenDeductionRatio: d.childrenDeductionRatio ?? '1.00',
            infantCount: d.infantCount ?? 0,
            isOnlyChild: d.isOnlyChild ?? true,
            elderlySupportShare: d.elderlySupportShare ?? null,
            housingType: d.housingType ?? 'none',
            housingRentAmount: d.housingRentAmount ?? null,
            otherMonthlyDeduction: d.otherMonthlyDeduction ?? '0',
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: hrEmployeeTaxProfile.employeeId,
            set: {
              childrenCount: d.childrenCount ?? 0,
              childrenDeductionRatio: d.childrenDeductionRatio ?? '1.00',
              infantCount: d.infantCount ?? 0,
              isOnlyChild: d.isOnlyChild ?? true,
              elderlySupportShare: d.elderlySupportShare ?? null,
              housingType: d.housingType ?? 'none',
              housingRentAmount: d.housingRentAmount ?? null,
              otherMonthlyDeduction: d.otherMonthlyDeduction ?? '0',
              updatedAt: new Date(),
            },
          })
          .returning()
        reply.send(success(row))
      } catch (err) {
        sendErr(err, reply)
      }
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
