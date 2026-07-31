/**
 * 已废弃端点路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 业务必要性评估 (2026-07-21):
 * - [no-callsite] → 410 Gone 风格,前端可拿到明确错误码
 * - [has-callsite] → 保留原 echo 风格(业务方评估完成 @2026-07-21)
 * 注意:部分端点保留 requireAdmin(原样保留),部分无 preHandler(原样保留)。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { requireAdmin } from '../../plugins/require-permission.js'
import { error } from '../../utils/response.js'

const GONE_MSG = '端点已废弃,无业务调用方 @2026-07-21'

function gone(_request: FastifyRequest, reply: FastifyReply) {
  return reply.status(410).send(error(410, GONE_MSG))
}

export const deprecatedRoutes: FastifyPluginAsync = async (server) => {
  // 以下端点保留 requireAdmin(原样保留)
  server.patch(
    '/admin/api-platform/packages',
    { preHandler: requireAdmin },
    async (_request, reply) => gone(_request, reply),
  )
  server.post('/admin/oss/files', { preHandler: requireAdmin }, async (_request, reply) =>
    gone(_request, reply),
  )

  // 以下端点统一 requireAdmin(原无 preHandler,2026-07-31 补齐)
  server.put('/admin/edu/classes', { preHandler: requireAdmin }, gone)
  server.put('/admin/learn/lessons/:id/chapters', { preHandler: requireAdmin }, gone)
  server.put('/admin/edu/exam/arrangements', { preHandler: requireAdmin }, gone)
  server.put('/admin/edu/exam/templates', { preHandler: requireAdmin }, gone)
  server.put('/admin/learn/community', { preHandler: requireAdmin }, gone)
  server.put('/admin/learn/homework', { preHandler: requireAdmin }, gone)
  server.put('/admin/live/channels', { preHandler: requireAdmin }, gone)
  server.put('/admin/learn/maps', { preHandler: requireAdmin }, gone)
  server.put('/admin/learn/materials', { preHandler: requireAdmin }, gone)
  server.put('/admin/learn/lessons', { preHandler: requireAdmin }, gone)
  server.put('/admin/learn/plans', { preHandler: requireAdmin }, gone)
  server.put('/admin/learn/reminds', { preHandler: requireAdmin }, gone)
  server.put('/admin/learn/premium-topics', { preHandler: requireAdmin }, gone)
  server.patch('/admin/help/articles', { preHandler: requireAdmin }, gone)
  server.put('/admin/learn/categories', { preHandler: requireAdmin }, gone)
  server.put('/admin/live/categories', { preHandler: requireAdmin }, gone)
  server.put('/admin/members/:id', { preHandler: requireAdmin }, gone)
  server.patch('/admin/oss/drivers', { preHandler: requireAdmin }, gone)
  server.delete('/admin/roles/:id/users', { preHandler: requireAdmin }, gone)
  server.patch('/admin/shop/products', { preHandler: requireAdmin }, gone)
  server.put('/admin/shop/withdrawals', { preHandler: requireAdmin }, gone)
}
