'use client'
import { Edit, Trash2, Loader2, ListOrdered, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@ihui/ui'
import { useTranslations } from 'next-intl'
import { isNotFound } from '@/lib/api-error'
import type { Chapter } from './types'

interface Props {
  rows: Chapter[]
  isLoading: boolean
  error: unknown
  lessonId: string
  expanded: Set<string>
  onToggleExpand: (id: string) => void
  onEdit: (c: Chapter) => void
  onDelete: (c: Chapter) => void
  deletePending: boolean
}

export function ChapterList({
  rows,
  isLoading,
  error,
  lessonId,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  deletePending,
}: Props) {
  const t = useTranslations('admin.edu.course.chapters')
  const noEndpoint = isNotFound(error)

  if (!lessonId) {
    return (
      <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground">
        <ListOrdered className="mx-auto mb-2 h-8 w-8 opacity-40" />
        {t('selectCourseFirst')}
      </div>
    )
  }
  if (isLoading) {
    return (
      <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    )
  }
  if (noEndpoint) {
    return (
      <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground">
        <ListOrdered className="mx-auto mb-2 h-8 w-8 opacity-40" />
        {t('endpointNotConfigured')}
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground">
        <ListOrdered className="mx-auto mb-2 h-8 w-8 opacity-40" />
        {t('noChapters')}
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {rows.map((ch) => {
        const isExp = expanded.has(ch.id)
        return (
          <div key={ch.id} className="rounded-lg border">
            <div className="flex items-center gap-2 px-4 py-3 hover:bg-muted/30">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleExpand(ch.id)}
                className="h-7 w-7 p-0"
              >
                {isExp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
              <span className="font-medium">{ch.title}</span>
              <span className="text-xs text-muted-foreground">
                {t('sortOrder', { value: ch.sortOrder })}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => onEdit(ch)} title={t('edit')}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(ch)}
                  title={t('delete')}
                  className="text-destructive hover:text-destructive"
                  disabled={deletePending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {isExp && (
              <div className="border-t bg-muted/20 px-4 py-2">
                {ch.sections?.length ? (
                  ch.sections.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 py-1.5 text-sm">
                      <span className="text-muted-foreground">└</span>
                      <span>{s.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {t('minutes', { count: s.duration })}
                      </span>
                      {s.isFree && (
                        <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-xs text-sky-600 dark:text-sky-400">
                          {t('free')}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="py-2 text-xs text-muted-foreground">{t('noSections')}</p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
