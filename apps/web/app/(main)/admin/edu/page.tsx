'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  Users,
  UserCog,
  BookMarked,
  FolderTree,
  Award,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@ihui/ui'

interface Module {
  href: string
  title: string
  desc: string
  icon: React.ComponentType<{ className?: string }>
  gradient: string
}

const MODULES: Module[] = [
  {
    href: '/admin/edu/exam',
    title: 'examTitle',
    desc: 'examDesc',
    icon: GraduationCap,
    gradient: 'from-indigo-500 to-purple-600',
  },
  {
    href: '/admin/edu/answer',
    title: 'answerTitle',
    desc: 'answerDesc',
    icon: ClipboardCheck,
    gradient: 'from-rose-500 to-pink-600',
  },
  {
    href: '/admin/edu/learn',
    title: 'learnTitle',
    desc: 'learnDesc',
    icon: BookOpen,
    gradient: 'from-emerald-500 to-green-600',
  },
  {
    href: '/admin/edu/student',
    title: 'studentTitle',
    desc: 'studentDesc',
    icon: Users,
    gradient: 'from-teal-500 to-emerald-600',
  },
  {
    href: '/admin/edu/teacher',
    title: 'teacherTitle',
    desc: 'teacherDesc',
    icon: UserCog,
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    href: '/admin/edu/course',
    title: 'courseTitle',
    desc: 'courseDesc',
    icon: BookMarked,
    gradient: 'from-violet-500 to-fuchsia-600',
  },
  {
    href: '/admin/edu/class',
    title: 'classTitle',
    desc: 'classDesc',
    icon: FolderTree,
    gradient: 'from-teal-500 to-cyan-600',
  },
  {
    href: '/admin/edu/certificate',
    title: 'certificateTitle',
    desc: 'certificateDesc',
    icon: Award,
    gradient: 'from-yellow-500 to-amber-600',
  },
  {
    href: '/admin/edu/finance',
    title: 'financeTitle',
    desc: 'financeDesc',
    icon: Wallet,
    gradient: 'from-red-500 to-rose-600',
  },
]

export default function EduHubPage() {
  const t = useTranslations('admin.edu.index')
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => {
          const Icon = m.icon
          return (
            <Link key={m.href} href={m.href}>
              <Card className="transition-all hover:shadow-md hover:bg-accent">
                <CardContent className="flex items-start gap-4 p-5">
                  <div
                    className={cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white',
                      m.gradient,
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold">{t(m.title)}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t(m.desc)}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
