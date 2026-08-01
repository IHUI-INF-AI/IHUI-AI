'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'

interface Props {
  page: number
  totalPages: number
  total: number
  setPage: (p: number) => void
}

export function Pagination({ page, totalPages, total, setPage }: Props) {
  const t = useTranslations('admin.agentRules')
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 whitespace-nowrap tabular-nums text-sm text-muted-foreground">{t('total', { total })}</span>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          className="shrink-0"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage(Math.max(1, page - 1))}
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
          {t('prev')}
        </Button>
        <span className="shrink-0 whitespace-nowrap tabular-nums text-sm text-muted-foreground">{t('pageInfo', { page, totalPages })}</span>
        <Button
          className="shrink-0"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          {t('next')}
          <ChevronRight className="h-4 w-4 shrink-0" />
        </Button>
      </div>
    </div>
  )
}
