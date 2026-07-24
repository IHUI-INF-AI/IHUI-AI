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
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
