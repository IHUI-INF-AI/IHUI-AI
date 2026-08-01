'use client'

import { useTranslations } from 'next-intl'
import {
  User,
  ShieldCheck,
  Lock,
  FileText,
  HelpCircle,
  MessageSquare,
  Users,
  UserCheck,
  UserPlus,
  ClipboardList,
  FileQuestion,
  Download,
} from 'lucide-react'
import { CategoryShell, type CategoryNavGroup } from '@/components/layout'

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('user')
  const navGroups: CategoryNavGroup[] = [
    {
      label: t('navAccount'),
      items: [
        { href: '/user/profile', label: t('navProfile'), icon: User },
        { href: '/user/realname', label: t('navRealname'), icon: ShieldCheck },
        { href: '/user/security', label: t('navSecurity'), icon: Lock },
      ],
    },
    {
      label: t('navContent'),
      items: [
        { href: '/user/articles', label: t('navArticles'), icon: FileText },
        { href: '/user/ask', label: t('navAsk'), icon: HelpCircle },
        { href: '/user/comment', label: t('navComment'), icon: MessageSquare },
        { href: '/user/circle', label: t('navCircle'), icon: Users },
      ],
    },
    {
      label: t('navInteraction'),
      items: [
        { href: '/user/fans', label: t('navFans'), icon: UserCheck },
        { href: '/user/follow', label: t('navFollow'), icon: UserPlus },
        { href: '/user/sign-up', label: t('navSignUp'), icon: ClipboardList },
      ],
    },
    {
      label: t('navLearning'),
      items: [
        { href: '/user/exam', label: t('navExam'), icon: FileQuestion },
        { href: '/user/resource', label: t('navResource'), icon: Download },
      ],
    },
  ]

  return (
    <CategoryShell title={t('title')} description={t('subtitle')} navGroups={navGroups}>
      {children}
    </CategoryShell>
  )
}
