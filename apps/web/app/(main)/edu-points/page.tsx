'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Award, Loader2, Star, TrendingUp, Coins } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

interface Channel {
  id: string
  name: string
  code?: string | null
  description?: string | null
  sort: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function EduPointsPage() {
  const t = useTranslations('eduPoints')

  const {
    data: channels,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['edu-points', 'channels'],
    queryFn: () => api<{ list: Channel[] }>(`/api/edu-points/channels`).then((d) => d.list ?? []),
  })

  const { data: myPoints } = useQuery({
    queryKey: ['edu-points', 'my-points'],
    queryFn: () => api<{ points: number }>(`/api/edu-points/my-points`).then((d) => d.points ?? 0),
  })

  const list = channels ?? []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Award className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* 概览卡片 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalChannels')}</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{list.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('activeChannels')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{list.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('myPoints')}</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myPoints ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* 渠道列表 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{t('channelsTitle')}</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {(error as Error).message}
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
            <Award className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((channel) => (
              <Card key={channel.id} className="transition-colors hover:bg-accent">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{channel.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 p-4 pt-0 text-sm">
                  {channel.code && <p className="text-xs text-muted-foreground">{channel.code}</p>}
                  {channel.description && (
                    <p className="text-muted-foreground">{channel.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
