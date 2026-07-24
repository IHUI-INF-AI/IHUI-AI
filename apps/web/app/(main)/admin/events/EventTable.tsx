'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Edit, Trash2 } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { TYPE_DOT, LEVEL_BADGE } from './helpers'
import type { SystemEvent } from './types'

interface Props {
  list: SystemEvent[]
  isLoading: boolean
  onEdit: (ev: SystemEvent) => void
  onDelete: (ev: SystemEvent) => void
}

export function EventTable({ list, isLoading, onEdit, onDelete }: Props) {
  const t = useTranslations('admin.events')
  const tc = useTranslations('common')
  const locale = useLocale()
  const dtFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  return (
    <div className="rounded-lg border">
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : list.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">{t('noData')}</div>
      ) : (
        <ul className="divide-y">
          {list.map((ev) => (
            <li
              key={ev.id}
              className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
            >
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', TYPE_DOT[ev.type])} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {dtFmt.format(new Date(ev.createdAt))}
                  </span>
                  <span
                    className={cn(
                      'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                      LEVEL_BADGE[ev.level],
                    )}
                  >
                    {t(`levels.${ev.level}`)}
                  </span>
                  <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {t(`types.${ev.type}`)}
                  </span>
                </div>
                <p className="mt-1 break-words text-sm">{ev.message}</p>
                {ev.data && (
                  <pre className="mt-1.5 max-h-40 overflow-auto rounded-md bg-muted/50 p-2 text-xs">
                    {JSON.stringify(ev.data, null, 2)}
                  </pre>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => onEdit(ev)}>
                  <Edit className="h-4 w-4" />
                  {tc('edit')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(ev)}
                >
                  <Trash2 className="h-4 w-4" />
                  {tc('delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
