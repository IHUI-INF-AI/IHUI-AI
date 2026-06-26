/**
 * 开发者管理 API
 * 对接后端:
 *   - app/api/v1/agents/developer.py        路由前缀 /api/v1/agents/developer
 *   - app/api/v1/agents/developer_link.py   路由前缀 /api/v1/developerLink
 *
 * 后端 developer 列表返回 {code, msg, data:[...], total};
 * developer_link 列表返回 {code, msg, data:{rows, total}}。
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 *
 * 注意: developer 表的 status 切换后端暂无独立端点, developerToggleStatus
 * 调用占位端点 /agents/developer/update-status, 待后端补充。
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

export interface DeveloperListParams {
  current?: number
  size?: number
  keyword?: string
  userId?: string
  status?: number
  [k: string]: unknown
}

export interface DeveloperItem {
  id: number
  agent_id: string
  user_id: string
  order_no?: string
  status: number
  price?: number
  uuid?: string
  user_name?: string
  type?: string
  expiration_date?: string | null
}

export interface DeveloperLinkItem {
  id: number
  user_id: string
  coze_account_id?: string | null
  coze_account_name?: string | null
  status: number
  created_at?: string | null
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
// 开发者 (AgentDeveloper)
// ===========================================================================

export async function developerList(params: DeveloperListParams = {}): Promise<ApiResponse<{ records: DeveloperItem[]; total: number }>> {
  const res = await http.get('/api/v1/agents/developer/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      user_id: params.userId || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<{ records: DeveloperItem[]; total: number }>
}

export async function developerDetail(recordId: number): Promise<ApiResponse<DeveloperItem | null>> {
  const res = await http.get(`/api/v1/agents/developer/${recordId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<DeveloperItem | null>
}

export async function developerCreate(payload: { agentId: string; price?: number; userId?: string }): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/agents/developer/create', null, {
    params: {
      agent_id: payload.agentId,
      price: payload.price ?? 0,
      user_id: payload.userId || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export async function developerUpdatePrice(payload: { agentId: string; price: number }): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/agents/developer/update-price', null, {
    params: { agent_id: payload.agentId, price: payload.price },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/**
 * 启用/禁用开发者。后端暂无独立 status 端点, 调用占位端点。
 * 后端补充 /agents/developer/update-status 后即可生效。
 */
export async function developerToggleStatus(payload: { agentId: string; userId: string; status: number }): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/agents/developer/update-status', null, {
    params: { agent_id: payload.agentId, user_id: payload.userId, status: payload.status },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

// ===========================================================================
// 开发者链接 (DeveloperLink)
// ===========================================================================

export async function developerLinkList(params: DeveloperListParams = {}): Promise<ApiResponse<{ records: DeveloperLinkItem[]; total: number }>> {
  const res = await http.get('/api/v1/developerLink/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      user_id: params.userId || undefined,
      status: params.status,
    },
  })
  const body = (res as any).data || {}
  const inner = body.data || {}
  const rows = Array.isArray(inner) ? inner : inner.rows || []
  const total = Array.isArray(inner) ? body.total || 0 : inner.total ?? body.total ?? 0
  return toListResult(rows, total, body.msg) as unknown as ApiResponse<{ records: DeveloperLinkItem[]; total: number }>
}

export async function developerLinkDetail(id: number): Promise<ApiResponse<DeveloperLinkItem | null>> {
  const res = await http.get(`/api/v1/developerLink/${id}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<DeveloperLinkItem | null>
}

export async function developerLinkCreate(payload: {
  userId: string
  cozeAccountId?: string | null
  cozeAccountName?: string | null
  status?: number
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/developerLink', {
    user_id: payload.userId,
    coze_account_id: payload.cozeAccountId ?? null,
    coze_account_name: payload.cozeAccountName ?? null,
    status: payload.status ?? 1,
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export async function developerLinkUpdate(payload: {
  id: number
  userId?: string
  cozeAccountId?: string | null
  cozeAccountName?: string | null
  status?: number
}): Promise<ApiResponse<unknown>> {
  const res = await http.put('/api/v1/developerLink', {
    id: payload.id,
    user_id: payload.userId,
    coze_account_id: payload.cozeAccountId,
    coze_account_name: payload.cozeAccountName,
    status: payload.status,
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export async function developerLinkDelete(ids: (string | number)[]): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/developerLink/${ids.join(',')}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export async function developerLinkAssign(payload: { id: string | number; cozeId: string }): Promise<ApiResponse<unknown>> {
  const res = await http.put('/api/v1/developerLink/assignAccount', { id: String(payload.id), cozeId: payload.cozeId })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const developerApi = {
  developerList,
  developerDetail,
  developerCreate,
  developerUpdatePrice,
  developerToggleStatus,
  developerLinkList,
  developerLinkDetail,
  developerLinkCreate,
  developerLinkUpdate,
  developerLinkDelete,
  developerLinkAssign,
}

export default developerApi
