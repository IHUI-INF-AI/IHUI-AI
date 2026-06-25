/**
 * 应用管理API
 */
import { request } from '@/utils/request'
import type { ApiResponse } from '@/types/api'

export interface App {
  id: string
  name: string
  description?: string
  status: 'active' | 'inactive' | 'suspended'
  groupId?: string // 关联的分组ID
  groupName?: string // 分组名称（用于显示）
  packageId?: string // 使用的套餐ID
  packageName?: string // 套餐名称（用于显示）
  createdAt: string
  updatedAt: string
  apiKeyCount: number
  requestCount: number
  lastUsedAt?: string
}

export interface CreateAppRequest {
  name: string
  description?: string
}

export interface UpdateAppRequest {
  name?: string
  description?: string
  status?: 'active' | 'inactive'
  groupId?: string // 关联的分组ID
}

// 后端响应格式：{ code, msg, data: { list: [], total: number } }
export interface AppListResponse {
  list: App[]
  total: number
}

/**
 * 获取应用列表
 * 后端路径: GET /zhs_api_app/list
 * 响应格式: { code, msg, data: { list: [], total: number } }
 */
export async function getApps(params?: {
  page?: number
  pageSize?: number
  status?: string
}): Promise<ApiResponse<AppListResponse>> {
  return request.get('/zhs_api_app/list', { params })
}

/**
 * 获取应用详情
 * 后端路径: GET /zhs_api_app/{id}
 */
export async function getApp(id: string): Promise<ApiResponse<App>> {
  return request.get(`/zhs_api_app/${id}`)
}

/**
 * 创建应用
 * 后端路径: POST /zhs_api_app
 */
export async function createApp(data: CreateAppRequest): Promise<ApiResponse<App>> {
  return request.post('/zhs_api_app', data)
}

/**
 * 更新应用
 * 后端路径: PUT /zhs_api_app
 */
export async function updateApp(id: string, data: UpdateAppRequest): Promise<ApiResponse<App>> {
  // 后端PUT接口需要传递完整对象，包含id
  return request.put('/zhs_api_app', { id, ...data })
}

/**
 * 删除应用
 * 后端路径: DELETE /zhs_api_app/{ids} (支持批量删除，逗号分隔)
 */
export async function deleteApp(id: string): Promise<ApiResponse<void>> {
  return request.delete(`/zhs_api_app/${id}`)
}

/**
 * 获取应用统计信息
 * 后端路径: GET /zhs_api_app/{id}/stats
 */
export async function getAppStats(id: string, params?: {
  startDate?: string
  endDate?: string
}): Promise<ApiResponse<{
  totalRequests: number
  totalTokens: number
  totalCost: number
  successRate: number
  errorCount: number
}>> {
  return request.get(`/zhs_api_app/${id}/stats`, { params })
}
