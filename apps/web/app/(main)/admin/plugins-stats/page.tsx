'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Download,
  MousePointerClick,
  Pin,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import type { PluginStatsRow, PluginStatsSummary, PluginTrendRow } from '@ihui/types'
import { MARKET_PLUGINS, PROJECT_PLUGINS } from '../../plugins/plugins-data'

// =============================================================================
// 数据获取
// =============================================================================

function useStatsSummary(days: number) {
  return useQuery({
    queryKey: ['admin', 'plugins', 'summary', days],
    queryFn: async () => {
      const res = await fetchApi<PluginStatsSummary>(`/api/admin/plugins/stats/summary?days=${days}`)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    refetchInterval: 60_000,
  })
}

function useStatsTop(days: number, limit: number) {
  return useQuery({
    queryKey: ['admin', 'plugins', 'top', days, limit],
    queryFn: async () => {
      const res = await fetchApi<PluginStatsRow[]>(`/api/admin/plugins/stats/top?days=${days}&limit=${limit}`)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    refetchInterval: 60_000,
  })
}

function useStatsTrend(days: number) {
  return useQuery({
    queryKey: ['admin', 'plugins', 'trend', days],
    queryFn: async () => {
      const res = await fetchApi<PluginTrendRow[]>(`/api/admin/plugins/stats/trend?days=${days}`)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    refetchInterval: 60_000,
  })
}

// =============================================================================
// 工具
// =============================================================================

/** 根据 pluginId 查找插件名称(从静态数据) */
const PLUGIN_NAME_MAP = new Map<string, string>([
  ...PROJECT_PLUGINS.map((p) => [p.id, p.name] as const),
  ...MARKET_PLUGINS.map((p) => [p.id, p.name] as const),
])

function getPluginName(pluginId: string): string {
  return PLUGIN_NAME_MAP.get(pluginId) ?? pluginId
}

function formatNumber(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// =============================================================================
// 子组件
// =============================================================================

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number
  sublabel?: string
}

function StatCard({ icon, label, value, sublabel }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
          {icon}
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground [&>span]:translate-y-[0.5px]">
            <span>{label}</span>
          </span>
          <span className="text-xl font-semibold tabular-nums">{formatNumber(value)}</span>
          {sublabel && (
            <span className="text-[10px] text-muted-foreground/70 [&>span]:translate-y-[0.5px]">
              <span>{sublabel}</span>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function TrendBar({ row, maxInstalls, maxClicks }: { row: PluginTrendRow; maxInstalls: number; maxClicks: number }) {
  const installPct = maxInstalls > 0 ? (row.installs / maxInstalls) * 100 : 0
  const clickPct = maxClicks > 0 ? (row.clicks / maxClicks) * 100 : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-muted-foreground tabular-nums">{row.date.slice(5)}</span>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-1">
          <div className="h-3 rounded-sm bg-primary/80" style={{ width: `${installPct}%`, minWidth: row.installs > 0 ? '4px' : '0' }} />
          <span className="tabular-nums text-foreground/70">{row.installs}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 rounded-sm bg-muted-foreground/50" style={{ width: `${clickPct}%`, minWidth: row.clicks > 0 ? '4px' : '0' }} />
          <span className="tabular-nums text-foreground/70">{row.clicks}</span>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// 主页面
// =============================================================================

export default function PluginStatsPage() {
  const [days, setDays] = React.useState(7)
  const summaryQ = useStatsSummary(days)
  const topQ = useStatsTop(days, 20)
  const trendQ = useStatsTrend(days)

  const summary = summaryQ.data
  const topRows = topQ.data ?? []
  const trendRows = trendQ.data ?? []

  const maxInstalls = Math.max(1, ...trendRows.map((r) => r.installs))
  const maxClicks = Math.max(1, ...trendRows.map((r) => r.clicks))

  const refetchAll = () => {
    void summaryQ.refetch()
    void topQ.refetch()
    void trendQ.refetch()
  }

  return (
    <div className="space-y-6 p-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">插件市场监测</h1>
          <p className="mt-1 text-xs text-muted-foreground [&>span]:translate-y-[0.5px]">
            <span>实时追踪插件热度、安装量、点击量,辅助运营决策</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 时间窗口切换 */}
          <div className="flex rounded-md bg-muted/60 p-0.5 [&>span]:translate-y-[0.5px]">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors [&>span]:translate-y-[0.5px] ${
                  days === d ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{d}天</span>
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={refetchAll} disabled={summaryQ.isFetching}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${summaryQ.isFetching ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Download className="h-5 w-5" />}
          label="总安装量"
          value={summary?.totalInstalls ?? 0}
          sublabel={`今日 ${summary?.todayInstalls ?? 0}`}
        />
        <StatCard
          icon={<MousePointerClick className="h-5 w-5" />}
          label="总点击量"
          value={summary?.totalClicks ?? 0}
          sublabel={`今日 ${summary?.todayClicks ?? 0}`}
        />
        <StatCard
          icon={<Pin className="h-5 w-5" />}
          label="收藏次数"
          value={summary?.totalPins ?? 0}
          sublabel={`取消 ${summary?.totalUnpins ?? 0}`}
        />
        <StatCard
          icon={<Activity className="h-5 w-5" />}
          label="总事件数"
          value={summary?.totalEvents ?? 0}
          sublabel={`卸载 ${summary?.totalUninstalls ?? 0}`}
        />
      </div>

      {/* 热度榜 + 趋势 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* 热度榜(占 2 列) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              热度榜单 Top 20
            </CardTitle>
            <span className="text-[10px] text-muted-foreground">热度 = 安装×10 + 点击×1 + 收藏×20 - 卸载×5</span>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>插件</TableHead>
                  <TableHead className="text-right">安装</TableHead>
                  <TableHead className="text-right">点击</TableHead>
                  <TableHead className="text-right">收藏</TableHead>
                  <TableHead className="text-right">卸载</TableHead>
                  <TableHead className="text-right">热度</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                      暂无数据(可能 plugin_events 表未创建,请运行 drizzle-kit push)
                    </TableCell>
                  </TableRow>
                )}
                {topRows.map((row, idx) => (
                  <TableRow key={row.pluginId}>
                    <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">{getPluginName(row.pluginId)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.installs}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.clicks}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.pins}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{row.uninstalls}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-primary">
                      {formatNumber(row.heat)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 趋势图(占 1 列) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">按天趋势</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {trendRows.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">暂无趋势数据</div>
            )}
            {trendRows.slice().reverse().map((row) => (
              <TrendBar key={row.date} row={row} maxInstalls={maxInstalls} maxClicks={maxClicks} />
            ))}
            {/* 图例 */}
            <div className="flex items-center gap-4 pt-2 text-[10px] text-muted-foreground [&>span]:translate-y-[0.5px]">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-primary/80" />
                <span>安装</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-muted-foreground/50" />
                <span>点击</span>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
