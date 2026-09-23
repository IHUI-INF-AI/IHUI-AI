// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

/**
 * SamplingParamsCard — 设置页「AI 回答偏好」卡片(2026-09-14 自聊天输入区迁入统一设置页)
 *
 * 编辑 sampling-params store 的全局默认(defaults):
 * - 读:useSamplingParamsStore(s => s.defaults)
 * - 写:setParam(null, key, value) —— conversationId 为空即写全局默认,对所有会话生效
 * - 重置:resetDefaults()
 * 下发链路不变:send-message / send-answer 发送时 getSamplingParams(conversationId)。
 *
 * 文案面向普通用户(白话描述,原专业参数名放在括号内),i18n 前缀 settings.sampling。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { RotateCcw, SlidersHorizontal, X } from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
} from '@ihui/ui-react'

import {
  SAMPLING_LIMITS,
  useSamplingParamsStore,
  type SamplingParamKey,
} from '@/stores/sampling-params'

/** 数字输入行(受控草稿:输入过程不夹紧,失焦/回车时夹紧到 [min,max] 并回写) */
function NumberField({
  testId,
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  testId: string
  label: string
  hint: string
  value: number | undefined
  min: number
  max: number
  step: number
  onChange: (value: number | undefined) => void
}) {
  const t = useTranslations('settings.sampling')
  const [draft, setDraft] = React.useState(value === undefined ? '' : String(value))

  // 外部值变化(重置)时同步草稿
  React.useEffect(() => {
    setDraft(value === undefined ? '' : String(value))
  }, [value])

  const commit = React.useCallback(() => {
    const raw = draft.trim()
    if (raw === '') {
      onChange(undefined)
      return
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      setDraft(value === undefined ? '' : String(value))
      return
    }
    const clamped = Math.min(max, Math.max(min, parsed))
    setDraft(String(clamped))
    if (clamped !== value) onChange(clamped)
  }, [draft, max, min, onChange, value])

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={testId} className="text-xs font-medium">
          {label}
        </Label>
        <div className="flex items-center gap-1">
          {value !== undefined && (
            <button
              type="button"
              aria-label={t('clearParam', { name: label })}
              data-testid={`${testId}-clear`}
              onClick={() => onChange(undefined)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
          <Input
            id={testId}
            data-testid={testId}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            placeholder={t('useModelDefault')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              }
            }}
            className="h-8 w-28 text-xs"
          />
        </div>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
    </div>
  )
}

/** 设置页「AI 回答偏好」卡片 */
export function SamplingParamsCard() {
  const t = useTranslations('settings.sampling')
  const defaults = useSamplingParamsStore((s) => s.defaults)
  const setParam = useSamplingParamsStore((s) => s.setParam)
  const resetDefaults = useSamplingParamsStore((s) => s.resetDefaults)

  const set = React.useCallback(
    (key: SamplingParamKey) => (value: boolean | number | string | undefined) =>
      setParam(null, key, value),
    [setParam],
  )

  const systemPrompt = defaults.systemPrompt ?? ''

  return (
    <Card data-testid="sampling-params-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs leading-snug text-muted-foreground">{t('desc')}</p>

        <div className="grid gap-4 min-[640px]:grid-cols-2">
          <NumberField
            testId="sampling-temperature"
            label={t('temperature')}
            hint={t('temperatureHint')}
            value={defaults.temperature}
            min={SAMPLING_LIMITS.temperature.min}
            max={SAMPLING_LIMITS.temperature.max}
            step={SAMPLING_LIMITS.temperature.step}
            onChange={set('temperature')}
          />
          <NumberField
            testId="sampling-top-p"
            label={t('topP')}
            hint={t('topPHint')}
            value={defaults.topP}
            min={SAMPLING_LIMITS.topP.min}
            max={SAMPLING_LIMITS.topP.max}
            step={SAMPLING_LIMITS.topP.step}
            onChange={set('topP')}
          />
          <NumberField
            testId="sampling-top-k"
            label={t('topK')}
            hint={t('topKHint')}
            value={defaults.topK}
            min={SAMPLING_LIMITS.topK.min}
            max={SAMPLING_LIMITS.topK.max}
            step={SAMPLING_LIMITS.topK.step}
            onChange={set('topK')}
          />
          <NumberField
            testId="sampling-max-tokens"
            label={t('maxTokens')}
            hint={t('maxTokensHint')}
            value={defaults.maxTokens}
            min={SAMPLING_LIMITS.maxTokens.min}
            max={SAMPLING_LIMITS.maxTokens.max}
            step={SAMPLING_LIMITS.maxTokens.step}
            onChange={set('maxTokens')}
          />
        </div>

        {/* P1 #26(2026-09-16 立):知识库默认注入开关(全局默认,对所有会话生效)。
            checked = knowledgeContext !== false(undefined/true 均为默认开)。 */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="settings-knowledge-context" className="text-xs font-medium">
              {t('knowledgeContext')}
            </Label>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {t('knowledgeContextHint')}
            </p>
          </div>
          <Switch
            id="settings-knowledge-context"
            data-testid="settings-knowledge-context"
            checked={defaults.knowledgeContext !== false}
            onCheckedChange={(checked) => set('knowledgeContext')(checked)}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="sampling-system-prompt" className="text-xs font-medium">
              {t('systemPrompt')}
            </Label>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {systemPrompt.length}/{SAMPLING_LIMITS.systemPromptMax}
            </span>
          </div>
          <textarea
            id="sampling-system-prompt"
            data-testid="sampling-system-prompt"
            value={systemPrompt}
            maxLength={SAMPLING_LIMITS.systemPromptMax}
            placeholder={t('systemPromptPlaceholder')}
            onChange={(e) => set('systemPrompt')(e.target.value)}
            rows={3}
            className="w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-2 text-xs leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <p className="text-[11px] leading-snug text-muted-foreground">{t('systemPromptHint')}</p>
        </div>

        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            data-testid="sampling-reset-all"
            onClick={() => resetDefaults()}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('resetAll')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default SamplingParamsCard
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
