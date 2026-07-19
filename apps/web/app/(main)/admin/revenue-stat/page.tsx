'use client'

import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Wallet, TrendingUp, ShoppingCart, RotateCcw, Loader2, Coins, Receipt } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { StatCard } from '@/components/data'
import { cn } from '@/lib/utils'
import type { RevenueStatResponse } from './types'

const FALLBACK: RevenueStatResponse = {
  overview: {
    totalRevenue: 0,
    monthRevenue: 0,
    todayRevenue: 0,
    totalOrders: 0,
    paidOrders: 0,
    refundAmount: 0,
    refundCount: 0,
    netRevenue: 0,
    arpu: 0,
  },
  trend: [],
  byChannel: [],
  byProduct: [],
}

export default function RevenueStatPage() {
  const locale = useLocale()
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'stats', 'revenue'],
    queryFn: async () => {
      const r = await fetchApi<RevenueStatResponse>('/api/v1/admin/stats/revenue')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    retry: false,
  })
  const curFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 })
  const numFmt = new Intl.NumberFormat(locale)
  const stats = data ?? FALLBACK
  const peak = Math.max(1, ...stats.trend.map((p) => p.gross))
  const totalChannel = stats.byChannel.reduce((s, c) => s + c.amount, 0) || 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Wallet className="h-6 w-6 text-primary" />
          营收统计
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">订单、营收、退款、净额分析</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="累计营收" value={curFmt.format(stats.overview.totalRevenue)} icon={Wallet} loading={isLoading} />
        <StatCard title="本月营收" value={curFmt.format(stats.overview.monthRevenue)} icon={TrendingUp} loading={isLoading} />
        <StatCard title="今日营收" value={curFmt.format(stats.overview.todayRevenue)} icon={Coins} loading={isLoading} />
        <StatCard title="净营收" value={curFmt.format(stats.overview.netRevenue)} icon={Receipt} loading={isLoading} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="订单总数" value={numFmt.format(stats.overview.totalOrders)} icon={ShoppingCart} loading={isLoading} />
        <StatCard title="已支付订单" value={numFmt.format(stats.overview.paidOrders)} icon={ShoppingCart} loading={isLoading} />
        <StatCard title="退款总额" value={curFmt.format(stats.overview.refundAmount)} icon={RotateCcw} loading={isLoading} />
        <StatCard title="ARPU" value={curFmt.format(stats.overview.arpu)} icon={Coins} loading={isLoading} />
      </div>

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">营收趋势</h2>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {stats.trend.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">暂无数据</div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {stats.trend.map((p) => (
              <div key={p.date} className="flex flex-col items-center gap-1.5">
                <div className="flex h-32 w-full items-end rounded-md bg-muted/30 px-1">
                  <div
                    className={cn('w-full rounded-md bg-emerald-500/70 transition-all')}
                    style={{ height: `${(p.gross / peak) * 100}%` }}
                    title={`${p.date} 营收 ${p.gross}`}
                  />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{p.date.slice(5)}</span>
                <span className="text-xs font-semibold tabular-nums">{curFmt.format(p.gross)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-base font-semibold">渠道营收占比</h2>
        {stats.byChannel.length === 0 ? (
          <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">暂无数据</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {stats.byChannel.map((c) => (
              <div key={c.channel} className="space-y-1.5 rounded-md border p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{c.channel}</span>
                  <span className="tabular-nums text-muted-foreground">{numFmt.format(c.orders)} 单</span>
                </div>
                <div className="relative h-2 overflow-hidden rounded bg-muted/40">
                  <div
                    className="h-full rounded-md bg-primary/70"
                    style={{ width: `${(c.amount / totalChannel) * 100}%` }}
                  />
                </div>
                <div className="text-sm font-semibold tabular-nums">{curFmt.format(c.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
