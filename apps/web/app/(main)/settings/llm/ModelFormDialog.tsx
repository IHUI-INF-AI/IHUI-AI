'use client'

/**
 * ModelFormDialog — 单 model 添加/编辑对话框(2026-07-22 升级)
 *
 * Phase 3 融合 /chat/settings 参数能力:
 *  - 顶部:基本字段(modelId / displayName / contextLength / price)
 *  - 中部:结构化默认参数(行业通用英文术语):
 *      Temperature / Max Tokens / Top P / Frequency Penalty / Presence Penalty
 *      System Prompt / Response Format
 *  - 高级折叠:直接编辑完整 JSON
 *  - 底部:启用 / 设为默认 / 保存
 *
 * 融合策略:
 *  - advancedJson 非空 → 高级 JSON 优先(允许完全覆盖)
 *  - 高级 JSON 为空 → 使用结构化字段生成 jsonb
 */
import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  ChevronDown,
  Code2,
  Copy,
  Loader2,
  Settings2,
  Sparkles,
  Wand2,
} from 'lucide-react'

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from '@ihui/ui-react'

import {
  createModelV2,
  updateModelV2,
  modelToForm,
  EMPTY_MODEL_FORM,
} from './helpers-v2'
import type {
  ModelDefaultParamsStructured,
  ModelFormState,
  UserLlmModel,
  UserLlmProvider,
} from './types-v2'

interface Props {
  open: boolean
  provider: UserLlmProvider | null
  /** null = 新建,非 null = 编辑 */
  model: UserLlmModel | null
  onClose: () => void
  onSaved: () => void
}

/** 预设参数模板(行业典型值) */
const PRESETS: Array<{
  key: string
  label: string
  desc: string
  params: ModelDefaultParamsStructured
}> = [
  {
    key: 'precise',
    label: 'Precise(精确)',
    desc: '低温度,适合代码 / 事实问答',
    params: { temperature: 0.2, topP: 0.9, maxTokens: 4096, frequencyPenalty: 0, presencePenalty: 0 },
  },
  {
    key: 'balanced',
    label: 'Balanced(均衡)',
    desc: '默认配置,适合日常对话',
    params: { temperature: 0.7, topP: 1, maxTokens: 4096, frequencyPenalty: 0, presencePenalty: 0 },
  },
  {
    key: 'creative',
    label: 'Creative(创意)',
    desc: '高温度,适合写作 / 头脑风暴',
    params: { temperature: 1.2, topP: 0.95, maxTokens: 8192, frequencyPenalty: 0.2, presencePenalty: 0.3 },
  },
  {
    key: 'json',
    label: 'JSON Mode',
    desc: '结构化输出,适合 API 集成',
    params: { temperature: 0.3, topP: 1, maxTokens: 4096, responseFormat: 'json_object' },
  },
]

export function ModelFormDialog({ open, provider, model, onClose, onSaved }: Props) {
  const t = useTranslations('llmSettings.v2.modelDialog')
  const tParams = useTranslations('llmSettings.v2.modelParams')
  const [form, setForm] = React.useState<ModelFormState>(EMPTY_MODEL_FORM)
  const [showAdvanced, setShowAdvanced] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setForm(model ? modelToForm(model) : EMPTY_MODEL_FORM)
      setShowAdvanced(false)
    }
  }, [open, model])

  const saveMut = useMutation({
    mutationFn: async (f: ModelFormState) => {
      if (!provider) throw new Error('No provider')
      if (f.id) {
        return updateModelV2(provider.id, f.id, f)
      }
      return createModelV2(provider.id, f)
    },
    onSuccess: (res) => {
      const modelIdEcho = 'modelId' in res ? res.modelId : undefined
      toast.success(form.id ? t('saved') : t('created'), {
        description: modelIdEcho ? `「${modelIdEcho}」` : undefined,
      })
      onSaved()
      onClose()
    },
    onError: (e: Error) => toast.error(t('saveFailed'), { description: e.message }),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.modelId.trim()) {
      toast.error(t('modelIdRequired'))
      return
    }
    if (form.advancedJson.trim()) {
      try {
        JSON.parse(form.advancedJson)
      } catch {
        toast.error(t('invalidJson'))
        return
      }
    }
    saveMut.mutate(form)
  }

  function applyPreset(preset: ModelDefaultParamsStructured) {
    setForm((f) => ({
      ...f,
      params: { ...f.params, ...preset },
      advancedJson: '',
    }))
    toast.success(tParams('presetApplied'))
  }

  function copyAsJson() {
    const json = JSON.stringify(form.params, null, 2)
    void navigator.clipboard.writeText(json)
    toast.success(tParams('copied'))
  }

  function updateParam<K extends keyof ModelDefaultParamsStructured>(
    key: K,
    value: ModelDefaultParamsStructured[K],
  ) {
    setForm((f) => ({ ...f, params: { ...f.params, [key]: value } }))
  }

  const isEdit = !!form.id
  const isPending = saveMut.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            {isEdit ? t('editTitle') : t('newTitle')}
            {provider ? ` · ${provider.name}` : ''}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ============ 基础字段 ============ */}
          <div className="space-y-1.5">
            <Label htmlFor="modelId">{t('modelId')}</Label>
            <Input
              id="modelId"
              value={form.modelId}
              onChange={(e) => setForm({ ...form, modelId: e.target.value })}
              placeholder="gpt-4o"
              required
              disabled={isEdit}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="displayName">{t('displayName')}</Label>
            <Input
              id="displayName"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder={t('displayNamePlaceholder')}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="contextLength">{t('contextLength')}</Label>
              <Input
                id="contextLength"
                type="number"
                min={512}
                max={2000000}
                value={form.contextLength}
                onChange={(e) =>
                  setForm({ ...form, contextLength: Number(e.target.value) || 32000 })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inputPrice">{t('inputPrice')}</Label>
              <Input
                id="inputPrice"
                value={form.inputPricePer1k}
                onChange={(e) => setForm({ ...form, inputPricePer1k: e.target.value })}
                placeholder="0.005"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outputPrice">{t('outputPrice')}</Label>
              <Input
                id="outputPrice"
                value={form.outputPricePer1k}
                onChange={(e) => setForm({ ...form, outputPricePer1k: e.target.value })}
                placeholder="0.015"
              />
            </div>
          </div>

          {/* ============ 结构化默认参数(融合 chat/settings) ============ */}
          <div className="space-y-2 rounded-md border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Settings2 className="h-3.5 w-3.5" />
                {tParams('title')}
              </Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs"
                  onClick={copyAsJson}
                  title={tParams('copyAsJson')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs"
                  onClick={() => setShowAdvanced((s) => !s)}
                >
                  <Code2 className="mr-1 h-3 w-3" />
                  {showAdvanced ? tParams('hideAdvanced') : tParams('showAdvanced')}
                  <ChevronDown
                    className={`ml-0.5 h-3 w-3 transition-transform ${
                      showAdvanced ? 'rotate-180' : ''
                    }`}
                  />
                </Button>
              </div>
            </div>

            {/* 预设模板 */}
            <div className="flex flex-wrap gap-1.5">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                {tParams('presets')}
              </span>
              {PRESETS.map((p) => (
                <Badge
                  key={p.key}
                  variant="outline"
                  className="cursor-pointer text-xs hover:bg-accent"
                  onClick={() => applyPreset(p.params)}
                  title={p.desc}
                >
                  {p.label}
                </Badge>
              ))}
            </div>

            {/* 参数网格 */}
            <div className="grid grid-cols-2 gap-2">
              <ParamField
                id="temperature"
                label={tParams('temperature')}
                help={tParams('temperatureHelp')}
                min={0}
                max={2}
                step={0.1}
                value={form.params.temperature ?? 0.7}
                onChange={(v) => updateParam('temperature', v)}
              />
              <ParamField
                id="maxTokens"
                label={tParams('maxTokens')}
                help={tParams('maxTokensHelp')}
                min={1}
                max={2000000}
                step={1}
                value={form.params.maxTokens ?? 4096}
                onChange={(v) => updateParam('maxTokens', v)}
              />
              <ParamField
                id="topP"
                label={tParams('topP')}
                help={tParams('topPHelp')}
                min={0}
                max={1}
                step={0.05}
                value={form.params.topP ?? 1}
                onChange={(v) => updateParam('topP', v)}
              />
              <ParamField
                id="freqPen"
                label={tParams('frequencyPenalty')}
                help={tParams('frequencyPenaltyHelp')}
                min={-2}
                max={2}
                step={0.1}
                value={form.params.frequencyPenalty ?? 0}
                onChange={(v) => updateParam('frequencyPenalty', v)}
              />
              <ParamField
                id="presPen"
                label={tParams('presencePenalty')}
                help={tParams('presencePenaltyHelp')}
                min={-2}
                max={2}
                step={0.1}
                value={form.params.presencePenalty ?? 0}
                onChange={(v) => updateParam('presencePenalty', v)}
              />
              <div className="space-y-1.5">
                <Label htmlFor="respFmt" className="text-xs">
                  {tParams('responseFormat')}
                </Label>
                <select
                  id="respFmt"
                  value={form.params.responseFormat ?? 'text'}
                  onChange={(e) =>
                    updateParam(
                      'responseFormat',
                      e.target.value === 'text' ? undefined : (e.target.value as 'json_object'),
                    )
                  }
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="text">text</option>
                  <option value="json_object">json_object</option>
                </select>
              </div>
            </div>

            {/* System Prompt */}
            <div className="space-y-1.5">
              <Label htmlFor="systemPrompt" className="text-xs">
                {tParams('systemPrompt')}
              </Label>
              <textarea
                id="systemPrompt"
                value={form.params.systemPrompt ?? ''}
                onChange={(e) => updateParam('systemPrompt', e.target.value)}
                rows={3}
                placeholder={tParams('systemPromptPlaceholder')}
                className="flex w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* 高级 JSON 折叠区 */}
            {showAdvanced ? (
              <div className="space-y-1.5 border-t pt-2">
                <Label htmlFor="advancedJson" className="text-xs">
                  {t('defaultParams')} (JSON)
                </Label>
                <textarea
                  id="advancedJson"
                  value={form.advancedJson}
                  onChange={(e) => setForm({ ...form, advancedJson: e.target.value })}
                  rows={6}
                  placeholder='{"temperature": 0.7, "max_tokens": 4096, "seed": 42}'
                  className="flex w-full rounded-md border border-input bg-background px-2.5 py-1.5 font-mono text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  {tParams('advancedHint')}
                </p>
              </div>
            ) : null}
          </div>

          {/* ============ 启用 / 默认 ============ */}
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <div className="space-y-0.5">
              <Label htmlFor="enabled" className="text-sm">
                {t('enableModel')}
              </Label>
              <p className="text-xs text-muted-foreground">{t('enableModelDesc')}</p>
            </div>
            <Switch
              id="enabled"
              checked={form.enabled}
              onCheckedChange={(v) => setForm({ ...form, enabled: v })}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <div className="space-y-0.5">
              <Label htmlFor="isDefault" className="text-sm">
                {t('setDefault')}
              </Label>
              <p className="text-xs text-muted-foreground">{t('setDefaultDesc')}</p>
            </div>
            <Switch
              id="isDefault"
              checked={form.isDefault}
              onCheckedChange={(v) => setForm({ ...form, isDefault: v })}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              {isEdit ? t('save') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// ParamField:数字参数输入 + 标签 + 帮助
// =============================================================================
function ParamField({
  id,
  label,
  help,
  min,
  max,
  step,
  value,
  onChange,
}: {
  id: string
  label: string
  help: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center justify-between text-xs">
        <span>{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
      </Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
        className="h-8 text-xs"
      />
      <p className="text-[10px] leading-tight text-muted-foreground">{help}</p>
    </div>
  )
}
