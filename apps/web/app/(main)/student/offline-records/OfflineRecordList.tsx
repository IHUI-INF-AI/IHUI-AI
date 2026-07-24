'use client'

import { Loader2, CalendarClock, Edit, Trash2, Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { TYPE_COLORS } from './helpers'
import type { OfflineRecord } from './types'

interface Props {
  list: OfflineRecord[]
  isLoading: boolean
  error: Error | null
  delPending: boolean
  onEdit: (record: OfflineRecord) => void
  onDelete: (record: OfflineRecord) => void
}

export function OfflineRecordList({ list, isLoading, error, delPending, onEdit, onDelete }: Props) {
  const t = useTranslations('offlineRecords')
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
        <CalendarClock className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      </div>
    )
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {list.map((record, idx) => (
        <Card key={record.id} className="transition-colors hover:bg-accent">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                    TYPE_COLORS[idx % TYPE_COLORS.length],
                  )}
                >
                  {record.type}
                </span>
                {record.hours !== null && record.hours !== undefined && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {record.hours}h
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => onEdit(record)}>
                  <Edit className="h-4 w-4" />
                  {t('edit')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={delPending}
                  onClick={() => onDelete(record)}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('delete')}
                </Button>
              </div>
            </div>
            <h3 className="font-medium">{record.title}</h3>
            {record.description && (
              <p className="text-sm text-muted-foreground">{record.description}</p>
            )}
            {record.occurredAt && (
              <p className="text-xs text-muted-foreground">
                {new Date(record.occurredAt).toLocaleDateString('zh-CN')}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
