'use client'

import { FileText, Trash2, Loader2, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

import { STATUS_STYLE, statusKey } from './helpers'
import type { Paper } from './types'

interface Props {
  list: Paper[]
  isLoading: boolean
  error: Error | null
  delPending: boolean
  onDelete: (paper: Paper) => void
}

export function PapersList({ list, isLoading, error, delPending, onDelete }: Props) {
  const t = useTranslations('papers')
  const tc = useTranslations('student')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {tc('loading')}
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
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      </div>
    )
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((paper) => (
        <Card key={paper.id} className="transition-colors hover:bg-accent">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <span
                className={cn(
                  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                  STATUS_STYLE[paper.status] ?? STATUS_STYLE[0],
                )}
              >
                {t(statusKey(paper.status))}
              </span>
            </div>
            <h3 className="font-medium">{paper.paperTitle}</h3>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              {paper.paperUrl && (
                <a
                  href={paper.paperUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <Upload className="h-3 w-3" />
                  {t('paperUrlField')}
                </a>
              )}
              {paper.createdAt && <p>{new Date(paper.createdAt).toLocaleDateString('zh-CN')}</p>}
            </div>
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={delPending}
                onClick={() => onDelete(paper)}
              >
                <Trash2 className="h-4 w-4" />
                {t('delete')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
