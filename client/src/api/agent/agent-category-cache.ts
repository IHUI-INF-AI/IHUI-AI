import { COZE_PATHS } from '@/config/backend-paths'

/**
 * 智能体分类字典缓存API
 * 对应后端路由：/cozeZhsApi/cache/agent-category-dict
 */

import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

// 缓存信息接口
export interface CacheInfo {
  total_count: number
  last_update_time: string
  cache_size: number
}

// 分类项接口
export interface CategoryItem {
  id: string
  name: string
  url?: string
  butUrl?: string
}

// 分类数据接口
export interface CategoryData {
  agent_main_category: CategoryItem[] // 主分类 (field2=0)
  agent_category: CategoryItem[] // 子分类 (field2=1)
}

// ID转名称结果
export interface IdToNameResult {
  input_ids: string
  type: string
  result: string[]
}

// 获取缓存信息
export const getCacheInfo = withApiResponseHandler(async (): Promise<ApiResponse<CacheInfo>> => {
  const response = await request.get(COZE_PATHS.cache.agentCategoryDict.info)
  return normalizeApiResponse(response)
})

// 重新加载缓存
export const reloadCache = withApiResponseHandler(async (): Promise<ApiResponse<CacheInfo>> => {
  const response = await request.post(COZE_PATHS.cache.agentCategoryDict.reload)
  return normalizeApiResponse(response)
})

// ID转名称
export const convertIdsToNames = withApiResponseHandler(
  async (
    ids: string,
    type: '0' | '1' // 0=种类, 1=赛道
  ): Promise<ApiResponse<IdToNameResult>> => {
    const response = await request.get(COZE_PATHS.cache.agentCategoryDict.convert, {
      params: { ids, type },
    })
    return normalizeApiResponse(response)
  }
)

// 获取分类数据
export const getCategories = withApiResponseHandler(
  async (): Promise<ApiResponse<CategoryData>> => {
    const response = await request.get(COZE_PATHS.cache.agentCategoryDict.categories)
    return normalizeApiResponse(response)
  }
)
