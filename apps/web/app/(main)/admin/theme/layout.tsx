'use client'

import * as React from 'react'
import { Palette } from 'lucide-react'
import { fetchApi } from '@/lib/api'

export default function ThemeLayout({ children }: { children: React.ReactNode }) {
  const [currentName, setCurrentName] = React.useState('')

  React.useEffect(() => {
    fetchApi<{ name?: string }>('/api/admin/themes/current').then((r) => {
      if (r.success && r.data?.name) setCurrentName(r.data.name)
    })
  }, [])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6">
      <header className="flex items-center gap-3 rounded-lg border bg-card p-4">
        <Palette className="h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">主题管理</p>
          <p className="text-xs text-muted-foreground">当前主题: {currentName || '未设置'}</p>
        </div>
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
