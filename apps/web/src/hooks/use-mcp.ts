'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchApi } from '@/lib/api'

export interface McpProject {
  id: string
  name: string
  description?: string
  server: string
  status: 'connected' | 'disconnected' | 'error'
  tools?: string[]
  resources?: string[]
  createdAt: string
}

export interface McpProjectInput {
  name: string
  description?: string
  server: string
}

export interface UseMcpReturn {
  projects: McpProject[]
  isLoading: boolean
  creating: boolean
  error: Error | null
  createProject: (input: McpProjectInput) => Promise<McpProject | null>
  removeProject: (id: string) => Promise<boolean>
  refresh: () => void
}

async function fetchProjects(): Promise<McpProject[]> {
  const res = await fetchApi<McpProject[]>('/api/mcp/projects')
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** MCP 管理 Hook，封装项目 CRUD + react-query 缓存失效 */
export function useMcp(): UseMcpReturn {
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['mcp-projects'],
    queryFn: fetchProjects,
  })

  const createMutation = useMutation({
    mutationFn: async (input: McpProjectInput) => {
      const res = await fetchApi<McpProject>('/api/mcp/projects', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['mcp-projects'] }),
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchApi(`/api/mcp/projects/${id}`, { method: 'DELETE' })
      return res.success
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['mcp-projects'] }),
  })

  const createProject = React.useCallback(
    async (input: McpProjectInput): Promise<McpProject | null> => {
      try {
        return await createMutation.mutateAsync(input)
      } catch {
        return null
      }
    },
    [createMutation],
  )

  const removeProject = React.useCallback(
    async (id: string): Promise<boolean> => {
      try {
        return await removeMutation.mutateAsync(id)
      } catch {
        return false
      }
    },
    [removeMutation],
  )

  return {
    projects: data ?? [],
    isLoading,
    creating: createMutation.isPending,
    error: error as Error | null,
    createProject,
    removeProject,
    refresh: () => void refetch(),
  }
}

/** MCP 性能指标子 Hook */
export interface McpPerformance {
  projectId: string
  avgLatencyMs: number
  totalCalls: number
  errorRate: number
  lastCalledAt?: string
}

export function useMcpPerformance(projectId: string | null) {
  return useQuery({
    queryKey: ['mcp-performance', projectId],
    queryFn: async () => {
      if (!projectId) return null
      const res = await fetchApi<McpPerformance>(`/api/mcp/projects/${projectId}/performance`)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: !!projectId,
  })
}

/** MCP 使用统计子 Hook */
export interface McpUseStat {
  projectId: string
  toolCalls: number
  resourceReads: number
  promptsUsed: number
}

export function useMcpUse(projectId: string | null) {
  return useQuery({
    queryKey: ['mcp-use', projectId],
    queryFn: async () => {
      if (!projectId) return null
      const res = await fetchApi<McpUseStat>(`/api/mcp/projects/${projectId}/use`)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: !!projectId,
  })
}
