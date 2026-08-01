'use client'

import { useTranslations } from 'next-intl'
import { CategoryShell, type CategoryNavGroup } from '@/components/layout'
import { NAV_GROUPS } from './helpers'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('settings')
  const navGroups: CategoryNavGroup[] = NAV_GROUPS.map((group) => ({
    label: group.labelKey ? t(group.labelKey) : undefined,
    items: group.items.map((item) => ({
      href: item.href,
      label: t(item.labelKey),
      icon: item.icon,
    })),
  }))

  return (
    <CategoryShell title={t('title')} description={t('subtitle')} navGroups={navGroups}>
      {children}
    </CategoryShell>
  )
}
