import { WALLET_PATHS } from '@/config/backend-paths'

/**
 * 钱包相关API
 */

import request from '@/utils/request'
import type { ApiResponse, PaginationParams } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

// 钱包信息
export interface WalletInfo {
  balance: number // 余额（元）
  frozenBalance?: number // 冻结余额（元）
  totalRecharge?: number // 累计充值（元）
  totalWithdraw?: number // 累计提现（元）
  totalConsume?: number // 累计消费（元）
}

// 钱包交易记录
export interface WalletTransaction {
  id: string
  type: 'recharge' | 'withdraw' | 'consume' | 'refund' | 'reward' | 'transfer'
  amount: number // 金额（元，正数为收入，负数为支出）
  balance: number // 交易后余额（元）
  description: string // 交易描述
  orderId?: string // 关联订单ID
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  createTime: string
  updateTime?: string
}

// 获取钱包交易列表请求参数
export interface GetWalletTransactionsParams extends PaginationParams {
  type?: WalletTransaction['type']
  status?: WalletTransaction['status']
  startDate?: string
  endDate?: string
}

// 钱包交易列表响应
export interface WalletTransactionListResponse {
  list: WalletTransaction[]
  total: number
}

/**
 * 获取钱包信息
 * @returns 钱包信息
 */
export const getWalletInfo = withApiResponseHandler(
  async (): Promise<ApiResponse<WalletInfo>> => {
    const response = await request.get<WalletInfo>(WALLET_PATHS.info)
    return normalizeApiResponse(response)
  }
)

/**
 * 获取钱包交易记录
 * @param params 查询参数
 * @returns 交易记录列表
 */
export const getWalletTransactions = withApiResponseHandler(
  async (params?: GetWalletTransactionsParams): Promise<ApiResponse<WalletTransactionListResponse>> => {
    const response = await request.get<WalletTransactionListResponse>(WALLET_PATHS.transactions, {
      params,
    })
    return normalizeApiResponse(response)
  }
)

/**
 * 申请提现
 * @param amount 提现金额（元）
 * @param accountType 账户类型（alipay, wechat, bank）
 * @param accountInfo 账户信息
 * @returns 提现订单信息
 */
export const applyWithdraw = withApiResponseHandler(
  async (params: {
    amount: number
    accountType: 'alipay' | 'wechat' | 'bank'
    accountInfo: {
      account?: string // 支付宝账号/微信账号/银行卡号
      name?: string // 姓名
      bankName?: string // 银行名称（银行卡时必填）
      bankBranch?: string // 开户行（银行卡时可选）
    }
  }): Promise<ApiResponse<{ orderId: string; amount: number; status: string }>> => {
    const response = await request.post(WALLET_PATHS.withdraw, params)
    return normalizeApiResponse(response)
  }
)
