// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
      // GET /agents/my 按当前登录用户过滤(后端 request.userId);此前误用 /agents/list(=市场列表,
      // 无 userId)⇒"我的 Agent"页签显示的是市场前 20 枚、与登录者无关。100 条足以覆盖个人目录。
      const res = await fetchApi<{
        list: Array<{ agentId: string; name: string; avatar?: string | null; description?: string | null; agentModel?: string | null }>
        total: number
      }>('/api/agents/my?pageSize=100')
      if (res.success) {
        setAgents(
          (res.data.list ?? []).map((a) => ({
            id: a.agentId,
            name: a.name,
            avatar: a.avatar ?? undefined,
            description: a.description ?? undefined,
            model: a.agentModel ?? undefined,
          })),
        )
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

  const createAgent = React.useCallback(async (data: Omit<Agent, 'id'>): Promise<boolean> => {
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
  }, [])

  return { agents, currentAgent, loading, fetchAgents, selectAgent, createAgent }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
