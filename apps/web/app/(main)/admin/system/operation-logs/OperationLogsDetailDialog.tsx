'use client'

import { useTranslations } from 'next-intl'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@ihui/ui-react'
import { BIZ_TYPE, STATUS_LABEL } from './helpers'
import type { OperLog } from './types'
import { formatDate } from '@/lib/date-utils'

interface OperationLogsDetailDialogProps {
  detail: OperLog | null
  onClose: () => void
}

export function OperationLogsDetailDialog({ detail, onClose }: OperationLogsDetailDialogProps) {
  const t = useTranslations('admin.system')
  const statusInfo = detail ? STATUS_LABEL[detail.status] : undefined
  return (
    <Dialog open={!!detail} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('operationLogs.detail.title')}</DialogTitle>
        </DialogHeader>
        {detail && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">{t('operationLogs.detail.module')}</span>
              {detail.title}
            </div>
            <div>
              <span className="text-muted-foreground">{t('operationLogs.detail.type')}</span>
              {BIZ_TYPE[detail.businessType] ? t(BIZ_TYPE[detail.businessType]!) : '-'}
            </div>
            <div>
              <span className="text-muted-foreground">{t('operationLogs.detail.operName')}</span>
              {detail.operName}
            </div>
            <div>
              <span className="text-muted-foreground">{t('operationLogs.detail.ip')}</span>
              {detail.operIp}
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">{t('operationLogs.detail.operUrl')}</span>
              {detail.operUrl}
            </div>
            <div>
              <span className="text-muted-foreground">{t('operationLogs.detail.requestMethod')}</span>
              {detail.requestMethod}
            </div>
            <div>
              <span className="text-muted-foreground">{t('operationLogs.detail.costTime')}</span>
              {detail.costTime}ms
            </div>
            <div>
              <span className="text-muted-foreground">{t('operationLogs.detail.status')}</span>
              {statusInfo ? t(statusInfo.label) : '-'}
            </div>
            <div>
              <span className="text-muted-foreground">{t('operationLogs.detail.operTime')}</span>
              {detail.operTime ? formatDate(detail.operTime) : '-'}
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">{t('operationLogs.detail.operParam')}</span>
              <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-xs">
                {detail.operParam || '-'}
              </pre>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">{t('operationLogs.detail.jsonResult')}</span>
              <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-xs">
                {detail.jsonResult || '-'}
              </pre>
            </div>
            {detail.status === 1 && (
              <div className="col-span-2">
                <span className="text-destructive">{t('operationLogs.detail.errorMsg')}</span>
                <pre className="mt-1 max-h-32 overflow-auto rounded bg-red-500/5 p-2 text-xs text-destructive">
                  {detail.errorMsg || '-'}
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
