'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'

interface Props {
  total: number
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}

export function MarketPagination({ total, page, totalPages, onPrev, onNext }: Props) {
  const t = useTranslations('agent')
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 whitespace-nowrap tabular-nums text-sm text-muted-foreground">{t('total', { total })}</span>
      <div className="flex shrink-0 items-center gap-2">
        <Button className="shrink-0" variant="outline" size="sm" disabled={page <= 1} onClick={onPrev}>
          <ChevronLeft className="h-4 w-4 shrink-0" />
          {t('prev')}
        </Button>
        <span className="shrink-0 whitespace-nowrap tabular-nums text-sm text-muted-foreground">
          {t('page', { page, total: totalPages })}
        </span>
        <Button className="shrink-0" variant="outline" size="sm" disabled={page >= totalPages} onClick={onNext}>
          {t('next')}
          <ChevronRight className="h-4 w-4 shrink-0" />
        </Button>
      </div>
    </div>
  )
}
