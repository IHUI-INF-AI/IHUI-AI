// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 人事生命周期路由(前缀 /api/hr-lifecycle)。
 *
 * 权限三档:
 *   · hr:employee:manage —— 合同签发/终止/续签、转正评估、离职批准与办结
 *   · hr:employee:view   —— 合同/转正/离职列表与人事看板
 *   · hr:recruit:manage  —— 招聘岗位、候选人、面试、录用入职
 *
 * 路由纪律:只做参数校验 + 权限 + 调服务;任何状态字段的写入都在服务层动作里,
 * 避免"路由直接 PATCH status"把状态机绕过。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

import { AppError } from '../errors/AppError.js'
import { requirePermission } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import {
  advanceCandidate,
  applyResignation,
  approveResignation,
  cancelResignation,
  contractSummary,
  createCandidate,
  createContract,
  createOpening,
  hireCandidate,
  lifecycleOverview,
  listCandidates,
  listContracts,
  listInterviews,
  listOpenings,
  listProbationReviews,
  listResignations,
  probationDueList,
  recruitmentSummary,
  renewContract,
  resignationCertificate,
  scheduleInterview,
  setOpeningStatus,
  settleResignation,
  submitInterviewFeedback,
  submitProbationReview,
  transitContract,
} from '../services/hr-lifecycle.js'

const MANAGE = 'hr:employee:manage'
const VIEW = 'hr:employee:view'
const RECRUIT = 'hr:recruit:manage'

function userIdOf(request: { user?: unknown; jwtPayload?: unknown }): string | null {
  const u = request.user as { id?: string } | undefined
  const p = request.jwtPayload as { userId?: string } | undefined
  return u?.id ?? p?.userId ?? null
}

type ReplyLike = {
  status: (n: number) => { send: (b: unknown) => void }
  send: (b: unknown) => void
}

async function guard<T>(reply: ReplyLike, fn: () => Promise<T>) {
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

function fail(reply: ReplyLike, message: string, code = 'VALIDATION_FAILED') {
  reply.status(400).send(error(400, message, code))
}

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期必须是 YYYY-MM-DD')

export const hrLifecycleRoutes: FastifyPluginAsync = async (server) => {
  /* ---------------- 合同 ---------------- */

  server.post('/contracts', { preHandler: requirePermission(MANAGE) }, async (request, reply) => {
    const parsed = z
      .object({
        employeeId: z.string().uuid(),
        contractNo: z.string().max(60).nullish(),
        contractType: z.enum(['fixed', 'indefinite', 'internship', 'parttime', 'labor']).optional(),
        startDate: DATE,
        endDate: DATE.nullish(),
        probationMonths: z.number().int().min(0).max(6).optional(),
        probationSalaryRate: z.string().nullish(),
        fileUrl: z.string().max(500).nullish(),
        remark: z.string().max(2000).nullish(),
      })
      .safeParse(request.body)
    if (!parsed.success) return fail(reply, parsed.error.issues[0]?.message ?? '参数错误')
    await guard(reply, () => createContract({ ...parsed.data, createdBy: userIdOf(request) }))
  })

  server.get('/contracts', { preHandler: requirePermission(VIEW) }, async (request, reply) => {
    const q = request.query as Record<string, string | undefined>
    const days = q.expiringWithinDays ? Number(q.expiringWithinDays) : undefined
    if (days !== undefined && (!Number.isInteger(days) || days < 0 || days > 365)) {
      return fail(reply, 'expiringWithinDays 应在 0~365')
    }
    await guard(reply, () =>
      listContracts({ employeeId: q.employeeId, status: q.status, expiringWithinDays: days }),
    )
  })

  server.get(
    '/contracts/summary',
    { preHandler: requirePermission(VIEW) },
    async (_request, reply) => {
      await guard(reply, () => contractSummary())
    },
  )

  server.get(
    '/contracts/expiring',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { days?: string }
      const days = q.days ? Number(q.days) : 30
      if (!Number.isInteger(days) || days < 0 || days > 365) return fail(reply, 'days 应在 0~365')
      await guard(reply, async () => {
        const rows = await listContracts({ expiringWithinDays: days })
        const hit = rows.filter((r) => r.expiryState === 'expiring' || r.expiryState === 'expired')
        return { days, count: hit.length, rows: hit }
      })
    },
  )

  server.post(
    '/contracts/:id/sign',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => transitContract(id, 'signed'))
    },
  )

  server.post(
    '/contracts/:id/terminate',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z.object({ reason: z.string().min(2).max(2000) }).safeParse(request.body)
      if (!parsed.success) return fail(reply, '解除原因至少 2 个字')
      const { id } = request.params as { id: string }
      await guard(reply, () =>
        transitContract(id, 'terminated', { terminateReason: parsed.data.reason }),
      )
    },
  )

  server.post(
    '/contracts/:id/expire',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => transitContract(id, 'expired'))
    },
  )

  server.post(
    '/contracts/:id/renew',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          startDate: DATE,
          endDate: DATE.nullish(),
          probationMonths: z.number().int().min(0).max(6).optional(),
          fileUrl: z.string().max(500).nullish(),
        })
        .safeParse(request.body)
      if (!parsed.success) return fail(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => renewContract(id, parsed.data))
    },
  )

  /* ---------------- 试用期转正 ---------------- */

  server.post(
    '/probation/reviews',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          employeeId: z.string().uuid(),
          contractId: z.string().uuid().nullish(),
          result: z.enum(['pass', 'extend', 'fail']),
          score: z.number().int().min(0).max(100).nullish(),
          selfSummary: z.string().max(3000).nullish(),
          managerComment: z.string().max(3000).nullish(),
          extendedUntil: DATE.nullish(),
        })
        .safeParse(request.body)
      if (!parsed.success) return fail(reply, parsed.error.issues[0]?.message ?? '参数错误')
      await guard(reply, () =>
        submitProbationReview({ ...parsed.data, decidedBy: userIdOf(request) }),
      )
    },
  )

  server.get(
    '/probation/reviews',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { employeeId?: string }
      await guard(reply, () => listProbationReviews(q.employeeId))
    },
  )

  server.get('/probation/due', { preHandler: requirePermission(VIEW) }, async (request, reply) => {
    const q = request.query as { asOf?: string }
    if (q.asOf && !/^\d{4}-\d{2}-\d{2}$/.test(q.asOf)) return fail(reply, 'asOf 必须是 YYYY-MM-DD')
    await guard(reply, () => probationDueList(q.asOf))
  })

  /* ---------------- 离职 ---------------- */

  server.post(
    '/resignations',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          employeeId: z.string().uuid(),
          applyDate: DATE.optional(),
          lastWorkDate: DATE,
          reasonType: z
            .enum(['voluntary', 'contract_end', 'dismissal', 'mutual', 'retire', 'other'])
            .optional(),
          reason: z.string().max(3000).nullish(),
          handoverTo: z.string().uuid().nullish(),
          handoverNote: z.string().max(3000).nullish(),
          lastSalaryPeriod: z
            .string()
            .regex(/^\d{4}-\d{2}$/)
            .nullish(),
        })
        .safeParse(request.body)
      if (!parsed.success) return fail(reply, parsed.error.issues[0]?.message ?? '参数错误')
      await guard(reply, () => applyResignation(parsed.data))
    },
  )

  server.get('/resignations', { preHandler: requirePermission(VIEW) }, async (request, reply) => {
    const q = request.query as { employeeId?: string; status?: string }
    await guard(reply, () => listResignations(q))
  })

  server.post(
    '/resignations/:id/approve',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => approveResignation(id, userIdOf(request)))
    },
  )

  server.post(
    '/resignations/:id/cancel',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => cancelResignation(id))
    },
  )

  server.post(
    '/resignations/:id/settle',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({ checklist: z.record(z.string().min(1), z.boolean()) })
        .safeParse(request.body)
      if (!parsed.success) return fail(reply, '交接清单格式应为 {条目: true|false}')
      const { id } = request.params as { id: string }
      await guard(reply, () => settleResignation(id, parsed.data.checklist))
    },
  )

  server.get(
    '/resignations/:id/certificate',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => resignationCertificate(id))
    },
  )

  /* ---------------- 招聘 ---------------- */

  server.post('/openings', { preHandler: requirePermission(RECRUIT) }, async (request, reply) => {
    const parsed = z
      .object({
        code: z.string().max(60).nullish(),
        title: z.string().min(2).max(100),
        departmentId: z.string().uuid(),
        headCount: z.number().int().min(1).max(999).optional(),
        employmentType: z.enum(['fulltime', 'parttime', 'intern']).optional(),
        salaryMin: z.number().int().nonnegative().nullish(),
        salaryMax: z.number().int().nonnegative().nullish(),
        requirements: z.string().max(5000).nullish(),
        status: z.enum(['draft', 'open']).optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) return fail(reply, parsed.error.issues[0]?.message ?? '参数错误')
    await guard(reply, () => createOpening({ ...parsed.data, createdBy: userIdOf(request) }))
  })

  server.get('/openings', { preHandler: requirePermission(RECRUIT) }, async (request, reply) => {
    const q = request.query as { status?: string; departmentId?: string }
    await guard(reply, () => listOpenings(q))
  })

  server.post(
    '/openings/:id/status',
    { preHandler: requirePermission(RECRUIT) },
    async (request, reply) => {
      const parsed = z
        .object({ status: z.enum(['draft', 'open', 'paused', 'closed']) })
        .safeParse(request.body)
      if (!parsed.success) return fail(reply, '状态只能是 draft/open/paused/closed')
      const { id } = request.params as { id: string }
      await guard(reply, () => setOpeningStatus(id, parsed.data.status))
    },
  )

  server.post('/candidates', { preHandler: requirePermission(RECRUIT) }, async (request, reply) => {
    const parsed = z
      .object({
        openingId: z.string().uuid(),
        name: z.string().min(1).max(100),
        phone: z.string().max(30).nullish(),
        email: z.string().max(120).nullish(),
        resumeUrl: z.string().max(500).nullish(),
        source: z.enum(['boss', 'liepin', 'referral', 'campus', 'other']).optional(),
        expectedSalary: z.number().int().nonnegative().nullish(),
        remark: z.string().max(3000).nullish(),
      })
      .safeParse(request.body)
    if (!parsed.success) return fail(reply, parsed.error.issues[0]?.message ?? '参数错误')
    await guard(reply, () => createCandidate(parsed.data))
  })

  server.get('/candidates', { preHandler: requirePermission(RECRUIT) }, async (request, reply) => {
    const q = request.query as { openingId?: string; stage?: string }
    await guard(reply, () => listCandidates(q))
  })

  server.post(
    '/candidates/:id/advance',
    { preHandler: requirePermission(RECRUIT) },
    async (request, reply) => {
      const parsed = z
        .object({
          stage: z.enum(['screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn']),
          rejectReason: z.string().max(3000).nullish(),
        })
        .safeParse(request.body)
      if (!parsed.success) return fail(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      // hired 的准入判据在服务层 advanceCandidate 内(单一真相源),此处不再重复
      await guard(reply, () =>
        advanceCandidate(id, parsed.data.stage, { rejectReason: parsed.data.rejectReason }),
      )
    },
  )

  server.post(
    '/candidates/:id/interviews',
    { preHandler: requirePermission(RECRUIT) },
    async (request, reply) => {
      const parsed = z
        .object({
          round: z.number().int().min(1).max(20).optional(),
          scheduledAt: z.string().min(10),
          mode: z.enum(['onsite', 'phone', 'video']).optional(),
          interviewerName: z.string().max(100).nullish(),
          interviewerId: z.string().uuid().nullish(),
        })
        .safeParse(request.body)
      if (!parsed.success) return fail(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => scheduleInterview(id, parsed.data))
    },
  )

  server.get('/interviews', { preHandler: requirePermission(RECRUIT) }, async (request, reply) => {
    const q = request.query as { candidateId?: string; pending?: string }
    await guard(reply, () =>
      listInterviews({ candidateId: q.candidateId, pending: q.pending === '1' }),
    )
  })

  server.post(
    '/interviews/:id/feedback',
    { preHandler: requirePermission(RECRUIT) },
    async (request, reply) => {
      const parsed = z
        .object({
          result: z.enum(['pass', 'fail', 'pending']),
          score: z.number().int().min(0).max(100).nullish(),
          feedback: z.string().max(3000).nullish(),
        })
        .safeParse(request.body)
      if (!parsed.success) return fail(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => submitInterviewFeedback(id, parsed.data))
    },
  )

  server.post(
    '/candidates/:id/hire',
    { preHandler: requirePermission(RECRUIT) },
    async (request, reply) => {
      const parsed = z
        .object({
          employeeNo: z.string().min(2).max(50),
          departmentId: z.string().uuid(),
          position: z.string().max(100).nullish(),
          hireDate: DATE.optional(),
          phone: z.string().max(30).nullish(),
          idNumber: z.string().max(30).nullish(),
          contractStartDate: DATE.optional(),
          contractEndDate: DATE.nullish(),
          contractType: z
            .enum(['fixed', 'indefinite', 'internship', 'parttime', 'labor'])
            .optional(),
          probationMonths: z.number().int().min(0).max(6).optional(),
          probationSalaryRate: z.string().nullish(),
        })
        .safeParse(request.body)
      if (!parsed.success) return fail(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => hireCandidate(id, parsed.data))
    },
  )

  server.get(
    '/recruitment/summary',
    { preHandler: requirePermission(RECRUIT) },
    async (_request, reply) => {
      await guard(reply, () => recruitmentSummary())
    },
  )

  /* ---------------- 总览 ---------------- */

  server.get('/overview', { preHandler: requirePermission(VIEW) }, async (_request, reply) => {
    await guard(reply, () => lifecycleOverview())
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
