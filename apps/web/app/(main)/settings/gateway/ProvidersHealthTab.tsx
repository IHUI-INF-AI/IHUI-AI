'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { fetchModelSyncStatus, fetchProvidersHealth, triggerModelSync } from '@ihui/api-client'
import { Card, CardContent, Badge, Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { Loader2, RefreshCw } from 'lucide-react'

import type { GatewayProvider, ProviderStatus } from './types'

const STATUS_BADGE: Record<ProviderStatus, string> = {
  ok: 'border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-500',
  invalid_key: 'border-transparent bg-red-500/15 text-red-600 dark:text-red-500',
  unreachable: 'border-transparent bg-muted text-muted-foreground',
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'ok', label: 'OK' },
  { value: 'invalid_key', label: 'Invalid Key' },
  { value: 'unreachable', label: 'Unreachable' },
] as const

export function ProvidersHealthTab() {
  const t = useTranslations('settings.gateway.providers')

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['gateway-providers-health'],
    queryFn: fetchProvidersHealth,
    refetchInterval: 30_000,
  })

  const { data: syncStatus } = useQuery({
    queryKey: ['model-sync-status'],
    queryFn: fetchModelSyncStatus,
    refetchInterval: 10_000,
  })

  const queryClient = useQueryClient()
  const syncMutation = useMutation({
    mutationFn: triggerModelSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-sync-status'] })
      queryClient.invalidateQueries({ queryKey: ['gateway-providers-health'] })
      queryClient.invalidateQueries({ queryKey: ['llm-models'] })
    },
  })

  const [filter, setFilter] = React.useState<'all' | ProviderStatus>('all')

  const summary = data?.summary ?? { total: 0, ok: 0, invalid_key: 0, unreachable: 0 }
  const providers: GatewayProvider[] = React.useMemo(() => {
    const list = data?.providers ?? []
    return filter === 'all' ? list : list.filter((p) => p.status === filter)
  }, [data, filter])

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryCard label={t('summary.total')} value={summary.total} />
        <SummaryCard label="OK" value={summary.ok} tone="emerald" />
        <SummaryCard label="Invalid Key" value={summary.invalid_key} tone="red" />
        <SummaryCard label="Unreachable" value={summary.unreachable} tone="muted" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={filter === opt.value ? 'default' : 'outline'}
              onClick={() => setFilter(opt.value)}
              className="h-7 px-2.5 text-xs"
            >
              {opt.label}
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

      {/* 模型自动同步 */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium">模型自动同步</p>
              <p className="text-[11px] text-muted-foreground">
                {syncStatus?.last_sync_at
                  ? `最近同步:${new Date(syncStatus.last_sync_at).toLocaleString()} · ${syncStatus.total_providers} 个 provider · +${syncStatus.total_new_models} 新增 / -${syncStatus.total_removed_models} 下架 · ${syncStatus.last_sync_duration_ms}ms`
                  : '从未同步'}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || syncStatus?.is_syncing}
              className="h-7 px-2.5 text-xs"
            >
              {syncMutation.isPending || syncStatus?.is_syncing ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
              )}
              {syncStatus?.is_syncing ? '同步中...' : '立即同步'}
            </Button>
          </div>
          {syncMutation.isError && (
            <p className="mt-2 text-[11px] text-red-600 dark:text-red-500">
              同步失败:{syncMutation.error instanceof Error ? syncMutation.error.message : '未知错误'}
            </p>
          )}
          {syncStatus?.results && syncStatus.results.length > 0 && (
            <div className="mt-2 space-y-1">
              {syncStatus.results.map((r) => (
                <div key={r.provider_code} className="flex items-center gap-2 text-[11px]">
                  <span className="font-medium">{r.provider_code}</span>
                  {r.success ? (
                    <>
                      <Badge variant="outline" className="text-[10px]">
                        {r.total_models} 总数
                      </Badge>
                      {r.new_models > 0 && (
                        <Badge className="border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-500 text-[10px]">
                          +{r.new_models} 新增
                        </Badge>
                      )}
                      {r.removed_models > 0 && (
                        <Badge className="border-transparent bg-red-500/15 text-red-600 dark:text-red-500 text-[10px]">
                          -{r.removed_models} 下架
                        </Badge>
                      )}
                      <span className="text-muted-foreground">{r.latency_ms}ms</span>
                    </>
                  ) : (
                    <Badge className="border-transparent bg-red-500/15 text-red-600 dark:text-red-500 text-[10px]">
                      失败:{r.error}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
            <Card key={p.provider}>
              <CardContent className="flex flex-wrap items-center gap-2 p-3">
                <div className="min-w-[140px] flex-1">
                  <p className="text-sm font-medium">{p.display_name || p.provider}</p>
                  <p className="text-[11px] text-muted-foreground">{p.provider}</p>
                </div>
                <span className="text-[11px] text-muted-foreground">{p.latency_ms}ms</span>
                <Badge variant="secondary" className="text-[11px]">
                  {p.model_count} {t('models')}
                </Badge>
                <Badge className={STATUS_BADGE[p.status]}>{p.status}</Badge>
                {p.category && (
                  <Badge variant="outline" className="text-[11px]">
                    {p.category}
                  </Badge>
                )}
                {p.free_quota && (
                  <span className="text-[11px] text-muted-foreground">{p.free_quota}</span>
                )}
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
  tone?: 'emerald' | 'red' | 'muted'
}) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-600 dark:text-emerald-500'
      : tone === 'red'
        ? 'text-red-600 dark:text-red-500'
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
