import { t } from '@/utils/i18n'

import request from '@/utils/request'
import { normalizeApiResponse } from '@/utils/apiResponseFormatter'
import { logger } from '@/utils/logger'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { COZE_PATHS, DEVELOPER_PATHS } from '@/config/backend-paths'

// 用户使用统计
export interface UsageStatistics {
  period: {
    start: string
    end: string
    type: string
  }
  chat: {
    totalSessions: number
    totalMessages: number
    totalTokens: number
  }
  files: {
    totalFiles: number
    totalSize: number
    imageCount: number
    videoCount: number
    audioCount: number
  }
  tokens: {
    consumed: number
    recharged: number
  }
  orders: {
    totalOrders: number
    totalAmount: number
    paidOrders: number
    unpaidOrders: number
  }
  trends: Array<{
    date: string
    sessions: number
    messages: number
    tokens: number
  }>
}

// 用户行为统计
export interface BehaviorStatistics {
  login: {
    loginDays: number
    lastLoginTime: string | null
    totalLoginCount: number
  }
  activeHours: Array<{
    hour: number
    count: number
  }>
  favoriteAgents: Array<{
    botId: string
    usageCount: number
    totalTokens: number
  }>
  activeDays: Array<{
    date: string
    sessions: number
    messages: number
  }>
}

// 订单统计
export interface OrderStatistics {
  summary: {
    totalOrders: number
    totalAmount: number
    completedAmount: number
    paidOrders: number
    unpaidOrders: number
    completedOrders: number
    pendingOrders: number
  }
  byPaymentMethod: Array<{
    payType: string
    count: number
    amount: number
  }>
  byOrderType: Array<{
    orderType: number
    count: number
    amount: number
  }>
  trends: Array<{
    date: string
    count: number
    amount: number
  }>
}

// 智能体统计
export interface AgentStatistics {
  examine: {
    totalExamines: number
    approved: number
    rejected: number
    pending: number
    returned: number
  }
  buy: {
    totalBuys: number
    totalRevenue: number
    uniqueBuyers: number
    uniqueAgents: number
  }
  settlement: {
    totalSettlements: number
    totalWithdrawal: number
    settledCount: number
    unsettledCount: number
  }
}

// 性能指标
export interface PerformanceMetrics {
  endpoint: string
  method: string
  avgResponseTime: number
  p50ResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  requestsPerSecond: number
  errorRate: number
  successRate: number
  totalRequests: number
  timeRange: {
    start: string
    end: string
  }
}

// 错误追踪
export interface ErrorLog {
  id: string
  timestamp: string
  endpoint: string
  method: string
  statusCode: number
  errorCode: string
  errorMessage: string
  errorStack?: string
  requestId: string
  userId?: string
  userAgent?: string
  ip?: string
  requestBody?: Record<string, unknown>
  responseBody?: Record<string, unknown>
  resolved: boolean
  resolvedAt?: string
  resolvedBy?: string
}

// 统计查询参数
export interface StatisticsQueryParams extends PaginationParams {
  startDate?: string
  endDate?: string
  endpoint?: string
  method?: string
  statusCode?: number
  userId?: string
  groupBy?: 'hour' | 'day' | 'week' | 'month'
}

// 获取用户使用统计
export async function getUsageStatistics(params?: {
  type?: 'today' | 'week' | 'month' | 'all'
  startDate?: string
  endDate?: string
}): Promise<ApiResponse<UsageStatistics>> {
  try {
    const response = await request.get(COZE_PATHS.statistics.usage, { params })
    return normalizeApiResponse<UsageStatistics>(response.data)
  } catch (error: unknown) {
    logger.error('Failed to get usage statistics:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.statistics.获取使用统计失败'),
      data: {
        period: {
          start: params?.startDate || '',
          end: params?.endDate || '',
          type: params?.type || 'month',
        },
        chat: { totalSessions: 0, totalMessages: 0, totalTokens: 0 },
        files: {
          totalFiles: 0,
          totalSize: 0,
          imageCount: 0,
          videoCount: 0,
          audioCount: 0,
        },
        tokens: { consumed: 0, recharged: 0 },
        orders: { totalOrders: 0, totalAmount: 0, paidOrders: 0, unpaidOrders: 0 },
        trends: [],
      },
      timestamp: Date.now(),
    }
  }
}

// 获取用户行为统计
export async function getBehaviorStatistics(params?: {
  type?: 'today' | 'week' | 'month' | 'all'
}): Promise<ApiResponse<BehaviorStatistics>> {
  try {
    const response = await request.get(COZE_PATHS.statistics.behavior, { params })
    return normalizeApiResponse<BehaviorStatistics>(response.data)
  } catch (error: unknown) {
    logger.error('Failed to get behavior statistics:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.statistics.获取行为统计失败'),
      data: {
        login: { loginDays: 0, lastLoginTime: null, totalLoginCount: 0 },
        activeHours: [],
        favoriteAgents: [],
        activeDays: [],
      },
      timestamp: Date.now(),
    }
  }
}

// 获取订单统计
export async function getOrderStatistics(params?: {
  type?: 'today' | 'week' | 'month' | 'all'
  status?: number
  paymentStatus?: number
}): Promise<ApiResponse<OrderStatistics>> {
  try {
    const response = await request.get(COZE_PATHS.statistics.orders, { params })
    return normalizeApiResponse<OrderStatistics>(response.data)
  } catch (error: unknown) {
    logger.error('Failed to get order statistics:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.statistics.获取订单统计失败'),
      data: {
        summary: {
          totalOrders: 0,
          totalAmount: 0,
          completedAmount: 0,
          paidOrders: 0,
          unpaidOrders: 0,
          completedOrders: 0,
          pendingOrders: 0,
        },
        byPaymentMethod: [],
        byOrderType: [],
        trends: [],
      },
      timestamp: Date.now(),
    }
  }
}

// 获取智能体统计
export async function getAgentStatistics(params?: {
  type?: 'today' | 'week' | 'month' | 'all'
}): Promise<ApiResponse<AgentStatistics>> {
  try {
    const response = await request.get(COZE_PATHS.statistics.agents, { params })
    return normalizeApiResponse<AgentStatistics>(response.data)
  } catch (error: unknown) {
    logger.error('Failed to get agent statistics:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.statistics.获取智能体统计失败'),
      data: {
        examine: { totalExamines: 0, approved: 0, rejected: 0, pending: 0, returned: 0 },
        buy: { totalBuys: 0, totalRevenue: 0, uniqueBuyers: 0, uniqueAgents: 0 },
        settlement: {
          totalSettlements: 0,
          totalWithdrawal: 0,
          settledCount: 0,
          unsettledCount: 0,
        },
      },
      timestamp: Date.now(),
    }
  }
}

// 调用统计（开发者API）
export interface CallStatistics {
  id: string
  endpoint: string
  method: string
  totalCalls: number
  successCalls: number
  failedCalls: number
  totalTokens: number
  totalCost: number
  avgResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  date: string
  hour?: number
}

// 获取性能指标
export async function getPerformanceMetrics(
  params?: Omit<StatisticsQueryParams, 'page' | 'pageSize'>
): Promise<ApiResponse<PerformanceMetrics[]>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.statistics.performance, { params })
    return {
      code: 200,
      success: true,
      data: response.data,
      message: t('api.statistics.获取性能指标成功'),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: (error as { response?: { status?: number } }).response?.status || 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取性能指标失败',
      data: [],
      timestamp: Date.now(),
    }
  }
}

// 获取错误日志
export async function getErrorLogs(
  params?: StatisticsQueryParams
): Promise<ApiResponse<PaginationResponse<ErrorLog>>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.statistics.errors, {
      params,
    })
    return {
      code: 200,
      success: true,
      data: response.data,
      message: t('api.statistics.获取错误日志成功1'),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: (error as { response?: { status?: number } }).response?.status || 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取错误日志失败',
      data: {
        list: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0,
        },
      },
      timestamp: Date.now(),
    }
  }
}

// 标记错误为已解决
export async function resolveError(errorId: string, note?: string): Promise<ApiResponse<void>> {
  try {
    const _response = await request.post(DEVELOPER_PATHS.statistics.errorResolve(errorId), {
      note,
    })
    return {
      code: 200,
      success: true,
      message: t('api.statistics.标记错误为已解决2'),
      data: undefined,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: (error as { response?: { status?: number } }).response?.status || 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '标记错误失败',
      data: undefined,
      timestamp: Date.now(),
    }
  }
}

// 导出统计数据
export async function exportStatistics(params: StatisticsQueryParams): Promise<Blob> {
  try {
    const response = await request.get(DEVELOPER_PATHS.statistics.export, {
      params,
      responseType: 'blob',
    })
    return response.data
  } catch (error: unknown) {
    throw new Error((error instanceof Error ? error.message : String(error)) || '导出统计数据失败')
  }
}

// 获取实时统计
export async function getRealtimeStatistics(): Promise<
  ApiResponse<{
    currentQPS: number
    currentConcurrency: number
    todayCalls: number
    todayCost: number
    errorRate: number
    avgResponseTime: number
  }>
> {
  try {
    const response = await request.get(DEVELOPER_PATHS.statistics.realtime)
    return {
      code: 200,
      success: true,
      data: response.data,
      message: t('api.statistics.获取实时统计成功3'),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: (error as { response?: { status?: number } }).response?.status || 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取实时统计失败',
      data: {
        currentQPS: 0,
        currentConcurrency: 0,
        todayCalls: 0,
        todayCost: 0,
        errorRate: 0,
        avgResponseTime: 0,
      },
      timestamp: Date.now(),
    }
  }
}

// 用户统计（组合类型）
export interface UserStatistics {
  usage: {
    totalChatSessions: number
    totalMessages: number
    totalTokensUsed: number
    totalToolsUsed: number
    todayChatSessions: number
    todayMessages: number
    todayTokensUsed: number
    weekChatSessions: number
    weekMessages: number
    weekTokensUsed: number
    monthChatSessions: number
    monthMessages: number
    monthTokensUsed: number
  }
  consumption: {
    totalCost: number
    todayCost: number
    weekCost: number
    monthCost: number
    balance: number
    totalRecharge: number
    totalWithdraw: number
  }
  activity: {
    loginDays: number
    consecutiveLoginDays: number
    lastLoginTime: string
    activeHours: Array<{ hour: number; count: number }>
    favoriteTools: Array<{ id: string; name: string; usageCount: number }>
    favoriteAgents: Array<{ id: string; name: string; usageCount: number }>
  }
  trends: {
    daily: Array<{
      date: string
      sessions: number
      messages: number
      tokens: number
    }>
    weekly: Array<{
      date: string
      sessions: number
      messages: number
      tokens: number
    }>
    monthly: Array<{
      date: string
      sessions: number
      messages: number
      tokens: number
    }>
  }
}

// 系统统计（管理员）
export interface SystemStatistics {
  users: {
    totalUsers: number
    vipUsers: number
    activeUsers: number
    newUsers30d: number
  }
  orders: {
    totalOrders: number
    totalRevenue: number
    paidOrders: number
    orders30d: number
  }
  chat: {
    totalConversations: number
    totalMessages: number
    totalTokens: number
  }
  agents: {
    totalExamines: number
    approvedAgents: number
    rejectedAgents: number
  }
  files: {
    totalFiles: number
    totalSize: number
  }
}

// 获取系统统计（管理员）
export async function getSystemStatistics(): Promise<ApiResponse<SystemStatistics>> {
  try {
    const response = await request.get(COZE_PATHS.statistics.system)
    return {
      code: 200,
      success: true,
      data: response.data,
      message: t('api.statistics.获取系统统计成功4'),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: (error as { response?: { status?: number } }).response?.status || 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取系统统计失败',
      data: {
        users: {
          totalUsers: 0,
          vipUsers: 0,
          activeUsers: 0,
          newUsers30d: 0,
        },
        orders: {
          totalOrders: 0,
          totalRevenue: 0,
          paidOrders: 0,
          orders30d: 0,
        },
        chat: {
          totalConversations: 0,
          totalMessages: 0,
          totalTokens: 0,
        },
        agents: {
          totalExamines: 0,
          approvedAgents: 0,
          rejectedAgents: 0,
        },
        files: {
          totalFiles: 0,
          totalSize: 0,
        },
      },
      timestamp: Date.now(),
    }
  }
}

// 获取用户统计（组合多个统计接口）
export async function getUserStatistics(params?: {
  timeRange?: 'today' | 'week' | 'month' | 'all'
}): Promise<ApiResponse<UserStatistics>> {
  try {
    const [usageRes, behaviorRes, orderRes] = await Promise.all([
      getUsageStatistics({ type: params?.timeRange || 'all' }),
      getBehaviorStatistics({ type: params?.timeRange || 'all' }),
      getOrderStatistics({ type: params?.timeRange || 'all' }),
    ])

    // 组合数据
    const statistics: UserStatistics = {
      usage: {
        totalChatSessions: usageRes.data?.chat?.totalSessions || 0,
        totalMessages: usageRes.data?.chat?.totalMessages || 0,
        totalTokensUsed: usageRes.data?.tokens?.consumed || 0,
        totalToolsUsed: usageRes.data?.files?.totalFiles || 0,
        todayChatSessions: 0,
        todayMessages: 0,
        todayTokensUsed: 0,
        weekChatSessions: 0,
        weekMessages: 0,
        weekTokensUsed: 0,
        monthChatSessions: 0,
        monthMessages: 0,
        monthTokensUsed: 0,
      },
      consumption: {
        totalCost: orderRes.data?.summary?.totalAmount || 0,
        todayCost: 0,
        weekCost: 0,
        monthCost: 0,
        balance: 0,
        totalRecharge: 0,
        totalWithdraw: 0,
      },
      activity: {
        loginDays: behaviorRes.data?.login?.loginDays || 0,
        consecutiveLoginDays: 0,
        lastLoginTime: behaviorRes.data?.login?.lastLoginTime || '',
        activeHours: behaviorRes.data?.activeHours || [],
        favoriteTools: [],
        favoriteAgents: (behaviorRes.data?.favoriteAgents || []).map(
          (agent: { botId: string; usageCount: number; totalTokens: number }) => ({
            id: agent.botId,
            name: agent.botId, // 如果没有名称，使用botId
            usageCount: agent.usageCount,
          })
        ),
      },
      trends: {
        daily: usageRes.data?.trends || [],
        weekly: [],
        monthly: [],
      },
    }

    return {
      code: 200,
      success: true,
      data: statistics,
      message: t('api.statistics.获取用户统计成功5'),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: (error as { response?: { status?: number } }).response?.status || 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取用户统计失败',
      data: {
        usage: {
          totalChatSessions: 0,
          totalMessages: 0,
          totalTokensUsed: 0,
          totalToolsUsed: 0,
          todayChatSessions: 0,
          todayMessages: 0,
          todayTokensUsed: 0,
          weekChatSessions: 0,
          weekMessages: 0,
          weekTokensUsed: 0,
          monthChatSessions: 0,
          monthMessages: 0,
          monthTokensUsed: 0,
        },
        consumption: {
          totalCost: 0,
          todayCost: 0,
          weekCost: 0,
          monthCost: 0,
          balance: 0,
          totalRecharge: 0,
          totalWithdraw: 0,
        },
        activity: {
          loginDays: 0,
          consecutiveLoginDays: 0,
          lastLoginTime: '',
          activeHours: [],
          favoriteTools: [],
          favoriteAgents: [],
        },
        trends: {
          daily: [],
          weekly: [],
          monthly: [],
        },
      },
      timestamp: Date.now(),
    }
  }
}
