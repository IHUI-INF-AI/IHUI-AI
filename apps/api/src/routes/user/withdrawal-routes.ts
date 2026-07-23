/**
 * 提现模块 /finance/withdrawal/*(7 个端点)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
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

const withdrawalApplySchema = z.object({
  amount: z.coerce.number().int().positive(),
  method: z.string().min(1),
  accountInfo: z.record(z.unknown()).optional(),
})

const withdrawalRoutes: FastifyPluginAsync = async (server) => {
  server.post('/finance/withdrawal/withdrawal', async (request, reply) => {
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
  })

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
    return reply.send(success({ flow }))
  })

  server.post('/finance/withdrawal/flows/:id/approve', async (request, reply) => {
    const roleId = request.jwtPayload?.roleId ?? 0
    if (roleId < 1) return reply.status(403).send(error(403, '需要管理员权限'))
    const id = parseIdParam(request, reply)
    if (id === null) return
    const flow = await approveWithdrawal(id, request.userId ?? null)
    if (!flow) return reply.status(400).send(error(400, '提现记录不存在或已处理'))
    return reply.send(success({ success: true, flow }))
  })

  server.post('/finance/withdrawal/flows/:id/reject', async (request, reply) => {
    const roleId = request.jwtPayload?.roleId ?? 0
    if (roleId < 1) return reply.status(403).send(error(403, '需要管理员权限'))
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = (request.body as { reason?: string } | null) ?? {}
    const flow = await rejectWithdrawal(id, body.reason ?? '驳回', request.userId ?? null)
    if (!flow) return reply.status(400).send(error(400, '提现记录不存在或已处理'))
    return reply.send(success({ success: true, flow }))
  })
}

export default withdrawalRoutes
