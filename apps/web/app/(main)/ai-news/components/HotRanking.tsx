'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Flame, ExternalLink } from 'lucide-react'

interface Props {
  items: Array<{ id: string; title: string; sourceCode: string; currentHot: number | null; url: string | null; llmCategory: string | null }>
  sources: Array<{ sourceCode: string; sourceName: string; color: string | null }>
}

function formatHot(n: number | null): string {
  if (n === null || n === 0) return ''
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}亿`
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`
  return String(n)
}

/** 排名颜色:Top 3 高亮,其余默认 */
function rankColor(idx: number): string {
  if (idx === 0) return 'bg-red-500 text-white'
  if (idx === 1) return 'bg-orange-500 text-white'
  if (idx === 2) return 'bg-amber-500 text-white'
  return 'bg-muted text-muted-foreground'
}

export function HotRanking({ items, sources }: Props) {
  const t = useTranslations('aiNews')
  const sourceMap = React.useMemo(() => {
    const m = new Map<string, { sourceName: string; color: string | null }>()
    for (const s of sources) m.set(s.sourceCode, { sourceName: s.sourceName, color: s.color })
    return m
  }, [sources])

  if (items.length === 0) return null

  return (
    <section
      aria-label={t('hotRanking.label')}
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <div className="flex items-center gap-2 border-b bg-orange-500/5 px-5 py-3">
        <Flame className="h-4 w-4 text-orange-500" />
        <h2 className="text-sm font-semibold">{t('hotRanking.title')}</h2>
        <span className="ml-auto text-[10px] text-muted-foreground">{t('hotRanking.subtitle')}</span>
      </div>
      <div className="divide-y">
        {items.map((it, idx) => {
          const source = sourceMap.get(it.sourceCode)
          const hot = formatHot(it.currentHot)
          return (
            <a
              key={it.id}
              href={it.url ?? '#'}
              target={it.url ? '_blank' : undefined}
              rel={it.url ? 'noopener noreferrer' : undefined}
              className="group flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-accent/40"
            >
              <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold tabular-nums ${rankColor(idx)}`}>
                {idx + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-medium leading-tight transition-colors group-hover:text-primary">
                {it.title}
              </span>
              {source ? (
                <span className="shrink-0 text-[10px] text-muted-foreground">{source.sourceName}</span>
              ) : null}
              {hot ? (
                <span className="flex shrink-0 items-center gap-0.5 text-xs font-bold tabular-nums text-orange-600 dark:text-orange-400">
                  <Flame className="h-2.5 w-2.5" />
                  {hot}
                </span>
              ) : null}
              {it.url ? (
                <ExternalLink className="h-2.5 w-2.5 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
              ) : null}
            </a>
          )
        })}
      </div>
    </section>
  )
}
