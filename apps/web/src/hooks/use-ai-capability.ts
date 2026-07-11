'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'

export interface AiCapability {
  id: string
  name: string
  description?: string
  category?: string
  enabled: boolean
  endpoints?: string[]
}

export interface UseAiCapabilityReturn {
  capabilities: AiCapability[]
  loading: boolean
  error: string | null
  fetchCapabilities: () => Promise<void>
  toggleCapability: (id: string) => Promise<void>
}

/** AI 能力发现 Hook，从 /api/ai-ext/capabilities 拉取能力清单 */
export function useAiCapability(): UseAiCapabilityReturn {
  const [capabilities, setCapabilities] = React.useState<AiCapability[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchCapabilities = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi<AiCapability[]>('/api/ai-ext/capabilities')
      if (res.success) {
        setCapabilities(res.data)
      } else {
        setError(res.error)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const toggleCapability = React.useCallback(
    async (id: string) => {
      const target = capabilities.find((c) => c.id === id)
      if (!target) return
      const next = !target.enabled
      setCapabilities((prev) => prev.map((c) => (c.id === id ? { ...c, enabled: next } : c)))
      await fetchApi(`/api/ai-ext/capabilities/${id}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ enabled: next }),
      })
    },
    [capabilities],
  )

  return { capabilities, loading, error, fetchCapabilities, toggleCapability }
}
