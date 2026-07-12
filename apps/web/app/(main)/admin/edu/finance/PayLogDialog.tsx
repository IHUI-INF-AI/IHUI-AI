'use client'
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@ihui/ui'
import type { PayLog, CForm } from './types'

interface Props {
  open: boolean
  editing: PayLog | null
  form: CForm
  onFormChange: (patch: Partial<CForm>) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  pending: boolean
  err: string | null
}

export function PayLogDialog({
  open,
  editing,
  form,
  onFormChange,
  onClose,
  onSubmit,
  pending,
  err,
}: Props) {
  const t = useTranslations('admin.edu.finance.index')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pl-user">{t('userUuidLabel')}</Label>
              <Input
                id="pl-user"
                value={form.userUuid}
                onChange={(e) => onFormChange({ userUuid: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-course">{t('courseIdLabel')}</Label>
              <Input
                id="pl-course"
                value={form.courseId}
                onChange={(e) => onFormChange({ courseId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-video">{t('videoIdLabel')}</Label>
              <Input
                id="pl-video"
                value={form.videoId}
                onChange={(e) => onFormChange({ videoId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-outBillOn">{t('outBillOnLabel')}</Label>
              <Input
                id="pl-outBillOn"
                type="date"
                value={form.outBillOn}
                onChange={(e) => onFormChange({ outBillOn: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-payWay">{t('payWayLabel')}</Label>
              <Input
                id="pl-payWay"
                value={form.payWay}
                onChange={(e) => onFormChange({ payWay: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-amount">{t('amountLabel')}</Label>
              <Input
                id="pl-amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => onFormChange({ amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-realAmount">{t('realAmountLabel')}</Label>
              <Input
                id="pl-realAmount"
                type="number"
                min="0"
                step="0.01"
                value={form.realAmount}
                onChange={(e) => onFormChange({ realAmount: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
