/**
 * 日程管理API
 * 对接后端 /api/v1/schedule，创建/更新通过 query 参数传参
 */

import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

// 日程类型
export type ScheduleType = 'personal' | 'work' | 'course' | 'meeting'

// 日程状态: 0=取消 1=正常 2=完成
export type ScheduleStatus = 0 | 1 | 2

// 日程项
export interface ScheduleItem {
  id: number
  title: string
  description?: string | null
  start_time: string | null
  end_time?: string | null
  all_day: boolean
  type: ScheduleType
  color?: string | null
  remind_before: number
  location?: string | null
  ref_id?: string | null
  ref_type?: string | null
  status: ScheduleStatus
}

// 列表查询参数
export interface GetScheduleListParams {
  page?: number
  limit?: number
  type?: ScheduleType
  start_date?: string
  end_date?: string
}

// 列表响应
export interface ScheduleListResponse {
  list: ScheduleItem[]
  total: number
}

// 创建日程参数
export interface CreateScheduleParams {
  title: string
  description?: string
  start_time: string
  end_time?: string
  all_day?: boolean
  type?: ScheduleType
  color?: string
  remind_before?: number
  location?: string
  ref_id?: string
  ref_type?: string
}

// 更新日程参数
export interface UpdateScheduleParams {
  title?: string
  description?: string
  start_time?: string
  end_time?: string
  status?: ScheduleStatus
  color?: string
}

// 创建日程响应
export interface CreateScheduleResult {
  id: number
}

const BASE = '/api/v1/schedule'

/**
 * 获取日程列表
 * 后端返回 { code, msg, data: [...], total }，total 在顶层，需手动解析
 */
export const getScheduleList = withApiResponseHandler(
  async (params?: GetScheduleListParams): Promise<ApiResponse<ScheduleListResponse>> => {
    const response = await request.get(`${BASE}/list`, {
      params: {
        page: params?.page || 1,
        limit: params?.limit || 20,
        type: params?.type,
        start_date: params?.start_date,
        end_date: params?.end_date,
      },
    })
    const raw = (response?.data || {}) as {
      code?: number | string
      msg?: string
      data?: ScheduleItem[]
      total?: number
    }
    const items = Array.isArray(raw.data) ? raw.data : []
    const total = typeof raw.total === 'number' ? raw.total : items.length
    const codeNum = typeof raw.code === 'string' ? parseInt(raw.code, 10) : (raw.code ?? 200)
    return {
      code: codeNum,
      message: raw.msg || 'success',
      data: { list: items, total },
      success: codeNum === 0 || codeNum === 200,
      timestamp: Date.now(),
    }
  }
)

/**
 * 创建日程（参数通过 query 传递）
 */
export const createSchedule = withApiResponseHandler(
  async (data: CreateScheduleParams): Promise<ApiResponse<CreateScheduleResult>> => {
    const response = await request.post<CreateScheduleResult>(BASE, null, { params: data })
    return normalizeApiResponse(response)
  }
)

/**
 * 更新日程（参数通过 query 传递）
 */
export const updateSchedule = withApiResponseHandler(
  async (sid: number, data: UpdateScheduleParams): Promise<ApiResponse<null>> => {
    const response = await request.put<null>(`${BASE}/${sid}`, null, { params: data })
    return normalizeApiResponse(response)
  }
)

/**
 * 删除日程
 */
export const deleteSchedule = withApiResponseHandler(
  async (sid: number): Promise<ApiResponse<null>> => {
    const response = await request.delete<null>(`${BASE}/${sid}`)
    return normalizeApiResponse(response)
  }
)

/**
 * 日程管理 API
 */
export const scheduleApi = {
  list: getScheduleList,
  create: createSchedule,
  update: updateSchedule,
  remove: deleteSchedule,
}
