'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Gauge, Loader2, ArrowUp } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface LimitItem {
  key: string
  label: string
  used: number
  total: number
  unit?: string
}

interface LimitsData {
  planName?: string
  items: LimitItem[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function UsageBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0
  const color = pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn('h-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function LimitsPage() {
  const locale = useLocale()
  const numFmt = new Intl.NumberFormat(locale)

  const { data, isLoading, error } = useQuery({
    queryKey: ['developer', 'limits'],
    queryFn: () =>
      api<LimitsData>('/api/developer/limits').catch(() => ({ items: [] }) as LimitsData),
  })

  const items = data?.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Gauge className="h-5 w-5 text-primary" />
            限额管理
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">查看当前配额与用量</p>
        </div>
        <Button size="sm" asChild>
          <Link href="/developer/subscription">
            <ArrowUp className="h-4 w-4" />
            升级套餐
          </Link>
        </Button>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {data?.planName && (
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">当前套餐</p>
              <p className="mt-0.5 text-lg font-semibold">{data.planName}</p>
            </div>
            <Link href="/developer/subscription" className="text-sm text-primary hover:underline">
              管理订阅
            </Link>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">暂无限额数据</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => {
            const pct = item.total > 0 ? (item.used / item.total) * 100 : 0
            return (
              <Card key={item.key}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{item.label}</p>
                    <span
                      className={cn(
                        'text-xs font-medium',
                        pct >= 90
                          ? 'text-rose-600 dark:text-rose-400'
                          : pct >= 70
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-muted-foreground',
                      )}
                    >
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <UsageBar used={item.used} total={item.total} />
                  <p className="text-xs text-muted-foreground">
                    {numFmt.format(item.used)} / {numFmt.format(item.total)}
                    {item.unit ? ` ${item.unit}` : ''}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
