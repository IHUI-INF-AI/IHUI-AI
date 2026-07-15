'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Calendar, Gift, Sparkles, Clock, ArrowRight, UserPlus } from 'lucide-react'
import Image from 'next/image'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

type Status = 'upcoming' | 'active' | 'ended'

interface Activity {
  id: string
  slug: string
  title: string
  description: string | null
  banner?: string
  startAt: string
  endAt: string
  status: string
}

const STATUS_STYLE: Record<Status, string> = {
  upcoming: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  ended: 'bg-muted text-muted-foreground',
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function ActivitiesPage() {
  const t = useTranslations('activities')
  const locale = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: ['activities'],
    queryFn: () => api<{ list: Activity[] }>('/api/activities').then((d) => d.list ?? []),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const fmt = (v?: string) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  // 根据时间计算展示态：upcoming（未开始）/ active（进行中）/ ended（已结束）
  const computeStatus = (startAt: string, endAt: string): Status => {
    const now = Date.now()
    const start = new Date(startAt).getTime()
    const end = new Date(endAt).getTime()
    if (now < start) return 'upcoming'
    if (now > end) return 'ended'
    return 'active'
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Gift className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Link
          href="/invitations"
          className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <UserPlus className="h-4 w-4" />
          {t('invitationsLink')}
        </Link>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((a) => {
            const displayStatus = computeStatus(a.startAt, a.endAt)
            return (
              <Card
                key={a.id}
                className="group flex flex-col overflow-hidden transition-colors hover:bg-accent"
              >
                {a.banner ? (
                  <div className="relative h-36 w-full">
                    <Image src={a.banner} alt={a.title} fill className="object-cover" />
                  </div>
                ) : (
                  <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                    <Sparkles className="h-10 w-10 text-primary/40" />
                  </div>
                )}
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold">{a.title}</h2>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_STYLE[displayStatus],
                      )}
                    >
                      {t(`status.${displayStatus}`)}
                    </span>
                  </div>
                  <p className="flex-1 text-sm text-muted-foreground">{a.description ?? ''}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {fmt(a.startAt)} - {fmt(a.endAt)}
                    </span>
                  </div>
                  <Link href={`/activities/${a.slug}`} className="block">
                    <Button variant="outline" size="sm" className="w-full">
                      <Calendar className="h-4 w-4" />
                      {t('viewDetail')}
                      <ArrowRight className="ml-auto h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <Gift className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      )}
    </div>
  )
}
