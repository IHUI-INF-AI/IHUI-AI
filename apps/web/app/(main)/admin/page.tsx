'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import {
  Users,
  Folder,
  FileText,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { StatCard } from '@/components/data'
import { PageHeader } from '@/components/layout'
import { MiniChart } from '@/components/dashboard/mini-chart'
import { RadarChart } from '@/components/charts/RadarChart'
import { LineChart } from '@/components/charts/LineChart'
import { PieChart } from '@/components/charts/PieChart'

interface DetailedStats {
  totals: {
    users: number
    projects: number
    files: number
    orders: number
    usersChange: number
    projectsChange: number
    filesChange: number
    ordersChange: number
  }
  userGrowth: number[]
  projectStatus: { key: string; value: number }[]
  fileTypes: { key: string; value: number }[]
  orderStats: { totalAmount: number; totalCount: number; paidCount: number; pendingCount: number }
}

// 后端 /api/admin/stats/detailed 原始结构
interface RawDetailedStats {
  userGrowthTrend: { date: string; count: number }[]
  projectDistribution: { status: number; count: number }[]
  fileTypeDistribution: { mimeType: string; count: number }[]
  orderStats: { total: number; paid: number; pending: number; totalRevenue: number }
}

// 后端 /api/admin/stats 原始结构
interface AdminStatsResponse {
  totalUsers: number
  totalProjects: number
  todayRevenue: number
  activeSessions: number
  totalUsersChange: number
  totalProjectsChange: number
  todayRevenueChange: number
  activeSessionsChange: number
}

// project status(number) → i18n key 映射：1=active, 2=completed, 其余=archived
function projectStatusKey(status: number): string {
  if (status === 1) return 'active'
  if (status === 2) return 'completed'
  return 'archived'
}

// mimeType → 分类 key 映射：image/* / video/* / 常见文档 → document / 其余 → other
function fileTypeKey(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (/^(text\/|application\/(pdf|msword|vnd\.openxmlformats-officedocument))/.test(mimeType))
    return 'document'
  return 'other'
}

function aggregateByKey<T>(rows: T[], keyFn: (r: T) => string): { key: string; value: number }[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    const k = keyFn(r)
    map.set(k, (map.get(k) ?? 0) + ((r as { count: number }).count ?? 0))
  }
  return Array.from(map, ([key, value]) => ({ key, value }))
}

async function fetchDetailedStats(): Promise<DetailedStats> {
  const [basicRes, detailedRes] = await Promise.all([
    fetchApi<AdminStatsResponse>('/api/admin/stats'),
    fetchApi<RawDetailedStats>('/api/admin/stats/detailed'),
  ])
  if (!basicRes.success) throw new Error(basicRes.error)
  if (!detailedRes.success) throw new Error(detailedRes.error)
  const b = basicRes.data
  const d = detailedRes.data

  const userGrowth = d.userGrowthTrend.map((r) => r.count)
  const projectStatus = aggregateByKey(d.projectDistribution, (r) => projectStatusKey(r.status))
  const fileTypes = aggregateByKey(d.fileTypeDistribution, (r) => fileTypeKey(r.mimeType))
  const totalFiles = d.fileTypeDistribution.reduce((s, r) => s + r.count, 0)

  return {
    totals: {
      users: b.totalUsers,
      projects: b.totalProjects,
      files: totalFiles,
      orders: d.orderStats.total,
      usersChange: b.totalUsersChange,
      projectsChange: b.totalProjectsChange,
      filesChange: 0,
      ordersChange: b.todayRevenueChange,
    },
    userGrowth,
    projectStatus,
    fileTypes,
    orderStats: {
      totalAmount: d.orderStats.totalRevenue,
      totalCount: d.orderStats.total,
      paidCount: d.orderStats.paid,
      pendingCount: d.orderStats.pending,
    },
  }
}

// 接口失败时的空兜底（不再使用伪造数值）
const EMPTY_STATS: DetailedStats = {
  totals: {
    users: 0,
    projects: 0,
    files: 0,
    orders: 0,
    usersChange: 0,
    projectsChange: 0,
    filesChange: 0,
    ordersChange: 0,
  },
  userGrowth: [],
  projectStatus: [],
  fileTypes: [],
  orderStats: { totalAmount: 0, totalCount: 0, paidCount: 0, pendingCount: 0 },
}

// 环形图配色:emerald 高亮 + primary + muted,取自 Tailwind 主题变量
const RING_COLORS = [
  'var(--color-emerald-500)',
  'var(--color-primary)',
  'var(--color-muted-foreground)',
]

const RADAR_DATA = [
  { label: 'Sales', value: 5000, max: 10000 },
  { label: 'Administration', value: 7000, max: 20000 },
  { label: 'Information Techology', value: 12000, max: 20000 },
  { label: 'Customer Support', value: 11000, max: 20000 },
  { label: 'Development', value: 15000, max: 20000 },
  { label: 'Marketing', value: 14000, max: 20000 },
]
const LINE_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const EXPECTED_DATA = [120, 82, 91, 154, 162, 140, 145]
const ACTUAL_DATA = [100, 90, 85, 120, 110, 130, 135]

function buildConic(segments: { value: number }[]): string {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  let acc = 0
  const stops = segments.map((seg, i) => {
    const start = acc
    acc += (seg.value / total) * 100
    return `${RING_COLORS[i % RING_COLORS.length]!} ${start}% ${acc}%`
  })
  return `conic-gradient(${stops.join(', ')})`
}

export default function AdminDashboardPage() {
  const t = useTranslations('dashboard.admin')
  const locale = useLocale()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'stats', 'detailed'],
    queryFn: fetchDetailedStats,
    retry: false,
  })

  const stats = data ?? EMPTY_STATS
  const numFmt = new Intl.NumberFormat(locale)
  const curFmt = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  })

  const cards = [
    {
      title: t('totalUsers'),
      value: stats.totals.users,
      icon: Users,
      trend: stats.totals.usersChange,
    },
    {
      title: t('totalProjects'),
      value: stats.totals.projects,
      icon: Folder,
      trend: stats.totals.projectsChange,
    },
    {
      title: t('totalFiles'),
      value: stats.totals.files,
      icon: FileText,
      trend: stats.totals.filesChange,
    },
    {
      title: t('totalOrders'),
      value: stats.totals.orders,
      icon: ShoppingCart,
      trend: stats.totals.ordersChange,
    },
  ]
  const statusItems = stats.projectStatus.map((s) => ({
    label: t(`projectStatus.${s.key}`),
    value: s.value,
  }))
  const fileItems = stats.fileTypes.map((f) => ({ label: t(`fileTypes.${f.key}`), value: f.value }))
  const fileMax = Math.max(...fileItems.map((f) => f.value), 1)
  const statusTotal = statusItems.reduce((s, x) => s + x.value, 0)
  const orderItems = [
    { icon: ShoppingCart, label: t('orderCount'), value: stats.orderStats.totalCount, cls: '' },
    {
      icon: TrendingUp,
      label: t('paidCount'),
      value: stats.orderStats.paidCount,
      cls: 'text-emerald-600 dark:text-emerald-500',
    },
    {
      icon: TrendingDown,
      label: t('pendingCount'),
      value: stats.orderStats.pendingCount,
      cls: 'text-amber-600 dark:text-amber-500',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          isError ? (
            <span className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-600 dark:text-amber-500">
              <AlertCircle className="h-3 w-3" />
              {t('loadFailed')}
            </span>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <StatCard
            key={c.title}
            title={c.title}
            value={numFmt.format(c.value)}
            icon={c.icon}
            trend={c.trend}
            loading={isLoading}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              {t('userGrowth')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t('userGrowthHint')}</p>
          </CardHeader>
          <CardContent>
            <MiniChart data={stats.userGrowth} height={140} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Folder className="h-4 w-4 text-primary" />
              {t('projectStatusTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div
                className="relative h-28 w-28 shrink-0 rounded-full"
                style={{ background: buildConic(statusItems) }}
              >
                <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-card">
                  <span className="text-lg font-bold">{numFmt.format(statusTotal)}</span>
                  <span className="text-[10px] text-muted-foreground">{t('totalLabel')}</span>
                </div>
              </div>
              <ul className="flex-1 space-y-2">
                {statusItems.map((s, i) => (
                  <li key={s.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: RING_COLORS[i % RING_COLORS.length] }}
                      />
                      {s.label}
                    </span>
                    <span className="font-medium">{numFmt.format(s.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              {t('fileTypesTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fileItems.map((f) => (
              <div key={f.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{f.label}</span>
                  <span className="text-muted-foreground">{numFmt.format(f.value)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70 transition-colors hover:bg-primary"
                    style={{ width: `${(f.value / fileMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4 text-primary" />
              {t('orderStatsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <span className="text-3xl font-bold tracking-tight">
                {curFmt.format(stats.orderStats.totalAmount)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t('totalAmountLabel')}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4">
              {orderItems.map((o) => {
                const Icon = o.icon
                return (
                  <div key={o.label}>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Icon className="h-3 w-3" />
                      {o.label}
                    </div>
                    <div className={cn('mt-1 text-lg font-semibold', o.cls)}>
                      {numFmt.format(o.value)}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              能力雷达图
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <RadarChart data={RADAR_DATA} size={260} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              周度趋势对比
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Expected</p>
                <LineChart
                  data={EXPECTED_DATA}
                  xAxis={LINE_DAYS}
                  color="var(--color-rose-500)"
                  height={160}
                />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Actual</p>
                <LineChart data={ACTUAL_DATA} xAxis={LINE_DAYS} height={160} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4 text-primary" />
            {t('orderStatusDistribution')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t('orderStatusDistributionHint')}</p>
        </CardHeader>
        <CardContent className="flex justify-center">
          <PieChart
            donut
            size={220}
            data={[
              { label: t('paidCount'), value: stats.orderStats.paidCount, color: '#10b981' },
              { label: t('pendingCount'), value: stats.orderStats.pendingCount, color: '#f59e0b' },
              {
                label: t('otherOrders'),
                value: Math.max(
                  0,
                  stats.orderStats.totalCount -
                    stats.orderStats.paidCount -
                    stats.orderStats.pendingCount,
                ),
                color: '#94a3b8',
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
