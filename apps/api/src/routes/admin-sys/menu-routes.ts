import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import {
  findMenuList,
  findMenuIdsByRole,
  assignRoleMenus,
  updateMenu,
  deleteMenuWithCascade,
  findMenuById,
  createMenu,
} from '../../db/admin-sys-queries.js'

// menu_router (prefix=/sys-menu) — RuoYi 风格 sys_menu 子系统
// 注:前缀已迁移至 /sys-menu,避免与 admin-extended.ts 的 /menu CRUD 路径冲突

const menuBodySchema = z.object({
  menuId: z.string().uuid().optional(),
  menuName: z.string().min(1).optional(),
  parentId: z.string().uuid().optional(),
  orderNum: z.number().int().optional(),
  path: z.string().optional(),
  component: z.string().optional(),
  menuType: z.enum(['M', 'C', 'F']).optional(),
  visible: z.string().optional(),
  status: z.string().optional(),
  perms: z.string().optional(),
  icon: z.string().optional(),
  isFrame: z.boolean().optional(),
  isCache: z.boolean().optional(),
  query: z.string().optional(),
})

export const menuRoutes: FastifyPluginAsync = async (s) => {
  // GET /sys-menu/list - 菜单列表
  s.get('/list', async (_request, reply) => {
    const list = await findMenuList()
    return reply.send(success({ list, total: list.length }))
  })

  // GET /sys-menu/:menuId - 菜单详情
  s.get('/:menuId', async (request, reply) => {
    const { menuId } = z.object({ menuId: z.string().uuid() }).parse(request.params)
    const data = await findMenuById(menuId)
    if (!data) {
      return reply.status(404).send(error(404, '菜单不存在'))
    }
    return reply.send(success({ data }))
  })

  // GET /sys-menu/treeselect - 菜单树(下拉)
  s.get('/treeselect', async (_request, reply) => {
    const list = await findMenuList()
    return reply.send(success({ list }))
  })

  // GET /sys-menu/roleMenuTreeselect/:roleId - 角色分配菜单树
  s.get('/roleMenuTreeselect/:roleId', async (request, reply) => {
    const { roleId } = z.object({ roleId: z.string() }).parse(request.params)
    const rid = Number(roleId)
    const list = await findMenuList()
    const checkedKeys = Number.isNaN(rid) ? [] : await findMenuIdsByRole(rid)
    return reply.send(success({ roleId, menus: list, checkedKeys }))
  })

  // PUT /sys-menu/assignRoleMenus/:roleId - 分配角色菜单
  s.put('/assignRoleMenus/:roleId', async (request, reply) => {
    const { roleId } = z.object({ roleId: z.string() }).parse(request.params)
    const rid = Number(roleId)
    if (Number.isNaN(rid) || rid < 1) {
      return reply.status(400).send(error(400, 'roleId 无效'))
    }
    const parsed = z.object({ menuIds: z.array(z.string().uuid()).max(500) }).safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    await assignRoleMenus(rid, parsed.data.menuIds)
    return reply.send(success({ assigned: parsed.data.menuIds.length }))
  })

  // POST /sys-menu - 新增菜单
  s.post('', async (request, reply) => {
    const parsed = menuBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { menuId: _menuId, menuName, ...rest } = parsed.data
    if (!menuName) {
      return reply.status(400).send(error(400, 'menuName 不能为空'))
    }
    const menu = await createMenu({ ...rest, menuName, createBy: request.userId })
    return reply.send(success({ menu }))
  })

  // PUT /sys-menu - 修改菜单
  s.put('', async (request, reply) => {
    const parsed = menuBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { menuId, ...data } = parsed.data
    if (!menuId) {
      return reply.status(400).send(error(400, 'menuId 不能为空'))
    }
    const menu = await updateMenu(menuId, { ...data, updateBy: request.userId })
    if (!menu) {
      return reply.status(404).send(error(404, '菜单不存在'))
    }
    return reply.send(success({ menu }))
  })

  // DELETE /sys-menu/:menuId - 删除菜单(级联清理 sys_role_menu)
  s.delete('/:menuId', async (request, reply) => {
    const { menuId } = z.object({ menuId: z.string().uuid() }).parse(request.params)
    const menu = await deleteMenuWithCascade(menuId)
    if (!menu) {
      return reply.status(404).send(error(404, '菜单不存在'))
    }
    return reply.send(success({ menu }))
  })
}
