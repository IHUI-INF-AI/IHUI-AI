// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/admin/role-permissions 路由(2026-08-30 角色权限点配置)。
 * 供 admin 前端勾选配置角色持有的权限点(如 teacher 角色挂 edu:view / edu:manage)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { success, error } from '../../utils/response.js'
import {
  findRoleById,
  findPermissions,
  findPermissionById,
  findRolePermissions,
  replaceRolePermissions,
} from '../../db/rbac-queries.js'
import { rolePermissionsQuerySchema, replaceRolePermissionsSchema } from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const rolePermissionsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
  // GET /role-permissions?roleId= - 某角色已挂的权限点列表(join permissions)
  server.get('/role-permissions', async (request, reply) => {
    const q = rolePermissionsQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const list = await findRolePermissions(q.data.roleId)
    return reply.send(success({ list }))
  })
  // GET /permissions - 全部权限点列表(勾选候选)
  server.get('/permissions', async (_request, reply) => {
    const list = await findPermissions()
    return reply.send(success({ list }))
  })
  // PUT /role-permissions - 全量替换角色的权限点关联
  server.put('/role-permissions', async (request, reply) => {
    const b = replaceRolePermissionsSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const { roleId, permissionIds } = b.data
    const role = await findRoleById(roleId)
    if (!role) return reply.status(404).send(error(404, '角色不存在'))
    // 校验权限点存在性(与 /api/roles/:id/permissions 一致)
    const validPerms = await Promise.all(permissionIds.map((pid) => findPermissionById(pid)))
    if (validPerms.some((p) => !p)) {
      return reply.status(404).send(error(404, '存在未知的权限 ID'))
    }
    // 去重后全量替换(事务内先删旧关联再插新关联)
    await replaceRolePermissions(roleId, Array.from(new Set(permissionIds)))
    const list = await findRolePermissions(roleId)
    return reply.send(success({ roleId, list }))
  })
}

export default rolePermissionsRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
