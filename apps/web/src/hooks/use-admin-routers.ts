'use client'

import { useEffect, useState } from 'react'
import { fetchApi } from '@/lib/api'

export interface AdminRouterItem {
  id: string
  name: string
  path: string
  component: string | null
  icon: string | null
  parentId: string | null
  sort: number
  type: number
  visible: number
  children?: AdminRouterItem[]
}

interface AdminRoutersState {
  list: AdminRouterItem[]
  loading: boolean
  loaded: boolean
}

let cached: AdminRouterItem[] | null = null

export function useAdminRouters() {
  const [state, setState] = useState<AdminRoutersState>({
    list: cached ?? [],
    loading: !cached,
    loaded: !!cached,
  })

  useEffect(() => {
    if (cached) {
      setState({ list: cached, loading: false, loaded: true })
      return
    }
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    void fetchApi<{ list: AdminRouterItem[] }>('/api/admin/menu/getRouters')
      .then((res) => {
        if (cancelled) return
        if (res.success && res.data?.list) {
          cached = res.data.list
          setState({ list: res.data.list, loading: false, loaded: true })
        } else {
          setState({ list: [], loading: false, loaded: true })
        }
      })
      .catch(() => {
        if (!cancelled) setState({ list: [], loading: false, loaded: true })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
