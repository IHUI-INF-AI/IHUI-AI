import request from '@/utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'
import type { ApiResponse } from '@/types'

/**
 * AI模型服务
 */

// 获取分类列表
export const category = withApiResponseHandler(
  async (type: string = '1'): Promise<ApiResponse<unknown[]>> => {
    const response = await request.get('/ai-models/categories', { params: { type } })
    return normalizeApiResponse(response)
  }
)

// 获取模型列表
export const getModelList = withApiResponseHandler(
  async (params?: { category?: string; page?: number; pageSize?: number }): Promise<ApiResponse<{ list: any[]; total: number }>> => {
    const response = await request.get('/ai-models', { params })
    return normalizeApiResponse(response)
  }
)

// 获取模型详情
export const getModelDetail = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<unknown>> => {
    const response = await request.get(`/ai-models/${id}`)
    return normalizeApiResponse(response)
  }
)

// 获取开发者信息
export const getDevInfo = withApiResponseHandler(
  async (): Promise<ApiResponse<{ id: string; amount: number; remark: string }[]>> => {
    const response = await request.get('/dev/info')
    return normalizeApiResponse(response)
  }
)

// 点赞模型
export const likeModel = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<boolean>> => {
    const response = await request.post(`/ai-models/${id}/like`)
    return normalizeApiResponse(response)
  }
)

// 收藏模型
export const collectModel = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<boolean>> => {
    const response = await request.post(`/ai-models/${id}/collect`)
    return normalizeApiResponse(response)
  }
)

// 取消点赞
export const unlikeModel = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<boolean>> => {
    const response = await request.post(`/ai-models/${id}/unlike`)
    return normalizeApiResponse(response)
  }
)

// 取消收藏
export const uncollectModel = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<boolean>> => {
    const response = await request.post(`/ai-models/${id}/uncollect`)
    return normalizeApiResponse(response)
  }
)
