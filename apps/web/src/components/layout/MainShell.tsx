'use client'

import * as React from 'react'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { PWAInstallPrompt, PWAUpdatePrompt } from '@/components/common'

export function MainShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <div className="flex min-h-screen">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main id="main" className="flex-1 p-4 md:p-6 lg:p-8">
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
