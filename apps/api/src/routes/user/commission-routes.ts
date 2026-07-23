/**
 * 分销 /commission/*(4 个端点)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { success } from '../../utils/response.js'
import {
  commissionSummary,
  listCommissionFlows,
  listSubordinates,
  teamCenter,
  withdrawalSummary,
  availableWithdrawal,
} from '../../db/commission-queries.js'
import { parsePagination } from './_shared.js'

const commissionRoutes: FastifyPluginAsync = async (server) => {
  server.get('/commission/overview', async (request, reply) => {
    const userId = request.userId!
    const [summary, withdrawal, available] = await Promise.all([
      commissionSummary(userId, 30),
      withdrawalSummary(userId),
      availableWithdrawal(userId),
    ])
    return reply.send(
      success({
        totalCommission: summary.totalAmount,
        availableCommission: available,
        pendingCommission: withdrawal.pendingAmount,
        withdrawnCommission: withdrawal.totalWithdrawn,
      }),
    )
  })

  server.get('/commission/invite-info', async (request, reply) => {
    const team = await teamCenter(request.userId!)
    return reply.send(
      success({
        inviteCode: null,
        inviteUrl: null,
        inviteCount: team.totalInvitees,
        vipInvitees: team.vipInvitees,
        monthNew: team.monthNew,
      }),
    )
  })

  server.get('/commission/invited-users', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await listSubordinates(request.userId!, q.page, q.pageSize)
    return reply.send(
      success({ list: result.items, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/commission/list', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await listCommissionFlows(request.userId!, q.page, q.pageSize)
    return reply.send(
      success({ list: result.items, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })
}

export default commissionRoutes
