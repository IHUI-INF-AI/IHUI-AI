// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Zap } from 'lucide-react'

import { formatCny, formatCnyCents } from '@/lib/display-currency'
import type { Model } from './types'

type MeteredMode = 'per_call' | 'per_image' | 'per_video' | 'dynamic_cost'

/** 中转站非 token 计费模型:必须按单位/动态成本展示,不能把 0 当成“免费”。 */
export function isMeteredRelay(model: Model): boolean {
  const mode = model.relayBillingMode
  return !!model.relayPublic && !!mode && mode !== 'token'
}

function meteredMode(model: Model): MeteredMode | null {
  const mode = model.relayBillingMode
  return mode && mode !== 'token' ? mode : null
}

/** 分/千 token → 元/百万 token */
function toYuanPerMillion(centsPer1k: number): number {
  return (Number(centsPer1k) || 0) * 10
}

function tierPrices(model: Model): number[] {
  const tiers = model.relayTieredCallPricesCents
  if (!tiers) return []
  return [tiers.le256k, tiers.mid, tiers.gt512k].filter(
    (n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0,
  )
}

function unitPriceCents(model: Model, mode: MeteredMode): number | null {
  if (mode === 'per_image' || mode === 'per_video') {
    const cents = model.relayPerUnitPriceCents
    return typeof cents === 'number' && Number.isFinite(cents) && cents > 0 ? cents : null
  }
  if (mode === 'per_call') {
    const prices = tierPrices(model)
    return prices.length ? Math.min(...prices) : null
  }
  return null
}

function modeLabel(
  mode: MeteredMode,
  videoUnit: Model['relayVideoUnit'],
  t: ReturnType<typeof useTranslations<'models'>>,
): string {
  if (mode === 'per_image') return t('relay.byImage')
  if (mode === 'per_video') {
    return videoUnit === 'second' ? t('relay.bySecond') : t('relay.byCall')
  }
  if (mode === 'per_call') return t('relay.byCall')
  return t('relay.dynamicCost')
}

function unitLabel(
  mode: MeteredMode,
  videoUnit: Model['relayVideoUnit'],
  t: ReturnType<typeof useTranslations<'models'>>,
): string {
  if (mode === 'per_image') return t('relay.unitImage')
  if (mode === 'per_video') {
    return videoUnit === 'second' ? t('relay.unitSecond') : t('relay.unitCall')
  }
  if (mode === 'per_call') return t('relay.unitCall')
  return ''
}

function unitPriceText(
  model: Model,
  mode: MeteredMode,
  t: ReturnType<typeof useTranslations<'models'>>,
): string {
  if (mode === 'dynamic_cost') {
    return t('relay.minChargePerCall')
  }
  const cents = unitPriceCents(model, mode)
  if (cents === null) return '—'
  const unit = unitLabel(mode, model.relayVideoUnit, t)
  const prices = tierPrices(model)
  const starting = mode === 'per_call' && new Set(prices).size > 1
  return `${formatCnyCents(cents)}/${unit}${starting ? t('relay.startingAt') : ''}`
}

function multiplierText(model: Model): string {
  return `×${(model.relayPriceMultiplier ?? 1).toFixed(2)}`
}

/** 排序用可比价(元):媒体按张/秒/次折算;动态成本无固定价,排到最后。 */
export function relayComparablePrice(model: Model): number | null {
  const mode = meteredMode(model)
  if (!mode) return null
  if (mode === 'dynamic_cost') return Number.POSITIVE_INFINITY
  const cents = unitPriceCents(model, mode)
  return cents === null ? Number.POSITIVE_INFINITY : cents / 100
}

function PanelRow({
  label,
  value,
  muted = false,
}: {
  label: string
  value: React.ReactNode
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          muted ? 'tabular-nums text-muted-foreground' : 'tabular-nums font-medium text-foreground'
        }
      >
        {value}
      </span>
    </div>
  )
}

/** 卡片顶部的计费摘要:替代 token 输入/输出价,避免把 0 渲染成“免费”。 */
export function RelayMeteredSummary({ model }: { model: Model }) {
  const t = useTranslations('models')
  const mode = meteredMode(model)
  if (!mode) return null
  const reference = model.relayInputPricePer1k ?? 0
  return (
    <div className="rounded-md bg-muted/50 px-2 py-1.5 text-label">
      <PanelRow label={t('relay.billingMode')} value={modeLabel(mode, model.relayVideoUnit, t)} />
      <div className="mt-1.5">
        <PanelRow
          label={mode === 'dynamic_cost' ? t('relay.minCharge') : t('relay.unitPrice')}
          value={unitPriceText(model, mode, t)}
        />
      </div>
      <div className="mt-1.5">
        <PanelRow label={t('relay.multiplier')} value={multiplierText(model)} muted />
      </div>
      {mode === 'dynamic_cost' && reference > 0 && (
        <div className="mt-1.5">
          <PanelRow
            label={t('relay.referencePrice')}
            value={`${formatCny(toYuanPerMillion(reference))}${t('perMillion')}`}
            muted
          />
        </div>
      )}
    </div>
  )
}

/** 列表行内的紧凑计费摘要。 */
export function RelayMeteredInline({ model }: { model: Model }) {
  const t = useTranslations('models')
  const mode = meteredMode(model)
  if (!mode) return null
  if (mode === 'dynamic_cost') {
    return (
      <span
        className="inline-flex items-center gap-0.5"
        title={modeLabel(mode, model.relayVideoUnit, t)}
      >
        <Zap className="h-3 w-3" />
        {t('relay.minChargePerCall')}
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-0.5"
      title={modeLabel(mode, model.relayVideoUnit, t)}
    >
      <Zap className="h-3 w-3" />
      {unitPriceText(model, mode, t)}
    </span>
  )
}

/** 中转站定价面板:卡片对比区与详情弹窗共用。 */
export function RelayMeteredPanel({ model }: { model: Model }) {
  const t = useTranslations('models')
  const mode = meteredMode(model)
  if (!mode) return null
  const reference = model.relayInputPricePer1k ?? 0
  const prices = tierPrices(model)
  const plans = model.relaySubscriptionPlans ?? []

  return (
    <div className="space-y-1 rounded-xl border border-sky-500/25 bg-sky-500/5 px-2 py-1.5 text-label">
      <PanelRow label={t('relay.billingMode')} value={modeLabel(mode, model.relayVideoUnit, t)} />
      <PanelRow
        label={mode === 'dynamic_cost' ? t('relay.minCharge') : t('relay.unitPrice')}
        value={unitPriceText(model, mode, t)}
      />
      {mode === 'per_call' && prices.length > 1 && (
        <PanelRow
          label={t('relay.tieredPrice')}
          value={prices.map((p) => formatCnyCents(p)).join(' / ')}
          muted
        />
      )}
      {mode === 'dynamic_cost' && reference > 0 && (
        <PanelRow
          label={t('relay.referencePrice')}
          value={`${formatCny(toYuanPerMillion(reference))}${t('perMillion')}`}
          muted
        />
      )}
      <PanelRow label={t('relay.multiplier')} value={multiplierText(model)} muted />
      {plans.length > 0 && (
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground">{t('relay.subscriptionOnly')}</span>
          <span className="truncate pl-2 text-sky-700 dark:text-sky-400">{plans.join(' · ')}</span>
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
