'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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

import {
  testConfig,
  toggleConfig,
  fetchUpstreamModels,
  deleteConfig,
  formatTime,
  maskKey,
} from './helpers'
import type { PlatformTemplate, UpstreamModel, UserLlmConfig } from './types'

interface Props {
  config: UserLlmConfig
  template: PlatformTemplate | undefined
  onEdit: (c: UserLlmConfig) => void
  onDeleted: (id: number) => void
}

export function LlmConfigCard({ config, template, onEdit, onDeleted }: Props) {
  const qc = useQueryClient()
  const [showModels, setShowModels] = React.useState(false)
  const [models, setModels] = React.useState<UpstreamModel[]>([])
  const [modelsLoaded, setModelsLoaded] = React.useState(false)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['user-llm-configs'] })

  const testMut = useMutation({
    mutationFn: () => testConfig(config.id),
    onSuccess: (res) => {
      toast.success('连通成功', {
        description: res.message || `耗时 ${res.responseMs ?? 0}ms`,
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      })
      invalidate()
    },
    onError: (e: Error) =>
      toast.error('连通失败', {
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
      toast.success(res.message || `已拉取 ${res.total} 个模型`, {
        icon: <Sparkles className="h-4 w-4 text-amber-500" />,
      })
    },
    onError: (e: Error) => toast.error('拉取失败', { description: e.message }),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteConfig(config.id),
    onSuccess: () => {
      toast.success('已删除')
      invalidate()
      onDeleted(config.id)
    },
    onError: (e: Error) => toast.error('删除失败', { description: e.message }),
  })

  function handleDelete() {
    if (!window.confirm(`确认删除「${config.name}」?`)) return
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
              <h3 className="truncate text-sm font-semibold">{config.name}</h3>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  config.enabled
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {config.enabled ? '启用' : '已停用'}
              </span>
              {!config.hasApiKey ? (
                <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                  未配置 Key
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
              toast.success(v ? '已启用' : '已停用')
            }}
            disabled={toggleMut.isPending}
          />
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">模型</p>
            <p className="truncate font-mono" title={config.modelIdForTest ?? ''}>
              {config.modelIdForTest ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">上下文</p>
            <p className="font-mono">
              {config.contextLength >= 1000
                ? `${(config.contextLength / 1000).toFixed(0)}K`
                : config.contextLength}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-muted-foreground">API Key</p>
            <p className="truncate font-mono">{maskKey(config.hasApiKey)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
          <div className="min-w-0">
            <p className="text-muted-foreground">Base URL</p>
            <p className="truncate font-mono" title={config.baseUrl}>
              {config.baseUrl}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">最近测试</p>
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
                ? `成功 ${config.lastTestResponseMs ?? 0}ms · ${formatTime(config.lastTestedAt)}`
                : testFailed
                  ? `失败 · ${formatTime(config.lastTestedAt)}`
                  : '未测试'}
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
                拉取中...
              </div>
            ) : models.length === 0 ? (
              <div className="py-2 text-center text-xs text-muted-foreground">
                {modelsLoaded ? '该平台未返回模型' : '点击下方按钮拉取'}
              </div>
            ) : (
              <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs">
                {models.slice(0, 30).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <code className="truncate font-mono">{m.id}</code>
                    {m.context_length ? (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {(m.context_length / 1000).toFixed(0)}K
                      </span>
                    ) : null}
                  </li>
                ))}
                {models.length > 30 ? (
                  <li className="pt-1 text-center text-[10px] text-muted-foreground">
                    共 {models.length} 个,展开省略
                  </li>
                ) : null}
              </ul>
            )}
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => fetchMut.mutate()}
                disabled={fetchMut.isPending}
              >
                {fetchMut.isPending ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Search className="mr-1 h-3 w-3" />
                )}
                重新拉取
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
              title={!config.hasApiKey ? '请先配置 API Key' : '测试连通'}
            >
              {testMut.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <ShieldCheck className="mr-1 h-3 w-3" />
              )}
              测试
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
              title="获取上游模型列表"
            >
              <Sparkles className="mr-1 h-3 w-3" />
              {showModels ? '隐藏模型' : '拉取模型'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onEdit(config)}
            >
              <Edit3 className="mr-1 h-3 w-3" />
              编辑
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            title="删除"
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
