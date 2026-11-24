// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 财务 · 税务(2026-11-23 拆自 fin-accounting.ts):税种核定 / 申报日历 / 申报任务。
 *
 * 一个税种一张核定档(同税种新建自动停用旧档),一张核定档扇出一串申报任务;
 * 任务推进只认状态机(pending → computed → drafted → submitted → accepted),
 * accepted 是终态,再改需要新建下一期任务。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

import { requirePermission } from '../plugins/require-permission.js'
import {
  bindLedger,
  deactivateTaxProfile,
  ensureAllClientsCalendar,
  ensureFilingCalendar,
  filingDeadlines,
  filingSummary,
  listFilingTasks,
  listTaxProfiles,
  updateFilingTask,
  updateTaxProfile,
  upsertTaxProfile,
} from '../services/fin-accounting/tax-service.js'
import {
  MANAGE,
  PERIOD,
  VIEW,
  badRequest,
  guard,
  money,
  userIdOf,
} from './fin-accounting-shared.js'
import {
  generateReturn,
  getReturn,
  listReturns,
  patchReturn,
  returnsSummary,
  reviewReturn,
  submitReturn,
  taskApprovalProgress,
} from '../services/fin-accounting/filing-return-service.js'
import { deriveFilingTask } from '../services/fin-accounting/filing-derive-service.js'

export const finTaxRoutes: FastifyPluginAsync = async (server) => {
  // ============================ 税种核定 ============================
  const taxProfileBody = z.object({
    taxType: z.enum([
      'VAT',
      'CIT',
      'IIT',
      'SURTAX',
      'STAMP',
      'CONSUMPTION',
      'PROPERTY',
      'LAND_USE',
      'VEHICLE_VESSEL',
      'CULTURE',
      'OTHER',
    ]),
    taxpayerType: z.enum(['general', 'small']).optional(),
    collectionMethod: z.enum(['audit', 'deemed']).optional(),
    filingCycle: z.enum(['monthly', 'quarterly', 'annual']).optional(),
    dueMonthOffset: z.number().int().min(1).max(6).optional(),
    dueDay: z.number().int().min(1).max(31).optional(),
    rate: money.optional(),
    deemedRate: money.nullable().optional(),
    effectiveFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    effectiveTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    remark: z.string().max(2000).optional(),
  })

  server.post(
    '/clients/:id/tax-profiles',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = taxProfileBody.safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => upsertTaxProfile(id, parsed.data))
    },
  )

  server.get(
    '/clients/:id/tax-profiles',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => listTaxProfiles(id))
    },
  )

  server.patch(
    '/tax-profiles/:id',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          filingCycle: z.enum(['monthly', 'quarterly', 'annual']).optional(),
          dueMonthOffset: z.number().int().min(1).max(6).optional(),
          dueDay: z.number().int().min(1).max(31).optional(),
          rate: money.optional(),
          deemedRate: money.nullable().optional(),
          remark: z.string().max(2000).optional(),
          status: z.enum(['active', 'inactive']).optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => updateTaxProfile(id, parsed.data))
    },
  )

  server.post(
    '/tax-profiles/:id/deactivate',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => deactivateTaxProfile(id))
    },
  )

  // ============================ 申报日历 ============================
  const calendarBody = z.object({
    fromMonth: PERIOD,
    toMonth: PERIOD,
    ledgerId: z.string().uuid().optional(),
  })

  server.post(
    '/clients/:id/filing-calendar',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = calendarBody.safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () =>
        ensureFilingCalendar(
          id,
          { fromMonth: parsed.data.fromMonth, toMonth: parsed.data.toMonth },
          {
            ledgerId: parsed.data.ledgerId,
          },
        ),
      )
    },
  )

  server.post(
    '/filing-calendar/backfill',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = calendarBody.omit({ ledgerId: true }).safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      await guard(reply, () => ensureAllClientsCalendar(parsed.data))
    },
  )

  server.post(
    '/clients/:id/bind-ledger',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z.object({ ledgerId: z.string().uuid() }).safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => bindLedger(id, parsed.data.ledgerId))
    },
  )

  server.get('/filing-tasks', { preHandler: requirePermission(VIEW) }, async (request, reply) => {
    const q = request.query as {
      clientId?: string
      status?: string
      dueFrom?: string
      dueTo?: string
      includeCompleted?: string
      page?: string
      limit?: string
    }
    await guard(reply, () =>
      listFilingTasks({
        clientId: q.clientId,
        status: q.status,
        dueFrom: q.dueFrom,
        dueTo: q.dueTo,
        includeCompleted: q.includeCompleted === 'true',
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
      }),
    )
  })

  server.patch(
    '/filing-tasks/:id',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          status: z
            .enum(['pending', 'computed', 'drafted', 'submitted', 'accepted', 'failed'])
            .optional(),
          taxableBase: money.nullable().optional(),
          taxAmount: money.nullable().optional(),
          paidAmount: money.nullable().optional(),
          draftRef: z.string().max(500).nullable().optional(),
          dueDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          assignee: z.string().uuid().nullable().optional(),
          note: z.string().max(2000).nullable().optional(),
          receiptNo: z.string().max(100).nullable().optional(),
          receiptPayload: z.record(z.string(), z.unknown()).nullable().optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => updateFilingTask(id, parsed.data))
    },
  )

  // 申报取数:账套 + 发票台账 → 任务的计税依据/应纳税额(幂等,每次按当前数据重算)
  server.post(
    '/filing-tasks/:id/derive',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => deriveFilingTask(id, userIdOf(request)))
    },
  )

  server.get(
    '/filing/deadlines',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { clientId?: string; today?: string; upcomingDays?: string }
      await guard(reply, () =>
        filingDeadlines({
          clientId: q.clientId,
          today: q.today,
          upcomingDays: q.upcomingDays ? Number(q.upcomingDays) : undefined,
        }),
      )
    },
  )

  server.get('/filing/summary', { preHandler: requirePermission(VIEW) }, async (request, reply) => {
    const q = request.query as { clientId?: string; today?: string }
    await guard(reply, () => filingSummary({ clientId: q.clientId, today: q.today }))
  })

  // ==================== 申报表级复核(2026-11-23 立) ====================
  // 表级:一次申报可拆多张表(主表/附表),每张单独走「编→提审→批/驳」。
  const returnPatchBody = z.object({
    payload: z.record(z.string(), z.unknown()).optional(),
    taxableBase: money.nullable().optional(),
    taxAmount: money.nullable().optional(),
    formName: z.string().min(1).max(100).optional(),
  })

  server.get('/filing/returns', { preHandler: requirePermission(VIEW) }, async (request, reply) => {
    const q = request.query as {
      clientId?: string
      taskId?: string
      period?: string
      status?: string
      limit?: string
      offset?: string
    }
    await guard(reply, () =>
      listReturns({
        clientId: q.clientId,
        taskId: q.taskId,
        period: q.period,
        status: q.status,
        limit: q.limit ? Number(q.limit) : undefined,
        offset: q.offset ? Number(q.offset) : undefined,
      }),
    )
  })

  server.get(
    '/filing/returns/summary',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { clientId?: string; period?: string; taskId?: string }
      if (q.taskId) {
        await guard(reply, () => taskApprovalProgress(q.taskId as string))
        return
      }
      await guard(reply, () => returnsSummary({ clientId: q.clientId, period: q.period }))
    },
  )

  server.post(
    '/filing/returns/generate',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          taskId: z.string().uuid(),
          formCode: z.string().min(1).max(40).optional(),
          formName: z.string().min(1).max(100).optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const userId = userIdOf(request) ?? undefined
      await guard(reply, () =>
        generateReturn({
          taskId: parsed.data.taskId,
          formCode: parsed.data.formCode,
          formName: parsed.data.formName,
          userId,
        }),
      )
    },
  )

  server.get(
    '/filing/returns/:id',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => getReturn(id))
    },
  )

  server.patch(
    '/filing/returns/:id',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = returnPatchBody.safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () =>
        patchReturn({
          id,
          payload: parsed.data.payload,
          taxableBase: parsed.data.taxableBase as string | null | undefined,
          taxAmount: parsed.data.taxAmount as string | null | undefined,
          formName: parsed.data.formName,
        }),
      )
    },
  )

  server.post(
    '/filing/returns/:id/submit',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const userId = userIdOf(request) ?? undefined
      await guard(reply, () => submitReturn({ id, userId }))
    },
  )

  server.post(
    '/filing/returns/:id/review',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({ approve: z.boolean(), remark: z.string().max(500).optional() })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      const userId = userIdOf(request) ?? undefined
      await guard(reply, () =>
        reviewReturn({ id, approve: parsed.data.approve, remark: parsed.data.remark, userId }),
      )
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
