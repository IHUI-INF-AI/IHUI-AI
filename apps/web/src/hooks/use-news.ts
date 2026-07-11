'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'
import type { PageData } from '@/lib/edu'

export interface NewsItem {
  id: string
  title: string
  summary: string
  url: string
  cover: string | null
  source: string
  category: string
  publishedAt: string
}

export interface UseNewsReturn {
  list: NewsItem[]
  total: number
  page: number
  loading: boolean
  category: string
  setCategory: (cat: string) => void
  fetchNews: (page?: number, cat?: string) => Promise<void>
}

/** 新闻 Hook，分页获取新闻列表并支持分类筛选 */
export function useNews(initialPageSize = 10): UseNewsReturn {
  const [list, setList] = React.useState<NewsItem[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(false)
  const [category, setCategoryState] = React.useState('')

  const fetchNews = React.useCallback(
    async (p = 1, cat?: string) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(p),
          pageSize: String(initialPageSize),
        })
        const c = cat ?? category
        if (c) params.set('category', c)
        const res = await fetchApi<PageData<NewsItem>>(`/news?${params.toString()}`)
        if (res.success) {
          setList(res.data.list)
          setTotal(res.data.total)
          setPage(p)
        }
      } finally {
        setLoading(false)
      }
    },
    [category, initialPageSize],
  )

  const setCategory = React.useCallback(
    (cat: string) => {
      setCategoryState(cat)
      fetchNews(1, cat)
    },
    [fetchNews],
  )

  return { list, total, page, loading, category, setCategory, fetchNews }
}
