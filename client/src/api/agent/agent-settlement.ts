import request from '../../utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '../../utils/apiResponseHandler'
import type { ApiResponse, PageResult } from '@/types/api'

/**
 * Agent 结算管理 API
 *
 * 2026-06-25 修复#P: 路径对齐到 Python 后端真实路由.
 *   后端真实路由 (server/app/api/v1/agents/settlement.py):
 *     GET  /api/v1/agents/settlement/list      - 结算列表 (page/limit/settlement_status)
 *     GET  /api/v1/agents/settlement/summary    - 结算汇总
 *     POST /api/v1/agents/settlement/settle     - 触发结算 (Query settlement_id)
 *     GET  /api/v1/agents/settlement/unsettled  - 未结算记录
 *
 *   后端无对应的函数 (create/update/export/byId/delete/sync/withdraw) 保留旧路径,
 *   调用会 404, 后续需新增后端路由 (属新功能, 封版阶段不做).
 */

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

// 后端无对应路由, 保留旧路径. 调用会 404, 后续需新增后端 POST /api/v1/agents/settlement/create.
export const createAgentSettlement = withApiResponseHandler(
  async (data: AgentSettlement): Promise<ApiResponse<AgentSettlement>> => {
    const response = await request.post<AgentSettlement>('/agentSettlement', data)
    return normalizeApiResponse(response)
  }
)

// 后端无对应路由, 保留旧路径. 调用会 404, 后续需新增后端 PUT /api/v1/agents/settlement/{id}.
export const updateAgentSettlement = withApiResponseHandler(
  async (data: AgentSettlement): Promise<ApiResponse<AgentSettlement>> => {
    const response = await request.put<AgentSettlement>('/agentSettlement', data)
    return normalizeApiResponse(response)
  }
)

// 后端无对应路由, 保留旧路径. 调用会 404, 后续需新增后端 POST /api/v1/agents/settlement/export.
export const exportAgentSettlement = withApiResponseHandler(
  async (params?: AgentSettlementListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/agentSettlement/export', params, { responseType: 'blob' })
    return normalizeApiResponse(response)
  }
)

// 后端无对应路由, 保留旧路径. 调用会 404, 后续需新增后端 GET /api/v1/agents/settlement/{id}.
export const getAgentSettlementById = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AgentSettlement>> => {
    const response = await request.get<AgentSettlement>(`/agentSettlement/${id}`)
    return normalizeApiResponse(response)
  }
)

// 2026-06-25 修复#P: 对齐到 Python 后端真实端点 /api/v1/agents/settlement/list.
//   后端参数: page/limit/settlement_status, user_uuid 从 token 取.
//   前端传 pageSize/developerId/agentId/status 等, 字段名不同, 后续需对齐参数.
export const getAgentSettlementList = withApiResponseHandler(
  async (params?: AgentSettlementListParams): Promise<ApiResponse<PageResult<AgentSettlement>>> => {
    const response = await request.get<PageResult<AgentSettlement>>('/api/v1/agents/settlement/list', { params })
    return normalizeApiResponse(response)
  }
)

// 后端无对应路由, 保留旧路径. 调用会 404, 后续需新增后端 DELETE /api/v1/agents/settlement/{id}.
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

// 后端无对应路由, 保留旧路径. 调用会 404, 后续需新增后端 DELETE /api/v1/agents/settlement/batch.
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

// 2026-06-25 修复#P: 对齐到 Python 后端真实端点 /api/v1/agents/settlement/summary.
//   后端返回 {total_settlements, settled_count, unsettled_count}, 无 total_amount.
export const getSettlementOverview = withApiResponseHandler(
  async (): Promise<ApiResponse<SettlementOverview>> => {
    const response = await request.get<SettlementOverview>('/api/v1/agents/settlement/summary')
    return normalizeApiResponse(response)
  }
)

// 同步现有订单到结算单
export interface SyncToSettlementParams {
  start_date?: string
  end_date?: string
  agent_order_uuid?: string
}

// 后端无对应路由, 保留旧路径. 调用会 404, 后续需新增后端 POST /api/v1/agents/settlement/sync.
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

// 2026-06-25 修复#P: 对齐到 Python 后端真实端点 /api/v1/agents/settlement/summary.
//   后端无 income/overview, 用 /summary 等价 (都是收入汇总).
//   后端返回 {total_settlements, settled_count, unsettled_count}, 前端期望 IncomeOverview 字段不同,
//   后续需对齐返回结构.
export const getIncomeOverview = withApiResponseHandler(
  async (uuid?: string): Promise<ApiResponse<IncomeOverview>> => {
    const params = uuid ? { uuid } : undefined
    const response = await request.get<IncomeOverview>('/api/v1/agents/settlement/summary', { params })
    return normalizeApiResponse(response)
  }
)

// 2026-06-25 修复#P: 对齐到 Python 后端真实端点 /api/v1/agents/settlement/settle.
//   后端 POST /settle 接受 Query 参数 settlement_id, 前端传 path {id}, 已改为 Query.
export const settleAgentSettlement = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AgentSettlement>> => {
    const response = await request.post<AgentSettlement>('/api/v1/agents/settlement/settle', null, { params: { settlement_id: id } })
    return normalizeApiResponse(response)
  }
)

// 后端无对应路由, 保留旧路径. 调用会 404, 后续需新增后端 POST /api/v1/agents/settlement/{id}/withdraw.
export const withdrawAgentSettlement = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AgentSettlement>> => {
    const response = await request.post<AgentSettlement>(`/agentSettlement/${id}/withdraw`)
    return normalizeApiResponse(response)
  }
)
