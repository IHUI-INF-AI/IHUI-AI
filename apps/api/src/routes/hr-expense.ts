// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 费用报销路由(2026-11-24 四波)。前缀 /api/hr-expense。
 *
 * 权限形态逐字照抄 hr-payout 先例:
 *   · 自助面(requireSelf + 服务端解析本人 hrEmployee,归属不信客户端自报):
 *       POST /my/submit(员工本人提单)、GET /my(只看本人单)
 *   · 管理面(finance:ledger:view|manage):
 *       列表/详情、decide(服务层认当前步审批人)、pay/link-voucher/void
 * 路由只做参数校验,状态推进与授权判定全在服务层(§0.6 判据单源)。
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { requirePermission, requireSelf } from '../plugins/require-permission.js'
import { error, success } from '../utils/response.js'
import { AppError } from '../errors/AppError.js'
import { db } from '../db/index.js'
import { EXPENSE_CATEGORIES, hrEmployee } from '@ihui/database'
import {
  decideClaim,
  getClaim,
  linkVoucher,
  listClaims,
  payClaim,
  submitClaim,
  voidClaim,
} from '../services/hr-expense.js'
import {
  expenseApproverNames,
  loadExpenseApproverRoster,
} from '../services/hr-expense-approvers.js'

const FIN_VIEW = 'finance:ledger:view'
const FIN_MANAGE = 'finance:ledger:manage'

function userIdOf(request: { user?: unknown; jwtPayload?: unknown }): string | null {
  const u = request.user as { id?: string } | undefined
  const p = request.jwtPayload as { userId?: string } | undefined
  return u?.id ?? p?.userId ?? null
}

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

const money = z.union([z.string(), z.number()])
const voucherList = z
  .array(
    z.object({
      fileId: z.string().min(1).max(64),
      name: z.string().min(1).max(255),
      url: z.string().min(1).max(1000),
      sha256: z
        .string()
        .regex(/^[a-f0-9]{64}$/i)
        .optional(),
    }),
  )
  .min(1)
  .max(20)
const approverChainSchema = z.array(z.string().uuid()).min(1).max(8)
const submitCore = {
  ledgerId: z.string().uuid().nullable().optional(),
  category: z.enum(EXPENSE_CATEGORIES),
  title: z.string().min(1).max(200),
  amount: money,
  vouchers: voucherList,
  approverChain: approverChainSchema,
  note: z.string().max(500).nullable().optional(),
}
/**
 * 自助提单 schema(2026-11-24 十一波):审批链可省略 —— 员工不该知道同事 UUID,
 * 缺省时由服务层按财务权限池解析(单一真相源 hr-expense-approvers)。
 * 管理面 submitCore 保持必填(财务代提时审批链是显式决定的)。
 */
const submitSelf = { ...submitCore, approverChain: approverChainSchema.optional() }

async function selfEmployee(userId: string) {
  const [emp] = await db
    .select({ id: hrEmployee.id })
    .from(hrEmployee)
    .where(eq(hrEmployee.userId, userId))
    .limit(1)
  if (!emp) throw new AppError('未关联员工档案,无法使用报销自助面', 403, 'EXPENSE_NO_EMPLOYEE')
  return emp
}

export const hrExpenseRoutes: FastifyPluginAsync = async (server) => {
  // ---------- 员工自助面 ----------
  server.post('/my/submit', { preHandler: requireSelf }, async (request, reply) => {
    const parsed = z.object(submitSelf).safeParse(request.body)
    if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
    const userId = userIdOf(request)
    if (!userId) return reply.status(401).send(error(401, '未登录', 'UNAUTHORIZED'))
    await guard(reply, async () => {
      const emp = await selfEmployee(userId)
      return submitClaim(
        { ...parsed.data, amount: String(parsed.data.amount), employeeId: emp.id },
        userId,
      )
    })
  })

  server.get('/my/approvers', { preHandler: requireSelf }, async (request, reply) => {
    const userId = userIdOf(request)
    if (!userId) return reply.status(401).send(error(401, '未登录', 'UNAUTHORIZED'))
    await guard(reply, async () => {
      // 先确认本人有员工档案(与 /my 同口径),再回候选池
      await selfEmployee(userId)
      return loadExpenseApproverRoster(userId)
    })
  })

  server.get('/my', { preHandler: requireSelf }, async (request, reply) => {
    const userId = userIdOf(request)
    if (!userId) return reply.status(401).send(error(401, '未登录', 'UNAUTHORIZED'))
    await guard(reply, async () => {
      const emp = await selfEmployee(userId)
      const q = request.query as { status?: string }
      const rows = await listClaims({ employeeId: emp.id, status: q.status })
      // 本人单据的当前审批人姓名(员工看不懂 uuid;查不到时前端回退短 id)
      const currentIds = rows
        .map((r) => r.approverChain[r.currentStep] ?? '')
        .filter((id): id is string => Boolean(id))
      const names = await expenseApproverNames(currentIds)
      return {
        list: rows.map((r) => ({
          ...r,
          currentApproverName: names[r.approverChain[r.currentStep] ?? ''] ?? null,
        })),
        total: rows.length,
      }
    })
  })

  // ---------- 管理面 ----------
  server.post('/', { preHandler: requirePermission(FIN_MANAGE) }, async (request, reply) => {
    const parsed = z
      .object({ ...submitCore, employeeId: z.string().uuid() })
      .safeParse(request.body)
    if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
    await guard(reply, () =>
      submitClaim({ ...parsed.data, amount: String(parsed.data.amount) }, userIdOf(request)),
    )
  })

  server.get('/', { preHandler: requirePermission(FIN_VIEW) }, async (request, reply) => {
    const q = request.query as { employeeId?: string; status?: string; ledgerId?: string }
    await guard(reply, async () => {
      const rows = await listClaims(q)
      return { list: rows, total: rows.length }
    })
  })

  server.get('/:id', { preHandler: requirePermission(FIN_VIEW) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await guard(reply, () => getClaim(id))
  })

  server.post(
    '/:id/decide',
    { preHandler: requirePermission(FIN_VIEW) },
    async (request, reply) => {
      const parsed = z
        .object({ action: z.enum(['approve', 'reject']), comment: z.string().max(500).optional() })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, async () => {
        const actor = userIdOf(request)
        if (!actor) throw new AppError('未登录', 401, 'UNAUTHORIZED')
        return decideClaim(id, actor, parsed.data.action, parsed.data.comment)
      })
    },
  )

  server.post('/:id/pay', { preHandler: requirePermission(FIN_MANAGE) }, async (request, reply) => {
    const parsed = z.object({ method: z.enum(['bank', 'cash']) }).safeParse(request.body)
    if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
    const { id } = request.params as { id: string }
    await guard(reply, () => payClaim(id, parsed.data.method, userIdOf(request)))
  })

  server.post(
    '/:id/link-voucher',
    { preHandler: requirePermission(FIN_MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          expenseAccountCode: z
            .string()
            .regex(/^\d{4,8}$/)
            .default('5502'),
        })
        .safeParse(request.body ?? {})
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => linkVoucher(id, parsed.data.expenseAccountCode, userIdOf(request)))
    },
  )

  server.post(
    '/:id/void',
    { preHandler: requirePermission(FIN_MANAGE) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => voidClaim(id, userIdOf(request)))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
