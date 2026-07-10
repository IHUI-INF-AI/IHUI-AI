import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

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

export interface AgentReview {
  id: string
  agentId: string
  userId: string
  userNickname: string
  userAvatar: string | null
  rating: number
  content: string
  createdAt: string
}

export interface AgentReviewInput {
  rating: number
  content: string
}

export type AgentListQuery = {
  page?: number
  pageSize?: number
  keyword?: string
  category?: string
  status?: AgentStatus
  sort?: string
}

export interface AgentInput {
  name: string
  description: string
  systemPrompt: string
  model?: string
  temperature?: number
  maxTokens?: number
  category?: string
  tags?: string[]
  isPublic?: boolean
  capabilities?: string[]
  avatar?: string
}

export async function getAgents(
  query: AgentListQuery = {},
): Promise<ApiResult<PageData<Agent>>> {
  return fetchApi<PageData<Agent>>(`/agents${buildQs(query)}`)
}

export async function getAgentById(id: string): Promise<ApiResult<Agent>> {
  return fetchApi<Agent>(`/agents/${encodeURIComponent(id)}`)
}

export async function createAgent(input: AgentInput): Promise<ApiResult<Agent>> {
  return fetchApi<Agent>('/agents', { method: 'POST', body: JSON.stringify(input) })
}

export async function updateAgent(
  id: string,
  input: Partial<AgentInput>,
): Promise<ApiResult<Agent>> {
  return fetchApi<Agent>(`/agents/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteAgent(
  id: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/agents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function favoriteAgent(
  id: string,
): Promise<ApiResult<{ favorited: boolean }>> {
  return fetchApi<{ favorited: boolean }>(
    `/agents/${encodeURIComponent(id)}/favorite`,
    { method: 'POST' },
  )
}

export async function getAgentReviews(
  id: string,
  query: { page?: number; pageSize?: number } = {},
): Promise<ApiResult<PageData<AgentReview>>> {
  return fetchApi<PageData<AgentReview>>(
    `/agents/${encodeURIComponent(id)}/reviews${buildQs(query)}`,
  )
}

export async function submitAgentForReview(
  id: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(
    `/agents/${encodeURIComponent(id)}/submit-review`,
    { method: 'POST' },
  )
}

export async function publishAgent(
  id: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/agents/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
  })
}
