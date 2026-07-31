'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { Terminal } from 'lucide-react'

import { useAuthStore } from '@/stores/auth'
import { Avatar } from '@/components/data/Avatar'

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)

  // IDE 页面需撑满 MainShell main 工作区,不渲染 header + 限宽容器(2026-07-31 立,用户要求)
  // IDELayout 自带 rounded-lg border border-border,在 MainShell main padding 内显示为卡片
  if (pathname === '/developer/ide') {
    return <>{children}</>
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6">
      <header className="flex items-center gap-3 rounded-lg border bg-card p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Terminal className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold">开发者中心</p>
          <p className="break-words text-xs text-muted-foreground">
            {user?.nickname ?? 'Developer'} · API 开放平台
          </p>
        </div>
        <Avatar src={user?.avatar ?? undefined} name={user?.nickname ?? 'D'} size="sm" />
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
