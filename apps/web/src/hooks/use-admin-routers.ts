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

/** 获取后台菜单路由。
 * 不使用模块级缓存,避免跨用户账号切换时菜单泄漏(权限隔离)。
 * 组件级 state 保证每次挂载按当前用户权限拉取。 */
export function useAdminRouters() {
  const [state, setState] = useState<AdminRoutersState>({
    list: [],
    loading: true,
    loaded: false,
  })

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    void fetchApi<{ list: AdminRouterItem[] }>('/api/admin/menu/getRouters')
      .then((res) => {
        if (cancelled) return
        if (res.success && res.data?.list) {
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
