'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { User, UserCircle, Receipt, Link2, Settings, Activity, Shield } from 'lucide-react'

import { Card, CardContent } from '@ihui/ui'
import { Container } from '@/components/layout'

const LINKS = [
  { href: '/settings/profile', icon: User, titleKey: 'profileTitle', descKey: 'profileDesc' },
  { href: '/settings/avatar', icon: UserCircle, titleKey: 'avatarTitle', descKey: 'avatarDesc' },
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
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('dashboardTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('dashboardDesc')}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
    </Container>
  )
}
