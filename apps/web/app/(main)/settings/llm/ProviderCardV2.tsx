'use client'

/**
 * ProviderCardV2 — 展开式 provider + 多个 model(2026-07-22 立)
 *
 * 单 provider 卡片,内部展示其下所有 model(子表),支持:
 *  - Provider 启用/停用
 *  - 连通测试(provider 级 / 单 model 级)
 *  - 拉取上游 model 列表
 *  - 添加/编辑/删除 model
 *  - 健康状态 + 30 天用量展示
 */
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  ArrowLeftRight,
  Activity,
  CheckCircle2,
  Copy,
  Edit3,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react'

import { Badge, Button, Card, CardContent, Switch } from '@ihui/ui-react'
import { Alert, Tooltip } from '@/components/feedback'
import { TruncatedText } from '@/components/common'
import { formatDate } from '@/lib/date-utils'

import {
  deleteModelV2,
  deleteProviderV2,
  fetchModelsV2,
  fetchUpstreamModelsV2,
  testModelV2,
  testProviderV2,
  toggleProviderV2,
} from './helpers-v2'
import type { PlatformTemplate, UpstreamModel } from './types'
import type { UserLlmModel, UserLlmProvider } from './types-v2'

interface Props {
  provider: UserLlmProvider
  template: PlatformTemplate | undefined
  onEditProvider: (p: UserLlmProvider) => void
  onAddModel: (p: UserLlmProvider) => void
  onEditModel: (p: UserLlmProvider, m: UserLlmModel) => void
  /** 深度功能:把 model 加入对比(2026-07-22 立) */
  onCompareModel: (p: UserLlmProvider, m: UserLlmModel) => void
  /** 深度功能:把 model 配置复制到其他 provider(2026-07-22 立) */
  onCopyModelToProvider: (p: UserLlmProvider, m: UserLlmModel) => void
  onDeleted: (id: number) => void
}

export function ProviderCardV2({
  provider,
  template,
  onEditProvider,
  onAddModel,
  onEditModel,
  onCompareModel,
  onCopyModelToProvider,
  onDeleted,
}: Props) {
  const t = useTranslations('llmSettings.v2')
  const qc = useQueryClient()
  const [showUpstream, setShowUpstream] = React.useState(false)
  const [upstreamModels, setUpstreamModels] = React.useState<UpstreamModel[]>([])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['v2-providers'] })

  // 该 provider 下的 models(子表数据)
  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ['v2-models', provider.id],
    queryFn: () => fetchModelsV2(provider.id),
    enabled: provider.models === undefined,
    initialData: provider.models ? { list: provider.models, total: provider.models.length } : undefined,
  })
  const models = modelsData?.list ?? provider.models ?? []

  // Provider 级测试
  const testProvMut = useMutation({
    mutationFn: () => testProviderV2(provider.id),
    onSuccess: (res) => {
      toast.success(t('testSuccess'), {
        description: res.message ?? t('testTimeOnly', { ms: res.responseMs ?? 0 }),
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      })
      invalidate()
    },
    onError: (e: Error) =>
      toast.error(t('testFailed'), {
        description: e.message,
        icon: <XCircle className="h-4 w-4 text-red-600" />,
      }),
  })

  // Provider 启用切换
  const toggleMut = useMutation({
    mutationFn: (enabled: boolean) => toggleProviderV2(provider.id, enabled),
    onSuccess: invalidate,
  })

  // 拉取上游 model
  const fetchMut = useMutation({
    mutationFn: () => fetchUpstreamModelsV2(provider.id),
    onSuccess: (res) => {
      setUpstreamModels(res.models)
      toast.success(res.message ?? t('fetchSuccess', { total: res.total }), {
        icon: <Sparkles className="h-4 w-4 text-amber-500" />,
      })
    },
    onError: (e: Error) => toast.error(t('fetchFailed'), { description: e.message }),
  })

  // 删除 provider
  const delProvMut = useMutation({
    mutationFn: () => deleteProviderV2(provider.id),
    onSuccess: () => {
      toast.success(t('providerDeleted'))
      invalidate()
      onDeleted(provider.id)
    },
    onError: (e: Error) => toast.error(t('deleteFailed'), { description: e.message }),
  })

  // Model 操作
  const delModelMut = useMutation({
    mutationFn: (mid: number) => deleteModelV2(provider.id, mid),
    onSuccess: () => {
      toast.success(t('modelDeleted'))
      invalidate()
    },
    onError: (e: Error) => toast.error(t('deleteFailed'), { description: e.message }),
  })

  const testModelMut = useMutation({
    mutationFn: (mid: number) => testModelV2(provider.id, mid),
    onSuccess: (res) => {
      toast.success(t('testSuccess'), {
        description: res.message ?? t('testTimeOnly', { ms: res.responseMs ?? 0 }),
      })
      invalidate()
    },
    onError: (e: Error) => toast.error(t('testFailed'), { description: e.message }),
  })

  function handleDeleteProvider() {
    if (!window.confirm(t('deleteProviderConfirm', { name: provider.name }))) return
    delProvMut.mutate()
  }

  function handleDeleteModel(m: UserLlmModel) {
    if (!window.confirm(t('deleteModelConfirm', { id: m.modelId }))) return
    delModelMut.mutate(m.id)
  }

  const tplName = template?.name ?? provider.providerCode
  const testFailed = provider.lastTestStatus === 'failed'
  const testOk = provider.lastTestStatus === 'success'
  const healthColor =
    provider.healthStatus === 'healthy'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
      : provider.healthStatus === 'degraded'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
        : provider.healthStatus === 'down'
          ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
          : 'bg-muted text-muted-foreground'

  return (
    <Card className={!provider.enabled ? 'opacity-60' : undefined}>
      <CardContent className="space-y-3 p-4">
        {/* Header: name + badges + actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm font-semibold">{provider.name}</h3>
              <Badge variant={provider.enabled ? 'default' : 'secondary'} className="text-xs">
                {provider.enabled ? t('enabled') : t('disabled')}
              </Badge>
              {!provider.hasApiKey ? (
                <Badge variant="outline" className="border-amber-500 text-xs text-amber-600">
                  {t('noKey')}
                </Badge>
              ) : null}
              <Badge variant="outline" className={`text-xs ${healthColor}`}>
                <Activity className="mr-1 inline h-3 w-3" />
                {provider.healthStatus}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {tplName} · {provider.apiFormat}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch
              checked={provider.enabled}
              onCheckedChange={(v) => {
                toggleMut.mutate(v)
                toast.success(v ? t('enabledToast') : t('disabledToast'))
              }}
              disabled={toggleMut.isPending}
            />
          </div>
        </div>

        {/* Info Row 1: baseUrl / format / health check time */}
        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <div className="min-w-0">
            <p className="text-muted-foreground">{t('baseUrl')}</p>
            <TruncatedText value={provider.baseUrl} mono className="font-mono" />
          </div>
          <div>
            <p className="text-muted-foreground">{t('lastTest')}</p>
            <p
              className={
                testOk
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : testFailed
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-muted-foreground'
              }
            >
              {testOk
                ? t('testSuccessWithTime', {
                    ms: provider.lastTestResponseMs ?? 0,
                    date: provider.lastTestedAt ? formatDate(provider.lastTestedAt) : '—',
                  })
                : provider.lastTestedAt
                  ? t('testFailedWithTime', {
                      date: provider.lastTestedAt ? formatDate(provider.lastTestedAt) : '—',
                    })
                  : t('untested')}
            </p>
          </div>
        </div>

        {/* 30d Usage stats(Phase 1 新深度功能) */}
        {(provider.usage30dTokens > 0 || provider.usage30dCostCents > 0) && (
          <div className="grid grid-cols-2 gap-2 rounded-md border border-dashed bg-muted/30 p-2 text-xs">
            <div>
              <p className="text-muted-foreground">{t('usage30d')}</p>
              <p className="font-mono">
                {(provider.usage30dTokens / 1000).toFixed(1)}K tokens
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('cost30d')}</p>
              <p className="font-mono">
                ${(provider.usage30dCostCents / 100).toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* Failed error message */}
        {testFailed && provider.lastTestError ? (
          <Alert variant="warning" description={provider.lastTestError} />
        ) : null}

        {/* Models list (子表) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              {t('modelsCount', { count: models.length })}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onAddModel(provider)}
            >
              <Plus className="mr-1 h-3 w-3" />
              {t('addModel')}
            </Button>
          </div>

          {modelsLoading ? (
            <div className="flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('loading')}
            </div>
          ) : models.length === 0 ? (
            <div className="rounded-md border border-dashed py-3 text-center text-xs text-muted-foreground">
              {t('noModels')}
              <Button
                type="button"
                variant="link"
                size="sm"
                className="ml-1 h-auto p-0 text-xs"
                onClick={() => onAddModel(provider)}
              >
                {t('addFirstModel')}
              </Button>
            </div>
          ) : (
            <ul className="space-y-1">
              {models.map((m) => (
                <li
                  key={m.id}
                  className={`flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2 py-1.5 text-xs ${
                    !m.enabled ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    {m.isDefault ? (
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                    ) : (
                      <span className="w-3" />
                    )}
                    <code className="truncate font-mono">
                      {m.displayName || m.modelId}
                    </code>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {(m.contextLength / 1000).toFixed(0)}K
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Tooltip content={t('test')}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => testModelMut.mutate(m.id)}
                        disabled={testModelMut.isPending || !provider.hasApiKey}
                      >
                        {testModelMut.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Zap className="h-3 w-3" />
                        )}
                      </Button>
                    </Tooltip>
                    <Tooltip content={t('compare')}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => onCompareModel(provider, m)}
                      >
                        <ArrowLeftRight className="h-3 w-3" />
                      </Button>
                    </Tooltip>
                    <Tooltip content={t('copyToProvider')}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => onCopyModelToProvider(provider, m)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </Tooltip>
                    <Tooltip content={t('edit')}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => onEditModel(provider, m)}
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                    </Tooltip>
                    <Tooltip content={t('delete')}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteModel(m)}
                        disabled={delModelMut.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </Tooltip>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upstream models (折叠) */}
        {showUpstream ? (
          <div className="rounded-md border bg-muted/30 p-2">
            {fetchMut.isPending ? (
              <div className="flex items-center justify-center gap-1.5 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('fetching')}
              </div>
            ) : upstreamModels.length === 0 ? (
              <div className="py-2 text-center text-xs text-muted-foreground">
                {t('noModelsReturned')}
              </div>
            ) : (
              <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs">
                {upstreamModels.slice(0, 30).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <code className="truncate font-mono">{m.id}</code>
                    {m.context_length ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {(m.context_length / 1000).toFixed(0)}K
                      </span>
                    ) : null}
                  </li>
                ))}
                {upstreamModels.length > 30 ? (
                  <li className="pt-1 text-center text-xs text-muted-foreground">
                    {t('more', { total: upstreamModels.length })}
                  </li>
                ) : null}
              </ul>
            )}
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
          <div className="flex flex-wrap items-center gap-1">
            <Tooltip content={!provider.hasApiKey ? t('needKeyFirst') : t('test')}>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => testProvMut.mutate()}
                disabled={testProvMut.isPending || !provider.hasApiKey}
              >
                {testProvMut.isPending ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-1 h-3 w-3" />
                )}
                {t('test')}
              </Button>
            </Tooltip>
            <Tooltip content={t('fetchModels')}>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setShowUpstream((s) => !s)
                  if (!showUpstream && upstreamModels.length === 0) fetchMut.mutate()
                }}
              >
                <Sparkles className="mr-1 h-3 w-3" />
                {showUpstream ? t('hideModels') : t('fetchModels')}
              </Button>
            </Tooltip>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onEditProvider(provider)}
            >
              <Edit3 className="mr-1 h-3 w-3" />
              {t('edit')}
            </Button>
          </div>
          <Tooltip content={t('delete')}>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleDeleteProvider}
              disabled={delProvMut.isPending}
            >
              {delProvMut.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
            </Button>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  )
}
