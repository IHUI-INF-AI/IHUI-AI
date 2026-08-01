'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { User, Receipt, Link2, Settings, Activity, Shield } from 'lucide-react'

import { Card, CardContent } from '@ihui/ui-react'
import { Container } from '@/components/layout'

const LINKS = [
  { href: '/user/profile', icon: User, titleKey: 'profileTitle', descKey: 'profileDesc' },
  { href: '/settings/billing', icon: Receipt, titleKey: 'billingTitle', descKey: 'billingDesc' },
  {
    href: '/settings/connected-accounts',
    icon: Link2,
    titleKey: 'connectedAccountsTitle',
    descKey: 'connectedAccountsDesc',
  },
  {
    href: '/settings/preferences',
    icon: Settings,
    titleKey: 'preferencesTitle',
    descKey: 'preferencesDesc',
  },
  {
    href: '/settings/activity',
    icon: Activity,
    titleKey: 'activityTitle',
    descKey: 'activityDesc',
  },
  { href: '/settings/security', icon: Shield, titleKey: 'securityTitle', descKey: 'securityDesc' },
] as const

export default function DashboardPage() {
  const t = useTranslations('settings')

  return (
    <Container maxWidth="full" padding={false} className="flex h-full flex-col px-4 py-3">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">{t('dashboardTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('dashboardDesc')}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
          {LINKS.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}>
                <Card className="transition-colors hover:bg-accent">
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="rounded-lg bg-muted p-2">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t(item.titleKey)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t(item.descKey)}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </Container>
  )
}
