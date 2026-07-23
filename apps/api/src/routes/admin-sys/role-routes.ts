import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { parseNum, parseStr } from './_shared.js'
import {
  updateAdminRoleStatus,
  updateAdminRoleDataScope,
  findAdminRoleDeptIds,
  findAllocatedUsers,
  findUnallocatedUsers,
  cancelUserRole,
  cancelAllUserRole,
  selectAllUserRole,
  findDeptList,
  deleteRoleMenuCascade,
} from '../../db/admin-sys-queries.js'

// role_router (prefix=/role)
// 注:authUser 5 端点基于 users.roleId (integer) 实现,不新建 sys_user_role 表:
//   - "分配角色" = UPDATE users SET roleId = ?
//   - "取消角色" = UPDATE users SET roleId = 0
//   避免与 users.roleId 数据冗余,与 requireAdmin (roleId >= 1) 鉴权体系一致。

const roleChangeStatusBodySchema = z.object({
  roleId: z.number().int(),
  status: z.string(),
})

const roleDataScopeBodySchema = z.object({
  roleId: z.number().int(),
  dataScope: z.string().optional(),
  deptIds: z.array(z.number().int()).max(500).optional(),
})

export const roleRoutes: FastifyPluginAsync = async (s) => {
  // PUT /role/changeStatus - 修改角色状态(对应前端 changeRoleStatus)
  s.put('/changeStatus', async (request, reply) => {
    const parsed = roleChangeStatusBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const role = await updateAdminRoleStatus(parsed.data.roleId, parsed.data.status)
    if (!role) {
      return reply.status(404).send(error(404, '角色不存在'))
    }
    return reply.send(success({ role }))
  })

  // PUT /role/dataScope - 更新角色数据权限(对应前端 dataScope)
  s.put('/dataScope', async (request, reply) => {
    const parsed = roleDataScopeBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const role = await updateAdminRoleDataScope(
      parsed.data.roleId,
      parsed.data.dataScope ?? '1',
      parsed.data.deptIds ?? [],
    )
    if (!role) {
      return reply.status(404).send(error(404, '角色不存在'))
    }
    return reply.send(success({ role }))
  })

  // GET /role/deptTree/:roleId - 角色关联的部门树(对应前端 roleDeptTreeSelect)
  s.get('/deptTree/:roleId', async (request, reply) => {
    const { roleId } = z.object({ roleId: z.string() }).parse(request.params)
    const rid = Number(roleId)
    if (Number.isNaN(rid) || rid < 1) {
      return reply.status(400).send(error(400, 'roleId 无效'))
    }
    const list = await findDeptList()
    const checkedKeys = await findAdminRoleDeptIds(rid)
    return reply.send(success({ depts: list, checkedKeys }))
  })

  // DELETE /role/:roleId - 删除角色(级联清理 sys_role_menu)
  s.delete('/:roleId', async (request, reply) => {
    const { roleId } = z.object({ roleId: z.string() }).parse(request.params)
    const rid = Number(roleId)
    if (Number.isNaN(rid) || rid < 1) {
      return reply.status(400).send(error(400, 'roleId 无效'))
    }
    await deleteRoleMenuCascade(rid)
    return reply.send(success({ roleId: rid }))
  })

  // -----------------------------------------------------------------------
  // authUser 子路由(prefix=/authUser)— 角色用户管理(5 端点)
  // 基于 users.roleId (integer) 实现,不依赖 sys_user_role 中间表
  // -----------------------------------------------------------------------
  s.register(
    async (sub) => {
      // GET /role/authUser/allocatedList - 已分配该角色的用户
      sub.get('/allocatedList', async (request, reply) => {
        const q = request.query as Record<string, string>
        const roleId = parseNum(q.roleId) ?? 0
        if (roleId < 1) {
          return reply.status(400).send(error(400, 'roleId 无效'))
        }
        const { list, total } = await findAllocatedUsers({
          page: parseNum(q.page, 1),
          pageSize: parseNum(q.pageSize, 10),
          roleId,
          userName: parseStr(q.userName),
          phonenumber: parseStr(q.phonenumber),
        })
        return reply.send(success({ list, total }))
      })

      // GET /role/authUser/unallocatedList - 未分配该角色的用户
      sub.get('/unallocatedList', async (request, reply) => {
        const q = request.query as Record<string, string>
        const roleId = parseNum(q.roleId, 0) ?? 0
        if (roleId < 1) {
          return reply.status(400).send(error(400, 'roleId 无效'))
        }
        const { list, total } = await findUnallocatedUsers({
          page: parseNum(q.page, 1),
          pageSize: parseNum(q.pageSize, 10),
          roleId,
          userName: parseStr(q.userName),
          phonenumber: parseStr(q.phonenumber),
        })
        return reply.send(success({ list, total }))
      })

      // PUT /role/authUser/cancel - 取消单个用户的角色授权
      sub.put('/cancel', async (request, reply) => {
        const parsed = z
          .object({
            roleId: z.union([z.number().int(), z.string()]).transform(Number),
            userId: z.union([z.number().int(), z.string()]).transform(String),
          })
          .safeParse(request.body)
        if (!parsed.success) {
          return reply
            .status(400)
            .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const { roleId, userId } = parsed.data
        if (roleId < 1) {
          return reply.status(400).send(error(400, 'roleId 无效'))
        }
        const affected = await cancelUserRole(userId, roleId)
        return reply.send(success({ success: affected > 0 }))
      })

      // PUT /role/authUser/cancelAll - 批量取消角色授权(userIds 逗号分隔)
      sub.put('/cancelAll', async (request, reply) => {
        const q = request.query as Record<string, string>
        const roleId = parseNum(q.roleId) ?? 0
        if (roleId < 1) {
          return reply.status(400).send(error(400, 'roleId 无效'))
        }
        const userIds = (q.userIds ?? '')
          .split(',')
          .map((str) => str.trim())
          .filter(Boolean)
        if (userIds.length === 0) {
          return reply.status(400).send(error(400, 'userIds 不能为空'))
        }
        const affected = await cancelAllUserRole(userIds, roleId)
        return reply.send(success({ success: true, affected }))
      })

      // PUT /role/authUser/selectAll - 批量分配角色(userIds 逗号分隔)
      sub.put('/selectAll', async (request, reply) => {
        const q = request.query as Record<string, string>
        const roleId = parseNum(q.roleId) ?? 0
        if (roleId < 1) {
          return reply.status(400).send(error(400, 'roleId 无效'))
        }
        const userIds = (q.userIds ?? '')
          .split(',')
          .map((str) => str.trim())
          .filter(Boolean)
        if (userIds.length === 0) {
          return reply.status(400).send(error(400, 'userIds 不能为空'))
        }
        const affected = await selectAllUserRole(userIds, roleId)
        return reply.send(success({ success: true, affected }))
      })
    },
    { prefix: '/authUser' },
  )
}
