// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 角色用户管理路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 路径前缀:/admin/roles
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, parseOrThrow } from '../../utils/response.js'
import { addUserRoleBatch, removeUserRole, removeUserRoleBatch } from '../../db/rbac-queries.js'

// G-624 successor(2026-10-09):roles.id 是 uuid 主键(rbac.ts:15),共享 idParamSchema
// (z.string().min(1))在这里等于敞口 —— 非 UUID 串打到 PG uuid 列 22P02 ⇒ 500。本地收紧
// 为 z.uuid(),失败走 parseOrThrow ⇒ AppError(400, VALIDATION_FAILED)。共享行保持原样
// (admin-extended/_shared.ts:10,它还服务 serial 主键的在跑路由),不动共享定义。
const uuidIdParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

const addRoleUserSchema = z
  .object({ userId: z.uuid().optional(), userIds: z.array(z.uuid()).min(1).optional() })
  .refine(
    (b) =>
      (b.userId !== null && b.userId !== undefined) ||
      (b.userIds !== null && b.userIds !== undefined),
    {
      message: 'userId 或 userIds 必填其一',
    },
  )

const revokeRoleUsersSchema = z.object({ userIds: z.array(z.uuid()).min(1) })

export const roleRoutes: FastifyPluginAsync = async (server) => {
  server.delete(
    '/admin/roles/:roleId/users/:userId',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { roleId, userId } = parseOrThrow(
        z.object({ roleId: z.string().min(1), userId: z.uuid() }),
        request.params,
      )
      // deleted 由库侧 RETURNING 派生,不是代码常量(2026-09-27):removeUserRole 的 where
      // 同时带 userId 与 roleId,这一对本就不在 userRoles 里时旧写法照样回 true。
      const removed = await removeUserRole(userId, roleId)
      return reply.send(success({ userId, roleId, deleted: removed.length > 0 }))
    },
  )
  // 授权用户:兼容单个 {userId} 与批量 {userIds[]}(userRoles 有 (user_id, role_id) 联合唯一,幂等)
  server.post('/admin/roles/:id/users', { preHandler: requireAdmin }, async (request, reply) => {
    const { id: roleId } = parseOrThrow(uuidIdParamSchema, request.params)
    const b = parseOrThrow(addRoleUserSchema, request.body)
    const ids = b.userIds ?? [b.userId as string]
    await addUserRoleBatch(ids, roleId)
    return reply
      .status(201)
      .send(success({ userId: b.userId, roleId, created: true, authorized: ids.length }))
  })

  // 批量取消授权 {userIds[]}(Fastify v5 DELETE 属 bodywith 方法,body 可正常解析;
  // api-client 对带 body 的请求自动设 Content-Type: application/json)
  server.delete('/admin/roles/:id/users', { preHandler: requireAdmin }, async (request, reply) => {
    const { id: roleId } = parseOrThrow(uuidIdParamSchema, request.params)
    const b = parseOrThrow(revokeRoleUsersSchema, request.body)
    const revoked = await removeUserRoleBatch(b.userIds, roleId)
    return reply.send(success({ roleId, revoked }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
