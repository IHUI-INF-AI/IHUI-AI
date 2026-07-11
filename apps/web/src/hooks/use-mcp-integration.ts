'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchApi } from '@/lib/api'

export interface McpIntegration {
  id: string
  name: string
  type: 'stdio' | 'sse' | 'http'
  endpoint: string
  enabled: boolean
  config?: Record<string, unknown>
}

export interface McpIntegrationInput {
  name: string
  type: 'stdio' | 'sse' | 'http'
  endpoint: string
  config?: Record<string, unknown>
}

export interface UseMcpIntegrationReturn {
  integrations: McpIntegration[]
  isLoading: boolean
  connecting: boolean
  error: Error | null
  addIntegration: (input: McpIntegrationInput) => Promise<boolean>
  toggleIntegration: (id: string) => Promise<void>
  removeIntegration: (id: string) => Promise<boolean>
}

async function fetchIntegrations(): Promise<McpIntegration[]> {
  const res = await fetchApi<McpIntegration[]>('/api/mcp/integrations')
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** MCP 集成 Hook，管理外部 MCP 服务接入 */
export function useMcpIntegration(): UseMcpIntegrationReturn {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['mcp-integrations'],
    queryFn: fetchIntegrations,
  })

  const addMutation = useMutation({
    mutationFn: async (input: McpIntegrationInput) => {
      const res = await fetchApi<McpIntegration>('/api/mcp/integrations', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['mcp-integrations'] }),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await fetchApi(`/api/mcp/integrations/${id}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      })
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['mcp-integrations'] }),
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchApi(`/api/mcp/integrations/${id}`, { method: 'DELETE' })
      return res.success
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['mcp-integrations'] }),
  })

  const addIntegration = React.useCallback(
    async (input: McpIntegrationInput): Promise<boolean> => {
      try {
        await addMutation.mutateAsync(input)
        return true
      } catch {
        return false
      }
    },
    [addMutation],
  )

  const toggleIntegration = React.useCallback(
    async (id: string): Promise<void> => {
      const target = data?.find((i) => i.id === id)
      if (!target) return
      await toggleMutation.mutateAsync({ id, enabled: !target.enabled })
    },
    [data, toggleMutation],
  )

  const removeIntegration = React.useCallback(
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
    integrations: data ?? [],
    isLoading,
    connecting: addMutation.isPending,
    error: error as Error | null,
    addIntegration,
    toggleIntegration,
    removeIntegration,
  }
}
