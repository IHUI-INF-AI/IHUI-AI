/**
 * 组织架构 API (组织/成员)
 * 对接后端: app/api/v1/organization/organization.py
 * 路由前缀: /api/v1/organization
 *
 * 后端列表响应为 {code, msg, data:[...], total},
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 * 注意: 后端 create/update 等接口均使用 Query 参数传值。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface OrganizationListParams {
  current?: number
  size?: number
  keyword?: string
  status?: string
  pid?: number
  [k: string]: unknown
}

/** 组织 */
export interface Organization {
  oid: number
  name: string
  pid?: number
  type?: string
  shortName?: string
  code?: string
  description?: string
  leader?: string
  leaderPhone?: string
  logo?: string
  address?: string
  sortOrder?: number
  status: string
  createTime?: string | null
}

/** 组织成员 */
export interface OrgMember {
  userId: string
  role?: string
  position?: string
  userName?: string
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
// 组织 CRUD
// ===========================================================================

/** 组织列表 (按 pid/status/keyword 过滤,无分页) */
export async function organizationList(params: OrganizationListParams = {}): Promise<ApiResponse<Organization[]>> {
  const res = await http.get('/api/v1/organization/list', {
    params: {
      pid: params.pid,
      status: params.status || undefined,
      keyword: params.keyword || undefined,
    },
  })
  const body = (res as any).data || {}
  // 组织列表通常为平铺数组,无分页
  return toDataResult(body.data || [], body.msg) as unknown as ApiResponse<Organization[]>
}

/** 组织树 */
export async function organizationTree(): Promise<ApiResponse<Organization[]>> {
  const res = await http.get('/api/v1/organization/tree')
  const body = (res as any).data || {}
  return toDataResult(body.data || [], body.msg) as unknown as ApiResponse<Organization[]>
}

/** 组织详情 (oid 走路径参数) */
export async function organizationDetail(oid: number): Promise<ApiResponse<Organization | null>> {
  const res = await http.get(`/api/v1/organization/${oid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<Organization | null>
}
/** 创建组织 */
export async function organizationCreate(params: {
  name: string
  pid?: number
  type?: string
  shortName?: string
  code?: string
  description?: string
  leader?: string
  leaderPhone?: string
  logo?: string
  address?: string
  sortOrder?: number
}): Promise<ApiResponse<Organization>> {
  const res = await http.post('/api/v1/organization', null, {
    params: {
      name: params.name,
      pid: params.pid,
      type: params.type || undefined,
      shortName: params.shortName || undefined,
      code: params.code || undefined,
      description: params.description || undefined,
      leader: params.leader || undefined,
      leaderPhone: params.leaderPhone || undefined,
      logo: params.logo || undefined,
      address: params.address || undefined,
      sortOrder: params.sortOrder,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<Organization>
}

/** 修改组织 (oid 走路径参数,其余走 Query) */
export async function organizationUpdate(oid: number, params: {
  name?: string
  pid?: number
  type?: string
  shortName?: string
  code?: string
  description?: string
  leader?: string
  leaderPhone?: string
  logo?: string
  address?: string
  sortOrder?: number
}): Promise<ApiResponse<Organization>> {
  const res = await http.put(`/api/v1/organization/${oid}`, null, {
    params: {
      name: params.name || undefined,
      pid: params.pid,
      type: params.type || undefined,
      shortName: params.shortName || undefined,
      code: params.code || undefined,
      description: params.description || undefined,
      leader: params.leader || undefined,
      leaderPhone: params.leaderPhone || undefined,
      logo: params.logo || undefined,
      address: params.address || undefined,
      sortOrder: params.sortOrder,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<Organization>
}

/** 删除组织 (oid 走路径参数) */
export async function organizationDelete(oid: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/organization/${oid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}
// ===========================================================================
// 组织成员
// ===========================================================================

/** 组织成员列表 (oid 走路径参数,page/limit 走 Query) */
export async function organizationMembers(oid: number, params: { page?: number; limit?: number }): Promise<ApiResponse<PaginationResponse<OrgMember>>> {
  const res = await http.get(`/api/v1/organization/${oid}/members`, {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<OrgMember>>
}

/** 添加组织成员 (oid 走路径参数,其余走 Query) */
export async function organizationMemberAdd(oid: number, params: { userId: string; role?: string; position?: string }): Promise<ApiResponse<OrgMember>> {
  const res = await http.post(`/api/v1/organization/${oid}/member`, null, {
    params: {
      userId: params.userId,
      role: params.role || undefined,
      position: params.position || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<OrgMember>
}

/** 移除组织成员 (oid 和 userId 均走路径参数) */
export async function organizationMemberRemove(oid: number, userId: string): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/organization/${oid}/member/${userId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const organizationApi = {
  organizationList,
  organizationTree,
  organizationDetail,
  organizationCreate,
  organizationUpdate,
  organizationDelete,
  organizationMembers,
  organizationMemberAdd,
  organizationMemberRemove,
}

export default organizationApi