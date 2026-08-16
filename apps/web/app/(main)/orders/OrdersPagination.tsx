'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { PAGE_SIZE } from './helpers'

interface Props {
  total: number
  page: number
  totalPages: number
  setPage: React.Dispatch<React.SetStateAction<number>>
}

export function OrdersPagination({ total, page, totalPages, setPage }: Props) {
  const t = useTranslations('orders')
  if (total <= PAGE_SIZE) return null
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 whitespace-nowrap tabular-nums text-sm text-muted-foreground">
        {t('total', { total })}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          className="shrink-0"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
        </Button>
        <span className="shrink-0 whitespace-nowrap tabular-nums text-sm text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button
          className="shrink-0"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          <ChevronRight className="h-4 w-4 shrink-0" />
        </Button>
      </div>
    </div>
  )
}
