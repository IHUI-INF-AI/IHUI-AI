import { API_ENDPOINTS } from '@aizhs/shared-api'
import type { ApiResponse, PageResult, PlazaTaskItem, PlazaTaskListParams } from '@aizhs/shared-types'
import type { SharedRequestAdapter } from './request-adapter'
import { normalizeApiResponse } from './request-adapter'

export async function getPlazaList(
  adapter: SharedRequestAdapter,
  params: PlazaTaskListParams,
): Promise<ApiResponse<PageResult<PlazaTaskItem>>> {
  const queryParts = [
    `pageNum=${params.pageNum || params.page || 1}`,
    `pageSize=${params.pageSize || 20}`,
    `status=${params.status || ''}`,
    `search=${params.search || ''}`,
    `creator=${params.creator || ''}`,
  ]
  if (params.types && params.types.length > 0) {
    queryParts.push(`types=${params.types}`)
  }
  if (params.categorys && params.categorys.length > 0) {
    queryParts.push(`categorys=${params.categorys}`)
  }

  const response = await adapter.request<unknown>({
    url: `${API_ENDPOINTS.PLAZA.DEMAND_LIST}?${queryParts.join('&')}`,
    method: 'GET',
    base: 2,
  })
  const normalized = normalizeApiResponse<PageResult<PlazaTaskItem> | PlazaTaskItem[]>(response)
  const payload = normalized.data
  const list = Array.isArray(payload) ? payload : payload?.list || []
  const total = Array.isArray(payload) ? list.length : payload?.total || list.length
  const page = Array.isArray(payload) ? params.page || params.pageNum || 1 : payload?.page || params.page || 1
  const pageSize = Array.isArray(payload) ? params.pageSize || list.length : payload?.pageSize || params.pageSize || 20

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

export async function addPlazaTask(
  adapter: SharedRequestAdapter,
  data: Partial<PlazaTaskItem>,
): Promise<ApiResponse<PlazaTaskItem>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.PLAZA.DEMAND_ADD,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    data,
    base: 2,
  })

  return normalizeApiResponse<PlazaTaskItem>(response)
}

export async function getPlazaTaskInfo(
  adapter: SharedRequestAdapter,
  id: string | number,
): Promise<ApiResponse<PlazaTaskItem>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.PLAZA.DEMAND_INFO(id),
    method: 'GET',
    base: 2,
  })

  return normalizeApiResponse<PlazaTaskItem>(response)
}
