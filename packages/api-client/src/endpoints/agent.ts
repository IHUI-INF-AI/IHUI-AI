import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData } from '../utils.js'

export type AgentStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'offline'

export interface Agent {
  id: string
  name: string
  avatar: string | null
  description: string
  systemPrompt: string
  model: string
  temperature: number
  maxTokens: number
  category: string
  tags: string[]
  status: AgentStatus
  author: { id: string; nickname: string; avatar: string | null }
  useCount: number
  favoriteCount: number
  rating: number
  isFavorited: boolean
  isPublic: boolean
  version: string
  capabilities: string[]
  createdAt: string
  updatedAt: string
}

export type AgentListQuery = {
  page?: number
  pageSize?: number
  keyword?: string
  category?: string
  status?: AgentStatus
  sort?: string
}

export async function getAgents(query: AgentListQuery = {}): Promise<ApiResult<PageData<Agent>>> {
  return fetchApi<PageData<Agent>>(`/agents${buildQs(query)}`)
}
