/**
 * P1-2.3: 资源监控 — 多租户横向对比页
 * 路径: /admin/saas/metrics
 *
 * 内容:
 *  - 顶部:Grafana 多租户对比 dashboard iframe(各租户 CPU/内存曲线叠加)
 *  - 中部:横向排序的租户指标表(按 CPU 降序)
 *  - 底部:健康度提示(Prometheus 不可达时降级)
 */
'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Activity,
  ArrowLeft,
  ChevronUp,
  Cpu,
  Database as DatabaseIcon,
  ExternalLink,
  Layers,
  RefreshCw,
} from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { CenteredText, Skeleton } from '@/components/common'

import { useMetricsSummaryQuery } from '@/hooks/use-saas-tenants'
import { GrafanaFrame, GrafanaUnavailableHint } from '../_components/GrafanaFrame'
import type { TenantMetricsSummary } from '@ihui/api-client'

export default function MetricsComparisonPage() {
  const t = useTranslations('admin.saas.metrics')
  const { data, isLoading, error, refetch, isRefetching } = useMetricsSummaryQuery({
    refetchInterval: 30_000,
  })

  return (
    <div className="space-y-6">
      <BackBar />

      {/* 标题 + 刷新 */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Activity className="h-6 w-6 text-primary" />
            <CenteredText>{t('pageTitle')}</CenteredText>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <CenteredText>{t('pageSubtitle')}</CenteredText>
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={isRefetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          <CenteredText>{t('refresh')}</CenteredText>
        </Button>
      </header>

      {/* 顶部 — Grafana 对比图(无需 var-tenant,展示所有租户) */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Layers className="h-3 w-3" />
              <CenteredText>{t('compareTitle')}</CenteredText>
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              asChild
              className="h-7 px-2 text-xs"
              title={t('openNewWindow')}
            >
              <a
                href={`${process.env.NEXT_PUBLIC_GRAFANA_BASE ?? 'http://127.0.0.1:8801'}/d/saas-tenant-comparison`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <GrafanaFrame
            tenant="__all__"
            uid="saas-tenant-comparison"
            bare
            timeRange="now-3h"
            refresh="30s"
            height={420}
            title={t('compareTitle')}
          />
        </CardContent>
      </Card>

      {/* 中部 — 横向排序表 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ChevronUp className="h-3 w-3" />
            <CenteredText>{t('rankingTitle')}</CenteredText>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton variant="list" count={5} />
          ) : error ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-500">
              {error.message}
            </div>
          ) : !data ? (
            <Skeleton variant="list" count={3} />
          ) : !data.available ? (
            <GrafanaUnavailableHint reason={t('degradedHint')} />
          ) : data.tenants.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <CenteredText>{t('empty')}</CenteredText>
            </div>
          ) : (
            <TenantsRankingTable tenants={data.tenants} total={data.total} />
          )}
        </CardContent>
      </Card>

      {/* 底部 — 数据生成时间 */}
      {data?.generatedAt ? (
        <p className="text-xs text-muted-foreground">
          {t('generatedAt', { time: new Date(data.generatedAt).toLocaleString() })}
        </p>
      ) : null}
    </div>
  )
}

function TenantsRankingTable({
  tenants,
  total,
}: {
  tenants: TenantMetricsSummary[]
  total: number
}) {
  const t = useTranslations('admin.saas.metrics')

  // 找出 max 用于进度条归一化
  const maxCpu = Math.max(...tenants.map((x) => x.cpu), 0.001)
  const maxMem = Math.max(...tenants.map((x) => x.memoryBytes), 1)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t('totalTenants', { total })}</span>
      </div>
      <ul className="divide-y divide-border">
        {tenants.map((tn, idx) => {
          const cpuPct = (tn.cpu / maxCpu) * 100
          const memPct = (tn.memoryBytes / maxMem) * 100
          return (
            <li
              key={tn.slug}
              className="grid gap-3 py-3 sm:grid-cols-12 sm:items-center"
            >
              <div className="sm:col-span-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                    {idx + 1}
                  </span>
                  <Link
                    href={`/admin/saas/${encodeURIComponent(tn.slug)}`}
                    className="break-all font-mono text-sm hover:text-primary"
                  >
                    {tn.slug}
                  </Link>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {t('containers', { count: tn.containers })}
                </p>
              </div>
              <div className="sm:col-span-5">
                <BarRow
                  icon={<Cpu className="h-3 w-3 text-primary" />}
                  label={t('cpu')}
                  value={`${tn.cpu.toFixed(2)} ${t('unitCores')}`}
                  pct={cpuPct}
                />
              </div>
              <div className="sm:col-span-5">
                <BarRow
                  icon={<DatabaseIcon className="h-3 w-3 text-primary" />}
                  label={t('memory')}
                  value={formatBytes(tn.memoryBytes)}
                  pct={memPct}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function BarRow({
  icon,
  label,
  value,
  pct,
}: {
  icon: React.ReactNode
  label: string
  value: string
  pct: number
}) {
  const t = useTranslations('admin.saas.metrics')
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </span>
        <span className="font-mono tabular-nums">{value}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/60"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('usageBarLabel', { label })}
        />
      </div>
    </div>
  )
}

function BackBar() {
  const t = useTranslations('admin.saas.metrics')
  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/saas">
          <ArrowLeft className="h-4 w-4" />
          <CenteredText>{t('back')}</CenteredText>
        </Link>
      </Button>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes.toFixed(0)} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(2)} GB`
}
