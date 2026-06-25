import { t } from '@/utils/i18n'

import request from '@/utils/request'
import { TOOLS_PATHS, API_V1_PATHS } from '@/config/backend-paths'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'

// 工具接口
export interface Tool {
  id: string
  name: string
  description: string
  icon?: string
  category: string
  type: 'api' | 'plugin' | 'widget' | 'service'
  rating: number
  ratingCount: number
  usageCount: number
  price?: number
  isFree: boolean
  isFavorite?: boolean
  tags?: string[]
  createTime: string
  updateTime?: string
  documentation?: string
  creatorName?: string
}

// 工具分类接口
export interface ToolCategory {
  id: string
  name: string
  description?: string
  icon?: string
  count?: number
}

// 获取工具列表
export async function getToolsList(
  params: PaginationParams & {
    category?: string
    type?: string
    keyword?: string
    sortBy?: string
  }
): Promise<ApiResponse<PaginationResponse<Tool>>> {
  try {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      const list: Tool[] = Array.from({ length: params.pageSize || 20 }).map((_, i) => ({
        id: `tool-${(params.page || 1) * 100 + i}`,
        name: `示例工具 ${params.page || 1}-${i + 1}`,
        description: t('text.tools.开发环境示例数据10'),
        category: params.category || 'general',
        type: 'api',
        rating: 4.5,
        ratingCount: 120,
        usageCount: 1000 + i,
        price: i % 3 === 0 ? 9.9 : undefined,
        isFree: i % 3 !== 0,
        tags: ['mock', 'demo'],
        createTime: new Date().toISOString(),
      }))
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: {
          list,
          pagination: {
            page: params.page || 1,
            pageSize: params.pageSize || 20,
            total: 200,
            totalPages: 10,
          },
        },
        timestamp: Date.now(),
      }
    }
    // 调用Java后端接口: /tools/list
    const response = await request.get(TOOLS_PATHS.list, { params })
    return {
      code: 200,
      success: true,
      message: t('api.tools.获取成功'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取工具列表失败',
      data: {
        list: [],
        pagination: {
          page: params.page || 1,
          pageSize: params.pageSize || 20,
          total: 0,
          totalPages: 0,
        },
      },
      timestamp: Date.now(),
    }
  }
}

// 获取工具详情
export async function getToolDetail(id: string): Promise<ApiResponse<Tool>> {
  try {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: {
          id,
          name: `示例工具 ${id}`,
          description: t('text.tools.开发环境示例工具11'),
          category: 'general',
          type: 'api',
          rating: 4.6,
          ratingCount: 256,
          usageCount: 3456,
          isFree: true,
          tags: ['mock'],
          createTime: new Date().toISOString(),
        },
        timestamp: Date.now(),
      }
    }
    // 调用Java后端接口: /tools/{id}
    const response = await request.get(TOOLS_PATHS.byId(id))
    return {
      code: 200,
      success: true,
      message: t('api.tools.获取成功1'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取工具详情失败',
      data: {} as Tool,
      timestamp: Date.now(),
    }
  }
}

// 工具使用参数接口
interface ToolUsageParams {
  [key: string]: string | number | boolean | null | undefined
}

// 记录工具使用
export async function useTool(id: string, params?: ToolUsageParams): Promise<ApiResponse<boolean>> {
  try {
    // 调用Java后端接口: /tools/{id}/use
    const _response = await request.post(TOOLS_PATHS.use(id), params || {})
    return {
      code: 200,
      success: true,
      message: t('api.tools.使用记录成功2'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '使用记录失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 批量记录工具使用
export async function batchUseTools(
  usageList: Array<{
    toolId: string
    usageParams?: ToolUsageParams
  }>
): Promise<ApiResponse<boolean>> {
  try {
    // 调用Java后端接口: /tools/batch/use
    const _response = await request.post(TOOLS_PATHS.batchUse, usageList)
    return {
      code: 200,
      success: true,
      message: t('api.tools.批量使用记录成功3'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '批量使用记录失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 获取工具分类列表
export async function getToolCategoriesList(): Promise<ApiResponse<ToolCategory[]>> {
  try {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      const cats: ToolCategory[] = [
        { id: 'general', name: '通用' },
        { id: 'image', name: '图像' },
        { id: 'audio', name: '音频' },
      ]
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: cats,
        timestamp: Date.now(),
      }
    }
    // 调用Java后端接口: /tools/categories/list
    const response = await request.get(TOOLS_PATHS.categories.list)
    return {
      code: 200,
      success: true,
      message: t('api.tools.获取成功4'),
      data: response.data || [],
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取工具分类失败',
      data: [],
      timestamp: Date.now(),
    }
  }
}

// 获取工具分类（别名，兼容旧代码）
export const getToolCategories = getToolCategoriesList

// 获取热门工具
export async function getPopularTools(params?: {
  limit?: number
  timeRange?: 'day' | 'week' | 'month'
}): Promise<ApiResponse<Tool[]>> {
  try {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      const list: Tool[] = Array.from({ length: params?.limit || 8 }).map((_, i) => ({
        id: `popular-${i + 1}`,
        name: `热门工具 ${i + 1}`,
        description: t('text.tools.开发环境热门示例12'),
        category: 'general',
        type: 'plugin',
        rating: 4.8,
        ratingCount: 500 + i,
        usageCount: 8000 + i * 10,
        isFree: i % 2 === 0,
        createTime: new Date().toISOString(),
      }))
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: list,
        timestamp: Date.now(),
      }
    }
    const response = await request.get(TOOLS_PATHS.popular, { params })
    return {
      code: 200,
      success: true,
      message: t('api.tools.获取成功5'),
      data: response.data || [],
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取热门工具失败',
      data: [],
      timestamp: Date.now(),
    }
  }
}

// 获取工具导航（与小程序端一致）
export async function getToolsNavigation(params: { user_role: string }): Promise<
  ApiResponse<{
    tool_groups: Array<{
      group_id: number
      name: string
      tools: Array<{ tool_id: number; name: string; description?: string }>
    }>
  }>
> {
  try {
    const response = await request.get(API_V1_PATHS.tools.navigation, { params })
    return {
      code: 200,
      success: true,
      message: t('api.tools.获取成功6'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取工具导航失败',
      data: { tool_groups: [] },
      timestamp: Date.now(),
    }
  }
}

// 获取所有工具列表（兼容旧代码）
export async function getAllToolsList(params?: {
  category?: string
  keyword?: string
  type?: string
  isPublic?: boolean
}): Promise<ApiResponse<Tool[]>> {
  try {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      const list: Tool[] = Array.from({ length: 30 }).map((_, i) => ({
        id: `all-${i + 1}`,
        name: `全部工具 ${i + 1}`,
        description: t('text.tools.开发环境示例13'),
        category: i % 2 === 0 ? 'general' : 'image',
        type: 'service',
        rating: 4.3,
        ratingCount: 80 + i,
        usageCount: 1000 + i * 5,
        isFree: true,
        createTime: new Date().toISOString(),
      }))
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: list,
        timestamp: Date.now(),
      }
    }
    const response = await request.get(TOOLS_PATHS.all, { params })
    return {
      code: 200,
      success: true,
      message: t('api.tools.获取成功7'),
      data: response.data || [],
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取工具列表失败',
      data: [],
      timestamp: Date.now(),
    }
  }
}

// 收藏工具
export async function favoriteTool(toolId: string): Promise<ApiResponse<boolean>> {
  try {
    const _response = await request.post(TOOLS_PATHS.favorite(toolId))
    return {
      code: 200,
      success: true,
      message: t('api.tools.收藏成功8'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '收藏失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 取消收藏工具
export async function unfavoriteTool(toolId: string): Promise<ApiResponse<boolean>> {
  try {
    const _response = await request.post(TOOLS_PATHS.unfavorite(toolId))
    return {
      code: 200,
      success: true,
      message: t('api.tools.取消收藏成功9'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '取消收藏失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 工具类型别名（兼容旧代码）
export type AITool = Tool
