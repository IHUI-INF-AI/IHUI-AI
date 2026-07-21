/**
 * P1-2.3: 租户实时指标卡片
 * 数据源: GET /admin/api/customers/:slug/metrics(Prometheus)
 * 用于租户详情页内嵌,展示 CPU / 内存 / 网络瞬时数据
 */
'use client'

import { useTranslations } from 'next-intl'
import {
  Activity,
  Cpu,
  Database as DatabaseIcon,
  Info,
  Network,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

import { Skeleton } from '@/components/common'
import { useCustomerMetricsQuery } from '@/hooks/use-saas-tenants'

interface MetricsCardProps {
  slug: string
}

export function MetricsCard({ slug }: MetricsCardProps) {
  const t = useTranslations('admin.saas.metrics')
  const { data, isLoading, error } = useCustomerMetricsQuery(slug, {
    refetchInterval: 15_000,
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('cardTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton variant="list" count={4} />
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('cardTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-rose-600 dark:text-rose-500">
            {error?.message ?? t('unavailable')}
          </p>
        </CardContent>
      </Card>
    )
  }

  const { cpu, memoryBytes, networkRxBytesPerSec, networkTxBytesPerSec, available } = data

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>{t('cardTitle')}</span>
          {!available ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
              title={t('degraded')}
            >
              <Info className="h-3 w-3" />
              {t('degraded')}
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400"
            >
              <Activity className="h-3 w-3" />
              {t('live')}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <MetricRow
            icon={<Cpu className="h-4 w-4 text-primary" />}
            label={t('cpu')}
            value={`${cpu.toFixed(2)} ${t('unitCores')}`}
            tone={cpu > 1.5 ? 'warn' : 'normal'}
          />
          <MetricRow
            icon={<DatabaseIcon className="h-4 w-4 text-primary" />}
            label={t('memory')}
            value={formatBytes(memoryBytes)}
            tone={memoryBytes > 2 * 1024 ** 3 ? 'warn' : 'normal'}
          />
          <MetricRow
            icon={<Network className="h-4 w-4 text-primary" />}
            label={t('networkRx')}
            value={`${formatBytes(networkRxBytesPerSec)}/s`}
          />
          <MetricRow
            icon={<Network className="h-4 w-4 text-primary" />}
            label={t('networkTx')}
            value={`${formatBytes(networkTxBytesPerSec)}/s`}
          />
        </dl>
      </CardContent>
    </Card>
  )
}

function MetricRow({
  icon,
  label,
  value,
  tone = 'normal',
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: 'normal' | 'warn'
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </dt>
      <dd
        className={`mt-1 font-mono tabular-nums ${tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}
      >
        {value}
      </dd>
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
