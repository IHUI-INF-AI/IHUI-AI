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
import { textareaClass } from './helpers'
import type { ActionState } from './types'

interface RefundDialogProps {
  action: ActionState | null
  reason: string
  err: string | null
  isRejectPending: boolean
  isApprovePending: boolean
  currencyFmt: Intl.NumberFormat
  onReasonChange: (v: string) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  onApprove: () => void
}

export function RefundDialog({
  action,
  reason,
  err,
  isRejectPending,
  isApprovePending,
  currencyFmt,
  onReasonChange,
  onClose,
  onSubmit,
  onApprove,
}: RefundDialogProps) {
  const t = useTranslations('admin.refund')
  const tc = useTranslations('common')
  const disabled = isRejectPending || isApprovePending

  return (
    <Dialog open={!!action} onOpenChange={(o) => (!o && !disabled ? onClose() : null)}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {action?.mode === 'audit' ? t('auditTitle') : t('rejectTitle')}
            </DialogTitle>
            <DialogDescription>
              {action?.mode === 'audit' ? t('auditDesc') : t('rejectDesc')}
            </DialogDescription>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          {action && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
              <div className="font-mono text-xs">{action.refund.orderNo}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {currencyFmt.format(Number(action.refund.refundAmount))} ·{' '}
                {t(`status_${action.refund.status}`)}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="r-reason">{t('fieldReason')}</Label>
            <textarea
              id="r-reason"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              rows={3}
              className={textareaClass}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={disabled}>
              {tc('cancel')}
            </Button>
            {action?.mode === 'audit' ? (
              <>
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    onApprove()
                  }}
                  disabled={isApprovePending}
                >
                  {isApprovePending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Check className="mr-1 h-4 w-4" />
                  {t('approve')}
                </Button>
                <Button type="submit" variant="destructive" disabled={isRejectPending}>
                  {isRejectPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <X className="mr-1 h-4 w-4" />
                  {t('reject')}
                </Button>
              </>
            ) : (
              <Button type="submit" variant="destructive" disabled={isRejectPending}>
                {isRejectPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('reject')}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
