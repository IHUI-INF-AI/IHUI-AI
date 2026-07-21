'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Flame } from 'lucide-react'

interface Props {
  score: number | null
  metrics?: Record<string, unknown> | null
  updatedAt?: string | null
}

function pickNumber(obj: Record<string, unknown> | null | undefined, key: string): number | null {
  if (!obj || typeof obj !== 'object') return null
  const v = (obj as Record<string, unknown>)[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function TrendingBadge({ score, metrics, updatedAt }: Props) {
  const t = useTranslations('common.aiWorld.trending')
  const locale = useLocale()
  const timeFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  if (score === null || !Number.isFinite(score)) return null
  const s = Math.max(0, Math.min(100, Math.round(score)))

  const tier =
    s >= 80
      ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30'
      : s >= 60
        ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30'
        : s >= 40
          ? 'text-muted-foreground bg-muted'
          : 'text-muted-foreground/60 bg-muted/50'

  const stars = pickNumber(metrics, 'stars') ?? pickNumber(metrics, 'githubStars')
  const forks = pickNumber(metrics, 'forks') ?? pickNumber(metrics, 'githubForks')

  const tipParts: string[] = [`${t('score')}: ${s}`]
  if (stars !== null) tipParts.push(`${t('githubStars')}: ${stars}`)
  if (forks !== null) tipParts.push(`${t('githubForks')}: ${forks}`)
  if (updatedAt) {
    const d = new Date(updatedAt)
    if (!Number.isNaN(d.getTime())) tipParts.push(`${t('updatedAt')}: ${timeFmt.format(d)}`)
  }

  return (
    <span
      title={tipParts.join(' · ')}
      className={`inline-flex h-5 items-center gap-0.5 rounded-sm px-1.5 text-xs font-medium ${tier}`}
    >
      <Flame className="h-3 w-3" />
      <span>{s}</span>
    </span>
  )
}
