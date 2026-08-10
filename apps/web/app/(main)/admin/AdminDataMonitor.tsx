'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { Eye, Users, BarChart3, Activity, MousePointerClick, TrendingUp, ArrowRight, Loader2 } from 'lucide-react'
import { eduApi } from '@/lib/edu'
import { StatCard } from '@/components/data'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

interface VisitSummary {
  summary?: { totalPv: number; totalUv: number; ipCount?: number; memberCount?: number }
}
interface HotPage {
  url: string
  pv: number
  uv?: number
}
interface BehaviorSummary {
  summary?: { totalEvents: number; eventTypes: number; uniqueUsers: number }
  todayEvents?: number
}

const QUICK_LINKS = [
  { href: '/admin/visit-tracking', label: '访问统计', desc: 'PV / UV / IP / 明细', icon: Eye },
  { href: '/admin/visit-trend', label: '访问趋势', desc: '趋势 / 来源 / 热门页', icon: TrendingUp },
  { href: '/admin/behavior-analytics', label: '行为埋点', desc: '点击 / 搜索 / 下载 / 事件', icon: MousePointerClick },
  { href: '/admin/statistics', label: '综合统计', desc: '运营数据大盘', icon: BarChart3 },
  { href: '/admin/online-users', label: '在线用户', desc: '实时在线会话', icon: Users },
  { href: '/admin/monitoring-dashboard', label: '系统监控', desc: '服务 / 隧道 / 资源', icon: Activity },
]

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

/**
 * 管理端主页数据监测概览(2026-08-10 立)
 * - 访问概览:近 7 天 PV/UV
 * - 行为概览:埋点事件总数/类型/今日
 * - 热门页面 Top 5
 * - 数据监测快捷入口
 */
export function AdminDataMonitor() {
  const locale = useLocale()
  const numFmt = new Intl.NumberFormat(locale)
  const today = daysAgo(0)
  const weekAgo = daysAgo(7)

  const visitQ = useQuery({
    queryKey: ['admin', 'monitor', 'visit', weekAgo, today],
    queryFn: async () => {
      const r = await eduApi<VisitSummary>(`/api/admin/visit-tracking/summary?startTime=${weekAgo}&endTime=${today}`)
      return r.summary ?? {}
    },
  })
  const hotPagesQ = useQuery({
    queryKey: ['admin', 'monitor', 'hot-pages', weekAgo, today],
    queryFn: async () => {
      const r = await eduApi<{ list: HotPage[] }>(`/api/admin/visit-tracking/stats/page?startTime=${weekAgo}&endTime=${today}&page=1&pageSize=5`)
      return r.list ?? []
    },
  })
  const behaviorQ = useQuery({
    queryKey: ['admin', 'monitor', 'behavior', weekAgo, today],
    queryFn: async () => {
      const r = await eduApi<BehaviorSummary>(`/api/admin/analytics/summary?startTime=${weekAgo}&endTime=${today}`)
      return r ?? {}
    },
  })

  const visit = (visitQ.data ?? {}) as Partial<NonNullable<VisitSummary['summary']>>
  const hotPages = (hotPagesQ.data ?? []) as HotPage[]
  const behavior = (behaviorQ.data ?? {}) as Partial<BehaviorSummary>
  const loading = visitQ.isLoading || hotPagesQ.isLoading || behaviorQ.isLoading

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="近 7 天 PV" value={numFmt.format(visit.totalPv ?? 0)} icon={Eye} loading={loading} />
        <StatCard title="近 7 天 UV" value={numFmt.format(visit.totalUv ?? 0)} icon={Users} loading={loading} />
        <StatCard title="行为事件总数" value={numFmt.format(behavior.summary?.totalEvents ?? 0)} icon={MousePointerClick} loading={loading} />
        <StatCard title="今日行为事件" value={numFmt.format(behavior.todayEvents ?? 0)} icon={Activity} loading={loading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">热门页面 Top 5</CardTitle>
            <Link href="/admin/visit-trend" className="flex items-center gap-1 text-xs text-primary hover:underline">
              查看趋势 <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!loading && hotPages.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">暂无访问数据(埋点自 08-10 起采集)</p>
            )}
            {hotPages.map((p, i) => (
              <div key={p.url} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">{i + 1}</span>
                  <span className="truncate">{p.url}</span>
                </span>
                <span className="shrink-0 text-muted-foreground">{numFmt.format(p.pv)} 次</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">数据监测快捷入口</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <link.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{link.label}</div>
                  <div className="truncate text-xs text-muted-foreground">{link.desc}</div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
