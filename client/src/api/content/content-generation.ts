import { t } from '@/utils/i18n'

import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { CONTENT_PATHS } from '@/config/backend-paths'

// 生成历史接口
export interface GenerationHistory {
  id: string
  type: 'text' | 'image' | 'video'
  prompt: string
  result?: string
  resultUrl?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createTime: string
}

// 文本生成
export async function generateText(data: {
  topic: string
  keywords?: string
  quantity?: number
  style?: string
}): Promise<ApiResponse<string>> {
  try {
    // 调用Java后端接口: /content/generation/text
    const response = await request.post(CONTENT_PATHS.generation.text, data)
    return {
      code: 200,
      success: true,
      message: t('api.content_generation.生成成功'),
      data: response.data || '',
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '文本生成失败',
      data: '',
      timestamp: Date.now(),
    }
  }
}

// 批量生成文本
export async function batchGenerateText(
  topics: Array<{
    topic: string
    keywords?: string
    quantity?: number
    style?: string
  }>
): Promise<ApiResponse<string[]>> {
  try {
    // 调用Java后端接口: /content/generation/text/batch
    const response = await request.post(CONTENT_PATHS.generation.textBatch, topics)
    return {
      code: 200,
      success: true,
      message: t('api.content_generation.批量生成成功1'),
      data: response.data || [],
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '批量生成失败',
      data: [],
      timestamp: Date.now(),
    }
  }
}

// 图片生成
export async function generateImage(data: {
  prompt: string
  style?: string
  width?: number
  height?: number
}): Promise<ApiResponse<string>> {
  try {
    // 调用Java后端接口: /content/generation/image
    const response = await request.post(CONTENT_PATHS.generation.image, data)
    return {
      code: 200,
      success: true,
      message: t('api.content_generation.生成成功2'),
      data: response.data || '',
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '图片生成失败',
      data: '',
      timestamp: Date.now(),
    }
  }
}

// 视频生成
export async function generateVideo(data: {
  prompt: string
  duration?: number
  resolution?: string
}): Promise<ApiResponse<string>> {
  try {
    // 调用Java后端接口: /content/generation/video
    const response = await request.post(CONTENT_PATHS.generation.video, data)
    return {
      code: 200,
      success: true,
      message: t('api.content_generation.生成成功3'),
      data: response.data || '',
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '视频生成失败',
      data: '',
      timestamp: Date.now(),
    }
  }
}

// 获取生成历史
export async function getGenerationHistory(
  params: PaginationParams & {
    type?: string
    startTime?: string
    endTime?: string
  }
): Promise<ApiResponse<PaginationResponse<GenerationHistory>>> {
  try {
    // 调用Java后端接口: /content/generation/history
    const response = await request.get(CONTENT_PATHS.generation.history, {
      params,
    })
    return {
      code: 200,
      success: true,
      message: t('api.content_generation.获取成功4'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取生成历史失败',
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
