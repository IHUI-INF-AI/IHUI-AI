/**
 * 路由埋点插件
 * @description 自动追踪页面浏览、停留时间、滚动深度
 */

import type { Router, RouteLocationNormalized } from 'vue-router'
import { analyticsUtils } from '@/composables/useAnalytics'
import { logger } from '@/utils/logger'

interface PageAnalyticsState {
  path: string
  enterTime: number
  scrollDepth: number
  scrollHandler: (() => void) | null
}

let currentPageState: PageAnalyticsState | null = null
let previousPath: string = ''
let scrollRafId: number | null = null

const trackScrollMilestone = (milestone: number, path: string) => {
  void analyticsUtils.sendEvent({
    category: 'user_engagement',
    action: 'scroll_depth',
    value: milestone,
    label: path,
  })
}

const handleScroll = () => {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    if (!currentPageState || typeof window === 'undefined' || typeof document === 'undefined') return

    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
    const currentScroll = window.scrollY
    const currentDepth = scrollHeight > 0 ? Math.round((currentScroll / scrollHeight) * 100) : 0

    const milestones = [25, 50, 75, 100]
    for (const milestone of milestones) {
      if (currentDepth >= milestone && currentPageState.scrollDepth < milestone) {
        trackScrollMilestone(milestone, currentPageState.path)
        currentPageState.scrollDepth = milestone
      }
    }
  })
}

const startPageTracking = (to: RouteLocationNormalized) => {
  if (typeof window === 'undefined') return
  
  if (currentPageState?.scrollHandler) {
    window.removeEventListener('scroll', currentPageState.scrollHandler)
  }

  currentPageState = {
    path: to.path,
    enterTime: Date.now(),
    scrollDepth: 0,
    scrollHandler: handleScroll,
  }

  window.addEventListener('scroll', handleScroll, { passive: true })
}

const endPageTracking = () => {
  if (!currentPageState) return

  if (scrollRafId !== null) {
    cancelAnimationFrame(scrollRafId)
    scrollRafId = null
  }

  const duration = Math.round((Date.now() - currentPageState.enterTime) / 1000)
  
  void analyticsUtils.sendEvent({
    category: 'user_engagement',
    action: 'page_time',
    value: duration,
    label: currentPageState.path,
    customData: {
      scrollDepth: currentPageState.scrollDepth,
    },
  })

  if (typeof window !== 'undefined' && currentPageState.scrollHandler) {
    window.removeEventListener('scroll', currentPageState.scrollHandler)
  }

  currentPageState = null
}

export const setupRouterAnalytics = (router: Router) => {
  analyticsUtils.initAnalytics()

  router.afterEach((to: RouteLocationNormalized, from: RouteLocationNormalized) => {
    if (from.path && from.path !== '/login' && from.path !== '/register') {
      endPageTracking()
    }

    if (to.path === previousPath) return
    previousPath = to.path

    const pageName = (to.meta?.title as string) || to.name?.toString() || to.path
    
    analyticsUtils.trackPageView(pageName, to.path)

    void analyticsUtils.sendEvent({
      category: 'navigation',
      action: 'route_change',
      label: to.path,
      customData: {
        from: from.path,
        to: to.path,
        routeName: to.name?.toString(),
        query: to.query ? JSON.stringify(to.query) : undefined,
      },
    })

    startPageTracking(to)
  })

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      endPageTracking()
      void analyticsUtils.flushQueue()
    })

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        endPageTracking()
        void analyticsUtils.flushQueue()
      } else if (document.visibilityState === 'visible' && currentPageState) {
        currentPageState.enterTime = Date.now()
      }
    })
  }

  logger.debug('[RouterAnalytics] Router analytics plugin initialized')
}

export default {
  install: (router: Router) => {
    setupRouterAnalytics(router)
  },
}
