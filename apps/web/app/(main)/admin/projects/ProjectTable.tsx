'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Loader2, FolderCog, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { STATUS_BADGE } from './helpers'
import type { AdminProject } from './types'

interface Props {
  list: AdminProject[]
  isLoading: boolean
  error: Error | null
  page: number
  total: number
  totalPages: number
  onEdit: (p: AdminProject) => void
  onDelete: (p: AdminProject) => void
  onPageChange: (page: number) => void
}

export function ProjectTable({
  list,
  isLoading,
  error,
  page,
  total,
  totalPages,
  onEdit,
  onDelete,
  onPageChange,
}: Props) {
  const t = useTranslations('admin.projects')
  const tc = useTranslations('common')
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error.message}
      </div>
    )
  }
  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
        <FolderCog className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('noData')}</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <Card key={p.id} className="transition-colors hover:bg-accent hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex min-w-0 items-center gap-2">
                  <FolderCog className="h-4 w-4 shrink-0 text-primary" />
                  <span className="break-words">{p.name}</span>
                </span>
                <span
                  className={cn(
                    'inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                    STATUS_BADGE[p.status] ?? 'bg-muted text-muted-foreground',
                  )}
                >
                  {t(`status_${p.status}`)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {p.description && <p className="text-muted-foreground">{p.description}</p>}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('owner')}</span>
                <span className="font-medium">
                  {p.ownerNickname ?? p.ownerPhone ?? p.ownerEmail ?? p.userId.slice(0, 8)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-muted-foreground">{t('createdAt')}</span>
                <span className="text-xs text-muted-foreground">
                  {dateFmt.format(new Date(p.createdAt))}
                </span>
              </div>
              <div className="flex items-center gap-1 border-t pt-2">
                <Button size="sm" variant="ghost" className="flex-1" onClick={() => onEdit(p)}>
                  <Edit className="h-4 w-4" />
                  {tc('edit')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(p)}
                >
                  <Trash2 className="h-4 w-4" />
                  {tc('delete')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
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
            onClick={() => onPageChange(page + 1)}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  )
}
