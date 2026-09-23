// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 提现模块 /finance/withdrawal/*(7 个端点)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { WithdrawalFlow } from '@ihui/database'
import { success, error } from '../../utils/response.js'
import {
  applyWithdrawal,
  listWithdrawals,
  getWithdrawalById,
  approveWithdrawal,
  rejectWithdrawal,
  withdrawalSummary,
  availableWithdrawal,
} from '../../db/commission-queries.js'
import { parsePagination, parseIdParam } from './_shared.js'
import { requireAdmin } from '../../plugins/require-permission.js'

const withdrawalApplySchema = z.object({
  amount: z.coerce.number().int().positive(),
  method: z.string().min(1),
  accountInfo: z.record(z.string(), z.unknown()).optional(),
})

/**
 * 提现结果邮件通知(fire-and-forget,失败不阻塞审批主流程)。
 * approved 品牌绿(打款处理中),rejected 信号红(驳回 + 原因 + 余额退回)。
 */
function notifyWithdrawalResult(flow: WithdrawalFlow, status: 'approved' | 'rejected'): void {
  if (!flow.userId) return
  const targetUserId = flow.userId
  void (async () => {
    const [{ findUserById }, { sendEmail }, { renderWithdrawalResultEmail, resolveWebOrigin }] =
      await Promise.all([
        import('../../db/queries.js'),
        import('../../services/email-service.js'),
        import('../../services/email-templates.js'),
      ])
    const user = await findUserById(targetUserId)
    if (!user?.email) return
    const mail = renderWithdrawalResultEmail({
      userName: user.nickname ?? undefined,
      amountYuan: (flow.amount / 100).toFixed(2),
      feeYuan: (flow.fee / 100).toFixed(2),
      method: flow.method,
      status,
      rejectReason: flow.rejectReason ?? undefined,
      processedAt: (flow.processedAt ?? new Date()).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour12: false,
      }),
      withdrawUrl: `${resolveWebOrigin()}/wallet/withdraw/records`,
    })
    await sendEmail({
      to: user.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      scene: 'notification',
      userId: targetUserId,
    })
  })().catch(() => {})
}

const withdrawalRoutes: FastifyPluginAsync = async (server) => {
  server.post(
    '/finance/withdrawal/withdrawal',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = withdrawalApplySchema.safeParse(request.body)
      if (!parsed.success) return reply.status(400).send(error(400, '参数错误'))
      const available = await availableWithdrawal(request.userId!)
      if (available < parsed.data.amount) {
        return reply.status(400).send(error(400, '可提现余额不足'))
      }
      const flow = await applyWithdrawal(
        {
          userId: request.userId!,
          amount: parsed.data.amount,
          method: parsed.data.method,
          accountInfo: parsed.data.accountInfo ?? {},
        },
        request.userId ?? null,
      )
      return reply.status(201).send(success({ success: true, flow }))
    },
  )

  server.get('/finance/withdrawal/getWithdrawal', async (request, reply) => {
    const userId = request.userId!
    const [summary, available] = await Promise.all([
      withdrawalSummary(userId),
      availableWithdrawal(userId),
    ])
    return reply.send(success({ withdrawal: { ...summary, available } }))
  })

  server.get('/finance/withdrawal/my-records', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await listWithdrawals(request.userId!, q.page, q.pageSize)
    return reply.send(
      success({ list: result.items, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/finance/withdrawal/flows/list', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await listWithdrawals(request.userId!, q.page, q.pageSize)
    return reply.send(
      success({ list: result.items, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/finance/withdrawal/flows/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const flow = await getWithdrawalById(id)
    if (!flow) return reply.status(404).send(error(404, '记录不存在'))
    // P1 安全修复(2026-08-02):IDOR 防护,非本人提现流水禁止访问(管理员 roleId >= 1 豁免)
    const isAdmin = (request.jwtPayload?.roleId ?? 0) >= 1
    if (!isAdmin && flow.userId !== request.userId) {
      return reply.status(403).send(error(403, '无权访问他人提现流水'))
    }
    return reply.send(success({ flow }))
  })

  server.post(
    '/finance/withdrawal/flows/:id/approve',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      await requireAdmin(request, reply)
      if (reply.sent) return
      const id = parseIdParam(request, reply)
      if (id === null) return
      const flow = await approveWithdrawal(id, request.userId ?? null)
      if (!flow) return reply.status(400).send(error(400, '提现记录不存在或已处理'))
      notifyWithdrawalResult(flow, 'approved')
      return reply.send(success({ success: true, flow }))
    },
  )

  server.post(
    '/finance/withdrawal/flows/:id/reject',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      await requireAdmin(request, reply)
      if (reply.sent) return
      const id = parseIdParam(request, reply)
      if (id === null) return
      const body = (request.body as { reason?: string } | null) ?? {}
      const flow = await rejectWithdrawal(id, body.reason ?? '驳回', request.userId ?? null)
      if (!flow) return reply.status(400).send(error(400, '提现记录不存在或已处理'))
      notifyWithdrawalResult(flow, 'rejected')
      return reply.send(success({ success: true, flow }))
    },
  )
}

export default withdrawalRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
