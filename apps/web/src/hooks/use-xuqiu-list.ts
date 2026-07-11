'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'
import type { PageData } from '@/lib/edu'
import type { XuqiuItem } from '@/hooks/use-xuqiu-grid'

export interface UseXuqiuListReturn {
  list: XuqiuItem[]
  total: number
  page: number
  pageSize: number
  loading: boolean
  fetchList: (page?: number, status?: string) => Promise<void>
}

/** 需求列表 Hook，分页获取需求并支持状态筛选 */
export function useXuqiuList(initialPageSize = 10): UseXuqiuListReturn {
  const [list, setList] = React.useState<XuqiuItem[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(false)

  const fetchList = React.useCallback(
    async (p = 1, status?: string) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(p),
          pageSize: String(initialPageSize),
        })
        if (status) params.set('status', status)
        const res = await fetchApi<PageData<XuqiuItem>>(`/xuqiu/list?${params.toString()}`)
        if (res.success) {
          setList(res.data.list)
          setTotal(res.data.total)
          setPage(p)
        }
      } finally {
        setLoading(false)
      }
    },
    [initialPageSize],
  )

  return { list, total, page, pageSize: initialPageSize, loading, fetchList }
}
