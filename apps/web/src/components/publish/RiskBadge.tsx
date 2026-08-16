'use client'

/**
 * 反风控状态徽章组件
 *
 * 用于在账号卡 / 任务卡上展示平台风控等级 + 冷却倒计时。
 * 风控等级 5 档:safe(灰)/ low(蓝)/ medium(琥珀)/ high(橙)/ critical(红)。
 * 当 cooldownRemaining > 0 时,徽章右侧追加 "冷却 23m 45s" 文字。
 *
 * AGENTS.md §4:rounded-md(禁 rounded-full)/ 无分割线 / 无渐变遮罩 / subtle 配色
 */

import * as React from 'react'
import { Shield, ShieldAlert, ShieldX, ShieldCheck, ShieldMinus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'

export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical'

export interface RiskBadgeProps {
  readonly riskScore: number
  readonly riskLevel: RiskLevel
  readonly cooldownRemaining?: number
  readonly size?: 'sm' | 'md'
}

interface LevelStyle {
  readonly icon: React.ComponentType<{ className?: string }>
  readonly i18nKey: string
  readonly className: string
}

const LEVEL_STYLE: Record<RiskLevel, LevelStyle> = {
  safe: {
    icon: ShieldCheck,
    i18nKey: 'riskLevelSafe',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  low: {
    icon: Shield,
    i18nKey: 'riskLevelLow',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  },
  medium: {
    icon: ShieldMinus,
    i18nKey: 'riskLevelMedium',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  high: {
    icon: ShieldAlert,
    i18nKey: 'riskLevelHigh',
    className: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  },
  critical: {
    icon: ShieldX,
    i18nKey: 'riskLevelCritical',
    className: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  },
}

function fmtCooldown(seconds: number): string {
  if (seconds <= 0) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

export function RiskBadge({
  riskScore,
  riskLevel,
  cooldownRemaining = 0,
  size = 'md',
}: RiskBadgeProps) {
  const t = useTranslations('publish')
  const style = LEVEL_STYLE[riskLevel] ?? LEVEL_STYLE.safe
  const Icon = style.icon
  const isSm = size === 'sm'
  const inCooldown = cooldownRemaining > 0

  return (
    <Tooltip content={`risk score: ${riskScore}`}>
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md font-medium',
          isSm ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
          style.className,
          inCooldown && 'ring-1 ring-orange-500/30',
        )}
      >
        <Icon className={isSm ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
        <span>{t(style.i18nKey)}</span>
        {inCooldown && (
          <span className="ml-0.5 text-orange-700 dark:text-orange-400">
            {t('cooldownRemaining')} {fmtCooldown(cooldownRemaining)}
          </span>
        )}
      </span>
    </Tooltip>
  )
}
