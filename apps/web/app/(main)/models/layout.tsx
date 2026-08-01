'use client'

import { useTranslations } from 'next-intl'

import { CategoryShell, type CategoryNavGroup } from '@/components/layout'
import {
  BarChart3,
  Bot,
  FileText,
  Gift,
  Key,
  Layers,
  MessageSquare,
  Sparkles,
  Users,
} from 'lucide-react'

export default function ModelsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('models')
  const navGroups: CategoryNavGroup[] = [
    {
      label: t('navModel'),
      items: [
        { href: '/models', label: t('navOverview'), icon: Bot },
        { href: '/models/groups', label: t('navGroups'), icon: Layers },
        { href: '/models/skills', label: t('navSkills'), icon: Sparkles },
      ],
    },
    {
      label: t('navUsage'),
      items: [
        { href: '/models/chats', label: t('navChats'), icon: MessageSquare },
        { href: '/models/usage', label: t('navUsageStats'), icon: BarChart3 },
        { href: '/models/logs', label: t('navLogs'), icon: FileText },
      ],
    },
    {
      label: t('navKey'),
      items: [
        { href: '/models/keys', label: t('navApiKeys'), icon: Key },
        { href: '/models/redeem', label: t('navRedeem'), icon: Gift },
      ],
    },
    {
      label: t('navUser'),
      items: [{ href: '/models/users', label: t('navUserMgmt'), icon: Users }],
    },
  ]
  return (
    <CategoryShell title={t('shellTitle')} description={t('shellSubtitle')} navGroups={navGroups}>
      {children}
    </CategoryShell>
  )
}
