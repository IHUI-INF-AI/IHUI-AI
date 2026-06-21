import { API_ENDPOINTS } from '@aizhs/shared-api'
import type { AgentItem, AgentListParams, ApiResponse, PageResult } from '@aizhs/shared-types'
import type { SharedRequestAdapter } from './request-adapter'
import { normalizeApiResponse } from './request-adapter'

type AgentListEnvelope =
  | AgentItem[]
  | {
      agents?: AgentItem[]
      list?: AgentItem[]
      data?: AgentItem[]
      total?: number
      page?: number
      pageNum?: number
      pageSize?: number
    }

export async function getAgentList(
  adapter: SharedRequestAdapter,
  params: AgentListParams = {},
): Promise<ApiResponse<PageResult<AgentItem>>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.AGENT.BY_TYPE,
    method: 'GET',
    params: { ...params },
    base: 2,
  })
  const normalized = normalizeApiResponse<AgentListEnvelope>(response)
  const payload = normalized.data
  const list = Array.isArray(payload)
    ? payload
    : payload?.agents || payload?.list || payload?.data || []
  const page = Array.isArray(payload) ? params.page || params.pageNum || 1 : payload?.page || payload?.pageNum || params.page || params.pageNum || 1
  const pageSize = Array.isArray(payload) ? params.pageSize || list.length || 20 : payload?.pageSize || params.pageSize || list.length || 20
  const total = Array.isArray(payload) ? list.length : payload?.total || list.length

  return {
    ...normalized,
    data: {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

export async function getAgentDetailByCategory(
  adapter: SharedRequestAdapter,
  id: string | number,
): Promise<ApiResponse<AgentItem[]>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.AGENT.CATEGORY_BY_ID(String(id)),
    method: 'GET',
    base: 3,
  })

  return normalizeApiResponse<AgentItem[]>(response)
}
