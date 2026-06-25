import { API_ORDERS_PATHS } from '@/config/backend-paths'
import { t } from '@/utils/i18n'

/**
 * 发票管理API
 */

import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { normalizeApiResponse } from '@/utils/apiResponseFormatter'
import { logger } from '@/utils/logger'

/**
 * 下载订单发票
 * @param orderId 订单ID
 * @returns PDF Blob
 */
export async function downloadInvoice(orderId: string): Promise<Blob> {
  try {
    const response = await request.get(API_ORDERS_PATHS.invoice(orderId), {
      responseType: 'blob',
    })

    if (!(response.data instanceof Blob)) {
      throw new Error(t('error.invoice.响应不是有效的文'))
    }

    return response.data
  } catch (error) {
    logger.error('[Invoice] Invoice download failed:', error)
    throw error
  }
}

/**
 * 生成订单发票
 * @param orderId 订单ID
 * @param invoiceData 发票信息
 * @returns 发票信息
 */
export async function generateInvoice(
  orderId: string,
  invoiceData: {
    type: 'personal' | 'company'
    title?: string
    taxNumber?: string
    address?: string
    phone?: string
    email?: string
  }
): Promise<ApiResponse<{ invoiceId: string; downloadUrl: string }>> {
  try {
    const response = await request.post(API_ORDERS_PATHS.invoice(orderId), invoiceData)
    return normalizeApiResponse(response.data)
  } catch (error) {
    logger.error('[Invoice] Invoice generation failed:', error)
    throw error
  }
}
