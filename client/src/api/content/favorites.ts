/**
 * 收藏功能API
 * 提供通用收藏系统的CRUD操作
 */

import { apiClient } from './core/client'
import type { ApiResponse, PaginationParams } from '@/types'
import { logger } from '@/utils/logger'

/**
 * 收藏资源类型
 */
export type FavoriteResourceType = 'agent' | 'tool' | 'knowledge' | 'conversation' | string

/**
 * 收藏接口
 */
export interface Favorite {
  id: string
  userId: string
  resourceType: FavoriteResourceType
  resourceId: string
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

/**
 * 添加收藏
 */
export async function addFavorite(data: {
  resourceType: FavoriteResourceType
  resourceId: string
  metadata?: Record<string, unknown>
}): Promise<ApiResponse<Favorite>> {
  return apiClient.post('/ai/favorites', data)
}

/**
 * 获取收藏列表
 */
export async function getFavorites(
  params?: PaginationParams & {
    resourceType?: FavoriteResourceType
  }
): Promise<
  ApiResponse<{
    items: Favorite[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>
> {
  return apiClient.getPaginated('/ai/favorites', params as { page?: number; pageSize?: number; [key: string]: any })
}

/**
 * 取消收藏
 */
export async function removeFavorite(
  resourceType: FavoriteResourceType,
  resourceId: string
): Promise<ApiResponse<void>> {
  return apiClient.delete(`/ai/favorites/${resourceType}/${resourceId}`)
}

/**
 * 检查是否已收藏
 */
export async function checkFavorite(
  resourceType: FavoriteResourceType,
  resourceId: string
): Promise<ApiResponse<{ isFavorite: boolean }>> {
  try {
    const response = await apiClient.get('/ai/favorites', {
      params: {
        resourceType,
        resourceId,
        page: 1,
        pageSize: 1,
      },
    })

    if (response.code === 200 && response.data) {
      const data = response.data as { items?: Favorite[] }
      return {
        code: 200,
        message: 'success',
        data: {
          isFavorite: (data.items?.length || 0) > 0,
        },
      } as ApiResponse<{ isFavorite: boolean }>
    }

    return {
      code: 200,
      message: 'success',
      data: { isFavorite: false },
    } as ApiResponse<{ isFavorite: boolean }>
  } catch (error) {
    logger.warn('[Favorites] Failed to check favorite status, returning default:', {
      error: error instanceof Error ? error.message : String(error),
      resourceType,
      resourceId,
    })
    return {
      code: 200,
      message: 'success',
      data: { isFavorite: false },
    } as ApiResponse<{ isFavorite: boolean }>
  }
}
