'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'

export interface XuqiuItem {
  id: string
  title: string
  description: string
  category: string
  budget: number | null
  status: string
  createdAt: string
}

export interface UseXuqiuGridReturn {
  items: XuqiuItem[]
  loading: boolean
  category: string
  setCategory: (cat: string) => void
  fetchGrid: (cat?: string) => Promise<void>
}

/** 需求网格 Hook，按分类展示需求卡片 */
export function useXuqiuGrid(): UseXuqiuGridReturn {
  const [items, setItems] = React.useState<XuqiuItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [category, setCategory] = React.useState('')

  const fetchGrid = React.useCallback(async (cat?: string) => {
    setLoading(true)
    try {
      const url = cat ? `/xuqiu/grid?category=${encodeURIComponent(cat)}` : '/xuqiu/grid'
      const res = await fetchApi<XuqiuItem[]>(url)
      if (res.success) setItems(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSetCategory = React.useCallback(
    (cat: string) => {
      setCategory(cat)
      fetchGrid(cat)
    },
    [fetchGrid],
  )

  return { items, loading, category, setCategory: handleSetCategory, fetchGrid }
}
