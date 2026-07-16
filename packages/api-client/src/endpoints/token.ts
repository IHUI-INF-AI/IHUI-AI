import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData } from '../utils.js'

export interface TokenBalance {
  balance: number
  totalEarned: number
  totalUsed: number
}

export interface TokenFlowItem {
  id: string
  agentName: string
  modelName: string
  token: number
  amount: number
  createdAt: string
}

export type TokenFlowQuery = {
  range?: string
  page?: number
  pageSize?: number
  from?: string
  to?: string
}

export async function getTokenBalance(): Promise<ApiResult<TokenBalance>> {
  return fetchApi<TokenBalance>('/api/user/token-balance')
}

export async function getTokenFlows(
  query: TokenFlowQuery = {},
): Promise<ApiResult<PageData<TokenFlowItem>>> {
  return fetchApi<PageData<TokenFlowItem>>(`/api/user/token-flow${buildQs(query)}`)
}
