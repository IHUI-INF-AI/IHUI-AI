/**
 * 智汇值相关 API
 * 
 * @description 提供智汇值（Token）的查询、消耗记录、统计等功能
 * @packageDocumentation
 */

import { COZE_PATHS } from '@/config/backend-paths'
import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'
import { logger } from '@/utils/logger'

/**
 * 智汇值消耗类型
 */
export type TokenConsumeType = '0' | '1' | '2'
// 0 = 智能体对话消耗
// 1 = 大模型直接调用消耗
// 2 = 其他消耗（如文件处理等）

/**
 * 时间范围类型
 */
export type TimeRange = 'w' | 'm' | 'y' | 'a'
// w = 最近 7 天
// m = 最近一个月
// y = 最近一年
// a = 全部

/**
 * 智汇值消耗记录
 */
export interface TokenValueRecord {
  /** 记录 ID */
  id: string
  /** 智能体名称（如果是智能体消耗） */
  agentName: string
  /** 智能体 ID */
  agentId?: string
  /** 创建时间 */
  create_at: string
  /** 消耗的 Token 数量 */
  token: number
  /** 消耗类型 */
  type: TokenConsumeType
  /** 消耗描述 */
  description?: string
  /** 会话 ID */
  conversationId?: string
  /** 模型名称 */
  modelName?: string
}

/**
 * 智汇值消耗记录列表响应
 */
export interface TokenValueRecordsResponse {
  list: TokenValueRecord[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}

/**
 * 智汇值余额信息
 */
export interface TokenBalance {
  /** 当前余额 */
  balance: number
  /** 冻结余额 */
  frozenBalance?: number
  /** 本月消耗 */
  monthlyConsumption?: number
  /** 本月赠送 */
  monthlyBonus?: number
  /** 累计消耗 */
  totalConsumption?: number
  /** 累计充值 */
  totalRecharge?: number
}

/**
 * 智汇值统计信息
 */
export interface TokenStatistics {
  /** 今日消耗 */
  todayConsumption: number
  /** 本周消耗 */
  weeklyConsumption: number
  /** 本月消耗 */
  monthlyConsumption: number
  /** 按类型统计 */
  byType: {
    agent: number
    model: number
    other: number
  }
  /** 按日期统计（最近 7 天） */
  dailyTrend: {
    date: string
    consumption: number
  }[]
}

/**
 * 充值套餐
 */
export interface TokenPackage {
  /** 套餐 ID */
  id: string
  /** 套餐名称 */
  name: string
  /** Token 数量 */
  tokenAmount: number
  /** 价格（分） */
  price: number
  /** 原价（分） */
  originalPrice?: number
  /** 赠送 Token 数量 */
  bonusAmount?: number
  /** 是否推荐 */
  recommended?: boolean
  /** 折扣说明 */
  discountLabel?: string
}

/**
 * 获取智汇值消耗记录
 * 
 * @param params 查询参数
 * @returns 消耗记录列表
 */
export const getTokenValueRecords = withApiResponseHandler(
  async (params?: {
    type?: TokenConsumeType
    timeRange?: TimeRange
    page?: number
    page_size?: number
    startDate?: string
    endDate?: string
    agentId?: string
  }): Promise<ApiResponse<TokenValueRecordsResponse>> => {
    try {
      const response = await request.get<TokenValueRecordsResponse>(
        COZE_PATHS.tokenValue.records,
        {
          params: {
            type: params?.type,
            time_range: params?.timeRange,
            page: params?.page,
            page_size: params?.page_size,
            start_date: params?.startDate,
            end_date: params?.endDate,
            agent_id: params?.agentId,
          },
        }
      )
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[TokenValue] Failed to get consumption records:', error)
      throw error
    }
  }
)

/**
 * 获取智汇值余额
 * 
 * @returns 余额信息
 */
export const getTokenBalance = withApiResponseHandler(
  async (): Promise<ApiResponse<TokenBalance>> => {
    try {
      const response = await request.get<TokenBalance>(
        COZE_PATHS.tokenValue.balance
      )
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[TokenValue] Failed to get balance:', error)
      throw error
    }
  }
)

/**
 * 获取智汇值统计信息
 * 
 * @param timeRange 时间范围
 * @returns 统计信息
 */
export const getTokenStatistics = withApiResponseHandler(
  async (timeRange?: TimeRange): Promise<ApiResponse<TokenStatistics>> => {
    try {
      const response = await request.get<TokenStatistics>(
        COZE_PATHS.tokenValue.statistics,
        { params: { time_range: timeRange } }
      )
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[TokenValue] Failed to get statistics:', error)
      throw error
    }
  }
)

/**
 * 获取充值套餐列表
 * 
 * @returns 充值套餐列表
 */
export const getTokenPackages = withApiResponseHandler(
  async (): Promise<ApiResponse<TokenPackage[]>> => {
    try {
      const response = await request.get<TokenPackage[]>(
        COZE_PATHS.tokenValue.packages
      )
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[TokenValue] Failed to get recharge plans:', error)
      throw error
    }
  }
)

/**
 * 购买智汇值套餐
 * 
 * @param packageId 套餐 ID
 * @param paymentMethod 支付方式
 * @returns 支付信息
 */
export const purchaseTokenPackage = withApiResponseHandler(
  async (
    packageId: string,
    paymentMethod: 'wechat' | 'alipay' | 'balance'
  ): Promise<ApiResponse<{
    orderId: string
    paymentUrl?: string
    qrCode?: string
  }>> => {
    try {
      const response = await request.post<{
        orderId: string
        paymentUrl?: string
        qrCode?: string
      }>(
        COZE_PATHS.tokenValue.purchase,
        { packageId, paymentMethod }
      )
      
      const normalized = normalizeApiResponse<{
        orderId: string
        paymentUrl?: string
        qrCode?: string
      }>(response)
      
      if (normalized.success && normalized.data) {
        logger.info('[TokenValue] Successfully created recharge order', {
          orderId: normalized.data.orderId,
        })
      }
      
      return normalized
    } catch (error) {
      logger.error('[TokenValue] Failed to create recharge order:', error)
      throw error
    }
  }
)

/**
 * 查询充值订单状态
 * 
 * @param orderId 订单 ID
 * @returns 订单状态
 */
export const checkPurchaseStatus = withApiResponseHandler(
  async (orderId: string): Promise<ApiResponse<{
    status: 'pending' | 'paid' | 'failed' | 'expired'
    tokenAmount?: number
    paidAt?: string
  }>> => {
    try {
      const response = await request.get<{
        status: 'pending' | 'paid' | 'failed' | 'expired'
        tokenAmount?: number
        paidAt?: string
      }>(
        COZE_PATHS.tokenValue.orderStatus,
        { params: { order_id: orderId } }
      )
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[TokenValue] Failed to query order status:', error)
      throw error
    }
  }
)

/**
 * 使用兑换码充值
 * 
 * @param code 兑换码
 * @returns 充值结果
 */
export const redeemTokenCode = withApiResponseHandler(
  async (code: string): Promise<ApiResponse<{
    success: boolean
    tokenAmount?: number
    message?: string
  }>> => {
    try {
      const response = await request.post<{
        success: boolean
        tokenAmount?: number
        message?: string
      }>(
        COZE_PATHS.tokenValue.redeem,
        { code }
      )
      
      const normalized = normalizeApiResponse<{
        success: boolean
        tokenAmount?: number
        message?: string
      }>(response)
      
      if (normalized.success && normalized.data?.success) {
        logger.info('[TokenValue] Redeem code recharge successful', {
          tokenAmount: normalized.data.tokenAmount,
        })
      }
      
      return normalized
    } catch (error) {
      logger.error('[TokenValue] Failed to redeem code:', error)
      throw error
    }
  }
)
