/**
 * 资源上下文 API (保存 / 获取 / 字段 / 代理 / 查询 / 采样 / 历史)
 * 对接后端: resource/context 模块
 * 路由前缀: /api/v1/resource/context
 *
 * 注意: save/remove/field/query/history 接口使用 Body 传值, 其余使用 Query 参数。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface ContextData {
  agentId: string
  contextKey: string
  data?: unknown
  createTime?: string | null
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
// 资源上下文操作
// ===========================================================================

/** 保存上下文 (Body 传值) */
export async function resourceContextSave(data: {
  agentId: string
  contextKey: string
  data?: unknown
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/resource/context/save', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 获取上下文 (后端使用 Query 参数) */
export async function resourceContextGet(params: {
  agentId: string
  contextKey: string
}): Promise<ApiResponse<ContextData | null>> {
  const res = await http.get('/api/v1/resource/context/get', {
    params: {
      agentId: params.agentId,
      contextKey: params.contextKey,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<ContextData | null>
}

/** 获取字段 (后端使用 Query 参数) */
export async function resourceContextGetField(params: {
  agentId: string
  fieldName: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/resource/context/field', {
    params: {
      agentId: params.agentId,
      fieldName: params.fieldName,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 移除字段 (Body 传值) */
export async function resourceContextRemoveField(data: {
  agentId: string
  fieldName: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/resource/context/remove/field', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 获取代理上下文 */
export async function resourceContextGetAgent(agentId: string): Promise<ApiResponse<unknown>> {
  const res = await http.get(`/api/v1/resource/context/agent/${agentId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 查询上下文 (Body 传值) */
export async function resourceContextQuery(data: { [k: string]: unknown }): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/resource/context/query', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 获取样本 (后端使用 Query 参数) */
export async function resourceContextGetSample(limit?: number): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/resource/context/sample', {
    params: { limit: limit ?? undefined },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 获取历史 (Body 传值) */
export async function resourceContextGetHistory(data: { [k: string]: unknown }): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/resource/context/history', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const resourceContextApi = {
  resourceContextSave,
  resourceContextGet,
  resourceContextGetField,
  resourceContextRemoveField,
  resourceContextGetAgent,
  resourceContextQuery,
  resourceContextGetSample,
  resourceContextGetHistory,
}

export default resourceContextApi