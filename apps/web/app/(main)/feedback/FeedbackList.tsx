'use client'

import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, MessageSquare } from 'lucide-react'

import { cn } from '@/lib/utils'
import { TYPE_ICON, TYPE_BADGE, STATUS_BADGE } from '@/lib/feedback'
import type { FeedbackItem } from './types'

interface Props {
  list: FeedbackItem[]
  isLoading: boolean
  error: Error | null
}

export function FeedbackList({ list, isLoading, error }: Props) {
  const t = useTranslations('feedback')
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
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
        <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {list.map((fb) => {
        const TypeIcon = TYPE_ICON[fb.type]
        return (
          <Link
            key={fb.id}
            href={`/feedback/${fb.id}`}
            className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
              <TypeIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-medium">{fb.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {dateFmt.format(new Date(fb.createdAt))}
              </p>
            </div>
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                TYPE_BADGE[fb.type],
              )}
            >
              {t(`type_${fb.type}`)}
            </span>
            <span
              className={cn(
                'inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium',
                STATUS_BADGE[fb.status],
              )}
            >
              {t(`status_${fb.status}`)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
