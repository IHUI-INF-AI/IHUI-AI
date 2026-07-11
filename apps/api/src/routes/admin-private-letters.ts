import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { findPrivateLettersForAdmin } from '../db/private-letters-admin-queries.js'

const ADMIN_ROLE_ID = 1

const listQuerySchema = z.object({
  page: z.preprocess((v) => emptyToUndefined(v), z.coerce.number().min(1).default(1)),
  pageSize: z.preprocess((v) => emptyToUndefined(v), z.coerce.number().min(1).max(100).default(20)),
})

/** 管理路由：私信列表查询 */
export const adminPrivateLettersRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request, reply) => {
    try {
      await authenticate(request)
    } catch {
      return reply.status(401).send(error(401, '未授权'))
    }
    const roleId = request.jwtPayload?.roleId ?? 0
    if (roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '需要管理员权限'))
    }
  })

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
