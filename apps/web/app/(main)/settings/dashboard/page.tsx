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
    <Container maxWidth="md" padding={false} className="space-y-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{t('dashboardTitle')}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('dashboardDesc')}</p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}>
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-start gap-2 p-3">
                  <div className="rounded-md bg-muted p-1.5">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium">{t(item.titleKey)}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{t(item.descKey)}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </Container>
  )
}
