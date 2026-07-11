'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'

import { useAnalytics } from '@/hooks/use-analytics'

// ============================================================================
// 常量
// ============================================================================

/** 滚动深度里程碑（百分比） */
const MILESTONES = [25, 50, 75, 100] as const

// ============================================================================
// 类型定义
// ============================================================================

export interface UseScrollDepthReturn {
  /** 当前滚动深度（0-100） */
  scrollDepth: number
  /** 已达到的里程碑列表 */
  reachedMilestones: number[]
  /** 手动上报滚动深度 */
  trackScrollDepth: (milestone: number) => void
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 滚动深度追踪 Hook
 *
 * - 追踪 25/50/75/100 四个里程碑
 * - 每个里程碑仅触发一次（路由变化后重置）
 * - 使用 requestAnimationFrame 节流
 *
 * 用法：
 *   const { scrollDepth, reachedMilestones } = useScrollDepth()
 */
export function useScrollDepth(): UseScrollDepthReturn {
  const pathname = usePathname()
  const { track } = useAnalytics()

  const [scrollDepth, setScrollDepth] = React.useState(0)
  const [reachedMilestones, setReachedMilestones] = React.useState<number[]>([])

  const reachedRef = React.useRef<Set<number>>(new Set())
  const rafRef = React.useRef<number | null>(null)
  const trackRef = React.useRef(track)
  trackRef.current = track
  const pathRef = React.useRef(pathname ?? '/')
  pathRef.current = pathname ?? '/'

  /** 上报滚动深度里程碑 */
  const trackScrollDepth = React.useCallback((milestone: number) => {
    trackRef.current({
      name: 'scroll_depth',
      category: 'user_engagement',
      value: milestone,
      label: pathRef.current,
    })
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const handleScroll = () => {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null

        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
        const currentScroll = window.scrollY
        const depth = scrollHeight > 0 ? Math.round((currentScroll / scrollHeight) * 100) : 0

        setScrollDepth(depth)

        for (const milestone of MILESTONES) {
          if (depth >= milestone && !reachedRef.current.has(milestone)) {
            reachedRef.current.add(milestone)
            setReachedMilestones((prev) => [...prev, milestone])
            trackScrollDepth(milestone)
          }
        }
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [trackScrollDepth])

  // 路由变化时重置里程碑
  React.useEffect(() => {
    reachedRef.current.clear()
    setReachedMilestones([])
    setScrollDepth(0)
  }, [pathname])

  return { scrollDepth, reachedMilestones, trackScrollDepth }
}
