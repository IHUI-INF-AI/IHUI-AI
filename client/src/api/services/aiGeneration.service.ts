/**
 * AI内容生成服务（图像、视频、3D等）
 * 整合所有AI生成功能的统一接口
 */

import { COZE_PATHS } from '@/config/backend-paths'
import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'
import { logger } from '@/utils/logger'
import { t } from '@/utils/i18n'

// ========== 通义千问图像生成 ==========

export interface DashScopeImageGenRequest {
  prompt: string
  user_uuid: string
  /** 会话 ID（后端 chat 的 id，如 \"1168\"） */
  chat_id?: string
  /** 模型标识（如万象2.6图片创作），走 cozeZhsApi/dashscope/image/generate */
  model?: string
  /** 图片 URL 列表，文生图时建议传 []，图生图/多图融合时传 [url] 或 [url1, url2, ...] */
  images?: string[]
  /** 自定义参数，如 negative_prompt 等，从大模型列表 variables 透传 */
  zidingyican?: Array<{ name: string; value: unknown }>
}

export interface DashScopeImageGenResponse {
  success: boolean
  message: string
  image_url?: string
  total_tokens?: number
  request_id?: string
}

export const generateDashScopeImage = withApiResponseHandler(
  async (
    model: string,
    data: DashScopeImageGenRequest
  ): Promise<ApiResponse<DashScopeImageGenResponse>> => {
    const response = await request.post<DashScopeImageGenResponse>(
      COZE_PATHS.dashscope.imageGenerate(model),
      data
    )
    const normalized = normalizeApiResponse<DashScopeImageGenResponse>(response)
    // 兼容后端将 total_tokens / request_id 放在 data 外层的情况
    const payload = (response as unknown as { data?: unknown })?.data ?? response
    if (payload && typeof payload === 'object' && normalized.data && typeof normalized.data === 'object') {
      const extra = payload as { total_tokens?: number; request_id?: string }
      normalized.data = {
        ...(normalized.data as unknown as Record<string, unknown>),
        ...(typeof extra.total_tokens === 'number' ? { total_tokens: extra.total_tokens } : {}),
        ...(extra.request_id ? { request_id: extra.request_id } : {}),
      } as DashScopeImageGenResponse
    }
    return normalized
  }
)

// ========== 通义万相图生图 ==========

export interface DashScopeImageToImageRequest {
  /** 图片 URL 列表，文生图时传 []，图生图时传 [url] 或 [url1, url2, ...] */
  images: string[]
  prompt: string
  user_uuid: string
  /** 会话 ID（后端 chat 的 id，如 "1168"） */
  chat_id?: string
  /** 模型标识（如万象2.6图片创作），走 cozeZhsApi/dashscope/image-to-image/generate */
  model?: string
  /** 自定义参数，如 negative_prompt 等 */
  zidingyican?: Array<{ name: string; desc: string; value: unknown }>
}

export interface DashScopeImageToImageResponse {
  success: boolean
  message: string
  image_urls?: string[]
  total_tokens?: number
  /** 便于前端展示/排查的请求ID（后端如有返回） */
  request_id?: string
}

export const generateDashScopeImageToImage = withApiResponseHandler(
  async (
    data: DashScopeImageToImageRequest
  ): Promise<ApiResponse<DashScopeImageToImageResponse>> => {
    const response = await request.post<DashScopeImageToImageResponse>(
      COZE_PATHS.dashscope.imageToImage,
      data
    )
    const normalized = normalizeApiResponse<DashScopeImageToImageResponse>(response)
    // 兼容后端将 total_tokens / request_id 放在 data 外层的情况
    const payload = (response as unknown as { data?: unknown })?.data ?? response
    if (payload && typeof payload === 'object' && normalized.data && typeof normalized.data === 'object') {
      const extra = payload as { total_tokens?: number; request_id?: string }
      normalized.data = {
        ...(normalized.data as unknown as Record<string, unknown>),
        ...(typeof extra.total_tokens === 'number' ? { total_tokens: extra.total_tokens } : {}),
        ...(extra.request_id ? { request_id: extra.request_id } : {}),
      } as DashScopeImageToImageResponse
    }
    return normalized
  }
)

// ========== 通义千问图像编辑 ==========

export interface DashScopeImageEditRequest {
  messages: Array<{
    role: string
    content: Array<{ image?: string; text?: string }>
  }>
  model?: string
  user_uuid: string
  parameters?: {
    negative_prompt?: string
    prompt_extend?: boolean
    watermark?: boolean
  }
}

export interface DashScopeImageEditResponse {
  success: boolean
  message: string
  image_url?: string
  total_tokens?: number
}

export const editDashScopeImage = withApiResponseHandler(
  async (data: DashScopeImageEditRequest): Promise<ApiResponse<DashScopeImageEditResponse>> => {
    const response = await request.post<DashScopeImageEditResponse>(
      COZE_PATHS.dashscope.imageEdit,
      data
    )
    return normalizeApiResponse(response)
  }
)

// ========== 通义千问视觉模型 ==========

export interface DashScopeVisionRequest {
  images: string
  prompt: string
  user_uuid: string
  chat_id?: string
  model?: string
}

export interface DashScopeVisionResponse {
  success: boolean
  message: string
  reasoning?: string
  answer?: string
  images?: string
  total_tokens?: number
}

export const chatDashScopeVision = withApiResponseHandler(
  async (data: DashScopeVisionRequest): Promise<ApiResponse<DashScopeVisionResponse>> => {
    const response = await request.post<DashScopeVisionResponse>(
      COZE_PATHS.dashscope.visionChat,
      data
    )
    return normalizeApiResponse(response)
  }
)

// ========== 通义万相视频合成（WebSocket流式） ==========
// 请求字段与小程序 aiWebSocketMixin 对齐：img_url、model、chat_id、zidingyican、prompt_extend、watermark

export interface DashScopeVideoSynthesisRequest {
  prompt: string
  /** 首帧图 URL（与小程序一致用 img_url；部分后端也接受 images） */
  img_url?: string
  /** 首帧图 URL 数组，即梦等接口要求必传 images 数组 */
  images?: string | string[]
  user_uuid: string
  chat_id?: string
  /** 模型标识，如 wan2.5-i2v-preview */
  model?: string
  prompt_extend?: boolean
  watermark?: boolean
  zidingyican?: Array<{ name: string; value: unknown }>
  /** 视频时长，如 "5" */
  duration?: string | number
  /** 画面方向/比例，如 0 */
  orientation?: number
  /** 运镜，如 "平移" */
  movement?: string
  /** 帧数，如 121 */
  frames?: number
  /** 缩放等，如 0 */
  scale?: number
  /** 是否增强清晰度 */
  enhance_clarity?: boolean
  [key: string]: unknown
}

export const createDashScopeVideoWebSocket = (
  data: DashScopeVideoSynthesisRequest,
  onMessage: (message: unknown) => void,
  onError?: (error: Event) => void,
  onClose?: () => void
): WebSocket => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  const wsUrl = `${protocol}//${host}${COZE_PATHS.dashscope.videoSynthesisWs}`

  const ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    // 只发送有值的字段，避免 undefined 导致后端校验异常；同时透传后端要求的顶层字段
    const payload: Record<string, unknown> = {
      prompt: data.prompt,
      user_uuid: data.user_uuid,
    }
    if (data.img_url) payload.img_url = data.img_url
    if (data.images) payload.images = data.images
    if (data.chat_id) payload.chat_id = data.chat_id
    if (data.model) payload.model = data.model
    if (data.prompt_extend !== undefined) payload.prompt_extend = data.prompt_extend
    if (data.watermark !== undefined) payload.watermark = data.watermark
    if (data.zidingyican && data.zidingyican.length > 0) payload.zidingyican = data.zidingyican
    // 视频合成接口要求的顶层参数（与后端/小程序一致）
    if (data.duration !== undefined) payload.duration = data.duration
    if (data.orientation !== undefined) payload.orientation = data.orientation
    if (data.movement !== undefined) payload.movement = data.movement
    if (data.frames !== undefined) payload.frames = data.frames
    if (data.scale !== undefined) payload.scale = data.scale
    if (data.enhance_clarity !== undefined) payload.enhance_clarity = data.enhance_clarity
    ws.send(JSON.stringify(payload))
  }

  ws.onmessage = event => {
    try {
      const message = JSON.parse(event.data)
      onMessage(message)
    } catch (error) {
      logger.error('WebSocket: ' + t('common.errors.websocketParseFailed'), error)
    }
  }

  if (onError) {
    ws.onerror = onError
  }

  if (onClose) {
    ws.onclose = onClose
  }

  return ws
}

/**
 * 按指定路径创建视频生成 WebSocket（用于即梦等非通义视频模型，接口路径由 remark 配置）
 * @param wsPath 相对路径，如 /cozeZhsApi/proxy/doubao-seedance-video/ws
 */
export const createVideoWebSocketByPath = (
  wsPath: string,
  data: DashScopeVideoSynthesisRequest,
  onMessage: (message: unknown) => void,
  onError?: (error: Event) => void,
  onClose?: () => void
): WebSocket => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  const path = wsPath.startsWith('/') ? wsPath : `/${wsPath}`
  const wsUrl = `${protocol}//${host}${path}`

  const ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    const payload: Record<string, unknown> = {
      prompt: data.prompt,
      user_uuid: data.user_uuid,
    }
    if (data.img_url) payload.img_url = data.img_url
    if (data.images) payload.images = data.images
    if (data.chat_id) payload.chat_id = data.chat_id
    if (data.model) payload.model = data.model
    if (data.prompt_extend !== undefined) payload.prompt_extend = data.prompt_extend
    if (data.watermark !== undefined) payload.watermark = data.watermark
    if (data.zidingyican && data.zidingyican.length > 0) payload.zidingyican = data.zidingyican
    if (data.duration !== undefined) payload.duration = data.duration
    if (data.orientation !== undefined) payload.orientation = data.orientation
    if (data.movement !== undefined) payload.movement = data.movement
    if (data.frames !== undefined) payload.frames = data.frames
    if (data.scale !== undefined) payload.scale = data.scale
    if (data.enhance_clarity !== undefined) payload.enhance_clarity = data.enhance_clarity
    ws.send(JSON.stringify(payload))
  }

  ws.onmessage = event => {
    try {
      const message = JSON.parse(event.data)
      onMessage(message)
    } catch (error) {
      logger.error('WebSocket: ' + t('common.errors.websocketParseFailed'), error)
    }
  }

  if (onError) ws.onerror = onError
  if (onClose) ws.onclose = onClose

  return ws
}

// ========== 豆包图像生成 ==========

export interface DoubaoImageGenRequest {
  prompt: string
  user_uuid: string
  chat_id?: string
  style?: string
  size?: string
}

export interface DoubaoImageGenResponse {
  success: boolean
  message: string
  image_url?: string
}

export const generateDoubaoImage = withApiResponseHandler(
  async (data: DoubaoImageGenRequest): Promise<ApiResponse<DoubaoImageGenResponse>> => {
    const response = await request.post<DoubaoImageGenResponse>(
      COZE_PATHS.proxy.doubaoImageGeneration,
      data
    )
    return normalizeApiResponse(response)
  }
)

// ========== 即梦图像生成 ==========

export interface Jimeng4ImageGenRequest {
  prompt: string
  user_uuid: string
  chat_id?: string
  image_urls?: string[]
  size?: number
  width?: number
  height?: number
  seed?: number
  scale?: number
  force_single?: boolean
}

export interface Jimeng4ImageGenResponse {
  success: boolean
  message: string
  /** 即梦返回的单张图片地址（与小程序保持一致） */
  image_url?: string
  image_urls?: string[]
  total_tokens?: number
  request_id?: string
}

export const generateJimeng4Image = withApiResponseHandler(
  async (data: Jimeng4ImageGenRequest): Promise<ApiResponse<Jimeng4ImageGenResponse>> => {
    const response = await request.post<Jimeng4ImageGenResponse>(
      COZE_PATHS.proxy.jimeng4Image,
      data
    )
    const normalized = normalizeApiResponse<Jimeng4ImageGenResponse>(response)

    // 兼容多种返回结构：
    // 1. { code:10000, msg, image_url, total_tokens, ... }
    // 2. { code:10000, msg, data:{ image_url, image_urls, total_tokens, request_id } }
    // 3. 直接返回 { image_url, image_urls, ... }
    const payload = (response as unknown as { data?: unknown })?.data ?? response
    const dataObj = (normalized.data || {}) as unknown as Record<string, unknown>

    if (payload && typeof payload === 'object') {
      const extra = payload as {
        image_url?: string
        image_urls?: string[]
        total_tokens?: number
        request_id?: string
      }

      const merged: Jimeng4ImageGenResponse = {
        success: (normalized as ApiResponse<unknown>).success ?? false,
        message: (normalized as ApiResponse<unknown>).message ?? '',
        image_url: (dataObj.image_url as string | undefined) ?? extra.image_url,
        image_urls:
          (dataObj.image_urls as string[] | undefined) ??
          extra.image_urls ??
          (extra.image_url ? [extra.image_url] : undefined),
        total_tokens:
          (dataObj.total_tokens as number | undefined) ?? extra.total_tokens,
        request_id:
          (dataObj.request_id as string | undefined) ?? extra.request_id,
      }

      normalized.data = merged
    }

    return normalized
  }
)

// ========== 可灵AI视频生成 ==========

export interface KlingVideoIdentifyRequest {
  user_uuid: string
  video_id?: string
  video_url?: string
}

export interface KlingVideoIdentifyResponse {
  success: boolean
  message: string
  session_id?: string
  face_data?: Array<{
    face_id: string
    time_range: [number, number]
  }>
}

export const identifyKlingVideo = withApiResponseHandler(
  async (data: KlingVideoIdentifyRequest): Promise<ApiResponse<KlingVideoIdentifyResponse>> => {
    const response = await request.post<KlingVideoIdentifyResponse>(
      COZE_PATHS.kling.videoIdentify,
      data
    )
    return normalizeApiResponse(response)
  }
)

export interface KlingVideoCreateRequest {
  user_uuid: string
  video_id?: string
  video_url?: string
  face_id: string
  prompt: string
  chat_id?: string
}

export interface KlingVideoCreateResponse {
  success: boolean
  message: string
  task_id?: string
}

export const createKlingVideo = withApiResponseHandler(
  async (data: KlingVideoCreateRequest): Promise<ApiResponse<KlingVideoCreateResponse>> => {
    const response = await request.post<KlingVideoCreateResponse>(
      COZE_PATHS.kling.videoCreate,
      data
    )
    return normalizeApiResponse(response)
  }
)

// ========== 腾讯混元3D ==========

export interface TencentHunyuan3DRequest {
  Prompt?: string
  ImageBase64?: string
  ImageUrl?: string
  MultiViewImages?: Array<{
    View: string
    ImageBase64?: string
    ImageUrl?: string
  }>
  ResultFormat?: string
  EnablePBR?: boolean
  user_uuid: string
}

export interface TencentHunyuan3DResponse {
  success: boolean
  message: string
  job_id?: string
}

export const submitHunyuan3DTask = withApiResponseHandler(
  async (data: TencentHunyuan3DRequest): Promise<ApiResponse<TencentHunyuan3DResponse>> => {
    const response = await request.post<TencentHunyuan3DResponse>('/tencent/hunyuan3d/submit', data)
    return normalizeApiResponse(response)
  }
)

export interface TencentHunyuan3DStatusResponse {
  success: boolean
  message: string
  job_id?: string
  status?: string
  result_url?: string
  progress?: number
}

export const queryHunyuan3DStatus = withApiResponseHandler(
  async (jobId: string): Promise<ApiResponse<TencentHunyuan3DStatusResponse>> => {
    const response = await request.get<TencentHunyuan3DStatusResponse>(
      `/tencent/hunyuan3d/job/${jobId}`
    )
    return normalizeApiResponse(response)
  }
)

// ========== 一键视频生成 ==========

export interface OneClickVideoRequest {
  topic: string
  video_duration?: number
  video_ratio?: string
  audio_prompt?: string
  user_uuid: string
  chat_id?: string
}

export interface OneClickVideoResponse {
  task_id: string
  message: string
}

export const startOneClickVideo = withApiResponseHandler(
  async (data: OneClickVideoRequest): Promise<ApiResponse<OneClickVideoResponse>> => {
    const response = await request.post<OneClickVideoResponse>(
      COZE_PATHS.oneClickVideo.start,
      data
    )
    return normalizeApiResponse(response)
  }
)

export interface OneClickVideoStatusResponse {
  task_id: string
  status: string
  message: string
  result?: Record<string, unknown>
}

export const getOneClickVideoStatus = withApiResponseHandler(
  async (taskId: string): Promise<ApiResponse<OneClickVideoStatusResponse>> => {
    const response = await request.get<OneClickVideoStatusResponse>(
      COZE_PATHS.oneClickVideo.status(taskId)
    )
    return normalizeApiResponse(response)
  }
)
