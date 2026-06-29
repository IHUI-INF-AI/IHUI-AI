import { t } from '@/utils/i18n'

import request from '@/utils/request'
import { logger } from '../utils/logger'
import { isDemoMode } from '@/utils/envUtils'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { DEVELOPER_PATHS, COZE_PATHS, API_V1_PATHS } from '@/config/backend-paths'

// 大模型类型
export type ModelType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'coze'
  | 'dashscope'
  | 'baidu' // 百度文心一言
  | 'alibaba' // 阿里通义千问
  | 'tencent' // 腾讯混元
  | 'doubao' // 字节豆包
  | 'zhipu' // 智谱AI
  | 'moonshot' // Moonshot AI
  | 'custom'

// 定价配置接口
export interface PricingConfig {
  inputTokenPrice: number // 输入Token价格（$/1K tokens）
  outputTokenPrice: number // 输出Token价格（$/1K tokens）
  imagePrice?: number // 图像生成价格（$/image）
  audioPrice?: number // 音频价格（$/minute）
  videoPrice?: number // 视频价格（$/minute）
  regionPricing?: {
    // 按地区定价
    [region: string]: {
      inputTokenPrice: number
      outputTokenPrice: number
      imagePrice?: number
      audioPrice?: number
      videoPrice?: number
    }
  }
  bulkDiscounts?: {
    // 批量折扣
    thresholds: number[] // 数量阈值
    discounts: number[] // 折扣率（0-1）
  }
}

// 中转服务配置接口
export interface ProxyConfig {
  proxyUrl?: string // 代理服务器URL
  loadBalanceStrategy?: 'round-robin' | 'least-connections' | 'weighted'
  failoverEnabled?: boolean // 启用故障转移
  cacheEnabled?: boolean // 启用缓存
  cacheTTL?: number // 缓存TTL（秒）
  rateLimit?: {
    // 限流配置
    qps: number // 每秒请求数
    burst: number // 突发请求数
  }
  apiKeys?: string[] // 多API密钥（用于轮询）
  healthCheck?: {
    // 健康检查
    enabled: boolean
    interval: number // 检查间隔（秒）
    timeout: number // 超时时间（秒）
  }
}

// 大模型接口
export interface AIModel {
  id: string
  code?: string
  name: string
  displayName?: string // 显示名称（中文名称）
  type: 'talk' | 'image' | 'video' | 'audio'
  provider: string
  modelId: string // 模型ID，如 gpt-4, claude-3-opus
  apiKey?: string
  baseUrl?: string
  description?: string
  capabilities?: string[] // 能力列表：chat, image, audio, video等
  maxTokens?: number
  temperature?: number
  enabled: boolean
  usageCount?: number
  lastUsed?: string
  createTime?: string
  updateTime?: string
  // 定价配置
  pricing?: PricingConfig
  // 中转服务配置
  proxy?: ProxyConfig
  // 模型特定配置
  config?: Record<string, unknown>
  // 模型功能类别（用于向后兼容）
  category?: 'talk' | 'image' | 'video' | 'audio'
  // 是否可用（用于向后兼容）
  isAvailable?: boolean
}

// AI模型信息接口（用于前端展示）
export interface AIModelInfo {
  id: string
  code?: string
  name: string
  displayName?: string
  provider: string
  description?: string
  category: 'talk' | 'image' | 'video' | 'audio'
  isAvailable: boolean
  supportsStreaming?: boolean
  supportsImages?: boolean
  supportsAudio?: boolean
  supportsVideo?: boolean
  icon?: string
  usageCount?: number
  rating?: number
  tags?: string[]
  /** 接口地址（从大模型列表取，用于请求时不再写死） */
  remark?: string
  /** 请求方式：ws/websocket → WebSocket，否则 → HTTP */
  quest_type?: string
  /** 模型自定义参数列表（用于请求时的 zidingyican），从大模型列表接口透传 */
  variables?: unknown
}

// 获取大模型列表
export async function getModelsList(
  params?: PaginationParams & {
    type?: ModelType
    enabled?: boolean
  }
): Promise<ApiResponse<PaginationResponse<AIModel>>> {
  try {
    if (isDemoMode()) {
      const list: AIModel[] = [
        {
          id: 'demo-gpt4',
          modelId: 'gpt-4-demo',
          name: 'Demo GPT-4',
          provider: 'OpenAI',
          type: 'talk',
          enabled: true,
          description: t('text.models.演示大模型供界面45'),
          usageCount: 120,
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString(),
        },
      ]
      return {
        code: 200,
        success: true,
        message: t('api.models.演示数据'),
        data: {
          list,
          pagination: {
            page: params?.page || 1,
            pageSize: params?.pageSize || 20,
            total: list.length,
            totalPages: 1,
          },
        },
        timestamp: Date.now(),
      }
    }

    // 将 enabled 布尔值转换为字符串，以便作为查询参数传递
    const queryParams: Record<string, unknown> = { ...params }
    if (queryParams.enabled !== undefined) {
      queryParams.enabled = queryParams.enabled ? 'true' : 'false'
    }

    const response = await request.get(DEVELOPER_PATHS.models.list, {
      params: queryParams,
    })
    return {
      code: 200,
      success: true,
      message: t('api.models.获取成功1'),
      data: response.data || {
        list: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0,
        },
      },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    // 静默处理错误，返回空列表，避免影响用户体验
    const axiosError = error as {
      response?: { status?: number; data?: { message?: string } }
      message?: string
    }
    const statusCode = axiosError.response?.status || 500
    if (import.meta.env.DEV) {
      const errorMsg =
        axiosError.response?.data?.message ||
        (error instanceof Error ? error.message : String(error))
      logger.warn('Failed to fetch model list (ignored):', statusCode, errorMsg)
    }

    // 对于 500 错误，返回成功状态但数据为空，避免前端显示错误
    if (statusCode === 500 || statusCode >= 500) {
      return {
        code: 200, // 返回 200，避免前端显示错误
        success: true,
        message: t('api.models.暂无可用模型2'),
        data: {
          list: [],
          pagination: {
            page: params?.page || 1,
            pageSize: params?.pageSize || 20,
            total: 0,
            totalPages: 0,
          },
        },
        timestamp: Date.now(),
      }
    }

    // 其他错误（如 401）保持原样
    const errorMessage =
      axiosError.response?.data?.message ||
      (error instanceof Error ? error.message : String(error)) ||
      t('api.models.获取列表失败')

    return {
      code: statusCode,
      success: false,
      message: errorMessage,
      data: {
        list: [],
        pagination: {
          page: params?.page || 1,
          pageSize: params?.pageSize || 20,
          total: 0,
          totalPages: 0,
        },
      },
      timestamp: Date.now(),
    }
  }
}

// 获取大模型详情
export async function getModelDetail(id: string): Promise<ApiResponse<AIModel>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.models.byId(id))
    return {
      code: 200,
      success: true,
      message: t('api.models.获取成功3'),
      data: response.data || ({} as AIModel),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('Failed to fetch model detail:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.models.获取详情失败'),
      data: {} as AIModel,
      timestamp: Date.now(),
    }
  }
}

// 创建大模型配置
export async function createModel(model: Partial<AIModel>): Promise<ApiResponse<AIModel>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.models.list, model)
    return {
      code: 200,
      success: true,
      message: t('api.models.创建成功4'),
      data: response.data || ({} as AIModel),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.models.创建配置失败'),
      data: {} as AIModel,
      timestamp: Date.now(),
    }
  }
}

// 更新大模型配置
export async function updateModel(
  id: string,
  model: Partial<AIModel>
): Promise<ApiResponse<AIModel>> {
  try {
    const response = await request.put(DEVELOPER_PATHS.models.byId(id), model)
    return {
      code: 200,
      success: true,
      message: t('api.models.更新成功5'),
      data: response.data || ({} as AIModel),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('Failed to update model config:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.models.更新配置失败'),
      data: {} as AIModel,
      timestamp: Date.now(),
    }
  }
}

// 删除大模型配置
export async function deleteModel(id: string): Promise<ApiResponse<boolean>> {
  try {
    const _response = await request.delete(DEVELOPER_PATHS.models.byId(id))
    return {
      code: 200,
      success: true,
      message: t('api.models.删除成功6'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.models.删除配置失败'),
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 切换模型（与小程序端一致）
export async function switchModel(data: {
  model_id: string
  session_id?: string
}): Promise<ApiResponse<{ current_model: string; context_kept?: boolean }>> {
  try {
    const response = await request.post(API_V1_PATHS.model.switch, {
      model_id: data.model_id,
      session_id: data.session_id,
    })
    return {
      code: 200,
      success: true,
      message: t('api.models.模型切换成功7'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('Failed to switch model:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.models.切换失败'),
      data: { current_model: data.model_id, context_kept: false },
      timestamp: Date.now(),
    }
  }
}

// 测试大模型连接
export async function testModel(
  id: string
): Promise<ApiResponse<{ success: boolean; message: string }>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.models.test(id))
    return {
      code: 200,
      success: true,
      message: t('api.models.测试成功8'),
      data: response.data || { success: false, message: t('api.models.未知错误9') },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.models.测试连接失败'),
      data: { success: false, message: error instanceof Error ? error.message : String(error) },
      timestamp: Date.now(),
    }
  }
}

// 调用模型
export async function callModel(data: {
  modelId: string
  messages: Array<{ role: string; content: string }>
  temperature?: number
  maxTokens?: number
  stream?: boolean
}): Promise<ApiResponse<unknown>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.models.chat(data.modelId), {
      messages: data.messages,
      temperature: data.temperature,
      maxTokens: data.maxTokens,
      stream: data.stream || false,
    })
    return {
      code: 200,
      success: true,
      message: t('api.models.调用成功10'),
      data: response.data,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('Failed to call model:', error)
    const errorMessage = error instanceof Error ? error.message : t('api.models.调用模型失败')
    return {
      code: 500,
      success: false,
      message: errorMessage,
      data: null,
      timestamp: Date.now(),
    }
  }
}

/**
 * 获取模型的能力和优势描述
 * 根据模型名称返回简介扼要的描述，突出模型的核心能力和优势
 */
function getModelDescription(modelName: string, sourceName?: string): string {
  const nameLower = (modelName || '').toLowerCase()
  const sourceLower = (sourceName || '').toLowerCase()

  // 根据模型名称匹配描述（按优先级排序，更具体的匹配置前）
  if (nameLower.includes('wan2.5-i2i-preview') || sourceLower.includes('万象2.6图片创作')) {
    return t('text.models.单图编辑多图融合22')
  }

  if (nameLower.includes('wan2.5-i2v-preview') || sourceLower.includes('通义2.6视频生成')) {
    return t('text.models.多镜头叙事原生音23')
  }

  if ((nameLower.includes('seedream') || nameLower.includes('doubao-seedream')) && (sourceLower.includes('4.5') || sourceLower.includes('4.0') || nameLower.includes('4.0'))) {
    return t('text.models.多模态输入多图融24')
  }

  if (nameLower.includes('seedream') || nameLower.includes('doubao-seedream') || sourceLower.includes('即梦')) {
    return t('text.models.多图融合创作参考25')
  }

  if ((nameLower.includes('nano') && nameLower.includes('banana')) || sourceLower.includes('nano banana')) {
    return t('text.models.4K超高清AI思26')
  }

  if (nameLower.includes('qwen-omni') || sourceLower.includes('通义千问3-omni') || sourceLower.includes('多模态理解')) {
    return t('text.models.多模态理解能力支27')
  }

  if (nameLower.includes('qwen-plus') || sourceLower.includes('通义千问3-max')) {
    return t('text.models.强大的语言理解与28')
  }

  if (nameLower.includes('qwen3-vl') || sourceLower.includes('通义千问3-vl-plus') || sourceLower.includes('视频理解')) {
    return t('text.models.视频理解与分析内29')
  }

  if (nameLower.includes('glm-4.5') || sourceLower.includes('智谱4.6')) {
    return t('text.models.高性能语言模型复30')
  }

  if (nameLower.includes('doubao-1.6') || sourceLower.includes('豆包1.6')) {
    return t('text.models.智能对话与文本生31')
  }

  if (nameLower.includes('deepseek-reasoner') || sourceLower.includes('ds-v3.2') || sourceLower.includes('deepseek')) {
    return t('text.models.深度推理能力复杂32')
  }

  if (nameLower.includes('veo3') || nameLower.includes('veo3.1') || sourceLower.includes('谷歌veo') || sourceLower.includes('veo3.1')) {
    return t('text.models.高质量视频生成长33')
  }

  if (nameLower.includes('sora-2') || (sourceLower.includes('sora') && !sourceLower.includes('seedream'))) {
    return t('text.models.先进视频生成技术34')
  }

  if (nameLower.includes('doubao-seedance') || sourceLower.includes('即梦1.5视频生成')) {
    return t('text.models.视频生成能力文生35')
  }

  if (nameLower.includes('cosyvoice') || sourceLower.includes('通义语音合成')) {
    return t('text.models.高质量语音合成多36')
  }

  if (nameLower.includes('suno') || sourceLower.includes('suno5.0')) {
    return t('text.models.AI音乐生成多种37')
  }

  if (nameLower.includes('gemini-3-pro') || sourceLower.includes('gemini-3-pro-preview')) {
    return t('text.models.多模态AI模型强38')
  }

  if (nameLower.includes('keling') || sourceLower.includes('智汇ai数字人') || sourceLower.includes('数字人')) {
    return t('text.models.数字人交互自然对39')
  }

  // 根据类型返回默认描述
  if (sourceLower.includes('文本') || sourceLower.includes('对话') || sourceLower.includes('语言')) {
    return t('text.models.智能文本生成与对40')
  }

  if (sourceLower.includes('图片') || sourceLower.includes('图像') || sourceLower.includes('生图')) {
    return t('text.models.高质量图像生成多41')
  }

  if (sourceLower.includes('视频')) {
    return t('text.models.专业视频生成多种42')
  }

  if (sourceLower.includes('语音') || sourceLower.includes('音频')) {
    return t('text.models.高质量音频处理语43')
  }

  // 默认描述
  return t('text.models.强大的AI能力多44')
}

// 获取可用的AI模型列表（用于前端展示）
export async function getAvailableModels(): Promise<ApiResponse<AIModelInfo[]>> {
  try {
    logger.debug('[Models API] Starting to get available model list (unified interface)')

    // 从统一大模型列表接口获取模型列表
    let modelsResponse: ApiResponse<PaginationResponse<AIModel>>

    try {
      // 首先尝试从统一大模型列表接口获取
      const aiModelInfoResponse = await request.get(COZE_PATHS.aiModelInfo.list)

      logger.debug('[Models API] Unified model list API original response:', aiModelInfoResponse)
      logger.debug('[Models API] Unified model list API response data:', aiModelInfoResponse.data)
      logger.debug('[Models API] Response type:', typeof aiModelInfoResponse)
      logger.debug('[Models API] response.data type:', typeof aiModelInfoResponse.data)
      logger.debug('[Models API] response.data value:', JSON.stringify(aiModelInfoResponse.data).substring(0, 500))

      // 处理多种可能的响应格式
      // axios 会将 HTTP 响应的 body 放在 response.data 中
      // 后端返回格式：{ "code": 0, "data": [...] }，所以 response.data = { code: 0, data: [...] }
      interface AIModelInfoItem {
        id: string
        name: string
        [key: string]: unknown
      }
      let aiModelInfoList: AIModelInfoItem[] = []

      // 首先处理 axios 的标准格式：response.data
      const responseData = aiModelInfoResponse.data

      // 根据实际API返回，后端返回格式是 { "code": 0, "data": [...] }
      // axios 会将 HTTP 响应的 body 放在 response.data 中，所以：
      // response.data = { code: 0, data: [...] }
      // response.data.data = [...] (这是数组)

      // 情况1：responseData 直接是数组（不太可能，但作为备用）
      if (Array.isArray(responseData)) {
        aiModelInfoList = responseData
        logger.debug('[Models API] Case 1: responseData is array, count:', aiModelInfoList.length)
      }
      // 情况2：responseData 是对象 { code: 0, data: [...] }（后端返回标准格式）
      else if (responseData && typeof responseData === 'object') {
        // 如果包含 code 和 data 字段（后端标准格式）
        if ('code' in responseData && 'data' in responseData) {
          const code = responseData.code
          const data = responseData.data

          logger.debug(`[Models API] 检测到 code: ${code}, data 类型: ${typeof data}, 是否为数组: ${Array.isArray(data)}`)

          // code: 0 或 200 表示成功（后端返回格式：code: 0 表示成功）
          // 无论 code 是多少，只要 data 是数组，就使用它
          if (Array.isArray(data)) {
            aiModelInfoList = data
            logger.debug(`[Models API] 情况2: 从 responseData.data 解析（code=${code}），数量:`, aiModelInfoList.length)
          } else {
            logger.warn('[Models API] responseData.data is not an array:', typeof data, data)
          }
        }
        // 如果 data 字段是数组（嵌套结构，但没有 code 字段）
        else if ('data' in responseData && Array.isArray((responseData as { data?: AIModelInfoItem[] }).data)) {
          aiModelInfoList = (responseData as { data: AIModelInfoItem[] }).data
          logger.debug('[Models API] Case 3: Parsing from nested data, count:', aiModelInfoList.length)
        }
      }
      // 情况3：响应本身是数组（不太可能，但作为备用）
      else if (Array.isArray(aiModelInfoResponse)) {
        aiModelInfoList = aiModelInfoResponse
        logger.debug('[Models API] Case 4: Response itself is array, count:', aiModelInfoList.length)
      }

      logger.debug('[Models API] Parsed model list:', aiModelInfoList)
      logger.debug('[Models API] Model count:', aiModelInfoList.length)

      // 如果还是没有数据，记录警告并尝试其他解析方式
      if (aiModelInfoList.length === 0) {
        logger.warn('[Models API] Unable to parse model data, trying other methods...')
        logger.warn('[Models API] Original response type:', typeof aiModelInfoResponse)
        logger.warn('[Models API] Original response keys:', Object.keys(aiModelInfoResponse || {}))
        logger.warn('[Models API] Original response data type:', typeof aiModelInfoResponse?.data)
        if (aiModelInfoResponse?.data) {
          logger.warn('[Models API] Original response data keys:', Object.keys(aiModelInfoResponse.data))
          logger.warn('[Models API] Original response data value:', JSON.stringify(aiModelInfoResponse.data).substring(0, 500))
        }
        // 尝试直接使用 response
        if (Array.isArray(aiModelInfoResponse)) {
          aiModelInfoList = aiModelInfoResponse
          logger.debug('[Models API] Using response itself as array')
        }
      } else {
        // 记录前几个模型的 type 值用于调试
        logger.debug('[Models API] Details of first 5 models:', aiModelInfoList.slice(0, 5).map((item: AIModelInfoItem) => ({
          name: item.name,
          type: item.type,
          typeType: typeof item.type,
          id: item.id
        })))

        // 按 type 分组统计
        const typeStats: Record<number, number> = {}
        const modelNamesByType: Record<number, string[]> = {}
        aiModelInfoList.forEach((item: AIModelInfoItem) => {
          const type = item.type != null ? Number(item.type) : -1
          typeStats[type] = (typeStats[type] || 0) + 1
          if (!modelNamesByType[type]) {
            modelNamesByType[type] = []
          }
          modelNamesByType[type].push(item.name)
        })
        logger.debug('[Models API] Model type statistics:', typeStats)
        logger.debug('[Models API] Model names by type:', modelNamesByType)

        // 特别检查用户提到的三个模型
        const targetModels = ['wan2.5', 'doubao', 'nano', 'Nano', 'Doubao']
        const foundModels = aiModelInfoList.filter((item: AIModelInfoItem) => {
          const nameLower = (item.name || '').toLowerCase()
          return targetModels.some(target => nameLower.includes(target.toLowerCase()))
        })
        logger.debug('[Models API] Found target models:', foundModels.map((m: AIModelInfoItem) => ({
          name: m.name,
          type: m.type,
          id: m.id
        })))
      }

      // 转换为前端格式
      const aiModels: AIModel[] = aiModelInfoList.map((item: AIModelInfoItem) => {
        // 根据 type 字段确定模型类别
        // type: 0 = 多模态(全能), 1 = 文本, 2 = 图片, 3 = 视频, 4 = 音频
        // 注意：这里使用 'talk' 作为全能类型的标识，前端会通过 capabilities 判断
        let category: 'talk' | 'image' | 'video' | 'audio' = 'talk'
        let capabilities: string[] = []
        let isUniversal = false // 标记是否为全能模型

        // 记录原始 type 值用于调试
        logger.debug(`[Models API] 处理模型: ${item.name}, type: ${item.type}, type类型: ${typeof item.type}`)

        // 确保 type 是数字类型（后端返回的 type 是数字）
        const modelType = item.type != null ? (typeof item.type === 'string' ? parseInt(item.type, 10) : Number(item.type)) : null

        // 如果没有 type 字段，跳过该模型或使用默认值
        if (modelType === null || isNaN(modelType)) {
          logger.warn(`[Models API] 模型 ${item.name} 的 type 字段无效: ${item.type}`)
          // 尝试从名称推断类型
          const nameLower = item.name?.toLowerCase() || ''
          if (nameLower.includes('image') || nameLower.includes('banana') || nameLower.includes('seedream')) {
            category = 'image'
            capabilities = ['image']
          } else if (nameLower.includes('video') || nameLower.includes('wan2') || nameLower.includes('sora') || nameLower.includes('veo')) {
            category = 'video'
            capabilities = ['video']
          } else if (nameLower.includes('audio') || nameLower.includes('voice') || nameLower.includes('suno') || nameLower.includes('cosy')) {
            category = 'audio'
            capabilities = ['audio']
          } else {
            category = 'talk'
            capabilities = ['chat', 'text']
          }
        } else {
          switch (modelType) {
            case 0:
              // 多模态 = 全能模型
              category = 'talk'
              capabilities = ['chat', 'text', 'image', 'audio', 'video']
              isUniversal = true
              break
            case 1:
              category = 'talk'
              capabilities = ['chat', 'text']
              break
            case 2:
              category = 'image'
              capabilities = ['image']
              break
            case 3:
              category = 'video'
              capabilities = ['video']
              break
            case 4:
              category = 'audio'
              capabilities = ['audio']
              break
            case 5:
              // type: 5 是数字人类型，单独处理
              category = 'talk' // 使用 talk 作为基础分类，但通过 isDigitalHuman 标记区分
              capabilities = ['chat', 'text', 'image', 'audio', 'video']
              // 不设置为全能模型，而是标记为数字人（在创建 model 对象时设置 isDigitalHuman）
              isUniversal = false
              logger.debug(`[Models API] 模型 ${item.name} 类型为 5 (数字人)`)
              break
            default:
              category = 'talk'
              capabilities = ['chat', 'text']
              logger.warn(`[Models API] 未知的模型类型: ${modelType}, 模型名称: ${item.name}`)
          }
        }

        // 获取模型的中文名称和描述
        const modelDisplayName = (item.source as string | undefined) || item.name // 优先使用 source（中文名称）
        const modelDescription = getModelDescription(item.name, item.source as string | undefined) // 使用自定义描述函数

        const model = {
          id: item.id,
          code: item.code as string | undefined,
          modelId: item.id,
          name: item.name, // 保留英文名称用于内部标识
          displayName: modelDisplayName, // 使用中文名称（source）作为显示名称
          provider: (item.manufacturer as string | undefined) || (item.source as string | undefined) || '未知',
          type: category,
          category,
          enabled: item.is_del === 0,
          description: modelDescription, // 使用模型能力描述，而不是 API 路径
          capabilities,
          usageCount: 0,
          createTime: item.created_at as string | undefined,
          updateTime: item.updated_at as string | undefined,
          icon: (item.img as string | undefined) || undefined, // 从后端 img 字段获取图标URL
          isUniversal, // 添加全能模型标记
          isDigitalHuman: modelType === 5, // 添加数字人标记
          is_new: item.is_new !== undefined ? item.is_new : 0, // 保留 is_new 字段（可能是字符串 "1"/"0" 或数字）
          is_top: item.is_top !== undefined ? item.is_top : 0, // 保留 is_top 字段（可能是字符串 "1"/"0" 或数字）
          remark: (item as { remark?: string }).remark,
          quest_type: (item as { quest_type?: string }).quest_type,
          // 从大模型列表接口透传 variables，供前端 zidingyican 使用
          variables: (item as { variables?: unknown }).variables,
        } as AIModel & { isUniversal?: boolean; isDigitalHuman?: boolean; icon?: string; is_new?: number; is_top?: number; remark?: string; quest_type?: string; variables?: unknown }

        logger.debug(`[Models API] 转换后的模型: ${model.name}, displayName: ${model.displayName}, description: ${model.description}, category: ${model.category}, isUniversal: ${isUniversal}, isDigitalHuman: ${(model as AIModel & { isDigitalHuman?: boolean }).isDigitalHuman}, is_new: ${(model as AIModel & { is_new?: number }).is_new}, is_top: ${(model as AIModel & { is_top?: number }).is_top}`)

        return model
      })

      logger.debug('[Models API] Converted model list:', aiModels)

      // 如果成功从统一大模型列表接口获取数据，直接转换为最终格式并返回
      // 不需要再经过 modelsResponse 的处理流程
      const availableModelsFromApi: AIModelInfo[] = aiModels.map((model): AIModelInfo => {
        const modelWithExtras = model as AIModel & { isUniversal?: boolean; isDigitalHuman?: boolean; icon?: string; is_new?: number; is_top?: number }
        const isUniversal = modelWithExtras.isUniversal === true
        const isDigitalHuman = modelWithExtras.isDigitalHuman === true
        const category = model.category || 'talk' // 确保 category 存在
        const icon = modelWithExtras.icon || undefined // 获取图标URL

        logger.debug(`[Models API] 映射模型到 AIModelInfo: ${model.name}, category: ${category}, isUniversal: ${isUniversal}, isDigitalHuman: ${isDigitalHuman}, icon: ${icon}`)

        return {
          id: model.id,
          code: model.code,
          name: model.name, // 大模型列表的 name（如 Doubao-1.6），供 user-model-chat/query 等接口使用
          displayName: model.displayName || model.name, // 使用 displayName（中文名称，如豆包1.8）
          provider: model.provider,
          description: model.description || '', // 使用模型能力描述
          category: category, // 使用已转换的 category（从 type 字段映射而来）
          isAvailable: model.enabled ?? false,
          supportsStreaming: model.capabilities?.includes('chat') || model.capabilities?.includes('text') || category === 'talk' || isUniversal || false,
          supportsImages: model.capabilities?.includes('image') || category === 'image' || isUniversal || false,
          supportsAudio: model.capabilities?.includes('audio') || category === 'audio' || isUniversal || false,
          supportsVideo: model.capabilities?.includes('video') || category === 'video' || isUniversal || false,
          usageCount: model.usageCount || 0,
          tags: model.capabilities || [],
          icon: icon, // 添加图标字段（从后端 img 字段映射）
          isUniversal: isUniversal,
          isDigitalHuman: isDigitalHuman,
          is_new: modelWithExtras.is_new !== undefined ? modelWithExtras.is_new : 0,
          is_top: modelWithExtras.is_top !== undefined ? modelWithExtras.is_top : 0,
          remark: (model as { remark?: string }).remark,
          quest_type: (model as { quest_type?: string }).quest_type,
          // 透传可选的自定义变量配置（用于 zidingyican）
          variables: (model as { variables?: unknown }).variables,
        } as AIModelInfo & { isUniversal?: boolean; isDigitalHuman?: boolean; icon?: string; is_new?: number; is_top?: number; variables?: unknown }
      })

      logger.debug('[Models API] Final model list (from unified API):', availableModelsFromApi)
      logger.debug('[Models API] Final model list statistics:', {
        total: availableModelsFromApi.length,
        byCategory: {
          talk: availableModelsFromApi.filter(m => m.category === 'talk' && !(m as AIModelInfo & { isUniversal?: boolean }).isUniversal && !(m as AIModelInfo & { isDigitalHuman?: boolean }).isDigitalHuman).length,
          image: availableModelsFromApi.filter(m => m.category === 'image').length,
          video: availableModelsFromApi.filter(m => m.category === 'video').length,
          audio: availableModelsFromApi.filter(m => m.category === 'audio').length,
          universal: availableModelsFromApi.filter(m => (m as AIModelInfo & { isUniversal?: boolean }).isUniversal === true).length,
          digitalHuman: availableModelsFromApi.filter(m => (m as AIModelInfo & { isDigitalHuman?: boolean }).isDigitalHuman === true).length
        }
      })

      // 直接返回，不再经过后续转换流程
      return {
        code: 200,
        success: true,
        message: t('api.models.获取成功12'),
        data: availableModelsFromApi,
        timestamp: Date.now(),
      }
    } catch (error: unknown) {
      // 检查是否是未登录错误
      const errorMessage = error instanceof Error ? error.message : String(error)
      const axiosError = error as { response?: { status?: number }; message?: string }
      const statusCode = axiosError.response?.status
      const isNotLoggedInError =
        !statusCode && (
          errorMessage.includes('未登录') ||
          errorMessage.includes('请先登录') ||
          errorMessage.includes('not logged in')
        )

      // 未登录时静默处理，不记录警告日志
      if (!isNotLoggedInError) {
        logger.warn('[Models API] /cozeZhsApi/ai-model-info/list request failed, trying backup:', error)
      }

      // 如果是500错误，抛出错误让上层处理
      if (statusCode && statusCode >= 500) {
        const error = new Error(axiosError.message || '服务器错误，请稍后重试')
        ;(error as { response?: { status: number } }).response = { status: statusCode }
        throw error
      }

      // 如果第一个API失败，尝试从 /cozeZhsApi/ai/models 获取（备用接口）
      try {
        const response = await request.get(COZE_PATHS.aiModels.list, {
          params: {
            page: 1,
            pageSize: 100,
          },
        })

        // 标准化响应格式
        if (response.data && typeof response.data === 'object') {
          if (response.data.code !== undefined) {
            modelsResponse = response.data as ApiResponse<PaginationResponse<AIModel>>
          } else if (Array.isArray(response.data)) {
            modelsResponse = {
              code: 200,
              success: true,
              message: t('api.models.获取成功13'),
              data: {
                list: response.data as unknown as AIModel[],
                pagination: {
                  page: 1,
                  pageSize: 100,
                  total: response.data.length,
                  totalPages: 1,
                },
              },
              timestamp: Date.now(),
            }
          } else if (response.data.list && Array.isArray(response.data.list)) {
            modelsResponse = {
              code: 200,
              success: true,
              message: t('api.models.获取成功14'),
              data: response.data as PaginationResponse<AIModel>,
              timestamp: Date.now(),
            }
          } else {
            throw new Error(t('error.models.响应格式不正确20'))
          }
        } else {
          throw new Error(t('error.models.响应格式不正确21'))
        }
      } catch (error2: unknown) {
        // 检查是否是未登录错误
        const errorMessage2 = error2 instanceof Error ? error2.message : String(error2)
        const axiosError2 = error2 as { response?: { status?: number }; message?: string }
        const statusCode2 = axiosError2.response?.status
        const isNotLoggedInError2 =
          !statusCode2 && (
            errorMessage2.includes('未登录') ||
            errorMessage2.includes('请先登录') ||
            errorMessage2.includes('not logged in')
          )

        // 未登录时静默处理，不记录错误日志
        if (!isNotLoggedInError2) {
          logger.error('[Models API] All API requests failed:', error2)
        }

        // 如果是500错误，抛出错误让上层处理
        if (statusCode2 && statusCode2 >= 500) {
          const error = new Error(axiosError2.message || '服务器错误，请稍后重试')
          ;(error as { response?: { status: number } }).response = { status: statusCode2 }
          throw error
        }

        // 其他错误返回空列表
        return {
          code: 200,
          success: true,
          message: t('api.models.暂无可用模型15'),
          data: [],
          timestamp: Date.now(),
        }
      }
    }

    logger.debug('[Models API] Model list response:', modelsResponse)

    // 如果请求失败，检查错误类型
    if (modelsResponse.code !== 200 || !modelsResponse.success) {
      // 如果是401错误（未授权），应该抛出错误让前端处理登录逻辑
      if (modelsResponse.code === 401) {
        const error = new Error(modelsResponse.message || '未授权，请先登录')
        ;(error as { response?: { status: number } }).response = { status: 401 }
        throw error
      }
      // 其他错误（如500、503等），返回空列表，静默处理
      if (import.meta.env.DEV) {
        logger.warn(
          '获取模型列表失败，返回空列表（已忽略）:',
          modelsResponse.message || modelsResponse.code
        )
      }
      logger.warn('[Models API] Request failed, returning empty list')
      return {
        code: 200, // 返回200，避免前端显示错误
        success: true,
        message: t('api.models.暂无可用模型16'),
        data: [],
        timestamp: Date.now(),
      }
    }

    const models = modelsResponse.data?.list || []
    logger.debug('[Models API] Number of models fetched:', models.length)

    // 如果没有模型，返回空列表
    if (models.length === 0) {
      logger.warn('[Models API] No models found')
      return {
        code: 200,
        success: true,
        message: t('api.models.暂无可用模型17'),
        data: [],
        timestamp: Date.now(),
      }
    }

    // 转换为前端展示格式
    const availableModels: AIModelInfo[] = models.map((model): AIModelInfo => {
      // 如果模型已经有 isUniversal 标记（从统一大模型列表接口获取），直接使用
      const modelWithExtras = model as AIModel & { isUniversal?: boolean; isDigitalHuman?: boolean; icon?: string; is_new?: number; is_top?: number }
      const isUniversal = modelWithExtras.isUniversal === true

      // 如果模型已经有正确的 category（从统一大模型列表接口获取），直接使用
      // 否则根据能力和类型判断分类
      let category: 'talk' | 'image' | 'video' | 'audio' = model.category || 'talk'

      // 只有在 category 不存在时才重新判断
      if (!model.category) {
        // 优先使用 capabilities 判断
        if (model.capabilities && model.capabilities.length > 0) {
          if (model.capabilities.includes('image') && !model.capabilities.includes('video') && !model.capabilities.includes('audio')) {
            category = 'image'
          } else if (model.capabilities.includes('video') && !model.capabilities.includes('image') && !model.capabilities.includes('audio')) {
            category = 'video'
          } else if (model.capabilities.includes('audio') && !model.capabilities.includes('image') && !model.capabilities.includes('video')) {
            category = 'audio'
          }
        }
      }

      const modelInfo = {
        id: model.id,
        name: model.modelId || model.id,
        displayName: model.name,
        provider: model.provider,
        description: model.description,
        category, // 使用已有的 category 或新判断的 category
        isAvailable: model.enabled ?? model.isAvailable ?? false,
        supportsStreaming: model.capabilities?.includes('chat') || model.capabilities?.includes('text') || category === 'talk' || isUniversal || false,
        supportsImages: model.capabilities?.includes('image') || category === 'image' || isUniversal || false,
        supportsAudio: model.capabilities?.includes('audio') || category === 'audio' || isUniversal || false,
        supportsVideo: model.capabilities?.includes('video') || category === 'video' || isUniversal || false,
        usageCount: model.usageCount,
        tags: model.capabilities || [],
        // 保留 isUniversal 标记
        isUniversal: isUniversal,
      } as AIModelInfo & { isUniversal?: boolean }

      logger.debug(`[Models API] 最终模型信息: ${modelInfo.displayName}, category: ${modelInfo.category}, isUniversal: ${modelInfo.isUniversal}`)

      return modelInfo
    })

    logger.debug('[Models API] Converted model list:', availableModels)

    return {
      code: 200,
      success: true,
      message: t('api.models.获取成功18'),
      data: availableModels,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    // 捕获所有错误，返回空列表而不是抛出错误
      logger.warn('Error fetching available models:', error)
    return {
      code: 200, // 返回200，避免前端显示错误
      success: true,
      message: t('api.models.暂无可用模型19'),
      data: [],
      timestamp: Date.now(),
    }
  }
}

// 大模型提供商信息
export const MODEL_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    icon: '🤖',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl', 'organization'],
    defaultPricing: {
      inputTokenPrice: 0.03,
      outputTokenPrice: 0.06,
    },
  },
  anthropic: {
    name: 'Anthropic',
    icon: '🧠',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl', 'version'],
    defaultPricing: {
      inputTokenPrice: 0.003,
      outputTokenPrice: 0.015,
    },
  },
  google: {
    name: 'Google',
    icon: '🔍',
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    models: ['gemini-pro', 'gemini-ultra', 'gemini-1.5-pro'],
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl'],
    defaultPricing: {
      inputTokenPrice: 0.0005,
      outputTokenPrice: 0.0015,
    },
  },
  coze: {
    name: '扣子（Coze）',
    icon: '💬',
    baseUrl: 'https://api.coze.cn/v1',
    models: ['coze-pro'],
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl', 'botId'],
    defaultPricing: {
      inputTokenPrice: 0.002,
      outputTokenPrice: 0.002,
    },
  },
  dashscope: {
    name: '阿里云百炼',
    icon: '☁️',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-vl-max'],
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl'],
    defaultPricing: {
      inputTokenPrice: 0.0008,
      outputTokenPrice: 0.002,
    },
  },
  baidu: {
    name: '百度文心一言',
    icon: '🔷',
    baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop',
    models: ['ernie-bot', 'ernie-bot-turbo', 'ernie-bot-4', 'ernie-vilg'],
    requiredFields: ['apiKey', 'secretKey'],
    optionalFields: ['baseUrl'],
    defaultPricing: {
      inputTokenPrice: 0.0012,
      outputTokenPrice: 0.0012,
    },
  },
  alibaba: {
    name: '阿里通义千问',
    icon: '🌐',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl'],
    defaultPricing: {
      inputTokenPrice: 0.0008,
      outputTokenPrice: 0.002,
    },
  },
  tencent: {
    name: '腾讯混元',
    icon: '💎',
    baseUrl: 'https://hunyuan.tencentcloudapi.com',
    models: ['hunyuan-standard', 'hunyuan-pro', 'hunyuan-lite'],
    requiredFields: ['secretId', 'secretKey'],
    optionalFields: ['baseUrl'],
    defaultPricing: {
      inputTokenPrice: 0.001,
      outputTokenPrice: 0.001,
    },
  },
  doubao: {
    name: '字节豆包',
    icon: '🎯',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-pro', 'doubao-lite', 'doubao-vision'],
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl'],
    defaultPricing: {
      inputTokenPrice: 0.0008,
      outputTokenPrice: 0.0016,
    },
  },
  zhipu: {
    name: '智谱AI',
    icon: '🌟',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4', 'glm-3-turbo', 'glm-4v'],
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl'],
    defaultPricing: {
      inputTokenPrice: 0.001,
      outputTokenPrice: 0.001,
    },
  },
  moonshot: {
    name: 'Moonshot AI',
    icon: '🌙',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl'],
    defaultPricing: {
      inputTokenPrice: 0.0005,
      outputTokenPrice: 0.002,
    },
  },
  custom: {
    name: '自定义模型',
    icon: '🔧',
    baseUrl: '',
    models: [],
    requiredFields: ['apiKey', 'baseUrl', 'modelId'],
    optionalFields: [],
    defaultPricing: {
      inputTokenPrice: 0.001,
      outputTokenPrice: 0.001,
    },
  },
}
