'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { TrendingUp, Building2, Calendar } from 'lucide-react'
import { Card, CardContent } from '@ihui/ui'
import { Badge } from '@/components/data'
import { getFormatters } from '@/lib/date-utils'
import type { AiFundingItem } from '@/lib/ai-news-api'
import { EmptyState } from './EmptyState'

interface Props {
  items: AiFundingItem[]
}

export function FundingSection({ items }: Props) {
  const t = useTranslations('aiNews')
  const locale = React.useMemo(() => {
    if (typeof document === 'undefined') return 'zh-CN'
    return document.documentElement.lang || 'zh-CN'
  }, [])
  const fmt = React.useMemo(() => getFormatters(locale), [locale])

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
      <div className="grid gap-4 p-6 pt-3 md:grid-cols-3">
        {items.map((item) => (
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
