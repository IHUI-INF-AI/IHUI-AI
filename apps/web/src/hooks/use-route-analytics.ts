'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'

import { useAnalytics } from '@/hooks/use-analytics'

// ============================================================================
// 类型定义
// ============================================================================

export interface UseRouteAnalyticsReturn {
  /** 当前路由路径(已弃用,保留兼容;新代码不要消费) */
  currentPath?: string
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
 *
 * 性能修复(2026-07-25):原返回 currentPath 让调用方订阅 usePathname 触发重渲染,
 * 现改为纯副作用 hook(usePathname 订阅仍存在但只在 useEffect 内消费,不返回到渲染流),
 * 调用方 GlobalHooksProvider 不再因路由变化重渲染。
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

  // 不再返回 currentPath,避免调用方订阅 usePathname 触发重渲染
  return {}
}
