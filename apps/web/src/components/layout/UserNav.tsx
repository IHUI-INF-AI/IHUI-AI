'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  User,
  Shield,
  Bell,
  ShoppingBag,
  CreditCard,
  BadgeCheck,
  BookOpen,
  MessageSquare,
  Users,
  UserPlus,
  HelpCircle,
  Circle as CircleIcon,
  FolderOpen,
  Coins,
  FileCheck,
  ClipboardList,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { Avatar } from '@/components/data/Avatar'
import { TabBar, type Tab } from './TabBar'

interface UserNavItem {
  href: string
  labelKey:
    | 'profile'
    | 'security'
    | 'notifications'
    | 'orders'
    | 'realname'
    | 'subscription'
    | 'learn-record'
    | 'comment'
    | 'fans'
    | 'follow'
    | 'ask'
    | 'circle'
    | 'resource'
    | 'point'
    | 'exam'
    | 'sign-up'
  icon: React.ComponentType<{ className?: string }>
}

const USER_NAV: UserNavItem[] = [
  { href: '/user/profile', labelKey: 'profile', icon: User },
  { href: '/user/security', labelKey: 'security', icon: Shield },
  { href: '/user/notifications', labelKey: 'notifications', icon: Bell },
  { href: '/user/orders', labelKey: 'orders', icon: ShoppingBag },
  { href: '/user/realname', labelKey: 'realname', icon: BadgeCheck },
  { href: '/user/subscription', labelKey: 'subscription', icon: CreditCard },
  { href: '/user/learn-record', labelKey: 'learn-record', icon: BookOpen },
  { href: '/user/comment', labelKey: 'comment', icon: MessageSquare },
  { href: '/user/fans', labelKey: 'fans', icon: Users },
  { href: '/user/follow', labelKey: 'follow', icon: UserPlus },
  { href: '/user/ask', labelKey: 'ask', icon: HelpCircle },
  { href: '/user/circle', labelKey: 'circle', icon: CircleIcon },
  { href: '/user/resource', labelKey: 'resource', icon: FolderOpen },
  { href: '/user/point', labelKey: 'point', icon: Coins },
  { href: '/user/exam', labelKey: 'exam', icon: FileCheck },
  { href: '/user/sign-up', labelKey: 'sign-up', icon: ClipboardList },
]

export function UserNav({ children }: { children: React.ReactNode }) {
  const t = useTranslations('user')
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)

  const isActive = (href: string) => pathname === href

  const mobileTabs: Tab[] = USER_NAV.map((item) => ({
    key: item.href,
    label: t(`nav.${item.labelKey}`),
  }))

  const renderItem = (item: UserNavItem, active: boolean, compact = false) => {
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
        <div className="mb-4 flex items-center gap-3 rounded-lg border bg-card p-3">
          <Avatar src={user?.avatar ?? undefined} name={user?.nickname ?? 'U'} size="md" />
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold">{user?.nickname ?? t('guest')}</p>
            <p className="break-words text-xs text-muted-foreground">{user?.phone ?? '-'}</p>
          </div>
        </div>
        <nav className="space-y-1">
          {USER_NAV.map((item) => renderItem(item, isActive(item.href)))}
        </nav>
      </aside>

      <div className="lg:hidden">
        <TabBar tabs={mobileTabs} activeTab={pathname} onChange={(key) => router.push(key)} />
      </div>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export default UserNav
