import { API_ENDPOINTS } from '@aizhs/shared-api'
import type { ApiResponse, AgentGroupItem } from '@aizhs/shared-types'
import type { SharedRequestAdapter } from './request-adapter'
import { normalizeApiResponse } from './request-adapter'

export async function getModelChatList(
  adapter: SharedRequestAdapter,
  data: Record<string, unknown>,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.AI_CHAT.MODEL_CHAT_QUERY,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    data,
    base: 3,
  })

  return normalizeApiResponse(response)
}

export async function createModelChat(
  adapter: SharedRequestAdapter,
  data: Record<string, unknown>,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.AI_CHAT.MODEL_CHAT_CREATE,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    data,
    base: 3,
  })

  return normalizeApiResponse(response)
}

export async function queryAgentContext(
  adapter: SharedRequestAdapter,
  data: Record<string, unknown>,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.AI_CHAT.AGENT_CONTEXT_QUERY,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    data,
    base: 3,
  })

  return normalizeApiResponse(response)
}

export async function updateModelChatMark(
  adapter: SharedRequestAdapter,
  data: Record<string, unknown>,
): Promise<ApiResponse<null>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.AI_CHAT.MODEL_CHAT_UPDATE_MARK,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    data,
    base: 3,
  })

  return normalizeApiResponse<null>(response)
}

export async function deleteModelChat(
  adapter: SharedRequestAdapter,
  id: string | number,
): Promise<ApiResponse<null>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.AI_CHAT.MODEL_CHAT_DELETE(id),
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    base: 3,
  })

  return normalizeApiResponse<null>(response)
}

export async function getAigcList(
  adapter: SharedRequestAdapter,
  params: { pageNum?: number; pageSize?: number; fileType?: string } = {},
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.AI_CHAT.AIGC_LIST,
    method: 'GET',
    headers: { 'content-type': 'application/json' },
    data: {
      pageNum: params.pageNum || 1,
      pageSize: params.pageSize || 6,
      fileType: params.fileType || '',
    },
    base: 4,
  })

  return normalizeApiResponse(response)
}

export async function getAgentAllList(
  adapter: SharedRequestAdapter,
  params?: Record<string, unknown>,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.AI_CHAT.AGENT_ALL_LIST,
    method: 'GET',
    data: params,
    base: 3,
  })

  return normalizeApiResponse(response)
}

export async function checkFirstShareStatus(
  adapter: SharedRequestAdapter,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.RESOURCE.FIRST_SHARE_SHOW,
    method: 'GET',
    headers: { 'content-type': 'application/json' },
    base: 1,
  })

  return normalizeApiResponse(response)
}

export async function firstShare(
  adapter: SharedRequestAdapter,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.RESOURCE.FIRST_SHARE,
    method: 'GET',
    headers: { 'content-type': 'application/json' },
    base: 1,
  })

  return normalizeApiResponse(response)
}

export async function getGroupList(
  adapter: SharedRequestAdapter,
): Promise<ApiResponse<AgentGroupItem[]>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.GROUP.LIST,
    method: 'GET',
    headers: { 'content-type': 'application/json' },
    base: 4,
  })

  return normalizeApiResponse<AgentGroupItem[]>(response)
}
