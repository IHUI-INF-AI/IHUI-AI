// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, ShoppingCart, Users, Activity, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import {
  CHART_BLUE,
  CHART_GREEN,
  CHART_AMBER,
  CHART_VIOLET,
  CHART_TEXT_LIGHT,
  CHART_INDIGO,
} from '@ihui/design-tokens'
import type { EChartsOption } from 'echarts'
import { fetchApi } from '@/lib/api'
import { EChart } from '@/components/charts/EChart'
import { formatNumber } from '@/lib/date-utils'
import { BackButton } from '@/components/common'

interface BiTrend {
  date: string
  revenue: number
  orders: number
}
interface BiCategory {
  name: string
  value: number
}
interface BiSource {
  name: string
  value: number
}
interface BiDashboardData {
  totalRevenue: number
  totalOrders: number
  newUsers: number
  activeUsers: number
  trend: BiTrend[]
  categories: BiCategory[]
  sources: BiSource[]
  /** 访问埋点块(2026-10-26):PV/UV 与页面排行,来自 visit_logs */
  visits: {
    pv: number
    uv: number
    pages: Array<{ url: string; pv: number; uv: number }>
  }
}

/** 加载失败时的诚实空态(全 0/空数组),避免用假数字冒充真实运营数据 */
const EMPTY: BiDashboardData = {
  totalRevenue: 0,
  totalOrders: 0,
  newUsers: 0,
  activeUsers: 0,
  trend: [],
  categories: [],
  sources: [],
  visits: { pv: 0, uv: 0, pages: [] },
}

const STAT_CARDS = [
  { key: 'totalRevenue' as const, label: '总营收', icon: TrendingUp, color: 'text-emerald-600' },
  { key: 'totalOrders' as const, label: '总订单', icon: ShoppingCart, color: 'text-teal-600' },
  { key: 'newUsers' as const, label: '新增用户', icon: Users, color: 'text-purple-600' },
  { key: 'activeUsers' as const, label: '活跃用户', icon: Activity, color: 'text-orange-600' },
]

export default function BiDashboardPage() {
  const { data, isLoading, error } = useQuery<BiDashboardData>({
    queryKey: ['bi-dashboard'],
    queryFn: async () => {
      const r = await fetchApi<BiDashboardData>('/api/admin/bi-dashboard')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    staleTime: 60_000,
  })
  const d = data ?? EMPTY
  // 2026-10-26:后端旧版本缺块时不得让 .map 崩掉整页(此前 trend/categories/sources
  // 三个字段后端根本没返回 ⇒ 打开就是错误边界)。这里逐块兜底成空数组。
  const trendRows = d.trend ?? []
  const categoryRows = d.categories ?? []
  const sourceRows = d.sources ?? []
  const visitPages = d.visits?.pages ?? []

  const trendOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['营收', '订单'], top: 0 },
    grid: { left: 50, right: 50, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: trendRows.map((t) => t.date), boundaryGap: false },
    yAxis: [
      { type: 'value', name: '营收(元)' },
      { type: 'value', name: '订单' },
    ],
    series: [
      {
        name: '营收',
        type: 'line',
        smooth: true,
        data: trendRows.map((t) => t.revenue),
        itemStyle: { color: CHART_BLUE },
        areaStyle: { opacity: 0.1 },
      },
      {
        name: '订单',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: trendRows.map((t) => t.orders),
        itemStyle: { color: CHART_GREEN },
      },
    ],
  }

  const categoryOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: categoryRows.map((c) => c.name) },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: categoryRows.map((c) => c.value),
        itemStyle: { color: CHART_INDIGO, borderRadius: [4, 4, 0, 0] },
        barWidth: '50%',
      },
    ],
  }

  const sourceOption: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        label: { show: false },
        data: sourceRows.map((s) => ({ name: s.name, value: s.value })),
        color: [CHART_BLUE, CHART_GREEN, CHART_AMBER, CHART_VIOLET, CHART_TEXT_LIGHT],
      },
    ],
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <BackButton />
      <div>
        <h1 className="text-2xl font-bold">BI 仪表板</h1>
        <p className="mt-1 text-sm text-muted-foreground">业务核心指标与趋势可视化</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          BI 数据加载失败:{(error as Error).message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3 min-[1280px]:grid-cols-6">
        {STAT_CARDS.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${c.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? '—' : formatNumber(d[c.key] as number)}
                </div>
              </CardContent>
            </Card>
          )
        })}
        {[
          { key: 'pv' as const, label: '近 7 日浏览量', sub: 'UV', icon: Eye },
          { key: 'uv' as const, label: '近 7 日访客数', sub: 'PV', icon: Users },
        ].map((c) => {
          const Icon = c.icon
          const main = d.visits?.[c.key] ?? 0
          const sub = d.visits?.[c.sub === 'UV' ? 'uv' : 'pv'] ?? 0
          return (
            <Card key={c.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-sky-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? '—' : formatNumber(main)}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.sub} {isLoading ? '—' : formatNumber(sub)}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">7 天趋势</CardTitle>
          <p className="text-xs text-muted-foreground">营收与订单变化</p>
        </CardHeader>
        <CardContent>
          <EChart option={trendOption} loading={isLoading} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">分类对比</CardTitle>
            <p className="text-xs text-muted-foreground">各业务模块营收</p>
          </CardHeader>
          <CardContent>
            <EChart option={categoryOption} loading={isLoading} height={280} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">访问来源</CardTitle>
            <p className="text-xs text-muted-foreground">近 7 日 referer 主机（无来源记 direct）</p>
          </CardHeader>
          <CardContent>
            <EChart option={sourceOption} loading={isLoading} height={280} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">页面访问排行</CardTitle>
          <p className="text-xs text-muted-foreground">
            近 7 日 · 每个页面被打开了多少次、多少去重访客
          </p>
        </CardHeader>
        <CardContent>
          {visitPages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {isLoading ? '加载中…' : '暂无访问数据'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {visitPages.map((p) => {
                const max = visitPages[0]?.pv || 1
                const pct = Math.round((p.pv / max) * 100)
                return (
                  <div key={p.url} className="flex items-center gap-2">
                    <span className="w-[46%] truncate text-xs text-foreground">{p.url}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-muted">
                      <div
                        className="h-full rounded-sm bg-primary/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono text-xs tabular-nums">{p.pv}</span>
                    <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                      UV {p.uv}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
