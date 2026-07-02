/**
 * 部门管理 API
 * 对接后端: app/api/v1/admin_panel.py (dept_router, prefix=/dept)
 * 路由前缀: /api/v1/dept
 *
 * 后端列表返回数组 (部门为树形结构, 不分页);
 * 详情/单条返回 {code, msg, data:{...}};
 * 本文件统一转换为 ApiResponse<T> 以适配前端调用。
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

export interface DeptListParams {
  current?: number
  size?: number
  keyword?: string
  status?: string
  parentId?: number
  [k: string]: unknown
}

export interface AdminDept {
  /** 部门 ID */
  deptId: number
  /** 父部门 ID */
  parentId: number
  /** 祖级列表 (如 0,100,101) */
  ancestors: string
  /** 部门名称 */
  deptName: string
  /** 显示顺序 */
  orderNum: number
  /** 负责人 */
  leader: string
  /** 联系电话 */
  phone: string
  /** 邮箱 */
  email: string
  /** 状态 (0=正常 1=停用) */
  status: string
  /** 备注 */
  remark?: string
  /** 创建时间 */
  createTime?: string | null
  /** 子部门 (前端构建树) */
  children?: AdminDept[]
}

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
// 部门 CRUD
// ===========================================================================

/** 部门列表 (不分页, 返回数组, 前端构建树) */
export async function deptList(params: DeptListParams = {}): Promise<ApiResponse<AdminDept[]>> {
  const res = await http.get('/api/v1/dept/list', {
    params: {
      deptName: params.keyword || undefined,
      status: params.status || undefined,
      parentId: params.parentId || undefined,
    },
  })
  const body = (res as any).data || {}
  // 部门列表不分页, 后端返回 data 为数组
  return toDataResult(body.data || [], body.msg) as unknown as ApiResponse<AdminDept[]>
}

/** 部门详情 */
export async function deptDetail(deptId: number): Promise<ApiResponse<AdminDept | null>> {
  const res = await http.get(`/api/v1/dept/${deptId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminDept | null>
}

/** 新增部门 */
export async function deptCreate(payload: Partial<AdminDept>): Promise<ApiResponse<AdminDept>> {
  const res = await http.post('/api/v1/dept', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminDept>
}

/** 修改部门 */
export async function deptUpdate(payload: Partial<AdminDept> & { deptId: number }): Promise<ApiResponse<AdminDept>> {
  const res = await http.put('/api/v1/dept', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminDept>
}

/** 删除部门 */
export async function deptDelete(deptId: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/dept/${deptId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 部门树 (下拉选择用, 后端返回 {id, label, children} 结构) */
export async function deptTreeSelect(): Promise<ApiResponse<AdminDept[]>> {
  const res = await http.get('/api/v1/dept/treeselect')
  const body = (res as any).data || {}
  return toDataResult(body.data || [], body.msg) as unknown as ApiResponse<AdminDept[]>
}

/** 排除自身的部门列表 (用于选择父部门) */
export async function deptListExcludeSelf(deptId: number): Promise<ApiResponse<AdminDept[]>> {
  const res = await http.get(`/api/v1/dept/list/exclude/${deptId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data || [], body.msg) as unknown as ApiResponse<AdminDept[]>
}

export const adminDeptApi = {
  deptList,
  deptDetail,
  deptCreate,
  deptUpdate,
  deptDelete,
  deptTreeSelect,
  deptListExcludeSelf,
}

export default adminDeptApi
