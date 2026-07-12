'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Workflow, Zap, Clock, Play } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { TRIGGER_BADGE, STATUS_DOT } from './helpers'
import type { WfStatus, WorkflowItem } from './types'

interface Props {
  wfs: WorkflowItem[]
  isLoading: boolean
  onItemClick: (id: string) => void
}

export function WorkflowCardList({ wfs, isLoading, onItemClick }: Props) {
  const t = useTranslations('workflows')
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

  if (wfs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        {t('noData')}
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {wfs.map((w) => {
        const stepCount = Array.isArray(w.steps) ? w.steps.length : 0
        const status: WfStatus = w.isActive ? 'active' : 'inactive'
        return (
          <Card
            key={w.id}
            className="cursor-pointer transition-colors hover:bg-accent/40"
            onClick={() => onItemClick(w.id)}
          >
            <CardHeader className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Workflow className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
                    TRIGGER_BADGE[w.triggerType],
                  )}
                >
                  <Zap className="h-3 w-3" />
                  {t(`triggers.${w.triggerType}`)}
                </span>
              </div>
              <CardTitle className="text-base">{w.name}</CardTitle>
              <CardDescription className="text-xs">{w.description || '-'}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Play className="h-3 w-3" />
                {t('stepsCount', { count: stepCount })}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
                {t(`status.${status}`)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {dateFmt.format(new Date(w.createdAt))}
              </span>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
