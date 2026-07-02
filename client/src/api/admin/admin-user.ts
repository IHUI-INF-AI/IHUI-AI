/**
 * 用户管理 API
 * 对接后端: app/api/v1/admin_panel.py (user_router, prefix="/user")
 * 路由前缀: /api/v1/user
 *
 * 后端列表响应为 { code, msg, data: { list, total, page, size } },
 * 本文件统一转换为 { records, total } 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface UserListParams {
  current?: number
  size?: number
  keyword?: string
  status?: string
  deptId?: number
  [k: string]: unknown
}

export interface AdminUser {
  userId: number
  deptId?: number
  userName: string
  nickName: string
  email?: string
  phone?: string
  sex?: string
  status: string
  remark?: string
  createTime?: string | null
}

/** 部门树节点 */
export interface DeptTreeNode {
  id: number
  label: string
  parentId: number
  children?: DeptTreeNode[]
}

/** 用户已分配角色信息 */
export interface UserRoleInfo {
  user: { userId: number; userName: string; nickName: string }
  roles: { roleId: number; roleName: string; roleKey: string; flag: boolean }[]
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
// 用户 CRUD
// ===========================================================================

/** 用户列表 */
export async function userList(params: UserListParams = {}): Promise<ApiResponse<PaginationResponse<AdminUser>>> {
  const res = await http.get('/api/v1/user/list', {
    params: {
      page: params.current ?? 1,
      size: params.size ?? 20,
      userName: params.keyword || undefined,
      status: params.status || undefined,
    },
  })
  const body = (res as any).data || {}
  const payload = body.data || {}
  return toListResult(payload.list || [], payload.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<AdminUser>>
}

/** 用户详情 */
export async function userDetail(userId: number): Promise<ApiResponse<AdminUser | null>> {
  const res = await http.get(`/api/v1/user/${userId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminUser | null>
}

/** 新增用户 */
export async function userCreate(payload: Partial<AdminUser> & { userName: string; nickName: string }): Promise<ApiResponse<AdminUser>> {
  const res = await http.post('/api/v1/user', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminUser>
}

/** 修改用户 (后端 PUT /user/{userId}, userId 走路径参数) */
export async function userUpdate(payload: Partial<AdminUser> & { userId: number }): Promise<ApiResponse<AdminUser>> {
  const { userId, ...rest } = payload
  const res = await http.put(`/api/v1/user/${userId}`, rest)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminUser>
}

/** 删除用户 (支持批量, 逗号分隔) */
export async function userDelete(userIds: (string | number)[]): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/user/${userIds.join(',')}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

// ===========================================================================
// 用户状态 / 密码 / 导入导出
// ===========================================================================

/** 修改用户状态 (0=正常 1=停用) */
export async function userChangeStatus(userId: number, status: string): Promise<ApiResponse<unknown>> {
  const res = await http.put('/api/v1/user/changeStatus', { userId, status })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 重置用户密码 */
export async function userResetPwd(userId: number, password: string): Promise<ApiResponse<unknown>> {
  const res = await http.put('/api/v1/user/resetPwd', null, {
    params: { userId, password },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 导入用户数据 (Excel 文件上传) */
export async function userImportData(file: File): Promise<ApiResponse<unknown>> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await http.post('/api/v1/user/importData', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 导出用户列表 (返回二进制流) */
export async function userExport(params: UserListParams = {}): Promise<Blob> {
  const res = await http.get('/api/v1/user/export', {
    params: {
      userName: params.keyword || undefined,
      status: params.status || undefined,
    },
    responseType: 'blob',
  })
  return res as unknown as Blob
}

// ===========================================================================
// 个人信息 / 密码 / 头像
// ===========================================================================

/** 获取个人信息 */
export async function userGetProfile(): Promise<ApiResponse<AdminUser | null>> {
  const res = await http.get('/api/v1/user/profile')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminUser | null>
}

/** 修改个人信息 */
export async function userUpdateProfile(payload: Partial<AdminUser>): Promise<ApiResponse<unknown>> {
  const res = await http.put('/api/v1/user/profile', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 修改个人密码 */
export async function userUpdatePwd(oldPwd: string, newPwd: string): Promise<ApiResponse<unknown>> {
  const res = await http.put('/api/v1/user/profile/updatePwd', null, {
    params: { oldPassword: oldPwd, newPassword: newPwd },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 上传头像 (图片文件) */
export async function userAvatar(file: File): Promise<ApiResponse<{ imgUrl: string }>> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await http.post('/api/v1/user/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<{ imgUrl: string }>
}

// ===========================================================================
// 部门树 / 角色分配
// ===========================================================================

/** 部门树 (用户列表筛选用) */
export async function deptTreeSelect(): Promise<ApiResponse<DeptTreeNode[]>> {
  const res = await http.get('/api/v1/user/deptTree')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<DeptTreeNode[]>
}

/** 全部角色 (用户分配角色下拉用) */
export async function roleListAll(): Promise<ApiResponse<{ roleId: number; roleName: string; roleKey: string }[]>> {
  const res = await http.get('/api/v1/role/optionselect')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<{ roleId: number; roleName: string; roleKey: string }[]>
}

/** 获取用户已分配角色 (返回全部角色及选中标记) */
export async function userGetRoleList(userId: number): Promise<ApiResponse<UserRoleInfo>> {
  const res = await http.get(`/api/v1/user/authRole/${userId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<UserRoleInfo>
}

/** 分配角色 (roleIds 逗号分隔) */
export async function userAssignRoles(userId: number, roleIds: (string | number)[]): Promise<ApiResponse<unknown>> {
  const res = await http.put('/api/v1/user/authRole', null, {
    params: { userId, roleIds: roleIds.join(',') },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const adminUserApi = {
  userList,
  userDetail,
  userCreate,
  userUpdate,
  userDelete,
  userChangeStatus,
  userResetPwd,
  userImportData,
  userExport,
  userGetProfile,
  userUpdateProfile,
  userUpdatePwd,
  userAvatar,
  deptTreeSelect,
  roleListAll,
  userGetRoleList,
  userAssignRoles,
}

export default adminUserApi
