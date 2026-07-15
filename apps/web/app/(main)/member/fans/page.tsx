'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { Users, Loader2, Heart } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'
import { getInitials } from '@/components/data/Avatar'

interface Fan {
  id: string
  userId: string
  nickname: string | null
  avatar: string | null
  createdAt: string | null
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function MemberFansPage() {
  const locale = useLocale()
  const t = useTranslations('member.fans')
  const [page] = React.useState(1)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['member', 'fans', page],
    queryFn: () =>
      api<{ list: Fan[]; total: number }>('/api/follows/followers?page=1&pageSize=100'),
  })

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const fmt = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Heart className="h-5 w-5 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('subtitle', { total })}</p>
      </div>

      {isError && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <Users className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((fan) => (
            <Card key={fan.id} className="transition-colors hover:bg-accent">
              <CardContent className="flex items-center gap-3 p-3">
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground',
                  )}
                >
                  {getInitials(fan.nickname)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{fan.nickname ?? t('anonymous')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('followedAt', { date: fmt(fan.createdAt) })}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
