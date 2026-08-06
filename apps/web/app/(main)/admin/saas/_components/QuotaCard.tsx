/**
 * P1-2.2c: 配额卡片(2026-08-06 起接入真实数据源)
 * 数据源: GET /api/admin-saas/customers/:slug/quota
 *   - 后端 apps/api/src/routes/admin-saas-quota.ts 拦截该路径,
 *     基于 tenants + tenant_quotas(api_calls/storage 用量)+ ai_cost_records(token 用量)聚合返回。
 * 错误态:接口 404(数据库无该租户)/ 5xx / 网络异常时显示"无法获取配额数据"空态,不显示占位数字。
 */
'use client'

import { useTranslations } from 'next-intl'
import { Activity, Database as DatabaseIcon, Gauge, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

import { Skeleton } from '@/components/common'
import { useCustomerQuotaQuery } from '@/hooks/use-saas-tenants'

interface QuotaCardProps {
  slug: string
}

export function QuotaCard({ slug }: QuotaCardProps) {
  const t = useTranslations('admin.saas.quota')
  const { data, isLoading, error } = useCustomerQuotaQuery(slug)

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton variant="list" count={3} />
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('title')}
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className="min-w-0 truncate">{t('title')}</span>
          {data.placeholder ? (
            <span
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
              title={data.expectedFrom}
            >
              <Info className="h-3 w-3 shrink-0" />
              {t('placeholder')}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <QuotaRow
          icon={<Activity className="h-4 w-4 text-primary" />}
          label={t('apiCalls')}
          used={data.apiCalls.used}
          limit={data.apiCalls.limit}
        />
        <QuotaRow
          icon={<Gauge className="h-4 w-4 text-primary" />}
          label={t('aiTokens')}
          used={data.aiTokens.used}
          limit={data.aiTokens.limit}
        />
        <QuotaRow
          icon={<DatabaseIcon className="h-4 w-4 text-primary" />}
          label={t('storage')}
          used={data.storage.usedBytes}
          limit={data.storage.limitBytes}
          format="bytes"
        />
      </CardContent>
    </Card>
  )
}

function QuotaRow({
  icon,
  label,
  used,
  limit,
  format = 'number',
}: {
  icon: React.ReactNode
  label: string
  used: number
  limit: number | null
  format?: 'number' | 'bytes'
}) {
  const t = useTranslations('admin.saas.quota')
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </span>
        <span className="font-mono tabular-nums">
          {format === 'bytes' ? formatBytes(used) : formatNumber(used)}
          {' / '}
          {limit === null
            ? t('unlimited')
            : format === 'bytes'
              ? formatBytes(limit)
              : formatNumber(limit)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
        <div
          className="h-full rounded bg-primary/60"
          style={{
            width:
              limit && limit > 0 ? `${Math.min(100, Math.max(0, (used / limit) * 100))}%` : '0%',
          }}
        />
      </div>
    </div>
  )
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(2)} GB`
}
