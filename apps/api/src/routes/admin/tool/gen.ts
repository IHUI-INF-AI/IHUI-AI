/**
 * /api/admin/tool/gen 路由(GET):返回代码生成器支持的类型元信息。
 */
import type { FastifyPluginAsync } from 'fastify'
import { success } from '../../../utils/response.js'
import { describeTypes, GEN_TYPES } from '../../../services/code-generator.js'
import { requireAdmin } from '../../../plugins/require-permission.js'

const genRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.get('/tool/gen', async (_request, reply) => {
    return reply.send(
      success({
        types: describeTypes(),
        typeNames: GEN_TYPES,
      }),
    )
  })
}

export default genRoutes
