// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'

/**
 * 动态模型列表 + OpenAI 官方参数面板(共享)。
 * 2026-09-20:支持 Agnes/极速API(按量/订阅/生图)四条官方 /v1/models 透传端点。
 */

// OpenAI /v1/models 标准响应:{ object: 'list', data: [{ id, ... }] }
interface VendorModelsResponse {
  object?: unknown
  data?: unknown
}

function extractModelIds(data: unknown): string[] {
  if (typeof data !== 'object' || data === null) return []
  const rows = (data as VendorModelsResponse).data
  if (!Array.isArray(rows)) return []
  const ids = rows
    .map((r) => (typeof (r as { id?: unknown })?.id === 'string' ? (r as { id: string }).id : ''))
    .filter(Boolean)
  return Array.from(new Set(ids)).sort()
}

// 非 LLM 文本模型(生图/embedding/语音/审核类)在 chat 下拉中排除
const NON_TEXT_PATTERNS = [
  'image',
  'embedding',
  'dall-e',
  'whisper',
  'tts',
  'audio',
  'moderation',
  'video',
  'rerank',
]

export function isTextModel(id: string): boolean {
  const mid = id.toLowerCase()
  return !NON_TEXT_PATTERNS.some((p) => mid.includes(p))
}

/**
 * 动态拉取厂商官方全量模型列表(GET /api/ai/<vendor>/models 透传上游 /v1/models)。
 * 失败或为空时 fallback 到静态列表,保证离线可用。
 */
export function useVendorModels(
  vendor: string,
  fallback: readonly string[],
  filter: (id: string) => boolean = isTextModel,
): { models: string[]; isDynamic: boolean; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['vendor-models', vendor],
    queryFn: async () => {
      const res = await fetchApi<unknown>(`/api/ai/${vendor}/models`)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    staleTime: 5 * 60_000,
    retry: 1,
  })
  const dynamic = React.useMemo(() => extractModelIds(data).filter(filter), [data, filter])
  const models = React.useMemo(
    () => (dynamic.length > 0 ? dynamic : [...fallback]),
    [dynamic, fallback],
  )
  return { models, isDynamic: dynamic.length > 0, isLoading }
}

/** 模型下拉(动态全量 + fallback 静态),value 失效时自动回退到第一项 */
export function ModelSelect({
  models,
  value,
  onChange,
  isDynamic,
  isLoading,
}: {
  models: string[]
  value: string
  onChange: (v: string) => void
  isDynamic: boolean
  isLoading: boolean
}) {
  const t = useTranslations('aiGeneration')
  React.useEffect(() => {
    const first = models[0]
    if (first && !models.includes(value)) onChange(first)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models])
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label>{t('model')}</Label>
        {isLoading ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : null}
        {isDynamic ? (
          <span className="text-xs text-muted-foreground">{t('officialModels')}</span>
        ) : null}
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ============ Chat 高级参数面板(OpenAI 官方参数) ============

export interface ChatAdvancedValues {
  temperature: string
  topP: string
  maxTokens: string
  n: string
  presencePenalty: string
  frequencyPenalty: string
  seed: string
}

export const CHAT_ADVANCED_DEFAULTS: ChatAdvancedValues = {
  temperature: '1',
  topP: '1',
  maxTokens: '',
  n: '1',
  presencePenalty: '0',
  frequencyPenalty: '0',
  seed: '',
}

/** 解析为 OpenAI 请求体字段(空串跳过;n/seed 取整;n 夹在 1-10) */
export function parseChatAdvanced(v: ChatAdvancedValues): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const num = (s: string): number | undefined => {
    const n = Number(s)
    return s.trim() !== '' && Number.isFinite(n) ? n : undefined
  }
  const temperature = num(v.temperature)
  if (temperature !== undefined) out.temperature = temperature
  const topP = num(v.topP)
  if (topP !== undefined) out.top_p = topP
  const maxTokens = num(v.maxTokens)
  if (maxTokens !== undefined) out.max_tokens = Math.floor(maxTokens)
  const n = num(v.n)
  if (n !== undefined) out.n = Math.min(10, Math.max(1, Math.floor(n)))
  const presencePenalty = num(v.presencePenalty)
  if (presencePenalty !== undefined) out.presence_penalty = presencePenalty
  const frequencyPenalty = num(v.frequencyPenalty)
  if (frequencyPenalty !== undefined) out.frequency_penalty = frequencyPenalty
  const seed = num(v.seed)
  if (seed !== undefined) out.seed = Math.floor(seed)
  return out
}

/** 折叠式高级参数面板:temperature/top_p/max_tokens/n/presence_penalty/frequency_penalty/seed */
export function ChatAdvancedParams({
  values,
  onChange,
}: {
  values: ChatAdvancedValues
  onChange: (v: ChatAdvancedValues) => void
}) {
  const t = useTranslations('aiGeneration')
  const [open, setOpen] = React.useState(false)
  const fields: Array<{
    key: keyof ChatAdvancedValues
    label: string
    min?: number
    max?: number
    step?: number
    placeholder?: string
  }> = [
    { key: 'temperature', label: t('temperature'), min: 0, max: 2, step: 0.1 },
    { key: 'topP', label: t('topP'), min: 0, max: 1, step: 0.05 },
    { key: 'maxTokens', label: t('maxTokens'), min: 1, step: 1, placeholder: t('unlimited') },
    { key: 'n', label: t('numChoices'), min: 1, max: 10, step: 1 },
    { key: 'presencePenalty', label: t('presencePenalty'), min: -2, max: 2, step: 0.1 },
    { key: 'frequencyPenalty', label: t('frequencyPenalty'), min: -2, max: 2, step: 0.1 },
    { key: 'seed', label: t('seed'), step: 1, placeholder: t('seedPlaceholder') },
  ]
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="justify-between rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent/50">
        {t('advancedParams')}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-2 gap-3 pt-2">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label>{f.label}</Label>
              <Input
                type="number"
                min={f.min}
                max={f.max}
                step={f.step}
                placeholder={f.placeholder}
                value={values[f.key]}
                onChange={(e) => onChange({ ...values, [f.key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** 出图数量选择(OpenAI images n 参数,1-4) */
export function NumImagesSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const t = useTranslations('aiGeneration')
  return (
    <div className="space-y-2">
      <Label>{t('numImages')}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {['1', '2', '3', '4'].map((n) => (
            <SelectItem key={n} value={n}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
