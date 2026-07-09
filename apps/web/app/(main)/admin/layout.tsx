'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  Users,
  FolderCog,
  Settings,
  ShoppingCart,
  ShieldCheck,
  Shield,
  Lock,
  Workflow,
  Tag,
  MessageSquare,
  Megaphone,
  FileText,
  HelpCircle,
  SlidersHorizontal,
  Plug,
  ScrollText,
  Activity,
  GraduationCap,
  BookOpen,
  UserCheck,
  Package,
  Radio,
  Newspaper,
  Award,
  Coins,
} from 'lucide-react'

import { cn } from '@/lib/utils'

interface AdminNavItem {
  href: string
  labelKey:
    | 'dashboard'
    | 'users'
    | 'projects'
    | 'settings'
    | 'orders'
    | 'roles'
    | 'permissions'
    | 'workflows'
    | 'tags'
    | 'feedbacks'
    | 'announcements'
    | 'docs'
    | 'help'
    | 'configs'
    | 'integrations'
    | 'logs'
    | 'events'
    | 'exam'
    | 'learn'
    | 'members'
    | 'resources'
    | 'live'
    | 'news'
    | 'certificate'
    | 'point'
  icon: React.ComponentType<{ className?: string }>
}

const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/admin/users', labelKey: 'users', icon: Users },
  { href: '/admin/members', labelKey: 'members', icon: UserCheck },
  { href: '/admin/projects', labelKey: 'projects', icon: FolderCog },
  { href: '/admin/orders', labelKey: 'orders', icon: ShoppingCart },
  { href: '/admin/exam', labelKey: 'exam', icon: GraduationCap },
  { href: '/admin/learn', labelKey: 'learn', icon: BookOpen },
  { href: '/admin/resources', labelKey: 'resources', icon: Package },
  { href: '/admin/live', labelKey: 'live', icon: Radio },
  { href: '/admin/point', labelKey: 'point', icon: Coins },
  { href: '/admin/news', labelKey: 'news', icon: Newspaper },
  { href: '/admin/certificate', labelKey: 'certificate', icon: Award },
  { href: '/admin/feedbacks', labelKey: 'feedbacks', icon: MessageSquare },
  { href: '/admin/announcements', labelKey: 'announcements', icon: Megaphone },
  { href: '/admin/docs', labelKey: 'docs', icon: FileText },
  { href: '/admin/help', labelKey: 'help', icon: HelpCircle },
  { href: '/admin/roles', labelKey: 'roles', icon: Shield },
  { href: '/admin/permissions', labelKey: 'permissions', icon: Lock },
  { href: '/admin/workflows', labelKey: 'workflows', icon: Workflow },
  { href: '/admin/tags', labelKey: 'tags', icon: Tag },
  { href: '/admin/configs', labelKey: 'configs', icon: SlidersHorizontal },
  { href: '/admin/integrations', labelKey: 'integrations', icon: Plug },
  { href: '/admin/logs', labelKey: 'logs', icon: ScrollText },
  { href: '/admin/events', labelKey: 'events', icon: Activity },
  { href: '/admin/settings', labelKey: 'settings', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin')
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  const renderItem = (item: AdminNavItem, active: boolean, compact = false) => {
    const Icon = item.icon
    return (
      <Link
        key={item.href}
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
        <span>{t(`nav.${item.labelKey}`)}</span>
      </Link>
    )
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="hidden w-52 shrink-0 self-start lg:sticky lg:top-4 lg:block">
        <div className="mb-4 flex items-center gap-2 px-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="text-base font-semibold tracking-tight">{t('title')}</span>
        </div>
        <nav className="space-y-1">
          {ADMIN_NAV.map((item) => renderItem(item, isActive(item.href)))}
        </nav>
      </aside>

      <nav className="flex flex-wrap gap-1 border-b pb-2 lg:hidden">
        {ADMIN_NAV.map((item) => renderItem(item, isActive(item.href), true))}
      </nav>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
