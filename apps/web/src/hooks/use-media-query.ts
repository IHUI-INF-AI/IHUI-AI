'use client'

import * as React from 'react'

/** 响应式媒体查询，SSR 安全（默认返回 false） */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

export function useIsMobile(): boolean {
  // 2026-08-01 阈值从 768px 改为 1023px:与 CSS --breakpoint-tablet-lg:1024px 对齐,
  // 让 <1024px(手机+平板竖屏)统一走移动模式(FAB/全屏/抽屉),≥1024px 走桌面三列布局。
  // 与 sidebar/ai-side-panel/web-work-panel 的 tablet-lg: 断点类一致。
  return useMediaQuery('(max-width: 1023px)')
}

export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 769px) and (max-width: 1024px)')
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1025px)')
}
