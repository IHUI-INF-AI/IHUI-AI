import type { PaginationParams } from './api'

export interface AgentItem {
  id?: string | number
  uuid?: string
  agentId?: string | number
  agentUuid?: string
  name?: string
  agentName?: string
  title?: string
  description?: string
  agentDesc?: string
  avatar?: string
  icon?: string
  cover?: string
  category?: string
  categoryId?: string | number
  type?: string
  price?: number
  status?: number | string
  developerUuid?: string
  developerName?: string
  createdAt?: string
  createTime?: string
  updatedAt?: string
  updateTime?: string
  [key: string]: unknown
}

export interface AgentCategory {
  id?: string | number
  categoryId?: string | number
  name?: string
  categoryName?: string
  parentId?: string | number
  sort?: number
  status?: number | string
  [key: string]: unknown
}

export interface AgentListParams extends PaginationParams {
  name?: string
  agentName?: string
  category?: string
  categoryId?: string | number
  status?: number
  developerUuid?: string
  startDate?: string
  endDate?: string
}
