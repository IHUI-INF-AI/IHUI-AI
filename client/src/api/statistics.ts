import type { Recordable } from '@/types'
import { http } from '@/utils/http'

export interface UsageStatistics {
  chat?: {
    totalSessions?: number
    totalMessages?: number
    totalTokens?: number
  }
  files?: {
    totalFiles?: number
  }
  trends?: Array<{ date: string; sessions: number; messages: number; tokens: number }>
  [key: string]: unknown
}

export interface AgentStatistics {
  examine?: {
    totalExamines?: number
    approved?: number
    pending?: number
    rejected?: number
  }
  buy?: {
    totalBuys?: number
    totalRevenue?: number
    uniqueBuyers?: number
    uniqueAgents?: number
  }
  settlement?: {
    totalSettlements?: number
    totalWithdrawal?: number
    settledCount?: number
    unsettledCount?: number
  }
  [key: string]: unknown
}

export interface BehaviorStatistics {
  login?: {
    loginDays?: number
    totalLoginCount?: number
    lastLoginTime?: string | null
  }
  activeHours?: Array<{ hour: number; count: number }>
  favoriteAgents?: Array<{ botId?: string; usageCount?: number; totalTokens?: number }>
  [key: string]: unknown
}

export interface OrderStatistics {
  summary?: {
    totalOrders?: number
    totalAmount?: number
    paidOrders?: number
    completedOrders?: number
  }
  trends?: Array<{ date: string; count: number; amount: number }>
  [key: string]: unknown
}

export async function getUsageStatistics(params?: Recordable): Promise<UsageStatistics> {
  return await http.get<UsageStatistics>('/admin/stats/detailed', params)
}
export function getAgentStatistics(params?: Recordable): Promise<AgentStatistics> {
  return Promise.resolve({})
}
export function getBehaviorStatistics(params?: Recordable): Promise<BehaviorStatistics> {
  return Promise.resolve({})
}
export function getOrderStatistics(params?: Recordable): Promise<OrderStatistics> {
  return Promise.resolve({})
}
