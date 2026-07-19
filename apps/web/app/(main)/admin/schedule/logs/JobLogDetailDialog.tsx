'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@ihui/ui'
import { normalizeStatus } from './helpers'
import type { JobLog } from './types'

interface Props {
  open: boolean
  log: JobLog | null
  onClose: () => void
}

const BADGE: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-600',
  fail: 'bg-red-500/10 text-red-600',
  running: 'bg-blue-500/10 text-blue-600',
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="text-sm">{value ?? '-'}</div>
    </div>
  )
}

export function JobLogDetailDialog({ open, log, onClose }: Props) {
  const t = useTranslations('admin.scheduleLogs')
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

  if (!log) return null
  const s = normalizeStatus(log.status)

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
          <Field label={t('fieldJobName')} value={log.jobName} />
          <Field label={t('fieldJobGroup')} value={log.jobGroup} />
          <Field label={t('fieldInvokeTarget')} value={log.invokeTarget} />
          <Field label={t('fieldJobMessage')} value={log.jobMessage} />
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('fieldStatus')}</label>
            <div>
              <span className={`inline-flex rounded-md px-2 py-0.5 text-xs ${BADGE[s]}`}>
                {s === 'success'
                  ? t('statusSuccess')
                  : s === 'fail'
                    ? t('statusFail')
                    : t('statusRunning')}
              </span>
            </div>
          </div>
          <Field label={t('fieldCreateTime')} value={fmt(log.createTime)} />
          <Field label={t('fieldStartTime')} value={fmt(log.startTime)} />
          <Field label={t('fieldEndTime')} value={fmt(log.endTime)} />
          <Field
            label={t('fieldDuration')}
            value={typeof log.duration === 'number' ? `${log.duration} ms` : '-'}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t('fieldExceptionInfo')}</label>
          <textarea
            readOnly
            value={log.exceptionInfo ?? ''}
            placeholder={t('emptyException')}
            className="h-32 w-full resize-none rounded-md border bg-muted/30 p-3 font-mono text-xs"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
