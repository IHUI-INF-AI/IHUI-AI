// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * SamplingParamsPanel — 高级参数面板(P1-7,2026-09-13 立)
 *
 * 对标 CodeX / Qoder / Trae / WorkBuddy 的「模型高级参数」入口:
 * 此前 IHUI-AI 输入区只有模型选择器,温度/top_p/top_k/max_tokens 与自定义 system prompt
 * 无任何可见入口(api-client 早已支持这些字段,但前端不传 → 参数永远是模型默认)。
 *
 * 组成:
 * - 触发器:滑块图标按钮(与左侧 / @ 截图按钮同尺寸风格),已自定义时高亮 + 左上角小圆点
 * - 弹层(Dialog):四组采样参数数字输入 + 自定义 system prompt 文本域
 * - 每个参数独立「清除」按钮(回到模型默认),底部「全部重置 / 完成」
 *
 * 数据流:
 * - 读:useSamplingParamsStore(resolve = 全局默认 + 会话覆盖)
 * - 写:setParam(conversationId, key, value) —— 有会话写会话覆盖,无会话写全局默认
 * - 下发:send-message / send-answer 在发送时调 getSamplingParams(conversationId)
 *   → api-client streamChat(temperature/topP/topK/maxTokens + extraBody.systemPrompt)
 *   → apps/api chatStreamSchema → ai-service LLMCompleteRequest → LLM 网关
 *
 * 范围语义(「按会话生效」):
 * - 当前会话已建 → 改动只影响本会话(byConversation[conversationId])
 * - 未建会话(新会话首条消息前) → 改动落到全局默认
 * - 底部「设为所有会话默认」把当前会话参数提升为全局默认
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  IconButton,
  Input,
  Label,
  Switch,
} from '@ihui/ui-react'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import {
  PERSONALITY_PRESETS,
  type PersonalityPresetId,
} from '@/components/chat/personality-presets'
import { useChatStore } from '@/stores/chat'
import {
  SAMPLING_LIMITS,
  resolveSamplingParams,
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
  const t = useTranslations('chat.sampling')
  const [draft, setDraft] = React.useState(value === undefined ? '' : String(value))

  // 外部值变化(重置 / 提升为默认)时同步草稿
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

/** 高级参数面板(受控) */
export function SamplingParamsPanel({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('chat.sampling')
  const tPresets = useTranslations('chat.personalityPresets')
  const conversationId = useChatStore((s) => s.conversationId)
  const defaults = useSamplingParamsStore((s) => s.defaults)
  const byConversation = useSamplingParamsStore((s) => s.byConversation)
  const setParam = useSamplingParamsStore((s) => s.setParam)
  const promoteToDefaults = useSamplingParamsStore((s) => s.promoteToDefaults)
  const clearConversation = useSamplingParamsStore((s) => s.clearConversation)
  const resetDefaults = useSamplingParamsStore((s) => s.resetDefaults)

  const params = React.useMemo(
    () => resolveSamplingParams(defaults, byConversation, conversationId),
    [byConversation, conversationId, defaults],
  )
  const set = React.useCallback(
    (key: SamplingParamKey) => (value: boolean | number | string | undefined) =>
      setParam(conversationId, key, value),
    [conversationId, setParam],
  )

  const systemPrompt = params.systemPrompt ?? ''

  // V2 #29:当前 systemPrompt 精确匹配哪个预设的 prompt 文本;自定义文本 → undefined
  const activePreset = React.useMemo(
    () => PERSONALITY_PRESETS.find((p) => tPresets(`${p.id}.prompt`) === systemPrompt)?.id,
    [systemPrompt, tPresets],
  )

  const applyPreset = React.useCallback(
    (id: PersonalityPresetId) => {
      set('systemPrompt')(tPresets(`${id}.prompt`))
    },
    [set, tPresets],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="sampling-params-panel">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('desc')}</DialogDescription>
        </DialogHeader>

        {/* 生效范围说明:会话级覆盖 vs 全局默认 */}
        <div className="flex items-start justify-between gap-2 rounded-md bg-muted px-2.5 py-2">
          <p className="text-[11px] leading-snug text-muted-foreground">
            {conversationId ? t('scopeSession') : t('scopeDefault')}
          </p>
          {conversationId && (
            <button
              type="button"
              data-testid="sampling-promote-defaults"
              onClick={() => promoteToDefaults(conversationId)}
              className="shrink-0 text-[11px] font-medium text-primary hover:underline"
            >
              {t('promoteToDefaults')}
            </button>
          )}
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <NumberField
            testId="sampling-temperature"
            label={t('temperature')}
            hint={t('temperatureHint')}
            value={params.temperature}
            min={SAMPLING_LIMITS.temperature.min}
            max={SAMPLING_LIMITS.temperature.max}
            step={SAMPLING_LIMITS.temperature.step}
            onChange={set('temperature')}
          />
          <NumberField
            testId="sampling-top-p"
            label={t('topP')}
            hint={t('topPHint')}
            value={params.topP}
            min={SAMPLING_LIMITS.topP.min}
            max={SAMPLING_LIMITS.topP.max}
            step={SAMPLING_LIMITS.topP.step}
            onChange={set('topP')}
          />
          <NumberField
            testId="sampling-top-k"
            label={t('topK')}
            hint={t('topKHint')}
            value={params.topK}
            min={SAMPLING_LIMITS.topK.min}
            max={SAMPLING_LIMITS.topK.max}
            step={SAMPLING_LIMITS.topK.step}
            onChange={set('topK')}
          />
          <NumberField
            testId="sampling-max-tokens"
            label={t('maxTokens')}
            hint={t('maxTokensHint')}
            value={params.maxTokens}
            min={SAMPLING_LIMITS.maxTokens.min}
            max={SAMPLING_LIMITS.maxTokens.max}
            step={SAMPLING_LIMITS.maxTokens.step}
            onChange={set('maxTokens')}
          />

          {/* P1 #26(2026-09-16 立):知识库默认注入开关。checked = knowledgeContext !== false
              (undefined/true 均为默认开);打开即回默认(不落盘),关闭显式存 false。 */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="sampling-knowledge-context" className="text-xs font-medium">
                {t('knowledgeContext')}
              </Label>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {t('knowledgeContextHint')}
              </p>
            </div>
            <Switch
              id="sampling-knowledge-context"
              data-testid="sampling-knowledge-context"
              checked={params.knowledgeContext !== false}
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
            {/* V2 #29:个性预设快捷选择(写入 systemPrompt,自定义文本仍可手改) */}
            <select
              data-testid="sampling-personality-preset"
              value={activePreset ?? 'custom'}
              onChange={(e) => applyPreset(e.target.value as PersonalityPresetId)}
              className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="custom">{t('personalityCustom')}</option>
              {PERSONALITY_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {tPresets(`${p.id}.label`)}
                </option>
              ))}
            </select>
            <textarea
              id="sampling-system-prompt"
              data-testid="sampling-system-prompt"
              value={systemPrompt}
              maxLength={SAMPLING_LIMITS.systemPromptMax}
              placeholder={t('systemPromptPlaceholder')}
              onChange={(e) => set('systemPrompt')(e.target.value)}
              rows={4}
              className={cn(
                'w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-2 text-xs leading-relaxed',
                'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              )}
            />
            <p className="text-[11px] leading-snug text-muted-foreground">
              {t('systemPromptHint')}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            data-testid="sampling-reset-all"
            onClick={() => {
              if (conversationId) clearConversation(conversationId)
              else resetDefaults()
            }}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('resetAll')}
          </Button>
          <Button size="sm" data-testid="sampling-done" onClick={() => onOpenChange(false)}>
            <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('done')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** 工具栏触发器 + 面板(自带 open 状态),与 ModeSwitcher / 截图按钮同排使用 */
export function SamplingParamsButton({ disabled = false }: { disabled?: boolean }) {
  const t = useTranslations('chat.sampling')
  const [open, setOpen] = React.useState(false)
  const conversationId = useChatStore((s) => s.conversationId)
  const defaults = useSamplingParamsStore((s) => s.defaults)
  const byConversation = useSamplingParamsStore((s) => s.byConversation)

  const activeCount = React.useMemo(() => {
    const params = resolveSamplingParams(defaults, byConversation, conversationId)
    return Object.keys(params).length
  }, [byConversation, conversationId, defaults])

  return (
    <>
      <Tooltip
        content={activeCount > 0 ? t('triggerActive', { count: activeCount }) : t('trigger')}
        side="top"
      >
        <span className="inline-flex">
          <IconButton
            data-testid="sampling-params-trigger"
            data-active={activeCount > 0 ? 'true' : 'false'}
            aria-label={t('triggerAria')}
            aria-haspopup="dialog"
            disabled={disabled}
            onClick={() => setOpen(true)}
            className={cn(
              'relative bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              activeCount > 0 && 'text-primary ring-1 ring-primary/40',
            )}
          >
            <SlidersHorizontal aria-hidden="true" />
            {activeCount > 0 && (
              <span
                className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary"
                aria-hidden="true"
              />
            )}
          </IconButton>
        </span>
      </Tooltip>
      <SamplingParamsPanel open={open} onOpenChange={setOpen} />
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
