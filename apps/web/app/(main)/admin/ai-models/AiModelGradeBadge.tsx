// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 运行质量徽章(2026-11-26 立)。
 *
 * 颜色只表达等级,不表达"流量大小";样本不足用中性灰,避免把"没数据"伪装成"差"。
 * 具体分数与两项原始指标放 Tooltip,徽章本身保持窄,表格列不被撑开。
 */
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { formatLatency, formatPercent } from './telemetry-format'
import type { RuntimeGrade, RuntimeGradeTier } from './types'

const TIER_KEY = {
  excellent: 'telemetry.grade.tier.excellent',
  good: 'telemetry.grade.tier.good',
  fair: 'telemetry.grade.tier.fair',
  poor: 'telemetry.grade.tier.poor',
  insufficient: 'telemetry.grade.tier.insufficient',
} as const

const TIER_LETTER: Record<RuntimeGradeTier, string> = {
  excellent: 'S',
  good: 'A',
  fair: 'B',
  poor: 'C',
  insufficient: '—',
}

const TIER_STYLE: Record<RuntimeGradeTier, string> = {
  excellent:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
  good: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300',
  fair: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  poor: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300',
  insufficient: 'border-stroke-subtle bg-muted/40 text-muted-foreground',
}

export function GradeBadge({
  grade,
  size = 'sm',
  showScore = false,
  ready = true,
}: {
  grade: RuntimeGrade
  size?: 'sm' | 'md'
  showScore?: boolean
  ready?: boolean
}) {
  const t = useTranslations('adminAiModels')
  if (!ready) return <span className="text-label text-muted-foreground">—</span>

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded border font-medium tabular-nums',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px] leading-4' : 'px-2 py-0.5 text-label',
        TIER_STYLE[grade.tier],
      )}
    >
      <span className="font-bold">{TIER_LETTER[grade.tier]}</span>
      <span>{t(TIER_KEY[grade.tier])}</span>
      {showScore && grade.score !== null && (
        <span className="opacity-75">{t('telemetry.grade.score', { score: grade.score })}</span>
      )}
    </span>
  )
}

export function GradeTooltip({
  grade,
  calls,
  errors,
  p95LatencyMs,
  overall = false,
}: {
  grade: RuntimeGrade
  calls: number
  errors: number
  p95LatencyMs: number | null
  overall?: boolean
}) {
  const t = useTranslations('adminAiModels')
  const locale = useLocale()

  if (grade.tier === 'insufficient') {
    return (
      <div className="max-w-[320px] space-y-1 text-left text-label leading-relaxed">
        <div className="font-medium">{t(TIER_KEY.insufficient)}</div>
        <div className="text-muted-foreground">
          {calls < 20
            ? t('telemetry.grade.tipNeedSample', { calls })
            : t('telemetry.grade.tipNoLatency', { calls })}
        </div>
      </div>
    )
  }

  const errorRate = calls > 0 ? errors / calls : null
  const latency = formatLatency(p95LatencyMs, locale) ?? '—'

  return (
    <div className="max-w-[320px] space-y-1 text-left text-label leading-relaxed">
      <div className="font-medium">
        {overall ? `${t('telemetry.grade.overall')} · ` : ''}
        {t(TIER_KEY[grade.tier])}
        {grade.score !== null ? ` · ${t('telemetry.grade.score', { score: grade.score })}` : ''}
      </div>
      <div className="text-muted-foreground">
        {t('telemetry.grade.tipDetail', {
          errorPct: formatPercent(errorRate, locale),
          p95: latency,
          calls,
        })}
      </div>
      <div className="text-muted-foreground">{t('telemetry.grade.tipShortBoard')}</div>
    </div>
  )
}

/** 评分口径:放在表头/整体徽章的 Tooltip 里,解释"为什么得到这个等级"。 */
export function GradeRubric() {
  const t = useTranslations('adminAiModels')
  return (
    <div className="w-[420px] max-w-[calc(100vw-32px)] space-y-1.5 text-left text-label leading-relaxed">
      <div className="font-medium text-foreground">{t('telemetry.grade.rubricTitle')}</div>
      <div>{t('telemetry.grade.rubricError')}</div>
      <div>{t('telemetry.grade.rubricLatency')}</div>
      <div className="text-muted-foreground">{t('telemetry.grade.rubricScope')}</div>
      <div className="text-muted-foreground">{t('telemetry.grade.rubricLatencyNote')}</div>
      <div>{t('telemetry.grade.rubricCombine')}</div>
      <div>{t('telemetry.grade.rubricSample')}</div>
      <div className="text-muted-foreground">{t('telemetry.grade.rubricLoad')}</div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
