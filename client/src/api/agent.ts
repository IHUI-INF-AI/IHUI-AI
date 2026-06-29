import { COZE_PATHS } from '@/config/backend-paths'
import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import {
  withApiResponseHandler,
  normalizeApiResponse,
} from '@/utils/api-response'

export type AgentPlatform = 'coze' | 'n8n' | 'dify' | 'make' | 'dashscope' | 'internal' | 'all'

export interface Agent {
  id: string
  name: string
  description: string
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
  cozeBotId?: string
  cozeConversationId?: string
  cozeApiKey?: string
  n8nWorkflowId?: string
  n8nWebhookUrl?: string
  n8nApiKey?: string
  difyAppId?: string
  difyConversationId?: string
  difyApiKey?: string
  difyBaseUrl?: string
  makeScenarioId?: string
  makeWebhookUrl?: string
  makeApiKey?: string
  dashscopeModel?: string
  dashscopeApiKey?: string
  dashscopeBaseUrl?: string
  botId?: string
  suggestedQuestions?: string[]
}

export interface AgentDetail extends Agent {
  configuration?: Record<string, unknown>
  capabilities?: string[]
  pricing?: {
    currency?: string
    price?: number
    unit?: string
  }
  version?: string
  documentation?: string
}

export interface AgentCreateParams {
  name: string
  description: string
  avatar?: string
  category?: string
  tags?: string[]
  type?: string
  platform?: AgentPlatform
  configuration?: Record<string, unknown>
  isPublic?: boolean
}

export interface AgentUpdateParams extends Partial<AgentCreateParams> {
  id: string
}

export interface AgentSearchParams extends PaginationParams {
  keyword?: string
  category?: string
  platform?: AgentPlatform
  status?: 'active' | 'inactive' | 'deprecated'
  isPublic?: boolean
  creatorId?: string
  sortBy?: 'name' | 'createTime' | 'usageCount' | 'rating'
  sortOrder?: 'asc' | 'desc'
}

export const getAgent = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AgentDetail>> => {
    // 注释：已移除开发环境 mock 逻辑，现在调用后端API获取真实智能体详情
    const response = await request.get<AgentDetail>(`/agents/${id}`)
    return normalizeApiResponse(response)
  }
)

export const createAgent = withApiResponseHandler(
  async (params: AgentCreateParams): Promise<ApiResponse<Agent>> => {
    // 注释：已移除开发环境 mock 逻辑，现在调用后端API创建智能体
    const response = await request.post<Agent>('/agents', params)
    return normalizeApiResponse(response)
  }
)

export const updateAgent = withApiResponseHandler(
  async (params: AgentUpdateParams): Promise<ApiResponse<Agent>> => {
    // 注释：已移除开发环境 mock 逻辑，现在调用后端API更新智能体
    const response = await request.put<Agent>('/agents', params)
    return normalizeApiResponse(response)
  }
)

export const deleteAgent = withApiResponseHandler(
  async (agentIds: string | string[]): Promise<ApiResponse<null>> => {
    // 注释：已移除开发环境 mock 逻辑，现在调用后端API删除智能体
    const idsString = Array.isArray(agentIds) ? agentIds.join(',') : agentIds
    const response = await request.delete<null>(`/agents/${idsString}`)
    return normalizeApiResponse(response)
  }
)

export const searchAgents = withApiResponseHandler(
  async (params: AgentSearchParams): Promise<ApiResponse<PaginationResponse<Agent>>> => {
    // 注释：Coze /agent/search 使用 snake_case 查询参数，前端入参保持 camelCase 在此转换
    const response = await request.get<PaginationResponse<Agent>>(COZE_PATHS.agent.search, {
      params: {
        page: params.page,
        page_size: params.pageSize,
        keyword: params.keyword,
        category: params.category,
        platform: params.platform,
        status: params.status,
        is_public: params.isPublic,
        creator_id: params.creatorId,
        sort_by: params.sortBy,
        sort_order: params.sortOrder,
      },
    })
    return normalizeApiResponse(response)
  }
)

export const getAgentCategories = withApiResponseHandler(
  async (): Promise<ApiResponse<Array<{ id: string; name: string; count: number }>>> => {
    // 注释：已移除开发环境 mock 逻辑，现在调用后端API获取智能体分类
    const response = await request.get<Array<{ id: string; name: string; count: number }>>(
      COZE_PATHS.agent.categories
    )
    return normalizeApiResponse(response)
  }
)

export const toggleAgentFavorite = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<{ isFavorite: boolean }>> => {
    // 注释：已移除开发环境 mock 逻辑，现在调用后端API切换收藏状态
    const response = await request.post<{ isFavorite: boolean }>(COZE_PATHS.agent.favorite(id))
    return normalizeApiResponse(response)
  }
)

export const getAgentUsage = withApiResponseHandler(
  async (id: string, params?: { startDate?: string; endDate?: string }): Promise<ApiResponse<{ totalUsage: number; dailyUsage: Array<{ date: string; count: number }> }>> => {
    // 注释：已移除开发环境 mock 逻辑，现在调用后端API获取智能体使用统计；Coze 后端使用 snake_case 查询参数
    const response = await request.get<{ totalUsage: number; dailyUsage: Array<{ date: string; count: number }> }>(
      COZE_PATHS.agent.usage(id),
      { params: params ? { start_date: params.startDate, end_date: params.endDate } : undefined }
    )
    return normalizeApiResponse(response)
  }
)

/** 智能体评价项：与 Coze 后端返回字段一致（后端为 snake_case 时在此映射为前端展示用） */
export interface AgentReviewItem {
  id: string
  userId: string
  userName: string
  rating: number
  comment: string
  createTime: string
}

export const getAgentReviews = withApiResponseHandler(
  async (id: string, params?: PaginationParams): Promise<ApiResponse<PaginationResponse<AgentReviewItem>>> => {
    // Coze 后端使用 snake_case 查询参数；响应若为 snake_case 在下方做一次映射
    const response = await request.get<{
      list?: Array<{ id: string; user_id?: string; userId?: string; user_name?: string; userName?: string; rating: number; comment: string; create_time?: string; createTime?: string }>
      pagination?: { total: number; page: number; page_size?: number; pageSize?: number; total_pages?: number; totalPages?: number }
    }>(COZE_PATHS.agent.reviews(id), {
      params: { page: params?.page, page_size: params?.pageSize },
    })
    const raw = response.data
    const list: AgentReviewItem[] = (raw?.list || []).map((item) => ({
      id: item.id,
      userId: item.user_id ?? item.userId ?? '',
      userName: item.user_name ?? item.userName ?? '',
      rating: item.rating,
      comment: item.comment,
      createTime: item.create_time ?? item.createTime ?? '',
    }))
    const pagination = raw?.pagination
    const total = pagination?.total ?? list.length
    const page = pagination?.page ?? params?.page ?? 1
    const pageSize = pagination?.page_size ?? pagination?.pageSize ?? 20
    const totalPages = pagination?.total_pages ?? pagination?.totalPages ?? Math.ceil(total / pageSize)
    return normalizeApiResponse({
      ...response,
      data: {
        list,
        pagination: { total, page, pageSize, totalPages },
      },
    } as { data: PaginationResponse<AgentReviewItem> })
  }
)
