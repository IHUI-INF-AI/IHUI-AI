'use client'

import * as React from 'react'

import { useScrollPosition } from '@/hooks/use-scroll-position'

export interface HomeNavItem {
  key: string
  label: string
  href: string
}

export interface UseHomeNavigationReturn {
  items: HomeNavItem[]
  activeKey: string
  scrolled: boolean
  scrollToSection: (key: string) => void
}

const DEFAULT_ITEMS: HomeNavItem[] = [
  { key: 'hero', label: '首页', href: '#hero' },
  { key: 'features', label: '功能', href: '#features' },
  { key: 'pricing', label: '定价', href: '#pricing' },
  { key: 'about', label: '关于', href: '#about' },
]

/** 首页导航 Hook，管理导航高亮与滚动吸顶状态 */
export function useHomeNavigation(items: HomeNavItem[] = DEFAULT_ITEMS): UseHomeNavigationReturn {
  const [activeKey, setActiveKey] = React.useState(items[0]?.key ?? '')
  const { y } = useScrollPosition()
  const scrolled = y > 20

  const scrollToSection = React.useCallback((key: string) => {
    setActiveKey(key)
    if (typeof document === 'undefined') return
    const el = document.getElementById(key)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  return { items, activeKey, scrolled, scrollToSection }
}
