'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import {
  LayoutDashboard,
  Folder,
  FileText,
  Bell,
  MessageSquare,
  Plus,
  Upload,
  ArrowRight,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, Button } from '@ihui/ui'
import { StatCard } from '@/components/dashboard/stat-card'
import { fetchApi } from '@/lib/api'
import { PageSkeleton } from '@/components/common'

interface HomeStats {
  projects: number
  files: number
  notifications: number
  conversations: number
}

async function fetchHomeStats(): Promise<HomeStats> {
  // 并发拉取 3 个已存在后端端点,任一失败即抛错走 react-query error 分支
  const [projectsRes, notifRes, convRes] = await Promise.all([
    fetchApi<{ projects: { fileCount: number }[] }>('/api/workspace/projects'),
    fetchApi<{ unread: number }>('/api/notifications?pageSize=1'),
    fetchApi<{ total: number }>('/api/chat/conversations?pageSize=1'),
  ])
  if (!projectsRes.success) throw new Error(projectsRes.error)
  if (!notifRes.success) throw new Error(notifRes.error)
  if (!convRes.success) throw new Error(convRes.error)
  const projects = projectsRes.data.projects
  return {
    projects: projects.length,
    files: projects.reduce((sum, p) => sum + (p.fileCount || 0), 0),
    notifications: notifRes.data.unread,
    conversations: convRes.data.total,
  }
}

type ActivityType = 'createdProject' | 'uploadedFile' | 'startedChat' | 'updatedProfile' | 'completedOrder'

interface Activity {
  icon: React.ComponentType<{ className?: string }>
  type: ActivityType
  params: Record<string, string>
  minutes: number
}

const ACTIVITIES: Activity[] = [
  { icon: Folder, type: 'createdProject', params: { name: 'AI 助手' }, minutes: 30 },
  { icon: FileText, type: 'uploadedFile', params: { name: 'report.pdf' }, minutes: 120 },
  { icon: MessageSquare, type: 'startedChat', params: {}, minutes: 240 },
  { icon: LayoutDashboard, type: 'updatedProfile', params: {}, minutes: 1440 },
  { icon: FileText, type: 'completedOrder', params: { name: '专业版' }, minutes: 2880 },
]

type Greeting = 'morning' | 'afternoon' | 'evening'

function getGreeting(hour: number): Greeting {
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

function relativeTime(locale: string, minutes: number): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (minutes < 60) return rtf.format(-Math.max(1, Math.round(minutes)), 'minute')
  if (minutes < 1440) return rtf.format(-Math.round(minutes / 60), 'hour')
  return rtf.format(-Math.round(minutes / 1440), 'day')
}

const QUICK_ACTIONS = [
  { href: '/workspace', icon: Plus, key: 'newProject' as const },
  { href: '/workspace', icon: Upload, key: 'uploadFile' as const },
  { href: '/chat', icon: MessageSquare, key: 'startChat' as const },
  { href: '/docs', icon: FileText, key: 'viewDocs' as const },
]

export default function HomePage() {
  const t = useTranslations('dashboard.home')
  const locale = useLocale()
  const [now, setNow] = React.useState<Date | null>(null)

  React.useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['home', 'stats'],
    queryFn: fetchHomeStats,
  })

  const timeFmt = new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const greeting = now ? t(`greeting.${getGreeting(now.getHours())}`) : ''

  const stats = [
    { title: t('stats.projects'), value: data?.projects ?? 0, icon: Folder },
    { title: t('stats.files'), value: data?.files ?? 0, icon: FileText },
    { title: t('stats.notifications'), value: data?.notifications ?? 0, icon: Bell },
    { title: t('stats.conversations'), value: data?.conversations ?? 0, icon: MessageSquare },
  ]

  if (isLoading) return <PageSkeleton />

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* 欢迎区 */}
      <section className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{greeting}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <span className="text-sm text-muted-foreground">
          {now ? timeFmt.format(now) : ''}
        </span>
      </section>

      {/* 统计卡片 */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {error ? (
          <p className="text-sm text-destructive col-span-full">
            {(error as Error).message}
          </p>
        ) : (
          stats.map((s) => (
            <StatCard
              key={s.title}
              title={s.title}
              value={s.value}
              icon={s.icon}
              loading={isLoading}
              locale={locale}
            />
          ))
        )}
      </section>

      {/* 快捷操作 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-tight text-muted-foreground">
          {t('quickActions.title')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon
            return (
              <Button
                key={a.key}
                asChild
                variant="outline"
                className="h-auto justify-start py-4"
              >
                <Link href={a.href}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-left">{t(`quickActions.${a.key}`)}</span>
                  <ArrowRight className="h-4 w-4 opacity-50" />
                </Link>
              </Button>
            )
          })}
        </div>
      </section>

      {/* 最近活动时间线 */}
      <section>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('recentActivity.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-4 border-l pl-6">
              {ACTIVITIES.map((a, i) => {
                const Icon = a.icon
                return (
                  <div key={i} className="relative">
                    <span className="absolute -left-[1.5625rem] top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full border-2 border-background bg-primary" />
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm">{t(`activities.${a.type}`, a.params)}</p>
                        <p className="text-xs text-muted-foreground">
                          {relativeTime(locale, a.minutes)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
