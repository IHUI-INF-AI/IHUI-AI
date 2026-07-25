'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Edit, Trash2, CheckCircle2 } from 'lucide-react'
import { Button, DataTable, type DataTableColumn } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { TruncatedText } from '@/components/common'
import { STATUS_META } from './helpers'
import type { AskItem } from './types'

interface Props {
  list: AskItem[]
  isLoading: boolean
  error: Error | null
  auditPending: boolean
  deletePending: boolean
  page: number
  pageSize: number
  total: number
  totalPages: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
  onEdit: (item: AskItem) => void
  onAudit: (item: AskItem) => void
  onDelete: (item: AskItem) => void
}

export function AsksTable({
  list,
  isLoading,
  error,
  auditPending,
  deletePending,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onAudit,
  onDelete,
}: Props) {
  const t = useTranslations('admin.asks')
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const columns = React.useMemo<DataTableColumn<AskItem>[]>(
    () => [
      {
        id: 'title',
        accessorKey: 'title',
        header: t('colTitle'),
        size: 240,
        cell: ({ row }) => (
          <div className="max-w-xs">
            <TruncatedText value={row.original.title} className="font-medium" />
            {row.original.categoryName && (
              <div className="text-xs text-muted-foreground">{row.original.categoryName}</div>
            )}
          </div>
        ),
      },
      {
        id: 'user',
        accessorKey: 'userName',
        header: t('colUser'),
        size: 120,
        cell: ({ row }) =>
          row.original.user?.nickname ?? row.original.userName ?? '-',
      },
      {
        id: 'answerCount',
        accessorKey: 'answerCount',
        header: t('colAnswerCount'),
        size: 90,
        cell: ({ row }) => row.original.answerCount,
      },
      {
        id: 'isResolved',
        accessorKey: 'isResolved',
        header: t('colResolved'),
        size: 110,
        filterFn: (row, _id, value) => {
          const v = String(value).toLowerCase()
          if (v === 'true' || v === '1' || v === 'yes') return row.original.isResolved
          if (v === 'false' || v === '0' || v === 'no') return !row.original.isResolved
          return true
        },
        cell: ({ row }) =>
          row.original.isResolved ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('resolved')}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t('unresolved')}</span>
          ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: t('colStatus'),
        size: 110,
        filterFn: (row, _id, value) => String(row.original.status) === String(value),
        cell: ({ row }) => {
          const meta =
            STATUS_META[row.original.status] ??
            STATUS_META[0] ?? { label: 'statusHidden', cls: 'bg-muted text-muted-foreground' }
          return (
            <span
              className={cn(
                'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                meta.cls,
              )}
            >
              {t(meta.label)}
            </span>
          )
        },
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: t('colCreatedAt'),
        size: 130,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {dateFmt.format(new Date(row.original.createdAt))}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('colActions'),
        size: 150,
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Tooltip content={t('edit')}>
              <Button variant="ghost" size="sm" onClick={() => onEdit(row.original)}>
                <Edit className="h-4 w-4" />
              </Button>
            </Tooltip>
            {row.original.status !== 1 && (
              <Tooltip content={t('audit')}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAudit(row.original)}
                  disabled={auditPending}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              </Tooltip>
            )}
            <Tooltip content={t('delete')}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(row.original)}
                className="text-destructive hover:text-destructive"
                disabled={deletePending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
        ),
      },
    ],
    [t, dateFmt, auditPending, deletePending, onEdit, onAudit, onDelete],
  )

  return (
    <DataTable
      columns={columns}
      data={list}
      manualPagination
      pageCount={totalPages}
      controlledPageIndex={page - 1}
      controlledPageSize={pageSize}
      controlledTotal={total}
      onPageIndexChange={(i) => onPageChange(i + 1)}
      onPageSizeChange={onPageSizeChange}
      loading={isLoading}
      error={error}
      loadingText={t('loading')}
      emptyText={t('noData')}
      enableColumnResize
      enableColumnFilters
      enableRowExpansion
      expandOnRowClick
      renderExpandedRow={(row) => (
        <div className="space-y-2 text-sm">
          <div>
            <div className="text-xs font-medium text-muted-foreground">内容</div>
            <div className="mt-1 whitespace-pre-wrap">
              {row.original.content || '-'}
            </div>
          </div>
          {row.original.tags && row.original.tags.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground">标签</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {row.original.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>浏览 {row.original.viewCount}</span>
            <span>点赞 {row.original.likeCount}</span>
            <span>回答 {row.original.answerCount}</span>
          </div>
        </div>
      )}
    />
  )
}
