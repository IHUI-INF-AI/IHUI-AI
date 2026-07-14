'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Code,
  Key,
  BarChart,
  Webhook,
  Download,
  FlaskConical,
  Gauge,
  FileText,
  GitBranch,
  CreditCard,
  Bell,
  Users,
  Receipt,
  Settings,
  Terminal,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { Avatar } from '@/components/data/Avatar'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { href: '/developer/api-docs', label: 'API 文档', icon: Code },
  { href: '/developer/keys', label: '密钥', icon: Key },
  { href: '/developer', label: '统计', icon: BarChart },
  { href: '/developer/webhooks', label: 'Webhook', icon: Webhook },
  { href: '/developer/api-docs', label: 'SDK', icon: Download },
  { href: '/developer/sandbox', label: '沙箱', icon: FlaskConical },
  { href: '/developer/limits', label: '限额', icon: Gauge },
  { href: '/developer/logs', label: '日志', icon: FileText },
  { href: '/developer/versions', label: '版本', icon: GitBranch },
  { href: '/developer/subscription', label: '订阅', icon: CreditCard },
  { href: '/developer/notifications', label: '通知', icon: Bell },
  { href: '/developer/team', label: '团队', icon: Users },
  { href: '/developer/billing', label: '账单', icon: Receipt },
  { href: '/developer/settings', label: '设置', icon: Settings },
]

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)

  const isActive = (href: string) =>
    href === '/developer' ? pathname === '/developer' : pathname.startsWith(href)

  const renderItem = (item: NavItem, active: boolean, compact = false) => {
    const Icon = item.icon
    return (
      <Link
        key={item.label}
        href={item.href}
        className={cn(
          'flex items-center gap-2.5 rounded-md font-medium transition-colors',
          compact ? 'px-3 py-1.5 text-xs' : 'px-3 py-2 text-sm',
          active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{item.label}</span>
      </Link>
    )
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

      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="hidden w-52 shrink-0 self-start lg:sticky lg:top-4 lg:block">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => renderItem(item, isActive(item.href)))}
          </nav>
        </aside>

        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:hidden">
          {NAV_ITEMS.map((item) => renderItem(item, isActive(item.href), true))}
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
