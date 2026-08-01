'use client'
import { useTranslations } from 'next-intl'
import { CategoryShell, type CategoryNavGroup } from '@/components/layout'
import {
  BookOpen,
  BookMarked,
  Bot,
  Code,
  Cpu,
  Database,
  Rocket,
  Server,
  Users,
  Workflow,
  Wrench,
} from 'lucide-react'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('docs')
  const navGroups: CategoryNavGroup[] = [
    {
      label: t('navDocs'),
      items: [
        { href: '/docs', label: t('navOverview'), icon: BookOpen },
        { href: '/docs/manual', label: t('navManual'), icon: BookMarked },
        { href: '/docs/quickstart', label: t('navQuickstart'), icon: Rocket },
      ],
    },
    {
      label: t('navTools'),
      items: [
        { href: '/docs/self-host', label: t('navSelfHost'), icon: Server },
        { href: '/docs/agent', label: t('navAgent'), icon: Bot },
        { href: '/docs/rag', label: t('navRag'), icon: Database },
        { href: '/docs/models', label: t('navModels'), icon: Cpu },
        { href: '/docs/mcp', label: t('navMcp'), icon: Wrench },
        { href: '/docs/workflow', label: t('navWorkflow'), icon: Workflow },
      ],
    },
    {
      label: t('navDevelopers'),
      items: [
        { href: '/docs/api', label: t('navApi'), icon: Code },
        { href: '/docs/team', label: t('navTeam'), icon: Users },
      ],
    },
  ]
  return (
    <CategoryShell title={t('shellTitle')} description={t('shellSubtitle')} navGroups={navGroups}>
      {children}
    </CategoryShell>
  )
}
