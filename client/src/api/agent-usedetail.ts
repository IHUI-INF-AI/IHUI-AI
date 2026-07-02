/**
 * 代理商使用明细 API
 * 对接后端: app/api/v1/agent_usedetail/agent_usedetail.py
 * 路由前缀: /api/v1/agent-usedetail
 *
 * 后端列表响应为 {code, msg, data:[...], total},
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

/** Agent 使用明细记录 */
export interface AgentUsageDetail {
  id: number
  agentId: string
  userId: string
  type: string
  createTime?: string | null
}

/** 每日统计 */
export interface DailyStat {
  date: string
  count: number
  uniqueUsers: number
}

/** 汇总统计 */
export interface SummaryStat {
  totalCount: number
  totalUsers: number
  avgDailyCount: number
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
// 使用明细
// ===========================================================================

/** 记录 Agent 使用明细 (后端使用 Query 参数) */
export async function agentUsedetailRecord(params: {
  agentId: string
  userId: string
  type: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/agent-usedetail/record', null, {
    params: {
      agent_id: params.agentId,
      user_id: params.userId,
      type: params.type,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 使用明细列表 */
export async function agentUsedetailList(params: {
  page?: number
  limit?: number
  agentId?: string
}): Promise<ApiResponse<PaginationResponse<AgentUsageDetail>>> {
  const res = await http.get('/api/v1/agent-usedetail/list', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      agent_id: params.agentId || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<AgentUsageDetail>>
}

/** 每日统计 */
export async function agentUsedetailDailyStats(params: {
  agentId: string
  startDate: string
  endDate: string
}): Promise<ApiResponse<DailyStat[]>> {
  const res = await http.get('/api/v1/agent-usedetail/stats/daily', {
    params: {
      agent_id: params.agentId,
      start_date: params.startDate,
      end_date: params.endDate,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<DailyStat[]>
}

/** 汇总统计 */
export async function agentUsedetailSummaryStats(params: {
  agentId: string
  startDate: string
  endDate: string
}): Promise<ApiResponse<SummaryStat | null>> {
  const res = await http.get('/api/v1/agent-usedetail/stats/summary', {
    params: {
      agent_id: params.agentId,
      start_date: params.startDate,
      end_date: params.endDate,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<SummaryStat | null>
}

export const agentUsedetailApi = {
  agentUsedetailRecord,
  agentUsedetailList,
  agentUsedetailDailyStats,
  agentUsedetailSummaryStats,
}

export default agentUsedetailApi