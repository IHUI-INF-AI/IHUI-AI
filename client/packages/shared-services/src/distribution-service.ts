import { API_ENDPOINTS } from '@aizhs/shared-api'
import type {
  ApiResponse,
  CommissionDetail,
  FlowItem,
  SubordinateItem,
  TraderStats,
  WithdrawalRequest,
  WithdrawalStatus,
} from '@aizhs/shared-types'
import type { SharedRequestAdapter } from './request-adapter'
import { normalizeApiResponse } from './request-adapter'

export async function getTraderStatistics(
  adapter: SharedRequestAdapter,
  token?: string,
): Promise<ApiResponse<TraderStats>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.DISTRIBUTION.TRADER_STATISTICS,
    method: 'GET',
    data: token ? { token } : {},
  })

  return normalizeApiResponse<TraderStats>(response)
}

export async function getTraderTeam(
  adapter: SharedRequestAdapter,
  params: { token?: string; begin?: string; end?: string; pageNum?: number; pageSize?: number },
): Promise<ApiResponse<PageResult<SubordinateItem>>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.DISTRIBUTION.TRADER_TEAM,
    method: 'GET',
    data: { ...params },
  })

  return normalizeApiResponse(response)
}

export async function getSubordinates(
  adapter: SharedRequestAdapter,
  params: { open_id: string; page: number; quantity: number },
): Promise<ApiResponse<SubordinateItem[]>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.DISTRIBUTION.SUBORDINATES,
    method: 'POST',
    data: { ...params },
  })

  return normalizeApiResponse<SubordinateItem[]>(response)
}

export async function getUserAndChildrenOrders(
  adapter: SharedRequestAdapter,
  params: { id: string | number; page: number; quantity: number },
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.DISTRIBUTION.CHILDREN_ORDERS,
    method: 'POST',
    data: { ...params },
  })

  return normalizeApiResponse(response)
}

export async function getCommissionDetail(
  adapter: SharedRequestAdapter,
  userId: string,
): Promise<ApiResponse<CommissionDetail>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.DISTRIBUTION.COMMISSION_DETAIL,
    method: 'GET',
    data: { user_id: userId },
  })

  return normalizeApiResponse<CommissionDetail>(response)
}

export async function getFlowList(
  adapter: SharedRequestAdapter,
  tokenUuid: string,
): Promise<ApiResponse<FlowItem[]>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.DISTRIBUTION.FLOW_LIST,
    method: 'GET',
    data: { tokenUuid },
  })

  return normalizeApiResponse<FlowItem[]>(response)
}

export async function getFlowOrderList(
  adapter: SharedRequestAdapter,
  params: { pageNum: number; pageSize: number; openId?: string },
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.DISTRIBUTION.FLOW_ORDER_LIST,
    method: 'GET',
    data: { ...params },
  })

  return normalizeApiResponse(response)
}

export async function submitWithdrawal(
  adapter: SharedRequestAdapter,
  params: WithdrawalRequest,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.DISTRIBUTION.WITHDRAWAL,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    data: { ...params },
  })

  return normalizeApiResponse(response)
}

export async function getWithdrawalStatus(
  adapter: SharedRequestAdapter,
  params: { nickname?: string; token?: string; openId?: string },
): Promise<ApiResponse<WithdrawalStatus>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.DISTRIBUTION.WITHDRAWAL_STATUS,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    data: { ...params },
  })

  return normalizeApiResponse<WithdrawalStatus>(response)
}

export async function getWxCode(
  adapter: SharedRequestAdapter,
  inviteCode: string,
  back?: string,
): Promise<ApiResponse<string>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.DISTRIBUTION.GET_WX_CODE,
    method: 'GET',
    data: { invite_code: inviteCode, back: back || '' },
  })

  return normalizeApiResponse<string>(response)
}

interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages?: number
}
