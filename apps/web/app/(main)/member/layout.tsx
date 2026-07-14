'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingBag,
  Award,
  Coins,
  Ticket,
  CreditCard,
  RotateCcw,
  MapPin,
  Heart,
  History,
  Users,
  MessageSquare,
  HelpCircle,
  Settings,
  ArrowUp,
  User,
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
  { href: '/member/dashboard', label: '会员仪表板', icon: LayoutDashboard },
  { href: '/member/orders', label: '我的订单', icon: ShoppingBag },
  { href: '/member/benefits', label: '会员权益', icon: Award },
  { href: '/member/points', label: '积分中心', icon: Coins },
  { href: '/member/coupons', label: '优惠券', icon: Ticket },
  { href: '/member/subscription', label: '订阅管理', icon: CreditCard },
  { href: '/member/refunds', label: '退款记录', icon: RotateCcw },
  { href: '/member/addresses', label: '收货地址', icon: MapPin },
  { href: '/member/favorites', label: '收藏夹', icon: Heart },
  { href: '/member/history', label: '浏览历史', icon: History },
  { href: '/member/invitations', label: '邀请记录', icon: Users },
  { href: '/member/feedback', label: '意见反馈', icon: MessageSquare },
  { href: '/member/help', label: '帮助中心', icon: HelpCircle },
  { href: '/member/settings', label: '会员设置', icon: Settings },
  { href: '/member/upgrade', label: '会员升级', icon: ArrowUp },
]

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  const renderNavItem = (item: NavItem, active: boolean) => {
    const Icon = item.icon
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
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
        <Avatar src={user?.avatar ?? undefined} name={user?.nickname ?? 'U'} size="md" />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold">{user?.nickname ?? '会员'}</p>
          <p className="break-words text-xs text-muted-foreground">
            {user?.phone ?? user?.id ?? '-'}
          </p>
        </div>
        <Link
          href="/member/upgrade"
          className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
        >
          <User className="h-3.5 w-3.5" />
          升级会员
        </Link>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="hidden w-52 shrink-0 self-start lg:sticky lg:top-4 lg:block">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => renderNavItem(item, isActive(item.href)))}
          </nav>
        </aside>

        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:hidden">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
