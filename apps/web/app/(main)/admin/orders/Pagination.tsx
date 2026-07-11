'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui'

export function Pagination({
  page,
  totalPages,
  total,
  setPage,
  t,
}: {
  page: number
  totalPages: number
  total: number
  setPage: (p: number) => void
  t: ReturnType<typeof useTranslations<'admin.orders'>>
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage(Math.max(1, page - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
          {t('prev')}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t('page', { page, total: totalPages })}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          {t('next')}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
