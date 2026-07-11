'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { User, Shield, Bell, ShoppingBag, CreditCard, BadgeCheck } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { Avatar } from '@/components/data/Avatar'

interface UserNavItem {
  href: string
  labelKey: 'profile' | 'security' | 'notifications' | 'orders' | 'realname' | 'subscription'
  icon: React.ComponentType<{ className?: string }>
}

const USER_NAV: UserNavItem[] = [
  { href: '/user/profile', labelKey: 'profile', icon: User },
  { href: '/user/security', labelKey: 'security', icon: Shield },
  { href: '/user/notifications', labelKey: 'notifications', icon: Bell },
  { href: '/user/orders', labelKey: 'orders', icon: ShoppingBag },
  { href: '/user/realname', labelKey: 'realname', icon: BadgeCheck },
  { href: '/user/subscription', labelKey: 'subscription', icon: CreditCard },
]

export function UserNav({ children }: { children: React.ReactNode }) {
  const t = useTranslations('user')
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)

  const isActive = (href: string) => pathname === href

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

      <nav className="flex flex-wrap gap-1 border-b pb-2 lg:hidden">
        {USER_NAV.map((item) => renderItem(item, isActive(item.href), true))}
      </nav>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export default UserNav
