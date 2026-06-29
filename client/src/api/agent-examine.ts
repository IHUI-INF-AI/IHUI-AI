import { COZE_PATHS } from '../config/backend-paths'

/**
 * 智能体审核管理API
 * 对应后端路由：/cozeZhsApi/agent-examine
 */

import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import {
  withApiResponseHandler,
  normalizeApiResponse,
} from '@/utils/api-response'

// 智能体审核记录接口
export interface AgentExamine {
  id: string
  agent_id: string
  agent_name: string
  agent_avatar?: string
  prologue?: string
  category_id?: string
  status: number // 0=待审核, 1=审核中, 2=已通过, 3=已拒绝, 4=已退回, 5=已删除
  start_time: string
  start_user: string
  start_phone?: string
  start_name: string
  examine_time?: string
  examine_user?: string
  examine_user_id?: string
  desc?: string
  follow?: string
  created_at: string
  updated_at: string
  category_info?: unknown
}

// 审核统计信息
export interface AgentExamineStats {
  total: number
  pending: number // 审核中 (status=1)
  approved: number // 通过 (status=2)
  rejected: number // 拒绝 (status=3)
  returned: number // 退回 (status=4)
  deleted: number // 删除 (status=5)
}

// 创建智能体审核记录
export const createAgentExamine = withApiResponseHandler(
  async (data: {
    agent_id: string
    agent_name: string
    agent_avatar?: string
    prologue?: string
    category_id?: string
    status?: number
    start_user: string
    start_phone?: string
    start_name: string
    desc?: string
    follow?: string
  }): Promise<ApiResponse<AgentExamine>> => {
    const response = await request.post<AgentExamine>(COZE_PATHS.agentExamine.create, data)
    return normalizeApiResponse(response)
  }
)

// 获取智能体审核记录列表
export const getAgentExamineList = withApiResponseHandler(
  async (
    params?: PaginationParams & {
      agent_id?: string
      agent_name?: string
      category_id?: string
      status?: number
      status_list?: string // 多状态筛选，逗号分隔
      start_user?: string
      start_name?: string
      examine_user_id?: string
      examine_user?: string
      keyword?: string // 关键词搜索
      start_date?: string
      end_date?: string
      examine_start_date?: string
      examine_end_date?: string
      sort_by?: string
      sort_order?: 'asc' | 'desc'
    }
  ): Promise<ApiResponse<PaginationResponse<AgentExamine>>> => {
    const response = await request.get(COZE_PATHS.agentExamine.list, {
      params: {
        page: params?.page || 1,
        page_size: params?.pageSize || 20,
        ...params,
      },
    })
    const normalizedResponse = normalizeApiResponse(response)
    // 后端返回格式：{ success, message, data: [], total, page, page_size, total_pages }
    const data = (normalizedResponse.data as unknown[]) || []
    const total =
      (normalizedResponse as { total?: number }).total || (Array.isArray(data) ? data.length : 0)
    const page = (normalizedResponse as { page?: number }).page || params?.page || 1
    const page_size =
      (normalizedResponse as { page_size?: number }).page_size || params?.pageSize || 20
    const total_pages =
      (normalizedResponse as { total_pages?: number }).total_pages || Math.ceil(total / page_size)

    return {
      ...normalizedResponse,
      data: {
        list: (Array.isArray(data) ? data : []) as AgentExamine[],
        pagination: {
          page,
          pageSize: page_size,
          total,
          totalPages: total_pages,
        },
      },
    }
  }
)

// 获取智能体审核记录详情
export const getAgentExamineDetail = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AgentExamine>> => {
    const response = await request.get<AgentExamine>(COZE_PATHS.agentExamine.byId(id))
    return normalizeApiResponse(response)
  }
)

// 更新智能体审核记录
export const updateAgentExamine = withApiResponseHandler(
  async (
    id: string,
    data: {
      agent_name?: string
      agent_avatar?: string
      prologue?: string
      category_id?: string
      status?: number
      examine_user?: string
      examine_user_id?: string
      desc?: string
      follow?: string
    }
  ): Promise<ApiResponse<AgentExamine>> => {
    const response = await request.put<AgentExamine>(COZE_PATHS.agentExamine.byId(id), data)
    return normalizeApiResponse(response)
  }
)

// 获取审核统计信息
export const getAgentExamineStats = withApiResponseHandler(
  async (): Promise<ApiResponse<AgentExamineStats>> => {
    const response = await request.get<AgentExamineStats>(COZE_PATHS.agentExamine.statsSummary)
    return normalizeApiResponse(response)
  }
)

// 审核通过
export const approveAgentExamine = withApiResponseHandler(
  async (
    id: string,
    data?: {
      desc?: string
      examine_user?: string
      examine_user_id?: string
    }
  ): Promise<ApiResponse<AgentExamine>> => {
    const response = await request.post<AgentExamine>(
      COZE_PATHS.agentExamine.approve(id),
      data || {}
    )
    return normalizeApiResponse(response)
  }
)

// 审核拒绝
export const rejectAgentExamine = withApiResponseHandler(
  async (
    id: string,
    data?: {
      desc?: string
      examine_user?: string
      examine_user_id?: string
    }
  ): Promise<ApiResponse<AgentExamine>> => {
    const response = await request.post<AgentExamine>(
      COZE_PATHS.agentExamine.reject(id),
      data || {}
    )
    return normalizeApiResponse(response)
  }
)

// 同步智能体头像
export const syncAgentAvatar = withApiResponseHandler(
  async (agent_id: string): Promise<ApiResponse<{ success: boolean; message: string }>> => {
    const response = await request.post(COZE_PATHS.agentExamine.syncAvatar(agent_id))
    return normalizeApiResponse(response)
  }
)

// 批量同步智能体头像
export const batchSyncAgentAvatar = withApiResponseHandler(
  async (
    agent_ids: string[]
  ): Promise<ApiResponse<{ success: number; failed: number; details: unknown[] }>> => {
    const response = await request.post(COZE_PATHS.agentExamine.batchSyncAvatar, {
      agent_ids,
    })
    return normalizeApiResponse(response)
  }
)
