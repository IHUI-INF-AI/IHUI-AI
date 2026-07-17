'use client'

import * as React from 'react'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { AISidePanel } from '@/components/ai/ai-side-panel'
import { PWAInstallPrompt, PWAUpdatePrompt } from '@/components/common'
import { TagsView } from '@/components/layout/TagsView'
import { useAuthStore } from '@/stores/auth'

export function MainShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const sidebarId = React.useId()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-collapsed')
      if (saved === 'true') setCollapsed(true)
    } catch {
      // localStorage 不可用
    }
  }, [])

  React.useEffect(() => {
    try {
      localStorage.setItem('sidebar-collapsed', String(collapsed))
    } catch {
      // localStorage 不可用
    }
  }, [collapsed])

  React.useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        id={sidebarId}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <React.Suspense fallback={null}>
        <AISidePanel />
      </React.Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setMobileOpen((o) => !o)} />
        {isAuthenticated && (
          <React.Suspense fallback={null}>
            <TagsView />
          </React.Suspense>
        )}
        <main
          id="main"
          tabIndex={-1}
          className="thin-scroll flex-1 overflow-y-auto p-4 md:p-6 lg:p-8"
        >
          {children}
        </main>
      </div>
      {/* PWA 提示:固定悬浮于右下角,不影响主布局 */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        <div className="pointer-events-auto">
          <PWAInstallPrompt />
        </div>
        <div className="pointer-events-auto">
          <PWAUpdatePrompt onUpdate={() => window.location.reload()} />
        </div>
      </div>
    </div>
  )
}

export default MainShell
