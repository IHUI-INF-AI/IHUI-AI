'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Cpu, Zap, Layers, CheckCircle2 } from 'lucide-react'
import { CardContent, CardHeader, CardTitle } from '@ihui/ui'
import type { ComparisonTable } from '@/lib/ai-news-api'

interface Props {
  table: ComparisonTable
}

export function ComparisonTableSection({ table }: Props) {
  const t = useTranslations('aiNews')

  return (
    <section
      aria-label={t('comparison.label')}
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Cpu className="h-5 w-5 text-primary" />
            {t('comparison.title')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t('comparison.subtitle')}</p>
        </div>
        <span className="hidden items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 sm:inline-flex">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t('comparison.verified')}
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-muted/40">
                <th className="sticky left-0 z-10 bg-muted/40 px-4 py-3 text-left font-medium text-muted-foreground">
                  {t('comparison.colModel')}
                </th>
                {table.models.map((m) => (
                  <th key={m.id} className="px-4 py-3 text-left font-medium">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold">{m.name}</span>
                      <span className="text-xs font-normal text-muted-foreground">{m.vendor}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, idx) => (
                <tr key={row.label} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                  <td className="sticky left-0 z-10 bg-card px-4 py-3 align-top text-xs font-medium text-muted-foreground">
                    {row.label}
                  </td>
                  {table.models.map((m) => (
                    <td key={m.id} className="px-4 py-3 align-top text-sm">
                      {row.values[m.id] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-muted/30">
                <td className="sticky left-0 z-10 bg-muted/20 px-4 py-3 align-top text-xs font-medium text-muted-foreground">
                  {t('comparison.highlight')}
                </td>
                {table.models.map((m) => (
                  <td key={m.id} className="px-4 py-3 align-top text-xs text-muted-foreground">
                    {m.highlight}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 bg-background/50 px-4 py-3 text-xs text-muted-foreground">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span>{t('comparison.footnote')}</span>
          <Layers className="ml-2 h-3.5 w-3.5 text-primary" />
          <span>{t('comparison.footnote2')}</span>
        </div>
      </CardContent>
    </section>
  )
}
