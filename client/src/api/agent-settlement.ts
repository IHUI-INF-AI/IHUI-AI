import request from '../utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '../utils/apiResponseHandler'
import type { ApiResponse, PageResult } from '@/types/api'

export interface AgentSettlement {
  id?: string
  developerId?: string
  agentId?: string
  agent_name?: string
  order_no?: string
  amount?: number
  status?: number
  settlement?: string
  withdrawal?: string
  accountType?: string
  total?: number
  create_time?: string
  settlementDate?: string
  remark?: string
  createdAt?: string
  updatedAt?: string
}

export interface AgentSettlementListParams {
  page?: number
  pageSize?: number
  developerId?: string
  agentId?: string
  status?: number
  agent_name?: string
  settlement?: string
  uuid?: string
}

export const createAgentSettlement = withApiResponseHandler(
  async (data: AgentSettlement): Promise<ApiResponse<AgentSettlement>> => {
    const response = await request.post<AgentSettlement>('/agentSettlement', data)
    return normalizeApiResponse(response)
  }
)

export const updateAgentSettlement = withApiResponseHandler(
  async (data: AgentSettlement): Promise<ApiResponse<AgentSettlement>> => {
    const response = await request.put<AgentSettlement>('/agentSettlement', data)
    return normalizeApiResponse(response)
  }
)

export const exportAgentSettlement = withApiResponseHandler(
  async (params?: AgentSettlementListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/agentSettlement/export', params, { responseType: 'blob' })
    return normalizeApiResponse(response)
  }
)

export const getAgentSettlementById = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AgentSettlement>> => {
    const response = await request.get<AgentSettlement>(`/agentSettlement/${id}`)
    return normalizeApiResponse(response)
  }
)

export const getAgentSettlementList = withApiResponseHandler(
  async (params?: AgentSettlementListParams): Promise<ApiResponse<PageResult<AgentSettlement>>> => {
    const response = await request.get<PageResult<AgentSettlement>>('/agentSettlement/list', { params })
    return normalizeApiResponse(response)
  }
)

export const deleteAgentSettlement = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/agentSettlement/${idsString}`)
    return normalizeApiResponse(response)
  }
)

// 别名导出，保持向后兼容
export const getSettlementList = getAgentSettlementList
export const getSettlementDetail = getAgentSettlementById
export const deleteSettlement = deleteAgentSettlement

// 批量删除结算单
export const batchDeleteSettlement = withApiResponseHandler(
  async (ids: string[]): Promise<ApiResponse<void>> => {
    const idsStr = ids.join(',')
    const response = await request.delete<void>(`/agentSettlement/${idsStr}`)
    return normalizeApiResponse(response)
  }
)

// 获取结算概览
export interface SettlementOverview {
  total_settlements?: number
  total_amount?: number
  settled_count?: number
  unsettled_count?: number
}

export const getSettlementOverview = withApiResponseHandler(
  async (): Promise<ApiResponse<SettlementOverview>> => {
    // 如果没有专门的概览接口，可以通过列表接口计算
    // 这里假设后端有专门的概览接口，如果没有则需要调整
    const response = await request.get<SettlementOverview>('/agentSettlement/overview')
    return normalizeApiResponse(response)
  }
)

// 同步现有订单到结算单
export interface SyncToSettlementParams {
  start_date?: string
  end_date?: string
  agent_order_uuid?: string
}

export const syncExistingToSettlement = withApiResponseHandler(
  async (params: SyncToSettlementParams): Promise<ApiResponse<void>> => {
    const response = await request.post<void>('/agentSettlement/sync', params)
    return normalizeApiResponse(response)
  }
)

// 获取收入概览（用于用户统计）
export interface IncomeOverview {
  total_income?: number
  settled_income?: number
  unsettled_income?: number
  month_income?: number
  todayAccount?: number
  PendingSettlement?: number
  WithdrawableAmount?: number
  WithdrawnAmount?: number
  AccumulatedIncome?: number
}

export const getIncomeOverview = withApiResponseHandler(
  async (uuid?: string): Promise<ApiResponse<IncomeOverview>> => {
    const params = uuid ? { uuid } : undefined
    const response = await request.get<IncomeOverview>('/agentSettlement/income/overview', { params })
    return normalizeApiResponse(response)
  }
)

// 结算
export const settleAgentSettlement = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AgentSettlement>> => {
    const response = await request.post<AgentSettlement>(`/agentSettlement/${id}/settle`)
    return normalizeApiResponse(response)
  }
)

// 提现
export const withdrawAgentSettlement = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AgentSettlement>> => {
    const response = await request.post<AgentSettlement>(`/agentSettlement/${id}/withdraw`)
    return normalizeApiResponse(response)
  }
)
