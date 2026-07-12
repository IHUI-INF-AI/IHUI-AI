'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@ihui/ui'
import { DatePicker } from '@/components/form/DatePicker'
import type { AuthFindInfo, AuthFindInfoForm } from './types'

interface DialogProps {
  open: boolean
  editing: AuthFindInfo | null
  form: AuthFindInfoForm
  onFormChange: (patch: Partial<AuthFindInfoForm>) => void
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function AuthFindInfoDialog({
  open,
  editing,
  form,
  onFormChange,
  savePending,
  onSubmit,
  onClose,
}: DialogProps) {
  const t = useTranslations('adminAuthFindInfo')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
            <DialogDescription>{editing ? t('editDesc') : t('createDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t('userUuid')}</Label>
              <Input
                value={form.userUuid}
                onChange={(e) => onFormChange({ userUuid: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('card')}</Label>
              <Input value={form.card} onChange={(e) => onFormChange({ card: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('belong')}</Label>
              <Input
                value={form.belong}
                onChange={(e) => onFormChange({ belong: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('titleLabel')}</Label>
              <Input value={form.title} onChange={(e) => onFormChange({ title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('message')}</Label>
              <Input
                value={form.message}
                onChange={(e) => onFormChange({ message: e.target.value })}
              />
            </div>
            <DatePicker
              label={t('createdAt')}
              value={form.createdAt}
              onChange={(v) => onFormChange({ createdAt: v })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteDialogProps {
  delId: string | null
  deletePending: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function AuthFindInfoDeleteDialog({
  delId,
  deletePending,
  onConfirm,
  onCancel,
}: DeleteDialogProps) {
  const t = useTranslations('adminAuthFindInfo')
  return (
    <Dialog
      open={delId !== null}
      onOpenChange={(o) => {
        if (!o) onCancel()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('deleteTitle')}</DialogTitle>
          <DialogDescription>{t('deleteDesc')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={deletePending}>
            {t('cancel')}
          </Button>
          <Button type="button" variant="destructive" disabled={deletePending} onClick={onConfirm}>
            {deletePending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {t('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
