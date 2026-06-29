import { DEVELOPER_PATHS } from '@/config/backend-paths'
import { t } from '@/utils/i18n'

/**
 * 批量操作API
 */

import request from '@/utils/request'
import type { ApiResponse } from '@/types'

/**
 * 批量创建大模型
 */
export async function batchCreateModels(
  models: Array<{
    type: string
    name: string
    modelId: string
    provider?: string
    enabled?: boolean
    apiKey?: string
    baseUrl?: string
    description?: string
    pricing?: unknown
    proxy?: unknown
  }>
): Promise<
  ApiResponse<{
    results: Array<{ id: string; success: boolean; error?: string }>
    total: number
    success: number
    failed: number
  }>
> {
  try {
    const response = await request.post(DEVELOPER_PATHS.models.batch, {
      models,
    })
    return {
      code: 200,
      success: true,
      data: response.data,
      message: t('api.batch_operations.批量创建成功'),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number } }
    return {
      code: axiosError.response?.status || 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '批量创建失败',
      data: {
        results: [],
        total: 0,
        success: 0,
        failed: 0,
      },
      timestamp: Date.now(),
    }
  }
}

/**
 * 批量删除大模型
 */
export async function batchDeleteModels(
  ids: string[]
): Promise<ApiResponse<{ deletedCount: number }>> {
  try {
    const response = await request.delete(DEVELOPER_PATHS.models.batch, {
      data: { ids },
    })
    return {
      code: 200,
      success: true,
      data: response.data,
      message: t('api.batch_operations.批量删除成功1'),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number } }
    return {
      code: axiosError.response?.status || 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '批量删除失败',
      data: { deletedCount: 0 },
      timestamp: Date.now(),
    }
  }
}

/**
 * 批量更新模型状态
 */
export async function batchUpdateModelStatus(
  ids: string[],
  enabled: boolean
): Promise<ApiResponse<{ updatedCount: number }>> {
  try {
    const response = await request.patch(DEVELOPER_PATHS.models.batchToggle, {
      ids,
      enabled,
    })
    return {
      code: 200,
      success: true,
      data: response.data,
      message: t('api.batch_operations.批量更新成功2'),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number } }
    return {
      code: axiosError.response?.status || 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '批量更新失败',
      data: { updatedCount: 0 },
      timestamp: Date.now(),
    }
  }
}
