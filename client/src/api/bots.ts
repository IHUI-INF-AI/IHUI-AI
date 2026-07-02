/**
 * Coze Bot 管理 API
 * 对接后端: app/api/v1/bots/bots.py
 * 路由前缀: /api/v1/bots
 *
 * 后端列表响应为 {code, msg, data:[...], total},
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 * 注意: 后端 create/update/delete/publish 均使用 Query 参数传值。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface BotListParams {
  current?: number
  size?: number
  keyword?: string
  status?: string
  spaceId?: string
  [k: string]: unknown
}

export interface Bot {
  botId: string
  name: string
  description?: string
  status?: string
  ownerId?: string
  datasetIds?: string[]
  createTime?: string | null
  updateTime?: string | null
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

/** Bot 列表 */
export async function botList(params: BotListParams = {}): Promise<ApiResponse<PaginationResponse<Bot>>> {
  const res = await http.get('/api/v1/bots/list', {
    params: {
      page: params.current ?? 1,
      page_size: params.size ?? 20,
      space_id: params.spaceId || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<Bot>>
}

/** Bot 详情 */
export async function botDetail(botId: string): Promise<ApiResponse<Bot | null>> {
  const res = await http.get(`/api/v1/bots/${botId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<Bot | null>
}

/** 创建 Bot (后端使用 Query 参数) */
export async function botCreate(payload: { name: string; description?: string; persona?: string }): Promise<ApiResponse<Bot>> {
  const res = await http.post('/api/v1/bots/create', null, {
    params: {
      name: payload.name,
      description: payload.description || '',
      persona: payload.persona || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<Bot>
}

/** 修改 Bot (后端使用 Query 参数; 后端使用 POST 而非 PUT) */
export async function botUpdate(botId: string, payload: { name?: string; description?: string; persona?: string }): Promise<ApiResponse<Bot>> {
  const res = await http.post('/api/v1/bots/update', null, {
    params: {
      bot_id: botId,
      name: payload.name || undefined,
      description: payload.description || undefined,
      persona: payload.persona || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<Bot>
}

/** 删除 Bot (后端使用 Query 参数; 后端使用 POST 而非 DELETE) */
export async function botDelete(botId: string): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/bots/delete', null, {
    params: { bot_id: botId },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 发布 Bot (后端使用 Query 参数) */
export async function botPublish(botId: string): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/bots/publish', null, {
    params: { bot_id: botId },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** Bot 关联知识库列表 */
export async function botDatasetsList(params: BotListParams = {}): Promise<ApiResponse<PaginationResponse<unknown>>> {
  const res = await http.get('/api/v1/bots/datasets/list', {
    params: {
      page: params.current ?? 1,
      page_size: params.size ?? 20,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<unknown>>
}

export const botsApi = {
  botList,
  botDetail,
  botCreate,
  botUpdate,
  botDelete,
  botPublish,
  botDatasetsList,
}

export default botsApi
