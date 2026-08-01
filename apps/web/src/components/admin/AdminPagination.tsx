'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@ihui/ui-react'

export interface AdminPaginationProps {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  /** i18n 文案:总数 */
  totalLabel?: string
  /** i18n 文案:上一页 */
  prevLabel?: string
  /** i18n 文案:下一页 */
  nextLabel?: string
}

/**
 * 管理端分页组件 — 上一页/下一页 + 页码 + 总数。
 *
 * 替代 ~40 个 page.tsx 底部手写的分页 UI。
 */
export function AdminPagination({
  page,
  totalPages,
  total,
  onPageChange,
  totalLabel,
  prevLabel,
  nextLabel,
}: AdminPaginationProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 whitespace-nowrap tabular-nums text-sm text-muted-foreground">
        {totalLabel ?? `共 ${total} 条`}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
          {prevLabel ?? '上一页'}
        </Button>
        <span className="shrink-0 whitespace-nowrap tabular-nums text-sm text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          {nextLabel ?? '下一页'}
          <ChevronRight className="h-4 w-4 shrink-0" />
        </Button>
      </div>
    </div>
  )
}
