'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Coins } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'

interface PointSummary {
  points?: number
  totalEarned?: number
  totalSpent?: number
}

interface PointRecord {
  id: string
  amount: number
  type?: string
  source?: string
  description?: string | null
  balanceAfter?: number
  createdAt?: string
}

interface PointRecordsResponse {
  list?: PointRecord[]
  total?: number
}

async function fetchSummary(): Promise<PointSummary> {
  const r = await fetchApi<PointSummary>(`/api/points`)
  if (!r.success) return {}
  return r.data ?? {}
}

async function fetchRecords(): Promise<PointRecord[]> {
  const r = await fetchApi<PointRecordsResponse>(`/api/points/transactions`)
  if (!r.success) return []
  return r.data?.list ?? []
}

export default function UserPointPage() {
  const t = useTranslations('user.point')
  const locale = useLocale()
  const user = useAuthStore((s) => s.user)

  const { data: summary } = useQuery({
    queryKey: ['user', 'points', 'summary', user?.id],
    enabled: !!user?.id,
    queryFn: fetchSummary,
  })

  const { data: records, isLoading: rLoading } = useQuery({
    queryKey: ['user', 'points', 'records', user?.id],
    enabled: !!user?.id,
    queryFn: fetchRecords,
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const items = records ?? []
  const total = summary?.totalEarned ?? 0
  const used = summary?.totalSpent ?? 0
  const balance = summary?.points ?? 0

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{t('title')}</h2>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t('total')}</p>
          <p className="mt-1 text-lg font-semibold text-green-600">{total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t('used')}</p>
          <p className="mt-1 text-lg font-semibold text-destructive">{used}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t('balance', { default: '可用' })}</p>
          <p className="mt-1 text-lg font-semibold">{balance}</p>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t('records', { default: '明细' })}</h3>
        {rLoading ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            {t('loading', { default: '加载中…' })}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
            <Coins className="h-8 w-8 opacity-40" />
            <p className="text-sm">{t('empty')}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.description ?? r.source ?? '—'}</p>
                  {r.createdAt ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {dateFmt.format(new Date(r.createdAt))}
                    </p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    'shrink-0 text-sm font-semibold',
                    r.amount > 0
                      ? 'text-green-600'
                      : r.amount < 0
                        ? 'text-destructive'
                        : 'text-muted-foreground',
                  )}
                >
                  {r.amount > 0 ? '+' : ''}
                  {r.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
