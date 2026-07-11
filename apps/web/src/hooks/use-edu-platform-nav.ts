'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { fetchApi } from '@/lib/api'

export interface EduNavItem {
  id: string
  label: string
  href: string
  icon?: string
  badge?: number
  children?: EduNavItem[]
}

export interface UseEduPlatformNavReturn {
  navItems: EduNavItem[]
  activePath: string | null
  loading: boolean
  expandedIds: string[]
  toggleExpand: (id: string) => void
  navigate: (href: string) => void
  fetchNav: () => Promise<void>
}

/** 教育平台导航 Hook，维护左侧导航树与展开状态 */
export function useEduPlatformNav(): UseEduPlatformNavReturn {
  const router = useRouter()
  const [navItems, setNavItems] = React.useState<EduNavItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [activePath, setActivePath] = React.useState<string | null>(null)
  const [expandedIds, setExpandedIds] = React.useState<string[]>([])

  const fetchNav = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApi<EduNavItem[]>('/api/edu/nav')
      if (res.success) setNavItems(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  const toggleExpand = React.useCallback((id: string) => {
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const navigate = React.useCallback(
    (href: string) => {
      setActivePath(href)
      router.push(href)
    },
    [router],
  )

  return { navItems, activePath, loading, expandedIds, toggleExpand, navigate, fetchNav }
}
