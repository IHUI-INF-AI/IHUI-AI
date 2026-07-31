'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  fetchModelSyncHealth,
  fetchModelSyncHistory,
  fetchModelSyncStatus,
  fetchProvidersHealth,
  triggerModelSync,
} from '@ihui/api-client'
import {
  Card,
  CardContent,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { Loader2, RefreshCw, ChevronRight, History, Eye, Search } from 'lucide-react'

import type {
  GatewayProvider,
  ModelSyncResult,
  ModelSyncHistoryRecord,
  ProviderStatus,
} from './types'

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

// F4.3 dry-run 预览结果聚合(供 Dialog 渲染)
interface DryRunPreview {
  totalNew: number
  totalRemoved: number
  byProvider: Array<{
    provider_code: string
    new_model_ids: string[]
    removed_model_ids: string[]
  }>
}

export function ProvidersHealthTab() {
  const t = useTranslations('settings.gateway.providers')
  const tm = useTranslations('settings.gateway.modelSync')

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['gateway-providers-health'],
    queryFn: fetchProvidersHealth,
    refetchInterval: 30_000,
  })

  // F4.9 同步中时 2s 高频刷新,空闲 10s(用函数式 refetchInterval 避免自引用)
  const { data: syncStatus } = useQuery({
    queryKey: ['model-sync-status'],
    queryFn: fetchModelSyncStatus,
    refetchInterval: (query) => (query.state.data?.is_syncing ? 2_000 : 10_000),
  })

  const queryClient = useQueryClient()

  // 全局立即同步
  const syncMutation = useMutation({
    mutationFn: () => triggerModelSync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-sync-status'] })
      queryClient.invalidateQueries({ queryKey: ['gateway-providers-health'] })
      queryClient.invalidateQueries({ queryKey: ['llm-models'] })
      queryClient.invalidateQueries({ queryKey: ['model-sync-health'] })
    },
  })

  // F4.3 dry-run 预览
  const [dryRunOpen, setDryRunOpen] = React.useState(false)
  const [dryRunPreview, setDryRunPreview] = React.useState<DryRunPreview | null>(null)
  const dryRunMutation = useMutation({
    mutationFn: () => triggerModelSync({ dry_run: true }),
    onSuccess: (status) => {
      const byProvider = (status.results ?? []).map((r) => ({
        provider_code: r.provider_code,
        new_model_ids: r.new_model_ids ?? [],
        removed_model_ids: r.removed_model_ids ?? [],
      }))
      setDryRunPreview({
        totalNew: status.total_new_models,
        totalRemoved: status.total_removed_models,
        byProvider,
      })
      setDryRunOpen(true)
    },
  })

  // F4.2 单 provider 同步(in-flight provider 集合,spinner 只显示在对应行)
  const [syncingProviders, setSyncingProviders] = React.useState<Set<string>>(new Set())
  const syncProviderMutation = useMutation({
    mutationFn: (provider: string) => {
      setSyncingProviders((prev) => new Set(prev).add(provider))
      return triggerModelSync({ provider })
    },
    onSuccess: (_data, provider) => {
      setSyncingProviders((prev) => {
        const next = new Set(prev)
        next.delete(provider)
        return next
      })
      queryClient.invalidateQueries({ queryKey: ['model-sync-status'] })
      queryClient.invalidateQueries({ queryKey: ['gateway-providers-health'] })
      queryClient.invalidateQueries({ queryKey: ['llm-models'] })
      queryClient.invalidateQueries({ queryKey: ['model-sync-health'] })
    },
    onError: (_err, provider) => {
      setSyncingProviders((prev) => {
        const next = new Set(prev)
        next.delete(provider)
        return next
      })
    },
  })

  const [filter, setFilter] = React.useState<'all' | ProviderStatus>('all')

  const summary = data?.summary ?? { total: 0, ok: 0, invalid_key: 0, unreachable: 0 }
  const providers: GatewayProvider[] = React.useMemo(() => {
    const list = data?.providers ?? []
    return filter === 'all' ? list : list.filter((p) => p.status === filter)
  }, [data, filter])

  const timeFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [],
  )

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

      {/* 模型自动同步 + F4.3 dry-run 预览按钮 + F4.9 进度条 */}
      <Card>
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{tm('title')}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {syncStatus?.last_sync_at ? (
                  <>
                    {tm('lastSync')}: {timeFmt.format(new Date(syncStatus.last_sync_at))} ·{' '}
                    {syncStatus.total_providers} {tm('providers')} · +{syncStatus.total_new_models}{' '}
                    {tm('newModels')} / -{syncStatus.total_removed_models} {tm('removedModels')} ·{' '}
                    {syncStatus.last_sync_duration_ms}ms
                  </>
                ) : (
                  tm('neverSynced')
                )}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => dryRunMutation.mutate()}
                disabled={
                  dryRunMutation.isPending ||
                  syncMutation.isPending ||
                  syncStatus?.is_syncing === true
                }
                className="h-7 px-2.5 text-xs"
                title={tm('previewSyncTooltip')}
              >
                {dryRunMutation.isPending ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Eye className="mr-1 h-3.5 w-3.5" />
                )}
                {tm('previewSync')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending || syncStatus?.is_syncing === true}
                className="h-7 px-2.5 text-xs"
              >
                {syncMutation.isPending || syncStatus?.is_syncing ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                )}
                {syncStatus?.is_syncing ? tm('syncing') : tm('syncNow')}
              </Button>
            </div>
          </div>
          {/* F4.9 同步进度条(同步中展示,indeterminate pulse;后端 results 非逐 provider 实时更新,故不显示假百分比) */}
          {syncStatus?.is_syncing && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{tm('syncing')}</span>
                <span>
                  {syncStatus.total_providers} {tm('providers')}
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded bg-muted">
                <div className="h-full w-full animate-pulse bg-primary" />
              </div>
            </div>
          )}
          {(syncMutation.isError || dryRunMutation.isError) && (
            <p className="text-[11px] text-red-600 dark:text-red-500">
              {syncMutation.isError
                ? `${tm('syncFailed')}: ${syncMutation.error instanceof Error ? syncMutation.error.message : tm('unknownError')}`
                : `${tm('previewFailed')}: ${dryRunMutation.error instanceof Error ? dryRunMutation.error.message : tm('unknownError')}`}
            </p>
          )}
          {/* F4.1 同步详情可展开(每个 provider 一行,点击展开看 new_model_ids/removed_model_ids) */}
          {syncStatus?.results && syncStatus.results.length > 0 && (
            <div className="space-y-0.5">
              {syncStatus.results.map((r) => (
                <SyncDiffDetail key={r.provider_code} result={r} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* F4.13 同步健康度面板(后端未实现 GET /llm/models/sync/health 时静默降级,不渲染) */}
      <SyncHealthPanel />

      {/* F4.4 同步历史时间轴(默认折叠,展开时拉取最近 10 条) */}
      <SyncHistoryTimeline />

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

      {/* Provider list(F4.2 每行加单 provider 同步按钮) */}
      {!isLoading && !error && (
        <div className="space-y-2">
          {providers.map((p) => (
            <ProviderRow
              key={p.provider}
              provider={p}
              t={t}
              isSyncing={syncingProviders.has(p.provider)}
              onSync={() => syncProviderMutation.mutate(p.provider)}
              syncError={
                syncProviderMutation.isError &&
                syncProviderMutation.variables === p.provider &&
                syncProviderMutation.error instanceof Error
                  ? syncProviderMutation.error
                  : undefined
              }
            />
          ))}
          {providers.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">—</p>
          )}
        </div>
      )}

      {/* F4.3 dry-run 预览 Dialog(内含 F4.10 SyncDiffCard) */}
      <DryRunDialog
        open={dryRunOpen}
        onOpenChange={setDryRunOpen}
        preview={dryRunPreview}
        onConfirm={() => {
          setDryRunOpen(false)
          syncMutation.mutate()
        }}
        isSyncing={syncMutation.isPending}
      />
    </div>
  )
}

// F4.1 同步详情可展开子组件(显示 new_model_ids/removed_model_ids 列表)
function SyncDiffDetail({ result }: { result: ModelSyncResult }) {
  const tm = useTranslations('settings.gateway.modelSync')
  const [open, setOpen] = React.useState(false)
  const newIds = result.new_model_ids ?? []
  const removedIds = result.removed_model_ids ?? []
  const hasDiff = newIds.length > 0 || removedIds.length > 0
  return (
    <div className="rounded">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-2 rounded px-1 py-0.5 text-left text-[11px] transition-colors hover:bg-accent/50"
        aria-expanded={open}
      >
        <ChevronRight
          className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span className="font-medium">{result.provider_code}</span>
        {result.success ? (
          <>
            <Badge variant="outline" className="text-[10px]">
              {result.total_models} {tm('totalModels')}
            </Badge>
            {result.new_models > 0 && (
              <Badge className="border-transparent bg-emerald-500/15 text-[10px] text-emerald-600 dark:text-emerald-500">
                +{result.new_models} {tm('newModels')}
              </Badge>
            )}
            {result.removed_models > 0 && (
              <Badge className="border-transparent bg-red-500/15 text-[10px] text-red-600 dark:text-red-500">
                -{result.removed_models} {tm('removedModels')}
              </Badge>
            )}
            <span className="text-muted-foreground">{result.latency_ms}ms</span>
          </>
        ) : (
          <Badge className="border-transparent bg-red-500/15 text-[10px] text-red-600 dark:text-red-500">
            {tm('failed')}: {result.error}
          </Badge>
        )}
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-1 pb-1">
          {hasDiff ? (
            <>
              {newIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-500">
                    {tm('newModels')}:
                  </span>
                  {newIds.map((id) => (
                    <Badge
                      key={`new-${id}`}
                      className="border-transparent bg-emerald-500/15 font-mono text-[10px] text-emerald-600 dark:text-emerald-500"
                    >
                      {id}
                    </Badge>
                  ))}
                </div>
              )}
              {removedIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[10px] text-red-600 dark:text-red-500">
                    {tm('removedModels')}:
                  </span>
                  {removedIds.map((id) => (
                    <Badge
                      key={`rm-${id}`}
                      className="border-transparent bg-red-500/15 font-mono text-[10px] text-red-600 dark:text-red-500"
                    >
                      {id}
                    </Badge>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-[10px] text-muted-foreground">{tm('noDiff')}</p>
          )}
        </div>
      )}
    </div>
  )
}

// F4.2 单 provider 行(含单 provider 同步按钮)
function ProviderRow({
  provider,
  t,
  isSyncing,
  onSync,
  syncError,
}: {
  provider: GatewayProvider
  t: ReturnType<typeof useTranslations>
  isSyncing: boolean
  onSync: () => void
  syncError?: Error
}) {
  const tm = useTranslations('settings.gateway.modelSync')
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 p-3">
        <div className="min-w-[140px] flex-1">
          <p className="text-sm font-medium">{provider.display_name || provider.provider}</p>
          <p className="text-[11px] text-muted-foreground">{provider.provider}</p>
        </div>
        <span className="text-[11px] text-muted-foreground">{provider.latency_ms}ms</span>
        <Badge variant="secondary" className="text-[11px]">
          {provider.model_count} {t('models')}
        </Badge>
        <Badge className={STATUS_BADGE[provider.status]}>{provider.status}</Badge>
        {provider.category && (
          <Badge variant="outline" className="text-[11px]">
            {provider.category}
          </Badge>
        )}
        {provider.free_quota && (
          <span className="text-[11px] text-muted-foreground">{provider.free_quota}</span>
        )}
        {provider.is_in_cooldown && (
          <Badge className="border-transparent bg-red-500/15 text-[11px] text-red-600 dark:text-red-500">
            {t('cooldown')} · {provider.consecutive_failures} {t('failures')}
          </Badge>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onSync}
          disabled={isSyncing}
          className="h-7 px-2.5 text-xs"
          title={tm('syncProviderOnly', { provider: provider.provider })}
        >
          {isSyncing ? (
            <Loader2 className="h-3.5 w-3.5" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          <span className="ml-1">{tm('sync')}</span>
        </Button>
        {syncError && (
          <p className="w-full text-[10px] text-red-600 dark:text-red-500">{syncError.message}</p>
        )}
      </CardContent>
    </Card>
  )
}

// F4.10 模型差异卡片(搜索 + tab 过滤,用于 DryRunDialog)
function SyncDiffCard({ preview }: { preview: DryRunPreview }) {
  const tm = useTranslations('settings.gateway.modelSync')
  const [tab, setTab] = React.useState<'new' | 'removed' | 'all'>('new')
  const [search, setSearch] = React.useState('')

  const items = React.useMemo(() => {
    const all: Array<{ id: string; provider: string; type: 'new' | 'removed' }> = [
      ...preview.byProvider.flatMap((p) =>
        p.new_model_ids.map((id) => ({ id, provider: p.provider_code, type: 'new' as const })),
      ),
      ...preview.byProvider.flatMap((p) =>
        p.removed_model_ids.map((id) => ({
          id,
          provider: p.provider_code,
          type: 'removed' as const,
        })),
      ),
    ]
    const q = search.trim().toLowerCase()
    return all.filter(
      (it) => (tab === 'all' || it.type === tab) && (!q || it.id.toLowerCase().includes(q)),
    )
  }, [preview, tab, search])

  const tabs: Array<{ value: 'new' | 'removed' | 'all'; label: string; count: number }> = [
    { value: 'new', label: tm('newModels'), count: preview.totalNew },
    { value: 'removed', label: tm('removedModels'), count: preview.totalRemoved },
    { value: 'all', label: tm('all'), count: preview.totalNew + preview.totalRemoved },
  ]

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map((tb) => (
          <Button
            key={tb.value}
            size="sm"
            variant={tab === tb.value ? 'default' : 'outline'}
            onClick={() => setTab(tb.value)}
            className="h-7 px-2.5 text-xs"
          >
            {tb.label} ({tb.count})
          </Button>
        ))}
        <div className="relative ml-auto w-44">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tm('search')}
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto rounded bg-muted/40 p-2">
        {items.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">{tm('noChanges')}</p>
        ) : (
          items.map((it) => (
            <div
              key={`${it.type}-${it.provider}-${it.id}`}
              className="flex items-center gap-2 text-[11px]"
            >
              <Badge
                className={
                  it.type === 'new'
                    ? 'border-transparent bg-emerald-500/15 text-[10px] text-emerald-600 dark:text-emerald-500'
                    : 'border-transparent bg-red-500/15 text-[10px] text-red-600 dark:text-red-500'
                }
              >
                {it.type === 'new' ? tm('newModels') : tm('removedModels')}
              </Badge>
              <span className="font-mono">{it.id}</span>
              <Badge variant="outline" className="ml-auto text-[10px]">
                {it.provider}
              </Badge>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// F4.3 dry-run 预览 Dialog(内含 F4.10 SyncDiffCard)
function DryRunDialog({
  open,
  onOpenChange,
  preview,
  onConfirm,
  isSyncing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preview: DryRunPreview | null
  onConfirm: () => void
  isSyncing: boolean
}) {
  const tm = useTranslations('settings.gateway.modelSync')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tm('dryRunTitle')}</DialogTitle>
        </DialogHeader>
        {preview ? (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-500">
                {tm('willAddModels', { count: preview.totalNew })}
              </Badge>
              <Badge className="border-transparent bg-red-500/15 text-red-600 dark:text-red-500">
                {tm('willRemoveModels', { count: preview.totalRemoved })}
              </Badge>
            </div>
            <SyncDiffCard preview={preview} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{tm('noData')}</p>
        )}
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSyncing}
          >
            {tm('cancel')}
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={isSyncing}>
            {isSyncing && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {tm('confirmSync')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// F4.13 同步健康度面板(后端未实现 GET /llm/models/sync/health 时静默降级,不渲染)
function SyncHealthPanel() {
  const tm = useTranslations('settings.gateway.modelSync')
  const { data, isError } = useQuery({
    queryKey: ['model-sync-health'],
    queryFn: fetchModelSyncHealth,
    retry: false,
    staleTime: 30_000,
  })

  // 后端未实现(404 等)→ 静默降级,不渲染面板
  if (isError || !data) return null

  const threshold = data.failure_threshold > 0 ? data.failure_threshold : 3
  const entries = Object.entries(data.failure_counters).sort((a, b) => b[1] - a[1])
  const disabledExtra = data.permanently_disabled.filter((d) => !(d in data.failure_counters))

  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{tm('health')}</p>
          <span className="text-[11px] text-muted-foreground">
            {tm('threshold')}: {threshold}
          </span>
        </div>
        {entries.length === 0 && disabledExtra.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">{tm('noProvidersDisabled')}</p>
        ) : (
          <div className="space-y-1">
            {entries.map(([code, count]) => {
              const isDisabled = data.permanently_disabled.includes(code)
              const danger = count >= threshold || isDisabled
              return (
                <div key={code} className="flex items-center gap-2 text-[11px]">
                  <span className="font-medium">{code}</span>
                  <span
                    className={
                      danger ? 'text-red-600 dark:text-red-500' : 'text-muted-foreground'
                    }
                  >
                    {tm('failureCounter')}: {count}
                  </span>
                  {isDisabled && (
                    <Badge className="ml-auto border-transparent bg-muted text-[10px] text-muted-foreground">
                      {tm('disabled')}
                    </Badge>
                  )}
                </div>
              )
            })}
            {disabledExtra.map((code) => (
              <div key={`d-${code}`} className="flex items-center gap-2 text-[11px]">
                <span className="font-medium">{code}</span>
                <Badge className="ml-auto border-transparent bg-muted text-[10px] text-muted-foreground">
                  {tm('disabled')}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// F4.4 同步历史时间轴(默认折叠,展开时拉取最近 10 条)
function SyncHistoryTimeline() {
  const tm = useTranslations('settings.gateway.modelSync')
  const [open, setOpen] = React.useState(false)
  const { data, isLoading, error } = useQuery({
    queryKey: ['model-sync-history'],
    queryFn: () => fetchModelSyncHistory(10),
    enabled: open,
    staleTime: 30_000,
  })

  const timeFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [],
  )

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded px-1 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={open}
      >
        <History className="h-3.5 w-3.5" />
        <span>{tm('history')}</span>
        <ChevronRight
          className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && (
        <div className="relative ml-2 mt-2 space-y-2 pl-4">
          {/* 时间轴线(absolute span,非单边 border) */}
          <span
            aria-hidden
            className="absolute bottom-0 left-0 top-0 w-px bg-border/60"
          />
          {isLoading ? (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {tm('loading')}
            </div>
          ) : error ? (
            <p className="py-2 text-xs text-red-600 dark:text-red-500">
              {error instanceof Error ? error.message : tm('loadFailed')}
            </p>
          ) : data && data.length > 0 ? (
            data.map((rec) => (
              <SyncHistoryItem key={rec.id} rec={rec} timeFmt={timeFmt} />
            ))
          ) : (
            <p className="py-2 text-xs text-muted-foreground">{tm('noHistory')}</p>
          )}
        </div>
      )}
    </div>
  )
}

function SyncHistoryItem({
  rec,
  timeFmt,
}: {
  rec: ModelSyncHistoryRecord
  timeFmt: Intl.DateTimeFormat
}) {
  const tm = useTranslations('settings.gateway.modelSync')
  const startedAt = rec.sync_started_at ? new Date(rec.sync_started_at) : null
  return (
    <div className="relative">
      {/* 时间轴圆点(装饰点,豁免 rounded-full) */}
      <span
        aria-hidden
        className="absolute -left-4 top-1.5 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-border"
      />
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="tabular-nums text-muted-foreground">
          {startedAt ? timeFmt.format(startedAt) : '—'}
        </span>
        <span className="font-medium">{rec.provider_code}</span>
        {rec.success ? (
          <Badge className="border-transparent bg-emerald-500/15 text-[10px] text-emerald-600 dark:text-emerald-500">
            {tm('success')}
          </Badge>
        ) : (
          <Badge className="border-transparent bg-red-500/15 text-[10px] text-red-600 dark:text-red-500">
            {tm('failed')}
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px]">
          {rec.sync_type}
        </Badge>
        {rec.new_models > 0 && (
          <span className="text-emerald-600 dark:text-emerald-500">+{rec.new_models}</span>
        )}
        {rec.removed_models > 0 && (
          <span className="text-red-600 dark:text-red-500">-{rec.removed_models}</span>
        )}
        <span className="text-muted-foreground">{rec.latency_ms}ms</span>
      </div>
      {!rec.success && rec.error && (
        <p className="mt-0.5 text-[10px] text-red-600 dark:text-red-500">{rec.error}</p>
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
