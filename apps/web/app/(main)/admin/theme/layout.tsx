'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Palette,
  Plus,
  Paintbrush,
  Type,
  Moon,
  Image as ImageIcon,
  LayoutTemplate,
  Download,
  Settings,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'

const NAV_ITEMS = [
  { href: '/admin/theme', label: '主题列表', icon: Palette },
  { href: '/admin/theme/create', label: '创建主题', icon: Plus },
  { href: '/admin/theme/colors', label: '颜色方案', icon: Paintbrush },
  { href: '/admin/theme/fonts', label: '字体配置', icon: Type },
  { href: '/admin/theme/dark-mode', label: '暗色模式', icon: Moon },
  { href: '/admin/theme/assets', label: '品牌资产', icon: ImageIcon },
  { href: '/admin/theme/presets', label: '预设主题', icon: LayoutTemplate },
  { href: '/admin/theme/export', label: '导出', icon: Download },
  { href: '/admin/configs', label: '设置', icon: Settings },
] as const

export default function ThemeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [currentName, setCurrentName] = React.useState('')

  React.useEffect(() => {
    fetchApi<{ name?: string }>('/api/admin/themes/current').then((r) => {
      if (r.success && r.data?.name) setCurrentName(r.data.name)
    })
  }, [])

  const isActive = (href: string) =>
    href === '/admin/theme'
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`)

  const renderItem = (item: (typeof NAV_ITEMS)[number], mobile = false) => {
    const Icon = item.icon
    const active = isActive(item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          mobile
            ? 'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors'
            : 'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )}
      >
        <Icon className={mobile ? 'h-3.5 w-3.5' : 'h-4 w-4 shrink-0'} />
        {item.label}
      </Link>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6">
      <header className="flex items-center gap-3 rounded-lg border bg-card p-4">
        <Palette className="h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">主题管理</p>
          <p className="text-xs text-muted-foreground">当前主题: {currentName || '未设置'}</p>
        </div>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="hidden w-52 shrink-0 self-start lg:sticky lg:top-4 lg:block">
          <nav className="space-y-1">{NAV_ITEMS.map((i) => renderItem(i))}</nav>
        </aside>
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:hidden">
          {NAV_ITEMS.map((i) => renderItem(i, true))}
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
