/**
 * 应用分组管理API
 */
import { request } from '@/utils/request'
import type { ApiResponse } from '@/types/api'

export interface ApiGroup {
  id: string
  name: string
  type: 'basic' | 'standard' | 'premium' | 'enterprise'
  description?: string
  models: string[] // 支持的模型ID列表
  maxConcurrent: number // 最大并发数
  rateLimit: number // 速率限制（每分钟请求数）
  avgLatency?: number // 平均延迟（毫秒）
  status: 'active' | 'inactive'
  appCount: number // 关联的应用数量
  createdAt: string
  updatedAt: string
}

export interface CreateGroupRequest {
  name: string
  type: 'basic' | 'standard' | 'premium' | 'enterprise'
  description?: string
  models?: string[]
  maxConcurrent?: number
  rateLimit?: number
}

export interface UpdateGroupRequest {
  name?: string
  description?: string
  models?: string[]
  maxConcurrent?: number
  rateLimit?: number
  status?: 'active' | 'inactive'
}

// 后端响应格式：{ code, msg, data: { list: [], total: number } }
export interface GroupListResponse {
  list: ApiGroup[]
  total: number
}

/**
 * 获取分组列表
 * 后端路径: GET /zhs_api_group/list
 * 响应格式: { code, msg, data: { list: [], total: number } }
 */
export async function getGroups(params?: {
  page?: number
  pageSize?: number
  type?: string
  status?: string
}): Promise<ApiResponse<GroupListResponse>> {
  return request.get('/zhs_api_group/list', { params })
}

/**
 * 获取分组详情
 * 后端路径: GET /zhs_api_group/{id}
 */
export async function getGroup(id: string): Promise<ApiResponse<ApiGroup>> {
  return request.get(`/zhs_api_group/${id}`)
}

/**
 * 创建分组
 * 后端路径: POST /zhs_api_group
 */
export async function createGroup(data: CreateGroupRequest): Promise<ApiResponse<ApiGroup>> {
  return request.post('/zhs_api_group', data)
}

/**
 * 更新分组
 * 后端路径: PUT /zhs_api_group
 */
export async function updateGroup(id: string, data: UpdateGroupRequest): Promise<ApiResponse<ApiGroup>> {
  return request.put('/zhs_api_group', { id, ...data })
}

/**
 * 删除分组
 * 后端路径: DELETE /zhs_api_group/{id}
 */
export async function deleteGroup(id: string): Promise<ApiResponse<void>> {
  return request.delete(`/zhs_api_group/${id}`)
}

/**
 * 获取分组下的应用列表
 * 后端路径: GET /zhs_api_group/{id}/apps
 */
export async function getGroupApps(id: string, params?: {
  page?: number
  pageSize?: number
}): Promise<ApiResponse<GroupListResponse>> {
  return request.get(`/zhs_api_group/${id}/apps`, { params })
}
