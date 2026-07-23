'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { TrendingUp, Building2, Calendar, Search, ArrowUp, ArrowDown } from 'lucide-react'
import { Card, CardContent } from '@ihui/ui'
import { Badge } from '@/components/data'
import { getFormatters } from '@/lib/date-utils'
import type { AiFundingItem } from '@/lib/ai-news-api'
import { EmptyState } from './EmptyState'
import { parseNumeric } from './text-utils'

interface Props {
  items: AiFundingItem[]
}

type SortField = 'date' | 'amount'
type SortDir = 'asc' | 'desc'

export function FundingSection({ items }: Props) {
  const t = useTranslations('aiNews')
  const locale = React.useMemo(() => {
    if (typeof document === 'undefined') return 'zh-CN'
    return document.documentElement.lang || 'zh-CN'
  }, [])
  const fmt = React.useMemo(() => getFormatters(locale), [locale])

  const [query, setQuery] = React.useState('')
  const [sortField, setSortField] = React.useState<SortField>('date')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = items.filter((it) => {
      if (!q) return true
      return (
        it.title.toLowerCase().includes(q) ||
        it.summary.toLowerCase().includes(q) ||
        it.source.toLowerCase().includes(q)
      )
    })
    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortField === 'date') {
        return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir
      }
      return ((parseNumeric(a.amount) ?? 0) - (parseNumeric(b.amount) ?? 0)) * dir
    })
    return list
  }, [items, query, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  if (items.length === 0) {
    return (
      <section aria-label={t('funding.label')}>
        <EmptyState icon={<TrendingUp className="h-6 w-6" />} message={t('funding.empty')} />
      </section>
    )
  }

  return (
    <section
      aria-label={t('funding.label')}
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <div className="flex flex-row items-center justify-between gap-3 p-6 pb-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            {t('funding.title')}
          </h2>
          <p className="text-xs text-muted-foreground">{t('funding.subtitle')}</p>
        </div>
      </div>

      <div className="space-y-2 px-6 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('funding.searchPlaceholder')}
            className="w-full rounded-md border border-input bg-background py-1.5 pl-7 pr-7 text-xs placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70">{t('funding.sortLabel')}:</span>
          {(['date', 'amount'] as const).map((field) => (
            <button
              key={field}
              type="button"
              onClick={() => toggleSort(field)}
              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                sortField === field
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {t(`funding.sortBy${field.charAt(0).toUpperCase() + field.slice(1)}`)}
              {sortField === field ? (
                sortDir === 'asc' ? <ArrowUp className="h-2 w-2" /> : <ArrowDown className="h-2 w-2" />
              ) : null}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-muted-foreground/80">
            {t('funding.resultCount', { count: filtered.length, total: items.length })}
          </span>
        </div>
      </div>

      <div className="grid gap-4 p-6 pt-3 md:grid-cols-3">
        {filtered.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
            {t('funding.empty')}
          </div>
        ) : null}
        {filtered.map((item) => (
          <Card key={item.id} className="overflow-hidden transition duration-200 hover:bg-accent hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="success">{item.amount}</Badge>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {fmt.dateOnlyFormatter.format(new Date(item.date))}
                </span>
              </div>
              <h3 className="text-sm font-semibold leading-tight">{item.title}</h3>
              <p className="line-clamp-3 text-xs text-muted-foreground">{item.summary}</p>
              <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                {item.source}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
