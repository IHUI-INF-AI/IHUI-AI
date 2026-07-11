'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'

export interface VipFaq {
  id: string
  question: string
  answer: string
  category: string
  sort: number
}

export interface UseVipFaqsReturn {
  faqs: VipFaq[]
  loading: boolean
  expandedId: string | null
  fetchFaqs: () => Promise<void>
  toggle: (id: string) => void
}

/** VIP FAQ Hook，获取常见问题并管理展开状态 */
export function useVipFaqs(): UseVipFaqsReturn {
  const [faqs, setFaqs] = React.useState<VipFaq[]>([])
  const [loading, setLoading] = React.useState(false)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  const fetchFaqs = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApi<VipFaq[]>('/vip/faqs')
      if (res.success) setFaqs(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  const toggle = React.useCallback((id: string) => {
    setExpandedId((cur) => (cur === id ? null : id))
  }, [])

  return { faqs, loading, expandedId, fetchFaqs, toggle }
}
