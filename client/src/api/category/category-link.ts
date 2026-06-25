import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

// 2026-06-26 对接联调: 字段对齐后端 category_link.py _to_dict 返回
export interface CategoryLink {
  id?: number
  agentId?: string
  categoryId?: number
  createTime?: string | null
}

export interface CategoryLinkListParams extends PaginationParams {
  agentId?: string
  categoryId?: number
}

// 2026-06-26 对接联调: URL 对齐后端 /api/v1/agents/category-link/*
const BASE_URL = '/api/v1/agents/category-link'

export const updateCategoryLink = withApiResponseHandler(
  async (data: { id: number; agentId?: string; categoryId?: number }): Promise<ApiResponse<CategoryLink>> => {
    const response = await request.put<CategoryLink>(BASE_URL, {
      id: data.id,
      agent_id: data.agentId,
      category_id: data.categoryId,
    })
    return normalizeApiResponse(response)
  }
)

export const createCategoryLink = withApiResponseHandler(
  async (data: { agentId: string; categoryId: number }): Promise<ApiResponse<CategoryLink>> => {
    const response = await request.post<CategoryLink>(BASE_URL, {
      agent_id: data.agentId,
      category_id: data.categoryId,
    })
    return normalizeApiResponse(response)
  }
)

export const exportCategoryLink = withApiResponseHandler(
  async (_params?: CategoryLinkListParams): Promise<ApiResponse<Blob>> => {
    // 2026-06-26: 后端暂未实现 export 端点, 返回空 blob 作为占位
    // 后续版本如需导出, 在 category_link.py 新增 @router.post("/export") 端点
    const response = await request.post<Blob>(`${BASE_URL}/export`, {}, {
      responseType: 'blob',
    })
    return normalizeApiResponse(response)
  }
)

export const getCategoryLinkDetail = withApiResponseHandler(
  async (id: number): Promise<ApiResponse<CategoryLink>> => {
    const response = await request.get<CategoryLink>(`${BASE_URL}/${id}`)
    return normalizeApiResponse(response)
  }
)

export const getCategoryLinkList = withApiResponseHandler(
  async (params?: CategoryLinkListParams): Promise<ApiResponse<PaginationResponse<CategoryLink>>> => {
    const response = await request.get<PaginationResponse<CategoryLink>>(`${BASE_URL}/list`, {
      params: {
        agent_id: params?.agentId,
        category_id: params?.categoryId,
        page: params?.page,
        size: params?.pageSize,
      },
    })
    return normalizeApiResponse(response)
  }
)

export const deleteCategoryLink = withApiResponseHandler(
  async (ids: number | number[] | string): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : String(ids)
    const response = await request.delete<null>(`${BASE_URL}/${idsString}`)
    return normalizeApiResponse(response)
  }
)
