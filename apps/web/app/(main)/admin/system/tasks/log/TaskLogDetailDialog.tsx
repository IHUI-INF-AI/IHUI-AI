'use client'

import { useTranslations } from 'next-intl'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@ihui/ui-react'
import { STATUS_LABEL } from './helpers'
import type { JobLog } from './types'
import { formatDate } from '@/lib/date-utils'

interface Props {
  detail: JobLog | null
  onClose: () => void
}

export function TaskLogDetailDialog({ detail, onClose }: Props) {
  const t = useTranslations('admin.system')
  const statusInfo = detail ? STATUS_LABEL[detail.status] : undefined
  return (
    <Dialog open={!!detail} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('tasksLog.detail.title')}</DialogTitle>
        </DialogHeader>
        {detail && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">{t('tasksLog.detail.id')}</span>
              {detail.id}
            </div>
            <div>
              <span className="text-muted-foreground">{t('tasksLog.detail.jobName')}</span>
              {detail.jobName}
            </div>
            <div>
              <span className="text-muted-foreground">{t('tasksLog.detail.jobGroup')}</span>
              {detail.jobGroup}
            </div>
            <div>
              <span className="text-muted-foreground">{t('tasksLog.detail.status')}</span>
              {statusInfo ? t(statusInfo.label) : '-'}
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">{t('tasksLog.detail.invokeTarget')}</span>
              <code className="font-mono text-xs">{detail.invokeTarget}</code>
            </div>
            <div>
              <span className="text-muted-foreground">{t('tasksLog.detail.startTime')}</span>
              {detail.startTime ? formatDate(detail.startTime) : '-'}
            </div>
            <div>
              <span className="text-muted-foreground">{t('tasksLog.detail.stopTime')}</span>
              {detail.stopTime ? formatDate(detail.stopTime) : '-'}
            </div>
            <div>
              <span className="text-muted-foreground">{t('tasksLog.detail.costTime')}</span>
              {detail.costTime}ms
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">{t('tasksLog.detail.jobMessage')}</span>
              <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-xs">
                {detail.jobMessage || '-'}
              </pre>
            </div>
            {detail.status === 1 && (
              <div className="col-span-2">
                <span className="text-destructive">{t('tasksLog.detail.exceptionInfo')}</span>
                <pre className="mt-1 max-h-32 overflow-auto rounded bg-red-500/5 p-2 text-xs text-destructive">
                  {detail.exceptionInfo || '-'}
                </pre>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
