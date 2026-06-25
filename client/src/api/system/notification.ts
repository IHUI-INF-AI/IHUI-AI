import { NOTIFICATION_PATHS } from '@/config/backend-paths'
import { t } from '@/utils/i18n'

/**
 * 通知API
 * 对应后端路由：/api/notification
 */

import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'
import { logger } from '@/utils/logger'

/**
 * 通知类型
 */
export type NotificationType = 'email' | 'sms' | 'push' | 'system'

/**
 * 通知优先级
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

/**
 * 发送通知请求
 */
export interface SendNotificationRequest {
  type: NotificationType
  recipient: string // 接收者（邮箱、手机号、用户ID等）
  subject?: string // 主题（邮件）
  content: string // 内容
  template?: string // 模板ID
  templateData?: Record<string, unknown> // 模板数据
  priority?: NotificationPriority
  scheduledAt?: string // 计划发送时间（ISO格式）
}

/**
 * 发送通知响应
 */
export interface SendNotificationResponse {
  id: string
  type: NotificationType
  recipient: string
  status: 'pending' | 'sent' | 'failed'
  sentAt?: string
  error?: string
}

/**
 * 发送通知
 */
export const sendNotification = withApiResponseHandler(
  async (data: SendNotificationRequest): Promise<ApiResponse<SendNotificationResponse>> => {
    try {
      const response = await request.post<SendNotificationResponse>(NOTIFICATION_PATHS.send, data)
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('Failed to send notification:', error)
      // Dev mode fallback
      if (import.meta.env.DEV) {
        logger.warn('Dev mode: using mock data')
        return {
          code: 200,
          success: true,
          message: t('api.notification.通知发送成功模拟'),
          data: {
            id: `mock_${Date.now()}`,
            type: data.type,
            recipient: data.recipient,
            status: 'sent',
            sentAt: new Date().toISOString(),
          },
          timestamp: Date.now(),
        }
      }
      throw error
    }
  }
)

/**
 * 发送预约成功通知
 */
export const sendAppointmentCreatedNotification = async (
  email: string,
  appointmentData: {
    serviceType: string
    serviceTypeName: string
    preferredDate?: string
    preferredTime?: string
  }
): Promise<void> => {
  try {
    const content = `
您已成功提交服务预约申请！

服务类型：${appointmentData.serviceTypeName}
${appointmentData.preferredDate ? `偏好日期：${appointmentData.preferredDate}` : ''}
${appointmentData.preferredTime ? `偏好时间：${appointmentData.preferredTime}` : ''}

我们会在1-2个工作日内与您联系，确认预约详情。

感谢您的信任！
    `.trim()

    await sendNotification({
      type: 'email',
      recipient: email,
      subject: '服务预约提交成功',
      content,
      priority: 'normal',
    })
  } catch (error) {
    logger.error('Failed to send appointment created notification:', error)
    // 不抛出错误，避免影响主流程
  }
}

/**
 * 发送预约确认通知
 */
export const sendAppointmentConfirmedNotification = async (
  email: string,
  appointmentData: {
    serviceType: string
    serviceTypeName: string
    preferredDate?: string
    preferredTime?: string
    adminNotes?: string
  }
): Promise<void> => {
  try {
    const content = `
您的服务预约已确认！

服务类型：${appointmentData.serviceTypeName}
${appointmentData.preferredDate ? `预约日期：${appointmentData.preferredDate}` : ''}
${appointmentData.preferredTime ? `预约时间：${appointmentData.preferredTime}` : ''}
${appointmentData.adminNotes ? `备注：${appointmentData.adminNotes}` : ''}

请按时参加，如有疑问请联系我们。

感谢您的配合！
    `.trim()

    await sendNotification({
      type: 'email',
      recipient: email,
      subject: '服务预约已确认',
      content,
      priority: 'high',
    })
  } catch (error) {
    logger.error('Failed to send appointment confirmed notification:', error)
    // 不抛出错误，避免影响主流程
  }
}

/**
 * 发送预约完成通知
 */
export const sendAppointmentCompletedNotification = async (
  email: string,
  appointmentData: {
    serviceType: string
    serviceTypeName: string
    adminNotes?: string
  }
): Promise<void> => {
  try {
    const content = `
您的服务预约已完成！

服务类型：${appointmentData.serviceTypeName}
${appointmentData.adminNotes ? `备注：${appointmentData.adminNotes}` : ''}

感谢您使用我们的服务！如有任何问题或建议，欢迎随时联系我们。

期待再次为您服务！
    `.trim()

    await sendNotification({
      type: 'email',
      recipient: email,
      subject: '服务预约已完成',
      content,
      priority: 'normal',
    })
  } catch (error) {
    logger.error('Failed to send appointment completed notification:', error)
    // 不抛出错误，避免影响主流程
  }
}

/**
 * 发送预约取消通知
 */
export const sendAppointmentCancelledNotification = async (
  email: string,
  appointmentData: {
    serviceType: string
    serviceTypeName: string
    reason?: string
  }
): Promise<void> => {
  try {
    const content = `
您的服务预约已取消。

服务类型：${appointmentData.serviceTypeName}
${appointmentData.reason ? `取消原因：${appointmentData.reason}` : ''}

如有需要，您可以重新提交预约申请。

感谢您的理解！
    `.trim()

    await sendNotification({
      type: 'email',
      recipient: email,
      subject: '服务预约已取消',
      content,
      priority: 'normal',
    })
  } catch (error) {
    logger.error('Failed to send appointment cancelled notification:', error)
    // 不抛出错误，避免影响主流程
  }
}
