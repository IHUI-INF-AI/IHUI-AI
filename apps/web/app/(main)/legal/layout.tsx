'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, BookOpen, FileText, Globe, Shield } from 'lucide-react'

const NAV_ITEMS: readonly { href: string; key: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { href: '/legal/terms', key: 'terms', icon: FileText },
  { href: '/legal/usage-policy', key: 'usagePolicy', icon: Shield },
  { href: '/legal/supported-regions', key: 'supportedRegions', icon: Globe },
  { href: '/legal/service-specific-terms', key: 'serviceSpecificTerms', icon: BookOpen },
]

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('legal')
  const pathname = usePathname()

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 min-[768px]:px-6 min-[768px]:py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">{t('title')}</h1>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t('backToHome')}</span>
        </Link>
      </header>
      <div className="grid grid-cols-1 gap-6 min-[768px]:grid-cols-[200px_1fr]">
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{t(`nav.${item.key}`)}</span>
              </Link>
            )
          })}
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
