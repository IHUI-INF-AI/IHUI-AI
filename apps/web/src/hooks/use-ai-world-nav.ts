'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { fetchApi } from '@/lib/api'

export interface AiWorldCategory {
  id: string
  name: string
  description?: string
  icon?: string
  href: string
  children?: AiWorldCategory[]
}

export interface UseAiWorldNavReturn {
  categories: AiWorldCategory[]
  activeId: string | null
  loading: boolean
  expandedIds: string[]
  toggleExpand: (id: string) => void
  navigate: (href: string) => void
  fetchCategories: () => Promise<void>
}

/** AI 世界导航 Hook，维护分类树与展开/导航逻辑 */
export function useAiWorldNav(): UseAiWorldNavReturn {
  const router = useRouter()
  const [categories, setCategories] = React.useState<AiWorldCategory[]>([])
  const [loading, setLoading] = React.useState(false)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [expandedIds, setExpandedIds] = React.useState<string[]>([])

  const fetchCategories = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApi<AiWorldCategory[]>('/api/ai-world/categories')
      if (res.success) setCategories(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  const toggleExpand = React.useCallback((id: string) => {
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const navigate = React.useCallback(
    (href: string) => {
      setActiveId(href)
      router.push(href)
    },
    [router],
  )

  return {
    categories,
    activeId,
    loading,
    expandedIds,
    toggleExpand,
    navigate,
    fetchCategories,
  }
}
