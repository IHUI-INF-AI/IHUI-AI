'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'

interface Props {
  total: number
  page: number
  totalPages: number
  pageSize: number
  setPage: React.Dispatch<React.SetStateAction<number>>
}

export function MembersPagination({ total, page, totalPages, pageSize, setPage }: Props) {
  const t = useTranslations('members')
  if (total <= pageSize) return null
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
