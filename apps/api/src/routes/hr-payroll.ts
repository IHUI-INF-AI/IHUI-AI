// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, desc, eq, isNull, type SQL } from 'drizzle-orm'

import {
  hrEmployee,
  hrEmployeeTaxProfile,
  hrInsuranceRateConfig,
  hrPayrollPeriod,
  hrSalaryConfig,
} from '@ihui/database'
import { db } from '../db/index.js'
import { buildPayroll, listPayrollItems, revertPayrollCalculation } from '../services/hr-payroll.js'
import { requirePermission } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { AppError } from '../errors/AppError.js'
import { buildSchema } from '../utils/swagger.js'

/**
 * 薪资路由(HR-5 第 5 期,2026-11-12 立;2026-11-14 补配置读写)。
 *
 * 串联:薪资配置 → 月结考勤 → 薪资计算 → 工资单。
 * 权限:读 hr:payroll:view / 写 hr:payroll:manage(薪资比考勤更敏感,单独一档)。
 */

const HR_PAYROLL = 'hr:payroll:manage'
const HR_PAYROLL_VIEW = 'hr:payroll:view'

/** 金额:numeric(12,2),前端传 number,入库转字符串。 */
const moneySchema = z.number().min(0).max(99_999_999_999.99)
/** 费率:numeric(5,4),0~1 之间(0.105 = 10.5%)。 */
const rateSchema = z.number().min(0).max(1)
/** 社保/公积金基数上下限:numeric(12,2)。 */
const baseSchema = z.number().min(0).max(99_999_999_999.99)

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须是 YYYY-MM-DD')

const salaryConfigSchema = z
  .object({
    baseSalary: moneySchema,
    otBase: moneySchema.nullish(),
    insuranceBase: moneySchema.nullish(),
    housingFundRate: rateSchema.nullish(),
    fixedAllowance: moneySchema.optional(),
    effectiveFrom: dateSchema,
    effectiveTo: dateSchema.nullish(),
  })
  .refine((v) => !v.effectiveTo || v.effectiveTo >= v.effectiveFrom, {
    message: '生效结束日不能早于生效起始日',
    path: ['effectiveTo'],
  })

const taxProfileSchema = z.object({
  childrenCount: z.number().int().min(0).max(20).optional(),
  childrenDeductionRatio: z.number().min(0).max(1).optional(),
  infantCount: z.number().int().min(0).max(20).optional(),
  isOnlyChild: z.boolean().optional(),
  elderlySupportShare: moneySchema.nullish(),
  housingType: z.enum(['none', 'rent', 'loan']).optional(),
  housingRentAmount: moneySchema.nullish(),
  otherMonthlyDeduction: moneySchema.optional(),
})

const insuranceRateSchema = z.object({
  regionName: z.string().trim().min(1).max(100),
  effectiveYear: z.number().int().min(2000).max(2100),
  pensionEmployer: rateSchema.nullish(),
  pensionPersonal: rateSchema.nullish(),
  unemploymentEmployer: rateSchema.nullish(),
  unemploymentPersonal: rateSchema.nullish(),
  medicalEmployer: rateSchema.nullish(),
  medicalPersonal: rateSchema.nullish(),
  injuryEmployer: rateSchema.nullish(),
  housingFundRate: rateSchema.nullish(),
  insuranceBaseMin: baseSchema.nullish(),
  insuranceBaseMax: baseSchema.nullish(),
  fundBaseMin: baseSchema.nullish(),
  fundBaseMax: baseSchema.nullish(),
  enabled: z.boolean().optional(),
})

/** numeric 列写入前统一转字符串(undefined 保持不动,null 原样写空)。 */
function decimal(value: number | null | undefined): string | null | undefined {
  return value === undefined || value === null ? value : String(value)
}

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
  // 6. GET /api/hr-payroll/configs — 全员当前薪资配置(每人最新一条)+ 个税档案
  // ==========================================================================
  server.get(
    '/configs',
    {
      preHandler: requirePermission(HR_PAYROLL_VIEW),
      schema: buildSchema({
        tags: ['人事-薪资'],
        summary: '全员当前薪资配置与个税档案',
        description:
          '按员工取 effectiveFrom 最新的一条;个税档案按员工返回,未填报的员工不出现在映射里。',
      }),
    },
    async (_request, reply) => {
      const rows = await db
        .select()
        .from(hrSalaryConfig)
        .orderBy(desc(hrSalaryConfig.effectiveFrom))
      const latestByEmployee = new Map<string, (typeof rows)[number]>()
      for (const row of rows) {
        if (!latestByEmployee.has(row.employeeId)) latestByEmployee.set(row.employeeId, row)
      }
      const taxProfiles = await db.select().from(hrEmployeeTaxProfile)
      reply.send(success({ list: [...latestByEmployee.values()], taxProfiles }))
    },
  )

  // ==========================================================================
  // 7. GET /api/hr-payroll/config/:employeeId — 某员工薪资配置历史 + 个税档案
  // ==========================================================================
  server.get(
    '/config/:employeeId',
    {
      preHandler: requirePermission(HR_PAYROLL_VIEW),
      schema: buildSchema({
        tags: ['人事-薪资'],
        summary: '某员工薪资配置历史与个税档案',
        description: 'current = effectiveFrom 最新的一条;history 按生效日倒序。',
      }),
    },
    async (request, reply) => {
      const parsed = z
        .object({ employeeId: z.string().uuid('员工 ID 必须是 UUID') })
        .safeParse(request.params)
      if (!parsed.success) {
        reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      const employeeId = parsed.data.employeeId
      const [emp] = await db
        .select({ id: hrEmployee.id })
        .from(hrEmployee)
        .where(and(eq(hrEmployee.id, employeeId), isNull(hrEmployee.deletedAt)))
        .limit(1)
      if (!emp) {
        reply.status(404).send(error(404, '员工不存在', 'HR_EMPLOYEE_NOT_FOUND'))
        return
      }
      const history = await db
        .select()
        .from(hrSalaryConfig)
        .where(eq(hrSalaryConfig.employeeId, employeeId))
        .orderBy(desc(hrSalaryConfig.effectiveFrom))
      const [taxProfile] = await db
        .select()
        .from(hrEmployeeTaxProfile)
        .where(eq(hrEmployeeTaxProfile.employeeId, employeeId))
        .limit(1)
      reply.send(
        success({
          employeeId,
          current: history[0] ?? null,
          history,
          taxProfile: taxProfile ?? null,
        }),
      )
    },
  )

  // ==========================================================================
  // 8. PUT /api/hr-payroll/config/:employeeId — 写薪资配置(同生效日覆盖,否则新增版本)
  // ==========================================================================
  server.put(
    '/config/:employeeId',
    {
      preHandler: requirePermission(HR_PAYROLL),
      schema: buildSchema({
        tags: ['人事-薪资'],
        summary: '新增/修改员工薪资配置',
        description:
          '同员工同 effectiveFrom 已存在则原地更新,否则插入新版本(保留调薪历史)。' +
          '算薪按 effectiveFrom 取最近一条,故调薪只需新增一条新生效日的记录。',
      }),
    },
    async (request, reply) => {
      const parsedParams = z
        .object({ employeeId: z.string().uuid('员工 ID 必须是 UUID') })
        .safeParse(request.params)
      if (!parsedParams.success) {
        reply
          .status(400)
          .send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      const parsed = salaryConfigSchema.safeParse(request.body)
      if (!parsed.success) {
        reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      const employeeId = parsedParams.data.employeeId
      const [emp] = await db
        .select({ id: hrEmployee.id })
        .from(hrEmployee)
        .where(and(eq(hrEmployee.id, employeeId), isNull(hrEmployee.deletedAt)))
        .limit(1)
      if (!emp) {
        reply.status(404).send(error(404, '员工不存在', 'HR_EMPLOYEE_NOT_FOUND'))
        return
      }

      const data = parsed.data
      const editable = {
        baseSalary: String(data.baseSalary),
        otBase: decimal(data.otBase),
        insuranceBase: decimal(data.insuranceBase),
        housingFundRate: decimal(data.housingFundRate),
        fixedAllowance: decimal(data.fixedAllowance) ?? '0',
        effectiveTo: data.effectiveTo ?? null,
        updatedAt: new Date(),
      }
      const [existing] = await db
        .select({ id: hrSalaryConfig.id })
        .from(hrSalaryConfig)
        .where(
          and(
            eq(hrSalaryConfig.employeeId, employeeId),
            eq(hrSalaryConfig.effectiveFrom, data.effectiveFrom),
          ),
        )
        .limit(1)

      const createdBy = (request.user as { id?: string } | undefined)?.id ?? null
      const [config] = existing
        ? await db
            .update(hrSalaryConfig)
            .set(editable)
            .where(eq(hrSalaryConfig.id, existing.id))
            .returning()
        : await db
            .insert(hrSalaryConfig)
            .values({
              employeeId,
              ...editable,
              effectiveFrom: data.effectiveFrom,
              createdBy,
            })
            .returning()

      reply.send(success({ config, created: !existing }))
    },
  )

  // ==========================================================================
  // 9. PUT /api/hr-payroll/tax-profile/:employeeId — 写个税专项附加扣除(按员工唯一)
  // ==========================================================================
  server.put(
    '/tax-profile/:employeeId',
    {
      preHandler: requirePermission(HR_PAYROLL),
      schema: buildSchema({
        tags: ['人事-薪资'],
        summary: '新增/修改员工个税专项附加扣除',
        description: '每位员工一条;未传的字段保持原值(新建时取列默认值)。',
      }),
    },
    async (request, reply) => {
      const parsedParams = z
        .object({ employeeId: z.string().uuid('员工 ID 必须是 UUID') })
        .safeParse(request.params)
      if (!parsedParams.success) {
        reply
          .status(400)
          .send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      const parsed = taxProfileSchema.safeParse(request.body)
      if (!parsed.success) {
        reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      const employeeId = parsedParams.data.employeeId
      const [emp] = await db
        .select({ id: hrEmployee.id })
        .from(hrEmployee)
        .where(and(eq(hrEmployee.id, employeeId), isNull(hrEmployee.deletedAt)))
        .limit(1)
      if (!emp) {
        reply.status(404).send(error(404, '员工不存在', 'HR_EMPLOYEE_NOT_FOUND'))
        return
      }

      const data = parsed.data
      const editable: Partial<typeof hrEmployeeTaxProfile.$inferInsert> = { updatedAt: new Date() }
      if (data.childrenCount !== undefined) editable.childrenCount = data.childrenCount
      if (data.childrenDeductionRatio !== undefined) {
        editable.childrenDeductionRatio = String(data.childrenDeductionRatio)
      }
      if (data.infantCount !== undefined) editable.infantCount = data.infantCount
      if (data.isOnlyChild !== undefined) editable.isOnlyChild = data.isOnlyChild
      if (data.elderlySupportShare !== undefined) {
        editable.elderlySupportShare = decimal(data.elderlySupportShare)
      }
      if (data.housingType !== undefined) editable.housingType = data.housingType
      if (data.housingRentAmount !== undefined) {
        editable.housingRentAmount = decimal(data.housingRentAmount)
      }
      if (data.otherMonthlyDeduction !== undefined) {
        editable.otherMonthlyDeduction = String(data.otherMonthlyDeduction)
      }

      const [taxProfile] = await db
        .insert(hrEmployeeTaxProfile)
        .values({ employeeId, ...editable })
        .onConflictDoUpdate({
          target: hrEmployeeTaxProfile.employeeId,
          set: editable,
        })
        .returning()
      reply.send(success(taxProfile))
    },
  )

  // ==========================================================================
  // 10. GET /api/hr-payroll/insurance-rates — 社保/公积金费率配置列表
  // ==========================================================================
  server.get(
    '/insurance-rates',
    {
      preHandler: requirePermission(HR_PAYROLL_VIEW),
      schema: buildSchema({
        tags: ['人事-薪资'],
        summary: '社保/公积金费率配置列表',
        description: '可按年度/地区筛选;默认包含停用记录(enabledOnly=1 只看启用)。',
      }),
    },
    async (request, reply) => {
      const q = request.query as { year?: string; regionName?: string; enabledOnly?: string }
      const filters: SQL[] = []
      if (q.year) {
        const year = Number(q.year)
        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
          reply.status(400).send(error(400, 'year 必须是 2000~2100 的整数', 'VALIDATION_FAILED'))
          return
        }
        filters.push(eq(hrInsuranceRateConfig.effectiveYear, year))
      }
      if (q.regionName) filters.push(eq(hrInsuranceRateConfig.regionName, q.regionName))
      if (q.enabledOnly === '1') filters.push(eq(hrInsuranceRateConfig.enabled, true))
      const rows = await db
        .select()
        .from(hrInsuranceRateConfig)
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(desc(hrInsuranceRateConfig.effectiveYear), hrInsuranceRateConfig.regionName)
        .limit(500)
      reply.send(success({ list: rows }))
    },
  )

  // ==========================================================================
  // 11. PUT /api/hr-payroll/insurance-rates — 按(地区,年度)新增/更新费率
  // ==========================================================================
  server.put(
    '/insurance-rates',
    {
      preHandler: requirePermission(HR_PAYROLL),
      schema: buildSchema({
        tags: ['人事-薪资'],
        summary: '新增/更新地区社保公积金费率',
        description: '唯一键 = (regionName, effectiveYear);已存在则更新。费率均为 0~1 小数。',
      }),
    },
    async (request, reply) => {
      const parsed = insuranceRateSchema.safeParse(request.body)
      if (!parsed.success) {
        reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      const data = parsed.data
      if (
        data.insuranceBaseMin != null &&
        data.insuranceBaseMax != null &&
        data.insuranceBaseMax < data.insuranceBaseMin
      ) {
        reply
          .status(400)
          .send(error(400, '社保基数上限不能小于下限', 'VALIDATION_FAILED'))
        return
      }
      if (
        data.fundBaseMin != null &&
        data.fundBaseMax != null &&
        data.fundBaseMax < data.fundBaseMin
      ) {
        reply
          .status(400)
          .send(error(400, '公积金基数上限不能小于下限', 'VALIDATION_FAILED'))
        return
      }

      const editable = {
        pensionEmployer: decimal(data.pensionEmployer),
        pensionPersonal: decimal(data.pensionPersonal),
        unemploymentEmployer: decimal(data.unemploymentEmployer),
        unemploymentPersonal: decimal(data.unemploymentPersonal),
        medicalEmployer: decimal(data.medicalEmployer),
        medicalPersonal: decimal(data.medicalPersonal),
        injuryEmployer: decimal(data.injuryEmployer),
        housingFundRate: decimal(data.housingFundRate),
        insuranceBaseMin: decimal(data.insuranceBaseMin),
        insuranceBaseMax: decimal(data.insuranceBaseMax),
        fundBaseMin: decimal(data.fundBaseMin),
        fundBaseMax: decimal(data.fundBaseMax),
        enabled: data.enabled ?? true,
        updatedAt: new Date(),
      }
      const [row] = await db
        .insert(hrInsuranceRateConfig)
        .values({
          regionName: data.regionName,
          effectiveYear: data.effectiveYear,
          ...editable,
        })
        .onConflictDoUpdate({
          target: [hrInsuranceRateConfig.regionName, hrInsuranceRateConfig.effectiveYear],
          set: editable,
        })
        .returning()
      reply.send(success(row))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
