import request from '../utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '../utils/apiResponseHandler'
import type { ApiResponse } from '@/types/api'

/**
 * Token使用请求参数
 */
export interface UseTokenParams {
  amount: number
  description?: string
  [key: string]: unknown
}

/**
 * Token使用响应
 */
export interface UseTokenResponse {
  success: boolean
  remainingTokens: number
  usedTokens: number
}

export const useToken = withApiResponseHandler(
  async (data: UseTokenParams): Promise<ApiResponse<UseTokenResponse>> => {
    const response = await request.post<UseTokenResponse>('/fund/useToken', data)
    return normalizeApiResponse(response)
  }
)

/**
 * 资金通知参数
 */
export interface FundNotifyParams {
  orderNo: string
  amount: number
  status: string
  [key: string]: unknown
}

/**
 * 资金通知响应
 */
export interface FundNotifyResponse {
  success: boolean
  orderNo: string
  message?: string
}

export const fundNotify = withApiResponseHandler(
  async (data: FundNotifyParams): Promise<ApiResponse<FundNotifyResponse>> => {
    const response = await request.post<FundNotifyResponse>('/fund/notify', data)
    return normalizeApiResponse(response)
  }
)

/**
 * 文件流响应
 */
export interface FileStreamResponse {
  streamId: string
  url?: string
  [key: string]: unknown
}

export const fileToStream = withApiResponseHandler(
  async (data: FormData): Promise<ApiResponse<FileStreamResponse>> => {
    const response = await request.post<FileStreamResponse>('/fund/file/to/stream', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return normalizeApiResponse(response)
  }
)

export const fileToStream2 = withApiResponseHandler(
  async (data: FormData): Promise<ApiResponse<FileStreamResponse>> => {
    const response = await request.post<FileStreamResponse>('/fund/file/to/stream2', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return normalizeApiResponse(response)
  }
)

/**
 * 应用通知参数
 */
export interface AppNotifyParams {
  appId: string
  orderNo: string
  amount: number
  [key: string]: unknown
}

export const appNotify = withApiResponseHandler(
  async (data: AppNotifyParams): Promise<ApiResponse<{ success: boolean }>> => {
    const response = await request.post<{ success: boolean }>('/fund/app/notify', data)
    return normalizeApiResponse(response)
  }
)

/**
 * 智能体转账通知参数
 */
export interface AgentTransferNotifyParams {
  agentId: string
  userId: string
  amount: number
  [key: string]: unknown
}

export const agentTransferNotify = withApiResponseHandler(
  async (data: AgentTransferNotifyParams): Promise<ApiResponse<{ success: boolean }>> => {
    const response = await request.post<{ success: boolean }>('/fund/agent/transfer/notify', data)
    return normalizeApiResponse(response)
  }
)

/**
 * 资金统计响应
 */
export interface FundStatistics {
  totalBalance: number
  totalIncome: number
  totalExpense: number
  [key: string]: unknown
}

export const getFundStatistics = withApiResponseHandler(
  async (params?: { startDate?: string; endDate?: string }): Promise<ApiResponse<FundStatistics>> => {
    const response = await request.get<FundStatistics>('/fund/getStatistics', { params })
    return normalizeApiResponse(response)
  }
)

/**
 * 资金产品信息
 */
export interface FundProduct {
  id: string
  name: string
  price: number
  [key: string]: unknown
}

export const getFundProduct = withApiResponseHandler(
  async (params?: { productId?: string }): Promise<ApiResponse<FundProduct[]>> => {
    const response = await request.get<FundProduct[]>('/fund/getProduct', { params })
    return normalizeApiResponse(response)
  }
)

/**
 * 资金信息
 */
export interface FundInfo {
  balance: number
  frozenAmount: number
  availableAmount: number
  [key: string]: unknown
}

export const getFundInfo = withApiResponseHandler(
  async (params?: { userId?: string }): Promise<ApiResponse<FundInfo>> => {
    const response = await request.get<FundInfo>('/fund/getInfo', { params })
    return normalizeApiResponse(response)
  }
)
