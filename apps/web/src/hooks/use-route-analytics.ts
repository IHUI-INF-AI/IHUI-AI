'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'

import { useAnalytics } from '@/hooks/use-analytics'

// ============================================================================
// 类型定义
// ============================================================================

export interface UseRouteAnalyticsReturn {
  /** 当前路由路径 */
  currentPath: string
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 路由埋点 Hook
 *
 * - 路由变化时自动调用 trackPageView
 * - 记录上一页停留时间并上报 page_time 事件
 * - 上报 route_change 事件
 * - beforeunload 时 flush 缓冲区
 *
 * 用法：在根 Layout 组件中调用一次即可。
 *   useRouteAnalytics()
 */
export function useRouteAnalytics(): UseRouteAnalyticsReturn {
  const pathname = usePathname()
  const { track, trackPageView, flush } = useAnalytics()

  const enterTimeRef = React.useRef<number>(Date.now())
  const prevPathRef = React.useRef<string>('')

  // 路由变化追踪
  React.useEffect(() => {
    const path = pathname ?? '/'
    if (!path) return

    // 结束上一页停留时间追踪
    if (prevPathRef.current && prevPathRef.current !== path) {
      const duration = Math.round((Date.now() - enterTimeRef.current) / 1000)
      track({
        name: 'page_time',
        category: 'user_engagement',
        value: duration,
        label: prevPathRef.current,
      })
    }

    // 页面浏览
    trackPageView(path)

    // 路由切换事件
    track({
      name: 'route_change',
      category: 'navigation',
      label: path,
      props: {
        from: prevPathRef.current,
        to: path,
      },
    })

    prevPathRef.current = path
    enterTimeRef.current = Date.now()
  }, [pathname, track, trackPageView])

  // beforeunload flush
  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const handleBeforeUnload = () => {
      // 上报当前页停留时间
      if (prevPathRef.current) {
        const duration = Math.round((Date.now() - enterTimeRef.current) / 1000)
        track({
          name: 'page_time',
          category: 'user_engagement',
          value: duration,
          label: prevPathRef.current,
        })
      }
      void flush()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [track, flush])

  return { currentPath: pathname ?? '/' }
}
