import { SERVICE_APPOINTMENT_PATHS } from '../config/backend-paths'
import { t } from '@/utils/i18n'

/**
 * 服务预约API
 * 对应后端路由：/api/service-appointment
 */

import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'
import { logger } from '@/utils/logger'

/**
 * 服务预约接口
 */
export interface ServiceAppointment {
  id: string
  user_uuid: string
  service_type: string // 服务类型：consultation, training, custom
  name: string
  email: string
  phone: string
  preferred_date?: string // 偏好日期 YYYY-MM-DD
  preferred_time?: string // 偏好时间 HH:mm
  description?: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' // 预约状态
  created_at: string
  updated_at: string
  confirmed_at?: string
  completed_at?: string
  cancelled_at?: string
  admin_notes?: string // 管理员备注
}

/**
 * 创建服务预约请求
 */
export interface CreateAppointmentRequest {
  service_type: string
  name: string
  email: string
  phone: string
  preferred_date?: string
  preferred_time?: string
  description?: string
}

/**
 * 获取预约列表参数
 */
export interface GetAppointmentsParams extends PaginationParams {
  service_type?: string
  status?: ServiceAppointment['status']
  start_date?: string
  end_date?: string
}

/**
 * 预约列表响应
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AppointmentListResponse extends PaginationResponse<ServiceAppointment> {}

/**
 * 创建服务预约
 */
export const createAppointment = withApiResponseHandler(
  async (data: CreateAppointmentRequest): Promise<ApiResponse<ServiceAppointment>> => {
    try {
      const response = await request.post<ServiceAppointment>(SERVICE_APPOINTMENT_PATHS.base, data)
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[ServiceAppointment] Failed to create service appointment:', error)
      // 开发环境降级处理
      if (import.meta.env.DEV) {
        logger.warn('[ServiceAppointment] Dev environment: Using mock data')
        return {
          code: 200,
          success: true,
          message: t('api.service_appointment.预约提交成功模拟'),
          data: {
            id: `mock_${Date.now()}`,
            user_uuid: '',
            service_type: data.service_type,
            name: data.name,
            email: data.email,
            phone: data.phone,
            preferred_date: data.preferred_date,
            preferred_time: data.preferred_time,
            description: data.description,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          timestamp: Date.now(),
        }
      }
      throw error
    }
  }
)

/**
 * 获取预约列表
 */
export const getAppointments = withApiResponseHandler(
  async (params?: GetAppointmentsParams): Promise<ApiResponse<AppointmentListResponse>> => {
    try {
      const response = await request.get<AppointmentListResponse>(SERVICE_APPOINTMENT_PATHS.base, {
        params,
      })
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[ServiceAppointment] Failed to get appointment list:', error)
      // 开发环境降级处理
      if (import.meta.env.DEV) {
        logger.warn('[ServiceAppointment] Dev environment: Using mock data')
        return {
          code: 200,
          success: true,
          message: t('api.service_appointment.获取成功模拟1'),
          data: {
            items: [],
            pagination: {
              total: 0,
              page: params?.page || 1,
              pageSize: params?.pageSize || 10,
              totalPages: 0,
            },
          },
          timestamp: Date.now(),
        }
      }
      throw error
    }
  }
)

/**
 * 获取预约详情
 */
export const getAppointment = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<ServiceAppointment>> => {
    try {
      const response = await request.get<ServiceAppointment>(SERVICE_APPOINTMENT_PATHS.byId(id))
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[ServiceAppointment] Failed to get appointment details:', error)
      throw error
    }
  }
)

/**
 * 取消预约
 */
export const cancelAppointment = withApiResponseHandler(
  async (id: string, reason?: string): Promise<ApiResponse<ServiceAppointment>> => {
    try {
      const response = await request.post<ServiceAppointment>(
        SERVICE_APPOINTMENT_PATHS.cancel(id),
        { reason }
      )
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[ServiceAppointment] Failed to cancel appointment:', error)
      throw error
    }
  }
)

/**
 * 确认预约（管理员操作）
 */
export const confirmAppointment = withApiResponseHandler(
  async (id: string, adminNotes?: string): Promise<ApiResponse<ServiceAppointment>> => {
    try {
      const response = await request.post<ServiceAppointment>(
        SERVICE_APPOINTMENT_PATHS.confirm(id),
        { admin_notes: adminNotes }
      )
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[ServiceAppointment] Failed to confirm appointment:', error)
      throw error
    }
  }
)

/**
 * 完成预约（管理员操作）
 */
export const completeAppointment = withApiResponseHandler(
  async (id: string, adminNotes?: string): Promise<ApiResponse<ServiceAppointment>> => {
    try {
      const response = await request.post<ServiceAppointment>(
        SERVICE_APPOINTMENT_PATHS.complete(id),
        { admin_notes: adminNotes }
      )
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[ServiceAppointment] Failed to complete appointment:', error)
      throw error
    }
  }
)
