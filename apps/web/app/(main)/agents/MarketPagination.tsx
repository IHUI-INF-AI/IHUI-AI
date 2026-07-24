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
  const t = useTranslations('agents')
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" />
          {t('prev')}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t('page', { page, total: totalPages })}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={onNext}>
          {t('next')}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
