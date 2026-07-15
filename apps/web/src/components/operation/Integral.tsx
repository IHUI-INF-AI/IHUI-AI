'use client'

import * as React from 'react'
import Link from 'next/link'
import { ShoppingBag, Trophy, ChevronRight } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, Button } from '@ihui/ui'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

export interface IntegralRecord {
  id: string
  title: string
  delta: number
  createdAt: string
}

export interface IntegralSummary {
  total: number
  weeklyGain: number
  rank: number
  records: IntegralRecord[]
}

interface IntegralProps {
  className?: string
  defaultData?: IntegralSummary
}

const MOCK_DATA: IntegralSummary = {
  total: 8650,
  weeklyGain: 320,
  rank: 128,
  records: [
    { id: 'r1', title: '每日签到', delta: 10, createdAt: '2026-07-14T08:30:00Z' },
    { id: 'r2', title: '完成课程《AI 入门》', delta: 50, createdAt: '2026-07-13T15:20:00Z' },
    { id: 'r3', title: '发表评论', delta: 5, createdAt: '2026-07-13T11:05:00Z' },
    { id: 'r4', title: '兑换礼品 - 笔记本', delta: -200, createdAt: '2026-07-12T16:45:00Z' },
    { id: 'r5', title: '邀请好友注册', delta: 100, createdAt: '2026-07-11T09:10:00Z' },
  ],
}

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

async function fetchIntegral(): Promise<IntegralSummary> {
  const res = await fetchApi<IntegralSummary>('/api/user/integral')
  if (res.success && res.data) {
    return {
      total: res.data.total ?? 0,
      weeklyGain: res.data.weeklyGain ?? 0,
      rank: res.data.rank ?? 0,
      records: Array.isArray(res.data.records) ? res.data.records : [],
    }
  }
  return MOCK_DATA
}

export function Integral({ className, defaultData }: IntegralProps) {
  const [data, setData] = React.useState<IntegralSummary>(defaultData ?? MOCK_DATA)
  const [loading, setLoading] = React.useState(!defaultData)

  React.useEffect(() => {
    if (defaultData) return
    let cancelled = false
    fetchIntegral()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [defaultData])

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
        <CardTitle className="text-sm">积分中心</CardTitle>
        <Button asChild size="sm" variant="outline">
          <Link href="/integral/mall">
            <ShoppingBag className="h-3.5 w-3.5" />
            积分商城
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3">
          <div className="text-center">
            <div className="text-xl font-bold tracking-tight">
              {loading ? '—' : data.total.toLocaleString('zh-CN')}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">当前积分</div>
          </div>
          <div className="border-x border-border/60 text-center">
            <div className="flex items-center justify-center gap-0.5 text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-500">
              {loading ? '—' : `+${data.weeklyGain}`}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">本周新增</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5 text-xl font-bold tracking-tight">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              {loading ? '—' : `#${data.rank}`}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">我的排名</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-medium text-muted-foreground">最近明细</h4>
            <Link
              href="/integral/records"
              className="flex items-center text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              全部
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="space-y-1">
            {data.records.slice(0, 5).map((r) => {
              const positive = r.delta > 0
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-foreground/90">{r.title}</span>
                    <time className="text-[11px] text-muted-foreground/70">
                      {dateFmt.format(new Date(r.createdAt))}
                    </time>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 font-semibold tabular-nums',
                      positive
                        ? 'text-emerald-600 dark:text-emerald-500'
                        : 'text-red-600 dark:text-red-500',
                    )}
                  >
                    {positive ? '+' : ''}
                    {r.delta}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

export default Integral
