/**
 * IM 渠道管理 API 端点(2026-07-31 立,P0 admin/im-channels 配套)。
 *
 * 对接后端 apps/api 路由 /api/im-gateway/*,覆盖 16 平台元数据查询、
 * 适配器配置 upsert、连接状态查询、消息历史分页与出站测试发送。
 *
 * 类型契约来源:@ihui/types(im-gateway.ts),禁止在端内重新声明同名类型。
 */
import type {
  ImAdapterConfig,
  ImAdapterUpsertInput,
  ImGatewayStatus,
  ImMessageHistoryItem,
  ImMessageType,
  ImPlatform,
  ImPlatformMeta,
} from '@ihui/types'
import { fetchApi } from '../client'

/** 消息历史分页响应(GET /api/im-gateway/messages) */
export interface ImMessageHistoryPage {
  items: ImMessageHistoryItem[]
  total: number
  limit: number
  offset: number
}

/** fetchImMessages 查询参数 */
export interface FetchImMessagesParams {
  platform?: ImPlatform
  direction?: 'inbound' | 'outbound'
  limit?: number
  offset?: number
}

/** sendImMessage 入参(POST /api/im-gateway/send) */
export interface SendImMessageInput {
  platform: ImPlatform
  chatId: string
  text?: string
  messageType?: ImMessageType
}

/** sendImMessage 响应 */
export interface SendImMessageResult {
  sent: boolean
  platform: ImPlatform
  chatId: string
  error?: string
}

/** 获取 16 平台元数据(含 displayName / icon / fields schema)— GET /api/im-gateway/platforms */
export async function fetchImPlatforms(): Promise<ImPlatformMeta[]> {
  const res = await fetchApi<ImPlatformMeta[]>('/im-gateway/platforms', { method: 'GET' })
  if (!res.success) {
    throw new Error(res.error || '获取 IM 平台元数据失败')
  }
  return res.data ?? []
}

/** 获取当前用户已配置的适配器列表 — GET /api/im-gateway/adapters */
export async function fetchImAdapters(): Promise<ImAdapterConfig[]> {
  const res = await fetchApi<ImAdapterConfig[]>('/im-gateway/adapters', { method: 'GET' })
  if (!res.success) {
    throw new Error(res.error || '获取 IM 适配器列表失败')
  }
  return res.data ?? []
}

/** upsert 适配器配置 — POST /api/im-gateway/adapters */
export async function upsertImAdapter(input: ImAdapterUpsertInput): Promise<ImAdapterConfig> {
  const res = await fetchApi<ImAdapterConfig>('/im-gateway/adapters', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) {
    throw new Error(res.error || '保存 IM 适配器配置失败')
  }
  return res.data
}

/** 获取 16 平台连接状态 — GET /api/im-gateway/status */
export async function fetchImStatus(): Promise<ImGatewayStatus[]> {
  const res = await fetchApi<ImGatewayStatus[]>('/im-gateway/status', { method: 'GET' })
  if (!res.success) {
    throw new Error(res.error || '获取 IM 网关状态失败')
  }
  return res.data ?? []
}

/** 查询消息历史(分页)— GET /api/im-gateway/messages */
export async function fetchImMessages(
  params?: FetchImMessagesParams,
): Promise<ImMessageHistoryPage> {
  const qs = new URLSearchParams()
  if (params?.platform) qs.set('platform', params.platform)
  if (params?.direction) qs.set('direction', params.direction)
  if (typeof params?.limit === 'number') qs.set('limit', String(params.limit))
  if (typeof params?.offset === 'number') qs.set('offset', String(params.offset))
  const query = qs.toString() ? `?${qs.toString()}` : ''
  const res = await fetchApi<ImMessageHistoryPage>(`/im-gateway/messages${query}`, {
    method: 'GET',
  })
  if (!res.success) {
    throw new Error(res.error || '获取 IM 消息历史失败')
  }
  return (
    res.data ?? {
      items: [],
      total: 0,
      limit: params?.limit ?? 20,
      offset: params?.offset ?? 0,
    }
  )
}

/** 发送出站测试消息 — POST /api/im-gateway/send */
export async function sendImMessage(input: SendImMessageInput): Promise<SendImMessageResult> {
  const res = await fetchApi<SendImMessageResult>('/im-gateway/send', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) {
    throw new Error(res.error || '发送 IM 测试消息失败')
  }
  return res.data
}
