import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { findPrivateLettersForAdmin } from '../db/private-letters-admin-queries.js'

const listQuerySchema = z.object({
  page: z.preprocess((v) => emptyToUndefined(v), z.coerce.number().min(1).default(1)),
  pageSize: z.preprocess((v) => emptyToUndefined(v), z.coerce.number().min(1).max(100).default(20)),
})

/** 管理路由：私信列表查询 */
export const adminPrivateLettersRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /private-letters — 私信列表（联表 users 获取发送者/接收者名称）
  server.get('/private-letters', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findPrivateLettersForAdmin(parsed.data)
    return reply.send(success(result))
  })
}
