'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Wand2,
  XCircle,
} from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from '@ihui/ui-react'

import { previewTest, fetchUpstreamModels } from './helpers'
import type { FormState, PlatformTemplate, UpstreamModel } from './types'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'

interface Props {
  open: boolean
  form: FormState
  setForm: (f: FormState) => void
  templates: PlatformTemplate[]
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

/** 平台选择卡(模板列表) */
function TemplateGrid({
  templates,
  current,
  onPick,
}: {
  templates: PlatformTemplate[]
  current: string
  onPick: (t: PlatformTemplate) => void
}) {
  const t = useTranslations('llmSettings.dialog')
  return (
    <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((tpl) => {
        const active = tpl.code === current
        return (
          <button
            key={tpl.code}
            type="button"
            onClick={() => onPick(tpl)}
            className={cn(
              'group flex flex-col gap-1 rounded-lg border p-2.5 text-left transition-colors',
              active
                ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                : 'hover:border-primary/40 hover:bg-accent/50',
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{tpl.name}</span>
              {tpl.isOfficial ? (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  {t('official')}
                </span>
              ) : (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {t('self')}
                </span>
              )}
            </div>
            <p className="line-clamp-1 text-xs text-muted-foreground">{tpl.description}</p>
            <p className="truncate font-mono text-xs text-muted-foreground/70">{tpl.baseUrl}</p>
          </button>
        )
      })}
    </div>
  )
}

/** 拉取到的模型列表 */
function ModelsList({ models }: { models: UpstreamModel[] }) {
  const t = useTranslations('llmSettings.dialog')
  const [filter, setFilter] = React.useState('')
  const filtered = React.useMemo(() => {
    if (!filter) return models
    const k = filter.toLowerCase()
    return models.filter((m) => m.id.toLowerCase().includes(k))
  }, [models, filter])

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('filterModels')}
          className="h-8 pl-8 text-xs"
        />
      </div>
      <div className="max-h-48 overflow-y-auto rounded-md border">
        {filtered.length === 0 ? (
          <div className="p-3 text-center text-xs text-muted-foreground">{t('noMatch')}</div>
        ) : (
          <ul className="divide-y">
            {filtered.map((m) => (
              <li
                key={m.id}
                className="group flex items-center justify-between gap-2 px-2 py-1.5 text-xs hover:bg-accent/50"
              >
                <div className="flex flex-1 items-center gap-2 overflow-hidden">
                  <code className="truncate font-mono">{m.id}</code>
                  {m.context_length ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {(m.context_length / 1000).toFixed(0)}K
                    </span>
                  ) : null}
                </div>
                <Tooltip content={t('copyModelId')}>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(m.id)
                      toast.success(t('copied', { id: m.id }))
                    }}
                    className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </Tooltip>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t('copyTip')}</p>
    </div>
  )
}

export function LlmConfigDialog({
  open,
  form,
  setForm,
  templates,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('llmSettings.dialog')
  const tCard = useTranslations('llmSettings.card')
  const [showKey, setShowKey] = React.useState(false)
  const [models, setModels] = React.useState<UpstreamModel[]>([])

  const tpl = React.useMemo(
    () => templates.find((tplItem) => tplItem.code === form.templateCode) ?? templates[0],
    [templates, form.templateCode],
  )

  // 切换模板 → 自动套默认值
  function pickTemplate(tpl: PlatformTemplate) {
    setForm({
      ...form,
      templateCode: tpl.code,
      modelId: form.modelId || tpl.defaultModelId,
      contextLength: String(
        form.contextLength === '32000' ? tpl.defaultContextLength : form.contextLength,
      ),
      baseUrlOverride: tpl.code === 'custom' ? form.baseUrlOverride : '',
    })
    setModels([])
  }

  // 预览测试(未保存也能用)
  const previewMut = useMutation({
    mutationFn: () => {
      if (!tpl) throw new Error(t('previewTestSelect'))
      if (!form.apiKey) throw new Error(t('previewTestKey'))
      if (!form.modelId.trim()) throw new Error(t('previewTestModel'))
      return previewTest({
        templateCode: form.templateCode,
        apiKey: form.apiKey,
        modelId: form.modelId.trim(),
        baseUrlOverride: form.baseUrlOverride.trim() || undefined,
      })
    },
    onSuccess: (res) => {
      toast.success(res.message || t('previewTestSuccess'), {
        description: `${tCard('testTimeOnly', { ms: res.responseMs ?? 0 })}${res.modelEcho ? ` · ${res.modelEcho}` : ''}`,
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      })
    },
    onError: (e: Error) => {
      toast.error(t('previewTestFailed'), {
        description: e.message,
        icon: <XCircle className="h-4 w-4 text-red-600" />,
      })
    },
  })

  // 拉取模型(仅已保存的配置可用)
  const fetchMut = useMutation({
    mutationFn: () => {
      if (!form.id) throw new Error(t('saveBeforeFetchErr'))
      return fetchUpstreamModels(form.id)
    },
    onSuccess: (res) => {
      setModels(res.models)
      toast.success(res.message || tCard('fetchSuccess', { total: res.total }), {
        icon: <Sparkles className="h-4 w-4 text-amber-500" />,
      })
    },
    onError: (e: Error) => {
      toast.error(tCard('fetchFailed'), { description: e.message })
      setModels([])
    },
  })

  const isCustom = tpl?.code === 'custom'
  const showBaseUrl = isCustom || !!form.baseUrlOverride

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            {form.id ? t('editTitle') : t('newTitle')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* 平台模板选择 */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <Sparkles className="h-3.5 w-3.5" />
              {t('templateLabel')}
            </Label>
            <TemplateGrid templates={templates} current={form.templateCode} onPick={pickTemplate} />
            {tpl ? (
              <p className="text-xs text-muted-foreground">
                {t('baseUrlLabel')}{' '}
                <code className="font-mono">
                  {form.baseUrlOverride || tpl.baseUrl || t('needSelfUrl')}
                </code>
                {' · '}
                {t('protocolLabel')} <code className="font-mono">{tpl.apiFormat}</code>
                {tpl.docsUrl ? (
                  <>
                    {' · '}
                    <a
                      href={tpl.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      {t('docsLabel')}
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>

          {/* 名称 / 描述 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="llm-name" className="text-sm">
                {t('nameLabel')}
              </Label>
              <Input
                id="llm-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={tpl?.name ?? t('namePlaceholder')}
                maxLength={64}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="llm-ctx" className="text-sm">
                {t('contextLabel')}
              </Label>
              <Input
                id="llm-ctx"
                type="number"
                min={512}
                max={2000000}
                step={512}
                value={form.contextLength}
                onChange={(e) => setForm({ ...form, contextLength: e.target.value })}
                placeholder="32000"
              />
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <Label htmlFor="llm-key" className="flex items-center gap-1.5 text-sm">
              <KeyRound className="h-3.5 w-3.5" />
              {t('apiKeyLabel')}
              {form.id ? (
                <span className="text-xs text-muted-foreground">{t('keepEmpty')}</span>
              ) : null}
            </Label>
            <div className="relative">
              <Input
                id="llm-key"
                type={showKey ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder={form.id ? t('keyPlaceholderEdit') : t('keyPlaceholderNew')}
                autoComplete="off"
                className="pr-10 font-mono text-sm"
              />
              <Tooltip content={showKey ? t('hideKey') : t('showKey')}>
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </Tooltip>
            </div>
          </div>

          {/* 模型 ID + 拉取 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="llm-model" className="text-sm">
                {t('modelIdLabel')}
              </Label>
              {form.id ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => fetchMut.mutate()}
                  disabled={fetchMut.isPending}
                >
                  {fetchMut.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Search className="mr-1 h-3 w-3" />
                  )}
                  {t('fetchUpstream')}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">{t('saveBeforeFetch')}</span>
              )}
            </div>
            <Input
              id="llm-model"
              value={form.modelId}
              onChange={(e) => setForm({ ...form, modelId: e.target.value })}
              placeholder={tpl?.defaultModelId || 'gpt-4o-mini'}
              className="font-mono text-sm"
            />
            {models.length > 0 ? <ModelsList models={models} /> : null}
          </div>

          {/* 自定义 Base URL(可折叠) */}
          {showBaseUrl || isCustom ? (
            <div className="space-y-1.5">
              <Label htmlFor="llm-url" className="text-sm">
                {isCustom ? t('baseUrlRequired') : t('baseUrlOptional')}
              </Label>
              <Input
                id="llm-url"
                value={form.baseUrlOverride}
                onChange={(e) => setForm({ ...form, baseUrlOverride: e.target.value })}
                placeholder={tpl?.baseUrl || 'https://your-api.com/v1'}
                className="font-mono text-sm"
              />
            </div>
          ) : null}

          {/* 描述 */}
          <div className="space-y-1.5">
            <Label htmlFor="llm-desc" className="text-sm">
              {t('descriptionLabel')}
            </Label>
            <Input
              id="llm-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('descriptionPlaceholder')}
              maxLength={500}
            />
          </div>

          {/* 启用开关(仅编辑时显示) */}
          {form.id ? (
            <div className="flex items-center gap-2">
              <Switch
                id="llm-enabled"
                checked={form.enabled}
                onCheckedChange={(v) => setForm({ ...form, enabled: v })}
              />
              <Label htmlFor="llm-enabled" className="text-sm">
                {t('enableConfig')}
              </Label>
            </div>
          ) : null}

          <DialogFooter className="flex flex-wrap items-center justify-between gap-2 sm:flex-nowrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => previewMut.mutate()}
              disabled={previewMut.isPending || !form.apiKey || !form.modelId}
            >
              {previewMut.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t('previewTest')}
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={savePending}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={savePending}>
                {savePending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {form.id ? t('save') : t('create')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
