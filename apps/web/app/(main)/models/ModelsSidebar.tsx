'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  BarChart3,
  BookOpen,
  Bot,
  Cable,
  FileText,
  Gift,
  Key,
  LayoutDashboard,
  MessageCircle,
  MessagesSquare,
  Rocket,
  Sparkles,
  Ticket,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react'

import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  labelKey: string
  icon: typeof Bot
  exact?: boolean
}

interface NavGroup {
  labelKey: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'nav.groups.main',
    items: [
      { href: '/models/overview', labelKey: 'nav.overview', icon: LayoutDashboard },
      { href: '/models', labelKey: 'nav.market', icon: Bot, exact: true },
      { href: '/models/channels', labelKey: 'nav.channels', icon: Cable },
      { href: '/models/keys', labelKey: 'nav.keys', icon: Key },
      { href: '/models/logs', labelKey: 'nav.logs', icon: FileText },
    ],
  },
  {
    labelKey: 'nav.groups.business',
    items: [
      { href: '/models/chats', labelKey: 'nav.chats', icon: MessagesSquare },
      { href: '/models/users', labelKey: 'nav.users', icon: Users },
      { href: '/models/groups', labelKey: 'nav.groupsMgmt', icon: UsersRound },
    ],
  },
  {
    labelKey: 'nav.groups.finance',
    items: [
      { href: '/models/usage', labelKey: 'nav.usage', icon: BarChart3 },
      { href: '/models/billing', labelKey: 'nav.billing', icon: Wallet },
      { href: '/models/redeem', labelKey: 'nav.redeem', icon: Ticket },
      { href: '/models/referral', labelKey: 'nav.referral', icon: Gift },
    ],
  },
  {
    labelKey: 'nav.groups.resources',
    items: [
      { href: '/models/openclaw', labelKey: 'nav.openclaw', icon: Rocket },
      { href: '/models/api-docs', labelKey: 'nav.apiDocs', icon: BookOpen },
      { href: '/models/skills', labelKey: 'nav.skills', icon: Sparkles },
      { href: '/models/contact', labelKey: 'nav.contact', icon: MessageCircle },
    ],
  },
]

export function ModelsSidebar() {
  const pathname = usePathname()
  const t = useTranslations('models')

  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 border-r border-border/40 bg-sidebar/40 backdrop-blur-sm md:block">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">{t('title')}</span>
            <span className="text-[11px] leading-tight text-muted-foreground">
              {t('nav.subtitle')}
            </span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-1">
          {NAV_GROUPS.map((group) => (
            <div key={group.labelKey} className="mb-3">
              <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {t(group.labelKey)}
              </div>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(item.href + '/')
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-sidebar-active text-sidebar-foreground'
                          : 'text-muted-foreground hover:bg-sidebar-hover hover:text-sidebar-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t(item.labelKey)}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  )
}
