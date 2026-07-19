'use client'

import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { UserCheck, UserPlus, Activity, Users, Loader2, MapPin, Shield } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { StatCard } from '@/components/data'
import { cn } from '@/lib/utils'
import type { UserStatResponse } from './types'

const FALLBACK: UserStatResponse = {
  overview: {
    totalUsers: 0,
    todayNew: 0,
    weekNew: 0,
    monthNew: 0,
    dau: 0,
    mau: 0,
    retention7d: 0,
    retention30d: 0,
  },
  growth: [],
  byRole: [],
  byRegion: [],
}

export default function UserStatPage() {
  const locale = useLocale()
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'stats', 'users'],
    queryFn: async () => {
      const r = await fetchApi<UserStatResponse>('/api/v1/admin/stats/users')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    retry: false,
  })
  const numFmt = new Intl.NumberFormat(locale)
  const stats = data ?? FALLBACK
  const peak = Math.max(1, ...stats.growth.map((p) => p.newUsers))
  const totalRegion = stats.byRegion.reduce((s, r) => s + r.count, 0) || 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Users className="h-6 w-6 text-primary" />
          用户统计
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">用户增长、活跃与留存指标</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="用户总数" value={numFmt.format(stats.overview.totalUsers)} icon={Users} loading={isLoading} />
        <StatCard title="今日新增" value={numFmt.format(stats.overview.todayNew)} icon={UserPlus} loading={isLoading} />
        <StatCard title="本周新增" value={numFmt.format(stats.overview.weekNew)} icon={UserPlus} loading={isLoading} />
        <StatCard title="本月新增" value={numFmt.format(stats.overview.monthNew)} icon={UserPlus} loading={isLoading} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="日活跃" value={numFmt.format(stats.overview.dau)} icon={Activity} loading={isLoading} />
        <StatCard title="月活跃" value={numFmt.format(stats.overview.mau)} icon={Activity} loading={isLoading} />
        <StatCard title="7 日留存" value={`${stats.overview.retention7d}%`} icon={UserCheck} loading={isLoading} />
        <StatCard title="30 日留存" value={`${stats.overview.retention30d}%`} icon={UserCheck} loading={isLoading} />
      </div>

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">用户增长趋势</h2>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {stats.growth.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">暂无数据</div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {stats.growth.map((p) => (
              <div key={p.date} className="flex flex-col items-center gap-1.5">
                <div className="flex h-28 w-full items-end rounded-md bg-muted/30 px-1">
                  <div
                    className={cn('w-full rounded-md bg-emerald-500/70 transition-all')}
                    style={{ height: `${(p.newUsers / peak) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{p.date.slice(5)}</span>
                <span className="text-xs font-semibold tabular-nums">{numFmt.format(p.newUsers)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Shield className="h-4 w-4 text-primary" />
            角色分布
          </h2>
          {stats.byRole.length === 0 ? (
            <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">暂无数据</div>
          ) : (
            <div className="space-y-2">
              {stats.byRole.map((r) => {
                const total = stats.byRole.reduce((s, x) => s + x.count, 0) || 1
                return (
                  <div key={r.role} className="flex items-center gap-2 text-sm">
                    <span className="w-20 shrink-0 truncate text-muted-foreground">{r.role}</span>
                    <div className="relative h-4 flex-1 overflow-hidden rounded bg-muted/40">
                      <div className="h-full rounded-md bg-primary/70" style={{ width: `${(r.count / total) * 100}%` }} />
                    </div>
                    <span className="w-16 shrink-0 text-right tabular-nums">{numFmt.format(r.count)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <MapPin className="h-4 w-4 text-primary" />
            地域分布 Top
          </h2>
          {stats.byRegion.length === 0 ? (
            <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">暂无数据</div>
          ) : (
            <div className="space-y-2">
              {stats.byRegion.slice(0, 8).map((r) => (
                <div key={r.region} className="flex items-center gap-2 text-sm">
                  <span className="w-24 shrink-0 truncate text-muted-foreground">{r.region}</span>
                  <div className="relative h-4 flex-1 overflow-hidden rounded bg-muted/40">
                    <div
                      className="h-full rounded-md bg-amber-500/70"
                      style={{ width: `${(r.count / totalRegion) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right tabular-nums">{numFmt.format(r.count)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
