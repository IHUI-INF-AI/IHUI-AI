'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { ArrowLeft } from 'lucide-react'

import { cn } from '@/lib/utils'
import { TYPE_ICON, TYPE_BADGE, STATUS_BADGE, PRIORITY_BADGE } from '@/lib/feedback'
import type { FeedbackItem } from './types'

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        className,
      )}
    >
      {children}
    </span>
  )
}

interface Props {
  fb: FeedbackItem
}

export function FeedbackDetailHeader({ fb }: Props) {
  const t = useTranslations('feedback')
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const TypeIcon = TYPE_ICON[fb.type]

  return (
    <>
      <Link
        href="/feedback"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
            <TypeIcon className="h-4 w-4" />
          </div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">{fb.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge className={TYPE_BADGE[fb.type]}>{t(`type_${fb.type}`)}</Badge>
          <Badge className={STATUS_BADGE[fb.status]}>{t(`status_${fb.status}`)}</Badge>
          <Badge className={PRIORITY_BADGE[fb.priority]}>{t(`priority_${fb.priority}`)}</Badge>
          <span>·</span>
          <span>{dateFmt.format(new Date(fb.createdAt))}</span>
        </div>
      </header>
    </>
  )
}
