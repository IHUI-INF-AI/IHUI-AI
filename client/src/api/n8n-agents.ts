/**
 * N8N智能体相关API
 * 对应后端路由：/api/agent（Java后端，base: 1）
 */

import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'
import type { Agent } from '@/api/agents'
import { logger } from '@/utils/logger'

// N8N智能体列表响应
export interface N8NAgentsListResponse {
  list: Agent[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}

// Creating N8N agent请求数据
export interface CreateN8NAgentData {
  name: string
  description: string
  avatar?: string
  n8nUrl: string
  n8nBackupFile?: File | string // n8n备份JSON文件
  inputParams?: Array<{
    parameterName: string
    parameterDescription: string
    type: 'text' | 'image' | 'video' | 'audio' | 'boolean' | 'float'
    Default?: string
  }>
  outputParams?: Array<{
    parameterName: string
    parameterDescription: string
    type: 'text' | 'image' | 'video' | 'audio' | 'boolean' | 'float'
    Default?: string
  }>
}

// Getting N8N agent list
export const getN8NAgents = withApiResponseHandler(
  async (params?: {
    page?: number
    page_size?: number
  }): Promise<ApiResponse<N8NAgentsListResponse>> => {
    try {
      if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
        logger.info('[N8NAgents] Using mock data in dev environment', params)
        const page = params?.page || 1
        const pageSize = params?.page_size || 10
        const list: Agent[] = Array.from({ length: pageSize }).map((_, i) => ({
          id: `n8n-agent-${page}-${i + 1}`,
          name: `N8N智能体${i + 1}`,
          description: `这是N8N智能体${i + 1}的描述`,
          avatar: '/images/common/userIcon.svg',
          platform: 'n8n' as const,
          status: 'active',
          createdAt: new Date(Date.now() - i * 86400000).toISOString(),
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

      logger.info('[N8NAgents] Getting N8N agent list', params)

      const response = await request.get<N8NAgentsListResponse>('/api/agent/list', {
        params: {
          platform: 'n8n',
          page: params?.page,
          page_size: params?.page_size,
        },
      })

      logger.info('[N8NAgents] Getting N8N agent list success', response.data)

      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[N8NAgents] Getting N8N agent list failed:', error)
      throw error
    }
  }
)

// Creating N8N agent（参考移动端：/api/agent/upload，POST方法，base: 1）
export const createN8NAgent = withApiResponseHandler(
  async (data: CreateN8NAgentData): Promise<ApiResponse<Agent>> => {
    try {
      if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
        logger.info('[N8NAgents] Using mock data in dev environment', data)
        return {
          code: 200,
          success: true,
          message: 'mock',
          data: {
            id: `n8n-agent-${Date.now()}`,
            name: data.name,
            description: data.description,
            avatar: data.avatar || '/images/common/userIcon.svg',
            platform: 'n8n' as const,
            status: 'active',
            createTime: new Date().toISOString(),
          } as Agent,
          timestamp: Date.now(),
        }
      }

      logger.info('[N8NAgents] Creating N8N agent', { name: data.name })

      const formData = new FormData()
      formData.append('name', data.name)
      formData.append('description', data.description)
      if (data.avatar) formData.append('avatar', data.avatar)
      formData.append('n8nUrl', data.n8nUrl)
      if (data.n8nBackupFile) {
        if (data.n8nBackupFile instanceof File) {
          formData.append('n8nBackupFile', data.n8nBackupFile)
        } else {
          formData.append('n8nBackupFile', data.n8nBackupFile)
        }
      }
      if (data.inputParams) {
        formData.append('inputParams', JSON.stringify(data.inputParams))
      }
      if (data.outputParams) {
        formData.append('outputParams', JSON.stringify(data.outputParams))
      }

      const response = await request.post<Agent>('/api/agent/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      logger.info('[N8NAgents] Creating N8N agent success', response.data)

      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[N8NAgents] Creating N8N agent failed:', error)
      throw error
    }
  }
)

// Calling N8N agent（参考移动端：/api/agent/process，POST方法，base: 1）
export const processN8NAgent = withApiResponseHandler(
  async (data: {
    agentId: string
    params: Record<string, unknown>
  }): Promise<ApiResponse<unknown>> => {
    try {
      if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
        logger.info('[N8NAgents] Using mock data in dev environment', { agentId: data.agentId })
        return {
          code: 200,
          success: true,
          message: 'mock',
          data: { result: '处理成功' },
          timestamp: Date.now(),
        }
      }

      logger.info('[N8NAgents] Calling N8N agent', { agentId: data.agentId })

      const response = await request.post<unknown>('/api/agent/process', {
        agentId: data.agentId,
        params: data.params,
      })

      logger.info('[N8NAgents] Calling N8N agent success', response.data)

      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[N8NAgents] Calling N8N agent failed:', error)
      throw error
    }
  }
)
