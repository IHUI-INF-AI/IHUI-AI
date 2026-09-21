// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  RATE_PROFILES,
  effectiveDataClass,
  type CapabilityDataClass,
  type CapabilityEntry,
  type CapabilityRisk,
} from '@ihui/types'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'

/** 徽章基底:方形圆角(禁胶囊),leading-none 让文字确定性垂直居中。 */
export const BADGE_BASE =
  'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium leading-none'

/** 四态 dataClass 配色:compute=天蓝 scoped-read=紫 scoped-write=琥珀 platform=玫红 */
export const DATA_CLASS_CLASS: Record<CapabilityDataClass, string> = {
  compute: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  'scoped-read': 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  'scoped-write': 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  platform: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
}

export const DATA_CLASS_LABEL_KEY: Record<CapabilityDataClass, string> = {
  compute: 'dataClass.compute',
  'scoped-read': 'dataClass.scopedRead',
  'scoped-write': 'dataClass.scopedWrite',
  platform: 'dataClass.platform',
}

export const DATA_CLASS_DESC_KEY: Record<CapabilityDataClass, string> = {
  compute: 'dataClassDesc.compute',
  'scoped-read': 'dataClassDesc.scopedRead',
  'scoped-write': 'dataClassDesc.scopedWrite',
  platform: 'dataClassDesc.platform',
}

/**
 * 数字计数徽章(AGENTS.md §4 强制规范):
 * inline-flex + justify-center 保证任意位数水平居中;h-4 + leading-none + items-center
 * 保证垂直居中(不依赖字体行高);min-w-4 保证单位数不掉宽;tabular-nums 保证等宽不抖动。
 */
export function CountBadge({
  count,
  className,
}: {
  count: number
  className?: string
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex h-4 min-w-4 items-center justify-center rounded bg-muted px-1 text-[10px] font-semibold leading-none tabular-nums text-muted-foreground',
        className,
      )}
    >
      {count}
    </span>
  )
}

const RISK_LABEL_KEY: Record<CapabilityRisk, string> = {
  low: 'risk.low',
  medium: 'risk.medium',
  high: 'risk.high',
  critical: 'risk.critical',
}

const RISK_CLASS: Record<CapabilityRisk, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  high: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  critical: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
}

/**
 * dataClass 徽章:hover 出后端对这一类的原始定义 —— 「开放功能 ≠ 开放数据」的界面落点。
 * 取 effectiveDataClass(entry) 而非 entry.dataClass 字面量,与运行期授权闸同一判定口径。
 */
export function DataClassBadge({
  entry,
  className,
}: {
  entry: CapabilityEntry
  className?: string
}): React.JSX.Element {
  const t = useTranslations('developer.capabilities')
  const dataClass = effectiveDataClass(entry)
  const labelKey = DATA_CLASS_LABEL_KEY[dataClass]
  const descKey = DATA_CLASS_DESC_KEY[dataClass]
  return (
    <Tooltip
      side="top"
      content={
        <span className="block max-w-64 leading-relaxed">{t(descKey, { defaultValue: descKey })}</span>
      }
    >
      <span className={cn(BADGE_BASE, DATA_CLASS_CLASS[dataClass], className)}>
        {t(labelKey, { defaultValue: labelKey })}
      </span>
    </Tooltip>
  )
}

/** 风险档徽章:hover 出该档默认限流画像(RATE_PROFILES,可被 key 级收紧、不可放宽)。 */
export function RiskBadge({ entry }: { entry: CapabilityEntry }): React.JSX.Element {
  const t = useTranslations('developer.capabilities')
  const rate = RATE_PROFILES[entry.risk]
  const labelKey = RISK_LABEL_KEY[entry.risk]
  return (
    <Tooltip
      side="top"
      content={
        <span className="block whitespace-nowrap tabular-nums">
          {t('riskProfile', {
            rpm: rate.rpm,
            dailyCalls: rate.dailyCalls,
            concurrent: rate.concurrent,
          })}
        </span>
      }
    >
      <span className={cn(BADGE_BASE, RISK_CLASS[entry.risk])}>
        {t(labelKey, { defaultValue: labelKey })}
      </span>
    </Tooltip>
  )
}

/** 「开」这一状态该用什么颜色:muted=中性属性 / warn=会产生费用 / danger=受限。 */
export type FlagTone = 'muted' | 'warn' | 'danger'

const FLAG_ON_CLASS: Record<FlagTone, string> = {
  muted: 'bg-muted text-muted-foreground',
  warn: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  danger: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
}

/** 布尔属性徽章:off 恒为中性灰,on 按 tone 上色(用来说明「计费 / 需幂等键 / 受限」)。 */
export function FlagBadge({
  on,
  onLabel,
  offLabel,
  tone = 'muted',
}: {
  on: boolean
  onLabel: string
  offLabel: string
  tone?: FlagTone
}): React.JSX.Element {
  return (
    <span className={cn(BADGE_BASE, on ? FLAG_ON_CLASS[tone] : 'bg-muted text-muted-foreground')}>
      {on ? onLabel : offLabel}
    </span>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
