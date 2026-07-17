'use client'

import Link from 'next/link'
import { HelpCircle, Loader2, MessageSquare, Eye, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { AskItem } from './types'

interface Props {
  list: AskItem[]
  isLoading: boolean
  error: Error | null
}

export function AsksList({ list, isLoading, error }: Props) {
  const t = useTranslations('asks')
  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  if (error)
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error.message}
      </div>
    )
  if (list.length === 0)
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
        <HelpCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      </div>
    )
  return (
    <div className="space-y-3">
      {list.map((a) => (
        <Link key={a.id} href={`/asks/${a.id}`}>
          <Card className="transition-colors hover:bg-accent">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-base">{a.title}</CardTitle>
                <span
                  className={cn(
                    'flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                    a.isResolved
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-amber-500/10 text-amber-600',
                  )}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {a.isResolved ? t('resolved') : t('unresolved')}
                </span>
              </div>
              {a.tags && a.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {a.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent className="flex items-center gap-4 p-4 pt-0 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {t('answerCount', { count: a.answerCount })}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {t('viewCount', { count: a.viewCount })}
              </span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
