import { t } from '@/utils/i18n'

/**
 * AI生成统一API适配器
 * 
 * 为优化后的服务层提供API调用支持
 * 
 * @module api/ai-generation
 * @version 1.0.0
 */

import request from '@/utils/request'
import { logger } from '@/utils/logger'
import type { ApiResponse } from '@/types'

// ============================================================================
// 类型定义
// ============================================================================

export interface ImageGenerationParams {
  prompt: string
  model: string
  negativePrompt?: string
  width?: number
  height?: number
  steps?: number
  seed?: number
  style?: string
  referenceImage?: string
}

export interface VideoGenerationParams {
  prompt: string
  model: string
  duration?: number
  fps?: number
  resolution?: string
  startFrame?: string
  style?: string
  negativePrompt?: string
}

export interface Model3DGenerationParams {
  prompt: string
  model: string
  format?: 'glb' | 'obj' | 'fbx'
  quality?: 'low' | 'medium' | 'high'
  textureResolution?: number
}

export interface GenerationResult {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  url?: string
  thumbnailUrl?: string
  error?: string
  metadata?: Record<string, unknown>
}

export interface GenerationTaskStatus {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  message?: string
  result?: GenerationResult
}

// ============================================================================
// 图片生成API
// ============================================================================

/**
 * 通义万相图片生成
 */
export async function generateImageQwen(
  params: ImageGenerationParams
): Promise<GenerationResult> {
  try {
    const response = await request<ApiResponse<GenerationResult>>({
      url: '/ai/image/generate/qwen',
      method: 'POST',
      data: {
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        width: params.width || 1024,
        height: params.height || 1024,
        steps: params.steps || 30,
        seed: params.seed,
        style: params.style,
        referenceImage: params.referenceImage,
      },
    })
    
    if (!response.data?.data) {
      throw new Error(t('error.ai_generation.通义万相图片生成'))
    }
    return response.data.data
  } catch (error) {
    logger.error('Qwen image generation failed:', error)
    throw error
  }
}

/**
 * 豆包图片生成
 */
export async function generateImageDoubao(
  params: ImageGenerationParams
): Promise<GenerationResult> {
  try {
    const response = await request<ApiResponse<GenerationResult>>({
      url: '/ai/image/generate/doubao',
      method: 'POST',
      data: {
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        width: params.width || 1024,
        height: params.height || 1024,
        style: params.style,
        referenceImage: params.referenceImage,
      },
    })
    
    if (!response.data?.data) {
      throw new Error(t('error.ai_generation.豆包图片生成失败1'))
    }
    return response.data.data
  } catch (error) {
    logger.error('Doubao image generation failed:', error)
    throw error
  }
}

/**
 * 即梦图片生成
 */
export async function generateImageJimeng(
  params: ImageGenerationParams
): Promise<GenerationResult> {
  try {
    const response = await request<ApiResponse<GenerationResult>>({
      url: '/ai/image/generate/jimeng',
      method: 'POST',
      data: {
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        width: params.width || 1024,
        height: params.height || 1024,
        style: params.style,
      },
    })
    
    if (!response.data?.data) {
      throw new Error(t('error.ai_generation.即梦图片生成失败2'))
    }
    return response.data.data
  } catch (error) {
    logger.error('Jimeng image generation failed:', error)
    throw error
  }
}

// ============================================================================
// 视频生成API
// ============================================================================

/**
 * Kling视频生成
 */
export async function generateVideoKling(
  params: VideoGenerationParams
): Promise<GenerationResult> {
  try {
    const response = await request<ApiResponse<GenerationResult>>({
      url: '/ai/video/generate/kling',
      method: 'POST',
      data: {
        prompt: params.prompt,
        duration: params.duration || 5,
        fps: params.fps || 24,
        resolution: params.resolution || '1080p',
        startFrame: params.startFrame,
        style: params.style,
        negativePrompt: params.negativePrompt,
      },
    })
    
    if (!response.data?.data) {
      throw new Error(t('error.ai_generation.Kling视频生3'))
    }
    return response.data.data
  } catch (error) {
    logger.error('Kling video generation failed:', error)
    throw error
  }
}

/**
 * 即梦视频生成
 */
export async function generateVideoJimeng(
  params: VideoGenerationParams
): Promise<GenerationResult> {
  try {
    const response = await request<ApiResponse<GenerationResult>>({
      url: '/ai/video/generate/jimeng',
      method: 'POST',
      data: {
        prompt: params.prompt,
        duration: params.duration || 5,
        resolution: params.resolution || '720p',
        startFrame: params.startFrame,
      },
    })
    
    if (!response.data?.data) {
      throw new Error(t('error.ai_generation.即梦视频生成失败4'))
    }
    return response.data.data
  } catch (error) {
    logger.error('Jimeng video generation failed:', error)
    throw error
  }
}

/**
 * Vidu视频生成
 */
export async function generateVideoVidu(
  params: VideoGenerationParams
): Promise<GenerationResult> {
  try {
    const response = await request<ApiResponse<GenerationResult>>({
      url: '/ai/video/generate/vidu',
      method: 'POST',
      data: {
        prompt: params.prompt,
        duration: params.duration || 4,
        startFrame: params.startFrame,
        style: params.style,
      },
    })
    
    if (!response.data?.data) {
      throw new Error(t('error.ai_generation.Vidu视频生成5'))
    }
    return response.data.data
  } catch (error) {
    logger.error('Vidu video generation failed:', error)
    throw error
  }
}

// ============================================================================
// 3D模型生成API
// ============================================================================

/**
 * 3D模型生成
 */
export async function generate3DModel(
  params: Model3DGenerationParams
): Promise<GenerationResult> {
  try {
    const response = await request<ApiResponse<GenerationResult>>({
      url: '/ai/3d/generate',
      method: 'POST',
      data: {
        prompt: params.prompt,
        model: params.model,
        format: params.format || 'glb',
        quality: params.quality || 'medium',
        textureResolution: params.textureResolution || 1024,
      },
    })
    
    if (!response.data?.data) {
      throw new Error(t('error.ai_generation.3D模型生成失败6'))
    }
    return response.data.data
  } catch (error) {
    logger.error('3D model generation failed:', error)
    throw error
  }
}

// ============================================================================
// 任务状态查询
// ============================================================================

/**
 * 查询生成任务状态
 */
export async function getTaskStatus(taskId: string): Promise<GenerationTaskStatus> {
  try {
    const response = await request<ApiResponse<GenerationTaskStatus>>({
      url: `/ai/task/${taskId}/status`,
      method: 'GET',
    })
    
    if (!response.data?.data) {
      throw new Error(t('error.ai_generation.查询任务状态失败7'))
    }
    return response.data.data
  } catch (error) {
    logger.error('Failed to query task status:', error)
    throw error
  }
}

/**
 * 取消生成任务
 */
export async function cancelTask(taskId: string): Promise<boolean> {
  try {
    await request({
      url: `/ai/task/${taskId}/cancel`,
      method: 'POST',
    })
    
    return true
  } catch (error) {
    logger.error('Failed to cancel task:', error)
    return false
  }
}

/**
 * 批量查询任务状态
 */
export async function batchGetTaskStatus(
  taskIds: string[]
): Promise<GenerationTaskStatus[]> {
  try {
    const response = await request<ApiResponse<GenerationTaskStatus[]>>({
      url: '/ai/task/batch/status',
      method: 'POST',
      data: { taskIds },
    })
    
    if (!response.data?.data) {
      throw new Error(t('error.ai_generation.批量查询任务状态8'))
    }
    return response.data.data
  } catch (error) {
    logger.error('Batch query task status failed:', error)
    throw error
  }
}

// ============================================================================
// 统一生成接口
// ============================================================================

export type GenerationType = 'image' | 'video' | '3d'
export type ModelProvider = 'qwen' | 'doubao' | 'jimeng' | 'kling' | 'vidu'

export interface UnifiedGenerationParams {
  type: GenerationType
  provider: ModelProvider
  prompt: string
  options?: Record<string, unknown>
}

/**
 * 统一生成接口
 * 根据类型和提供商自动路由到对应的API
 */
export async function generateContent(
  params: UnifiedGenerationParams
): Promise<GenerationResult> {
  const { type, provider, prompt, options = {} } = params
  
  switch (type) {
    case 'image':
      switch (provider) {
        case 'qwen':
          return generateImageQwen({ prompt, model: provider, ...options })
        case 'doubao':
          return generateImageDoubao({ prompt, model: provider, ...options })
        case 'jimeng':
          return generateImageJimeng({ prompt, model: provider, ...options })
        default:
          throw new Error(`不支持的图片生成提供商: ${provider}`)
      }
      
    case 'video':
      switch (provider) {
        case 'kling':
          return generateVideoKling({ prompt, model: provider, ...options })
        case 'jimeng':
          return generateVideoJimeng({ prompt, model: provider, ...options })
        case 'vidu':
          return generateVideoVidu({ prompt, model: provider, ...options })
        default:
          throw new Error(`不支持的视频生成提供商: ${provider}`)
      }
      
    case '3d':
      return generate3DModel({ prompt, model: provider, ...options })
      
    default:
      throw new Error(`不支持的生成类型: ${type}`)
  }
}

// ============================================================================
// 导出
// ============================================================================

export default {
  // 图片
  generateImageQwen,
  generateImageDoubao,
  generateImageJimeng,
  
  // 视频
  generateVideoKling,
  generateVideoJimeng,
  generateVideoVidu,
  
  // 3D
  generate3DModel,
  
  // 任务
  getTaskStatus,
  cancelTask,
  batchGetTaskStatus,
  
  // 统一接口
  generateContent,
}
