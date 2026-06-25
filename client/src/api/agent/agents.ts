import request from '@/utils/request'
import { t } from '@/utils/i18n'
import { logger } from '../utils/logger'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import {
  COZE_PATHS,
  REMOTE_PATHS,
  API_AGENTS_PATHS,
  AGENTS_LEGACY_PATHS,
} from '@/config/backend-paths'
import { getAgentList, GUEST_AGENT_LIST_FALLBACK } from '@/services/api'
import { findMockAgentById } from '@/api/agent/agent/agent-plaza'
import { cozeApiService } from '@/services/cozeApiService'
import {
  withApiResponseHandler,
  normalizeApiResponse,
  normalizePaginationResponse,
} from '@/utils/apiResponseHandler'

// 智能体平台来源
export type AgentPlatform = 'coze' | 'n8n' | 'dify' | 'make' | 'dashscope' | 'internal' | 'all'

// 智能体接口（与后端字段统一，支持 camelCase / snake_case）
export interface Agent {
  id: string | number
  name?: string
  agentName?: string
  agent_name?: string
  description?: string
  prologue?: string
  avatar?: string
  icon?: string
  category?: string
  categoryId?: string
  tags?: string[]
  type?: string
  platform?: AgentPlatform
  creatorId?: string
  creatorName?: string
  rating?: number
  ratingCount?: number
  usageCount?: number
  status?: 'active' | 'inactive' | 'deprecated'
  isPublic?: boolean
  createTime?: string
  updateTime?: string
  isFavorite?: boolean
  // 智汇智能体平台特有字段
  cozeBotId?: string // 智能体ID
  cozeConversationId?: string // 对话ID
  cozeApiKey?: string // ihui API 密钥
  // n8n平台特有字段
  n8nWorkflowId?: string // n8n工作流ID
  n8nWebhookUrl?: string // n8n Webhook URL
  n8nApiKey?: string // n8n API密钥
  // Dify平台特有字段
  difyAppId?: string // Dify应用ID
  difyConversationId?: string // Dify对话ID
  difyApiKey?: string // Dify API密钥
  difyBaseUrl?: string // Dify API基础URL
  // Make平台特有字段
  makeScenarioId?: string // Make场景ID
  makeWebhookUrl?: string // Make Webhook URL
  makeApiKey?: string // Make API密钥
  // 阿里云百炼平台特有字段
  dashscopeModel?: string // 百炼模型名称
  dashscopeApiKey?: string // 百炼API密钥
  dashscopeBaseUrl?: string // 百炼API基础URL
  // 兼容性字段
  botId?: string // 智能体ID（兼容字段，等同于id）
  suggestedQuestions?: string[] // 建议问题列表
}

/** 后端可能返回 agentName/agent_name，统一取展示用名称 */
export function getAgentDisplayName(agent: Agent): string {
  return (agent.agentName ?? (agent as { agent_name?: string }).agent_name ?? agent.name ?? '').toString()
}

/** 后端可能返回 description/prologue，统一取展示用描述 */
export function getAgentDisplayDescription(agent: Agent): string {
  const a = agent as { prologue?: string; description?: string }
  return (a.description ?? a.prologue ?? '').toString()
}

// 搜索智能体（与小程序端一致）
export async function searchAgents(params: {
  keyword?: string
  category_id?: number
  page?: number
  page_size?: number
  sort?: 'hot' | 'new' | 'price'
}): Promise<ApiResponse<{ total: number; list: Agent[] }>> {
  try {
    // 注释：已移除开发环境 mock 逻辑，现在调用后端API获取真实智能体数据
    const page = params.page || 1
    const pageSize = params.page_size || 20
    const normalized = await getAgentsList({
      page,
      pageSize,
      keyword: params.keyword,
      category: params.category_id ? String(params.category_id) : undefined,
      sortBy:
        params.sort === 'price' ? 'price' : params.sort === 'hot' ? 'usageCount' : 'createTime',
      sortOrder: params.sort === 'new' ? 'desc' : 'desc',
      platform: 'all',
    })
    const list = normalized.data?.list || []
    const total = normalized.data?.pagination?.total || list.length
    return {
      code: 200,
      success: true,
      message: t('api.agents.操作成功'),
      data: { total, list },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.agents.搜索失败'),
      data: { total: 0, list: [] },
      timestamp: Date.now(),
    }
  }
}

// 智能体分类接口
export interface AgentCategory {
  id: string
  name: string
  description?: string
  icon?: string
  count?: number
}

// 从智汇/ihui 平台获取智能体列表
async function getCozeAgents(params: {
  page?: number
  pageSize?: number
  keyword?: string
}): Promise<Agent[]> {
  try {
    logger.info('[Agents] Fetching ihui platform agents', {
      page: params.page,
      pageSize: params.pageSize,
      keyword: params.keyword,
    })

    const apiKey = cozeApiService.getApiKey()
    if (!apiKey) {
      logger.warn('[Agents] ihui API key not configured, skipping ihui agents')
      return []
    }

    const response = await cozeApiService.request<{
      data: {
        bots: Array<{
          bot_id: string
          bot_name: string
          bot_desc: string
          bot_avatar?: string
          category?: string
          tags?: string[]
          create_time?: number
          update_time?: number
        }>
        total: number
      }
    }>({
      method: 'GET',
      url: '/v1/bots',
      headers: {
        Authorization: `Bearer ${cozeApiService.getApiKey()}`,
      },
    })

    const bots = response.data?.bots || []
    logger.info('[Agents] Successfully fetched ihui agents', { count: bots.length, total: response.data?.total })

    return bots.map(
      (bot: Record<string, unknown>): Agent => ({
        id: typeof bot.bot_id === 'string' ? bot.bot_id : String(bot.bot_id || ''),
        name: typeof bot.bot_name === 'string' ? bot.bot_name : '',
        description: (typeof bot.bot_desc === 'string' ? bot.bot_desc : '') || '',
        avatar: typeof bot.bot_avatar === 'string' ? bot.bot_avatar : '',
        icon: typeof bot.bot_avatar === 'string' ? bot.bot_avatar : '',
        category: typeof bot.category === 'string' ? bot.category : undefined,
        tags: Array.isArray(bot.tags) ? (bot.tags as string[]) : [],
        platform: 'coze' as AgentPlatform,
        cozeBotId: typeof bot.bot_id === 'string' ? bot.bot_id : String(bot.bot_id || ''),
        status: 'active' as const,
        usageCount: 0,
        rating: 0,
        ratingCount: 0,
        createTime:
          typeof bot.create_time === 'number'
            ? new Date(bot.create_time * 1000).toISOString()
            : new Date().toISOString(),
        updateTime:
          typeof bot.update_time === 'number'
            ? new Date(bot.update_time * 1000).toISOString()
            : new Date().toISOString(),
      })
    )
  } catch (error) {
    logger.error('[Agents] Failed to fetch ihui agents', {
      error: error instanceof Error ? error.message : String(error),
      params,
    })
    return []
  }
}

// 从n8n平台获取智能体列表
async function getN8nAgents(params: {
  page?: number
  pageSize?: number
  keyword?: string
}): Promise<Agent[]> {
  try {
    logger.info('[Agents] Fetching N8N platform agents', {
      page: params.page,
      pageSize: params.pageSize,
      keyword: params.keyword,
    })

    const n8nApiUrl = import.meta.env.VITE_N8N_API_URL || 'https://your-n8n-instance.com/api/v1'
    const n8nApiKey = import.meta.env.VITE_N8N_API_KEY || ''

    if (import.meta.env.DEV) {
      logger.info('[Agents] Dev environment, skipping N8N agents')
      return []
    }

    if (!n8nApiKey) {
      logger.warn('[Agents] N8N API key not configured, skipping N8N agents')
      return []
    }

    if (n8nApiUrl.includes('your-n8n-instance.com')) {
      logger.warn('[Agents] N8N API URL not configured, skipping N8N agents')
      return []
    }

    let domain = ''
    try {
      const urlObj = new URL(n8nApiUrl)
      domain = urlObj.host
    } catch (e) {
      logger.debug('[Agents] URL parsing failed, using fallback', e)
      const m = n8nApiUrl.replace(/^https?:\/\//, '').split('/')
      domain = m[0] || ''
    }

    logger.info('[Agents] Calling N8N API', { domain, page: params.page, pageSize: params.pageSize })

    const resp = await request.post<{
      code: number
      message: string
      data: Array<{ id: string; name: string; createdAt?: string; updatedAt?: string }>
    }>(
      COZE_PATHS.n8n.workflows,
      {
        n8n_domain: domain,
        api_key: n8nApiKey,
      },
      {
        params: {
          page: params.page,
          pageSize: params.pageSize,
          keyword: params.keyword,
        },
      }
    )

    const workflows = Array.isArray(resp.data?.data) ? resp.data.data : []
    logger.info('[Agents] Successfully fetched N8N agents', { count: workflows.length })

    return workflows.map(
      (w: Record<string, unknown>): Agent => ({
        id:
          typeof w.id === 'string'
            ? w.id
            : typeof w.name === 'string'
              ? w.name
              : String(w.id || w.name || ''),
        name: typeof w.name === 'string' ? w.name : String(w.id || ''),
        description: '',
        avatar: '',
        icon: '',
        category: 'automation',
        tags: [],
        platform: 'n8n' as AgentPlatform,
        n8nWorkflowId: typeof w.id === 'string' ? w.id : String(w.id || ''),
        status: 'active' as const,
        usageCount: 0,
        rating: 0,
        ratingCount: 0,
        createTime: typeof w.createdAt === 'string' ? w.createdAt : new Date().toISOString(),
        updateTime: typeof w.updatedAt === 'string' ? w.updatedAt : new Date().toISOString(),
      })
    )
  } catch (error) {
    logger.error('[Agents] Failed to fetch N8N agents', {
      error: error instanceof Error ? error.message : String(error),
      params,
    })
    return []
  }
}

// 调用智能体
export async function callAgent(
  agentId: string,
  data: {
    input: string
    context?: Record<string, unknown>
    stream?: boolean
    userMessage?: string
    conversationHistory?: Array<{ role: string; content: string }>
  }
): Promise<ApiResponse<unknown>> {
  try {
    // 优先使用 ihui API 接口
    const { sendChatCompletion } = await import('./fastapi')

    // 构建消息历史
    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []

    // 添加历史对话
    if (data.conversationHistory && data.conversationHistory.length > 0) {
      for (const msg of data.conversationHistory) {
        messages.push({
          role: (msg.role as 'user' | 'assistant' | 'system') || 'user',
          content: msg.content,
        })
      }
    }

    // 添加当前消息
    messages.push({
      role: 'user',
      content: data.userMessage || data.input,
    })

    // 使用FastAPI的chat接口，通过bot_id调用
    const chatResponse = await sendChatCompletion({
      messages,
      model: agentId, // 使用agentId作为bot_id
      user_uuid:
        (data.context as { user_uuid?: string })?.user_uuid ||
        (typeof window !== 'undefined' && (window as { userUuid?: string }).userUuid) ||
        String(StorageManager.getItem(STORAGE_KEYS.USER_UUID) || '') ||
        'anonymous',
      stream: data.stream || false,
    })

    if (chatResponse.code === 200 && chatResponse.success && chatResponse.data) {
      return {
        code: 200,
        success: true,
        message: t('api.agents.调用成功1'),
        data: chatResponse.data,
        timestamp: Date.now(),
      }
    } else {
      // 降级：尝试使用后端通用接口
      const response = await request.post(
        COZE_PATHS.chat,
        {
          bot_id: agentId,
          user_id: (data.context as { user_uuid?: string })?.user_uuid || 'anonymous',
          query: data.userMessage || data.input,
          conversation_id: (data.context as { conversation_id?: string })?.conversation_id || '',
          chat_history: messages,
          stream: data.stream || false,
        },
        { base: 3 }
      )

      return {
        code: 200,
        success: true,
        message: t('api.agents.调用成功2'),
        data: response.data || response,
        timestamp: Date.now(),
      }
    }
  } catch (error: unknown) {
    const err = error as { message?: string }
    return {
      code: 500,
      success: false,
      message: err?.message || t('api.agents.调用失败'),
      data: null,
      timestamp: Date.now(),
    }
  }
}

// 从Dify平台获取智能体列表
async function getDifyAgents(params: {
  page?: number
  pageSize?: number
  keyword?: string
}): Promise<Agent[]> {
  try {
    logger.info('[Agents] Fetching Dify platform agents', {
      page: params.page,
      pageSize: params.pageSize,
      keyword: params.keyword,
    })

    if (import.meta.env.DEV) {
      logger.info('[Agents] Dev environment, skipping Dify agents')
      return []
    }

    const difyBaseUrl = import.meta.env.VITE_DIFY_BASE_URL || 'https://api.dify.ai/v1'
    const difyApiKey = import.meta.env.VITE_DIFY_API_KEY || ''

    if (!difyApiKey) {
      logger.warn('[Agents] Dify API key not configured, skipping Dify agents')
      return []
    }

    logger.info('[Agents] Calling Dify API', { baseUrl: difyBaseUrl })

    const response = await fetch(`${difyBaseUrl}/apps`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${difyApiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
    logger.error('[Agents] Dify API request failed', {
      status: response.status,
      statusText: response.statusText,
      errorText,
    })
      throw new Error(`Dify API error: ${response.statusText}`)
    }

    const data = await response.json()
    const apps = Array.isArray(data.data) ? data.data : data.apps || []

    logger.info('[Agents] Successfully fetched Dify agents', { count: apps.length })

    return apps.map((app: Record<string, unknown>) => ({
      id: app.id || app.app_id,
      name: app.name,
      description: app.description || app.introduction || '',
      avatar: app.icon || app.avatar,
      icon: app.icon || app.avatar,
      category: app.category || 'ai-assistant',
      tags: app.tags || [],
      platform: 'dify' as AgentPlatform,
      difyAppId: app.id || app.app_id,
      difyApiKey: difyApiKey,
      difyBaseUrl: difyBaseUrl,
      status: app.enabled ? ('active' as const) : ('inactive' as const),
      usageCount: app.message_count || app.usage_count || 0,
      rating: app.rating || 0,
      ratingCount: app.rating_count || 0,
      createTime: app.created_at || new Date().toISOString(),
      updateTime: app.updated_at || new Date().toISOString(),
    }))
  } catch (error) {
    logger.error('[Agents] Failed to fetch Dify agents', {
      error: error instanceof Error ? error.message : String(error),
      params,
    })
    return []
  }
}

// 从Make平台获取智能体列表
async function getMakeAgents(params: {
  page?: number
  pageSize?: number
  keyword?: string
}): Promise<Agent[]> {
  try {
    logger.info('[Agents] Fetching Make platform agents', {
      page: params.page,
      pageSize: params.pageSize,
      keyword: params.keyword,
    })

    if (import.meta.env.DEV) {
      logger.info('[Agents] Dev environment, skipping Make agents')
      return []
    }

    const makeApiKey = import.meta.env.VITE_MAKE_API_KEY || ''

    if (!makeApiKey) {
      logger.warn('[Agents] Make API key not configured, skipping Make agents')
      return []
    }

    const makeBaseUrl = 'https://www.make.com/api/v2'

    logger.info('[Agents] Calling Make API')

    const response = await fetch(`${makeBaseUrl}/scenarios`, {
      method: 'GET',
      headers: {
        'X-API-KEY': makeApiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
    logger.error('[Agents] Make API request failed', {
      status: response.status,
      statusText: response.statusText,
      errorText,
    })
      throw new Error(`Make API error: ${response.statusText}`)
    }

    const data = await response.json()
    const scenarios = Array.isArray(data.data) ? data.data : []

    logger.info('[Agents] Successfully fetched Make agents', { count: scenarios.length })

    return scenarios.map((scenario: Record<string, unknown>) => ({
      id: scenario.id?.toString() || scenario.scenarioId?.toString(),
      name: scenario.name,
      description: scenario.description || '',
      avatar: scenario.icon || '',
      icon: scenario.icon,
      category: scenario.category || 'automation',
      tags: scenario.tags || [],
      platform: 'make' as AgentPlatform,
      makeScenarioId: scenario.id?.toString() || scenario.scenarioId?.toString(),
      makeWebhookUrl: scenario.webhookUrl || scenario.webhook_url,
      makeApiKey: makeApiKey,
      status: scenario.status === 'active' ? ('active' as const) : ('inactive' as const),
      usageCount: scenario.executionCount || scenario.execution_count || 0,
      rating: 0,
      ratingCount: 0,
      createTime: scenario.createdAt || scenario.created_at || new Date().toISOString(),
      updateTime: scenario.updatedAt || scenario.updated_at || new Date().toISOString(),
    }))
  } catch (error) {
    logger.error('[Agents] Failed to fetch Make agents', {
      error: error instanceof Error ? error.message : String(error),
      params,
    })
    return []
  }
}

// 从阿里云百炼平台获取智能体列表
async function getDashscopeAgents(params: {
  page?: number
  pageSize?: number
  keyword?: string
}): Promise<Agent[]> {
  try {
    logger.info('[Agents] Fetching Dashscope platform agents', {
      page: params.page,
      pageSize: params.pageSize,
      keyword: params.keyword,
    })

    if (import.meta.env.DEV) {
      logger.info('[Agents] Dev environment, skipping Dashscope agents')
      return []
    }

    const dashscopeApiKey = import.meta.env.VITE_DASHSCOPE_API_KEY || ''

    if (!dashscopeApiKey) {
      logger.warn('[Agents] Dashscope API key not configured, skipping Dashscope agents')
      return []
    }

    const dashscopeBaseUrl =
      import.meta.env.VITE_DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1'

    logger.info('[Agents] Calling Dashscope API', { baseUrl: dashscopeBaseUrl })

    const response = await fetch(`${dashscopeBaseUrl}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${dashscopeApiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
    logger.error('[Agents] Dashscope API request failed', {
      status: response.status,
      statusText: response.statusText,
      errorText,
    })
      throw new Error(`Dashscope API error: ${response.statusText}`)
    }

    const data = await response.json()
    const models = Array.isArray(data.data) ? data.data : data.models || []

    logger.info('[Agents] Successfully fetched Dashscope models', { totalCount: models.length })

    const chatModels = models.filter(
      (model: Record<string, unknown>) =>
        model.id && typeof model.permission === 'string' && model.permission.includes('chat')
    )

    logger.info('[Agents] Filtered chat-capable models', { chatModelCount: chatModels.length })

    return chatModels.map(
      (model: Record<string, unknown>): Agent => ({
        id: typeof model.id === 'string' ? model.id : String(model.id || ''),
        name:
          typeof model.id === 'string'
            ? model.id.replace(/^qwen\//, '').replace(/-/g, ' ')
            : String(model.id || ''),
        description:
          typeof model.description === 'string'
            ? model.description
            : `阿里云百炼模型：${typeof model.id === 'string' ? model.id : String(model.id || '')}`,
        avatar: '',
        icon: '',
        category: 'ai-model',
        tags: Array.isArray(model.tags) ? (model.tags as string[]) : [],
        platform: 'dashscope' as AgentPlatform,
        dashscopeModel: typeof model.id === 'string' ? model.id : String(model.id || ''),
        dashscopeApiKey: dashscopeApiKey,
        dashscopeBaseUrl: dashscopeBaseUrl,
        status: 'active' as const,
        usageCount: 0,
        rating: 0,
        ratingCount: 0,
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
      })
    )
  } catch (error) {
    logger.error('[Agents] Failed to fetch Dashscope agents', {
      error: error instanceof Error ? error.message : String(error),
      params,
    })
    return []
  }
}

// 获取智能体列表（支持多平台）
export async function getAgentsList(
  params: PaginationParams & {
    category?: string
    keyword?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    status?: string
    platform?: AgentPlatform // 新增：平台筛选
  }
): Promise<ApiResponse<PaginationResponse<Agent>>> {
  // 注释：已移除开发环境跳过逻辑，现在开发环境也会调用后端API获取真实智能体数据
  try {
    const platform = params.platform || 'all'
    const page = params.page || 1
    const pageSize = params.pageSize || 20

    let allAgents: Agent[] = []

    // 根据平台筛选获取智能体
    if (platform === 'all' || platform === 'internal') {
      // 内部智能体：直接按后端统一约定接数，格式为 { code, msg, rows, total }
      try {
        const res = await getAgentList({
          ...params,
          platform: platform === 'all' ? undefined : 'internal',
        })

        if (res && typeof res === 'object' && res !== null) {
          if (res.code === 401) {
            // 未登录/令牌为空时静默跳过
          } else {
            const rows = Array.isArray(res.rows) ? res.rows : []
            if (rows.length > 0) {
              allAgents.push(...(rows as Agent[]))
            } else if (import.meta.env.DEV && import.meta.env.VITE_AGENTS_SHOW_SAMPLE_WHEN_EMPTY === 'true') {
              // 开发环境且后端返回空时展示示例，便于确认列表 UI
              allAgents.push(...(GUEST_AGENT_LIST_FALLBACK.rows as Agent[]))
            }
          }
        }
      } catch (error) {
        const msg =
          error instanceof Error
            ? error.message
            : (error && typeof error === 'object' && (error as { message?: string }).message) ||
              String(error)
        const isTokenError =
          typeof msg === 'string' &&
          (msg.includes('令牌不能为空') || msg.includes('401'))
        if (isTokenError) {
          // 未登录/令牌为空：静默跳过，不刷 ERROR
        } else {
          logger.error('Failed to fetch internal agents:', error)
        }
      }
    }

    // 如果选择 all 或 coze，获取智汇智能体平台的智能体
    if (platform === 'all' || platform === 'coze') {
      try {
        const cozeAgents = await getCozeAgents({
          page,
          pageSize,
          keyword: params.keyword,
        })
        allAgents.push(...cozeAgents)
      } catch (error) {
        logger.error('Failed to fetch ihui agents:', error)
      }
    }

    // 如果选择all或n8n，获取n8n平台的智能体
    if (platform === 'all' || platform === 'n8n') {
      try {
        const n8nAgents = await getN8nAgents({
          page,
          pageSize,
          keyword: params.keyword,
        })
        allAgents.push(...n8nAgents)
      } catch (error) {
        logger.error('Failed to fetch n8n agents:', error)
      }
    }

    // 如果选择all或dify，获取Dify平台的智能体
    if (platform === 'all' || platform === 'dify') {
      try {
        const difyAgents = await getDifyAgents({
          page,
          pageSize,
          keyword: params.keyword,
        })
        allAgents.push(...difyAgents)
      } catch (error) {
        logger.error('Failed to fetch Dify agents:', error)
      }
    }

    // 如果选择all或make，获取Make平台的智能体
    if (platform === 'all' || platform === 'make') {
      try {
        const makeAgents = await getMakeAgents({
          page,
          pageSize,
          keyword: params.keyword,
        })
        allAgents.push(...makeAgents)
      } catch (error) {
        logger.error('Failed to fetch Make agents:', error)
      }
    }

    // 如果选择all或dashscope，获取阿里云百炼平台的智能体
    if (platform === 'all' || platform === 'dashscope') {
      try {
        const dashscopeAgents = await getDashscopeAgents({
          page,
          pageSize,
          keyword: params.keyword,
        })
        allAgents.push(...dashscopeAgents)
      } catch (error) {
        logger.error('Failed to fetch Dashscope agents:', error)
      }
    }

    // 应用分类筛选
    if (params.category && params.category !== 'all') {
      allAgents = allAgents.filter(
        agent => agent.category === params.category || agent.categoryId === params.category
      )
    }

    // 应用关键词搜索（统一用后端字段：agentName/agent_name、description、prologue）
    if (params.keyword) {
      const keyword = params.keyword.toLowerCase()
      const name = (a: Agent) => getAgentDisplayName(a).toLowerCase()
      const desc = (a: Agent) => getAgentDisplayDescription(a).toLowerCase()
      allAgents = allAgents.filter(
        agent =>
          name(agent).includes(keyword) ||
          desc(agent).includes(keyword) ||
          agent.tags?.some(tag => tag.toLowerCase().includes(keyword))
      )
    }

    // 应用排序
    if (params.sortBy) {
      allAgents.sort((a, b) => {
        let aValue: number | string
        let bValue: number | string

        switch (params.sortBy) {
          case 'usageCount':
            aValue = a.usageCount || 0
            bValue = b.usageCount || 0
            break
          case 'rating':
            aValue = a.rating || 0
            bValue = b.rating || 0
            break
          case 'createTime':
            aValue = new Date(a.createTime || 0).getTime()
            bValue = new Date(b.createTime || 0).getTime()
            break
          default:
            return 0
        }

        // 类型断言：确保值可以比较
        const aVal = aValue as number | string
        const bVal = bValue as number | string

        if (params.sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1
        } else {
          return aVal < bVal ? 1 : -1
        }
      })
    }

    // 应用分页
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const paginatedAgents = allAgents.slice(start, end)

    return {
      code: 200,
      success: true,
      message: t('api.agents.获取成功3'),
      timestamp: Date.now(),
      data: {
        list: paginatedAgents,
        pagination: {
          page,
          pageSize,
          total: allAgents.length,
          totalPages: Math.ceil(allAgents.length / pageSize),
        },
      },
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.agents.获取列表失败'),
      timestamp: Date.now(),
      data: {
        list: [],
        pagination: {
          page: params.page || 1,
          pageSize: params.pageSize || 20,
          total: 0,
          totalPages: 0,
        },
      },
    }
  }
}

// 获取智能体详情（优先从 Python 后端获取）
export async function getAgentDetail(id: string): Promise<ApiResponse<Agent>> {
  try {
    // 1. 优先从 ihui API 后端 /cozeZhsApi/agents/{agent_id} 获取详情
    try {
      // 为避免与 axios 的 request 冲突，这里动态导入 services/api 的 fetch 封装
      const { request: backendRequest } = await import('@/services/api')
      const raw = await backendRequest({
        url: `/agents/${id}`,
        method: 'GET',
        base: 3, // BASE_URL3 -> ihui API，开发: /cozeZhsApi，生产: /cozeZhsApi（由 nginx 代理）
      })

      const source =
        raw && typeof raw === 'object' && 'data' in raw ? (raw as { data: unknown }).data : raw

      if (source && typeof source === 'object' && source !== null) {
        const sourceObj = source as Record<string, unknown>
        if ('agent_id' in sourceObj || 'agent_name' in sourceObj) {
          const platform: AgentPlatform =
            (typeof sourceObj.platform === 'string' &&
            sourceObj.platform in ['coze', 'n8n', 'dify', 'make', 'dashscope', 'internal', 'all']
              ? (sourceObj.platform as AgentPlatform)
              : undefined) ||
            ((sourceObj.bot_id || sourceObj.bot_name ? 'coze' : 'internal') as AgentPlatform)

          const normalized: Agent = {
            id:
              (typeof sourceObj.agent_id === 'string' ? sourceObj.agent_id : undefined) ||
              (typeof sourceObj.agent_name === 'string' ? sourceObj.agent_name : undefined) ||
              id,
            name:
              (typeof sourceObj.agent_name === 'string' ? sourceObj.agent_name : undefined) ||
              (typeof sourceObj.bot_name === 'string' ? sourceObj.bot_name : undefined) ||
              '',
            description:
              (typeof sourceObj.agent_description === 'string'
                ? sourceObj.agent_description
                : undefined) ||
              (typeof sourceObj.description === 'string' ? sourceObj.description : undefined) ||
              (typeof sourceObj.agent_prompt === 'string' ? sourceObj.agent_prompt : undefined) ||
              '',
            avatar:
              (typeof sourceObj.agent_avatar === 'string' ? sourceObj.agent_avatar : undefined) ||
              (typeof sourceObj.icon_url === 'string' ? sourceObj.icon_url : undefined) ||
              '',
            icon:
              (typeof sourceObj.agent_avatar === 'string' ? sourceObj.agent_avatar : undefined) ||
              (typeof sourceObj.icon_url === 'string' ? sourceObj.icon_url : undefined) ||
              '',
            category: typeof sourceObj.category === 'string' ? sourceObj.category : undefined,
            tags: Array.isArray(sourceObj.tags) ? (sourceObj.tags as string[]) : [],
            platform,
            creatorId: typeof sourceObj.creator_id === 'string' ? sourceObj.creator_id : undefined,
            creatorName:
              (typeof sourceObj.creator_name === 'string' ? sourceObj.creator_name : undefined) ||
              (typeof sourceObj.user_name === 'string' ? sourceObj.user_name : undefined),
            rating: typeof sourceObj.rating === 'number' ? sourceObj.rating : 0,
            ratingCount: typeof sourceObj.rating_count === 'number' ? sourceObj.rating_count : 0,
            usageCount: typeof sourceObj.usage_count === 'number' ? sourceObj.usage_count : 0,
            status:
              typeof sourceObj.publish_status === 'number' && sourceObj.publish_status === 1
                ? 'active'
                : typeof sourceObj.publish_status === 'number' && sourceObj.publish_status === 0
                  ? 'inactive'
                  : 'active',
            isPublic: typeof sourceObj.is_public === 'boolean' ? sourceObj.is_public : true,
            createTime: typeof sourceObj.created_at === 'string' ? sourceObj.created_at : undefined,
            updateTime: typeof sourceObj.updated_at === 'string' ? sourceObj.updated_at : undefined,
            isFavorite: typeof sourceObj.is_favorite === 'boolean' ? sourceObj.is_favorite : false,
            // 智汇智能体相关字段尽量透传
            cozeBotId:
              (typeof sourceObj.bot_id === 'string' ? sourceObj.bot_id : undefined) ||
              (typeof sourceObj.bot_id_str === 'string' ? sourceObj.bot_id_str : undefined),
          }

          return {
            code: 200,
            success: true,
            message: t('api.agents.获取成功4'),
            timestamp: Date.now(),
            data: normalized,
          }
        }
      }
    } catch (e) {
      // 线上详情获取失败时，继续走本地兜底逻辑
      if (import.meta.env.DEV) {
        logger.warn('Failed to fetch agent details from Python backend, trying fallback:', e)
      }
    }

    // 2. 兜底：尝试从内部 API 获取（Node 网关或本地模拟）
    try {
      const response = await request.get(API_AGENTS_PATHS.byId(id))
      if (response && response.data) {
        return {
          code: 200,
          success: true,
          message: t('api.agents.获取成功5'),
          timestamp: Date.now(),
          data: {
            ...response.data,
            platform: (response.data.platform || 'internal') as AgentPlatform,
          },
        }
      }
    } catch (error) {
      logger.debug('Internal API failed to fetch agent details, trying to find from aggregate list:', {
        error: error instanceof Error ? error.message : String(error),
        agentId: id,
      })
      // 内部API失败，尝试从聚合列表中查找
    }

    // 3. 再兜底：从智汇智能体 / n8n 列表中查找
    try {
      const cozeAgents = await getCozeAgents({})
      const cozeAgent = cozeAgents.find(agent => agent.id === id)
      if (cozeAgent) {
        return {
          code: 200,
          success: true,
          message: t('api.agents.获取成功6'),
          timestamp: Date.now(),
          data: cozeAgent,
        }
      }
    } catch (error) {
      logger.debug('Failed to fetch agent details from ihui agents:', {
        error: error instanceof Error ? error.message : String(error),
        agentId: id,
      })
      // 智汇智能体获取失败
    }

    try {
      const n8nAgents = await getN8nAgents({})
      const n8nAgent = n8nAgents.find(agent => agent.id === id)
      if (n8nAgent) {
        return {
          code: 200,
          success: true,
          message: t('api.agents.获取成功7'),
          timestamp: Date.now(),
          data: n8nAgent,
        }
      }
    } catch (error) {
      logger.debug('Failed to fetch agent details from n8n:', {
        error: error instanceof Error ? error.message : String(error),
        agentId: id,
      })
      // n8n 获取失败
    }

    // 4. 最后兜底：从本地示例 mock 中查找（保证 mock id 可访问详情）
    const mockHit = findMockAgentById(id)
    if (mockHit) {
      const normalized: Agent = {
        id: String(mockHit.id ?? mockHit.agentId ?? mockHit.botId ?? id),
        name: mockHit.agentName ?? mockHit.name,
        agentName: mockHit.agentName ?? mockHit.name,
        description: mockHit.agentDescription ?? mockHit.description,
        avatar: mockHit.agentAvatar ?? mockHit.avatar,
        icon: mockHit.agentAvatar ?? mockHit.avatar,
        category: String(mockHit.category || mockHit.agentMainCategory?.[0]?.name || ''),
        tags: [],
        platform: 'internal' as AgentPlatform,
        creatorName: mockHit.creatorName,
        usageCount: mockHit.usageCount ?? 0,
        rating: 0,
        ratingCount: 0,
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
        status: 'active' as const,
        isPublic: true,
        botId: mockHit.botId,
        cozeBotId: mockHit.botId,
      }
      logger.warn('[Agents] Backend miss, switched to local mock data:', id)
      return {
        code: 200,
        success: true,
        message: 'Switched to local mock data',
        timestamp: Date.now(),
        data: normalized,
      }
    }

    return {
      code: 404,
      success: false,
      message: t('api.agents.智能体不存在8'),
      timestamp: Date.now(),
      data: {} as Agent,
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取智能体详情失败',
      timestamp: Date.now(),
      data: {} as Agent,
    }
  }
}

// 获取智能体分类列表（已移除 /agents/categories 接口，直接返回默认分类）
const DEFAULT_AGENT_CATEGORIES: AgentCategory[] = [
  { id: 'all', name: '全部', count: 0 },
  { id: 'assistant', name: '助手', count: 0 },
  { id: 'creative', name: '创意', count: 0 },
  { id: 'business', name: '商务', count: 0 },
  { id: 'education', name: '教育', count: 0 },
  { id: 'entertainment', name: '娱乐', count: 0 },
  { id: 'automation', name: '自动化', count: 0 },
]

export async function getAgentCategories(): Promise<ApiResponse<AgentCategory[]>> {
  return {
    code: 200,
    success: true,
    message: 'ok',
    timestamp: Date.now(),
    data: [...DEFAULT_AGENT_CATEGORIES],
  }
}

// 收藏智能体
export async function favoriteAgent(agentId: string): Promise<ApiResponse<boolean>> {
  try {
    await request.post(API_AGENTS_PATHS.favorite(agentId))
    return {
      code: 200,
      success: true,
      message: t('api.agents.收藏成功11'),
      timestamp: Date.now(),
      data: true,
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.agents.收藏失败'),
      timestamp: Date.now(),
      data: false,
    }
  }
}

// 取消收藏智能体
export async function unfavoriteAgent(agentId: string): Promise<ApiResponse<boolean>> {
  try {
    await request.delete(API_AGENTS_PATHS.favorite(agentId))
    return {
      code: 200,
      success: true,
      message: t('api.agents.取消收藏成功12'),
      timestamp: Date.now(),
      data: true,
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '取消收藏失败',
      timestamp: Date.now(),
      data: false,
    }
  }
}

// 获取热门智能体
export async function getPopularAgents(params?: {
  limit?: number
  timeRange?: 'day' | 'week' | 'month'
  platform?: AgentPlatform
}): Promise<ApiResponse<Agent[]>> {
  try {
    const response = await getAgentsList({
      page: 1,
      pageSize: params?.limit || 10,
      sortBy: 'usageCount',
      sortOrder: 'desc',
      platform: params?.platform || 'all',
    })

    if (response.code === 200 && response.data) {
      const paginationData = response.data as PaginationResponse<Agent>
      return {
        code: 200,
        success: true,
        message: t('api.agents.获取成功13'),
        timestamp: Date.now(),
        data: (paginationData.list || []).slice(0, params?.limit || 10),
      }
    }

    return {
      code: 200,
      success: true,
      message: t('api.agents.获取成功14'),
      timestamp: Date.now(),
      data: [],
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.agents.获取热门智能体失败'),
      timestamp: Date.now(),
      data: [],
    }
  }
}

// 获取智能体评价列表
export const getAgentReviews = withApiResponseHandler(
  async (
    agentId: string,
    params?: PaginationParams
  ): Promise<
    ApiResponse<
      PaginationResponse<{
        id: string
        userId: string
        userName: string
        userAvatar: string
        rating: number
        comment: string
        createTime: string
      }>
    >
  > => {
    const response = await request.get(API_AGENTS_PATHS.reviews(agentId), {
      params,
    })
    const normalizedResponse = normalizeApiResponse(response)
    const paginationData = normalizePaginationResponse<{
      id: string
      userId: string
      userName: string
      userAvatar: string
      rating: number
      comment: string
      createTime: string
    }>(normalizedResponse)

    return {
      ...normalizedResponse,
      data: paginationData as PaginationResponse<{
        id: string
        userId: string
        userName: string
        userAvatar: string
        rating: number
        comment: string
        createTime: string
      }>,
    }
  }
)

// 提交智能体评价
export const submitAgentReview = withApiResponseHandler(
  async (
    agentId: string,
    data: {
      rating: number
      comment: string
    }
  ): Promise<ApiResponse<{ id: string }>> => {
    const response = await request.post(API_AGENTS_PATHS.reviews(agentId), data)
    return normalizeApiResponse(response)
  }
)

// 同步智汇智能体平台的智能体到本地
export async function syncCozeAgents(): Promise<ApiResponse<number>> {
  try {
    const cozeAgents = await getCozeAgents({})
    return {
      code: 200,
      success: true,
      message: t('api.agents.同步成功15'),
      timestamp: Date.now(),
      data: cozeAgents.length,
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.agents.同步失败'),
      timestamp: Date.now(),
      data: 0,
    }
  }
}

// 同步n8n平台的智能体到本地
export async function syncN8nAgents(): Promise<ApiResponse<number>> {
  try {
    const n8nAgents = await getN8nAgents({})
    return {
      code: 200,
      success: true,
      message: t('api.agents.同步成功16'),
      timestamp: Date.now(),
      data: n8nAgents.length,
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.agents.同步失败'),
      timestamp: Date.now(),
      data: 0,
    }
  }
}

// 同步Dify平台的智能体到本地
export async function syncDifyAgents(): Promise<ApiResponse<number>> {
  try {
    const difyAgents = await getDifyAgents({})
    // 这里可以调用后端API将Dify智能体同步到数据库
    return {
      code: 200,
      success: true,
      message: t('api.agents.同步成功17'),
      timestamp: Date.now(),
      data: difyAgents.length,
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.agents.同步失败'),
      timestamp: Date.now(),
      data: 0,
    }
  }
}

// 同步Make平台的智能体到本地
export async function syncMakeAgents(): Promise<ApiResponse<number>> {
  try {
    const makeAgents = await getMakeAgents({})
    // 这里可以调用后端API将Make智能体同步到数据库
    return {
      code: 200,
      success: true,
      message: t('api.agents.同步成功18'),
      timestamp: Date.now(),
      data: makeAgents.length,
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.agents.同步失败'),
      timestamp: Date.now(),
      data: 0,
    }
  }
}

// 同步阿里云百炼平台的智能体到本地
export async function syncDashscopeAgents(): Promise<ApiResponse<number>> {
  try {
    const dashscopeAgents = await getDashscopeAgents({})
    // 这里可以调用后端API将百炼智能体同步到数据库
    return {
      code: 200,
      success: true,
      message: t('api.agents.同步成功19'),
      timestamp: Date.now(),
      data: dashscopeAgents.length,
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.agents.同步失败'),
      timestamp: Date.now(),
      data: 0,
    }
  }
}

export async function interactAgent(params: {
  agent_id: number | string
  action: 'like' | 'favorite' | 'share'
  status: 0 | 1
  source?: string
}): Promise<ApiResponse<{ log_id?: number; current_count?: number; status: number }>> {
  try {
    const primary = await request.post(REMOTE_PATHS.agents.interact, params)
    return {
      code: 200,
      success: true,
      message: t('api.agents.操作成功20'),
      data: primary.data || primary,
      timestamp: Date.now(),
    }
  } catch (e1: unknown) {
    try {
      if (params.action === 'like') {
        const r = await request.post(REMOTE_PATHS.thumbs, { agentId: params.agent_id })
        return {
          code: 200,
          success: true,
          message: t('api.agents.操作成功21'),
          data: r.data || r,
          timestamp: Date.now(),
        }
      }
      if (params.action === 'favorite') {
        if (params.status === 1) {
          const r = await request.post(REMOTE_PATHS.collect, { agentId: params.agent_id })
          return {
            code: 200,
            success: true,
            message: t('api.agents.操作成功22'),
            data: r.data || r,
            timestamp: Date.now(),
          }
        } else {
          const r = await request.delete(REMOTE_PATHS.collectByAgent(String(params.agent_id)))
          return {
            code: 200,
            success: true,
            message: t('api.agents.操作成功23'),
            data: r.data || r,
            timestamp: Date.now(),
          }
        }
      }
      const fallback = await request.post(REMOTE_PATHS.agents.interact, params)
      return {
        code: 200,
        success: true,
        message: t('api.agents.操作成功24'),
        data: fallback.data || fallback,
        timestamp: Date.now(),
      }
    } catch (e2: unknown) {
      return {
        code: 500,
        success: false,
        message:
          (e2 instanceof Error ? e2.message : String(e2)) ||
          (e1 instanceof Error ? e1.message : String(e1)) ||
          t('api.agents.互动操作失败'),
        data: { status: params.status },
        timestamp: Date.now(),
      }
    }
  }
}

export async function ruleSearchAgents(params: {
  rule: string
  page?: number
  size?: number
}): Promise<
  ApiResponse<{
    total: number | string
    list: Array<{ id: string; name: string; description?: string; avatar?: string; type?: string }>
  }>
> {
  try {
    const primary = await request.get(REMOTE_PATHS.agents.ruleSearch, { params })
    return {
      code: 200,
      success: true,
      message: t('api.agents.操作成功25'),
      data: primary.data || primary,
      timestamp: Date.now(),
    }
  } catch (e1: unknown) {
    try {
      const r = await searchAgents({
        keyword: params.rule,
        page: params.page,
        page_size: params.size,
      })
      return {
        code: 200,
        success: true,
        message: t('api.agents.操作成功26'),
        data: {
          total: r.data?.total || 0,
          list: (r.data?.list || []).map(a => ({
            id: String(a.id),
            name: a.agentName ?? a.name ?? '',
            description: a.description ?? a.prologue ?? '',
            avatar: a.avatar,
            type: a.category,
          })),
        },
        timestamp: Date.now(),
      }
    } catch (e2: unknown) {
      return {
        code: 500,
        success: false,
        message:
          (e2 instanceof Error ? e2.message : String(e2)) ||
          (e1 instanceof Error ? e1.message : String(e1)) ||
          '规则搜索失败',
        data: { total: 0, list: [] },
        timestamp: Date.now(),
      }
    }
  }
}

// 获取我的收藏列表（与小程序端一致）
export async function getUserFavorites(params: { uuid: string; search?: string }): Promise<
  ApiResponse<
    Array<{
      favoriteId: string
      agentId: string
      agentName: string
      description?: string
      avatar?: string
      price?: number
      collectCount?: number
      downloadCount?: number
      status?: string
      favoriteTime: string
    }>
  >
> {
  const response = await request.get(REMOTE_PATHS.byCollect(params.uuid), {
    params: params.search ? { search: params.search } : {},
  })
  return {
    code: 200,
    success: true,
    message: t('api.agents.获取成功27'),
    data: response.data || response,
    timestamp: Date.now(),
  }
}

// 获取我的购买列表（与小程序端一致）
export async function getUserPurchasedAgents(params: {
  uuid: string
  search?: string
  type?: number
  date?: string
}): Promise<
  ApiResponse<
    Array<{
      id: string
      userUuid: string
      agentId: string
      agentName: string
      agentAvatar?: string
      agentDescription?: string
      orderNo: string
      buyType?: number
      buyDuration?: number
      amount: number
      status: string
      expireTime?: string
      createdAt: string
      updatedAt: string
    }>
  >
> {
  const response = await request.get(REMOTE_PATHS.byPay, {
    params: {
      uuid: params.uuid,
      search: params.search,
      type: params.type,
      date: params.date,
    },
  })
  return {
    code: 200,
    success: true,
    message: t('api.agents.获取成功28'),
    data: response.data || response,
    timestamp: Date.now(),
  }
}

// ========== 智能体操作接口 ==========

// 点赞/取消点赞智能体
export const toggleAgentThumbs = withApiResponseHandler(
  async (data: {
    uuid: string
    botId: string
  }): Promise<
    ApiResponse<{
      action: 'add' | 'remove'
      is_thumbs: boolean
      agents_updated: boolean
    }>
  > => {
    const response = await request.post(COZE_PATHS.agents.thumbs, {
      uuid: data.uuid,
      bot_id: data.botId,
    })
    return normalizeApiResponse(response)
  }
)

// 收藏/取消收藏智能体
export const toggleAgentCollect = withApiResponseHandler(
  async (data: {
    uuid: string
    botId: string
  }): Promise<
    ApiResponse<{
      action: 'add' | 'remove'
      is_collect: boolean
      agents_updated: boolean
    }>
  > => {
    const response = await request.post(COZE_PATHS.agents.collect, {
      uuid: data.uuid,
      bot_id: data.botId,
    })
    return normalizeApiResponse(response)
  }
)

// 记录智能体使用
export const recordAgentUse = withApiResponseHandler(
  async (data: {
    uuid: string
    botId: string
  }): Promise<
    ApiResponse<{
      success: boolean
      message: string
    }>
  > => {
    const response = await request.post(COZE_PATHS.agents.use, {
      uuid: data.uuid,
      bot_id: data.botId,
    })
    return normalizeApiResponse(response)
  }
)

// 下架智能体
export const unpublishAgent = withApiResponseHandler(
  async (data: {
    agent_id: string
    reason?: string
    operator_id?: string
    operator_name?: string
  }): Promise<
    ApiResponse<{
      agent_id: string
      agent_name: string
      current_status: string
      action: string
    }>
  > => {
    const response = await request.post(COZE_PATHS.agents.unpublish, data)
    return normalizeApiResponse(response)
  }
)

// 获取用户Token余额
export const getUserTokenBalance = withApiResponseHandler(
  async (
    user_uuid: string
  ): Promise<
    ApiResponse<{
      user_uuid: string
      balance: number
      total_earned: number
      total_used: number
    }>
  > => {
    const response = await request.get(COZE_PATHS.agents.tokenBalance(user_uuid))
    return normalizeApiResponse(response)
  }
)

// 更新用户Token余额
export const updateUserTokenBalance = withApiResponseHandler(
  async (
    user_uuid: string,
    data: {
      balance?: number
      total_earned?: number
      total_used?: number
    }
  ): Promise<
    ApiResponse<{
      user_uuid: string
      balance: number
      total_earned: number
      total_used: number
    }>
  > => {
    const response = await request.put(COZE_PATHS.agents.tokenBalance(user_uuid), data)
    return normalizeApiResponse(response)
  }
)

// 获取用户账单统计
export const getUserBilling = withApiResponseHandler(
  async (data: {
    uuid: string
    type: 'w' | 'm' | 'y' | 'a' // w=周, m=月, y=年, a=全部
    page?: number
    page_size?: number
  }): Promise<
    ApiResponse<{
      list: Array<{
        agentName: string
        create_at: string
        token: number
        record_root_id: string
        billing_count: number
      }>
      pagination: {
        page: number
        page_size: number
        total: number
        pages: number
      }
    }>
  > => {
    const response = await request.post(COZE_PATHS.agents.userBilling, data)
    return normalizeApiResponse(response)
  }
)

// 清理智能体缓存
export const clearAgentCache = withApiResponseHandler(
  async (): Promise<ApiResponse<{ success: boolean; message: string }>> => {
    const response = await request.post(COZE_PATHS.agents.clearCache)
    return normalizeApiResponse(response)
  }
)

// 创建智能体
export const createAgent = withApiResponseHandler(
  async (data: {
    agent_name: string
    agent_id?: string
    agent_avatar?: string
    prologue?: string
    category_id?: string
    [key: string]: unknown
  }): Promise<ApiResponse<Agent>> => {
    const response = await request.post(AGENTS_LEGACY_PATHS.create, data)
    return normalizeApiResponse(response)
  }
)

// 更新智能体
export const updateAgent = withApiResponseHandler(
  async (data: {
    agentId?: string
    agent_id?: string
    agent_name?: string
    agent_avatar?: string
    prologue?: string
    category_id?: string
    [key: string]: unknown
  }): Promise<ApiResponse<Agent>> => {
    const response = await request.put(AGENTS_LEGACY_PATHS.update, data)
    return normalizeApiResponse(response)
  }
)

// 删除智能体
export const deleteAgent = withApiResponseHandler(
  async (agentIds: string | string[]): Promise<ApiResponse<{ success: boolean; message: string }>> => {
    const idsString = Array.isArray(agentIds) ? agentIds.join(',') : agentIds
    const response = await request.delete(AGENTS_LEGACY_PATHS.delete(idsString))
    return normalizeApiResponse(response)
  }
)

// 获取智能体详细信息（包含变量、图标等）
export const getAgentDetails = withApiResponseHandler(
  async (
    agent_id: string,
    force_refresh?: boolean
  ): Promise<
    ApiResponse<{
      agent_id: string
      agent_name: string
      icon_url?: string
      variables?: unknown[]
      agents_variable?: unknown[]
      model_info?: unknown
      prompt_info?: unknown
      plugin_info_list?: unknown[]
      knowledge_info?: unknown
      onboarding_info?: unknown
    }>
  > => {
    const response = await request.get(COZE_PATHS.agents.details(agent_id), {
      params: { force_refresh: force_refresh ? 'true' : 'false' },
    })
    return normalizeApiResponse(response)
  }
)

// 手动获取并更新智能体详细信息
export const fetchAgentDetails = withApiResponseHandler(
  async (
    agent_id: string
  ): Promise<
    ApiResponse<{
      message: string
      agent_id: string
      agent_name: string
      details: {
        icon_url?: string
        variables_count: number
        variables: unknown[]
        agents_variable: unknown[]
        agents_variable_count: number
        has_model_info: boolean
        has_prompt_info: boolean
        plugin_count: number
        has_knowledge_info: boolean
        has_onboarding_info: boolean
      }
      updated_at: string
    }>
  > => {
    const response = await request.post(COZE_PATHS.agents.fetchDetails(agent_id))
    return normalizeApiResponse(response)
  }
)

// 获取智能体账单列表
export const getAgentBillings = withApiResponseHandler(
  async (
    params?: PaginationParams & {
      agent_id?: string
      user_uuid?: string
      start_date?: string
      end_date?: string
    }
  ): Promise<ApiResponse<PaginationResponse<unknown>>> => {
    const response = await request.get(COZE_PATHS.agents.billings, {
      params: {
        page: params?.page || 1,
        page_size: params?.pageSize || 20,
        agent_id: params?.agent_id,
        user_uuid: params?.user_uuid,
        start_date: params?.start_date,
        end_date: params?.end_date,
      },
    })
    const normalizedResponse = normalizeApiResponse(response)
    const paginationData = normalizePaginationResponse(normalizedResponse)
    return {
      ...normalizedResponse,
      data: paginationData,
    }
  }
)

// 获取智能体账单详情
export const getAgentBillingDetail = withApiResponseHandler(
  async (billing_id: string): Promise<ApiResponse<unknown>> => {
    const response = await request.get(COZE_PATHS.agents.billingById(billing_id))
    return normalizeApiResponse(response)
  }
)

// 修改智能体标签
export const editAgentLabel = withApiResponseHandler(
  async (data: { agent_ids: string[]; labels: string[] }): Promise<ApiResponse<void>> => {
    const response = await request.put(AGENTS_LEGACY_PATHS.labelEdit, data)
    return normalizeApiResponse(response)
  }
)

// 导出智能体
export const exportAgents = withApiResponseHandler(
  async (data: { agent_ids?: string[]; format?: string }): Promise<ApiResponse<Blob>> => {
    const response = await request.post(AGENTS_LEGACY_PATHS.export, data, { responseType: 'blob' })
    return normalizeApiResponse(response)
  }
)

// 修改智能体状态
export const editAgentStatus = withApiResponseHandler(
  async (data: { agent_ids: string[]; status: string }): Promise<ApiResponse<void>> => {
    const response = await request.post(AGENTS_LEGACY_PATHS.editStatus, data)
    return normalizeApiResponse(response)
  }
)

// 获取智能体详情
export const getAgentById = withApiResponseHandler(
  async (agentId: string): Promise<ApiResponse<Agent>> => {
    const response = await request.get(AGENTS_LEGACY_PATHS.byId(agentId))
    return normalizeApiResponse(response)
  }
)

// 删除智能体
export const deleteAgents = withApiResponseHandler(
  async (agentIds: string[]): Promise<ApiResponse<void>> => {
    const response = await request.delete(AGENTS_LEGACY_PATHS.delete(agentIds.join(',')))
    return normalizeApiResponse(response)
  }
)
