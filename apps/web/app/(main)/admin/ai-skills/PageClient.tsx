'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { BarChart3, CheckCircle2, Clock, Zap, AlertTriangle, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

import {
  getAiSkillStats,
  type AiSkillStatsData,
  type PerSkillStats,
} from '@ihui/api-client/endpoints/ai-skills'
import { StatCard } from '@/components/data'
import { DataTable, type Column } from '@/components/data'
import { Badge } from '@/components/data'
import { BackButton } from '@/components/common'
import { cn } from '@/lib/utils'

async function fetchStats(): Promise<AiSkillStatsData> {
  const r = await getAiSkillStats()
  if (!r.success || !r.data) throw new Error(r.error ?? 'load failed')
  return r.data
}

export default function AdminAiSkillStatsPage() {
  const t = useTranslations('adminAiSkills')
  const tc = useTranslations('common')

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'ai-skills', 'stats'],
    queryFn: fetchStats,
    refetchInterval: 30_000, // 30s 自动刷新
  })

  const topFailed = React.useMemo(() => {
    if (!data?.perSkill) return []
    return data.perSkill
      .filter((s) => s.successRate < 1)
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, 5)
  }, [data])

  const columns: Column<PerSkillStats>[] = React.useMemo(
    () => [
      {
        key: 'skillName',
        title: t('skillName'),
        sortable: true,
        render: (row) => (
          <Link
            href={`/ai-skills/${row.skillName}`}
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            {row.skillName}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        ),
      },
      {
        key: 'callCount',
        title: t('callCount'),
        sortable: true,
        align: 'right',
        render: (row) => <span className="tabular-nums">{row.callCount}</span>,
      },
      {
        key: 'successRate',
        title: t('successRate'),
        sortable: true,
        align: 'right',
        render: (row) => (
          <span
            className={cn(
              'tabular-nums',
              row.successRate >= 0.9
                ? 'text-emerald-600'
                : row.successRate >= 0.7
                  ? 'text-amber-600'
                  : 'text-red-600',
            )}
          >
            {(row.successRate * 100).toFixed(1)}%
          </span>
        ),
      },
      {
        key: 'avgDurationMs',
        title: t('avgDuration'),
        sortable: true,
        align: 'right',
        render: (row) => <span className="tabular-nums">{row.avgDurationMs}ms</span>,
      },
    ],
    [t],
  )

  if (error) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4">
        <BackButton />
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {t('loadFailed')}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4">
      <BackButton />
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        </div>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* 4 个统计卡片 */}
      <div className="grid grid-cols-2 gap-3 min-[768px]:grid-cols-4">
        <StatCard
          title={t('totalCalls')}
          value={isLoading ? '...' : (data?.totalCalls ?? 0)}
          icon={BarChart3}
          loading={isLoading}
        />
        <StatCard
          title={t('successRate')}
          value={isLoading ? '...' : `${((data?.successRate ?? 0) * 100).toFixed(1)}%`}
          icon={CheckCircle2}
          loading={isLoading}
        />
        <StatCard
          title={t('avgDuration')}
          value={isLoading ? '...' : `${data?.avgDurationMs ?? 0}ms`}
          icon={Clock}
          loading={isLoading}
        />
        <StatCard
          title={t('totalTokens')}
          value={isLoading ? '...' : (data?.totalTokens ?? 0).toLocaleString()}
          icon={Zap}
          loading={isLoading}
        />
      </div>

      {/* 调用量趋势图(最近 7 天) */}
      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('callTrend')}
        </h2>
        {isLoading ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            {tc('loading')}
          </div>
        ) : (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.trend.last7Days ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(5)}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="calls"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  name={t('callCount')}
                />
                <Bar
                  dataKey="success"
                  fill="hsl(142, 76%, 36%)"
                  radius={[4, 4, 0, 0]}
                  name={t('successCount')}
                />
                <Bar
                  dataKey="failures"
                  fill="hsl(0, 84%, 60%)"
                  radius={[4, 4, 0, 0]}
                  name={t('failureCount')}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* 每个 skill 的统计表格 */}
      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('perSkillTable')}
        </h2>
        <DataTable<PerSkillStats>
          columns={columns}
          data={data?.perSkill ?? []}
          loading={isLoading}
          rowKey={(row) => row.skillName}
        />
      </section>

      {/* 失败率最高的 5 个 skill */}
      {topFailed.length > 0 && (
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('failedSkills')}
            </h2>
          </div>
          <div className="space-y-2">
            {topFailed.map((skill) => (
              <Link
                key={skill.skillName}
                href={`/ai-skills/${skill.skillName}`}
                className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{skill.skillName}</span>
                  <Badge variant="danger" className="text-[10px]">
                    {(skill.successRate * 100).toFixed(1)}%
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {t('callCount')}: {skill.callCount}
                  </span>
                  <span>
                    {t('avgDuration')}: {skill.avgDurationMs}ms
                  </span>
                  <ArrowUpRight className="h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
