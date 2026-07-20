'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Users, Plus, History } from 'lucide-react'

import { cn } from '@/lib/utils'

const TABS = [
  { href: '/publish/accounts', labelKey: 'accounts', icon: Users },
  { href: '/publish/new', labelKey: 'new', icon: Plus },
  { href: '/publish/history', labelKey: 'history', icon: History },
] as const

export default function PublishLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('publish')
  const pathname = usePathname()

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>
      <nav className="flex items-center gap-1 border-b border-border/60">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href)
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors',
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{t(`tabs.${tab.labelKey}`)}</span>
            </Link>
          )
        })}
      </nav>
      {children}
    </div>
  )
}
