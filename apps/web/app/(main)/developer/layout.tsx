'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Terminal, Key, FileText, Users, Code } from 'lucide-react'

import { CategoryShell, type CategoryNavGroup } from '@/components/layout'

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('developer')
  const pathname = usePathname()
  // IDE 页面撑满工作区,不渲染 Shell(2026-07-31 立,用户要求)
  if (pathname === '/developer/ide') {
    return <>{children}</>
  }
  const navGroups: CategoryNavGroup[] = [
    {
      label: t('navDeveloper'),
      items: [
        { href: '/developer', label: t('navOverview'), icon: Terminal },
        { href: '/developer/keys', label: t('navApiKeys'), icon: Key },
        { href: '/developer/logs', label: t('navLogs'), icon: FileText },
        { href: '/developer/team', label: t('navTeam'), icon: Users },
      ],
    },
    {
      label: t('navTools'),
      items: [{ href: '/developer/ide', label: t('navIde'), icon: Code }],
    },
  ]
  return (
    <CategoryShell title={t('shellTitle')} description={t('shellSubtitle')} navGroups={navGroups}>
      {children}
    </CategoryShell>
  )
}
