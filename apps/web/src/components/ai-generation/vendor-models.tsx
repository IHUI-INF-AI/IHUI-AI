// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

// ============ Chat 高级参数面板(OpenAI 官方全参数,对应后端 chatBody) ============

export interface ChatAdvancedValues {
  /** index signature:与通用面板 ParamValues(Record<string,string>) 双向兼容 */
  [key: string]: string
  temperature: string
  topP: string
  maxTokens: string
  n: string
  presencePenalty: string
  frequencyPenalty: string
  seed: string
  /** 2026-09-20 扩展:对齐后端 chatBody 官方全参数 */
  maxCompletionTokens: string
  stop: string
  responseFormat: string
  logitBias: string
  logprobs: string
  topLogprobs: string
  stream: string
  user: string
}

export const CHAT_ADVANCED_DEFAULTS: ChatAdvancedValues = {
  temperature: '1',
  topP: '1',
  maxTokens: '',
  n: '1',
  presencePenalty: '0',
  frequencyPenalty: '0',
  seed: '',
  maxCompletionTokens: '',
  stop: '',
  responseFormat: '',
  logitBias: '',
  logprobs: '',
  topLogprobs: '',
  stream: '',
  user: '',
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
  // --- 2026-09-20 扩展字段 ---
  const maxCompletionTokens = num(v.maxCompletionTokens)
  if (maxCompletionTokens !== undefined) out.max_completion_tokens = Math.floor(maxCompletionTokens)
  if (v.stop.trim() !== '') out.stop = v.stop.trim()
  if (v.responseFormat.trim() !== '') out.response_format = { type: v.responseFormat.trim() }
  if (v.logitBias.trim() !== '') {
    try {
      const parsed: unknown = JSON.parse(v.logitBias)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed))
        out.logit_bias = parsed
    } catch {
      // JSON 非法则忽略该参数,不阻塞请求
    }
  }
  if (v.logprobs !== '') out.logprobs = v.logprobs === 'true'
  const topLogprobs = num(v.topLogprobs)
  if (topLogprobs !== undefined)
    out.top_logprobs = Math.min(20, Math.max(0, Math.floor(topLogprobs)))
  if (v.stream !== '') out.stream = v.stream === 'true'
  if (v.user.trim() !== '') out.user = v.user.trim()
  return out
}

/** 折叠式参数窗口:OpenAI chat/completions 官方全参数(15 项,复用通用面板) */
export function ChatAdvancedParams({
  values,
  onChange,
}: {
  values: ChatAdvancedValues
  onChange: (v: ChatAdvancedValues) => void
}) {
  const fields: ReadonlyArray<ParamFieldSpec> = [
    { key: 'temperature', label: 'temperature', type: 'number', min: 0, max: 2, step: 0.1 },
    { key: 'topP', label: 'topP', type: 'number', min: 0, max: 1, step: 0.05 },
    {
      key: 'maxTokens',
      label: 'maxTokens',
      type: 'number',
      min: 1,
      step: 1,
      placeholder: 'unlimited',
    },
    {
      key: 'maxCompletionTokens',
      label: 'maxCompletionTokens',
      type: 'number',
      min: 1,
      step: 1,
      placeholder: 'unlimited',
    },
    { key: 'n', label: 'numChoices', type: 'number', min: 1, max: 10, step: 1 },
    { key: 'stop', label: 'stopSequences', type: 'text' },
    {
      key: 'presencePenalty',
      label: 'presencePenalty',
      type: 'number',
      min: -2,
      max: 2,
      step: 0.1,
    },
    {
      key: 'frequencyPenalty',
      label: 'frequencyPenalty',
      type: 'number',
      min: -2,
      max: 2,
      step: 0.1,
    },
    { key: 'seed', label: 'seed', type: 'number', step: 1, placeholder: 'seedPlaceholder' },
    {
      key: 'responseFormat',
      label: 'responseFormat',
      type: 'select',
      options: [
        { value: 'text', label: 'text' },
        { value: 'json_object', label: 'json_object' },
      ],
    },
    { key: 'logitBias', label: 'logitBias', type: 'text' },
    { key: 'logprobs', label: 'logprobs', type: 'boolean' },
    { key: 'topLogprobs', label: 'topLogprobs', type: 'number', min: 0, max: 20, step: 1 },
    { key: 'stream', label: 'stream', type: 'boolean' },
    { key: 'user', label: 'user', type: 'text' },
  ]
  return (
    <AdvancedParamsPanel
      fields={fields}
      values={values}
      onChange={(v) => onChange(v as ChatAdvancedValues)}
    />
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

// ============ 通用高级参数面板(配置驱动,覆盖各厂商官方参数) ============

export interface ParamFieldSpec {
  key: string
  label: string
  type: 'number' | 'text' | 'select' | 'boolean'
  min?: number
  max?: number
  step?: number
  placeholder?: string
  options?: ReadonlyArray<{ value: string; label: string }>
}

export type ParamValues = Record<string, string>

/** 解析为请求体字段:number→数值、boolean→布尔、其余原样;空串/未选跳过 */
export function parseParamValues(
  values: ParamValues,
  fields: ReadonlyArray<ParamFieldSpec>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const raw = values[f.key]
    if (raw === undefined || raw === '') continue
    if (f.type === 'number') {
      const n = Number(raw)
      if (Number.isFinite(n)) out[f.key] = n
    } else if (f.type === 'boolean') {
      out[f.key] = raw === 'true'
    } else {
      out[f.key] = raw
    }
  }
  return out
}

/** 折叠式参数窗口:支持 number/text/select/boolean 四类控件,各厂商官方参数通用 */
export function AdvancedParamsPanel({
  fields,
  values,
  onChange,
  columns = 2,
}: {
  fields: ReadonlyArray<ParamFieldSpec>
  values: ParamValues
  onChange: (v: ParamValues) => void
  columns?: 1 | 2
}) {
  const t = useTranslations('aiGeneration')
  const [open, setOpen] = React.useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="justify-between rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent/50">
        {t('advancedParams')}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={`grid gap-3 pt-2 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {fields.map((f) => {
            const v = values[f.key] ?? ''
            const setValue = (next: string) => onChange({ ...values, [f.key]: next })
            if (f.type === 'select') {
              return (
                <div key={f.key} className="space-y-1">
                  <Label>{t(f.label)}</Label>
                  <Select value={v} onValueChange={setValue}>
                    <SelectTrigger>
                      <SelectValue placeholder={f.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {(f.options ?? []).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            }
            if (f.type === 'boolean') {
              return (
                <div key={f.key} className="space-y-1">
                  <Label>{t(f.label)}</Label>
                  <Select value={v} onValueChange={setValue}>
                    <SelectTrigger>
                      <SelectValue placeholder={f.placeholder ?? '-'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">{t('yes')}</SelectItem>
                      <SelectItem value="false">{t('no')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )
            }
            return (
              <div key={f.key} className="space-y-1">
                <Label>{t(f.label)}</Label>
                <Input
                  type={f.type === 'number' ? 'number' : 'text'}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  placeholder={f.placeholder}
                  value={v}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
