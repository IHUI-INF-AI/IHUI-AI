'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Gift, Loader2, RotateCw } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { toast } from '@/components/common/Toaster'
import { BackButton } from '@/components/common'

interface RedeemItem {
  id: string
  name: string
  points: number
  image: string | null
  pointsCost: number
  cover: string | null
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function PointsMallPage() {
  const t = useTranslations('points')
  const qc = useQueryClient()

  const mallQ = useQuery({
    queryKey: ['points', 'redeem'],
    queryFn: () => api<{ list: RedeemItem[]; total: number; balance?: number }>('/points/redeem'),
  })
  const balance = mallQ.data?.balance

  const redeemQ = useMutation({
    mutationFn: (id: string) =>
      api<{ redeemed: number }>(`/points/redeem/${id}`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(t('redeemSuccess'))
      void qc.invalidateQueries({ queryKey: ['points', 'redeem'] })
      void qc.invalidateQueries({ queryKey: ['points'] })
    },
    onError: (e: Error) => {
      toast.error(e.message || t('redeemFailed'))
    },
  })

  const list = mallQ.data?.list ?? []

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <BackButton fallbackHref="/points" />
        <h1 className="text-lg font-medium">{t('mallTitle')}</h1>
        <div className="w-10" />
      </div>

      <div className="mb-4 flex items-center justify-between rounded-md border border-border bg-card px-4 py-3">
        <span className="text-sm text-muted-foreground">{t('balance')}</span>
        <span className="text-base font-medium">
          {balance === undefined ? '—' : `${balance} ${t('pointsUnit')}`}
        </span>
      </div>

      {mallQ.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" />
          <span>{t('loading')}</span>
        </div>
      ) : mallQ.isError ? (
        <div className="rounded-md border border-border bg-card p-6 text-center">
          <p className="mb-3 text-sm text-muted-foreground">{t('loadFailed')}</p>
          <Button variant="outline" size="sm" onClick={() => void mallQ.refetch()}>
            <RotateCw className="mr-2 h-4 w-4" />
            {t('retry')}
          </Button>
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            {t('redeemEmpty')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {list.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex flex-col p-4">
                {item.image || item.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image ?? item.cover ?? ''}
                    alt={item.name}
                    className="mb-3 aspect-square w-full rounded-md object-cover"
                  />
                ) : (
                  <div className="mb-3 flex aspect-square w-full items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <Gift className="h-8 w-8" />
                  </div>
                )}
                <h3 className="mb-1 truncate text-sm font-medium">{item.name}</h3>
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <span className="text-sm font-medium">
                    {item.points} {t('pointsUnit')}
                  </span>
                  <Button
                    size="sm"
                    disabled={redeemQ.isPending && redeemQ.variables === item.id}
                    onClick={() => redeemQ.mutate(item.id)}
                  >
                    {redeemQ.isPending && redeemQ.variables === item.id ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    {t('redeemBtn')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
