'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@ihui/ui'
import { maskUserId, STATUS_BADGE } from './helpers'
import type { NotificationLog } from './types'

interface Props {
  open: boolean
  log: NotificationLog | null
  onClose: () => void
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="break-all text-sm">{value ?? '-'}</div>
    </div>
  )
}

export function NotificationLogDetailDialog({ open, log, onClose }: Props) {
  const t = useTranslations('admin.notificationLogs')
  const locale = useLocale()
  const dtf = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [locale],
  )

  function fmt(v?: string): string {
    if (!v) return '-'
    const d = new Date(v)
    if (isNaN(d.getTime())) return v
    return dtf.format(d)
  }

  function formatContent(v?: string): string {
    if (!v) return ''
    try {
      return JSON.stringify(JSON.parse(v), null, 2)
    } catch {
      return v
    }
  }

  function statusLabel(s?: string): string {
    if (s === 'sent') return t('sent')
    if (s === 'failed') return t('failed')
    if (s === 'pending') return t('pending')
    return s ?? '-'
  }

  if (!log) return null
  const s = log.status ?? ''

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('detailTitle')}</DialogTitle>
          <DialogDescription>{t('detailDesc')}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('fieldId')} value={log.id} />
          <Field label={t('fieldUserId')} value={maskUserId(log.user_id)} />
          <Field label={t('fieldChannel')} value={log.channel} />
          <Field label={t('fieldType')} value={log.type} />
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('fieldStatus')}</label>
            <div>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                  STATUS_BADGE[s] ?? 'bg-muted text-muted-foreground'
                }`}
              >
                {statusLabel(log.status)}
              </span>
            </div>
          </div>
          <Field label={t('fieldCreatedAt')} value={fmt(log.created_at)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t('fieldContent')}</label>
          <textarea
            readOnly
            value={formatContent(log.content)}
            className="h-40 w-full resize-none rounded-md border bg-muted/30 p-3 font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t('errorDetail')}</label>
          <textarea
            readOnly
            value={log.error_message ?? ''}
            placeholder={t('emptyError')}
            className="h-24 w-full resize-none rounded-md border bg-muted/30 p-3 font-mono text-xs"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
