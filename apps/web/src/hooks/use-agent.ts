'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'

export interface Agent {
  id: string
  name: string
  avatar?: string
  description?: string
  model?: string
  systemPrompt?: string
}

export interface UseAgentReturn {
  agents: Agent[]
  currentAgent: Agent | null
  loading: boolean
  fetchAgents: () => Promise<void>
  selectAgent: (id: string) => void
  createAgent: (data: Omit<Agent, 'id'>) => Promise<boolean>
}

/** Agent 管理 Hook（本地 state + fetchApi） */
export function useAgent(): UseAgentReturn {
  const [agents, setAgents] = React.useState<Agent[]>([])
  const [currentAgent, setCurrentAgent] = React.useState<Agent | null>(null)
  const [loading, setLoading] = React.useState(false)

  const fetchAgents = React.useCallback(async () => {
    setLoading(true)
    try {
      // 后端 GET /api/agents/list 返回 { list, total, page, pageSize }
      const res = await fetchApi<{ list: Agent[]; total: number; page: number; pageSize: number }>(
        '/api/agents/list',
      )
      if (res.success) {
        setAgents(res.data.list)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const selectAgent = React.useCallback(
    (id: string) => {
      setCurrentAgent(agents.find((a) => a.id === id) ?? null)
    },
    [agents],
  )

  const createAgent = React.useCallback(
    async (data: Omit<Agent, 'id'>): Promise<boolean> => {
      // 后端 POST /api/agents/create 返回单个 Agent
      const res = await fetchApi<Agent>('/api/agents/create', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (res.success) {
        setAgents((prev) => [...prev, res.data])
        return true
      }
      return false
    },
    [],
  )

  return { agents, currentAgent, loading, fetchAgents, selectAgent, createAgent }
}
