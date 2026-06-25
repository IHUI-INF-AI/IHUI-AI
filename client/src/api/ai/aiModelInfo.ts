import { COZE_PATHS } from '@/config/backend-paths'
import { t } from '@/utils/i18n'

/**
 * 大模型信息管理API
 */

import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

export interface AIModelInfo {
  id: string
  name: string
  /** 模型代码 */
  modelCode?: string
  /** 显示名称 */
  displayName?: string
  /** 模型描述 */
  description?: string
  /** 模型分类 */
  category?: string
  source?: string
  img?: string
  remark?: string
  type?: number
  sort?: number
  is_del?: number
  creator?: string
  created_at?: string
  updated_at?: string
  quest_type?: string
  variables?: string
  is_new?: number
  is_top?: number
  manufacturer?: string
}

// 获取模型列表
export const getAIModelList = withApiResponseHandler(
  async (params?: {
    name?: string
    type?: number
    is_del?: number
  }): Promise<ApiResponse<AIModelInfo[]>> => {
    const response = await request.get<{ code?: number; data?: AIModelInfo[] } | AIModelInfo[]>(
      COZE_PATHS.aiModelInfo.list,
      { params: params ?? undefined, base: 3 }
    )
    const responseData = response.data ?? response
    if (responseData && typeof responseData === 'object' && !Array.isArray(responseData) && 'code' in responseData) {
      const code = Number((responseData as { code?: number }).code)
      const ok = code === 0 || code === 200
      const data = (responseData as { data?: AIModelInfo[] | { list?: AIModelInfo[] } }).data
      const list: AIModelInfo[] = Array.isArray(data)
        ? data
        : data && typeof data === 'object' && Array.isArray((data as { list?: AIModelInfo[] }).list)
          ? (data as { list: AIModelInfo[] }).list
          : []
      if (ok && list.length > 0) {
        return {
          code: 200,
          success: true,
          message: 'success',
          data: list,
          timestamp: Date.now(),
        }
      }
      if (!ok) {
        return {
          code: code || 500,
          success: false,
          message: t('api.ai_model_info.获取模型列表失败'),
          data: [],
          timestamp: Date.now(),
        }
      }
      return {
        code: 200,
        success: true,
        message: 'success',
        data: list,
        timestamp: Date.now(),
      }
    }
    // 与参考项目一致：后端可能直接返回数组、{ data: [...] } 或 { data: { list: [...] } }
    let dataArray: AIModelInfo[] = []
    if (Array.isArray(responseData)) {
      dataArray = responseData
    } else if (responseData && typeof responseData === 'object' && 'data' in responseData) {
      const data = (responseData as { data?: AIModelInfo[] | { list?: AIModelInfo[] } }).data
      if (Array.isArray(data)) {
        dataArray = data
      } else if (data && typeof data === 'object' && Array.isArray((data as { list?: AIModelInfo[] }).list)) {
        dataArray = (data as { list: AIModelInfo[] }).list
      }
    }
    return {
      code: 200,
      success: true,
      message: 'success',
      data: dataArray,
      timestamp: Date.now(),
    }
  }
)

// 添加模型
export const addAIModel = withApiResponseHandler(
  async (data: {
    name: string
    source?: string
    img?: string
    remark?: string
    type?: number
    creator?: string
  }): Promise<ApiResponse<unknown>> => {
    const response = await request.post<{ code: number; message: string }>(
      COZE_PATHS.aiModelInfo.add,
      null,
      { params: data }
    )
    return normalizeApiResponse(response)
  }
)

// 更新模型
export const updateAIModel = withApiResponseHandler(
  async (data: {
    id: string
    name?: string
    source?: string
    img?: string
    remark?: string
    type?: number
    is_del?: number
    updator?: string
  }): Promise<ApiResponse<unknown>> => {
    const response = await request.post<{ code: number; message: string }>(
      COZE_PATHS.aiModelInfo.update,
      null,
      { params: data }
    )
    return normalizeApiResponse(response)
  }
)

// 删除模型
export const deleteAIModel = withApiResponseHandler(
  async (id: string, updator?: string): Promise<ApiResponse<unknown>> => {
    const response = await request.get<{ code: number; message: string }>(
      COZE_PATHS.aiModelInfo.delete,
      { params: { id, updator } }
    )
    return normalizeApiResponse(response)
  }
)
