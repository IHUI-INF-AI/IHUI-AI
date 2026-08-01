'use client'
import { useTranslations } from 'next-intl'
import { CategoryShell, type CategoryNavGroup } from '@/components/layout'
import { BookOpen, Bot, Code, Wrench, Database, Server } from 'lucide-react'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('docs')
  const navGroups: CategoryNavGroup[] = [
    {
      label: t('navDocs'),
      items: [
        { href: '/docs', label: t('navOverview'), icon: BookOpen },
        { href: '/docs/agent', label: t('navAgent'), icon: Bot },
        { href: '/docs/api', label: t('navApi'), icon: Code },
      ],
    },
    {
      label: t('navTools'),
      items: [
        { href: '/docs/mcp', label: t('navMcp'), icon: Wrench },
        { href: '/docs/rag', label: t('navRag'), icon: Database },
        { href: '/docs/self-host', label: t('navSelfHost'), icon: Server },
      ],
    },
  ]
  return (
    <CategoryShell title={t('shellTitle')} description={t('shellSubtitle')} navGroups={navGroups}>
      {children}
    </CategoryShell>
  )
}
