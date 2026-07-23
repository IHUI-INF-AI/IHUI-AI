/**
 * 已废弃端点路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 业务必要性评估 (2026-07-21):
 * - [no-callsite] → 410 Gone 风格,前端可拿到明确错误码
 * - [has-callsite] → 保留原 echo 风格,加 TODO 注释留给业务方评估
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
  server.post('/admin/oss/files', { preHandler: requireAdmin }, async (_request, reply) => {
    return reply.status(501).send(error(501, 'OSS文件上传暂未实现,files 表需要 projectId'))
  })

  // 以下端点无 preHandler(原样保留)
  server.put('/admin/edu/classes', gone)
  server.put('/admin/learn/lessons/:id/chapters', gone)
  server.put('/admin/edu/exam/arrangements', gone)
  server.put('/admin/edu/exam/templates', gone)
  server.put('/admin/learn/community', gone)
  server.put('/admin/learn/homework', gone)
  server.put('/admin/live/channels', gone)
  server.put('/admin/learn/maps', gone)
  server.put('/admin/learn/materials', gone)
  server.put('/admin/learn/lessons', gone)
  server.put('/admin/learn/plans', gone)
  server.put('/admin/learn/reminds', gone)
  server.put('/admin/learn/premium-topics', gone)
  server.patch('/admin/help/articles', gone)
  server.put('/admin/learn/categories', gone)
  server.put('/admin/live/categories', gone)
  server.put('/admin/members/:id', gone)
  server.patch('/admin/oss/drivers', gone)
  server.delete('/admin/roles/:id/users', gone)
  server.patch('/admin/shop/products', gone)
  server.put('/admin/shop/withdrawals', gone)
}
