/**
 * 菜单管理 API
 * 对接后端: app/api/v1/admin_panel.py (menu_router, prefix="/menu")
 * 路由前缀: /api/v1/menu
 *
 * 菜单为树形结构, list/treeselect 均返回树形或扁平列表;
 * 本文件统一转换为 { records, total } 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface MenuListParams {
  current?: number
  size?: number
  keyword?: string
  status?: string
  [k: string]: unknown
}

export interface AdminMenu {
  menuId: number
  menuName: string
  parentId: number
  orderNum?: number
  path?: string
  component?: string
  query?: string
  isFrame?: string
  isCache?: string
  menuType: string
  visible?: string
  status: string
  perms?: string
  icon?: string
  createTime?: string | null
}

/** 菜单树节点 (下拉用) */
export interface MenuTreeNode {
  id: number
  label: string
  parentId: number
  children?: MenuTreeNode[]
}

/** 角色菜单树 (含已选) */
export interface RoleMenuTree {
  menus: MenuTreeNode[]
  checkedKeys: number[]
}

// 统一构造 ApiResponse<{records, total}> 格式
function toListResult(rows: unknown[], total: number, msg = 'success'): ApiResponse<{ records: unknown[]; total: number }> {
  return {
    code: 0,
    message: msg,
    data: { records: rows, total },
    success: true,
    timestamp: Date.now(),
  } as unknown as ApiResponse<{ records: unknown[]; total: number }>
}

function toDataResult(data: unknown, msg = 'success'): ApiResponse<unknown> {
  return {
    code: 0,
    message: msg,
    data,
    success: true,
    timestamp: Date.now(),
  } as unknown as ApiResponse<unknown>
}

// ===========================================================================
// 菜单 CRUD
// ===========================================================================

/** 菜单列表 (树形, 后端返回扁平列表由前端组装树) */
export async function menuList(params: MenuListParams = {}): Promise<ApiResponse<PaginationResponse<AdminMenu>>> {
  const res = await http.get('/api/v1/menu/list', {
    params: {
      menuName: params.keyword || undefined,
      status: params.status || undefined,
    },
  })
  const body = (res as any).data || {}
  // 菜单列表非分页, 后端直接返回数组
  const rows = Array.isArray(body.data) ? body.data : (body.data?.list || [])
  const total = Array.isArray(body.data) ? body.data.length : (body.data?.total || body.total || rows.length)
  return toListResult(rows, total, body.msg) as unknown as ApiResponse<PaginationResponse<AdminMenu>>
}

/** 菜单详情 */
export async function menuDetail(menuId: number): Promise<ApiResponse<AdminMenu | null>> {
  const res = await http.get(`/api/v1/menu/${menuId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminMenu | null>
}

/** 新增菜单 */
export async function menuCreate(payload: Partial<AdminMenu> & { menuName: string; menuType: string }): Promise<ApiResponse<AdminMenu>> {
  const res = await http.post('/api/v1/menu', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminMenu>
}

/** 修改菜单 (后端 PUT /menu, menuId 走请求体) */
export async function menuUpdate(payload: Partial<AdminMenu> & { menuId: number }): Promise<ApiResponse<AdminMenu>> {
  const res = await http.put('/api/v1/menu', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminMenu>
}

/** 删除菜单 */
export async function menuDelete(menuId: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/menu/${menuId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

// ===========================================================================
// 菜单树 / 角色菜单
// ===========================================================================

/** 菜单树 (下拉用) */
export async function menuTreeSelect(): Promise<ApiResponse<MenuTreeNode[]>> {
  const res = await http.get('/api/v1/menu/treeselect')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<MenuTreeNode[]>
}

/** 角色菜单树 (含已选) */
export async function menuRoleMenuTreeSelect(roleId: number): Promise<ApiResponse<RoleMenuTree>> {
  const res = await http.get(`/api/v1/menu/roleMenuTreeselect/${roleId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<RoleMenuTree>
}

/** 菜单详情 (编辑回显用, 同 menuDetail) */
export async function menuGetInfo(menuId: number): Promise<ApiResponse<AdminMenu | null>> {
  const res = await http.get(`/api/v1/menu/${menuId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminMenu | null>
}

/** 查询单个菜单 (同 menuDetail) */
export async function menuQueryById(menuId: number): Promise<ApiResponse<AdminMenu | null>> {
  const res = await http.get(`/api/v1/menu/${menuId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminMenu | null>
}

export const adminMenuApi = {
  menuList,
  menuDetail,
  menuCreate,
  menuUpdate,
  menuDelete,
  menuTreeSelect,
  menuRoleMenuTreeSelect,
  menuGetInfo,
  menuQueryById,
}

export default adminMenuApi
