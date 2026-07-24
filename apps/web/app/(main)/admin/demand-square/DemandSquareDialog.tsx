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
  Label,
} from '@ihui/ui-react'

interface Props {
  open: boolean
  reason: string
  setReason: React.Dispatch<React.SetStateAction<string>>
  err: string | null
  pending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function DemandSquareDialog({
  open,
  reason,
  setReason,
  err,
  pending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.demandSquare')
  const tc = useTranslations('common')
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('rejectTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ds-reason">
              {t('reason')} <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="ds-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('reject')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
