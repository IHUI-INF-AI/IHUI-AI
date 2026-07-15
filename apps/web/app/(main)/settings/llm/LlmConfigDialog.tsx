'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
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
} from '@ihui/ui'

import { previewTest, fetchUpstreamModels } from './helpers'
import type { FormState, PlatformTemplate, UpstreamModel } from './types'
import { cn } from '@/lib/utils'

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
  return (
    <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => {
        const active = t.code === current
        return (
          <button
            key={t.code}
            type="button"
            onClick={() => onPick(t)}
            className={cn(
              'group flex flex-col gap-1 rounded-lg border p-2.5 text-left transition-colors',
              active
                ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                : 'hover:border-primary/40 hover:bg-accent/50',
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t.name}</span>
              {t.isOfficial ? (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  官方
                </span>
              ) : (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  自建
                </span>
              )}
            </div>
            <p className="line-clamp-1 text-[11px] text-muted-foreground">{t.description}</p>
            <p className="truncate font-mono text-[10px] text-muted-foreground/70">{t.baseUrl}</p>
          </button>
        )
      })}
    </div>
  )
}

/** 拉取到的模型列表 */
function ModelsList({ models }: { models: UpstreamModel[] }) {
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
          placeholder="过滤模型..."
          className="h-8 pl-8 text-xs"
        />
      </div>
      <div className="max-h-48 overflow-y-auto rounded-md border">
        {filtered.length === 0 ? (
          <div className="p-3 text-center text-xs text-muted-foreground">无匹配模型</div>
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
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {(m.context_length / 1000).toFixed(0)}K
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(m.id)
                    toast.success(`已复制: ${m.id}`)
                  }}
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                  title="复制模型 ID"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        点击模型 ID 旁的复制按钮,可填入「模型 ID」字段
      </p>
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
  const [showKey, setShowKey] = React.useState(false)
  const [models, setModels] = React.useState<UpstreamModel[]>([])

  const tpl = React.useMemo(
    () => templates.find((t) => t.code === form.templateCode) ?? templates[0],
    [templates, form.templateCode],
  )

  // 切换模板 → 自动套默认值
  function pickTemplate(t: PlatformTemplate) {
    setForm({
      ...form,
      templateCode: t.code,
      modelId: form.modelId || t.defaultModelId,
      contextLength: String(
        form.contextLength === '32000' ? t.defaultContextLength : form.contextLength,
      ),
      baseUrlOverride: t.code === 'custom' ? form.baseUrlOverride : '',
    })
    setModels([])
  }

  // 预览测试(未保存也能用)
  const previewMut = useMutation({
    mutationFn: () => {
      if (!tpl) throw new Error('请选择平台模板')
      if (!form.apiKey) throw new Error('请先填写 API Key')
      if (!form.modelId.trim()) throw new Error('请先填写模型 ID')
      return previewTest({
        templateCode: form.templateCode,
        apiKey: form.apiKey,
        modelId: form.modelId.trim(),
        baseUrlOverride: form.baseUrlOverride.trim() || undefined,
      })
    },
    onSuccess: (res) => {
      toast.success(res.message || '连通成功', {
        description: `耗时 ${res.responseMs ?? 0}ms${res.modelEcho ? ` · 模型 ${res.modelEcho}` : ''}`,
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      })
    },
    onError: (e: Error) => {
      toast.error('连通失败', {
        description: e.message,
        icon: <XCircle className="h-4 w-4 text-red-600" />,
      })
    },
  })

  // 拉取模型(仅已保存的配置可用)
  const fetchMut = useMutation({
    mutationFn: () => {
      if (!form.id) throw new Error('请先保存配置,再拉取模型')
      return fetchUpstreamModels(form.id)
    },
    onSuccess: (res) => {
      setModels(res.models)
      toast.success(res.message || `已拉取 ${res.total} 个模型`, {
        icon: <Sparkles className="h-4 w-4 text-amber-500" />,
      })
    },
    onError: (e: Error) => {
      toast.error('拉取失败', { description: e.message })
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
            {form.id ? '编辑 LLM 配置' : '新增 LLM 配置'}
          </DialogTitle>
          <DialogDescription>
            选择平台模板,只需填写 API Key、模型 ID 与上下文长度,系统自动按平台协议调用。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* 平台模板选择 */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <Sparkles className="h-3.5 w-3.5" />
              平台模板
            </Label>
            <TemplateGrid templates={templates} current={form.templateCode} onPick={pickTemplate} />
            {tpl ? (
              <p className="text-[11px] text-muted-foreground">
                Base URL:{' '}
                <code className="font-mono">
                  {form.baseUrlOverride || tpl.baseUrl || '(需自填)'}
                </code>
                {' · '}
                协议: <code className="font-mono">{tpl.apiFormat}</code>
                {tpl.docsUrl ? (
                  <>
                    {' · '}
                    <a
                      href={tpl.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      文档
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
                配置名称
              </Label>
              <Input
                id="llm-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={tpl?.name ?? '我的配置'}
                maxLength={64}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="llm-ctx" className="text-sm">
                上下文长度
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
              API Key
              {form.id ? (
                <span className="text-[11px] text-muted-foreground">(留空不修改)</span>
              ) : null}
            </Label>
            <div className="relative">
              <Input
                id="llm-key"
                type={showKey ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder={form.id ? '•••••••(已加密存储)' : 'sk-...'}
                autoComplete="off"
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title={showKey ? '隐藏' : '显示'}
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* 模型 ID + 拉取 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="llm-model" className="text-sm">
                模型 ID
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
                  获取上游模型
                </Button>
              ) : (
                <span className="text-[11px] text-muted-foreground">保存后可拉取上游模型</span>
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
                Base URL{!isCustom ? '(可选,覆盖默认)' : '(必填)'}
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
              备注(可选)
            </Label>
            <Input
              id="llm-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="用途说明..."
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
                启用此配置
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
              测试连通
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={savePending}>
                取消
              </Button>
              <Button type="submit" disabled={savePending}>
                {savePending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {form.id ? '保存' : '创建'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
