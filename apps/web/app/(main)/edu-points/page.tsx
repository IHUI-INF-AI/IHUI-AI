// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Image from 'next/image'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Award, Gift, Loader2, Star, TrendingUp, Coins } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { BackButton } from '@/components/common'

interface Channel {
  id: string
  name: string
  code?: string | null
  description?: string | null
  sort: number
}

interface RedeemItem {
  id: string
  name: string
  points?: number | null
  pointsCost?: number | null
  image?: string | null
  cover?: string | null
  stock?: number | null
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function EduPointsPage() {
  const t = useTranslations('eduPoints')
  const tc = useTranslations('common')
  const qc = useQueryClient()

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

  const {
    data: redeemList,
    isLoading: redeemLoading,
    error: redeemListError,
  } = useQuery({
    queryKey: ['edu-points', 'redeem'],
    queryFn: () =>
      api<{ list: RedeemItem[]; balance?: number }>(`/api/points/mall/redeem`).then(
        (d) => d.list ?? [],
      ),
  })

  const [redeemMsg, setRedeemMsg] = React.useState<string | null>(null)
  const [redeemErr, setRedeemErr] = React.useState<string | null>(null)
  const redeemM = useMutation({
    mutationFn: (id: string) =>
      api<{ points: number; redeemed: number }>(
        `/api/points/mall/redeem/${encodeURIComponent(id)}`,
        {
          method: 'POST',
        },
      ),
    onSuccess: (d) => {
      setRedeemErr(null)
      setRedeemMsg(`${t('myPoints')}: ${d.points}`)
      void qc.invalidateQueries({ queryKey: ['edu-points', 'my-points'] })
      void qc.invalidateQueries({ queryKey: ['edu-points', 'redeem'] })
    },
    onError: (e: Error) => {
      setRedeemMsg(null)
      setRedeemErr(e.message || tc('loadFailed'))
    },
  })

  const goods = redeemList ?? []

  return (
    <div className="px-4 py-4 mx-auto w-full max-w-6xl space-y-4">
      <BackButton />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight min-[768px]:text-2xl">
          <Award className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* 概览卡片 */}
      <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-3">
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
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {(error as Error).message}
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
            <Award className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
            {list.map((channel) => (
              <Card key={channel.id} className="transition-colors hover:bg-accent">
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-base">{channel.name}</CardTitle>
                </CardHeader>
                <CardContent className="min-[640px]:p-3 space-y-1.5 p-3 pt-0 text-sm">
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

      {/* 积分兑换(调用方:GET/POST /api/points/mall/redeem,余额与库存以后端为准) */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{t('channelsTitle')}</h2>
        {redeemMsg && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600">
            {redeemMsg}
          </div>
        )}
        {redeemErr && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {redeemErr}
          </div>
        )}
        {redeemLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : redeemListError ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {(redeemListError as Error).message}
          </div>
        ) : goods.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
            <Gift className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
            {goods.map((item) => {
              const cost = item.pointsCost ?? item.points ?? 0
              const soldOut = item.stock !== undefined && item.stock !== null && item.stock <= 0
              const pending = redeemM.isPending && redeemM.variables === item.id
              return (
                <Card key={item.id} className="transition-colors hover:bg-accent">
                  <CardContent className="min-[640px]:p-3 flex flex-col space-y-2 p-3">
                    {item.image || item.cover ? (
                      <div className="relative aspect-square w-full overflow-hidden rounded-md">
                        <Image
                          src={item.image ?? item.cover ?? ''}
                          alt={item.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                        <Gift className="h-8 w-8" />
                      </div>
                    )}
                    <p className="line-clamp-1 text-sm font-medium">{item.name}</p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                      <span className="flex items-center gap-1 text-sm font-semibold tabular-nums text-primary">
                        <Coins className="h-4 w-4" />
                        {cost}
                      </span>
                      <Button
                        size="sm"
                        disabled={pending || soldOut}
                        onClick={() => redeemM.mutate(item.id)}
                      >
                        {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        {tc('confirm')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
