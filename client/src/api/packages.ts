/**
 * 套餐管理API
 */
import { request } from '@/utils/request'
import type { ApiResponse } from '@/types/api'

export interface Package {
  id: string
  name: string
  description?: string
  price: number
  quota: number
  usedQuota: number
  remainingQuota: number
  status: 'active' | 'expired' | 'suspended'
  startDate: string
  endDate: string
  createdAt: string
  updatedAt: string
  appIds?: string[] // 关联的应用ID列表
  apps?: Array<{ id: string; name: string }> // 关联的应用列表（用于显示）
}

export interface PackageUsage {
  date: string
  used: number
  remaining: number
}

// 后端响应格式：{ code, msg, data: { list: [], total: number } }
export interface PackageListResponse {
  list: Package[]
  total: number
}

/**
 * 获取套餐列表
 * 后端路径: GET /zhs_api_package/list
 * 响应格式: { code, msg, data: { list: [], total: number } }
 */
export async function getPackages(params?: {
  page?: number
  pageSize?: number
  status?: string
}): Promise<ApiResponse<PackageListResponse>> {
  return request.get('/zhs_api_package/list', { params })
}

/**
 * 获取所有可用套餐（用于升级选择）
 * 后端路径: GET /zhs_api_package/list?status=active&pageSize=100
 */
export async function getAllAvailablePackages(): Promise<ApiResponse<PackageListResponse>> {
  return request.get('/zhs_api_package/list', {
    params: {
      status: 'active',
      pageSize: 100,
    },
  })
}

/**
 * 获取套餐详情
 * 后端路径: GET /zhs_api_package/{id}
 */
export async function getPackage(id: string): Promise<ApiResponse<Package>> {
  return request.get(`/zhs_api_package/${id}`)
}

/**
 * 获取套餐使用情况
 * 后端路径: GET /zhs_api_package/{id}/usage
 */
export async function getPackageUsage(
  id: string,
  params?: {
    startDate?: string
    endDate?: string
  }
): Promise<ApiResponse<PackageUsage[]>> {
  return request.get(`/zhs_api_package/${id}/usage`, { params })
}

/**
 * 升级套餐
 * 后端路径: POST /zhs_api_package/{id}/upgrade
 */
export async function upgradePackage(
  packageId: string,
  targetPackageId: string
): Promise<ApiResponse<Package>> {
  return request.post(`/zhs_api_package/${packageId}/upgrade`, {
    targetPackageId,
  })
}

/**
 * 降级套餐
 * 后端路径: POST /zhs_api_package/{id}/downgrade
 */
export async function downgradePackage(
  packageId: string,
  targetPackageId: string
): Promise<ApiResponse<Package>> {
  return request.post(`/zhs_api_package/${packageId}/downgrade`, {
    targetPackageId,
  })
}

/**
 * 关联应用到套餐
 * 后端路径: POST /zhs_api_package/{id}/apps
 */
export async function linkAppsToPackage(
  packageId: string,
  appIds: string[]
): Promise<ApiResponse<Package>> {
  return request.post(`/zhs_api_package/${packageId}/apps`, { appIds })
}

/**
 * 解绑应用
 * 后端路径: DELETE /zhs_api_package/{id}/apps/{appId}
 */
export async function unlinkAppFromPackage(
  packageId: string,
  appId: string
): Promise<ApiResponse<void>> {
  return request.delete(`/zhs_api_package/${packageId}/apps/${appId}`)
}

/**
 * 获取套餐关联的应用列表
 * 后端路径: GET /zhs_api_package/{id}/apps
 */
export async function getPackageApps(
  packageId: string,
  params?: {
    page?: number
    pageSize?: number
  }
): Promise<ApiResponse<PackageListResponse>> {
  return request.get(`/zhs_api_package/${packageId}/apps`, { params })
}

/**
 * 获取套餐使用情况（按应用统计）
 * 后端路径: GET /zhs_api_package/{id}/usage/by-app
 */
export async function getPackageUsageByApp(
  packageId: string,
  params?: {
    startDate?: string
    endDate?: string
  }
): Promise<ApiResponse<Array<{
  appId: string
  appName: string
  used: number
  percentage: number
}>>> {
  return request.get(`/zhs_api_package/${packageId}/usage/by-app`, { params })
}
