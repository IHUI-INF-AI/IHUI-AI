'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { fetchProvidersHealth } from '@ihui/api-client'
import { Card, CardContent, Badge, Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { Loader2, RefreshCw } from 'lucide-react'

import type { GatewayProvider, ProviderStatus } from './types'

const STATUS_BADGE: Record<ProviderStatus, string> = {
  configured: 'border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-500',
  not_configured: 'border-transparent bg-muted text-muted-foreground',
  local: 'border-transparent bg-sky-500/15 text-sky-600 dark:text-sky-500',
}

export function ProvidersHealthTab() {
  const t = useTranslations('settings.gateway.providers')

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['gateway-providers-health'],
    queryFn: fetchProvidersHealth,
    refetchInterval: 30_000,
  })

  const [filter, setFilter] = React.useState<'all' | ProviderStatus>('all')

  const summary = data?.summary ?? { total: 0, configured: 0, local: 0, not_configured: 0 }
  const providers: GatewayProvider[] = React.useMemo(() => {
    const list = data?.providers ?? []
    return filter === 'all' ? list : list.filter((p) => p.status === filter)
  }, [data, filter])

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryCard label={t('summary.total')} value={summary.total} />
        <SummaryCard label={t('summary.configured')} value={summary.configured} tone="emerald" />
        <SummaryCard label={t('summary.local')} value={summary.local} tone="sky" />
        <SummaryCard
          label={t('summary.notConfigured')}
          value={summary.not_configured}
          tone="muted"
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {(['all', 'configured', 'not_configured', 'local'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => setFilter(f)}
              className="h-7 px-2.5 text-xs"
            >
              {t(`filter.${f === 'not_configured' ? 'notConfigured' : f}`)}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => refetch()}
          className="h-7 px-2.5 text-xs"
          disabled={isFetching}
        >
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <Alert
          variant="danger"
          title="Error"
          description={error instanceof Error ? error.message : 'Failed to load'}
        />
      )}

      {/* Provider list */}
      {!isLoading && !error && (
        <div className="space-y-2">
          {providers.map((p) => (
            <Card key={p.provider_code}>
              <CardContent className="flex flex-wrap items-center gap-2 p-3">
                <div className="min-w-[140px] flex-1">
                  <p className="text-sm font-medium">{p.display_name}</p>
                  <p className="text-[11px] text-muted-foreground">{p.provider_code}</p>
                </div>
                <Badge className={STATUS_BADGE[p.status]}>{p.status}</Badge>
                <Badge variant="outline" className="text-[11px]">
                  {p.category}
                </Badge>
                {p.free_quota && (
                  <span className="text-[11px] text-muted-foreground">{p.free_quota}</span>
                )}
                <Badge variant="secondary" className="text-[11px]">
                  {p.default_models.length} {t('models')}
                </Badge>
                {p.is_in_cooldown && (
                  <Badge className="border-transparent bg-red-500/15 text-red-600 dark:text-red-500">
                    {t('cooldown')} · {p.consecutive_failures} {t('failures')}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
          {providers.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">—</p>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'emerald' | 'sky' | 'muted'
}) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-600 dark:text-emerald-500'
      : tone === 'sky'
        ? 'text-sky-600 dark:text-sky-500'
        : tone === 'muted'
          ? 'text-muted-foreground'
          : 'text-foreground'
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={`text-xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
