import request from '@/utils/request'
import type { ApiResponse, PaginationParams } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

// 反馈类型
export type FeedbackType = 'feature' | 'bug' | 'experience' | 'other'

// 反馈状态
export type FeedbackStatus = 'pending' | 'processing' | 'resolved' | 'closed'

// 反馈信息
export interface Feedback {
  id: string
  userId?: string
  type: FeedbackType
  content: string
  contact?: string
  images?: string[]
  status: FeedbackStatus
  createTime: string
  updateTime?: string
  reply?: string
  replyTime?: string
}

// 提交反馈请求参数
export interface SubmitFeedbackParams {
  type: FeedbackType
  content: string
  contact?: string
  images?: string[]
}

// 获取反馈列表请求参数
export interface GetFeedbacksParams extends PaginationParams {
  type?: FeedbackType
  status?: FeedbackStatus
}

// 反馈列表响应
export interface FeedbackListResponse {
  list: Feedback[]
  total: number
}

/**
 * 提交反馈
 * @param data 反馈数据
 * @returns 反馈信息
 */
export const submitFeedback = withApiResponseHandler(
  async (data: SubmitFeedbackParams): Promise<ApiResponse<Feedback>> => {
    const response = await request.post<Feedback>('/feedback/submit', data)
    return normalizeApiResponse(response)
  }
)

/**
 * 获取反馈列表
 * @param params 查询参数
 * @returns 反馈列表
 */
export const getFeedbacks = withApiResponseHandler(
  async (params?: GetFeedbacksParams): Promise<ApiResponse<FeedbackListResponse>> => {
    const response = await request.get<FeedbackListResponse>('/feedback/list', {
      params,
    })
    return normalizeApiResponse(response)
  }
)

/**
 * 获取反馈详情
 * @param feedbackId 反馈ID
 * @returns 反馈详情
 */
export const getFeedbackDetail = withApiResponseHandler(
  async (feedbackId: string): Promise<ApiResponse<Feedback>> => {
    const response = await request.get<Feedback>(`/feedback/${feedbackId}`)
    return normalizeApiResponse(response)
  }
)

/**
 * 回复反馈
 * @param feedbackId 反馈ID
 * @param reply 回复内容
 * @returns 反馈信息
 */
export const replyFeedback = withApiResponseHandler(
  async (feedbackId: string, reply: string): Promise<ApiResponse<Feedback>> => {
    const response = await request.post<Feedback>(`/feedback/${feedbackId}/reply`, { reply })
    return normalizeApiResponse(response)
  }
)

/**
 * 更新反馈状态
 * @param feedbackId 反馈ID
 * @param status 新状态
 * @returns 反馈信息
 */
export const updateFeedbackStatus = withApiResponseHandler(
  async (feedbackId: string, status: FeedbackStatus): Promise<ApiResponse<Feedback>> => {
    const response = await request.put<Feedback>(`/feedback/${feedbackId}/status`, { status })
    return normalizeApiResponse(response)
  }
)
