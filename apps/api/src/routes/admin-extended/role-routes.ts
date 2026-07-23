/**
 * 角色用户管理路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 路径前缀:/admin/roles
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, parseOrThrow } from '../../utils/response.js'
import { addUserRole, removeUserRole } from '../../db/rbac-queries.js'
import { idParamSchema } from './_shared.js'

const addRoleUserSchema = z.object({ userId: z.string().uuid() })

export const roleRoutes: FastifyPluginAsync = async (server) => {
  server.delete(
    '/admin/roles/:roleId/users/:userId',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { roleId, userId } = parseOrThrow(
        z.object({ roleId: z.string().min(1), userId: z.string().uuid() }),
        request.params,
      )
      await removeUserRole(userId, roleId)
      return reply.send(success({ userId, roleId, deleted: true }))
    },
  )
  server.post('/admin/roles/:id/users', { preHandler: requireAdmin }, async (request, reply) => {
    const { id: roleId } = parseOrThrow(idParamSchema, request.params)
    const { userId } = parseOrThrow(addRoleUserSchema, request.body)
    await addUserRole(userId, roleId)
    return reply.status(201).send(success({ userId, roleId, created: true }))
  })
}
