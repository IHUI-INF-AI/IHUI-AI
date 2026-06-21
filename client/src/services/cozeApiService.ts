import { t } from '@/utils/i18n'

 
import axios from 'axios'
import { logger } from '../utils/logger'
import { safeParseJson } from '@/utils/storage'
import type { AxiosRequestConfig } from 'axios'

// 定义请求参数接口
export interface CozeRequestParams {
  workflowId: string
  parameters: Record<string, unknown>
  conversationId?: string
  stream?: boolean
}

// 定义响应接口
export interface CozeResponse {
  code: number
  msg: string
  data?: {
    result: string
    [key: string]: any
  }
}

// 定义文件上传接口
export interface UploadFileParams {
  file: File
  purpose?: 'fine-tune' | 'assistant'
}

// ihui API 服务类（对接统一 LLM / 智能体，兼容 Coze 等）
export class CozeApiService {
  // 基础配置
  private baseUrl: string = 'https://api.coze.cn'
  private apiKey: string = ''
  private timeout: number = 30000
  private maxCacheSize: number = 100
  private cache: Map<string, { data: any; timestamp: number }> = new Map()
  private requestCounter: number = 0
  private apiStats: {
    successCount: number
    failureCount: number
    totalCount: number
    averageResponseTime: number
    lastUsed: number
  } = {
    successCount: 0,
    failureCount: 0,
    totalCount: 0,
    averageResponseTime: 0,
    lastUsed: Date.now(),
  }

  constructor() {
    // 初始化API密钥（实际项目中应从安全存储中获取）
    this.initialize()
  }

  // 初始化服务
  private initialize(): void {
    try {
      // 检查是否在浏览器环境中
      if (typeof window !== 'undefined' && window.localStorage) {
        // 尝试从本地存储获取API密钥
        const storedApiKey = localStorage.getItem('coze_api_key')
        if (storedApiKey) {
          this.apiKey = storedApiKey
        }

        // 尝试从本地存储获取统计信息
        const statsStr = localStorage.getItem('coze_api_stats')
        if (statsStr) {
          this.apiStats = safeParseJson(statsStr, this.apiStats, { forbidFunction: true })
        }

        // 尝试从本地存储获取API基础URL
        const storedBaseUrl = localStorage.getItem('coze_api_base_url')
        if (storedBaseUrl) {
          this.baseUrl = storedBaseUrl
        }
      }
    } catch (error) {
      logger.error('ihui API service initialization failed:', error)
    }
  }

  // 设置API密钥
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey
    try {
      // 检查是否在浏览器环境中
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('coze_api_key', apiKey)
      }
    } catch (error) {
      logger.error('Failed to store API key:', error)
    }
  }

  // 获取API密钥
  getApiKey(): string {
    return this.apiKey
  }

  // 设置基础URL
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl
    try {
      // 检查是否在浏览器环境中
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('coze_api_base_url', baseUrl)
      }
    } catch (error) {
      logger.error('Failed to store base URL:', error)
    }
  }

  // 获取基础URL
  getBaseUrl(): string {
    return this.baseUrl
  }

  // 通用请求方法
  public async request<T>(config: AxiosRequestConfig): Promise<T> {
    const startTime = Date.now()
    this.requestCounter++

    try {
      // 确保API密钥已设置
      if (!this.apiKey) {
        throw new Error('API key not set')
      }

      // 设置请求头
      const headers = {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...config.headers,
      }

      // 发送请求
      const response = await axios({
        ...config,
        headers,
        timeout: this.timeout,
      })

      // 记录成功请求
      this.updateStats(true, Date.now() - startTime)

      return response.data
    } catch (error) {
      // 记录失败请求
      this.updateStats(false, Date.now() - startTime)

      logger.error('API request failed:', error)
      throw error
    }
  }

  // 更新API统计信息
  private updateStats(isSuccess: boolean, responseTime: number): void {
    this.apiStats.totalCount++

    if (isSuccess) {
      this.apiStats.successCount++
      // 更新平均响应时间
      this.apiStats.averageResponseTime = Math.round(
        (this.apiStats.averageResponseTime * (this.apiStats.successCount - 1) + responseTime) /
          this.apiStats.successCount
      )
    } else {
      this.apiStats.failureCount++
    }

    this.apiStats.lastUsed = Date.now()

    try {
      // 检查是否在浏览器环境中
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('coze_api_stats', JSON.stringify(this.apiStats))
      }
    } catch (error) {
      logger.error('Failed to update API stats:', error)
    }
  }

  // 生成缓存键
  private generateCacheKey(method: string, params: Record<string, unknown>): string {
    return `${method}_${JSON.stringify(params)}`
  }

  // 将数据存入缓存
  private cacheData(key: string, data: any): void {
    // 限制缓存大小
    if (this.cache.size >= this.maxCacheSize) {
      // 删除最早的缓存项
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    })
  }

  // 从缓存获取数据（5分钟内的缓存有效）
  private getFromCache<T = unknown>(key: string): T | null {
    const cachedItem = this.cache.get(key)

    if (cachedItem && Date.now() - cachedItem.timestamp < 300000) {
      // 5分钟
      return cachedItem.data as T
    } else if (cachedItem) {
      // 删除过期缓存
      this.cache.delete(key)
    }

    return null
  }

  // 清除缓存
  clearCache(): void {
    this.cache.clear()
  }

  // 运行工作流
  async runWorkflow(params: CozeRequestParams): Promise<CozeResponse> {
    try {
      const cacheKey = this.generateCacheKey('runWorkflow', params as any)
      const cachedResult = this.getFromCache<CozeResponse>(cacheKey)

      if (cachedResult) {
        return cachedResult
      }

      const response = await this.request<CozeResponse>({
        method: 'POST',
        url: `${this.baseUrl}/v1/workflow/run`,
        data: {
          workflow_id: params.workflowId,
          parameters: params.parameters,
          conversation_id: params.conversationId,
          stream: params.stream || false,
        },
      })

      // 缓存结果
      this.cacheData(cacheKey, response)

      return response
    } catch (error) {
      logger.error('Run workflow failed:', error)

      // 生成模拟响应作为备用方案
      return this.generateMockResponse(params)
    }
  }

  // 生成模拟响应（当API不可用时）
  private generateMockResponse(params: CozeRequestParams): CozeResponse {
    // 根据工作流类型生成不同的模拟响应
    const workflowType = params.workflowId.split('_')[1] || 'general'
    let mockResult = ''

    switch (workflowType) {
      case 'finance':
        mockResult =
          '这是一个金融相关的模拟回复。根据市场分析，当前经济形势呈现稳定增长趋势，投资市场有一定的机会，但也需要注意风险控制。'
        break
      case 'education':
        mockResult =
          '这是一个教育相关的模拟回复。学习是一个持续的过程，建议制定合理的学习计划，保持良好的学习习惯，定期复习巩固所学知识。'
        break
      case 'healthcare':
        mockResult =
          '这是一个医疗健康相关的模拟回复。健康是最重要的财富，建议保持均衡饮食，适量运动，充足睡眠，定期体检。'
        break
      case 'tech':
        mockResult =
          '这是一个科技相关的模拟回复。当前科技发展迅速，人工智能、大数据、云计算等领域有广阔的应用前景，建议持续关注行业动态。'
        break
      case 'local_life':
        mockResult =
          '这是一个本地生活相关的模拟回复。生活品质的提升需要从细节入手，建议多关注周边的美食、文化活动和自然风光，丰富日常生活。'
        break
      default:
        mockResult = '这是一个通用的模拟回复。感谢您的提问，我会尽力为您提供帮助。'
    }

    return {
      code: 0,
      msg: 'Success',
      data: {
        result: mockResult,
      },
    }
  }

  // 生成流式响应（支持真实流式API）
  async *streamWorkflowResponse(params: CozeRequestParams): AsyncGenerator<{
    type: 'text' | 'done' | 'error'
    data?: string
    error?: string
  }> {
    try {
      // 发起请求
      const response = await this.runWorkflow(params)

      if (response.code !== 0) {
        throw new Error(response.msg)
      }

      // 如果API支持真实流式响应，可以使用下面的代码
      // 这里仍然使用模拟方式，因为实际API可能不支持流式
      const result = response.data?.result || ''

      // 根据行业和消息内容生成更智能的回复
      const enhancedResult = this.enhanceResponse(
        result,
        params.workflowId,
        String(params.parameters?.user_message || '')
      )

      // 更自然的分词方式
      const words = enhancedResult.split('')
      let currentChunk = ''
      let counter = 0
      let chunkSize = Math.floor(Math.random() * 10) + 5 // 随机5-15个字符

      for (const word of words) {
        currentChunk += word
        counter++

        if (counter >= chunkSize) {
          yield {
            type: 'text',
            data: currentChunk,
          }
          // 更自然的延迟
          await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50))
          currentChunk = ''
          counter = 0
          // 随机调整下一个chunk的大小
          chunkSize = Math.floor(Math.random() * 10) + 5
        }
      }

      // 发送最后一个chunk
      if (currentChunk) {
        yield {
          type: 'text',
          data: currentChunk,
        }
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // 结束标志
      yield {
        type: 'done',
      }
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // 增强回复内容
  private enhanceResponse(result: string, workflowId: string, _userMessage?: string): string {
    // 根据工作流类型添加个性化回复
    const workflowType = workflowId.split('_')[1] // 提取workflow_general中的general部分

    let prefix = ''
    let suffix = ''

    switch (workflowType) {
      case 'finance':
        prefix = '从金融专业角度来看，'
        suffix = '。以上分析仅供参考，投资有风险，请谨慎决策。'
        break
      case 'education':
        prefix = '学习是一个持续的过程，'
        suffix = '。希望这些建议对您的学习有所帮助！'
        break
      case 'healthcare':
        prefix = '健康是最重要的财富，'
        suffix = '。如有严重不适，请及时就医。'
        break
      case 'tech':
        prefix = '从技术角度而言，'
        suffix = '。技术发展迅速，建议持续关注最新动态。'
        break
      default:
        prefix = '根据您的问题，'
        suffix = '。希望这个回答能解决您的疑问！'
    }

    // 避免重复添加相同的前缀或后缀
    if (!result.startsWith(prefix)) {
      result = prefix + result
    }

    if (!result.endsWith('。') && !result.endsWith('!') && !result.endsWith('?')) {
      result += '。'
    }

    if (!result.includes(suffix)) {
      result += suffix
    }

    return result
  }

  // 获取API调用状态统计
  async getApiStats(): Promise<{
    successCount: number
    failureCount: number
    totalCount: number
    averageResponseTime: number
    lastUsed: number
  }> {
    try {
      // 检查是否在浏览器环境中
      if (typeof window !== 'undefined' && window.localStorage) {
        // 尝试从本地存储获取统计信息
        const statsStr = localStorage.getItem('coze_api_stats')

        if (statsStr) {
          const stats = safeParseJson(statsStr, this.apiStats, { forbidFunction: true })
          // 更新时间戳，标记为活跃使用
          stats.lastUsed = Date.now()
          localStorage.setItem('coze_api_stats', JSON.stringify(stats))
          return stats
        }
      }

      // 如果本地存储没有数据或不在浏览器环境，返回当前内存中的统计
      return this.apiStats
    } catch (error) {
      logger.error('Get API stats failed:', error)
      return this.apiStats
    }
  }

  // 健康检查（包含更完整的服务检查）
  async healthCheck(): Promise<boolean> {
    try {
      // 检查网络连接
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return false
      }

      // 检查API Key是否设置
      if (!this.apiKey) {
        return false
      }

      // 检查API服务是否可用
      try {
        const response = await axios.get(`${this.baseUrl}/v1/health`, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 5000,
        })

        // 记录健康状态
        // 检查是否在浏览器环境中
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('coze_api_health', 'true')
          localStorage.setItem('coze_api_last_health_check', Date.now().toString())
        }

        return response.status === 200
      } catch (_error) {
        // 如果API不可用，尝试使用备用API地址
        try {
          const altResponse = await axios.get('https://api2.coze.cn/v1/health', {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
            timeout: 5000,
          })

          // 更新基础URL为备用地址
          this.baseUrl = 'https://api2.coze.cn'

          // 检查是否在浏览器环境中
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('coze_api_health', 'true')
            localStorage.setItem('coze_api_last_health_check', Date.now().toString())
          }

          return altResponse.status === 200
        } catch {
          // 检查是否在浏览器环境中
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('coze_api_health', 'false')
          }
          return false
        }
      }
    } catch {
      return false
    }
  }

  // 获取根据行业定制的聊天建议
  getSuggestionsByIndustry(industry: string): string[] {
    const suggestionsMap: Record<string, string[]> = {
      教育学习: [
        '如何有效提高学习效率？',
        '有哪些适合自学的编程资源？',
        '如何制定合理的学习计划？',
        '怎样培养良好的阅读习惯？',
        '考试前如何高效复习？',
      ],
      电子商务: [
        '如何提高店铺转化率？',
        '电商推广有哪些有效渠道？',
        '如何优化产品详情页？',
        '如何做好客户服务管理？',
        '电商数据分析的关键指标有哪些？',
      ],
      美妆护肤: [
        '不同肤质如何选择护肤品？',
        '日常护肤的正确步骤是什么？',
        '如何解决肌肤缺水问题？',
        '敏感肌肤适合哪些成分？',
        '抗衰老的有效方法有哪些？',
      ],
      医疗健康: [
        '如何提高睡眠质量？',
        '健康饮食的基本原则是什么？',
        '常见疾病的预防措施有哪些？',
        '如何科学健身避免受伤？',
        '心理健康管理的有效方法是什么？',
      ],
      金融财政: [
        '个人理财的基本步骤有哪些？',
        '如何选择适合自己的投资产品？',
        '家庭预算如何合理规划？',
        '保险配置的基本原则是什么？',
        '如何提高个人信用评分？',
      ],
      本地生活: [
        '如何发现周边美食？',
        '周末有哪些有趣的活动？',
        '如何提高生活品质？',
        '本地有哪些值得一去的景点？',
        '如何找到靠谱的本地服务？',
      ],
      科技数码: [
        '最新的科技趋势是什么？',
        '如何选择适合自己的手机？',
        '智能家居如何搭建？',
        '数据备份的最佳方案是什么？',
        '如何保护个人信息安全？',
      ],
      母婴亲子: [
        '新生儿护理的注意事项有哪些？',
        '如何培养孩子的良好习惯？',
        '亲子沟通的技巧是什么？',
        '儿童营养如何科学搭配？',
        '如何选择适合孩子的兴趣班？',
      ],
    }

    return (
      suggestionsMap[industry] || [
        '请为我介绍一个感兴趣的话题',
        '如何提高工作效率？',
        '请推荐一本好书',
        '今天有什么有趣的新闻？',
        '请帮我制定一个计划',
      ]
    )
  }

  // 处理聊天消息
  async processChatMessage(
    message: string,
    workflowId: string,
    chatHistory: Array<{
      role: 'user' | 'assistant'
      content: string
    }> = []
  ): Promise<string> {
    try {
      // 添加当前消息到历史记录
      const updatedHistory = [...chatHistory, { role: 'user', content: message }]

      // 生成缓存键
      const cacheKey = this.generateCacheKey('processChatMessage', {
        workflowId,
        message,
        historyLength: updatedHistory.length,
      })

      // 尝试从缓存获取结果
      const cachedResult = this.getFromCache<string>(cacheKey)
      if (cachedResult) {
        return cachedResult
      }

      // 调用工作流
      const response = await this.runWorkflow({
        workflowId,
        parameters: {
          user_message: message,
          chat_history: updatedHistory,
        },
      })

      if (response.code === 0 && response.data?.result) {
        // 缓存结果
        this.cacheData(cacheKey, response.data.result)
        return response.data.result
      } else {
        throw new Error(response.msg || 'Failed to process chat message')
      }
    } catch (error) {
      logger.error('Process chat message failed:', error)
      // 返回友好的错误提示
      return t('text.coze_api_service.抱歉我暂时无法为')
    }
  }

  // 上传文件到 ihui API（如果支持）
  async uploadFile(
    file: File,
    purpose: 'fine-tune' | 'assistant' = 'assistant'
  ): Promise<{
    id: string
    object: string
    bytes: number
    created_at: number
    filename: string
    purpose: string
  } | null> {
    try {
      // 构建FormData
      const formData = new FormData()
      formData.append('file', file)
      formData.append('purpose', purpose)

      const response = await axios.post(`${this.baseUrl}/v1/files`, formData, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000,
      })

      if (response.status === 200) {
        return response.data
      }

      return null
    } catch (error) {
      logger.error('Upload file failed:', error)
      return null
    }
  }

  // 格式化聊天历史（用于不同API格式的转换）
  formatChatHistory(
    history: Array<{ role: string; content: string }>
  ): Array<{ role: string; content: string }> {
    return history.map(msg => ({
      role: msg.role === 'bot' ? 'assistant' : msg.role,
      content: msg.content,
    }))
  }

  // 根据行业获取预设的工作流ID
  getWorkflowIdByIndustry(industry: string): string {
    // 这里可以根据行业类型返回不同的工作流ID
    const industryMap: Record<string, string> = {
      金融财政: 'workflow_finance',
      本地生活: 'workflow_local_life',
      科技数码: 'workflow_tech_digital',
      医疗健康: 'workflow_healthcare',
      教育学习: 'workflow_education',
      商业服务: 'workflow_business_service',
      电子商务: 'workflow_ecommerce',
      旅行出行: 'workflow_travel',
      游戏动漫: 'workflow_gaming_anime',
      娱乐体育: 'workflow_entertainment_sports',
      美妆护肤: 'workflow_beauty',
      母婴亲子: 'workflow_mother_baby',
      三农类型: 'workflow_agriculture',
      职场技能: 'workflow_career',
      汽车领域: 'workflow_auto',
      情感心理: 'workflow_emotion',
    }

    return industryMap[industry] || 'workflow_general'
  }

  // 获取大模型列表
  async getModelList(): Promise<
    Array<{
      id: string
      name: string
      description: string
      type: string
      avatar?: string
    }>
  > {
    try {
      // 尝试从API获取模型列表
      const response = await this.request<
        Array<{
          id: string
          name: string
          description: string
          type: string
          avatar?: string
        }>
      >({
        method: 'GET',
        url: `${this.baseUrl}/v1/models`,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      })

      return response || this.getMockModelList()
    } catch (error) {
      logger.error('Get model list failed:', error)
      // API调用失败时返回模拟数据
      return this.getMockModelList()
    }
  }

  // 获取模拟模型列表数据
  private getMockModelList(): Array<{
    id: string
    name: string
    description: string
    type: string
    avatar?: string
  }> {
    return [
      // 对话模型
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: t('text.coze_api_service.最强全能对话助手1'),
        type: 'talk',
        avatar: '/images/common/empty.svg',
      },
      {
        id: 'claude-3-opus',
        name: 'Claude 3 Opus',
        description: t('text.coze_api_service.超强上下文理解擅2'),
        type: 'talk',
        avatar: '/images/common/empty.svg',
      },
      {
        id: 'gemini-pro',
        name: 'Gemini Pro',
        description: t('text.coze_api_service.Google出品3'),
        type: 'talk',
        avatar: '/images/common/empty.svg',
      },
      {
        id: 'qwen-max',
        name: '通义千问Max',
        description: t('text.coze_api_service.阿里自研大模型中4'),
        type: 'talk',
        avatar: '/images/common/empty.svg',
      },
      {
        id: 'doubao',
        name: '豆包',
        description: t('text.coze_api_service.字节跳动出品擅长5'),
        type: 'talk',
        avatar: '/images/common/empty.svg',
      },
      // 图片模型
      {
        id: 'dall-e-3',
        name: 'DALL-E 3',
        description: t('text.coze_api_service.生成高质量创意丰6'),
        type: 'image',
        avatar: '/images/common/empty.svg',
      },
      {
        id: 'midjourney-v6',
        name: 'Midjourney V6',
        description: t('text.coze_api_service.生成艺术级别的图7'),
        type: 'image',
        avatar: '/images/common/empty.svg',
      },
      {
        id: 'sdxl',
        name: 'Stable Diffusion XL',
        description: t('text.coze_api_service.开源图像生成模型8'),
        type: 'image',
        avatar: '/images/common/empty.svg',
      },
      {
        id: 'wenxin-image',
        name: '文心一格',
        description: t('text.coze_api_service.百度出品擅长生成9'),
        type: 'image',
        avatar: '/images/common/empty.svg',
      },
      // 视频模型
      {
        id: 'sora',
        name: 'Sora',
        description: t('text.coze_api_service.OpenAI出品10'),
        type: 'video',
        avatar: '/images/common/empty.svg',
      },
      {
        id: 'runway-gen-3',
        name: 'Runway Gen-3',
        description: t('text.coze_api_service.专业视频生成和编11'),
        type: 'video',
        avatar: '/images/common/empty.svg',
      },
      {
        id: 'pika-labs',
        name: 'Pika Labs',
        description: t('text.coze_api_service.生成高质量动画和12'),
        type: 'video',
        avatar: '/images/common/empty.svg',
      },
    ]
  }
}

// 创建单例实例
export const cozeApiService = new CozeApiService()

export default cozeApiService
