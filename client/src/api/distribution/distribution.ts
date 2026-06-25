import { AUTH_PATHS, DISTRIBUTION_PATHS } from '@/config/backend-paths'

/**
 * 分销系统API
 * 对应后端路由：/cozeZhsApi/distribution
 */

import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

// 邀请码信息
export interface InviteCodeInfo {
  invite_code: string
}

// 下级用户信息
export interface SubordinateUser {
  uuid: string
  id?: string // 兼容字段，用于某些UI组件（等同于uuid）
  username: string
  nickname: string
  avatar: string
  created_at: string
  createdAt?: string // 兼容字段，等同于created_at
  sub_count: number // 下级的下级数量
  total_commission: number // 佣金总额
  total_amount?: number // 交易总额
  order_count?: number // 订单数量
  openid?: string // 用户openid（用于联系功能）
}

// 下级列表响应
export interface SubordinatesResponse {
  list: SubordinateUser[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}

// 分销统计信息
export interface DistributionStats {
  direct_downlines: number // 直接下级数量
  total_commission: number // 总佣金（已结算）
  pending_commission: number // 待结算佣金
  month_commission: number // 本月佣金
  // 兼容字段（用于前端显示）
  totalEarnings?: number // 总收益（对应total_commission）
  totalInvites?: number // 总邀请数（对应direct_downlines）
  monthlyEarnings?: number // 月收益（对应month_commission）
  pendingWithdraw?: number // 待提现（对应pending_commission）
}

// 佣金流水
export interface CommissionFlow {
  id: string
  user_uuid: string // 下单用户UUID
  belonger_uuid: string // 佣金归属用户UUID
  order_id: string
  order_type: number
  commission_type: number // 0=Token, 1=金额
  token_amount?: string
  amount?: number
  status: number // 0=待结算, 1=已结算
  time: number // 时间戳
  created_at: string
}

// 佣金流水列表响应
export interface CommissionFlowsResponse {
  flows: CommissionFlow[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
  // 兼容字段（用于前端显示）
  list?: CommissionFlow[] // 列表数据（对应flows）
}

// 获取用户邀请码
export const getInviteCode = withApiResponseHandler(
  async (): Promise<ApiResponse<InviteCodeInfo>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: { invite_code: 'MOCK-CODE-1234' },
        timestamp: Date.now(),
      }
    }
    const response = await request.get<InviteCodeInfo>(DISTRIBUTION_PATHS.inviteCode)
    return normalizeApiResponse(response)
  }
)

// 使用邀请码注册
export const useInviteCode = withApiResponseHandler(
  async (invite_code: string): Promise<ApiResponse<null>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: null,
        timestamp: Date.now(),
      }
    }
    const response = await request.post<null>(DISTRIBUTION_PATHS.useInviteCode, {
      invite_code,
    })
    return normalizeApiResponse(response)
  }
)

// 获取下级用户列表（参考移动端：/distribution/getSubordinates，POST方法）
export const getSubordinates = withApiResponseHandler(
  async (params?: {
    open_id?: string
    page?: number
    quantity?: number
  }): Promise<ApiResponse<SubordinatesResponse>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      const page = params?.page || 1
      const pageSize = params?.quantity || 10
      const list: SubordinateUser[] = Array.from({ length: pageSize }).map((_, i) => ({
        uuid: `user-${page}-${i + 1}`,
        username: `user${i + 1}`,
        nickname: `用户${i + 1}`,
        avatar: '/images/common/userIcon.svg',
        created_at: new Date(Date.now() - i * 86400000).toISOString(),
        sub_count: Math.floor(Math.random() * 5),
        total_commission: Number((Math.random() * 500).toFixed(2)),
      }))
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: {
          list,
          pagination: { page, page_size: pageSize, total: 100, total_pages: 10 },
        },
        timestamp: Date.now(),
      }
    }
    // 移动端使用POST方法，参数为open_id, page, quantity
    const response = await request.post<SubordinatesResponse>(
      DISTRIBUTION_PATHS.getSubordinates,
      {
        open_id: params?.open_id,
        page: params?.page,
        quantity: params?.quantity,
      }
    )
    return normalizeApiResponse(response)
  }
)

// 获取分销统计信息
export const getDistributionStatistics = withApiResponseHandler(
  async (): Promise<ApiResponse<DistributionStats>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      const data: DistributionStats = {
        direct_downlines: 42,
        total_commission: 12345.67,
        pending_commission: 890.12,
        month_commission: 456.78,
        totalEarnings: 12345.67,
        totalInvites: 42,
        monthlyEarnings: 456.78,
        pendingWithdraw: 890.12,
      }
      return { code: 200, success: true, message: 'mock', data, timestamp: Date.now() }
    }
    const response = await request.get<DistributionStats>(DISTRIBUTION_PATHS.stats)
    return normalizeApiResponse(response)
  }
)

// 获取佣金流水列表
export const getCommissionFlow = withApiResponseHandler(
  async (params?: {
    page?: number
    page_size?: number
    status?: number // 0=待结算, 1=已结算
  }): Promise<ApiResponse<CommissionFlowsResponse>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      const page = params?.page || 1
      const pageSize = params?.page_size || 10
      const flows: CommissionFlow[] = Array.from({ length: pageSize }).map((_, i) => ({
        id: `flow-${page}-${i + 1}`,
        user_uuid: `user-${i + 1}`,
        belonger_uuid: `owner-${i + 1}`,
        order_id: `order-${i + 1}`,
        order_type: i % 2,
        commission_type: i % 2,
        token_amount: i % 2 === 0 ? String(100 + i) : undefined,
        amount: i % 2 !== 0 ? Number((10 + i).toFixed(2)) : undefined,
        status: i % 2,
        time: Date.now() - i * 3600000,
        created_at: new Date(Date.now() - i * 3600000).toISOString(),
      }))
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: {
          flows,
          pagination: { page, page_size: pageSize, total: 100, total_pages: 10 },
          list: flows,
        },
        timestamp: Date.now(),
      }
    }
    const response = await request.get<CommissionFlowsResponse>(
      DISTRIBUTION_PATHS.commissionFlows,
      { params }
    )
    return normalizeApiResponse(response)
  }
)

// 操盘手数据卡片数据接口
export interface OperatorDataCardData {
  totalIncome: number // 公司总业绩
  currentAmount: number // 公司收入（可提现金额）
  dayStatistics?: {
    amount: number // 收益
    incomplete: number // 待结算
    finish: number // 已结算
    order: number // 公司业绩
    strength: number // 新增人数
    endAmount: number // 业绩
  }
  monthStatistics?: {
    amount: number
    incomplete: number
    finish: number
    order: number
    strength: number
    endAmount: number
  }
  sumStatistics?: {
    amount: number
    incomplete: number
    finish: number
    order: number
    strength: number
    endAmount: number
  }
  user?: {
    nickname: string
    avatar: string
    thirdPartyAccounts?: {
      nickname: string
      openId?: string
    }
  }
}

// 获取操盘手数据卡片数据
export const getOperatorDataCardData = withApiResponseHandler(
  async (uuid?: string): Promise<ApiResponse<OperatorDataCardData>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: {
          totalIncome: 123456.78,
          currentAmount: 5678.9,
          dayStatistics: {
            amount: 123.45,
            incomplete: 56.78,
            finish: 66.67,
            order: 10,
            strength: 5,
            endAmount: 1234.56,
          },
          monthStatistics: {
            amount: 3456.78,
            incomplete: 234.56,
            finish: 3222.22,
            order: 50,
            strength: 25,
            endAmount: 34567.89,
          },
          sumStatistics: {
            amount: 123456.78,
            incomplete: 5678.9,
            finish: 117777.88,
            order: 500,
            strength: 250,
            endAmount: 1234567.89,
          },
          user: {
            nickname: '测试用户',
            avatar: '/images/common/userIcon.svg',
            thirdPartyAccounts: {
              nickname: '测试用户',
            },
          },
        },
        timestamp: Date.now(),
      }
    }
    const response = await request.get<OperatorDataCardData>(DISTRIBUTION_PATHS.flowStatistics, {
      params: uuid ? { uuid } : {},
    })
    return normalizeApiResponse(response)
  }
)

// 获取微信二维码（返回base64图片）
export const getWxCode = withApiResponseHandler(
  async (inviteCode: string, type?: number): Promise<ApiResponse<string>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      // 返回模拟的base64图片
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        timestamp: Date.now(),
      }
    }
    // 注意：这个接口返回的是arraybuffer，需要特殊处理
    const response = await request.get(DISTRIBUTION_PATHS.getWxCode, {
      params: { invite_code: inviteCode, back: type || '' },
      responseType: 'arraybuffer',
    })
    // 将arraybuffer转换为base64
    const base64 = btoa(
      new Uint8Array(response.data).reduce((data, byte) => data + String.fromCharCode(byte), '')
    )
    return {
      code: 200,
      success: true,
      message: 'success',
      data: `data:image/png;base64,${base64}`,
      timestamp: Date.now(),
    }
  }
)

// 实名认证（参考移动端：/auth/user，POST方法，base: 2）
export const realAuth = withApiResponseHandler(
  async (name: string, idCard: string, uuid: string): Promise<ApiResponse<null>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: null,
        timestamp: Date.now(),
      }
    }
    // 移动端使用base: 2，对应Java后端，路径为/api/auth/user
    const response = await request.post<null>(AUTH_PATHS.user, {
      username: name,
      idCard,
      uuid,
    })
    return normalizeApiResponse(response)
  }
)

// 获取自己和下级的订单
export interface DistributionOrder {
  id: string
  order_no: string
  user_id: string
  amount: number
  status: number
  create_time: string
  [key: string]: any
}

export interface DistributionOrdersResponse {
  list: DistributionOrder[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}

export const getUserAndChildrenOrders = withApiResponseHandler(
  async (params: {
    id?: string
    page?: number
    quantity?: number
  }): Promise<ApiResponse<DistributionOrdersResponse>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      const page = params.page || 1
      const pageSize = params.quantity || 10
      const list: DistributionOrder[] = Array.from({ length: pageSize }).map((_, i) => ({
        id: `order-${page}-${i + 1}`,
        order_no: `ORD${Date.now()}-${i + 1}`,
        user_id: params.id || `user-${i + 1}`,
        amount: Number((Math.random() * 1000).toFixed(2)),
        status: i % 3,
        create_time: new Date(Date.now() - i * 86400000).toISOString(),
      }))
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: {
          list,
          pagination: { page, page_size: pageSize, total: 100, total_pages: 10 },
        },
        timestamp: Date.now(),
      }
    }
    const response = await request.post<DistributionOrdersResponse>(
      DISTRIBUTION_PATHS.getUserAndChildrenOrders,
      {
        id: params.id,
        page: params.page,
        quantity: params.quantity,
      }
    )
    return normalizeApiResponse(response)
  }
)

// 操盘手佣金详情响应
export interface TraderCommissionDetail {
  today_commission: number // 今日佣金
  total_earnings: number // 总收益
  balance: number // 余额
  commission_list: Array<{
    id: string
    amount: number // 佣金金额
    buyer_nickname: string // 下单人昵称
    time: number // 时间戳
    out_trade_no: string // 关联订单号
    order_id: string // 订单ID
    status?: number // 状态：0=待结算, 1=已结算, 4=取消结算
  }>
}

// 获取操盘手佣金详情
export const getUserCommissionDetail = withApiResponseHandler(
  async (user_id?: string): Promise<ApiResponse<TraderCommissionDetail>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: {
          today_commission: 100.0,
          total_earnings: 188.84,
          balance: 78.84,
          commission_list: Array.from({ length: 5 }).map((_, i) => ({
            id: `commission-${i + 1}`,
            amount: 20.0 + i * 10,
            buyer_nickname: `用户${i + 1}`,
            time: Date.now() - i * 86400000,
            out_trade_no: `ORD${Date.now()}-${i + 1}`,
            order_id: `order-${i + 1}`,
            status: i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 4,
          })),
        },
        timestamp: Date.now(),
      }
    }
    const response = await request.get<TraderCommissionDetail>(
      DISTRIBUTION_PATHS.getUserCommissionDetail,
      {
        params: { user_id },
      }
    )
    return normalizeApiResponse(response)
  }
)

// 团队成员订单统计信息
export interface TeamMemberOrderStats {
  id: string
  nickname: string
  avatar: string
  transactionVolume: number // 成交额（单位：分）
  commission: number // 获取佣金（单位：分）
  orderNum: number // 成交订单数
  createdAt: number // 邀请时间（时间戳）
  openId?: string
  phone?: string
}

// 获取用户邀请的团队成员订单统计（参考移动端：/trader/getUserInviteeOrderStats）
export const getUserInviteeOrderStats = withApiResponseHandler(
  async (params: {
    token?: string
    userId?: string
    pageNum?: number
    pageSize?: number
    begin?: number // 开始时间（时间戳，秒）
    end?: number // 结束时间（时间戳，秒）
  }): Promise<ApiResponse<TeamMemberOrderStats[]>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      const pageSize = params?.pageSize || 10
      const data: TeamMemberOrderStats[] = Array.from({ length: pageSize }).map((_, i) => ({
        id: `member-${i + 1}`,
        nickname: `团队成员${i + 1}`,
        avatar: '/images/common/userIcon.svg',
        transactionVolume: Math.floor(Math.random() * 100000), // 成交额（分）
        commission: Math.floor(Math.random() * 10000), // 佣金（分）
        orderNum: Math.floor(Math.random() * 50),
        createdAt: Date.now() - i * 86400000,
        openId: `openid-${i + 1}`,
        phone: `138****${1000 + i}`,
      }))
      return {
        code: 200,
        success: true,
        message: 'mock',
        data,
        timestamp: Date.now(),
      }
    }
    // 移动端使用POST方法，参数为token, userId, pageNum, pageSize, begin, end
    const response = await request.post<TeamMemberOrderStats[]>(
      DISTRIBUTION_PATHS.getUserInviteeOrderStats,
      {
        token: params?.token,
        userId: params?.userId,
        pageNum: params?.pageNum,
        pageSize: params?.pageSize,
        begin: params?.begin,
        end: params?.end,
      }
    )
    return normalizeApiResponse(response)
  }
)
