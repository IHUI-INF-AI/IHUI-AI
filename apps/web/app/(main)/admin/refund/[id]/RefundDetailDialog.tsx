'use client'

import * as React from 'react'
import { Loader2, Check, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
} from '@ihui/ui'
import { textareaClass } from '../helpers'
import type { EduRefund } from '../types'

interface RefundDetailDialogProps {
  action: 'audit' | 'reject' | null
  refund: EduRefund | undefined
  reason: string
  err: string | null
  isAuditPending: boolean
  isRejectPending: boolean
  currencyFmt: Intl.NumberFormat
  onReasonChange: (v: string) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  onApprove: () => void
}

export function RefundDetailDialog({
  action,
  refund,
  reason,
  err,
  isAuditPending,
  isRejectPending,
  currencyFmt,
  onReasonChange,
  onClose,
  onSubmit,
  onApprove,
}: RefundDetailDialogProps) {
  const t = useTranslations('admin.refund')
  const tc = useTranslations('common')

  return (
    <Dialog
      open={!!action}
      onOpenChange={(o) => (!o && !isAuditPending && !isRejectPending ? onClose() : null)}
    >
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{action === 'audit' ? t('auditTitle') : t('rejectTitle')}</DialogTitle>
            <DialogDescription>
              {action === 'audit' ? t('auditDesc') : t('rejectDesc')}
            </DialogDescription>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          {refund && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
              <div className="font-mono text-xs">{refund.orderNo}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {currencyFmt.format(Number(refund.refundAmount))} · {t(`status_${refund.status}`)}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="d-reason">{t('fieldReason')}</Label>
            <textarea
              id="d-reason"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              rows={3}
              className={textareaClass}
            />
          </div>
          <DialogFooter>
            {action === 'audit' ? (
              <>
                <Button type="button" variant="outline" onClick={onClose} disabled={isAuditPending}>
                  {tc('cancel')}
                </Button>
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    onApprove()
                  }}
                  disabled={isAuditPending}
                >
                  {isAuditPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Check className="mr-1 h-4 w-4" />
                  {t('approve')}
                </Button>
                <Button type="submit" variant="destructive" disabled={isAuditPending}>
                  {isAuditPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <X className="mr-1 h-4 w-4" />
                  {t('reject')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isRejectPending}
                >
                  {tc('cancel')}
                </Button>
                <Button type="submit" variant="destructive" disabled={isRejectPending}>
                  {isRejectPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('reject')}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
