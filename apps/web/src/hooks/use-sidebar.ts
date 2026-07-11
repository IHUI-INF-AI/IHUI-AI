'use client'

import * as React from 'react'

export interface UseSidebarReturn {
  collapsed: boolean
  mobileOpen: boolean
  activeId: string | null
  toggleCollapse: () => void
  openMobile: () => void
  closeMobile: () => void
  setActive: (id: string) => void
}

/** 侧边栏状态管理 Hook，维护折叠/移动端抽屉/激活项 */
export function useSidebar(initialActive?: string): UseSidebarReturn {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [activeId, setActiveId] = React.useState<string | null>(initialActive ?? null)

  return {
    collapsed,
    mobileOpen,
    activeId,
    toggleCollapse: () => setCollapsed((c) => !c),
    openMobile: () => setMobileOpen(true),
    closeMobile: () => setMobileOpen(false),
    setActive: setActiveId,
  }
}
