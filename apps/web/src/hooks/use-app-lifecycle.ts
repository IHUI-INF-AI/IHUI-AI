'use client'

import * as React from 'react'

export type AppLifecycle = 'loading' | 'mounted' | 'hidden' | 'visible'

export interface UseAppLifecycleReturn {
  lifecycle: AppLifecycle
  isMounted: boolean
  isOnline: boolean
  visibility: DocumentVisibilityState | null
}

/** 应用生命周期 Hook，跟踪挂载态、网络状态与页面可见性 */
export function useAppLifecycle(): UseAppLifecycleReturn {
  const [isMounted, setIsMounted] = React.useState(false)
  const [isOnline, setIsOnline] = React.useState(true)
  const [visibility, setVisibility] = React.useState<DocumentVisibilityState | null>(null)

  React.useEffect(() => {
    setIsMounted(true)
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine)
    }
    if (typeof document !== 'undefined') {
      setVisibility(document.visibilityState)
    }

    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    const onVisibility = () => setVisibility(document.visibilityState)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const lifecycle: AppLifecycle = React.useMemo(() => {
    if (!isMounted) return 'loading'
    if (visibility === 'hidden') return 'hidden'
    return 'visible'
  }, [isMounted, visibility])

  return { lifecycle, isMounted, isOnline, visibility }
}
