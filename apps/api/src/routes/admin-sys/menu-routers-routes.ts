import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/require-permission.js'
import { success } from '../../utils/response.js'
import { findMenuList, findMenuIdsByRole } from '../../db/admin-sys-queries.js'

// /getRouters 路由(独立于 adminSysRoutes,使用 requireAuth 而非 requireAdmin)
export const menuRoutersRoutes: FastifyPluginAsync = async (server) => {
  server.get('/getRouters', { preHandler: requireAuth }, async (request, reply) => {
    const roleId = request.jwtPayload?.roleId ?? 0
    const list = await findMenuList()
    if (roleId >= 1) {
      return reply.send(success({ list }))
    }
    const menuIds = await findMenuIdsByRole(roleId)
    const idSet = new Set(menuIds)
    return reply.send(success({ list: list.filter((m) => idSet.has(m.id)) }))
  })
}
