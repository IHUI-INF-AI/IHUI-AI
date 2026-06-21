import { COZE_PATHS } from '@/config/backend-paths'
import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'
import { logger } from '@/utils/logger'

/**
 * 退款相关 API
 * 对应后端路由：/cozeZhsApi/payment/refund
 */

// 退款申请请求
export interface RefundRequest {
  orderNo: string // 订单号
  reason: string // 退款原因
  amount?: number // 退款金额（可选，不填则全额退款）
  description?: string // 退款说明
}

// 退款记录（字段名与 Coze 后端一致，使用 snake_case）
export interface RefundRecord {
  id: string
  order_no: string // 原订单号
  refund_no: string // 退款单号
  amount: number
  reason: string
  description?: string
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'completed' | 'failed'
  status_text?: string
  reject_reason?: string
  approved_at?: string
  completed_at?: string
  create_time: string
  updated_at: string
  order_info?: {
    product_name?: string
    total_amount?: number
    payment_method?: string
  }
}

// 退款申请响应
export interface RefundResponse {
  refundNo: string
  orderNo: string
  amount: number
  status: RefundRecord['status']
  message?: string
}

/**
 * 申请退款
 */
export const applyRefund = withApiResponseHandler(
  async (data: RefundRequest): Promise<ApiResponse<RefundResponse>> => {
    try {
      logger.info('Apply for refund:', data)
      const response = await request.post<RefundResponse>(COZE_PATHS.payment.refund.apply, {
        order_no: data.orderNo,
        reason: data.reason,
        amount: data.amount,
        description: data.description,
      })
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('Failed to apply for refund:', error)
      throw error
    }
  }
)

/**
 * 获取退款记录列表
 */
export const getRefundList = withApiResponseHandler(
  async (
    params?: PaginationParams & {
      orderNo?: string
      refundNo?: string
      status?: RefundRecord['status']
      startDate?: string
      endDate?: string
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
    }
  ): Promise<ApiResponse<PaginationResponse<RefundRecord>>> => {
    try {
      const response = await request.get<{
        list: RefundRecord[]
        total: number
        page: number
        page_size: number
      }>(COZE_PATHS.payment.refund.list, {
        params: {
          page: params?.page || 1,
          page_size: params?.pageSize || 20,
          order_no: params?.orderNo,
          refund_no: params?.refundNo,
          status: params?.status,
          start_date: params?.startDate,
          end_date: params?.endDate,
          sort_by: params?.sortBy,
          sort_order: params?.sortOrder,
        },
      })

      const normalizedResponse = normalizeApiResponse(response)
      const responseData = normalizedResponse.data as { list?: RefundRecord[]; total?: number; page?: number; page_size?: number } || {}
      const data = responseData?.list || []
      const total = responseData?.total || data.length
      const page = responseData?.page || params?.page || 1
      const page_size = responseData?.page_size || params?.pageSize || 20

      return {
        ...normalizedResponse,
        data: {
          list: (Array.isArray(data) ? data : []) as RefundRecord[],
          pagination: {
            page,
            pageSize: page_size,
            total,
            totalPages: Math.ceil(total / page_size),
          },
        },
      }
    } catch (error) {
      logger.error('Failed to get refund list:', error)
      throw error
    }
  }
)

/**
 * 获取退款记录详情
 */
export const getRefundDetail = withApiResponseHandler(
  async (refundNo: string): Promise<ApiResponse<RefundRecord>> => {
    try {
      const response = await request.get<RefundRecord>(COZE_PATHS.payment.refund.byRefundNo(refundNo))
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('Failed to get refund detail:', error)
      throw error
    }
  }
)

/**
 * 取消退款申请（仅限待审核状态）
 */
export const cancelRefund = withApiResponseHandler(
  async (refundNo: string): Promise<ApiResponse<{ refundNo: string; status: string }>> => {
    try {
      const response = await request.post<{ refundNo: string; status: string }>(
        COZE_PATHS.payment.refund.cancel(refundNo)
      )
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('Failed to cancel refund:', error)
      throw error
    }
  }
)

/**
 * 查询退款状态
 */
export const checkRefundStatus = withApiResponseHandler(
  async (refundNo: string): Promise<ApiResponse<RefundRecord>> => {
    try {
      const response = await request.get<RefundRecord>(COZE_PATHS.payment.refund.status(refundNo))
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('Failed to check refund status:', error)
      throw error
    }
  }
)

// 退款审核请求
export interface RefundAuditRequest {
  refundNo: string
  action: 'approve' | 'reject'
  comment?: string // 审核意见
}

// 退款审核响应
export interface RefundAuditResponse {
  refundNo: string
  status: RefundRecord['status']
  message?: string
}

/**
 * 审核退款申请（管理员）
 */
export const auditRefund = withApiResponseHandler(
  async (data: RefundAuditRequest): Promise<ApiResponse<RefundAuditResponse>> => {
    try {
      logger.info('Audit refund application:', data)
      const response = await request.post<RefundAuditResponse>(
        COZE_PATHS.payment.refund.audit(data.refundNo),
        {
          action: data.action,
          comment: data.comment,
        }
      )
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('Failed to audit refund:', error)
      throw error
    }
  }
)

/**
 * 处理退款（管理员，审核通过后执行退款）
 */
export const processRefund = withApiResponseHandler(
  async (refundNo: string): Promise<ApiResponse<RefundRecord>> => {
    try {
      logger.info('Process refund:', refundNo)
      const response = await request.post<RefundRecord>(
        COZE_PATHS.payment.refund.process(refundNo)
      )
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('Failed to process refund:', error)
      throw error
    }
  }
)

// 导出默认对象
export default {
  applyRefund,
  getRefundList,
  getRefundDetail,
  cancelRefund,
  checkRefundStatus,
  auditRefund,
  processRefund,
}
