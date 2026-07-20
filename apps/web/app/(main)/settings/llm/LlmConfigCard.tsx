'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Edit3,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react'

import { Button, Card, CardContent, Switch } from '@ihui/ui'
import { Alert } from '@/components/feedback'

import { testConfig, toggleConfig, fetchUpstreamModels, deleteConfig, maskKey } from './helpers'
import { formatDate } from '@/lib/date-utils'
import type { PlatformTemplate, UpstreamModel, UserLlmConfig } from './types'

interface Props {
  config: UserLlmConfig
  template: PlatformTemplate | undefined
  onEdit: (c: UserLlmConfig) => void
  onDeleted: (id: number) => void
}

export function LlmConfigCard({ config, template, onEdit, onDeleted }: Props) {
  const t = useTranslations('llmSettings.card')
  const qc = useQueryClient()
  const [showModels, setShowModels] = React.useState(false)
  const [models, setModels] = React.useState<UpstreamModel[]>([])
  const [modelsLoaded, setModelsLoaded] = React.useState(false)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['user-llm-configs'] })

  const testMut = useMutation({
    mutationFn: () => testConfig(config.id),
    onSuccess: (res) => {
      toast.success(t('testSuccess'), {
        description: res.message || t('testTimeOnly', { ms: res.responseMs ?? 0 }),
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

  const toggleMut = useMutation({
    mutationFn: (enabled: boolean) => toggleConfig(config.id, enabled),
    onSuccess: invalidate,
  })

  const fetchMut = useMutation({
    mutationFn: () => fetchUpstreamModels(config.id),
    onSuccess: (res) => {
      setModels(res.models)
      setModelsLoaded(true)
      toast.success(res.message || t('fetchSuccess', { total: res.total }), {
        icon: <Sparkles className="h-4 w-4 text-amber-500" />,
      })
    },
    onError: (e: Error) => toast.error(t('fetchFailed'), { description: e.message }),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteConfig(config.id),
    onSuccess: () => {
      toast.success(t('deletedToast'))
      invalidate()
      onDeleted(config.id)
    },
    onError: (e: Error) => toast.error(t('deleteFailed'), { description: e.message }),
  })

  function handleDelete() {
    if (!window.confirm(t('deleteConfirm', { name: config.name }))) return
    deleteMut.mutate()
  }

  const tplName = template?.name ?? config.providerCode
  const testFailed = config.lastTestStatus === 'failed'
  const testOk = config.lastTestStatus === 'success'

  return (
    <Card className={!config.enabled ? 'opacity-60' : undefined}>
      <CardContent className="space-y-3 p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="line-clamp-2 text-sm font-semibold">{config.name}</h3>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                  config.enabled
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {config.enabled ? t('enabled') : t('disabled')}
              </span>
              {!config.hasApiKey ? (
                <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                  {t('noKey')}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {tplName} · {config.apiFormat}
            </p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(v) => {
              toggleMut.mutate(v)
              toast.success(v ? t('enabledToast') : t('disabledToast'))
            }}
            disabled={toggleMut.isPending}
          />
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">{t('model')}</p>
            <p className="truncate font-mono" title={config.modelIdForTest ?? ''}>
              {config.modelIdForTest ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('context')}</p>
            <p className="font-mono">
              {config.contextLength >= 1000
                ? `${(config.contextLength / 1000).toFixed(0)}K`
                : config.contextLength}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-muted-foreground">{t('apiKey')}</p>
            <p className="truncate font-mono">{maskKey(config.hasApiKey)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <div className="min-w-0">
            <p className="text-muted-foreground">{t('baseUrl')}</p>
            <p className="truncate font-mono" title={config.baseUrl}>
              {config.baseUrl}
            </p>
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
                    ms: config.lastTestResponseMs ?? 0,
                    date: config.lastTestedAt ? formatDate(config.lastTestedAt) : '—',
                  })
                : config.lastTestedAt
                  ? t('testFailedWithTime', {
                      date: config.lastTestedAt ? formatDate(config.lastTestedAt) : '—',
                    })
                  : t('untested')}
            </p>
          </div>
        </div>

        {/* Failed error message */}
        {testFailed && config.lastTestError ? (
          <Alert variant="warning" description={config.lastTestError} />
        ) : null}

        {/* Models panel */}
        {showModels ? (
          <div className="rounded-md border bg-muted/30 p-2">
            {fetchMut.isPending ? (
              <div className="flex items-center justify-center gap-1.5 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('fetching')}
              </div>
            ) : models.length === 0 ? (
              <div className="py-2 text-center text-xs text-muted-foreground">
                {modelsLoaded ? t('noModelsReturned') : t('clickToFetch')}
              </div>
            ) : (
              <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs">
                {models.slice(0, 30).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <code className="truncate font-mono">{m.id}</code>
                    {m.context_length ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {(m.context_length / 1000).toFixed(0)}K
                      </span>
                    ) : null}
                  </li>
                ))}
                {models.length > 30 ? (
                  <li className="pt-1 text-center text-xs text-muted-foreground">
                    {t('more', { total: models.length })}
                  </li>
                ) : null}
              </ul>
            )}
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => fetchMut.mutate()}
                disabled={fetchMut.isPending}
              >
                {fetchMut.isPending ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Search className="mr-1 h-3 w-3" />
                )}
                {t('refetch')}
              </Button>
            </div>
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => testMut.mutate()}
              disabled={testMut.isPending || !config.hasApiKey}
              title={!config.hasApiKey ? t('needKeyFirst') : t('test')}
            >
              {testMut.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <ShieldCheck className="mr-1 h-3 w-3" />
              )}
              {t('test')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setShowModels((s) => !s)
                if (!showModels && models.length === 0 && !modelsLoaded) {
                  fetchMut.mutate()
                }
              }}
              title={t('fetchModels')}
            >
              <Sparkles className="mr-1 h-3 w-3" />
              {showModels ? t('hideModels') : t('fetchModels')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onEdit(config)}
            >
              <Edit3 className="mr-1 h-3 w-3" />
              {t('edit')}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            title={t('delete')}
          >
            {deleteMut.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
