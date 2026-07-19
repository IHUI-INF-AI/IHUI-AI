'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@ihui/ui'
import { Badge, methodClass, statusClass } from './helpers'
import type { ApiLog } from './types'

interface Props {
  selected: ApiLog | null
  dateFmt: Intl.DateTimeFormat
  onClose: () => void
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="w-24 shrink-0 text-xs uppercase text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  )
}

export function LogDetailDialog({ selected, dateFmt, onClose }: Props) {
  const t = useTranslations('admin.logs')
  return (
    <Dialog open={!!selected} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('detail')}</DialogTitle>
          <DialogDescription>{selected?.path}</DialogDescription>
        </DialogHeader>
        {selected && (
          <dl className="space-y-2.5 text-sm">
            <Row label={t('method')}>
              <Badge cls={methodClass(selected.method)}>{selected.method}</Badge>
            </Row>
            <Row label={t('path')}>
              <code className="break-all font-mono text-xs">{selected.path}</code>
            </Row>
            <Row label={t('statusCode')}>
              <Badge cls={statusClass(selected.statusCode)}>{selected.statusCode}</Badge>
            </Row>
            <Row label={t('duration')}>
              {selected.duration}
              {t('ms')}
            </Row>
            <Row label={t('time')}>{dateFmt.format(new Date(selected.createdAt))}</Row>
            <Row label={t('ip')}>{selected.ip || '-'}</Row>
            <Row label={t('user')}>
              {selected.userId ? (
                <code className="font-mono text-xs">{selected.userId}</code>
              ) : (
                t('anonymous')
              )}
            </Row>
            <Row label={t('userAgent')}>
              <span className="break-all text-xs text-muted-foreground">
                {selected.userAgent || '-'}
              </span>
            </Row>
            {selected.error && (
              <Row label={t('error')}>
                <pre className="max-h-40 overflow-auto rounded-md bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400">
                  {selected.error}
                </pre>
              </Row>
            )}
          </dl>
        )}
      </DialogContent>
    </Dialog>
  )
}
