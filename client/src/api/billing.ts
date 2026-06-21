/**
 * API消费账单管理API
 */
import { request } from '@/utils/request'
import type { ApiResponse } from '@/types/api'

export interface BillingRecord {
  id: string
  appId?: string
  appName?: string
  apiKeyId?: string
  apiKeyName?: string
  model: string
  endpoint: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
  status: 'success' | 'error' | 'timeout'
  requestTime: string
  responseTime?: string
  latency?: number
  errorMessage?: string
}

export interface BillingStats {
  totalCost: number
  todayCost: number
  monthCost: number
  totalRecords: number
  todayRecords: number
  monthRecords: number
  avgCostPerRequest: number
  topApp?: {
    id: string
    name: string
    cost: number
  }
  topModel?: {
    name: string
    cost: number
  }
}

export interface BillingTrend {
  date: string
  cost: number
  records: number
}

// 后端响应格式：{ code, msg, data: { list: [], total: number } }
export interface BillingListResponse {
  list: BillingRecord[]
  total: number
}

export interface BillingTrendResponse {
  list: BillingTrend[]
}

/**
 * 获取消费记录列表
 * 后端路径: GET /zhs_api_billing/records
 * 响应格式: { code, msg, data: { list: [], total: number } }
 */
export async function getBillingRecords(params?: {
  page?: number
  pageSize?: number
  startDate?: string
  endDate?: string
  appId?: string
  apiKeyId?: string
  model?: string
  status?: string
}): Promise<ApiResponse<BillingListResponse>> {
  return request.get('/zhs_api_billing/records', { params })
}

/**
 * 获取费用统计
 * 后端路径: GET /zhs_api_billing/stats
 */
export async function getBillingStats(params?: {
  startDate?: string
  endDate?: string
  appId?: string
}): Promise<ApiResponse<BillingStats>> {
  return request.get('/zhs_api_billing/stats', { params })
}

/**
 * 获取消费趋势
 * 后端路径: GET /zhs_api_billing/trend
 */
export async function getBillingTrend(params?: {
  startDate?: string
  endDate?: string
  granularity?: 'day' | 'week' | 'month'
  appId?: string
}): Promise<ApiResponse<BillingTrendResponse>> {
  return request.get('/zhs_api_billing/trend', { params })
}

/**
 * 导出账单
 * 后端路径: GET /zhs_api_billing/export
 */
export async function exportBilling(params?: {
  startDate?: string
  endDate?: string
  appId?: string
  format?: 'excel' | 'csv'
}): Promise<Blob> {
  const response = await request.get('/zhs_api_billing/export', {
    params,
    responseType: 'blob',
  })
  return response as unknown as Blob
}
