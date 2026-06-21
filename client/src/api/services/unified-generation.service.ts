import { t } from '@/utils/i18n'

/**
 * 统一AI生成服务层
 * 
 * 整合所有AI内容生成相关的后端接口，提供统一的调用方式
 * 支持：图片生成、视频生成、音频生成、3D模型生成、视觉分析、多模态处理
 * 
 * @module api/services/unified-generation.service
 * @version 1.0.0
 */

import { logger } from '@/utils/logger'
import type { ApiResponse } from '@/types'
import httpRequest from '@/utils/request'
import { getAvailableModels } from '@/api/models'

// ============================================================================
// 类型定义
// ============================================================================

/** 生成类型 */
export type GenerationType = 'image' | 'video' | 'audio' | '3d' | 'vision' | 'music'

/** 生成提供商 */
export type GenerationProvider = 
  // 图片生成
  | 'qwen-image' | 'doubao-image' | 'jimeng-image' | 'dashscope-i2i'
  // 视频生成
  | 'dashscope-video' | 'kling-video' | 'jimeng-video' | 'vidu-video' | 'sora-video' | 'one-click-video'
  // 音频生成
  | 'ali-timbre' | 'cosyvoice'
  // 3D生成
  | 'hunyuan-3d'
  // 视觉分析
  | 'dashscope-vision'

/** 生成任务状态 */
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

/** 通用生成请求参数 */
export interface UnifiedGenerationRequest {
  /** 生成类型 */
  type: GenerationType
  
  /** 生成提供商（可选，会自动选择默认） */
  provider?: GenerationProvider
  
  /** 提示词/描述 */
  prompt: string
  
  /** 用户UUID */
  userUuid: string
  
  /** 会话ID */
  chatId?: string
  
  /** 负面提示词 */
  negativePrompt?: string
  
  /** 参考图片URL（用于图生图、图生视频等） */
  referenceImage?: string
  referenceImages?: string[]
  
  /** 图片/视频尺寸 */
  width?: number
  height?: number
  size?: string
  
  /** 视频特有参数 */
  duration?: number
  fps?: number
  resolution?: string
  
  /** 音频特有参数 */
  voice?: string
  speed?: number
  
  /** 3D特有参数 */
  format?: 'glb' | 'obj' | 'fbx'
  quality?: 'low' | 'medium' | 'high'
  enablePBR?: boolean
  
  /** 生成参数 */
  seed?: number
  steps?: number
  style?: string
  scale?: number
  
  /** 额外参数 */
  metadata?: Record<string, unknown>
}

/** 通用生成响应 */
export interface UnifiedGenerationResponse {
  /** 任务ID（用于查询状态） */
  taskId?: string
  
  /** 任务状态 */
  status: TaskStatus
  
  /** 进度（0-100） */
  progress?: number
  
  /** 状态消息 */
  message?: string
  
  /** 生成结果URL */
  url?: string
  urls?: string[]
  
  /** 缩略图URL */
  thumbnailUrl?: string
  
  /** 生成类型 */
  type: GenerationType
  
  /** 使用的提供商 */
  provider: GenerationProvider
  
  /** Token使用 */
  tokenUsage?: number
  
  /** 处理时间（毫秒） */
  processingTime?: number
  
  /** 元数据 */
  metadata?: Record<string, unknown>
  
  /** 错误信息 */
  error?: string
}

/** WebSocket消息处理器 */
export interface GenerationWebSocketCallbacks {
  onProgress?: (progress: number, status: string) => void
  onComplete?: (response: UnifiedGenerationResponse) => void
  onError?: (error: Error) => void
  onClose?: () => void
}

// ============================================================================
// 统一生成服务类
// ============================================================================

class UnifiedGenerationService {
  private activeWebSockets: Map<string, WebSocket> = new Map()
  private pollingTasks: Map<string, NodeJS.Timeout> = new Map()

  // ========== 统一入口方法 ==========

  /**
   * 发起生成请求（统一入口）
   */
  async generate(request: UnifiedGenerationRequest): Promise<ApiResponse<UnifiedGenerationResponse>> {
    const startTime = performance.now()
    
    try {
      logger.info('[UnifiedGeneration] Starting generation request', {
        type: request.type,
        provider: request.provider,
        prompt: request.prompt.substring(0, 50) + '...',
      })

      // 根据类型选择默认提供商
      const provider = request.provider || this.getDefaultProvider(request.type)
      
      let response: ApiResponse<UnifiedGenerationResponse>
      
      switch (request.type) {
        case 'image':
          response = await this.generateImage(request, provider)
          break
        case 'video':
          response = await this.generateVideo(request, provider)
          break
        case 'audio':
          response = await this.generateAudio(request, provider)
          break
        case '3d':
          response = await this.generate3D(request, provider)
          break
        case 'vision':
          response = await this.analyzeVision(request, provider)
          break
        case 'music':
          response = await this.generateMusic(request, provider)
          break
        default:
          throw new Error(`不支持的生成类型: ${request.type}`)
      }
      
      // 添加处理时间
      if (response.data) {
        response.data.processingTime = performance.now() - startTime
      }
      
      return response
    } catch (error) {
      logger.error('[UnifiedGeneration] Generation failed', error)
      return this.createErrorResponse(error, request.type, request.provider || this.getDefaultProvider(request.type))
    }
  }

  /**
   * 发起流式生成（使用WebSocket，适用于视频生成等耗时任务）
   */
  async generateStream(
    request: UnifiedGenerationRequest,
    callbacks: GenerationWebSocketCallbacks
  ): Promise<string> {
    const requestId = `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    try {
      logger.info('[UnifiedGeneration] Starting streaming generation', { requestId, type: request.type })
      
      const provider = request.provider || this.getDefaultProvider(request.type)
      
      switch (request.type) {
        case 'video':
          await this.streamVideoGeneration(request, provider, requestId, callbacks)
          break
        default: {
          // 其他类型降级为普通生成
          const response = await this.generate(request)
          if (response.success && response.data) {
            callbacks.onProgress?.(100, '生成完成')
            callbacks.onComplete?.(response.data)
          } else {
            callbacks.onError?.(new Error(response.message))
          }
        }
      }
      
      return requestId
    } catch (error) {
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
      return requestId
    }
  }

  /**
   * 查询任务状态
   */
  async getTaskStatus(taskId: string, type: GenerationType): Promise<ApiResponse<UnifiedGenerationResponse>> {
    try {
      switch (type) {
        case 'video':
          return await this.getVideoTaskStatus(taskId)
        case '3d':
          return await this.get3DTaskStatus(taskId)
        default:
          // 其他类型通常是同步完成的
          return {
            code: 200,
            success: true,
            message: t('api.unified_generation_service.任务已完成'),
            data: {
              taskId,
              status: 'completed',
              type,
              provider: this.getDefaultProvider(type),
            },
            timestamp: Date.now(),
          }
      }
    } catch (error) {
      logger.error('[UnifiedGeneration] Failed to query task status', error)
      return this.createErrorResponse(error, type, this.getDefaultProvider(type))
    }
  }

  /**
   * 取消任务
   */
  cancelTask(requestId: string): void {
    // 关闭WebSocket
    const ws = this.activeWebSockets.get(requestId)
    if (ws) {
      ws.close()
      this.activeWebSockets.delete(requestId)
    }
    
    // 停止轮询
    const polling = this.pollingTasks.get(requestId)
    if (polling) {
      clearInterval(polling)
      this.pollingTasks.delete(requestId)
    }
    
    logger.info('[UnifiedGeneration] Task has been cancelled', { requestId })
  }

  // ========== 图片生成 ==========

  private async generateImage(
    request: UnifiedGenerationRequest,
    provider: GenerationProvider
  ): Promise<ApiResponse<UnifiedGenerationResponse>> {
    switch (provider) {
      case 'qwen-image': {
        // 通义生图：优先从大模型列表中读取 remark + quest_type，不再写死 Qwen-Image 接口
        const modelsResp = await getAvailableModels()
        const models = modelsResp.success && Array.isArray(modelsResp.data) ? modelsResp.data : []
        const imageModel = models.find((m) => {
          const providerName = (m.provider || '').toLowerCase()
          const name = (m.name || '').toLowerCase()
          const displayName = (m.displayName || '').toLowerCase()
          return m.supportsImages === true && (
            providerName.includes('qwen') ||
            providerName.includes('dashscope') ||
            name.includes('qwen') ||
            displayName.includes('通义') ||
            displayName.includes('万相')
          )
        }) as (import('@/api/models').AIModelInfo & { remark?: string; quest_type?: string }) | undefined

        if (!imageModel?.remark) {
          throw new Error(
            t('api.unified_generation_service.图片模型未配置接口') ||
              '通义图片模型未在大模型列表中配置 remark（接口地址），请先在「大模型管理」中配置后再重试'
          )
        }

        const questType = (imageModel.quest_type || '').toLowerCase().trim()
        if (questType === 'ws' || questType === 'websocket' || questType === 'web_socket') {
          throw new Error(
            t('api.unified_generation_service.暂不支持图片WebSocket生成') ||
              '当前暂不支持通过 WebSocket 生图，请将图片模型的 quest_type 配置为 HTTP 再试'
          )
        }

        const path = imageModel.remark.startsWith('/') ? imageModel.remark : `/${imageModel.remark}`
        const resp = await httpRequest.post(path, {
          prompt: request.prompt,
          user_uuid: request.userUuid,
          chat_id: request.chatId,
        }) as unknown as {
          data?: { image_url?: string; image_urls?: string[]; message?: string }
          image_url?: string
          image_urls?: string[]
          message?: string
        }

        const payload = resp.data ?? resp
        const url =
          payload.image_url ||
          (Array.isArray(payload.image_urls) && payload.image_urls.length > 0
            ? payload.image_urls[0]
            : undefined)

        if (!url) {
          throw new Error(
            payload.message || t('api.unified_generation_service.图片生成失败10') || '图片生成失败'
          )
        }

        return {
          code: 200,
          success: true,
          message: t('api.unified_generation_service.图片生成成功10'),
          data: {
            status: 'completed',
            url,
            urls: Array.isArray(payload.image_urls) ? payload.image_urls : [url],
            type: 'image',
            provider,
          },
          timestamp: Date.now(),
        }
      }
      
      case 'doubao-image': {
        const { generateDoubaoImage } = await import('./aiGeneration.service')
        const response = await generateDoubaoImage({
          prompt: request.prompt,
          user_uuid: request.userUuid,
          chat_id: request.chatId,
          style: request.style,
          size: request.size,
        })
        
        return this.normalizeImageResponse(response, provider)
      }
      
      case 'jimeng-image': {
        const { generateJimeng4Image } = await import('./aiGeneration.service')
        const response = await generateJimeng4Image({
          prompt: request.prompt,
          user_uuid: request.userUuid,
          chat_id: request.chatId,
          width: request.width,
          height: request.height,
          seed: request.seed,
          scale: request.scale,
          image_urls: request.referenceImages,
        })
        
        return this.normalizeImageResponse(response, provider)
      }
      
      case 'dashscope-i2i': {
        const { generateDashScopeImageToImage } = await import('./aiGeneration.service')
        if (!request.referenceImage) {
          throw new Error(t('error.unified_generation_service.图生图需要提供参11'))
        }
        
        const imagesArr = Array.isArray(request.referenceImage)
          ? request.referenceImage
          : (request.referenceImage ? [request.referenceImage] : [])
        const response = await generateDashScopeImageToImage({
          images: imagesArr,
          prompt: request.prompt,
          user_uuid: request.userUuid,
          chat_id: request.chatId,
          // 透传负面提示词、风格等到 zidingyican，方便后端按需解析
          ...(request.negativePrompt || request.style || request.scale || request.seed
            ? {
                zidingyican: [
                  ...(request.negativePrompt
                    ? [{ name: 'negative_prompt', desc: '负面提示词', value: request.negativePrompt }]
                    : []),
                  ...(request.style
                    ? [{ name: 'style', desc: '风格', value: request.style }]
                    : []),
                  ...(typeof request.scale === 'number'
                    ? [{ name: 'scale', desc: 'CFG scale', value: request.scale }]
                    : []),
                  ...(typeof request.seed === 'number'
                    ? [{ name: 'seed', desc: '随机种子', value: request.seed }]
                    : []),
                ],
              }
            : {}),
        })
        
        return this.normalizeImageResponse(response, provider)
      }
      
      default:
        throw new Error(`不支持的图片生成提供商: ${provider}`)
    }
  }

  // ========== 视频生成 ==========

  private async generateVideo(
    request: UnifiedGenerationRequest,
    provider: GenerationProvider
  ): Promise<ApiResponse<UnifiedGenerationResponse>> {
    switch (provider) {
      case 'one-click-video': {
        const { startOneClickVideo } = await import('./aiGeneration.service')
        const response = await startOneClickVideo({
          topic: request.prompt,
          video_duration: request.duration,
          video_ratio: request.resolution,
          audio_prompt: request.metadata?.audioPrompt as string,
          user_uuid: request.userUuid,
          chat_id: request.chatId,
        })
        
        if (response.success && response.data) {
          return {
            code: 200,
            success: true,
            message: t('api.unified_generation_service.视频生成任务已创1'),
            data: {
              taskId: response.data.task_id,
              status: 'processing',
              progress: 0,
              message: response.data.message,
              type: 'video',
              provider,
            },
            timestamp: Date.now(),
          }
        }
        throw new Error(response.message || '一键视频生成失败')
      }
      
      case 'kling-video': {
        const { createKlingVideo } = await import('./aiGeneration.service')
        const response = await createKlingVideo({
          prompt: request.prompt,
          user_uuid: request.userUuid,
          chat_id: request.chatId,
          video_url: request.referenceImage,
          face_id: request.metadata?.faceId as string || '',
        })
        
        if (response.success && response.data) {
          return {
            code: 200,
            success: true,
            message: t('api.unified_generation_service.可灵视频生成任务2'),
            data: {
              taskId: response.data.task_id,
              status: 'processing',
              type: 'video',
              provider,
            },
            timestamp: Date.now(),
          }
        }
        throw new Error(response.message || '可灵视频生成失败')
      }
      
      case 'sora-video': {
        const { soraRequest } = await import('../ai-models')
        const response = await soraRequest({
          prompt: request.prompt,
          ...request.metadata,
        }) as { data?: any }
        
        const data = response.data as { taskId?: string; task_id?: string } | undefined
        return {
          code: 200,
          success: true,
          message: t('api.unified_generation_service.Sora视频生成3'),
          data: {
            taskId: data?.taskId || data?.task_id,
            status: 'processing',
            type: 'video',
            provider,
          },
          timestamp: Date.now(),
        }
      }
      
      case 'dashscope-video': {
        // 通义万相视频需要使用WebSocket，返回pending状态
        return {
          code: 200,
          success: true,
          message: t('api.unified_generation_service.请使用流式生成接4'),
          data: {
            status: 'pending',
            message: t('api.unified_generation_service.通义万相视频生成5'),
            type: 'video',
            provider,
          },
          timestamp: Date.now(),
        }
      }
      
      default:
        throw new Error(`不支持的视频生成提供商: ${provider}`)
    }
  }

  private async streamVideoGeneration(
    request: UnifiedGenerationRequest,
    provider: GenerationProvider,
    requestId: string,
    callbacks: GenerationWebSocketCallbacks
  ): Promise<void> {
    if (provider === 'dashscope-video') {
      const { createDashScopeVideoWebSocket } = await import('./aiGeneration.service')
      
      const ws = createDashScopeVideoWebSocket(
        {
          prompt: request.prompt,
          images: request.referenceImage,
          user_uuid: request.userUuid,
          chat_id: request.chatId,
          model: request.metadata?.model as string,
          zidingyican: request.metadata?.zidingyican as Array<{ name: string; value: any }>,
        },
        (message) => {
          const msg = message as {
            type?: string
            status?: string
            progress?: number
            data?: { video_url?: string; message?: string }
          }
          
          if (msg.type === 'progress') {
            callbacks.onProgress?.(msg.progress || 0, msg.status || '生成中')
          } else if (msg.type === 'completed' || msg.type === 'done') {
            callbacks.onComplete?.({
              status: 'completed',
              progress: 100,
              url: msg.data?.video_url,
              type: 'video',
              provider,
            })
          } else if (msg.type === 'error') {
            callbacks.onError?.(new Error(msg.data?.message || '视频生成失败'))
          }
        },
        (error) => {
          callbacks.onError?.(new Error('WebSocket连接错误'))
          logger.error('[UnifiedGeneration] WebSocket error', error)
        },
        () => {
          this.activeWebSockets.delete(requestId)
          callbacks.onClose?.()
        }
      )
      
      this.activeWebSockets.set(requestId, ws)
    } else {
      // 其他提供商使用轮询方式
      const response = await this.generateVideo(request, provider)
      if (response.success && response.data?.taskId) {
        await this.pollTaskStatus(response.data.taskId, 'video', callbacks)
      } else {
        callbacks.onError?.(new Error(response.message || '视频生成任务创建失败'))
      }
    }
  }

  private async getVideoTaskStatus(taskId: string): Promise<ApiResponse<UnifiedGenerationResponse>> {
    const { getOneClickVideoStatus } = await import('./aiGeneration.service')
    const response = await getOneClickVideoStatus(taskId)
    
    if (response.success && response.data) {
      const statusMap: Record<string, TaskStatus> = {
        pending: 'pending',
        processing: 'processing',
        generating: 'processing',
        completed: 'completed',
        success: 'completed',
        failed: 'failed',
        error: 'failed',
      }
      
      return {
        code: 200,
        success: true,
        message: response.data.message,
        data: {
          taskId,
          status: statusMap[response.data.status] || 'processing',
          message: response.data.message,
          url: (response.data.result as { url?: string })?.url,
          type: 'video',
          provider: 'one-click-video',
          metadata: response.data.result,
        },
        timestamp: Date.now(),
      }
    }
    
    throw new Error(response.message || '查询任务状态失败')
  }

  // ========== 音频生成 ==========

  private async generateAudio(
    request: UnifiedGenerationRequest,
    provider: GenerationProvider
  ): Promise<ApiResponse<UnifiedGenerationResponse>> {
    switch (provider) {
      case 'ali-timbre': {
        const { aliGenerateTimbre } = await import('../ai-models')
        const response = await aliGenerateTimbre({
          prompt: request.prompt,
          ...request.metadata,
        }) as { data?: any }
        
        const data = response.data as { url?: string; audio_url?: string } | undefined
        return {
          code: 200,
          success: true,
          message: t('api.unified_generation_service.音频生成成功6'),
          data: {
            status: 'completed',
            url: data?.url || data?.audio_url,
            type: 'audio',
            provider,
          },
          timestamp: Date.now(),
        }
      }
      
      case 'cosyvoice': {
        // CosyVoice语音合成
        const { audioStart, audioEnd } = await import('../ai-models')
        const startResponse = await audioStart({
          prompt: request.prompt,
          voice: request.voice,
          speed: request.speed,
          ...request.metadata,
        }) as { data?: any }
        
        const taskData = startResponse.data as { taskId?: string; id?: string } | undefined
        const taskId = taskData?.taskId || taskData?.id
        
        if (taskId) {
          // 轮询获取结果
          let attempts = 0
          while (attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 1000))
            const endResponse = await audioEnd(taskId) as { data?: any }
            const endData = endResponse.data as { status?: string; url?: string; audio_url?: string } | undefined
            
            if (endData?.status === 'completed' || endData?.url) {
              return {
                code: 200,
                success: true,
                message: t('api.unified_generation_service.语音合成成功7'),
                data: {
                  taskId,
                  status: 'completed',
                  url: endData.url || endData.audio_url,
                  type: 'audio',
                  provider,
                },
                timestamp: Date.now(),
              }
            }
            attempts++
          }
          throw new Error(t('error.unified_generation_service.语音合成超时12'))
        }
        
        throw new Error(t('error.unified_generation_service.语音合成任务创建13'))
      }
      
      default:
        throw new Error(`不支持的音频生成提供商: ${provider}`)
    }
  }

  // ========== 3D模型生成 ==========

  private async generate3D(
    request: UnifiedGenerationRequest,
    provider: GenerationProvider
  ): Promise<ApiResponse<UnifiedGenerationResponse>> {
    if (provider === 'hunyuan-3d') {
      const { submitHunyuan3DTask } = await import('./aiGeneration.service')
      
      const response = await submitHunyuan3DTask({
        Prompt: request.prompt,
        ImageUrl: request.referenceImage,
        ResultFormat: request.format,
        EnablePBR: request.enablePBR,
        user_uuid: request.userUuid,
      })
      
      if (response.success && response.data) {
        return {
          code: 200,
          success: true,
          message: t('api.unified_generation_service.3D生成任务已创8'),
          data: {
            taskId: response.data.job_id,
            status: 'processing',
            type: '3d',
            provider,
          },
          timestamp: Date.now(),
        }
      }
      throw new Error(response.message || '3D生成任务创建失败')
    }
    
    throw new Error(`不支持的3D生成提供商: ${provider}`)
  }

  private async get3DTaskStatus(taskId: string): Promise<ApiResponse<UnifiedGenerationResponse>> {
    const { queryHunyuan3DStatus } = await import('./aiGeneration.service')
    const response = await queryHunyuan3DStatus(taskId)
    
    if (response.success && response.data) {
      const statusMap: Record<string, TaskStatus> = {
        CREATED: 'pending',
        RUNNING: 'processing',
        SUCCEEDED: 'completed',
        FAILED: 'failed',
      }
      
      return {
        code: 200,
        success: true,
        message: response.data.message,
        data: {
          taskId,
          status: statusMap[response.data.status || ''] || 'processing',
          progress: response.data.progress,
          url: response.data.result_url,
          type: '3d',
          provider: 'hunyuan-3d',
        },
        timestamp: Date.now(),
      }
    }
    
    throw new Error(response.message || '查询3D任务状态失败')
  }

  // ========== 视觉分析 ==========

  private async analyzeVision(
    request: UnifiedGenerationRequest,
    provider: GenerationProvider
  ): Promise<ApiResponse<UnifiedGenerationResponse>> {
    if (provider === 'dashscope-vision') {
      const { chatDashScopeVision } = await import('./aiGeneration.service')
      
      if (!request.referenceImage) {
        throw new Error(t('error.unified_generation_service.视觉分析需要提供14'))
      }
      
      const response = await chatDashScopeVision({
        images: request.referenceImage,
        prompt: request.prompt,
        user_uuid: request.userUuid,
        chat_id: request.chatId,
        model: request.metadata?.model as string,
      })
      
      if (response.success && response.data) {
        return {
          code: 200,
          success: true,
          message: t('api.unified_generation_service.视觉分析完成9'),
          data: {
            status: 'completed',
            type: 'vision',
            provider,
            metadata: {
              reasoning: response.data.reasoning,
              answer: response.data.answer,
              images: response.data.images,
            },
          },
          timestamp: Date.now(),
        }
      }
      throw new Error(response.message || '视觉分析失败')
    }
    
    throw new Error(`不支持的视觉分析提供商: ${provider}`)
  }

  // ========== 音乐生成 ==========

  private async generateMusic(
    request: UnifiedGenerationRequest,
    _provider: GenerationProvider
  ): Promise<ApiResponse<UnifiedGenerationResponse>> {
    // 音乐生成可以复用音频生成接口，或使用专门的音乐生成API
    // 目前使用阿里音色生成作为基础
    return this.generateAudio(request, 'ali-timbre')
  }

  // ========== 辅助方法 ==========

  private getDefaultProvider(type: GenerationType): GenerationProvider {
    const defaults: Record<GenerationType, GenerationProvider> = {
      image: 'qwen-image',
      video: 'dashscope-video',
      audio: 'ali-timbre',
      '3d': 'hunyuan-3d',
      vision: 'dashscope-vision',
      music: 'ali-timbre',
    }
    return defaults[type]
  }

  private normalizeImageResponse(
    response: ApiResponse<{ success?: boolean; message?: string; image_url?: string; image_urls?: string[] }>,
    provider: GenerationProvider
  ): ApiResponse<UnifiedGenerationResponse> {
    if (response.success && response.data) {
      const url = response.data.image_url || response.data.image_urls?.[0]
      const urls = response.data.image_urls || (response.data.image_url ? [response.data.image_url] : undefined)
      
      return {
        code: 200,
        success: true,
        message: t('api.unified_generation_service.图片生成成功10'),
        data: {
          status: 'completed',
          url,
          urls,
          type: 'image',
          provider,
        },
        timestamp: Date.now(),
      }
    }
    throw new Error(response.message || '图片生成失败')
  }

  private async pollTaskStatus(
    taskId: string,
    type: GenerationType,
    callbacks: GenerationWebSocketCallbacks,
    maxAttempts = 120,
    interval = 2000
  ): Promise<void> {
    let attempts = 0
    
    const poll = async () => {
      try {
        const response = await this.getTaskStatus(taskId, type)
        
        if (response.success && response.data) {
          const { status, progress } = response.data
          
          callbacks.onProgress?.(progress || Math.min(attempts * 2, 90), `状态: ${status}`)
          
          if (status === 'completed') {
            callbacks.onComplete?.(response.data)
            return
          } else if (status === 'failed') {
            callbacks.onError?.(new Error(response.data.error || '任务执行失败'))
            return
          }
        }
        
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, interval)
        } else {
          callbacks.onError?.(new Error('任务执行超时'))
        }
      } catch (error) {
        callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
      }
    }
    
    await poll()
  }

  private createErrorResponse(
    error: any,
    type: GenerationType,
    provider: GenerationProvider
  ): ApiResponse<UnifiedGenerationResponse> {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    return {
      code: 500,
      success: false,
      message: errorMessage,
      data: {
        status: 'failed',
        type,
        provider,
        error: errorMessage,
      },
      timestamp: Date.now(),
    }
  }
}

// ============================================================================
// 导出单例和便捷函数
// ============================================================================

export const unifiedGenerationService = new UnifiedGenerationService()

/** 发起生成请求 */
export async function generateContent(
  request: UnifiedGenerationRequest
): Promise<ApiResponse<UnifiedGenerationResponse>> {
  return unifiedGenerationService.generate(request)
}

/** 发起流式生成 */
export async function generateContentStream(
  request: UnifiedGenerationRequest,
  callbacks: GenerationWebSocketCallbacks
): Promise<string> {
  return unifiedGenerationService.generateStream(request, callbacks)
}

/** 查询任务状态 */
export async function getGenerationTaskStatus(
  taskId: string,
  type: GenerationType
): Promise<ApiResponse<UnifiedGenerationResponse>> {
  return unifiedGenerationService.getTaskStatus(taskId, type)
}

/** 取消任务 */
export function cancelGenerationTask(requestId: string): void {
  unifiedGenerationService.cancelTask(requestId)
}

export default unifiedGenerationService
