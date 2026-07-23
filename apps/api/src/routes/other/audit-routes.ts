/**
 * 审计/安全日志(从 frontend-stub-other-routes.ts 拆分)。
 * GET /agents/oauth-apps/audit-logs — OAuth 应用审计日志
 * GET /security/audit — 安全审计日志
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, emptyToUndefined } from '../../utils/response.js'
import { findAuditLogList } from '../../db/oauth-queries.js'
import { findSecurityLogs } from '../../db/security-logs-queries.js'
import { parsePagination } from './_shared.js'

export const auditRoutes: FastifyPluginAsync = async (server) => {
  // GET /agents/oauth-apps/audit-logs — OAuth 应用审计日志
  // 注:真实实现在 /oauth-apps/audit-logs (agents.ts),此处路径不同,接入同一张表
  server.get('/agents/oauth-apps/audit-logs', async (request, reply) => {
    const q = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        clientId: z.preprocess(emptyToUndefined, z.string().optional()),
        event: z.preprocess(emptyToUndefined, z.string().optional()),
        status: z.preprocess(emptyToUndefined, z.string().optional()),
      })
      .parse(request.query)
    const { items, total } = await findAuditLogList({
      page: q.page,
      limit: q.pageSize,
      clientId: q.clientId,
      event: q.event,
      status: q.status,
      userId: request.userId,
    })
    return reply.send(success({ list: items, total, page: q.page, pageSize: q.pageSize }))
  })

  // GET /security/audit — 安全审计日志
  server.get('/security/audit', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findSecurityLogs(request.userId!, q.page, q.pageSize)
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })
}
