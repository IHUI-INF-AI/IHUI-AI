/**
 * 角色管理 API
 * 对接后端: app/api/v1/admin_panel.py (role_router, prefix="/role")
 * 路由前缀: /api/v1/role
 *
 * 后端列表响应为 { code, msg, data: { list, total, page, size } },
 * 本文件统一转换为 { records, total } 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface RoleListParams {
  current?: number
  size?: number
  keyword?: string
  status?: string
  [k: string]: unknown
}

export interface AdminRole {
  roleId: number
  roleName: string
  roleKey: string
  roleSort?: number
  status: string
  dataScope?: string
  menuIds?: number[]
  deptIds?: number[]
  remark?: string
  createTime?: string | null
}

/** 部门树节点 (角色数据权限用) */
export interface RoleDeptTreeNode {
  id: number
  label: string
  parentId: number
  children?: RoleDeptTreeNode[]
}

/** 角色已分配用户列表查询参数 */
export interface RoleAuthUserParams {
  current?: number
  size?: number
  roleId: number
  userName?: string
  phonenumber?: string
  [k: string]: unknown
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
// 角色 CRUD
// ===========================================================================

/** 角色列表 */
export async function roleList(params: RoleListParams = {}): Promise<ApiResponse<PaginationResponse<AdminRole>>> {
  const res = await http.get('/api/v1/role/list', {
    params: {
      page: params.current ?? 1,
      size: params.size ?? 20,
      roleName: params.keyword || undefined,
      status: params.status || undefined,
    },
  })
  const body = (res as any).data || {}
  const payload = body.data || {}
  return toListResult(payload.list || [], payload.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<AdminRole>>
}

/** 角色详情 */
export async function roleDetail(roleId: number): Promise<ApiResponse<AdminRole | null>> {
  const res = await http.get(`/api/v1/role/${roleId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminRole | null>
}

/** 新增角色 */
export async function roleCreate(payload: Partial<AdminRole> & { roleName: string; roleKey: string }): Promise<ApiResponse<AdminRole>> {
  const res = await http.post('/api/v1/role', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminRole>
}

/** 修改角色 (后端 PUT /role, roleId 走请求体) */
export async function roleUpdate(payload: Partial<AdminRole> & { roleId: number }): Promise<ApiResponse<AdminRole>> {
  const res = await http.put('/api/v1/role', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminRole>
}

/** 删除角色 (支持批量, 逗号分隔) */
export async function roleDelete(roleIds: (string | number)[]): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/role/${roleIds.join(',')}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

// ===========================================================================
// 角色状态 / 数据权限
// ===========================================================================

/** 修改角色状态 (0=正常 1=停用) */
export async function roleChangeStatus(roleId: number, status: string): Promise<ApiResponse<unknown>> {
  const res = await http.put('/api/v1/role/changeStatus', { roleId, status })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 全部角色 (下拉用) */
export async function roleListAll(): Promise<ApiResponse<{ roleId: number; roleName: string; roleKey: string }[]>> {
  const res = await http.get('/api/v1/role/optionselect')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<{ roleId: number; roleName: string; roleKey: string }[]>
}

/** 修改数据权限 */
export async function roleDataScope(payload: { roleId: number; dataScope: string; deptIds?: number[] }): Promise<ApiResponse<unknown>> {
  const res = await http.put('/api/v1/role/dataScope', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 部门树 (角色数据权限用) */
export async function roleGetDeptTree(roleId: number): Promise<ApiResponse<{ depts: RoleDeptTreeNode[]; checkedKeys: number[] }>> {
  const res = await http.get(`/api/v1/role/deptTree/${roleId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<{ depts: RoleDeptTreeNode[]; checkedKeys: number[] }>
}

// ===========================================================================
// 角色用户授权
// ===========================================================================

/** 角色已分配用户列表 */
export async function roleAllocateUsers(params: RoleAuthUserParams): Promise<ApiResponse<PaginationResponse<{ userId: number; userName: string; phonenumber: string }>>> {
  const res = await http.get('/api/v1/role/authUser/allocatedList', {
    params: {
      page: params.current ?? 1,
      size: params.size ?? 20,
      roleId: params.roleId,
      userName: params.userName || undefined,
      phonenumber: params.phonenumber || undefined,
    },
  })
  const body = (res as any).data || {}
  const payload = body.data || {}
  return toListResult(payload.list || payload.rows || [], payload.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<{ userId: number; userName: string; phonenumber: string }>>
}

/** 角色未分配用户列表 */
export async function roleUnallocatedUsers(params: RoleAuthUserParams): Promise<ApiResponse<PaginationResponse<{ userId: number; userName: string; phonenumber: string }>>> {
  const res = await http.get('/api/v1/role/authUser/unallocatedList', {
    params: {
      page: params.current ?? 1,
      size: params.size ?? 20,
      roleId: params.roleId,
      userName: params.userName || undefined,
      phonenumber: params.phonenumber || undefined,
    },
  })
  const body = (res as any).data || {}
  const payload = body.data || {}
  return toListResult(payload.list || payload.rows || [], payload.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<{ userId: number; userName: string; phonenumber: string }>>
}

/** 取消用户授权 */
export async function roleCancelUser(userId: number, roleId: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete('/api/v1/role/authUser', {
    params: { userId, roleId },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 批量取消用户授权 (userIds 逗号分隔) */
export async function roleCancelAllUsers(userIds: (string | number)[], roleId: number): Promise<ApiResponse<unknown>> {
  const res = await http.put('/api/v1/role/authUser/cancelAll', null, {
    params: { userIds: userIds.join(','), roleId },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 批量选择用户授权 */
export async function roleSelectAllUsers(userId: number, roleId: number): Promise<ApiResponse<unknown>> {
  const res = await http.put('/api/v1/role/authUser/selectAll', null, {
    params: { userId, roleId },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const adminRoleApi = {
  roleList,
  roleDetail,
  roleCreate,
  roleUpdate,
  roleDelete,
  roleChangeStatus,
  roleListAll,
  roleDataScope,
  roleGetDeptTree,
  roleAllocateUsers,
  roleUnallocatedUsers,
  roleCancelUser,
  roleCancelAllUsers,
  roleSelectAllUsers,
}

export default adminRoleApi
